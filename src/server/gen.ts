import fs from "node:fs";
import path from "node:path";
import {
  defaultFramePrepOptions,
  defaultGenerationOptions,
  normalizeGenerationOptions,
} from "../shared/options.js";
import { loadConfig } from "./config.js";
import { generateGrokImageEdit } from "./xai-image.js";
import { resolveXaiAuth } from "./xai-auth.js";
import { generateGrokImageVideo } from "./xai-video.js";

export type GenOptions = {
  image: string;
  prompt?: string;
  out?: string;
  duration?: number;
  resolution?: string;
  aspect?: string;
  count?: number;
  prep?: boolean;
};

export async function runGenCli(opts: GenOptions): Promise<void> {
  if (!fs.existsSync(opts.image)) throw new Error(`Image not found: ${opts.image}`);

  const config = loadConfig();
  try {
    await resolveXaiAuth(config);
  } catch (error) {
    throw new Error(
      `xAI auth not ready (${error instanceof Error ? error.message : String(error)}). Run: grok-studio login`,
    );
  }

  let imagePath = path.resolve(opts.image);
  if (opts.prep) {
    process.stderr.write("preparing first frame…\n");
    const prepared = await generateGrokImageEdit({
      config,
      imagePath,
      options: defaultFramePrepOptions(),
      id: `gen_prep_${Date.now()}`,
    });
    imagePath = prepared.localPath;
    process.stderr.write(`prepared frame: ${imagePath}\n`);
  }

  const overrides: Record<string, unknown> = { prompt: opts.prompt ?? "" };
  if (opts.duration !== undefined) overrides.durationSeconds = opts.duration;
  if (opts.resolution) overrides.resolution = opts.resolution;
  if (opts.aspect) overrides.aspectRatio = opts.aspect;
  if (opts.count !== undefined) overrides.count = opts.count;
  const options = normalizeGenerationOptions(
    overrides,
    defaultGenerationOptions(config.defaults),
    config.defaults.maxVariations,
  );

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputs: string[] = [];
  for (let index = 0; index < options.count; index += 1) {
    const take = index + 1;
    process.stderr.write(`generating take ${take}/${options.count}…\n`);
    const result = await generateGrokImageVideo({
      config,
      imagePath,
      options,
      jobId: `gen_${stamp}_${take}`,
      onStatus: (status) => process.stderr.write(`  take ${take}: ${status}\n`),
    });
    outputs.push(resolveOutput(result.localPath, opts.out, take, options.count));
  }

  for (const file of outputs) console.log(file);
}

function resolveOutput(
  localPath: string,
  out: string | undefined,
  take: number,
  count: number,
): string {
  if (!out) return localPath;
  const target =
    count > 1
      ? path.join(
          path.dirname(out),
          `${path.basename(out, path.extname(out))}-${take}${path.extname(out)}`,
        )
      : out;
  fs.copyFileSync(localPath, path.resolve(target));
  return path.resolve(target);
}
