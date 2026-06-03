import { KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { GraphCanvas } from "./components/GraphCanvas";
import { Inspector } from "./components/Inspector";
import { OutputSidebar } from "./components/OutputSidebar";
import { clipboardImageFile } from "./lib/format";
import { useStore } from "./store";

export default function App() {
  const config = useStore((state) => state.config);
  const tokenDraft = useStore((state) => state.tokenDraft);
  const jobs = useStore((state) => state.jobs);
  const imageModal = useStore((state) => state.imageModal);
  const toast = useStore((state) => state.toast);
  const setToken = useStore((state) => state.setToken);
  const setTokenDraft = useStore((state) => state.setTokenDraft);
  const setImageModal = useStore((state) => state.setImageModal);
  const setToast = useStore((state) => state.setToast);
  const loadConfig = useStore((state) => state.loadConfig);
  const loadJobs = useStore((state) => state.loadJobs);
  const chooseFile = useStore((state) => state.chooseFile);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const active = jobs.some((job) => job.status === "queued" || job.status === "running");
    if (!active) return;
    const timer = window.setInterval(() => void loadJobs(), 2500);
    return () => window.clearInterval(timer);
  }, [jobs, loadJobs]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const image = clipboardImageFile(event.clipboardData);
      if (!image) return;
      event.preventDefault();
      chooseFile(image);
      setToast({ tone: "ok", text: "Image pasted." });
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [chooseFile, setToast]);

  if (!config) {
    return (
      <main className="gate">
        <section className="gate-panel">
          <div className="mark">
            <KeyRound size={24} />
          </div>
          <h1>Grok Studio</h1>
          <p>Self-hosted operator console.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setToken(tokenDraft.trim());
            }}
          >
            <input
              type="password"
              value={tokenDraft}
              onChange={(event) => setTokenDraft(event.target.value)}
              aria-label="Access token"
              placeholder="ACCESS_TOKEN"
            />
            <button type="submit">Unlock</button>
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
            <ShieldCheck size={15} /> selfhost · run graph
          </div>
          <h1>Grok Studio</h1>
        </div>
        <button className="ghost" type="button" onClick={() => void loadJobs()} title="Refresh">
          <RefreshCw size={18} />
          Refresh
        </button>
      </header>

      <div className="app-layout">
        <OutputSidebar onNewSource={() => fileInput.current?.click()} />
        <section className="workspace">
          <GraphCanvas />
          <Inspector onPickFile={() => fileInput.current?.click()} />
        </section>
      </div>

      <input
        ref={fileInput}
        className="file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Source image"
        onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
      />
      {toast && <output className={`toast ${toast.tone}`}>{toast.text}</output>}
      <Lightbox
        open={Boolean(imageModal)}
        close={() => setImageModal(null)}
        slides={imageModal ? [{ src: imageModal.url, alt: imageModal.label }] : []}
        plugins={[Zoom]}
        carousel={{ finite: true }}
        controller={{ closeOnBackdropClick: true }}
      />
    </main>
  );
}
