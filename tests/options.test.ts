import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { buildXaiVideoRequest } from "../src/server/xai-video.js";
import type { AppConfig } from "../src/server/config.js";
import { resolveXaiAuth } from "../src/server/xai-auth.js";
import {
  composePrompt,
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
    expect(prompt).toContain("gentle breathing");
    expect(prompt).toContain("Preserve the source image");
    expect(prompt).toContain("Do not invent or rewrite readable text");
    expect(prompt).toContain("clean loop");
  });
});

describe("xAI request body", () => {
  it("omits aspect_ratio for source aspect", () => {
    const imagePath = path.join(os.tmpdir(), "grok-video-web-test.png");
    fs.writeFileSync(imagePath, Buffer.from([137, 80, 78, 71]));
    const body = buildXaiVideoRequest(fakeConfig(), imagePath, defaults);
    expect(body.aspect_ratio).toBeUndefined();
    expect(body.model).toBe("grok-imagine-video");
    expect(body.image).toEqual({ url: expect.stringMatching(/^data:image\/png;base64,/) });
  });
});

describe("hosted xAI OAuth config", () => {
  it("seeds token state from a base64 environment secret", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grok-video-oauth-"));
    const tokenFile = path.join(dir, "xai-oauth.json");
    const tokenState = {
      tokens: {
        access_token: fakeJwtWithExpiry(Date.now() + 60 * 60 * 1000),
        refresh_token: "refresh-token",
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      base_url: "https://api.x.ai/v1",
    };
    const auth = await resolveXaiAuth({
      ...fakeConfig(),
      xai: {
        authMode: "oauth",
        oauthTokenFile: tokenFile,
        oauthTokenStateB64: Buffer.from(JSON.stringify(tokenState), "utf8").toString("base64"),
        baseUrl: "https://api.x.ai/v1",
        model: "grok-imagine-video",
      },
    });
    expect(auth.label).toBe("xai-oauth");
    expect(fs.existsSync(tokenFile)).toBe(true);
    expect(JSON.parse(fs.readFileSync(tokenFile, "utf8")).tokens.refresh_token).toBe(
      "refresh-token",
    );
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
      model: "grok-imagine-video",
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

function fakeJwtWithExpiry(expiryMs: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(expiryMs / 1000) })).toString(
    "base64url",
  );
  return `header.${payload}.signature`;
}
