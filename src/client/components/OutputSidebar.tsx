import { Film, Plus } from "lucide-react";
import { useMemo } from "react";
import { formatDate, formatProgressItem, titleCase } from "../lib/format";
import { useStore } from "../store";
import type { OutputFilter, OutputGalleryItem } from "../types";

const FILTERS: readonly OutputFilter[] = ["all", "frames", "videos"];

export function OutputSidebar({ onNewSource }: { onNewSource: () => void }) {
  const galleryFrames = useStore((state) => state.galleryFrames);
  const jobs = useStore((state) => state.jobs);
  const outputFilter = useStore((state) => state.outputFilter);
  const selectedNodeId = useStore((state) => state.selectedNodeId);
  const withToken = useStore((state) => state.withToken);
  const setOutputFilter = useStore((state) => state.setOutputFilter);
  const openFrameOutput = useStore((state) => state.openFrameOutput);
  const reuseHistoryJob = useStore((state) => state.reuseHistoryJob);

  const outputItems = useMemo<OutputGalleryItem[]>(() => {
    const items: OutputGalleryItem[] = [];
    if (outputFilter !== "videos") {
      for (const record of galleryFrames) {
        items.push({
          key: `frame:${record.id}`,
          kind: "frame",
          thumbUrl: record.preparedImageUrl,
          time: record.createdAt,
          record,
        });
      }
    }
    if (outputFilter !== "frames") {
      for (const job of jobs) {
        items.push({
          key: `video:${job.id}`,
          kind: "video",
          thumbUrl: job.sourceImageUrl,
          time: job.updatedAt,
          job,
        });
      }
    }
    return items.sort((a, b) => b.time.localeCompare(a.time));
  }, [galleryFrames, jobs, outputFilter]);

  const activeJobs = jobs.filter((job) => job.status === "queued" || job.status === "running");

  return (
    <aside className="history-sidebar" aria-label="Outputs">
      <div className="history-head">
        <span>Outputs</span>
        <button
          type="button"
          className="history-new"
          title="New source"
          aria-label="New source"
          onClick={onNewSource}
        >
          <Plus size={16} />
        </button>
      </div>
      {activeJobs.length > 0 && (
        <div className="active-jobs" aria-label="Active jobs">
          <div className="active-jobs-head">
            <span>Active</span>
            <small>{activeJobs.length}</small>
          </div>
          {activeJobs.map((job) => (
            <button
              type="button"
              key={job.id}
              className="active-job"
              aria-label={`Open video ${job.id.slice(0, 6)}`}
              onClick={() => void reuseHistoryJob(job)}
            >
              <img src={withToken(job.sourceImageUrl)} alt="" />
              <span className="active-job-body">
                <b>Video · {job.id.slice(0, 6)}</b>
                <small>{formatProgressItem(job.progress.at(-1) ?? job.status)}</small>
              </span>
              <span className={`active-job-dot ${job.status}`} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <div className="outputs-panel">
        <div className="output-filter" role="tablist" aria-label="Output filter">
          {FILTERS.map((filter) => (
            <button
              type="button"
              key={filter}
              className={outputFilter === filter ? "active" : ""}
              aria-pressed={outputFilter === filter}
              onClick={() => setOutputFilter(filter)}
            >
              {titleCase(filter)}
            </button>
          ))}
        </div>
        {outputItems.length > 0 ? (
          <div className="outputs-grid">
            {outputItems.map((item) => (
              <button
                type="button"
                key={item.key}
                data-key={item.key}
                className={`output-card ${
                  selectedNodeId === item.record?.id || selectedNodeId === item.job?.id
                    ? "active"
                    : ""
                }`}
                onClick={() => {
                  if (item.kind === "frame" && item.record) void openFrameOutput(item.record);
                  else if (item.job) void reuseHistoryJob(item.job);
                }}
              >
                {item.thumbUrl ? (
                  <img src={withToken(item.thumbUrl)} alt="" />
                ) : (
                  <i aria-hidden="true" />
                )}
                <span className={`output-kind ${item.kind}`}>
                  {item.kind === "frame" ? "Frame" : "Video"}
                </span>
                <small>{formatDate(item.time)}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-history">
            <Film size={24} />
            <p>No outputs</p>
          </div>
        )}
      </div>
    </aside>
  );
}
