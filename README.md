# Grok Video Studio

Self-hosted Grok image-to-video workspace for local use. It serves a private browser UI, stores uploaded images and generated videos on disk, and reuses the local Linger xAI OAuth configuration by default.

## Run

```bash
npm install
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

## Quality Loop

```bash
npm run check
npm test
npm run build
```
