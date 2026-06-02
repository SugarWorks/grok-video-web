import fs from "node:fs";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import type { GenerationOptions } from "../shared/options.js";
import { composePrompt } from "../shared/options.js";
import type { AppConfig } from "./config.js";
import { randomId, resolveXaiAuth } from "./xai-auth.js";

export type VideoJobResult = {
  jobId: string;
  requestId: string;
  localPath: string;
  remoteUrl: string;
  elapsedMs: number;
};

export type GenerateVideoInput = {
  config: AppConfig;
  imagePath: string;
  options: GenerationOptions;
  jobId?: string;
  onStatus?: (status: string) => void;
};

type XaiPollResponse = {
  status?: string;
  video?: { url?: string; duration?: number };
  output?: { url?: string };
  url?: string;
};

export async function generateGrokImageVideo(input: GenerateVideoInput): Promise<VideoJobResult> {
  if (!fs.existsSync(input.imagePath))
    throw new Error(`source image does not exist: ${input.imagePath}`);
  const startedAt = Date.now();
  const jobId = input.jobId ?? randomId("video");
  const auth = await resolveXaiAuth(input.config);
  const requestBody = buildXaiVideoRequest(input.config, input.imagePath, input.options);

  input.onStatus?.(`submit:${auth.label}`);
  const submit = await fetchWithRetry(
    `${auth.baseUrl}/videos/generations`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    },
    "submit",
  );
  if (!submit.ok) {
    const body = await submit.text().catch(() => "");
    throw new Error(
      `Grok submit failed: ${submit.status} ${submit.statusText} - ${body.slice(0, 500)}`,
    );
  }
  const submitJson = (await submit.json()) as { request_id?: string };
  const requestId = submitJson.request_id;
  if (!requestId)
    throw new Error(
      `Grok submit returned no request_id: ${JSON.stringify(submitJson).slice(0, 300)}`,
    );

  input.onStatus?.(`poll:${requestId}`);
  const remoteUrl = await pollUntilDone({
    baseUrl: auth.baseUrl,
    token: auth.token,
    requestId,
    intervalSeconds: input.config.defaults.pollIntervalSeconds,
    timeoutSeconds: input.config.defaults.pollTimeoutSeconds,
    onStatus: input.onStatus,
  });
  input.onStatus?.("download");
  const localPath = await downloadVideo(remoteUrl, input.config.workspaceDir, jobId, requestId);
  return { jobId, requestId, localPath, remoteUrl, elapsedMs: Date.now() - startedAt };
}

export function buildXaiVideoRequest(
  config: AppConfig,
  imagePath: string,
  options: GenerationOptions,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: config.xai.model,
    prompt: composePrompt(options),
    image: { url: encodeImageAsDataUrl(imagePath) },
    duration: options.durationSeconds,
    resolution: options.resolution,
  };
  if (options.aspectRatio !== "source") {
    body.aspect_ratio = options.aspectRatio;
  }
  return body;
}

async function pollUntilDone(input: {
  baseUrl: string;
  token: string;
  requestId: string;
  intervalSeconds: number;
  timeoutSeconds: number;
  onStatus?: (status: string) => void;
}): Promise<string> {
  const deadline = Date.now() + input.timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    await wait(input.intervalSeconds * 1000);
    const response = await fetchWithRetry(
      `${input.baseUrl}/videos/${input.requestId}`,
      {
        headers: { Authorization: `Bearer ${input.token}` },
      },
      "poll",
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Grok poll failed: ${response.status} ${response.statusText} - ${body.slice(0, 500)}`,
      );
    }
    const json = (await response.json()) as XaiPollResponse;
    const status = json.status ?? "unknown";
    input.onStatus?.(`status:${status}`);
    if (status === "done") {
      const url = json.video?.url ?? json.output?.url ?? json.url;
      if (!url)
        throw new Error(
          `Grok poll returned done without video URL: ${JSON.stringify(json).slice(0, 300)}`,
        );
      return url;
    }
    if (status === "failed" || status === "expired") {
      throw new Error(`Grok video status=${status}: ${JSON.stringify(json).slice(0, 500)}`);
    }
  }
  throw new Error(
    `Grok video timed out after ${input.timeoutSeconds}s for request ${input.requestId}`,
  );
}

async function downloadVideo(
  url: string,
  workspaceDir: string,
  jobId: string,
  requestId: string,
): Promise<string> {
  const response = await fetchWithRetry(url, {}, "download");
  if (!response.ok)
    throw new Error(`Grok download failed: ${response.status} ${response.statusText}`);
  const outputDir = path.join(workspaceDir, "videos");
  fs.mkdirSync(outputDir, { recursive: true });
  const filePath = path.join(
    outputDir,
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${jobId}-${requestId.slice(0, 8)}.mp4`,
  );
  fs.writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
  return filePath;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  purpose: "submit" | "poll" | "download",
): Promise<Response> {
  const delays = [0, 1500, 4000] as const;
  let lastError: unknown;
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    const delay = delays[attempt] ?? 0;
    if (delay > 0) await wait(delay);
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      console.warn(
        `[grok-video-fetch] purpose=${purpose} attempt=${attempt + 1}/${delays.length} error=${formatError(error)}`,
      );
    }
  }
  throw new Error(`Grok ${purpose} network request failed: ${formatError(lastError)}`);
}

function encodeImageAsDataUrl(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
  return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message || error.name : String(error);
}
