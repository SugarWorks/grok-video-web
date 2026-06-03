import type { Edge } from "@xyflow/react";
import type { JobRecord } from "../../shared/api";
import { candidateHandle, formatDate, shortStatusLabel } from "./format";
import {
  SOURCE_FRAME_ID,
  type FrameInput,
  type PortState,
  type PortView,
  type PrepCandidate,
  type ResultFlowNode,
  type SourceAsset,
} from "../types";

export function findPrepParent(job: JobRecord, candidates: PrepCandidate[]): PrepCandidate | null {
  if (job.inputFrame?.source !== "prep") return null;
  const preparedImageId = job.inputFrame.preparedImageId;
  if (!preparedImageId) return null;
  return candidates.find((candidate) => candidate.id === preparedImageId) ?? null;
}

export function jobTone(job: JobRecord): PortState {
  if (job.status === "succeeded") return "done";
  if (job.status === "failed") return "error";
  if (job.status === "running" || job.status === "queued") return "running";
  return "idle";
}

export function resolveFrameInput(
  source: SourceAsset | null,
  candidates: PrepCandidate[],
  pickedFrameId: string,
): FrameInput | null {
  const candidate = candidates.find((item) => item.id === pickedFrameId);
  if (candidate) {
    return {
      id: candidate.id,
      file: candidate.file,
      previewUrl: candidate.previewUrl,
      label: candidate.label,
      portLabel: candidate.label,
      source: "prep",
      preparedImageId: candidate.id,
      clientSourceId: candidate.record.clientSourceId,
    };
  }
  if (!source) return null;
  return {
    id: SOURCE_FRAME_ID,
    file: source.file,
    previewUrl: source.previewUrl,
    label: "Source image",
    portLabel: "image",
    source: "source",
    clientSourceId: source.id,
  };
}

export function buildPrepPorts(
  candidates: PrepCandidate[],
  pickedFrameId: string,
  preparingFrame: boolean,
  onPickFrame: (frameId: string) => void,
): PortView[] {
  const filled = candidates.map((candidate) => ({
    id: candidate.id,
    handleId: candidateHandle(candidate.id),
    label: candidate.label,
    state: candidate.id === pickedFrameId ? ("active" as const) : ("ready" as const),
    imageUrl: candidate.previewUrl,
    meta: candidate.id === pickedFrameId ? "picked" : formatDate(candidate.createdAt),
    onPick: () => onPickFrame(candidate.id),
  }));
  const emptySlots = ["A", "B", "C"].slice(filled.length).map((slot, index) => ({
    id: `empty-${slot}`,
    handleId: `empty-${slot.toLowerCase()}`,
    label: `Frame ${slot}`,
    state: preparingFrame && index === 0 ? ("running" as const) : ("idle" as const),
    meta: preparingFrame && index === 0 ? "running" : "empty",
  }));
  return [...filled, ...emptySlots].slice(0, Math.max(3, filled.length));
}

