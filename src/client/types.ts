import type { Node } from "@xyflow/react";
import type { JobRecord, PreparedImageRecord } from "../shared/api";
import type { MotionCategory } from "../shared/options";

export type Toast = { tone: "ok" | "warn"; text: string } | null;
export type ImageModal = { url: string; label: string } | null;
export type OperatorId = "source" | "prep" | "video";
export type InspectorTab = "parameters" | "outputs" | "runs";
export type OutputFilter = "all" | "frames" | "videos";
export type CandidateStatus = "empty" | "ready";

export type SourceAsset = {
  id: string;
  file: File;
  previewUrl: string;
  createdAt: string;
  sourceUrl?: string;
};

export type PrepCandidate = {
  id: string;
  slot: string;
  label: string;
  file: File;
  previewUrl: string;
  createdAt: string;
  record: PreparedImageRecord;
  status: CandidateStatus;
};

export type FrameInput = {
  id: string;
  file: File;
  previewUrl: string;
  label: string;
  portLabel: string;
  source: "source" | "prep";
  preparedImageId?: string;
  clientSourceId?: string;
};

export type PortState = "idle" | "active" | "ready" | "running" | "done" | "error";

export type PortView = {
  id: string;
  handleId: string;
  label: string;
  state: PortState;
  imageUrl?: string;
  meta?: string;
  onPick?: () => void;
};

export type ResultNodeData = {
  kind: OperatorId;
  title: string;
  runMeta: string;
  lineageLabel?: string;
  previewUrl?: string;
  hasVideo?: boolean;
  status?: string;
  statusTone?: PortState;
  active: boolean;
  hasInput: boolean;
  onOpenImage: (url: string, label: string) => void;
};

export type ResultFlowNode = Node<ResultNodeData, "result">;

export type OutputGalleryItem = {
  key: string;
  kind: "frame" | "video";
  thumbUrl?: string;
  time: string;
  record?: PreparedImageRecord;
  job?: JobRecord;
};

// A fully-fetched graph state, applied in a single batched render so loading a
// run/output never flashes through intermediate (empty / partial) states.
export type LoadSnapshot = {
  sourceFile: File;
  sourceRestore: { sourceId?: string; sourceUrl?: string; createdAt?: string };
  candidateRecords: PreparedImageRecord[];
  candidateFiles: File[];
  pickedFrameId: string;
  selectedNodeId: string;
  operatorId: OperatorId;
  inspectorTab: InspectorTab;
  options?: import("../shared/options").GenerationOptions;
  prompt?: string;
};

export const TOKEN_STORAGE_KEY = "grok-video-web-token";
export const SOURCE_FRAME_ID = "source";
export const OPERATOR_TABS: readonly InspectorTab[] = ["parameters", "outputs", "runs"];

export const CATEGORY_FILTERS: readonly { key: MotionCategory; label: string }[] = [
  { key: "micro", label: "Micro" },
  { key: "portrait", label: "Portrait" },
  { key: "showcase", label: "Showcase" },
  { key: "cinematic", label: "Cinema" },
  { key: "product", label: "Product" },
  { key: "sultry", label: "Sultry" },
  { key: "hardcore", label: "Hardcore" },
];
