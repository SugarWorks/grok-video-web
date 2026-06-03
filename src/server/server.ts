import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import type {
  CreateJobResponse,
  JobInputFrame,
  PreparedImagesResponse,
  PrepareImageResponse,
  PublicConfig,
} from "../shared/api.js";
import {
  defaultGenerationOptions,
  normalizeFramePrepOptions,
  normalizeGenerationOptions,
} from "../shared/options.js";
import { loadConfig, type AppConfig } from "./config.js";
import { fileUrl, JobStore, workspacePath } from "./jobs.js";
import { PreparedImageStore } from "./prepared-images.js";
import { sendWorkspaceFile } from "./static-files.js";
import { generateGrokImageEdit } from "./xai-image.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export function createServer(config: AppConfig = loadConfig()) {
  prepareWorkspace(config);
  const app = express();
  const jobs = new JobStore(config);
  const preparedImages = new PreparedImageStore(config);
  const clientDir = path.resolve("dist/client");

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/api/config", requireAccess(config), (request, response) => {
    const payload: PublicConfig = {
      appName: "Grok Studio",
      authRequired: Boolean(config.accessToken) && !isLoopbackRequest(request),
      defaults: {
        durationSeconds: config.defaults.durationSeconds,
        resolution: config.defaults.resolution,
        aspectRatio: config.defaults.aspectRatio,
        maxVariations: config.defaults.maxVariations,
      },
    };
    response.json(payload);
  });

  app.get("/api/jobs", requireAccess(config), (_request, response) => {
    response.json({ jobs: jobs.list() });
  });

  app.get("/api/jobs/:id", requireAccess(config), (request, response) => {
    const job = jobs.get(String(request.params.id));
    if (!job) return response.status(404).json({ error: "not_found" });
    return response.json({ job });
  });

  app.get("/api/prepared-images", requireAccess(config), (_request, response) => {
    const payload: PreparedImagesResponse = { images: preparedImages.list() };
    response.json(payload);
  });

  app.post("/api/jobs", requireAccess(config), upload.single("image"), (request, response) => {
    const image = request.file;
    if (!image) return response.status(400).json({ error: "image_required" });
    if (!/^image\/(png|jpeg|webp)$/.test(image.mimetype)) {
      return response.status(400).json({ error: "unsupported_image_type" });
    }
    const defaults = defaultGenerationOptions(config.defaults);
    const rawOptions = JSON.parse(String(request.body.options ?? "{}")) as unknown;
    const options = normalizeGenerationOptions(rawOptions, defaults, config.defaults.maxVariations);
    const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(8).toString("hex")}${extensionForMime(image.mimetype)}`;
    const imagePath = workspacePath(config, "images", filename);
    fs.writeFileSync(imagePath, image.buffer);
    const job = jobs.create({
      imagePath,
      imageUrl: fileUrl(config.workspaceDir, "images", filename),
      options,
      inputFrame: parseJobInputFrame(request.body.inputFrame),
    });
    const payload: CreateJobResponse = { job };
    return response.status(202).json(payload);
  });

  app.post(
    "/api/prepared-images",
    requireAccess(config),
    upload.single("image"),
    async (request, response) => {
      const image = request.file;
      if (!image) return response.status(400).json({ error: "image_required" });
      if (!/^image\/(png|jpeg|webp)$/.test(image.mimetype)) {
        return response.status(400).json({ error: "unsupported_image_type" });
      }
      const rawOptions = JSON.parse(String(request.body.options ?? "{}")) as unknown;
      const options = normalizeFramePrepOptions(rawOptions);
      const id = `prep_${crypto.randomBytes(8).toString("hex")}`;
      const clientSourceId = cleanOptionalString(request.body.sourceId);
      const sourceFilename = `${new Date().toISOString().replace(/[:.]/g, "-")}-${id}-source${extensionForMime(image.mimetype)}`;
      const sourceImagePath = workspacePath(config, "images", sourceFilename);
      fs.writeFileSync(sourceImagePath, image.buffer);
      const result = await generateGrokImageEdit({
        config,
        imagePath: sourceImagePath,
        options,
        id,
      });
      const record = {
        id,
        createdAt: new Date().toISOString(),
        sourceImagePath,
        sourceImageUrl: fileUrl(config.workspaceDir, "images", sourceFilename),
        preparedImagePath: result.localPath,
        preparedImageUrl: fileUrl(config.workspaceDir, "images", path.basename(result.localPath)),
        prompt: result.prompt,
        options,
        clientSourceId,
      };
      preparedImages.add(record);
      const payload: PrepareImageResponse = {
        image: record,
      };
      return response.status(201).json(payload);
    },
  );

  app.get("/api/files/:kind/:filename", requireAccess(config), (request, response) => {
    const kind =
      request.params.kind === "videos"
        ? "videos"
        : request.params.kind === "images"
          ? "images"
          : undefined;
    if (!kind) return response.status(404).json({ error: "not_found" });
    const filePath = workspacePath(config, kind, String(request.params.filename));
    if (!fs.existsSync(filePath)) return response.status(404).json({ error: "not_found" });
    return sendWorkspaceFile(request, response, filePath);
  });

  if (fs.existsSync(clientDir)) {
    app.use(express.static(clientDir));
    app.get(/.*/, (_request, response) => response.sendFile(path.join(clientDir, "index.html")));
  } else {
    app.get("/", (_request, response) => {
      response.type("html").send("<p>Client bundle missing. Run <code>vpr build</code>.</p>");
    });
  }

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : String(error);
    response.status(500).json({ error: "server_error", message });
  });

  return { app, config };
}

function requireAccess(config: AppConfig) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!config.accessToken) return next();
    if (isLoopbackRequest(request)) return next();
    const bearer = request
      .header("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim();
    const queryToken = typeof request.query.token === "string" ? request.query.token : undefined;
    if (bearer === config.accessToken || queryToken === config.accessToken) return next();
    return response.status(401).json({ error: "unauthorized" });
  };
}

function isLoopbackRequest(request: Request): boolean {
  const remoteAddress = request.socket.remoteAddress ?? "";
  return (
    remoteAddress === "127.0.0.1" || remoteAddress === "::1" || remoteAddress === "::ffff:127.0.0.1"
  );
}

function prepareWorkspace(config: AppConfig): void {
  fs.mkdirSync(path.join(config.workspaceDir, "images"), { recursive: true });
  fs.mkdirSync(path.join(config.workspaceDir, "videos"), { recursive: true });
  fs.mkdirSync(path.join(config.workspaceDir, "jobs"), { recursive: true });
  fs.mkdirSync(path.join(config.workspaceDir, "prepared-images"), { recursive: true });
}

function extensionForMime(mime: string): string {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  return ".png";
}

function parseJobInputFrame(raw: unknown): JobInputFrame | undefined {
  if (!raw) return undefined;
  try {
    const value = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
    if (!value || typeof value !== "object") return undefined;
    const input = value as Partial<JobInputFrame>;
    if (input.source !== "source" && input.source !== "prep") return undefined;
    const label = cleanOptionalString(input.label) ?? (input.source === "prep" ? "Frame" : "image");
    return {
      source: input.source,
      label,
      preparedImageId: cleanOptionalString(input.preparedImageId),
      clientSourceId: cleanOptionalString(input.clientSourceId),
    };
  } catch {
    return undefined;
  }
}

function cleanOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { app, config } = createServer();
  app.listen(config.port, config.host, () => {
    console.log(`Grok Studio listening on http://${config.host}:${config.port}`);
  });
}
