import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { Film, Play } from "lucide-react";
import { useEffect } from "react";
import type { ResultFlowNode } from "../types";
import { PreviewImage } from "./Primitives";

export function GraphFitter({ signature }: { signature: string }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    // Debounce so a multi-step graph load (reset -> populated) settles into a
    // single smooth camera glide instead of a double jump. Selecting a node in
    // the same graph leaves the signature unchanged, so the viewport never moves.
    const timer = setTimeout(() => {
      void fitView({ padding: 0.24, maxZoom: 1.1, minZoom: 0.3, duration: 220 });
    }, 130);
    return () => clearTimeout(timer);
  }, [signature, fitView]);
  return null;
}

export function ResultNodeView({ data }: NodeProps<ResultFlowNode>) {
  return (
    <div className={`result-node ${data.kind} ${data.active ? "active" : ""}`}>
      {data.hasInput && <Handle id="in" type="target" position={Position.Left} />}
      <div className="result-node-head">
        <span className="result-node-kind">{data.kind}</span>
        <strong>{data.title}</strong>
      </div>
      <div className="result-node-preview">
        {data.previewUrl ? (
          <PreviewImage
            src={data.previewUrl}
            label={`${data.title} preview`}
            onOpen={data.onOpenImage}
          />
        ) : (
          <Film size={22} />
        )}
        {data.kind === "video" && data.hasVideo && (
          <span className="result-node-play" aria-hidden="true">
            <Play size={16} />
          </span>
        )}
      </div>
      {data.lineageLabel && <div className="result-node-lineage">← {data.lineageLabel}</div>}
      <div className="result-node-foot">
        <small>{data.runMeta}</small>
        {data.status && (
          <span className={`result-node-status ${data.statusTone ?? ""}`}>{data.status}</span>
        )}
      </div>
      <Handle id="out" type="source" position={Position.Right} />
    </div>
  );
}
