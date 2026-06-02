import type { GenerationOptions } from "./options.js";
import type { AspectRatioOption, ResolutionOption } from "./options.js";

export type AppDefaults = {
  durationSeconds: number;
  resolution: ResolutionOption;
  aspectRatio: AspectRatioOption;
  maxVariations: number;
};

export type PublicConfig = {
  appName: string;
  defaults: AppDefaults;
  authRequired: boolean;
};

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type JobResult = {
  index: number;
  requestId: string;
  url: string;
  localPath: string;
  elapsedMs: number;
};

export type JobRecord = {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  sourceImageUrl: string;
  sourceImagePath: string;
  options: GenerationOptions;
  progress: string[];
  results: JobResult[];
  error?: string;
};

export type CreateJobResponse = {
  job: JobRecord;
};
