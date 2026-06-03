# Grok Studio

Self-hosted Grok generation workspace for local/LAN use. The app keeps xAI credentials on the server, lets the browser upload or paste an image, optionally prepares a video-ready first frame, then generates and stores video outputs on disk.

## Product Model

The UI is organized around generated outputs, active work, and source-scoped lineage.

- **Left rail**: `+` creates a new source image. Active Jobs appears above the output gallery when queued or running work exists; it is global and not tied to the currently selected source. Outputs are typed as `Frame` or `Video`; status text is only for exceptional or in-progress states.
- **Result Graph**: the center canvas shows lineage for the current source. Nodes are concrete artifacts/runs:
  - `Source` is the root image.
  - each Prep run creates a separate `Frame` node.
  - each Video run creates a separate `Video` node.
- **Inspector**: the right panel is the only place for details and actions. Select a node to inspect it, download video output, rerun, prepare another frame, or animate the selected frame.

Lineage is data-driven:

- Source-linked video jobs attach only when `inputFrame.source === "source"` and the job's `clientSourceId` matches the current source.
- Frame-linked video jobs attach only when `inputFrame.source === "prep"` and `preparedImageId` matches a frame in the current graph.
- UI cache must not decide graph edges. If lineage fields are missing, do not guess by recent history.

## Run

```bash
vp install
cp .env.example .env
vpr build
vpr start
```

For normal local use:

```bash
vpr launch
```

`launch` builds the app, checks xAI auth, opens the browser login flow when no token exists, then starts the web app. Open <http://127.0.0.1:8787>.

## LAN Access

For local-network access, set:

```dotenv
HOST=0.0.0.0
ACCESS_TOKEN=
```

Then restart the service and open `http://<mac-lan-ip>:8787` or `http://<mac-local-hostname>.local:8787` from another device on the same LAN.

`ACCESS_TOKEN` can be left empty for trusted local/LAN use. Set it before exposing the app outside a trusted network.

## Configuration

- `HOST` / `PORT` control where the server binds.
- `ACCESS_TOKEN` optionally protects browser/API access outside loopback.
- `WORKSPACE_DIR` stores `images/`, `videos/`, `jobs/`, and `prepared-images/`.
- `XAI_AUTH_MODE=oauth` reads `XAI_OAUTH_TOKEN_FILE`, refreshes it when needed, and `vpr launch` can bootstrap it interactively.
- `XAI_AUTH_MODE=api_key` uses `XAI_API_KEY`.
- `XAI_VIDEO_MODEL` controls image-to-video generation.
- `XAI_IMAGE_MODEL` controls first-frame image editing.
- `DEFAULT_DURATION_SECONDS` supports up to 15 seconds.
- `MAX_VARIATIONS` limits sequential variations per video job.

The app binds to `127.0.0.1` by default. Use `HOST=0.0.0.0` only for LAN/tunnel exposure.

## Grok Login Test

To test the xAI/Grok browser login without touching the token file used by the running service:

```bash
vpr login
```

The command opens the xAI authorization page, waits for the local callback, saves the token state to a test path, and verifies it with the API. If xAI shows a fallback code instead of redirecting, paste that code into the terminal prompt.

Useful variants:

```bash
vpr login --check
vpr login --print-url-only
vpr login --live --force
```

`vpr login` is Vite+'s shorthand for `vp run login`. Vite+ built-in top-level commands such as `vp build` and `vp test` cannot be extended by this project, so custom project commands use `vp run <task>` / `vpr <task>`.

By default, login writes to `~/.grok-video-web/login-test/xai-oauth.json` so repeated login-flow tests do not disturb the live service token. Use `--live --force` only when intentionally repairing `XAI_OAUTH_TOKEN_FILE`. `--print-url-only` is only for smoke-checking that the OAuth authorization URL can be built; it exits immediately, so do not use that URL to complete a real login.

## Quality Loop

Vite+ (`vp`/`vpr`) owns build, lint/format/type checks, and tests:

```bash
vpr fmt
vpr fmt:check
vpr lint
vpr lint:fix
vpr check
vp test
vpr build
vpr smoke
```

Quality gates include:

- React-specific lint rules for hooks, effect dependencies, JSX keys, nested components, unsafe JSX, and button types.
- Type-aware linting and TypeScript checks.
- Architecture guardrails in `tests/architecture.test.ts` to keep the main app shell thin, limit local React state in `App.tsx`, split stylesheet ownership, and keep server route files focused.
- Browser smoke coverage in `scripts/smoke.mjs`, including paste input, image lightbox, video-card scroll behavior, and legacy history not restoring unrelated Prep outputs.

## Local Service

If installed as the local launchd service, restart it after building:

```bash
launchctl kickstart -k gui/$(id -u)/com.pengx17.grok-video-web
curl -fsS http://127.0.0.1:8787/health
```
