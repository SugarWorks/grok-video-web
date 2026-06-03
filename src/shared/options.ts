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

export const FRAME_PREP_MODES = ["video", "portrait", "cinematic", "product"] as const;
export type FramePrepMode = (typeof FRAME_PREP_MODES)[number];

export const FRAME_PREP_STRENGTHS = ["light", "balanced", "strong"] as const;
export type FramePrepStrength = (typeof FRAME_PREP_STRENGTHS)[number];

export const FRAME_PREP_RESOLUTIONS = ["1k", "2k"] as const;
export type FramePrepResolution = (typeof FRAME_PREP_RESOLUTIONS)[number];

export type MotionCategory =
  | "micro"
  | "portrait"
  | "showcase"
  | "cinematic"
  | "product"
  | "sultry"
  | "hardcore";

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
  {
    id: "hair_flip",
    label: "撩发",
    description: "手指穿发，慢速甩头",
    prompt:
      "fingers slowly run through hair, a slow sensual hair flip, head tilting back gently with exposed neck",
    category: "sultry",
  },
  {
    id: "body_roll",
    label: "身体波浪",
    description: "从胸到胯慢速流体波浪",
    prompt:
      "a slow fluid body roll starting from chest traveling down through hips, controlled seductive wave motion, weight shifting naturally",
    category: "sultry",
    durationSeconds: 6,
  },
  {
    id: "lip_bite",
    label: "咬唇",
    description: "轻咬下唇，眼神拉丝",
    prompt:
      "slowly bite and release lower lip with a heavy-lidded gaze, subtle head tilt, intimate close-up framing, soft parted lips",
    category: "sultry",
  },
  {
    id: "hip_sway",
    label: "摆胯",
    description: "胯部左右慢摇",
    prompt:
      "slow hypnotic hip sway side to side, weight shifting rhythmically, subtle body movement, hands resting on hips or thighs",
    category: "sultry",
    durationSeconds: 6,
  },
  {
    id: "shoulder_slip",
    label: "滑落",
    description: "衣物从肩膀自然滑落",
    prompt:
      "clothing slowly slips off one shoulder revealing skin, subject holds the moment with a knowing expression, subtle controlled movement",
    category: "sultry",
    durationSeconds: 6,
    camera: "static",
  },
  {
    id: "back_arch",
    label: "弓背",
    description: "跪姿后仰，突出身体曲线",
    prompt:
      "kneeling posture, slow deep arch of the back, head tilting back, body curves emphasized, controlled sensual pose hold",
    category: "sultry",
    durationSeconds: 8,
    camera: "static",
  },
  {
    id: "breath_heavy",
    label: "微喘",
    description: "胸口起伏，呼吸渐进加重",
    prompt:
      "chest slowly rising and falling with gradually deepening breath, subtle body movement, intimate close framing, parted lips",
    category: "sultry",
  },
  {
    id: "cat_crawl",
    label: "猫步靠近",
    description: "四肢着地缓慢爬近",
    prompt:
      "slow controlled crawl toward camera on all fours, feline grace and poise, eye contact maintained, intimate forward motion with sinuous spine movement",
    category: "sultry",
    durationSeconds: 8,
    camera: "push_in",
  },
  {
    id: "languid_stretch",
    label: "慵懒舒展",
    description: "躺姿全身舒展",
    prompt:
      "reclining pose, slow languid full-body stretch, arms reaching above head, body elongating naturally, relaxed sensual mood, soft lighting",
    category: "sultry",
    durationSeconds: 8,
    camera: "static",
  },
  {
    id: "turn_reveal",
    label: "转身露背",
    description: "缓慢转身展示背部",
    prompt:
      "subject slowly turns to reveal bare back and shoulder blades, elegant controlled rotation, camera orbits gently, intimate reveal of skin texture",
    category: "sultry",
    durationSeconds: 8,
    camera: "orbit",
  },
  {
    id: "doggy_pound",
    label: "后入猛干",
    description: "跪姿后入，猛烈撞击",
    prompt:
      "intense doggy style from behind, rapid rhythmic thrusting, bodies slamming together, skin impact visible, raw aggressive motion, sweat and muscle tension, handheld shaky camera feel",
    category: "hardcore",
    durationSeconds: 8,
    camera: "handheld",
  },
  {
    id: "cowgirl_ride",
    label: "骑乘起伏",
    description: "女上位剧烈起伏",
    prompt:
      "energetic cowgirl position, subject on top riding vigorously, rapid up and down bouncing motion, chest and body undulating with each thrust, intense physical rhythm, skin glistening",
    category: "hardcore",
    durationSeconds: 8,
    camera: "static",
  },
  {
    id: "missionary_intense",
    label: "正面猛冲",
    description: "传教士体位高速抽插",
    prompt:
      "intense missionary position, aggressive deep thrusting, bodies pressed together, subject's body jolting with each impact, rapid rhythmic movement, intimate close framing, raw physical energy",
    category: "hardcore",
    durationSeconds: 8,
    camera: "push_in",
  },
  {
    id: "deepthroat",
    label: "深喉口交",
    description: "头部前后运动，深喉进出",
    prompt:
      "intense oral sex, deep throat penetration, head bobbing rhythmically forward and back, lips wrapped tight, saliva and intensity, close-up framing, raw and explicit motion",
    category: "hardcore",
    durationSeconds: 8,
    camera: "static",
  },
  {
    id: "hair_pull_back",
    label: "抓发后入",
    description: "从背后扯发控制，猛烈抽插",
    prompt:
      "hair gripped and pulled back firmly from behind, aggressive deep thrusting, subject's back arched, body jolting forward with each impact, rough dominating energy, handheld camera",
    category: "hardcore",
    durationSeconds: 8,
    camera: "handheld",
  },
  {
    id: "spitroast",
    label: "双人口交",
    description: "前后同时口交",
    prompt:
      "subject on all fours, oral sex from both front and back simultaneously, rhythmic back and forth motion between two partners, intense double stimulation, raw explicit action",
    category: "hardcore",
    durationSeconds: 8,
    camera: "orbit",
  },
  {
    id: "reverse_cowgirl",
    label: "反向骑乘",
    description: "背对镜头骑乘扭动",
    prompt:
      "reverse cowgirl position, subject riding on top facing away from camera, hips grinding and bouncing, back and shoulders visible, intense circular hip motion, raw physical rhythm",
    category: "hardcore",
    durationSeconds: 8,
    camera: "static",
  },
  {
    id: "standing_carry",
    label: "抱操",
    description: "被抱起凌空抽插",
    prompt:
      "subject lifted and carried, legs wrapped around partner, suspended mid-air thrusting, bodies pressed close, bouncing motion with gravity, raw intense physicality, dynamic motion",
    category: "hardcore",
    durationSeconds: 8,
    camera: "handheld",
  },
  {
    id: "prone_bone",
    label: "俯卧后入",
    description: "被压在身下后入猛干",
    prompt:
      "intense thrusting from behind, body pressed down, rhythmic full-body jolting with each deep impact, buttocks rippling, raw aggressive pounding, subject gripping whatever is at hand",
    category: "hardcore",
    durationSeconds: 8,
    camera: "static",
  },
  {
    id: "facial_finish",
    label: "颜射收尾",
    description: "口交后颜射",
    prompt:
      "kneeling oral sex buildup, then pull back for facial finish, subject looking up into camera, explicit release onto face, tongue out, raw and explicit finale",
    category: "hardcore",
    durationSeconds: 10,
    camera: "push_in",
  },
  {
    id: "bondage_suspend",
    label: "束缚挣扎",
    description: "被绳索束缚，身体扭动挣扎",
    prompt:
      "subject bound and restrained, wrists pulled together or behind back, struggling and squirming against restraints, body twisting in resistance, skin straining, vulnerable struggling motion, raw intense energy",
    category: "hardcore",
    durationSeconds: 8,
    camera: "handheld",
  },
  {
    id: "anal_pound",
    label: "肛交猛干",
    description: "后入肛交高速冲刺",
    prompt:
      "intense anal sex from behind, rapid deep thrusting, subject gripping surface, body jolting with each impact, sweat on skin, raw aggressive pounding, explicit penetration visible",
    category: "hardcore",
    durationSeconds: 8,
    camera: "handheld",
  },
  {
    id: "threesome_dp",
    label: "三人双插",
    description: "前后同时进入，双重冲击",
    prompt:
      "threesome double penetration, subject between two partners, simultaneous thrusting from both ends, body sandwiched and jolting, overwhelming physical intensity, raw group action",
    category: "hardcore",
    durationSeconds: 10,
    camera: "handheld",
  },
  {
    id: "masturbate_solo",
    label: "自慰揉穴",
    description: "手指自慰，逐渐加速至高潮",
    prompt:
      "fingers rubbing and penetrating self, rhythm building from slow teasing to intense, hips bucking, back arching, legs spreading wider, explicit solo pleasure, intimate close-up framing",
    category: "hardcore",
    durationSeconds: 10,
    camera: "push_in",
  },
  {
    id: "titjob",
    label: "乳交夹射",
    description: "双乳夹紧上下摩擦",
    prompt:
      "breasts pressed together around partner, rhythmic up and down sliding motion, cleavage tight and wet, subject looking up at camera, explicit titfuck action, skin contact and friction visible",
    category: "hardcore",
    durationSeconds: 8,
    camera: "static",
  },
  {
    id: "lesbian_scissor",
    label: "女同磨穴",
    description: "双腿交叉互磨，两人互动",
    prompt:
      "two subjects in scissoring position, legs interlocked, hips grinding together in slow rhythmic motion, mutual pleasure visible, bodies pressed close, intimate lesbian action, soft sensual lighting",
    category: "hardcore",
    durationSeconds: 8,
    camera: "orbit",
  },
  {
    id: "choke_slap",
    label: "掐脖扇脸",
    description: "被掐脖压制，粗暴扇耳光",
    prompt:
      "hand gripping subject's throat firmly, face slapped repeatedly, head turning sharply with each impact, dazed unfocused expression, raw physical domination, chaotic handheld motion",
    category: "hardcore",
    durationSeconds: 6,
    camera: "handheld",
  },
  {
    id: "spanking_bent",
    label: "打屁股",
    description: "连续掌掴抽打臀部",
    prompt:
      "subject's buttocks being spanked repeatedly with open hand, skin reddening and rippling with each slap, subject flinching and reacting with each impact, rhythmic raw discipline, stinging intensity building",
    category: "hardcore",
    durationSeconds: 8,
    camera: "static",
  },
  {
    id: "squirt_climax",
    label: "潮吹喷射",
    description: "高潮喷射液体",
    prompt:
      "subject reaching intense climax, body convulsing, back arching sharply, explicit fluid release, legs trembling, muscles spasming, raw uncontrolled orgasm, close-up explicit framing",
    category: "hardcore",
    durationSeconds: 8,
    camera: "push_in",
  },
  {
    id: "creampie_finish",
    label: "内射流出",
    description: "激烈抽插后内射，液体流出",
    prompt:
      "intense thrusting buildup, then deep finish inside, subject's body trembling, partner pulling out slowly, explicit fluid dripping out, satisfied exhausted pose, raw intimate finale",
    category: "hardcore",
    durationSeconds: 10,
    camera: "static",
  },
  {
    id: "shower_wall",
    label: "按墙后入",
    description: "被从背后按在墙上猛干",
    prompt:
      "subject pressed against a wall from behind, hands flat against the surface, intense rhythmic thrusting, body jolting forward with each impact, raw aggressive energy, tight close framing, handheld intensity",
    category: "hardcore",
    durationSeconds: 8,
    camera: "handheld",
  },
  {
    id: "footjob",
    label: "足交摩擦",
    description: "用脚摩擦挑逗",
    prompt:
      "subject using feet to stroke and rub partner, toes wrapped around, slow teasing foot motion, subject reclining with playful expression, explicit footjob action, intimate framing",
    category: "hardcore",
    durationSeconds: 8,
    camera: "static",
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

export const framePrepOptionsSchema = z.object({
  instruction: z.string().trim().max(1200).default(""),
  mode: z.enum(FRAME_PREP_MODES).default("video"),
  strength: z.enum(FRAME_PREP_STRENGTHS).default("balanced"),
  resolution: z.enum(FRAME_PREP_RESOLUTIONS).default("1k"),
  preserveIdentity: z.boolean().default(true),
  stabilizeEdges: z.boolean().default(true),
  removeText: z.boolean().default(true),
  improveLighting: z.boolean().default(true),
});

export type FramePrepOptions = z.infer<typeof framePrepOptionsSchema>;

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

export function defaultFramePrepOptions(): FramePrepOptions {
  return {
    instruction: "",
    mode: "video",
    strength: "balanced",
    resolution: "1k",
    preserveIdentity: true,
    stabilizeEdges: true,
    removeText: true,
    improveLighting: true,
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

export function normalizeFramePrepOptions(input: unknown): FramePrepOptions {
  return framePrepOptionsSchema.parse(input ?? {});
}

export function composeFramePrepPrompt(options: FramePrepOptions): string {
  const parts = [
    "Edit this image into a clean, stable first frame for image-to-video generation.",
    framePrepModeDirective(options.mode),
    framePrepStrengthDirective(options.strength),
  ];
  if (options.preserveIdentity) {
    parts.push(
      "Preserve the original subject identity, face, body proportions, outfit, pose logic, composition, and overall style.",
    );
  }
  if (options.stabilizeEdges) {
    parts.push(
      "Stabilize hands, face, hair edges, clothing edges, background boundaries, and any cropped limbs so the frame can animate without warped transitions.",
    );
  }
  if (options.removeText) {
    parts.push(
      "Remove or neutralize unreadable text, UI fragments, watermarks, and visual glitches.",
    );
  }
  if (options.improveLighting) {
    parts.push(
      "Improve exposure, contrast, skin texture, and lighting consistency while keeping the source image recognizable.",
    );
  }
  if (options.instruction) parts.push(`User instruction: ${options.instruction}`);
  parts.push(
    "Do not create a collage, split view, contact sheet, caption, border, or design mockup. Return one production-ready still image.",
  );
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 1800);
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
  const promptText = options.prompt || preset?.prompt || "";
  const parts: string[] = [];
  if (promptText) parts.push(promptText);
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

function framePrepModeDirective(mode: FramePrepMode): string {
  if (mode === "portrait") {
    return "Optimize for a human portrait: natural anatomy, stable face, clean hairline, believable skin, and enough body context for motion.";
  }
  if (mode === "cinematic") {
    return "Optimize for a cinematic opening frame: coherent lighting, clean depth, stable subject silhouette, and no motion blur.";
  }
  if (mode === "product") {
    return "Optimize for a product-style first frame: crisp object boundaries, clean background, readable shape, and stable reflections.";
  }
  return "Optimize for a general video first frame: sharp subject, coherent background, clean edges, and no obvious generation artifacts.";
}

function framePrepStrengthDirective(strength: FramePrepStrength): string {
  if (strength === "light") {
    return "Use a light touch: keep the source nearly unchanged and only fix obvious artifacts.";
  }
  if (strength === "strong") {
    return "Use a strong corrective pass: repair artifacts, improve framing, and clean unstable details while preserving the subject.";
  }
  return "Use a balanced corrective pass: improve stability and quality without making the result feel like a different image.";
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
