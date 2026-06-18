import {
  Download,
  Film,
  ImagePlus,
  Loader2,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Upload,
  Zap,
} from "lucide-react";
import { useMemo } from "react";
import type { JobRecord } from "../../shared/api";
import {
  ASPECT_RATIOS,
  CAMERA_MODES,
  composeFramePrepPrompt,
  composePrompt,
  FRAME_PREP_MODES,
  FRAME_PREP_RESOLUTIONS,
  FRAME_PREP_STRENGTHS,
  INTENSITIES,
  OUTPUT_STYLES,
  PROMPT_MODES,
  RESOLUTIONS,
  SOUND_MODES,
  VIDEO_MOTION_PRESETS,
  type FramePrepOptions,
  type GenerationOptions,
  type MotionCategory,
} from "../../shared/options";
import { formatDate, formatProgressItem, statusLabel, titleCase } from "../lib/format";
import { buildPrepPorts, resolveFrameInput } from "../lib/graph";
import { useStore } from "../store";
import {
  CATEGORY_FILTERS,
  OPERATOR_TABS,
  SOURCE_FRAME_ID,
  type FrameInput,
  type InspectorTab,
  type OperatorId,
  type PrepCandidate,
  type SourceAsset,
} from "../types";
import {
  ControlSection,
  InputFramePreview,
  OutputList,
  PaneTitle,
  PresetButton,
  PreviewImage,
  PromptDisclosure,
  RunList,
  Segment,
  Toggle,
} from "./Primitives";

type InspectorProps = {
  operatorId: OperatorId;
  tab: InspectorTab;
  sourceAsset: SourceAsset | null;
  prepCandidates: PrepCandidate[];
  framePrep: FramePrepOptions;
  options: GenerationOptions;
  prompt: string;
  categoryFilter: MotionCategory;
  pickedFrameId: string;
  selectedFrame: FrameInput | null;
  selectedJob: JobRecord | undefined;
  selectedJobPrompt: string;
  submittedPrompt: string;
  prepPrompt: string;
  preparingFrame: boolean;
  submitting: boolean;
  withToken: (path: string) => string;
  onChooseFile: (file: File | null) => void;
  onPatchFramePrep: (patch: Partial<FramePrepOptions>) => void;
  onPatchOptions: (patch: Partial<GenerationOptions>) => void;
  onPrepare: () => void;
  onSubmit: () => void;
  onCopyPrompt: (value: string) => void;
  onOpenImage: (url: string, label: string) => void;
  onPickFrame: (frameId: string) => void;
  onRerun: (job: JobRecord) => void;
  onPromptChange: (value: string) => void;
  onCategoryFilterChange: (value: MotionCategory) => void;
  onSelectOperator: (id: OperatorId) => void;
  onPickFile: () => void;
};

function renderBody(props: InspectorProps) {
  if (props.operatorId === "source") return renderSourceInspector(props);
  if (props.operatorId === "prep") return renderPrepInspector(props);
  return renderVideoInspector(props);
}

function renderSourceInspector(props: InspectorProps) {
  if (props.tab === "parameters") {
    return (
      <div className="inspector-stack">
        {props.sourceAsset ? (
          <div
            className="source-preview"
            onDrop={(event) => {
              event.preventDefault();
              props.onChooseFile(event.dataTransfer.files[0] ?? null);
            }}
            onDragOver={(event) => event.preventDefault()}
          >
            <PreviewImage
              src={props.sourceAsset.previewUrl}
              label="source image"
              onOpen={props.onOpenImage}
            />
            <button type="button" className="preview-action" onClick={props.onPickFile}>
              Change
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="dropzone"
            onDrop={(event) => {
              event.preventDefault();
              props.onChooseFile(event.dataTransfer.files[0] ?? null);
            }}
            onDragOver={(event) => event.preventDefault()}
            onClick={props.onPickFile}
            aria-label="Add source image"
          >
            <div className="empty-upload">
              <Upload size={34} />
              <span>Drop / Paste / Select</span>
            </div>
          </button>
        )}
        {props.sourceAsset && (
          <div className="source-actions">
            <button type="button" onClick={() => props.onSelectOperator("prep")}>
              Prepare frame →
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => props.onPickFrame(SOURCE_FRAME_ID)}
            >
              Animate source →
            </button>
          </div>
        )}
      </div>
    );
  }
  if (props.tab === "outputs") {
    return (
      <OutputList
        onOpenImage={props.onOpenImage}
        outputs={[
          {
            id: SOURCE_FRAME_ID,
            handleId: "image",
            label: "image",
            state: props.sourceAsset ? "ready" : "idle",
            imageUrl: props.sourceAsset?.previewUrl,
            meta: props.sourceAsset ? formatDate(props.sourceAsset.createdAt) : "empty",
          },
        ]}
      />
    );
  }
  return (
    <div className="empty-inspector">
      <ImagePlus size={26} />
      <p>Source has no run history.</p>
    </div>
  );
}

