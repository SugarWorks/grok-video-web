import fs from "node:fs";
import path from "node:path";
import type { JobRecord } from "../shared/api.js";
import {
  composePrompt,
  type GenerationOptions,
  generationOptionsSchema,
} from "../shared/options.js";
import type { AppConfig } from "./config.js";
import { generateGrokImageVideo } from "./xai-video.js";

type CreateJobInput = {
  imagePath: string;
  imageUrl: string;
  options: GenerationOptions;
};

export class JobStore {
  private readonly jobs = new Map<string, JobRecord>();
  private readonly jobsDir: string;

  constructor(private readonly config: AppConfig) {
    this.jobsDir = path.join(config.workspaceDir, "jobs");
    fs.mkdirSync(this.jobsDir, { recursive: true });
    this.loadExistingJobs();
  }

  list(): JobRecord[] {
    return [...this.jobs.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);
  }

  get(id: string): JobRecord | undefined {
    return this.jobs.get(id);
  }

  create(input: CreateJobInput): JobRecord {
    const id = `job_${cryptoRandom()}`;
    const now = new Date().toISOString();
    const job: JobRecord = {
      id,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      sourceImageUrl: input.imageUrl,
      sourceImagePath: input.imagePath,
      options: input.options,
      submittedPrompt: composePrompt(input.options),
      progress: ["queued"],
      results: [],
    };
    this.jobs.set(id, job);
    this.persist(job);
    void this.run(job);
    return job;
  }

  private async run(job: JobRecord): Promise<void> {
    this.update(job.id, { status: "running", progress: [...job.progress, "started"] });
    try {
      for (let index = 0; index < job.options.count; index += 1) {
        const result = await generateGrokImageVideo({
          config: this.config,
          imagePath: job.sourceImagePath,
          options: job.options,
          jobId: `${job.id}_${index + 1}`,
          onStatus: (status) =>
            this.appendProgress(job.id, `${index + 1}/${job.options.count}:${status}`),
        });
        const current = this.get(job.id);
        if (!current) return;
        this.update(job.id, {
          results: [
            ...current.results,
            {
              index: index + 1,
              requestId: result.requestId,
              localPath: result.localPath,
              url: fileUrl(this.config.workspaceDir, "videos", path.basename(result.localPath)),
              elapsedMs: result.elapsedMs,
            },
          ],
        });
      }
      this.update(job.id, {
        status: "succeeded",
        progress: [...(this.get(job.id)?.progress ?? []), "done"],
      });
    } catch (error) {
      this.update(job.id, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        progress: [...(this.get(job.id)?.progress ?? []), "failed"],
      });
    }
  }

  private appendProgress(id: string, status: string): void {
    const job = this.get(id);
    if (!job) return;
    this.update(id, { progress: [...job.progress.slice(-40), status] });
  }

  private update(id: string, patch: Partial<JobRecord>): void {
    const job = this.jobs.get(id);
    if (!job) return;
    const next: JobRecord = { ...job, ...patch, updatedAt: new Date().toISOString() };
    this.jobs.set(id, next);
    this.persist(next);
  }

  private persist(job: JobRecord): void {
    fs.writeFileSync(
      path.join(this.jobsDir, `${job.id}.json`),
      `${JSON.stringify(job, null, 2)}\n`,
    );
  }

  private loadExistingJobs(): void {
    if (!fs.existsSync(this.jobsDir)) return;
    for (const file of fs.readdirSync(this.jobsDir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const job = normalizeLoadedJob(
          JSON.parse(fs.readFileSync(path.join(this.jobsDir, file), "utf8")),
        );
        this.jobs.set(job.id, job);
      } catch {
        // Ignore corrupt historical metadata; generated media remains on disk.
      }
    }
  }
}

function normalizeLoadedJob(value: unknown): JobRecord {
  const job = value as JobRecord;
  const options = generationOptionsSchema.safeParse(job.options);
  if (!job.submittedPrompt && options.success) {
    return { ...job, submittedPrompt: composePrompt(options.data) };
  }
  return job;
}

export function fileUrl(workspaceDir: string, kind: "images" | "videos", filename: string): string {
  const safe = path.basename(filename);
  return `/api/files/${kind}/${encodeURIComponent(safe)}`;
}

export function workspacePath(
  config: AppConfig,
  kind: "images" | "videos",
  filename: string,
): string {
  return path.join(config.workspaceDir, kind, path.basename(filename));
}

function cryptoRandom(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}
