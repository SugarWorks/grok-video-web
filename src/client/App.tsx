import {
  Copy,
  Download,
  Film,
  ImagePlus,
  KeyRound,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { JobRecord, PublicConfig } from "../shared/api";
import {
  ASPECT_RATIOS,
  CAMERA_MODES,
  composePrompt,
  defaultGenerationOptions,
  INTENSITIES,
  OUTPUT_STYLES,
  RESOLUTIONS,
  SOUND_MODES,
  VIDEO_MOTION_PRESETS,
  type GenerationOptions,
} from "../shared/options";

type Toast = { tone: "ok" | "warn"; text: string } | null;

const TOKEN_STORAGE_KEY = "grok-video-web-token";

export default function App() {
  const [token, setToken] = useState(
    () =>
      new URLSearchParams(location.search).get("token") ||
      localStorage.getItem(TOKEN_STORAGE_KEY) ||
      "",
  );
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [tokenDraft, setTokenDraft] = useState(token);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [prompt, setPrompt] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const defaults = config
    ? defaultGenerationOptions(config.defaults)
    : defaultGenerationOptions({ durationSeconds: 6, resolution: "720p", aspectRatio: "source" });
  const [options, setOptions] = useState<GenerationOptions>(defaults);
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0];
  const submittedPrompt = useMemo(() => composePrompt({ ...options, prompt }), [options, prompt]);
  const selectedJobPrompt =
    selectedJob?.submittedPrompt ?? (selectedJob ? composePrompt(selectedJob.options) : "");

  const authHeader = useMemo(() => {
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  }, [token]);

  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    void loadConfig();
  }, [token]);

  useEffect(() => {
    const active = jobs.some((job) => job.status === "queued" || job.status === "running");
    if (!active) return;
    const timer = window.setInterval(() => void loadJobs(), 2500);
    return () => window.clearInterval(timer);
  }, [jobs, token]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const image = clipboardImageFile(event.clipboardData);
      if (!image) return;
      event.preventDefault();
      chooseFile(image);
      setToast({ tone: "ok", text: "已从剪贴板粘贴图片。" });
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [imagePreview]);

  async function loadConfig() {
    try {
      const response = await fetch(withToken("/api/config"), { headers: authHeader });
      if (response.status === 401) {
        setConfig(null);
        return;
      }
      if (!response.ok) throw new Error(await response.text());
      const payload = (await response.json()) as PublicConfig;
      setConfig(payload);
      setOptions((current) => ({ ...defaultGenerationOptions(payload.defaults), ...current }));
      await loadJobs();
    } catch (error) {
      setToast({ tone: "warn", text: error instanceof Error ? error.message : String(error) });
    }
  }

  async function loadJobs() {
    const response = await fetch(withToken("/api/jobs"), { headers: authHeader });
    if (!response.ok) return;
    const payload = (await response.json()) as { jobs: JobRecord[] };
    setJobs(payload.jobs);
    if (!selectedJobId && payload.jobs[0]) setSelectedJobId(payload.jobs[0].id);
  }

  function withToken(path: string) {
    if (!token) return path;
    const url = new URL(path, location.origin);
    url.searchParams.set("token", token);
    return `${url.pathname}${url.search}`;
  }

  function chooseFile(file: File | null) {
    setImageFile(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(file ? URL.createObjectURL(file) : "");
  }

  async function submit() {
    if (!imageFile) {
      setToast({ tone: "warn", text: "先选一张图。" });
      return;
    }
    setSubmitting(true);
    setToast(null);
    try {
      const form = new FormData();
      form.set("image", imageFile);
      form.set("options", JSON.stringify({ ...options, prompt }));
      const response = await fetch(withToken("/api/jobs"), {
        method: "POST",
        headers: authHeader,
        body: form,
      });
      if (!response.ok) throw new Error(await response.text());
      const payload = (await response.json()) as { job: JobRecord };
      setJobs((current) => [payload.job, ...current]);
      setSelectedJobId(payload.job.id);
      setToast({ tone: "ok", text: "任务已开始。" });
    } catch (error) {
      setToast({ tone: "warn", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSubmitting(false);
    }
  }

  function patchOptions(patch: Partial<GenerationOptions>) {
    setOptions((current) => ({ ...current, ...patch }));
  }

  async function copyPrompt(text: string) {
    await navigator.clipboard.writeText(text);
    setToast({ tone: "ok", text: "Prompt 已复制。" });
  }

  async function reuseHistoryJob(job: JobRecord) {
    setSelectedJobId(job.id);
    setToast(null);
    try {
      const response = await fetch(withToken(job.sourceImageUrl), { headers: authHeader });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const file = new File([blob], `history-${job.id}${extensionForMime(blob.type)}`, {
        type: blob.type || "image/png",
      });
      chooseFile(file);
      setOptions(job.options);
      setPrompt(job.options.prompt);
      setToast({ tone: "ok", text: "已把历史图片和参数载入输入区。" });
    } catch (error) {
      setToast({ tone: "warn", text: error instanceof Error ? error.message : String(error) });
    }
  }

  if (!config) {
    return (
      <main className="gate">
        <section className="gate-panel">
          <div className="mark">
            <KeyRound size={24} />
          </div>
          <h1>Grok Video Studio</h1>
          <p>本机 self-host 工作台。输入 `.env` 里的访问口令后继续。</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setToken(tokenDraft.trim());
            }}
          >
            <input
              autoFocus
              type="password"
              value={tokenDraft}
              onChange={(event) => setTokenDraft(event.target.value)}
              placeholder="ACCESS_TOKEN"
            />
            <button type="submit">解锁</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">
            <ShieldCheck size={15} /> selfhost · LAN tool
          </div>
          <h1>Grok Video Studio</h1>
        </div>
        <button className="ghost" type="button" onClick={() => void loadJobs()} title="刷新历史">
          <RefreshCw size={18} />
          刷新
        </button>
      </header>

      <div className="app-layout">
        <aside className="history-sidebar" aria-label="任务历史">
          <div className="history-head">
            <span>历史</span>
            <small>{jobs.length} 个任务</small>
          </div>
          <div className="history-list">
            {jobs.length > 0 ? (
              jobs.map((job, index) => (
                <button
                  type="button"
                  key={job.id}
                  className={job.id === selectedJob?.id ? "active" : ""}
                  onClick={() => void reuseHistoryJob(job)}
                >
                  <img src={withToken(job.sourceImageUrl)} alt="" />
                  <span className={`history-status ${job.status}`}>{shortStatusLabel(job)}</span>
                  <strong>任务 #{jobs.length - index}</strong>
                  <small>
                    {jobSummary(job)} · {formatDate(job.updatedAt)}
                  </small>
                  <em>点击复用</em>
                </button>
              ))
            ) : (
              <div className="empty-history">
                <Film size={24} />
                <p>还没有历史任务</p>
              </div>
            )}
          </div>
        </aside>

        <section className="workspace">
          <div className="source-pane">
            <PaneTitle step="1" title="输入图片" description="拖拽、点击选择，或直接粘贴截图。" />
            <div
              className={`dropzone ${imagePreview ? "has-image" : ""}`}
              onDrop={(event) => {
                event.preventDefault();
                chooseFile(event.dataTransfer.files[0] ?? null);
              }}
              onDragOver={(event) => event.preventDefault()}
              onClick={() => fileInput.current?.click()}
            >
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
              />
              {imagePreview ? (
                <img src={imagePreview} alt="source preview" />
              ) : (
                <div className="empty-upload">
                  <ImagePlus size={38} />
                  <span>拖入 / 粘贴图片 / 点击选择</span>
                </div>
              )}
            </div>
            <p className="input-hint">截图后可直接 Cmd+V；也支持 Finder / 浏览器复制图片后粘贴。</p>

            <label className="prompt-box">
              <span>
                画面动作
                <small>只写你希望发生的变化，保图约束会自动补全。</small>
              </span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="例：轻微回眸，衣服被风带起一点，保持脸和构图稳定"
              />
            </label>

            <div className="mini-title">保真开关</div>
            <div className="toggles">
              <Toggle
                label="保图"
                active={options.preserveSource}
                onClick={() => patchOptions({ preserveSource: !options.preserveSource })}
              />
              <Toggle
                label="不改字"
                active={options.avoidTextMutation}
                onClick={() => patchOptions({ avoidTextMutation: !options.avoidTextMutation })}
              />
              <Toggle
                label="可循环"
                active={options.loopFriendly}
                onClick={() => patchOptions({ loopFriendly: !options.loopFriendly })}
              />
            </div>
          </div>

          <div className="controls-pane">
            <PaneTitle
              step="2"
              title="调参数"
              description="先选动作预设，再微调时长、镜头和声音。"
            />
            <ControlSection title="动作预设">
              <div className="preset-grid">
                {VIDEO_MOTION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    className={`preset ${options.presetId === preset.id ? "selected" : ""}`}
                    type="button"
                    onClick={() =>
                      patchOptions({
                        presetId: options.presetId === preset.id ? undefined : preset.id,
                        camera: preset.camera ?? options.camera,
                        durationSeconds: preset.durationSeconds ?? options.durationSeconds,
                      })
                    }
                  >
                    <b>{preset.label}</b>
                    <span>{preset.description}</span>
                  </button>
                ))}
              </div>
            </ControlSection>

            <ControlSection title="生成参数">
              <Segment
                label="时长"
                values={[4, 5, 6, 8, 10, 12, 15]}
                value={options.durationSeconds}
                format={(value) => `${value}s`}
                onChange={(value) => patchOptions({ durationSeconds: value })}
              />
              <Segment
                label="清晰度"
                values={[...RESOLUTIONS]}
                value={options.resolution}
                onChange={(value) => patchOptions({ resolution: value })}
              />
              <Segment
                label="比例"
                values={[...ASPECT_RATIOS]}
                value={options.aspectRatio}
                onChange={(value) => patchOptions({ aspectRatio: value })}
              />
              <Segment
                label="张数"
                values={[1, 2, 3]}
                value={options.count}
                format={(value) => `${value}x`}
                onChange={(value) => patchOptions({ count: value })}
              />
            </ControlSection>

            <ControlSection title="导演控制">
              <Segment
                label="镜头"
                values={[...CAMERA_MODES]}
                value={options.camera}
                onChange={(value) => patchOptions({ camera: value })}
              />
              <Segment
                label="运动"
                values={[...INTENSITIES]}
                value={options.intensity}
                onChange={(value) => patchOptions({ intensity: value })}
              />
              <Segment
                label="风格"
                values={[...OUTPUT_STYLES]}
                value={options.outputStyle}
                onChange={(value) => patchOptions({ outputStyle: value })}
              />
              <Segment
                label="声音"
                values={[...SOUND_MODES]}
                value={options.sound}
                onChange={(value) => patchOptions({ sound: value })}
              />
            </ControlSection>

            <PromptDisclosure
              title="原始 Prompt"
              description="Grok 实际收到的完整文本，可展开核对。"
              value={submittedPrompt}
              onCopy={() => void copyPrompt(submittedPrompt)}
            />

            <button
              className="generate"
              type="button"
              disabled={submitting || !imageFile}
              onClick={() => void submit()}
            >
              {submitting ? <Loader2 className="spin" size={19} /> : <Play size={19} />}
              {submitting ? "生成中" : imageFile ? "生成视频" : "先添加图片"}
            </button>
            {!imageFile && <p className="generate-note">先添加一张源图，按钮会自动解锁。</p>}
            {toast && <div className={`toast ${toast.tone}`}>{toast.text}</div>}
          </div>

          <div className="result-pane">
            <PaneTitle
              step="3"
              title="结果"
              description={selectedJob ? jobSummary(selectedJob) : "生成后自动出现在这里。"}
            />
            {selectedJob ? (
              <>
                <div className="job-status-bar">
                  <span className={`job-pill ${selectedJob.status}`}>
                    {statusLabel(selectedJob)}
                  </span>
                  <span>
                    {selectedJob.results.length}/{selectedJob.options.count} 个结果
                  </span>
                  <span>{formatDate(selectedJob.updatedAt)}</span>
                </div>
                <div className="video-stack">
                  {selectedJob.results.length > 0 ? (
                    selectedJob.results.map((result) => (
                      <article className="video-card" key={result.requestId}>
                        <video src={withToken(result.url)} controls playsInline />
                        <a href={withToken(result.url)} download>
                          <Download size={16} />
                          下载 #{result.index}
                        </a>
                      </article>
                    ))
                  ) : (
                    <div className="pending">
                      <Film size={34} />
                      <p>{formatProgressItem(selectedJob.progress.at(-1) ?? selectedJob.status)}</p>
                    </div>
                  )}
                </div>
                <details className="progress-log">
                  <summary>任务日志</summary>
                  <ol>
                    {selectedJob.progress.slice(-8).map((item, index) => (
                      <li key={`${item}-${index}`}>{formatProgressItem(item)}</li>
                    ))}
                  </ol>
                </details>
                {selectedJobPrompt && (
                  <PromptDisclosure
                    title="任务 Prompt"
                    description="这次任务提交时的原始 prompt。"
                    value={selectedJobPrompt}
                    onCopy={() => void copyPrompt(selectedJobPrompt)}
                  />
                )}
              </>
            ) : (
              <div className="pending">
                <Film size={34} />
                <p>生成后会出现在这里</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function PaneTitle(props: { step: string; title: string; description: string }) {
  return (
    <header className="pane-title">
      <span>{props.step}</span>
      <div>
        <h2>{props.title}</h2>
        <p>{props.description}</p>
      </div>
    </header>
  );
}

function ControlSection(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="control-section">
      <h3>{props.title}</h3>
      {props.children}
    </section>
  );
}

function Toggle(props: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`toggle ${props.active ? "active" : ""}`}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  );
}

