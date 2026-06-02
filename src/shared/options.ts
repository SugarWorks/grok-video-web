import { z } from "zod";

export const RESOLUTIONS = ["480p", "720p"] as const;
export type ResolutionOption = (typeof RESOLUTIONS)[number];

export const ASPECT_RATIOS = [
  "source",
  "auto",
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
] as const;
export type AspectRatioOption = (typeof ASPECT_RATIOS)[number];

export const CAMERA_MODES = [
  "static",
  "user",
  "push_in",
  "pull_back",
  "orbit",
  "handheld",
] as const;
export type CameraMode = (typeof CAMERA_MODES)[number];

export const SOUND_MODES = ["ambient", "silent", "music", "dialogue"] as const;
export type SoundMode = (typeof SOUND_MODES)[number];

export const INTENSITIES = ["subtle", "balanced", "bold"] as const;
export type MotionIntensity = (typeof INTENSITIES)[number];

export const OUTPUT_STYLES = ["source", "cinematic", "social", "product", "anime"] as const;
export type OutputStyle = (typeof OUTPUT_STYLES)[number];

export type MotionCategory = "micro" | "portrait" | "showcase" | "cinematic" | "product";

export type VideoMotionPreset = {
  id: string;
  label: string;
  description: string;
  prompt: string;
  category: MotionCategory;
  durationSeconds?: number;
  camera?: CameraMode;
};

export const VIDEO_MOTION_PRESETS: readonly VideoMotionPreset[] = [
  {
    id: "breathe",
    label: "呼吸微动",
    description: "眨眼、呼吸、发丝轻动",
    prompt: "gentle breathing, slow natural blink, faint hair drift; pose and expression unchanged",
    category: "micro",
  },
  {
    id: "soft_smile",
    label: "浅笑",
    description: "表情轻微变暖，不改脸",
    prompt: "the corners of the mouth slowly lift into a gentle warm smile, eyes brighten slightly",
    category: "portrait",
  },
  {
    id: "breeze",
    label: "轻风",
    description: "头发和衣物轻微飘动",
    prompt: "a soft breeze lightly moves hair and clothing, with only subtle natural movement",
    category: "micro",
  },
  {
    id: "look_back",
    label: "回眸",
    description: "轻转头，镜头感更强",
    prompt:
      "subject slowly turns their head for a brief over-the-shoulder glance, then settles naturally",
    category: "portrait",
    durationSeconds: 6,
  },
  {
    id: "wave",
    label: "招手",
    description: "小幅友好互动",
    prompt: "a small natural nod and a light hand wave, friendly and calm",
    category: "portrait",
    durationSeconds: 6,
  },
  {
    id: "outfit_turn",
    label: "穿搭转身",
    description: "展示衣服轮廓和材质",
    prompt:
      "subject turns slowly from front view to a three-quarter side angle and back, elegant controlled outfit presentation",
    category: "showcase",
    durationSeconds: 8,
    camera: "static",
  },
  {
    id: "pose_switch",
    label: "换姿",
    description: "重心移动，姿态更自然",
    prompt: "subject shifts weight and settles into a relaxed confident pose, smooth and natural",
    category: "showcase",
    durationSeconds: 6,
  },
  {
    id: "cinematic_push",
    label: "电影推近",
    description: "缓慢推近，适合头像/海报",
    prompt: "slow cinematic push-in, subtle parallax, subject remains stable and composed",
    category: "cinematic",
    durationSeconds: 8,
    camera: "push_in",
  },
  {
    id: "dolly_orbit",
    label: "环绕镜头",
    description: "轻微绕拍，空间感更强",
    prompt:
      "a controlled short dolly orbit with subtle parallax, stable framing, no aggressive spin",
    category: "cinematic",
    durationSeconds: 8,
    camera: "orbit",
  },
  {
    id: "product_orbit",
    label: "产品环绕",
    description: "突出材质、反光和细节",
    prompt:
      "slow controlled product-style orbit, highlight materials and surface details, premium studio motion",
    category: "product",
    durationSeconds: 8,
    camera: "orbit",
  },
] as const;

export const generationOptionsSchema = z.object({
  prompt: z.string().trim().max(1800).default(""),
  presetId: z.string().trim().optional(),
  durationSeconds: z.number().int().min(1).max(15),
  resolution: z.enum(RESOLUTIONS),
  aspectRatio: z.enum(ASPECT_RATIOS),
  camera: z.enum(CAMERA_MODES),
  sound: z.enum(SOUND_MODES),
  intensity: z.enum(INTENSITIES),
  outputStyle: z.enum(OUTPUT_STYLES),
  preserveSource: z.boolean(),
  avoidTextMutation: z.boolean(),
  loopFriendly: z.boolean(),
  count: z.number().int().min(1).max(5),
});

export type GenerationOptions = z.infer<typeof generationOptionsSchema>;

