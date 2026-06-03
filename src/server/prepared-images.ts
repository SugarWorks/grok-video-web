import fs from "node:fs";
import path from "node:path";
import type { PreparedImageRecord } from "../shared/api.js";
import type { AppConfig } from "./config.js";

export class PreparedImageStore {
  private readonly images = new Map<string, PreparedImageRecord>();
  private readonly imagesDir: string;

  constructor(config: AppConfig) {
    this.imagesDir = path.join(config.workspaceDir, "prepared-images");
    fs.mkdirSync(this.imagesDir, { recursive: true });
    this.loadExistingImages();
  }

  list(): PreparedImageRecord[] {
    return [...this.images.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 80);
  }

  add(record: PreparedImageRecord): void {
    this.images.set(record.id, record);
    this.persist(record);
  }

  private persist(record: PreparedImageRecord): void {
    fs.writeFileSync(
      path.join(this.imagesDir, `${record.id}.json`),
      `${JSON.stringify(record, null, 2)}\n`,
    );
  }

  private loadExistingImages(): void {
    if (!fs.existsSync(this.imagesDir)) return;
    for (const file of fs.readdirSync(this.imagesDir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const record = normalizePreparedImageRecord(
          JSON.parse(fs.readFileSync(path.join(this.imagesDir, file), "utf8")),
        );
        this.images.set(record.id, record);
      } catch {
        // Ignore corrupt metadata; generated image files remain on disk.
      }
    }
  }
}

function normalizePreparedImageRecord(value: unknown): PreparedImageRecord {
  const record = value as Partial<PreparedImageRecord>;
  if (
    typeof record.id !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.sourceImageUrl !== "string" ||
    typeof record.sourceImagePath !== "string" ||
    typeof record.preparedImageUrl !== "string" ||
    typeof record.preparedImagePath !== "string" ||
    typeof record.prompt !== "string" ||
    typeof record.options !== "object" ||
    !record.options
  ) {
    throw new Error("invalid prepared image record");
  }
  return record as PreparedImageRecord;
}
