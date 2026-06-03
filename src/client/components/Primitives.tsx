import { Check, Copy, Film, ImagePlus, Maximize2 } from "lucide-react";
import type { ReactNode } from "react";
import type { FrameInput, PortView } from "../types";

export function PreviewImage(props: {
  src: string;
  label: string;
  onOpen: (url: string, label: string) => void;
}) {
  return (
    <button
      type="button"
      className="preview-image"
      onClick={(event) => {
        event.stopPropagation();
        props.onOpen(props.src, props.label);
      }}
      aria-label={`Open ${props.label}`}
      title="Open image"
    >
      <img src={props.src} alt={props.label} />
      <span aria-hidden="true">
        <Maximize2 size={14} />
      </span>
    </button>
  );
}

export function OutputList(props: {
  outputs: PortView[];
  onOpenImage: (url: string, label: string) => void;
}) {
  return (
    <div className="output-list">
      {props.outputs.map((output) => (
        <article key={output.id} className={`output-row ${output.state}`}>
          {output.imageUrl ? (
            <PreviewImage src={output.imageUrl} label={output.label} onOpen={props.onOpenImage} />
          ) : (
            <i aria-hidden="true" />
          )}
          <span>
            <b>{output.label}</b>
            {output.meta && <small>{output.meta}</small>}
          </span>
          {output.onPick && (
            <button
              type="button"
              className="output-pick"
              onClick={output.onPick}
              aria-label={`Pick ${output.label}`}
            >
              <Check size={14} />
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

export function RunList(props: {
  runs: { id: string; title: string; detail: string; imageUrl?: string }[];
  empty: string;
  onOpenImage: (url: string, label: string) => void;
}) {
  if (props.runs.length === 0) {
    return (
      <div className="empty-inspector">
        <Film size={26} />
        <p>{props.empty}</p>
      </div>
    );
  }
  return (
    <div className="run-list">
      {props.runs.map((run) => (
        <article key={run.id}>
          {run.imageUrl ? (
            <PreviewImage src={run.imageUrl} label={run.title} onOpen={props.onOpenImage} />
          ) : (
            <Film size={18} />
          )}
          <span>
            <b>{run.title}</b>
            <small>{run.detail}</small>
          </span>
        </article>
      ))}
    </div>
  );
}

export function InputFramePreview(props: {
  frame: FrameInput | null;
  onOpenImage: (url: string, label: string) => void;
}) {
  return (
    <section className="input-frame">
      <div>
        <span>Input</span>
        <b>{props.frame?.portLabel ?? "empty"}</b>
      </div>
      {props.frame ? (
        <PreviewImage
          src={props.frame.previewUrl}
          label={props.frame.label}
          onOpen={props.onOpenImage}
        />
      ) : (
        <div className="input-frame-empty">
          <ImagePlus size={24} />
        </div>
      )}
    </section>
  );
}

export function PaneTitle(props: { icon: ReactNode; title: string; description: string }) {
  return (
    <header className="pane-title">
      <span>{props.icon}</span>
      <div>
        <h2>{props.title}</h2>
        <p>{props.description}</p>
      </div>
    </header>
  );
}

export function ControlSection(props: { title: string; children: ReactNode }) {
  return (
    <section className="control-section">
      <h3>{props.title}</h3>
      {props.children}
    </section>
  );
}

export function Toggle(props: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`toggle ${props.active ? "active" : ""}`}
      aria-pressed={props.active}
      aria-label={`${props.label}: ${props.active ? "on" : "off"}`}
      onClick={props.onClick}
    >
      <b>{props.label}</b>
    </button>
  );
}

export function PresetButton(props: {
  selected: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`preset ${props.selected ? "selected" : ""}`}
      type="button"
      aria-pressed={props.selected}
      onClick={props.onClick}
    >
      <span className="preset-top">
        <b>{props.label}</b>
      </span>
      <span>{props.description}</span>
    </button>
  );
}

export function PromptDisclosure(props: {
  title: string;
  description: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <details className="prompt-disclosure">
      <summary aria-label={props.title}>
        <span>
          <b>{props.title}</b>
          <em>{props.description}</em>
        </span>
      </summary>
      <div className="prompt-preview">
        <div className="prompt-preview-head">
          <span>raw prompt</span>
          <button type="button" onClick={props.onCopy} title="Copy prompt">
            <Copy size={15} />
            Copy
          </button>
        </div>
        <pre>{props.value || "No custom prompt. Parameter constraints only."}</pre>
      </div>
    </details>
  );
}

export function Segment<T extends string | number>(props: {
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
            aria-pressed={value === props.value}
            onClick={() => props.onChange(value)}
          >
            <span>{props.format ? props.format(value) : String(value)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
