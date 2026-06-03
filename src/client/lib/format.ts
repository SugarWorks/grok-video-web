import type { JobRecord } from "../../shared/api";

export function candidateSlot(index: number) {
  return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[index] ?? String(index + 1);
}

export function candidateHandle(id: string) {
  return `frame-${id}`;
}

export function statusLabel(job: JobRecord) {
  if (job.status === "succeeded") return "Done";
  if (job.status === "failed") return `Failed${job.error ? `: ${job.error}` : ""}`;
  if (job.status === "running") return "Running";
  return "Queued";
}

export function shortStatusLabel(job: JobRecord) {
  if (job.status === "succeeded") return "Done";
  if (job.status === "failed") return "Failed";
  if (job.status === "running") return "Running";
  return "Queued";
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}

export function titleCase(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

export function formatProgressItem(item: string) {
  const statusMatch = item.match(/^(\d+)\/(\d+):status:(.+)$/);
  if (statusMatch) {
    const [, current, total, status] = statusMatch;
    const labels: Record<string, string> = {
      pending: "queued",
      running: "running",
      processing: "processing",
      done: "done",
      failed: "failed",
    };
    return `Take ${current}/${total}: ${labels[status] ?? status}`;
  }
  const downloadMatch = item.match(/^(\d+)\/(\d+):download$/);
  if (downloadMatch) return `Take ${downloadMatch[1]}/${downloadMatch[2]}: downloaded`;
  const pollRetryMatch = item.match(/^(\d+)\/(\d+):poll_network_retry$/);
  if (pollRetryMatch) return `Take ${pollRetryMatch[1]}/${pollRetryMatch[2]}: network retry`;
  const downloadRetryMatch = item.match(/^(\d+)\/(\d+):download_(network_)?retry$/);
  if (downloadRetryMatch)
    return `Take ${downloadRetryMatch[1]}/${downloadRetryMatch[2]}: download retry`;
  if (item === "poll_network_retry") return "Network retry";
  if (item === "download_network_retry" || item === "download_retry") return "Download retry";
  if (item === "done") return "Run complete";
  return item;
}

export function extensionForMime(mimeType: string) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/png") return ".png";
  return ".png";
}

export function clipboardImageFile(data: DataTransfer | null): File | null {
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