export function buildResultGraph(input: {
  sourceAsset: SourceAsset | null;
  prepCandidates: PrepCandidate[];
  jobs: JobRecord[];
  selectedNodeId: string;
  preparingFrame: boolean;
  submitting: boolean;
  onOpenImage: (url: string, label: string) => void;
}): { nodes: ResultFlowNode[]; edges: Edge[] } {
  const COLUMN = { source: 40, prep: 380, video: 760 };
  const LEAF_GAP = 240;
  const nodes: ResultFlowNode[] = [];
  const edges: Edge[] = [];

  // Lineage is derived purely from the data (never from any UI cache), so the
  // graph only shows the CURRENT source's real tree — switching outputs cannot
  // string unrelated lineages together.
  const sourceId = input.sourceAsset?.id;
  const orderedJobs = [...input.jobs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const videoEntries: { job: JobRecord; parentId: string; tone: PortState }[] = [];
  for (const job of orderedJobs) {
    const parentPrep = findPrepParent(job, input.prepCandidates);
    const fromThisSource =
      job.inputFrame?.source === "source" &&
      Boolean(sourceId) &&
      job.inputFrame.clientSourceId === sourceId;
    const isFocused = job.id === input.selectedNodeId;
    // Include a video iff it forks from a loaded frame, was run from the current
    // source, or is the node the user is currently viewing.
    if (!parentPrep && !fromThisSource && !isFocused) continue;
    videoEntries.push({
      job,
      parentId: parentPrep ? parentPrep.id : SOURCE_FRAME_ID,
      tone: jobTone(job),
    });
  }

  const videosByParent = new Map<string, JobRecord[]>();
  for (const entry of videoEntries) {
    const list = videosByParent.get(entry.parentId) ?? [];
    list.push(entry.job);
    videosByParent.set(entry.parentId, list);
  }

  // Tidy-tree vertical layout: leaves take successive slots, parents center on
  // their children — so every run sits aligned under the result it forked from.
  const yById = new Map<string, number>();
  let cursor = 0;
  const placeLeaf = (id: string) => {
    const y = cursor;
    yById.set(id, y);
    cursor += LEAF_GAP;
    return y;
  };
  const centerOn = (id: string, childIds: string[]) => {
    if (childIds.length === 0) return placeLeaf(id);
    const ys = childIds.map((childId) => yById.get(childId) ?? 0);
    const y = (ys[0] + ys[ys.length - 1]) / 2;
    yById.set(id, y);
    return y;
  };

  const sourceChildIds: string[] = [];
  for (const candidate of input.prepCandidates) {
    const videoKids = (videosByParent.get(candidate.id) ?? []).map((job) => job.id);
    for (const id of videoKids) placeLeaf(id);
    centerOn(candidate.id, videoKids);
    sourceChildIds.push(candidate.id);
  }
  for (const job of videosByParent.get(SOURCE_FRAME_ID) ?? []) {
    placeLeaf(job.id);
    sourceChildIds.push(job.id);
  }
  centerOn(SOURCE_FRAME_ID, sourceChildIds);

  nodes.push({
    id: SOURCE_FRAME_ID,
    type: "result",
    position: { x: COLUMN.source, y: yById.get(SOURCE_FRAME_ID) ?? 0 },
    data: {
      kind: "source",
      title: "Source",
      runMeta: input.sourceAsset ? formatDate(input.sourceAsset.createdAt) : "waiting for image",
      previewUrl: input.sourceAsset?.previewUrl,
      active: input.selectedNodeId === SOURCE_FRAME_ID,
      hasInput: false,
      onOpenImage: input.onOpenImage,
    },
  });

  input.prepCandidates.forEach((candidate, index) => {
    nodes.push({
      id: candidate.id,
      type: "result",
      position: { x: COLUMN.prep, y: yById.get(candidate.id) ?? index * LEAF_GAP },
      data: {
        kind: "prep",
        title: candidate.label,
        runMeta: formatDate(candidate.createdAt),
        lineageLabel: "Source",
        previewUrl: candidate.previewUrl,
        active: input.selectedNodeId === candidate.id,
        hasInput: true,
        onOpenImage: input.onOpenImage,
      },
    });
    edges.push({
      id: `edge:${SOURCE_FRAME_ID}->${candidate.id}`,
      source: SOURCE_FRAME_ID,
      sourceHandle: "out",
      target: candidate.id,
      targetHandle: "in",
      animated: input.preparingFrame && index === input.prepCandidates.length - 1,
      className: input.selectedNodeId === candidate.id ? "result-edge active" : "result-edge",
    });
  });

  for (const entry of videoEntries) {
    const { job, parentId, tone } = entry;
    const parentPreview =
      parentId === SOURCE_FRAME_ID
        ? input.sourceAsset?.previewUrl
        : input.prepCandidates.find((candidate) => candidate.id === parentId)?.previewUrl;
    nodes.push({
      id: job.id,
      type: "result",
      position: { x: COLUMN.video, y: yById.get(job.id) ?? 0 },
      data: {
        kind: "video",
        title: `Video · ${job.id.slice(0, 6)}`,
        runMeta: formatDate(job.updatedAt),
        lineageLabel: job.inputFrame?.label ?? "Source",
        previewUrl: parentPreview,
        hasVideo: job.results.length > 0,
        status: shortStatusLabel(job),
        statusTone: tone,
        active: input.selectedNodeId === job.id,
        hasInput: true,
        onOpenImage: input.onOpenImage,
      },
    });
    edges.push({
      id: `edge:${parentId}->${job.id}`,
      source: parentId,
      sourceHandle: "out",
      target: job.id,
      targetHandle: "in",
      animated: tone === "running" || (input.submitting && input.selectedNodeId === job.id),
      className: input.selectedNodeId === job.id ? "result-edge active" : "result-edge",
    });
  }

  return { nodes, edges };
}
