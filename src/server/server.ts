import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import type { CreateJobResponse, PublicConfig } from "../shared/api.js";
import { defaultGenerationOptions, normalizeGenerationOptions } from "../shared/options.js";
import { loadConfig, type AppConfig } from "./config.js";
import { fileUrl, JobStore, workspacePath } from "./jobs.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export function createServer(config: AppConfig = loadConfig()) {
  prepareWorkspace(config);
  const app = express();
  const jobs = new JobStore(config);
  const clientDir = path.resolve("dist/client");

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/api/config", requireAccess(config), (request, response) => {
    const payload: PublicConfig = {
      appName: "Grok Video Studio",
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
    });
    const payload: CreateJobResponse = { job };
    return response.status(202).json(payload);
  });

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
      response.type("html").send("<p>Client bundle missing. Run <code>npm run build</code>.</p>");
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
}

function extensionForMime(mime: string): string {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  return ".png";
}

function sendWorkspaceFile(request: Request, response: Response, filePath: string): void {
  const stat = fs.statSync(filePath);
  const contentType = contentTypeFor(filePath);
  const range = request.headers.range;
  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2] ? Number(match[2]) : stat.size - 1;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end >= stat.size ||
      start > end
    ) {
      response.status(416).set("Content-Range", `bytes */${stat.size}`).end();
      return;
    }
    response.writeHead(206, {
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Content-Type": contentType,
    });
    fs.createReadStream(filePath, { start, end }).pipe(response);
    return;
  }
  response.writeHead(200, {
    "Accept-Ranges": "bytes",
    "Content-Length": String(stat.size),
    "Content-Type": contentType,
  });
  fs.createReadStream(filePath).pipe(response);
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".png") return "image/png";
  return "application/octet-stream";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { app, config } = createServer();
  app.listen(config.port, config.host, () => {
    console.log(`Grok Video Studio listening on http://${config.host}:${config.port}`);
  });
}
