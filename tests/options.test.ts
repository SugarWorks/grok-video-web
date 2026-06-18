import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { buildXaiVideoRequest } from "../src/server/xai-video.js";
import { buildXaiImageEditRequest } from "../src/server/xai-image.js";
import type { AppConfig } from "../src/server/config.js";
import { PreparedImageStore } from "../src/server/prepared-images.js";
import {
  composeFramePrepPrompt,
  composePrompt,
  defaultFramePrepOptions,
  defaultGenerationOptions,
  normalizeGenerationOptions,
} from "../src/shared/options.js";

const defaults = defaultGenerationOptions({
  durationSeconds: 6,
  resolution: "720p",
  aspectRatio: "source",
});

describe("generation options", () => {
  it("normalizes rich controls and caps variations", () => {
    const parsed = normalizeGenerationOptions(
      {
        prompt: "slow smile",
        presetId: "outfit_turn",
        resolution: "480p",
        aspectRatio: "9:16",
        camera: "user",
        sound: "music",
        intensity: "bold",
        outputStyle: "cinematic",
        count: 9,
      },
      defaults,
      3,
    );
    expect(parsed.durationSeconds).toBe(8);
    expect(parsed.count).toBe(3);
    expect(parsed.aspectRatio).toBe("9:16");
    expect(parsed.camera).toBe("user");
  });

  it("supports 15 second videos", () => {
    const parsed = normalizeGenerationOptions({ durationSeconds: 15 }, defaults, 3);
    expect(parsed.durationSeconds).toBe(15);
  });
});

describe("prompt composition", () => {
  it("adds preservation and style directives", () => {
    const prompt = composePrompt({
      ...defaults,
      prompt: "subtle smile",
      presetId: "breathe",
      intensity: "subtle",
      outputStyle: "social",
      avoidTextMutation: true,
      loopFriendly: true,
    });
    expect(prompt).toContain("subtle smile");
    expect(prompt).toContain("Preserve the source image");
    expect(prompt).toContain("Do not invent or rewrite readable text");
    expect(prompt).toContain("clean loop");
  });

  it("can submit the user prompt without assisted suffixes", () => {
    const prompt = composePrompt({
      ...defaults,
      prompt: "自动化流水线",
      presetId: "breathe",
      promptMode: "raw",
      preserveSource: true,
      avoidTextMutation: true,
      loopFriendly: true,
      camera: "static",
      sound: "ambient",
      intensity: "balanced",
      outputStyle: "source",
    });
    expect(prompt).toBe("自动化流水线");
  });

  it("uses the selected preset prompt when custom prompt is empty", () => {
    const prompt = composePrompt({
      ...defaults,
      prompt: "",
      presetId: "breathe",
    });
    expect(prompt).toContain("gentle breathing");
  });
});

describe("xAI request body", () => {
  it("omits aspect_ratio for source aspect", () => {
    const imagePath = path.join(os.tmpdir(), "grok-video-web-test.png");
    fs.writeFileSync(imagePath, Buffer.from([137, 80, 78, 71]));
    const body = buildXaiVideoRequest(fakeConfig(), imagePath, defaults);
    expect(body.aspect_ratio).toBeUndefined();
    expect(body.model).toBe("grok-imagine-video-1.5");
    expect(body.image).toEqual({ url: expect.stringMatching(/^data:image\/png;base64,/) });
  });

  it("builds JSON image edit requests for first-frame preparation", () => {
    const imagePath = path.join(os.tmpdir(), "grok-video-web-edit-test.png");
    fs.writeFileSync(imagePath, Buffer.from([137, 80, 78, 71]));
    const options = {
      ...defaultFramePrepOptions(),
      instruction: "make the frame cleaner",
      resolution: "2k" as const,
    };
    const body = buildXaiImageEditRequest(fakeConfig(), imagePath, options);
    expect(body.model).toBe("grok-imagine-image-quality");
    expect(body.resolution).toBe("2k");
    expect(body.prompt).toContain("make the frame cleaner");
    expect(body.image).toEqual({
      type: "image_url",
      url: expect.stringMatching(/^data:image\/png;base64,/),
    });
  });
});

describe("first-frame preparation prompt", () => {
  it("keeps the edit focused on a single video-ready frame", () => {
    const prompt = composeFramePrepPrompt({
      ...defaultFramePrepOptions(),
      instruction: "fix unstable hands",
    });
    expect(prompt).toContain("first frame");
    expect(prompt).toContain("fix unstable hands");
    expect(prompt).toContain("Do not create a collage");
  });
});

describe("prepared image store", () => {
  it("persists prepared image records across store reloads", () => {
    const config = {
      ...fakeConfig(),
      workspaceDir: fs.mkdtempSync(path.join(os.tmpdir(), "grok-video-prep-")),
    };
    const record = {
      id: "prep_test",
      createdAt: new Date("2026-06-02T00:00:00.000Z").toISOString(),
      sourceImageUrl: "/api/files/images/source.png",
      sourceImagePath: path.join(config.workspaceDir, "source.png"),
      preparedImageUrl: "/api/files/images/prepared.png",
      preparedImagePath: path.join(config.workspaceDir, "prepared.png"),
      prompt: "prepare a clean first frame",
      options: defaultFramePrepOptions(),
      clientSourceId: "source_123",
    };

    new PreparedImageStore(config).add(record);

    expect(new PreparedImageStore(config).list()).toEqual([record]);
  });
});

function fakeConfig(): AppConfig {
  return {
    host: "127.0.0.1",
    port: 8787,
    accessToken: "token",
    xai: {
      authMode: "api_key",
      apiKey: "xai-key",
      oauthTokenFile: "/tmp/missing",
      baseUrl: "https://api.x.ai/v1",
      model: "grok-imagine-video-1.5",
      imageModel: "grok-imagine-image-quality",
    },
    workspaceDir: "/tmp",
    defaults: {
      durationSeconds: 6,
      resolution: "720p",
      aspectRatio: "source",
      pollIntervalSeconds: 8,
      pollTimeoutSeconds: 1200,
      maxVariations: 3,
    },
  };
}