function renderPrepInspector(props: InspectorProps) {
  if (props.tab === "parameters") {
    return (
      <div className="inspector-stack">
        <ControlSection title="Prep prompt">
          <textarea
            className="frame-prep-textarea"
            value={props.framePrep.instruction}
            onChange={(event) => props.onPatchFramePrep({ instruction: event.target.value })}
            aria-label="Frame preparation instruction"
            placeholder="Clean hands, remove artifacts, stabilize edge crop..."
            rows={4}
          />
          <div className="frame-prep-controls">
            <Segment
              label="Mode"
              values={[...FRAME_PREP_MODES]}
              value={props.framePrep.mode}
              onChange={(value) => props.onPatchFramePrep({ mode: value })}
            />
            <Segment
              label="Strength"
              values={[...FRAME_PREP_STRENGTHS]}
              value={props.framePrep.strength}
              onChange={(value) => props.onPatchFramePrep({ strength: value })}
            />
            <Segment
              label="Sharp"
              values={[...FRAME_PREP_RESOLUTIONS]}
              value={props.framePrep.resolution}
              onChange={(value) => props.onPatchFramePrep({ resolution: value })}
            />
          </div>
          <div className="prep-toggles">
            <Toggle
              label="Identity"
              active={props.framePrep.preserveIdentity}
              onClick={() =>
                props.onPatchFramePrep({ preserveIdentity: !props.framePrep.preserveIdentity })
              }
            />
            <Toggle
              label="Stabilize"
              active={props.framePrep.stabilizeEdges}
              onClick={() =>
                props.onPatchFramePrep({ stabilizeEdges: !props.framePrep.stabilizeEdges })
              }
            />
            <Toggle
              label="Clean text"
              active={props.framePrep.removeText}
              onClick={() => props.onPatchFramePrep({ removeText: !props.framePrep.removeText })}
            />
            <Toggle
              label="Lighting"
              active={props.framePrep.improveLighting}
              onClick={() =>
                props.onPatchFramePrep({ improveLighting: !props.framePrep.improveLighting })
              }
            />
          </div>
          <button
            type="button"
            className="prep-button"
            disabled={props.preparingFrame || !props.sourceAsset}
            onClick={props.onPrepare}
          >
            {props.preparingFrame ? <Loader2 className="spin" size={16} /> : <Zap size={16} />}
            {props.preparingFrame ? "Generating" : "Generate candidate"}
          </button>
          <PromptDisclosure
            title="Prep raw prompt"
            description="Submitted image-edit prompt"
            value={props.prepPrompt}
            onCopy={() => props.onCopyPrompt(props.prepPrompt)}
          />
        </ControlSection>
      </div>
    );
  }
  if (props.tab === "outputs") {
    const outputs = buildPrepPorts(
      props.prepCandidates,
      props.pickedFrameId,
      props.preparingFrame,
      props.onPickFrame,
    );
    const selectedCandidate = props.prepCandidates.find((item) => item.id === props.pickedFrameId);
    return (
      <div className="inspector-stack">
        <OutputList outputs={outputs} onOpenImage={props.onOpenImage} />
        {selectedCandidate?.record && (
          <PromptDisclosure
            title={`${selectedCandidate.label} raw prompt`}
            description="xAI image edit request"
            value={selectedCandidate.record.prompt}
            onCopy={() => props.onCopyPrompt(selectedCandidate.record.prompt)}
          />
        )}
      </div>
    );
  }
  return (
    <RunList
      runs={props.prepCandidates.map((candidate) => ({
        id: candidate.id,
        title: candidate.label,
        detail: formatDate(candidate.createdAt),
        imageUrl: candidate.previewUrl,
      }))}
      onOpenImage={props.onOpenImage}
      empty="No prep runs"
    />
  );
}

