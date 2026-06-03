import { create } from "zustand";
import type {
  JobRecord,
  PreparedImageRecord,
  PreparedImagesResponse,
  PrepareImageResponse,
  PublicConfig,
} from "../shared/api";
import {
  composeFramePrepPrompt,
  composePrompt,
  defaultFramePrepOptions,
  defaultGenerationOptions,
  type FramePrepOptions,
  type GenerationOptions,
  type MotionCategory,
} from "../shared/options";
import { candidateSlot, extensionForMime } from "./lib/format";
import {
  SOURCE_FRAME_ID,
  TOKEN_STORAGE_KEY,
  type ImageModal,
  type InspectorTab,
  type LoadSnapshot,
  type OperatorId,
  type OutputFilter,
  type PrepCandidate,
  type SourceAsset,
  type Toast,
} from "./types";

// Object URLs are a side-effect registry, not reactive state.
const objectUrls: string[] = [];
function makePreviewUrl(file: File) {
  const url = URL.createObjectURL(file);
  objectUrls.push(url);
  return url;
}
function clearPreviewUrls() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.length = 0;
}

let loaderTimer: ReturnType<typeof setTimeout> | undefined;

function initialToken() {
  return (
    new URLSearchParams(location.search).get("token") ||
    localStorage.getItem(TOKEN_STORAGE_KEY) ||
    ""
  );
}

const fallbackDefaults = { durationSeconds: 6, resolution: "720p", aspectRatio: "source" } as const;

type StoreState = {
  token: string;
  tokenDraft: string;
  config: PublicConfig | null;
  jobs: JobRecord[];
  selectedJobId: string;
  sourceAsset: SourceAsset | null;
  prepCandidates: PrepCandidate[];
  pickedFrameId: string;
  selectedOperatorId: OperatorId;
  selectedNodeId: string;
  inspectorTab: InspectorTab;
  prompt: string;
  toast: Toast;
  imageModal: ImageModal;
  submitting: boolean;
  preparingFrame: boolean;
  categoryFilter: MotionCategory;
  outputFilter: OutputFilter;
  galleryFrames: PreparedImageRecord[];
  graphLoading: boolean;
  loaderVisible: boolean;
  options: GenerationOptions;
  framePrep: FramePrepOptions;
};

type StoreActions = {
  withToken: (path: string) => string;
  setToken: (token: string) => void;
  setTokenDraft: (value: string) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  setOperator: (id: OperatorId) => void;
  setPrompt: (value: string) => void;
  setCategoryFilter: (value: MotionCategory) => void;
  setOutputFilter: (value: OutputFilter) => void;
  setImageModal: (value: ImageModal) => void;
  setToast: (value: Toast) => void;
  openImage: (url: string, label: string) => void;
  patchOptions: (patch: Partial<GenerationOptions>) => void;
  patchFramePrep: (patch: Partial<FramePrepOptions>) => void;
  setGraphLoading: (value: boolean) => void;
  loadConfig: () => Promise<void>;
  loadJobs: () => Promise<void>;
  loadGalleryFrames: () => Promise<void>;
  chooseFile: (
    file: File | null,
    restore?: { sourceId?: string; sourceUrl?: string; createdAt?: string },
  ) => void;
  prepareFirstFrame: () => Promise<void>;
  submit: (selectedFrameFile: File, inputFrame: Record<string, unknown>) => Promise<void>;
  reuseHistoryJob: (job: JobRecord) => Promise<void>;
  openFrameOutput: (record: PreparedImageRecord) => Promise<void>;
  pickFrame: (frameId: string) => void;
  selectNode: (nodeId: string, kind: OperatorId) => void;
  copyPrompt: (text: string) => Promise<void>;
};

export type Store = StoreState & StoreActions;

