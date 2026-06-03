import fs from "node:fs";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import type { FramePrepOptions } from "../shared/options.js";
import { composeFramePrepPrompt } from "../shared/options.js";
import type { AppConfig } from "./config.js";
import { randomId, resolveXaiAuth } from "./xai-auth.js";

export type ImageEditResult = {
  id: string;
  remoteUrl: string;
  localPath: string;
  prompt: string;
  elapsedMs: number;
};

export type GenerateImageEditInput = {
  config: AppConfig;
  imagePath: string;
  options: FramePrepOptions;
  id?: string;
};

type XaiImageResponse = {
  data?: Array<{
    url?: string;
    b64_json?: string;
    mime_type?: string;
    revised_prompt?: string;
  }>;
};

export async function generateGrokImageEdit(
  input: GenerateImageEditInput,
): Promise<ImageEditResult> {
  if (!fs.existsSync(input.imagePath))
    throw new Error(`source image does not exist: ${input.imagePath}`);
  const startedAt = Date.now();
  const id = input.id ?? randomId("image");
  const auth = await resolveXaiAuth(input.config);
  const prompt = composeFramePrepPrompt(input.options);
  const requestBody = buildXaiImageEditRequest(input.config, input.imagePath, input.options);

  const response = await fetchWithRetry(`${auth.baseUrl}/images/edits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Grok image edit failed: ${response.status} ${response.statusText} - ${body.slice(0, 500)}`,
    );
  }
  const json = (await response.json()) as XaiImageResponse;
  const image = json.data?.[0];
  if (!image)
    throw new Error(`Grok image edit returned no image: ${JSON.stringify(json).slice(0, 300)}`);

  const localPath = image.b64_json
    ? saveBase64Image(image.b64_json, image.mime_type, input.config.workspaceDir, id)
    : await downloadImage(requiredUrl(image.url), input.config.workspaceDir, id);

  return {
    id,
    localPath,
    remoteUrl: image.url ?? "",
    prompt,
    elapsedMs: Date.now() - startedAt,
  };
}

export function buildXaiImageEditRequest(
  config: AppConfig,
  imagePath: string,
  options: FramePrepOptions,
): Record<string, unknown> {
  return {
    model: config.xai.imageModel,
    prompt: composeFramePrepPrompt(options),
    image: {
      type: "image_url",
      url: encodeImageAsDataUrl(imagePath),
    },
    resolution: options.resolution,
  };
}

async function downloadImage(url: string, workspaceDir: string, id: string): Promise<string> {
  const response = await fetchWithRetry(url, {});
  if (!response.ok)
    throw new Error(`Grok image download failed: ${response.status} ${response.statusText}`);
  const mime = response.headers.get("content-type") ?? "image/jpeg";
  const filePath = preparedImagePath(workspaceDir, id, extensionForMime(mime));
  fs.writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
  return filePath;
}

function saveBase64Image(
  base64: string,
  mime: string | undefined,
  workspaceDir: string,
  id: string,
): string {
  const filePath = preparedImagePath(workspaceDir, id, extensionForMime(mime ?? "image/jpeg"));
  fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
  return filePath;
}

function preparedImagePath(workspaceDir: string, id: string, extension: string): string {
  const outputDir = path.join(workspaceDir, "images");
  fs.mkdirSync(outputDir, { recursive: true });
  return path.join(
    outputDir,
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${id}${extension}`,
  );
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
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
        `[grok-image-fetch] attempt=${attempt + 1}/${delays.length} error=${formatError(error)}`,
      );
    }
  }
  throw new Error(`Grok image network request failed: ${formatError(lastError)}`);
}

function encodeImageAsDataUrl(filePath: string): string {
  const mime = mimeForPath(filePath);
  return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
}

function mimeForPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function extensionForMime(mime: string): string {
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  return ".jpg";
}

function requiredUrl(url: string | undefined): string {
  if (!url) throw new Error("Grok image edit returned no image URL.");
  return url;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message || error.name : String(error);
}