function renderVideoParameters(props: InspectorProps) {
  return (
    <div className="inspector-stack">
      <InputFramePreview frame={props.selectedFrame} onOpenImage={props.onOpenImage} />
      <label className="prompt-box">
        <span>
          Motion prompt
          <small>Raw text is shown below.</small>
        </span>
        <textarea
          value={props.prompt}
          onChange={(event) => props.onPromptChange(event.target.value)}
          aria-label="Motion prompt"
          placeholder="slow head turn, subtle fabric movement, stable face..."
        />
      </label>
      <ControlSection title="Generation">
        <Segment
          label="Prompt"
          values={[...PROMPT_MODES]}
          value={props.options.promptMode}
          format={(value) => titleCase(value)}
          onChange={(value) =>
            props.onPatchOptions({
              promptMode: value,
              ...(value === "raw" ? { presetId: undefined } : {}),
            })
          }
        />
        <Segment
          label="Length"
          values={[4, 5, 6, 8, 10, 12, 15]}
          value={props.options.durationSeconds}
          format={(value) => `${value}s`}
          onChange={(value) => props.onPatchOptions({ durationSeconds: value })}
        />
        <Segment
          label="Res"
          values={[...RESOLUTIONS]}
          value={props.options.resolution}
          onChange={(value) => props.onPatchOptions({ resolution: value })}
        />
        <Segment
          label="Ratio"
          values={[...ASPECT_RATIOS]}
          value={props.options.aspectRatio}
          onChange={(value) => props.onPatchOptions({ aspectRatio: value })}
        />
        <Segment
          label="Takes"
          values={[1, 2, 3]}
          value={props.options.count}
          format={(value) => `${value}x`}
          onChange={(value) => props.onPatchOptions({ count: value })}
        />
        {props.options.promptMode === "assisted" && (
          <>
            <Segment
              label="Camera"
              values={[...CAMERA_MODES]}
              value={props.options.camera}
              onChange={(value) => props.onPatchOptions({ camera: value })}
            />
            <Segment
              label="Motion"
              values={[...INTENSITIES]}
              value={props.options.intensity}
              onChange={(value) => props.onPatchOptions({ intensity: value })}
            />
            <Segment
              label="Style"
              values={[...OUTPUT_STYLES]}
              value={props.options.outputStyle}
              onChange={(value) => props.onPatchOptions({ outputStyle: value })}
            />
            <Segment
              label="Sound"
              values={[...SOUND_MODES]}
              value={props.options.sound}
              onChange={(value) => props.onPatchOptions({ sound: value })}
            />
          </>
        )}
      </ControlSection>
      {props.options.promptMode === "assisted" && (
        <>
          <div className="mini-title">Guards</div>
          <div className="toggles">
            <Toggle
              label="Source"
              active={props.options.preserveSource}
              onClick={() =>
                props.onPatchOptions({ preserveSource: !props.options.preserveSource })
              }
            />
            <Toggle
              label="Text"
              active={props.options.avoidTextMutation}
              onClick={() =>
                props.onPatchOptions({ avoidTextMutation: !props.options.avoidTextMutation })
              }
            />
            <Toggle
              label="Loop"
              active={props.options.loopFriendly}
              onClick={() => props.onPatchOptions({ loopFriendly: !props.options.loopFriendly })}
            />
          </div>
          <ControlSection title="Motion presets">
            <div className="category-filter">
              {CATEGORY_FILTERS.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  className={props.categoryFilter === cat.key ? "active" : ""}
                  onClick={() => props.onCategoryFilterChange(cat.key)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="preset-grid">
              {VIDEO_MOTION_PRESETS.filter(
                (preset) => preset.category === props.categoryFilter,
              ).map((preset) => (
                <PresetButton
                  key={preset.id}
                  selected={props.options.presetId === preset.id}
                  label={preset.label}
                  description={preset.description}
                  onClick={() => {
                    const deselect = props.options.presetId === preset.id;
                    props.onPatchOptions({
                      presetId: deselect ? undefined : preset.id,
                      camera: preset.camera ?? props.options.camera,
                      durationSeconds: preset.durationSeconds ?? props.options.durationSeconds,
                    });
                    if (!deselect) props.onPromptChange(preset.prompt);
                  }}
                />
              ))}
            </div>
          </ControlSection>
        </>
      )}
      <PromptDisclosure
        title="Raw prompt"
        description="Submitted video prompt"
        value={props.submittedPrompt}
        onCopy={() => props.onCopyPrompt(props.submittedPrompt)}
      />
      <button
        className="generate"
        type="button"
        disabled={props.submitting || !props.selectedFrame}
        aria-disabled={props.submitting || !props.selectedFrame}
        onClick={props.onSubmit}
      >
        {props.submitting ? <Loader2 className="spin" size={19} /> : <Play size={19} />}
        <span>
          {props.submitting ? "Running" : props.selectedFrame ? "Run video" : "Add image"}
        </span>
      </button>
    </div>
  );
}

function renderVideoOutputs(props: InspectorProps) {
  const job = props.selectedJob;
  if (!job) {
    return (
      <div className="empty-inspector">
        <Film size={26} />
        <p>No video outputs</p>
      </div>
    );
  }
  return (
    <div className="inspector-stack">
      <div className="job-status-bar">
        <span className={`job-pill ${job.status}`}>{statusLabel(job)}</span>
        <span>
          {job.results.length}/{job.options.count} takes
        </span>
      </div>
      <div className="video-stack">
        {job.results.length > 0 ? (
          job.results.map((result) => (
            <article className="video-card" key={result.requestId}>
              <video
                src={props.withToken(result.url)}
                controls
                playsInline
                aria-label={`Generated video ${result.index}`}
              />
              <a href={props.withToken(result.url)} download>
                <Download size={16} />
                Download #{result.index}
              </a>
            </article>
          ))
        ) : job.status === "failed" ? (
          <div className="run-failed">
            <p className="run-failed-text">{job.error ?? "This run failed."}</p>
            <button type="button" className="rerun-button" onClick={() => props.onRerun(job)}>
              <RotateCcw size={16} />
              Rerun
            </button>
          </div>
        ) : (
          <div className="pending compact">
            <Film size={26} />
            <p>{formatProgressItem(job.progress.at(-1) ?? job.status)}</p>
          </div>
        )}
      </div>
      {props.selectedJobPrompt && (
        <PromptDisclosure
          title="Run raw prompt"
          description="Prompt used by this job"
          value={props.selectedJobPrompt}
          onCopy={() => props.onCopyPrompt(props.selectedJobPrompt)}
        />
      )}
    </div>
  );
}

function renderVideoInspector(props: InspectorProps) {
  if (props.tab === "parameters") return renderVideoParameters(props);
  if (props.tab === "outputs") return renderVideoOutputs(props);
  return (
    <RunList
      runs={
        props.selectedJob
          ? [
              {
                id: props.selectedJob.id,
                title: `Run ${props.selectedJob.id.slice(0, 8)}`,
                detail: `${statusLabel(props.selectedJob)} · ${formatDate(props.selectedJob.updatedAt)}`,
              },
            ]
          : []
      }
      empty="No video runs"
      onOpenImage={props.onOpenImage}
    />
  );
}

export function Inspector({ onPickFile }: { onPickFile: () => void }) {
  const selectedOperatorId = useStore((state) => state.selectedOperatorId);
  const inspectorTab = useStore((state) => state.inspectorTab);
  const sourceAsset = useStore((state) => state.sourceAsset);
  const prepCandidates = useStore((state) => state.prepCandidates);
  const framePrep = useStore((state) => state.framePrep);
  const options = useStore((state) => state.options);
  const prompt = useStore((state) => state.prompt);
  const categoryFilter = useStore((state) => state.categoryFilter);
  const pickedFrameId = useStore((state) => state.pickedFrameId);
  const jobs = useStore((state) => state.jobs);
  const selectedJobId = useStore((state) => state.selectedJobId);
  const preparingFrame = useStore((state) => state.preparingFrame);
  const submitting = useStore((state) => state.submitting);
  const withToken = useStore((state) => state.withToken);
  const chooseFile = useStore((state) => state.chooseFile);
  const patchFramePrep = useStore((state) => state.patchFramePrep);
  const patchOptions = useStore((state) => state.patchOptions);
  const prepareFirstFrame = useStore((state) => state.prepareFirstFrame);
  const submit = useStore((state) => state.submit);
  const copyPrompt = useStore((state) => state.copyPrompt);
  const reuseHistoryJob = useStore((state) => state.reuseHistoryJob);
  const openImage = useStore((state) => state.openImage);
  const pickFrame = useStore((state) => state.pickFrame);
  const setPrompt = useStore((state) => state.setPrompt);
  const setCategoryFilter = useStore((state) => state.setCategoryFilter);
  const setInspectorTab = useStore((state) => state.setInspectorTab);
  const setOperator = useStore((state) => state.setOperator);
  const setToast = useStore((state) => state.setToast);

  const selectedFrame = useMemo(
    () => resolveFrameInput(sourceAsset, prepCandidates, pickedFrameId),
    [sourceAsset, prepCandidates, pickedFrameId],
  );
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0];
  const submittedPrompt = useMemo(() => composePrompt({ ...options, prompt }), [options, prompt]);
  const prepPrompt = useMemo(() => composeFramePrepPrompt(framePrep), [framePrep]);
  const selectedJobPrompt =
    selectedJob?.submittedPrompt ?? (selectedJob ? composePrompt(selectedJob.options) : "");
  const inspectorTabs = selectedOperatorId === "source" ? (["parameters"] as const) : OPERATOR_TABS;

  const props: InspectorProps = {
    operatorId: selectedOperatorId,
    tab: inspectorTab,
    sourceAsset,
    prepCandidates,
    framePrep,
    options,
    prompt,
    categoryFilter,
    pickedFrameId,
    selectedFrame,
    selectedJob,
    selectedJobPrompt,
    submittedPrompt,
    prepPrompt,
    preparingFrame,
    submitting,
    withToken,
    onChooseFile: chooseFile,
    onPatchFramePrep: patchFramePrep,
    onPatchOptions: patchOptions,
    onPrepare: () => void prepareFirstFrame(),
    onSubmit: () => {
      if (!selectedFrame) {
        setToast({ tone: "warn", text: "Add an image first." });
        return;
      }
      void submit(selectedFrame.file, {
        source: selectedFrame.source,
        label: selectedFrame.label,
        preparedImageId: selectedFrame.preparedImageId,
        clientSourceId: selectedFrame.clientSourceId,
      });
    },
    onCopyPrompt: (value) => void copyPrompt(value),
    onOpenImage: openImage,
    onPickFrame: pickFrame,
    onRerun: (job) => void reuseHistoryJob(job),
    onPromptChange: setPrompt,
    onCategoryFilterChange: setCategoryFilter,
    onSelectOperator: setOperator,
    onPickFile,
  };

  return (
    <aside className="inspector-pane" aria-label="Node inspector">
      <PaneTitle
        icon={<SlidersHorizontal size={18} />}
        title={selectedOperatorId.toUpperCase()}
        description={
          selectedOperatorId === "source" ? "Upload image" : "Parameters / Outputs / Runs"
        }
      />
      {inspectorTabs.length > 1 && (
        <div className="inspector-tabs" role="tablist" aria-label="Inspector tabs">
          {inspectorTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={inspectorTab === tab ? "active" : ""}
              onClick={() => setInspectorTab(tab)}
            >
              {titleCase(tab)}
            </button>
          ))}
        </div>
      )}
      {renderBody(props)}
    </aside>
  );
}