function authHeaders(token: string) {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

export const useStore = create<Store>((set, get) => {
  async function fetchImageFile(url: string, filename: string) {
    const response = await fetch(get().withToken(url), { headers: authHeaders(get().token) });
    if (!response.ok) throw new Error(await response.text());
    const blob = await response.blob();
    return new File([blob], `${filename}${extensionForMime(blob.type)}`, {
      type: blob.type || "image/png",
    });
  }

  async function fetchPreparedImageRecords() {
    const response = await fetch(get().withToken("/api/prepared-images"), {
      headers: authHeaders(get().token),
    });
    if (!response.ok) throw new Error(await response.text());
    return ((await response.json()) as PreparedImagesResponse).images;
  }

  function applySnapshot(snap: LoadSnapshot) {
    clearPreviewUrls();
    set({
      sourceAsset: {
        id: snap.sourceRestore.sourceId ?? `source_${Date.now()}`,
        file: snap.sourceFile,
        previewUrl: makePreviewUrl(snap.sourceFile),
        createdAt: snap.sourceRestore.createdAt ?? new Date().toISOString(),
        sourceUrl: snap.sourceRestore.sourceUrl,
      },
      prepCandidates: snap.candidateRecords.map((record, index) => ({
        id: record.id,
        slot: candidateSlot(index),
        label: `Frame ${candidateSlot(index)}`,
        file: snap.candidateFiles[index],
        previewUrl: makePreviewUrl(snap.candidateFiles[index]),
        createdAt: record.createdAt,
        record,
        status: "ready" as const,
      })),
      pickedFrameId: snap.pickedFrameId,
      selectedNodeId: snap.selectedNodeId,
      selectedOperatorId: snap.operatorId,
      inspectorTab: snap.inspectorTab,
      ...(snap.options ? { options: snap.options } : {}),
      ...(snap.prompt !== undefined ? { prompt: snap.prompt } : {}),
    });
  }

  const store: Store = {
    token: initialToken(),
    tokenDraft: initialToken(),
    config: null,
    jobs: [],
    selectedJobId: "",
    sourceAsset: null,
    prepCandidates: [],
    pickedFrameId: SOURCE_FRAME_ID,
    selectedOperatorId: "source",
    selectedNodeId: SOURCE_FRAME_ID,
    inspectorTab: "parameters",
    prompt: "",
    toast: null,
    imageModal: null,
    submitting: false,
    preparingFrame: false,
    categoryFilter: "micro",
    outputFilter: "all",
    galleryFrames: [],
    graphLoading: false,
    loaderVisible: false,
    options: defaultGenerationOptions(fallbackDefaults),
    framePrep: defaultFramePrepOptions(),

    withToken: (path) => {
      const { token } = get();
      if (!token) return path;
      const url = new URL(path, location.origin);
      url.searchParams.set("token", token);
      return `${url.pathname}${url.search}`;
    },
    setToken: (token) => {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      set({ token });
      void get().loadConfig();
    },
    setTokenDraft: (value) => set({ tokenDraft: value }),
    setInspectorTab: (tab) => set({ inspectorTab: tab }),
    setOperator: (id) => set({ selectedOperatorId: id, inspectorTab: "parameters" }),
    setPrompt: (value) => set({ prompt: value }),
    setCategoryFilter: (value) => set({ categoryFilter: value }),
    setOutputFilter: (value) => set({ outputFilter: value }),
    setImageModal: (value) => set({ imageModal: value }),
    setToast: (value) => set({ toast: value }),
    openImage: (url, label) => set({ imageModal: { url, label } }),
    patchOptions: (patch) => set((state) => ({ options: { ...state.options, ...patch } })),
    patchFramePrep: (patch) => set((state) => ({ framePrep: { ...state.framePrep, ...patch } })),
    setGraphLoading: (value) => {
      clearTimeout(loaderTimer);
      if (value) {
        set({ graphLoading: true });
        loaderTimer = setTimeout(() => set({ loaderVisible: true }), 150);
      } else {
        set({ graphLoading: false, loaderVisible: false });
      }
    },

    loadConfig: async () => {
      try {
        const response = await fetch(get().withToken("/api/config"), {
          headers: authHeaders(get().token),
        });
        if (response.status === 401) {
          set({ config: null });
          return;
        }
        if (!response.ok) throw new Error(await response.text());
        const payload = (await response.json()) as PublicConfig;
        set((state) => ({
          config: payload,
          options: { ...defaultGenerationOptions(payload.defaults), ...state.options },
        }));
        await get().loadJobs();
        await get().loadGalleryFrames();
      } catch (error) {
        set({
          toast: { tone: "warn", text: error instanceof Error ? error.message : String(error) },
        });
      }
    },
    loadJobs: async () => {
      const response = await fetch(get().withToken("/api/jobs"), {
        headers: authHeaders(get().token),
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { jobs: JobRecord[] };
      set((state) => ({
        jobs: payload.jobs,
        selectedJobId: state.selectedJobId || payload.jobs[0]?.id || "",
      }));
    },
    loadGalleryFrames: async () => {
      try {
        set({ galleryFrames: await fetchPreparedImageRecords() });
      } catch {
        // Gallery is best-effort.
      }
    },

    chooseFile: (file, restore) => {
      clearPreviewUrls();
      if (!file) {
        set({
          sourceAsset: null,
          prepCandidates: [],
          pickedFrameId: SOURCE_FRAME_ID,
          selectedOperatorId: "source",
          selectedNodeId: SOURCE_FRAME_ID,
        });
        return;
      }
      set({
        sourceAsset: {
          id: restore?.sourceId ?? `source_${Date.now()}`,
          file,
          previewUrl: makePreviewUrl(file),
          createdAt: restore?.createdAt ?? new Date().toISOString(),
          sourceUrl: restore?.sourceUrl,
        },
        prepCandidates: [],
        pickedFrameId: SOURCE_FRAME_ID,
        selectedOperatorId: "source",
        selectedNodeId: SOURCE_FRAME_ID,
        inspectorTab: "parameters",
      });
    },

    prepareFirstFrame: async () => {
      const { sourceAsset, framePrep } = get();
      if (!sourceAsset) {
        set({ toast: { tone: "warn", text: "Add a source image first." } });
        return;
      }
      set({ preparingFrame: true, toast: null });
      try {
        const form = new FormData();
        form.set("image", sourceAsset.file);
        form.set("options", JSON.stringify(framePrep));
        form.set("sourceId", sourceAsset.id);
        const response = await fetch(get().withToken("/api/prepared-images"), {
          method: "POST",
          headers: authHeaders(get().token),
          body: form,
        });
        if (!response.ok) throw new Error(await response.text());
        const payload = (await response.json()) as PrepareImageResponse;
        const file = await fetchImageFile(
          payload.image.preparedImageUrl,
          `prepared-${payload.image.id}`,
        );
        set((state) => {
          const slot = candidateSlot(state.prepCandidates.length);
          const candidate: PrepCandidate = {
            id: payload.image.id,
            slot,
            label: `Frame ${slot}`,
            file,
            previewUrl: makePreviewUrl(file),
            createdAt: payload.image.createdAt,
            record: payload.image,
            status: "ready",
          };
          return {
            prepCandidates: [...state.prepCandidates, candidate],
            pickedFrameId: candidate.id,
            selectedOperatorId: "prep",
            selectedNodeId: candidate.id,
            inspectorTab: "outputs",
            toast: { tone: "ok", text: `${candidate.label} ready.` },
          };
        });
        void get().loadGalleryFrames();
      } catch (error) {
        set({
          toast: { tone: "warn", text: error instanceof Error ? error.message : String(error) },
        });
      } finally {
        set({ preparingFrame: false });
      }
    },

    submit: async (selectedFrameFile, inputFrame) => {
      set({ submitting: true, toast: null });
      try {
        const { options, prompt } = get();
        const form = new FormData();
        form.set("image", selectedFrameFile);
        form.set("options", JSON.stringify({ ...options, prompt }));
        form.set("inputFrame", JSON.stringify(inputFrame));
        const response = await fetch(get().withToken("/api/jobs"), {
          method: "POST",
          headers: authHeaders(get().token),
          body: form,
        });
        if (!response.ok) throw new Error(await response.text());
        const payload = (await response.json()) as { job: JobRecord };
        set((state) => ({
          jobs: [payload.job, ...state.jobs],
          selectedJobId: payload.job.id,
          selectedOperatorId: "video",
          selectedNodeId: payload.job.id,
          inspectorTab: "outputs",
          toast: { tone: "ok", text: "Video run started." },
        }));
      } catch (error) {
        set({
          toast: { tone: "warn", text: error instanceof Error ? error.message : String(error) },
        });
      } finally {
        set({ submitting: false });
      }
    },

    reuseHistoryJob: async (job) => {
      set({ selectedJobId: job.id, toast: null });
      get().setGraphLoading(true);
      try {
        const input = job.inputFrame;
        let snap: LoadSnapshot | null = null;
        if (input?.source === "prep") {
          const records = await fetchPreparedImageRecords();
          const matched = records
            .filter(
              (record) =>
                (input.clientSourceId && record.clientSourceId === input.clientSourceId) ||
                record.id === input.preparedImageId,
            )
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          const selectedRecord =
            matched.find((record) => record.id === input.preparedImageId) ?? matched.at(-1);
          if (selectedRecord) {
            const sourceFile = await fetchImageFile(
              selectedRecord.sourceImageUrl,
              `source-${job.id}`,
            );
            const candidateFiles = await Promise.all(
              matched.map((record) =>
                fetchImageFile(record.preparedImageUrl, `prepared-${record.id}`),
              ),
            );
            snap = {
              sourceFile,
              sourceRestore: {
                sourceId: selectedRecord.clientSourceId,
                sourceUrl: selectedRecord.sourceImageUrl,
                createdAt: selectedRecord.createdAt,
              },
              candidateRecords: matched,
              candidateFiles,
              pickedFrameId: selectedRecord.id,
              selectedNodeId: job.id,
              operatorId: "video",
              inspectorTab: "outputs",
              options: job.options,
              prompt: job.options.prompt,
            };
          }
        }
        if (!snap) {
          const sourceFile = await fetchImageFile(job.sourceImageUrl, `history-${job.id}`);
          snap = {
            sourceFile,
            sourceRestore: { sourceUrl: job.sourceImageUrl },
            candidateRecords: [],
            candidateFiles: [],
            pickedFrameId: SOURCE_FRAME_ID,
            selectedNodeId: job.id,
            operatorId: "video",
            inspectorTab: "outputs",
            options: job.options,
            prompt: job.options.prompt,
          };
        }
        applySnapshot(snap);
        set({ toast: { tone: "ok", text: "Loaded." } });
      } catch (error) {
        set({
          toast: { tone: "warn", text: error instanceof Error ? error.message : String(error) },
        });
      } finally {
        get().setGraphLoading(false);
      }
    },

    openFrameOutput: async (record) => {
      get().setGraphLoading(true);
      set({ toast: null });
      try {
        const all = await fetchPreparedImageRecords();
        const siblings = all
          .filter(
            (item) =>
              (record.clientSourceId && item.clientSourceId === record.clientSourceId) ||
              item.id === record.id,
          )
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const base = siblings.find((item) => item.id === record.id) ?? record;
        const sourceFile = await fetchImageFile(base.sourceImageUrl, `source-${record.id}`);
        const candidateFiles = await Promise.all(
          siblings.map((item) => fetchImageFile(item.preparedImageUrl, `prepared-${item.id}`)),
        );
        applySnapshot({
          sourceFile,
          sourceRestore: {
            sourceId: base.clientSourceId,
            sourceUrl: base.sourceImageUrl,
            createdAt: base.createdAt,
          },
          candidateRecords: siblings,
          candidateFiles,
          pickedFrameId: record.id,
          selectedNodeId: record.id,
          operatorId: "video",
          inspectorTab: "parameters",
        });
        set({ toast: { tone: "ok", text: "Frame loaded." } });
      } catch (error) {
        set({
          toast: { tone: "warn", text: error instanceof Error ? error.message : String(error) },
        });
      } finally {
        get().setGraphLoading(false);
      }
    },

    pickFrame: (frameId) =>
      set({
        pickedFrameId: frameId,
        selectedNodeId: frameId,
        selectedOperatorId: "video",
        inspectorTab: "parameters",
      }),

    selectNode: (nodeId, kind) => {
      if (kind === "source") {
        set({
          selectedNodeId: nodeId,
          selectedOperatorId: "source",
          pickedFrameId: SOURCE_FRAME_ID,
          inspectorTab: "parameters",
        });
        return;
      }
      if (kind === "prep") {
        set({
          selectedNodeId: nodeId,
          selectedOperatorId: "video",
          pickedFrameId: nodeId,
          inspectorTab: "parameters",
        });
        return;
      }
      const { jobs, prepCandidates } = get();
      const job = jobs.find((item) => item.id === nodeId);
      const preparedImageId = job?.inputFrame?.preparedImageId;
      const parentPrep =
        job?.inputFrame?.source === "prep" && preparedImageId
          ? prepCandidates.find((candidate) => candidate.id === preparedImageId)
          : undefined;
      set({
        selectedNodeId: nodeId,
        selectedOperatorId: "video",
        selectedJobId: nodeId,
        pickedFrameId: parentPrep ? parentPrep.id : SOURCE_FRAME_ID,
        inspectorTab: "outputs",
      });
    },

    copyPrompt: async (text) => {
      await navigator.clipboard.writeText(text);
      set({ toast: { tone: "ok", text: "Prompt copied." } });
    },
  };
  return store;
});

export const selectSubmittedPrompt = (state: Store) =>
  composePrompt({ ...state.options, prompt: state.prompt });
export const selectPrepPrompt = (state: Store) => composeFramePrepPrompt(state.framePrep);
