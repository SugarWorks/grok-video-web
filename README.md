# Grok Studio

Self-hosted Grok image-to-video studio. Your xAI credentials stay on the server; turn an image into video from a web UI or the CLI, with outputs stored on disk. Built for local / LAN use.

## Install & run

```bash
npx grok-studio
```

That's it. First run opens the xAI browser login if needed, then serves on <http://127.0.0.1:8787>. (`npm i -g grok-studio` also works.)

## CLI

```bash
grok-studio serve [--open]   # start the web app (default command)
grok-studio gen --image a.png --prompt "slow head turn" \
  [--prep --duration 6 --resolution 720p --aspect 9:16 --count 2 --out clip.mp4]
grok-studio login            # xAI OAuth login (browser)
grok-studio status           # config + xAI auth + server health
```

`gen` is headless: image →(optional `--prep` first frame)→ video, no UI; result paths print to stdout.

## Web UI

- **Left rail** — `+` adds a source image; **Active Jobs** lists running work globally; **Outputs** is a gallery of every `Frame` / `Video`.
- **Result Graph** (center) — every node is one concrete run: `Source` → `Frame` (each prep) → `Video` (each run). Forks are sibling nodes. Lineage is derived purely from data (`inputFrame.preparedImageId` / `clientSourceId`), never guessed from history.
- **Inspector** (right) — the only place to view a result, download, rerun, prep, or animate the selected node.

## Configure (`.env`)

```dotenv
HOST=127.0.0.1                 # 0.0.0.0 for LAN access
PORT=8787
ACCESS_TOKEN=                  # set to gate non-loopback access (empty = open on loopback/LAN)
WORKSPACE_DIR=~/.grok-studio/workspace  # holds images/ videos/ jobs/ prepared-images/
XAI_AUTH_MODE=oauth            # or: api_key (+ XAI_API_KEY)
XAI_VIDEO_MODEL=grok-imagine-video
XAI_IMAGE_MODEL=grok-imagine-image-quality
```

## Develop

```bash
vp install
vpr check && vp test && vpr build && vpr smoke
```

Quality gates: React/a11y lint, type checks, an architecture-size test (`tests/architecture.test.ts`), and a Playwright smoke (`scripts/smoke.mjs`).