function PromptDisclosure(props: {
  title: string;
  description: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <details className="prompt-disclosure">
      <summary>
        <span>
          <b>{props.title}</b>
          <em>{props.description}</em>
        </span>
      </summary>
      <div className="prompt-preview">
        <div className="prompt-preview-head">
          <span>raw prompt</span>
          <button type="button" onClick={props.onCopy} title="复制 prompt">
            <Copy size={15} />
            复制
          </button>
        </div>
        <pre>{props.value || "Prompt 为空时只使用参数生成的保图/镜头/声音约束。"}</pre>
      </div>
    </details>
  );
}

function Segment<T extends string | number>(props: {
  label: string;
  values: readonly T[];
  value: T;
  format?: (value: T) => string;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segment-row">
      <span>{props.label}</span>
      <div className="segment">
        {props.values.map((value) => (
          <button
            type="button"
            key={String(value)}
            className={value === props.value ? "selected" : ""}
            onClick={() => props.onChange(value)}
          >
            {props.format ? props.format(value) : String(value)}
          </button>
        ))}
      </div>
    </div>
  );
}

function statusLabel(job: JobRecord) {
  if (job.status === "succeeded") return "完成";
  if (job.status === "failed") return `失败：${job.error ?? ""}`;
  if (job.status === "running") return "生成中";
  return "排队中";
}

