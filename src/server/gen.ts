import fs from "node:fs";
import path from "node:path";
import {
  defaultFramePrepOptions,
  defaultGenerationOptions,
  normalizeGenerationOptions,
} from "../shared/options.js";
import { loadConfig } from "./config.js";
import { generateGrokImageEdit } from "./xai-image.js";
import { generateGrokImageVideo } from "./xai-video.js";
import { resolveXaiAuth } from "./xai-auth.js";

type GenArgs = {
  image?: string;
  prompt?: string;
  out?: string;
  duration?: number;
  resolution?: string;
  aspect?: string;
  count?: number;
  prep: boolean;
};

export async function runGenCli(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  if (!args.image) {
    printHelp();
    throw new Error("--image <path> is required.");
  }
  if (!fs.existsSync(args.image)) throw new Error(`Image not found: ${args.image}`);

  const config = loadConfig();
  try {
    await resolveXaiAuth(config);
  } catch (error) {
    throw new Error(
      `xAI auth not ready (${error instanceof Error ? error.message : String(error)}). Run: grok-studio login`,
    );
  }

  let imagePath = path.resolve(args.image);
  if (args.prep) {
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

  const overrides: Record<string, unknown> = { prompt: args.prompt ?? "" };
  if (args.duration !== undefined) overrides.durationSeconds = args.duration;
  if (args.resolution) overrides.resolution = args.resolution;
  if (args.aspect) overrides.aspectRatio = args.aspect;
  if (args.count !== undefined) overrides.count = args.count;
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
    outputs.push(resolveOutput(result.localPath, args.out, take, options.count));
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

function parseArgs(values: string[]): GenArgs {
  const parsed: GenArgs = { prep: false };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    }
    if (value === "--prep") {
      parsed.prep = true;
      continue;
    }
    const next = values[index + 1];
    const requireNext = () => {
      if (!next || next.startsWith("--")) throw new Error(`${value} requires a value.`);
      index += 1;
      return next;
    };
    if (value === "--image") parsed.image = requireNext();
    else if (value === "--prompt") parsed.prompt = requireNext();
    else if (value === "--out") parsed.out = requireNext();
    else if (value === "--resolution") parsed.resolution = requireNext();
    else if (value === "--aspect") parsed.aspect = requireNext();
    else if (value === "--duration") parsed.duration = parsePositiveInt(requireNext(), value);
    else if (value === "--count") parsed.count = parsePositiveInt(requireNext(), value);
    else throw new Error(`Unknown argument: ${value}`);
  }
  return parsed;
}

function parsePositiveInt(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`${flag} requires a positive integer.`);
  return parsed;
}

function printHelp(): void {
  console.log(`Usage: grok-studio gen --image <path> [options]

Headlessly turn an image into a video (no UI).

Options:
  --image <path>        Source image (required).
  --prompt <text>       Motion prompt.
  --prep                Run a first-frame prep pass before the video.
  --duration <seconds>  Clip length. Default from config.
  --resolution <res>    e.g. 720p / 1080p.
  --aspect <ratio>      e.g. source / 9:16 / 16:9 / 1:1.
  --count <n>           Number of takes. Default 1.
  --out <path>          Write the result here (count>1 appends -N). Default: workspace path.

Example:
  grok-studio gen --image portrait.png --prompt "slow head turn" --duration 6 --out clip.mp4
`);
}
