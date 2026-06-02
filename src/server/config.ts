import path from "node:path";
import process from "node:process";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import {
  ASPECT_RATIOS,
  RESOLUTIONS,
  type AspectRatioOption,
  type ResolutionOption,
} from "../shared/options.js";

loadDotenv({ quiet: true });

const envSchema = z.object({
  HOST: z.string().trim().min(1).optional().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).optional().default(8787),
  ACCESS_TOKEN: z.string().optional().default(""),
  XAI_AUTH_MODE: z.enum(["api_key", "oauth"]).optional().default("oauth"),
  XAI_API_KEY: z.string().optional().default(""),
  XAI_OAUTH_TOKEN: z.string().optional().default(""),
  XAI_OAUTH_TOKEN_FILE: z.string().optional().default("~/.grok-video-web/xai-oauth.json"),
  XAI_BASE_URL: z.string().url().optional().default("https://api.x.ai/v1"),
  XAI_VIDEO_MODEL: z.string().trim().min(1).optional().default("grok-imagine-video"),
  WORKSPACE_DIR: z.string().trim().min(1).optional().default("./workspace"),
  DEFAULT_DURATION_SECONDS: z.coerce.number().int().min(1).max(15).optional().default(6),
  DEFAULT_RESOLUTION: z.enum(RESOLUTIONS).optional().default("720p"),
  DEFAULT_ASPECT_RATIO: z.enum(ASPECT_RATIOS).optional().default("source"),
  POLL_INTERVAL_SECONDS: z.coerce.number().int().min(2).max(60).optional().default(8),
  POLL_TIMEOUT_SECONDS: z.coerce.number().int().min(60).max(3600).optional().default(1200),
  MAX_VARIATIONS: z.coerce.number().int().min(1).max(5).optional().default(3),
});

export type AppConfig = {
  host: string;
  port: number;
  accessToken?: string;
  xai: {
    authMode: "api_key" | "oauth";
    apiKey?: string;
    oauthToken?: string;
    oauthTokenFile: string;
    baseUrl: string;
    model: string;
  };
  workspaceDir: string;
  defaults: {
    durationSeconds: number;
    resolution: ResolutionOption;
    aspectRatio: AspectRatioOption;
    pollIntervalSeconds: number;
    pollTimeoutSeconds: number;
    maxVariations: number;
  };
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  return {
    host: parsed.HOST,
    port: parsed.PORT,
    accessToken: cleanSecret(parsed.ACCESS_TOKEN),
    xai: {
      authMode: parsed.XAI_AUTH_MODE,
      apiKey: cleanSecret(parsed.XAI_API_KEY),
      oauthToken: cleanSecret(parsed.XAI_OAUTH_TOKEN),
      oauthTokenFile: expandUserPath(parsed.XAI_OAUTH_TOKEN_FILE),
      baseUrl: parsed.XAI_BASE_URL.replace(/\/+$/, ""),
      model: parsed.XAI_VIDEO_MODEL,
    },
    workspaceDir: path.resolve(expandUserPath(parsed.WORKSPACE_DIR)),
    defaults: {
      durationSeconds: parsed.DEFAULT_DURATION_SECONDS,
      resolution: parsed.DEFAULT_RESOLUTION,
      aspectRatio: parsed.DEFAULT_ASPECT_RATIO,
      pollIntervalSeconds: parsed.POLL_INTERVAL_SECONDS,
      pollTimeoutSeconds: parsed.POLL_TIMEOUT_SECONDS,
      maxVariations: parsed.MAX_VARIATIONS,
    },
  };
}

export function expandUserPath(value: string): string {
  if (value === "~") return osHomeDir();
  if (value.startsWith("~/")) return path.join(osHomeDir(), value.slice(2));
  return value;
}

function cleanSecret(value: string | undefined): string | undefined {
  const trimmed = value
    ?.trim()
    .replace(/^[`'"“”‘’]+|[`'"“”‘’]+$/g, "")
    .trim();
  return trimmed || undefined;
}

function osHomeDir(): string {
  return process.env.HOME || process.cwd();
}