export function defaultGenerationOptions(input: {
  durationSeconds: number;
  resolution: ResolutionOption;
  aspectRatio: AspectRatioOption;
}): GenerationOptions {
  return {
    prompt: "",
    durationSeconds: input.durationSeconds,
    resolution: input.resolution,
    aspectRatio: input.aspectRatio,
    camera: "static",
    sound: "ambient",
    intensity: "balanced",
    outputStyle: "source",
    preserveSource: true,
    avoidTextMutation: true,
    loopFriendly: false,
    count: 1,
  };
}

export function findVideoMotionPreset(id: string | undefined): VideoMotionPreset | undefined {
  if (!id) return undefined;
  return VIDEO_MOTION_PRESETS.find((preset) => preset.id === id);
}

export function normalizeGenerationOptions(
  input: unknown,
  fallback: GenerationOptions,
  maxVariations: number,
): GenerationOptions {
  const relaxedSchema = generationOptionsSchema.partial().extend({
    count: z.number().int().optional(),
  });
  const parsed = relaxedSchema.parse(input ?? {});
  const merged = {
    ...fallback,
    ...parsed,
    count: Math.min(Math.max(parsed.count ?? fallback.count, 1), maxVariations),
  };
  const preset = findVideoMotionPreset(merged.presetId);
  if (preset?.durationSeconds && !parsed.durationSeconds)
    merged.durationSeconds = preset.durationSeconds;
  if (preset?.camera && !parsed.camera) merged.camera = preset.camera;
  return generationOptionsSchema.parse(merged);
}

export function composePrompt(
  options: Pick<
    GenerationOptions,
    | "prompt"
    | "presetId"
    | "camera"
    | "sound"
    | "intensity"
    | "outputStyle"
    | "preserveSource"
    | "avoidTextMutation"
    | "loopFriendly"
  >,
): string {
  const preset = findVideoMotionPreset(options.presetId);
  const promptText = `${options.prompt} ${preset?.prompt ?? ""}`;
  const parts: string[] = [];
  if (options.prompt) parts.push(options.prompt);
  if (preset) parts.push(preset.prompt);
  if (options.preserveSource) {
    parts.push(
      "Preserve the source image identity, composition, subject position, outfit, proportions, and visual style.",
    );
    parts.push(
      "Keep motion natural and controlled; avoid deformation by keeping the subject stable and readable.",
    );
  }
  if (options.avoidTextMutation) {
    parts.push(
      "Do not invent or rewrite readable text, logos, watermarks, tattoos, UI text, or signage.",
    );
  }
  parts.push(styleDirective(options.outputStyle));
  parts.push(intensityDirective(options.intensity));
  parts.push(cameraDirective(options.camera, promptText));
  parts.push(soundDirective(options.sound));
  if (options.loopFriendly)
    parts.push("Make the first and last frames visually compatible for a clean loop.");
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 2200);
}

export function formatOptions(options: GenerationOptions): string {
  const preset = findVideoMotionPreset(options.presetId);
  return [
    `${options.durationSeconds}s`,
    options.resolution,
    options.aspectRatio,
    preset?.label ?? "自定义",
    options.camera,
    options.sound,
    options.intensity,
    options.outputStyle,
    `${options.count}x`,
  ].join(" · ");
}

function styleDirective(style: OutputStyle): string {
  if (style === "cinematic") return "Cinematic color, refined lighting, restrained filmic motion.";
  if (style === "social")
    return "Clean social-media-ready motion, crisp subject readability, no clutter.";
  if (style === "product")
    return "Premium product-shot finish with controlled highlights and readable materials.";
  if (style === "anime") return "Preserve the illustration/anime style and keep linework stable.";
  return "Preserve the source image's original style and lighting.";
}

function intensityDirective(intensity: MotionIntensity): string {
  if (intensity === "subtle") return "Use very subtle micro motion only.";
  if (intensity === "bold")
    return "Use a clear motion beat while keeping anatomy, identity, and composition stable.";
  return "Use balanced visible motion with stable identity.";
}

function cameraDirective(mode: CameraMode, prompt: string): string {
  if (mode === "user") return "";
  if (mode === "push_in") return "Use a slow cinematic push-in, no abrupt camera motion.";
  if (mode === "pull_back") return "Use a slow controlled pull-back with stable composition.";
  if (mode === "orbit")
    return "Use a short controlled orbit with subtle parallax, no spin-heavy movement.";
  if (mode === "handheld")
    return "Use gentle handheld camera feel with stable framing, no shake-heavy movement.";
  if (
    /\b(camera|cam|镜头|pan|tilt|zoom|push|pull|dolly|orbit|handheld|static)\b|推近|拉远|环绕|跟拍|平移|手持/i.test(
      prompt,
    )
  ) {
    return "";
  }
  return "Static camera, no zoom, no pan.";
}

function soundDirective(mode: SoundMode): string {
  if (mode === "silent") return "The subject stays silent: no speech, no dialogue, no lip sync.";
  if (mode === "music")
    return "Use quiet background music and ambient sound only; no dialogue or lip sync.";
  if (mode === "dialogue") return "If speech appears, keep it brief and natural.";
  return "Ambient sound only; no speech, no dialogue, no lip sync.";
}
