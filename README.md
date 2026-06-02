# Grok Video Studio

Self-hosted Grok image-to-video workspace for local use. It serves a private browser UI, stores uploaded images and generated videos on disk, and reuses the local Linger xAI OAuth configuration by default.

## Run

```bash
vp install
cp .env.example .env
npm run build
npm start
```

For normal local use:

```bash
npm run launch
```

`launch` builds the app, checks xAI OAuth, opens the browser login flow when no token exists, then starts the web app. Open `http://127.0.0.1:8787`.

## LAN Access

For local-network access, set:

```dotenv
HOST=0.0.0.0
ACCESS_TOKEN=
```

Then restart the service and open `http://<mac-lan-ip>:8787` or `http://<mac-local-hostname>.local:8787` from another device on the same LAN.

## Configuration

- `ACCESS_TOKEN` is optional. Leave it empty for personal local/LAN use; set it only if you intentionally expose the app outside a trusted LAN.
- `WORKSPACE_DIR` stores `images/`, `videos/`, and `jobs/`.
- `XAI_AUTH_MODE=oauth` reads `XAI_OAUTH_TOKEN_FILE`, refreshes it when needed, and `npm run launch` can bootstrap it interactively.
- `XAI_AUTH_MODE=api_key` uses `XAI_API_KEY`.
- `DEFAULT_DURATION_SECONDS` supports up to 15 seconds.
- `MAX_VARIATIONS` limits sequential variations per job.

The app binds to `127.0.0.1` by default. Use `HOST=0.0.0.0` only for LAN/tunnel exposure.

## Test Grok Login Flow

To test the xAI/Grok browser login without touching the token file used by the running service:

```bash
npm run login:grok -- --output ~/.grok-video-web/login-test/xai-oauth.json
```

The command opens the xAI authorization page, waits for the local callback, saves the token state to the test path, and verifies it with the API. If xAI shows a fallback code instead of redirecting, paste that code into the terminal prompt.

Useful variants:

```bash
npm run login:grok -- --output ~/.grok-video-web/login-test/xai-oauth.json --check
npm run login:grok -- --output ~/.grok-video-web/login-test/xai-oauth.json --force
npm run login:grok -- --print-url-only
```

`--print-url-only` is only for smoke-checking that the OAuth authorization URL can be built; it exits immediately, so do not use that URL to complete a real login. The command refuses to overwrite an existing token file unless `--force` is passed.

## Quality Loop

Vite+ (`vp`) owns frontend build, lint/format/type checks, and tests. The npm scripts keep the server TypeScript build wired in:

```bash
npm run check
npm test
npm run build
npm run smoke
```