function shortStatusLabel(job: JobRecord) {
  if (job.status === "succeeded") return "完成";
  if (job.status === "failed") return "失败";
  if (job.status === "running") return "生成中";
  return "排队";
}

function jobSummary(job: JobRecord) {
  return `${job.options.durationSeconds}s · ${job.options.resolution} · ${job.options.aspectRatio} · ${job.options.count} 个`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}

function formatProgressItem(item: string) {
  const statusMatch = item.match(/^(\d+)\/(\d+):status:(.+)$/);
  if (statusMatch) {
    const [, current, total, status] = statusMatch;
    const labels: Record<string, string> = {
      pending: "排队中",
      running: "生成中",
      processing: "处理中",
      done: "完成",
      failed: "失败",
    };
    return `第 ${current}/${total} 个视频：${labels[status] ?? status}`;
  }
  const downloadMatch = item.match(/^(\d+)\/(\d+):download$/);
  if (downloadMatch) return `第 ${downloadMatch[1]}/${downloadMatch[2]} 个视频：下载完成`;
  if (item === "done") return "任务完成";
  return item;
}

function extensionForMime(mimeType: string) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/png") return ".png";
  return ".png";
}

function clipboardImageFile(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const item of Array.from(data.items)) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  for (const file of Array.from(data.files)) {
    if (file.type.startsWith("image/")) return file;
  }
  return null;
}
