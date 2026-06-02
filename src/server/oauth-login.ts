import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { execFile } from "node:child_process";

const ISSUER = "https://auth.x.ai";
const DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`;
const CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const SCOPE = "openid profile email offline_access grok-cli:access api:access";
const REDIRECT_HOST = "127.0.0.1";
const REDIRECT_PATH = "/callback";
const DEFAULT_BASE_URL = "https://api.x.ai/v1";

type Discovery = {
  authorization_endpoint: string;
  token_endpoint: string;
};

type CallbackResult = {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
};

type LoginOptions = {
  outputPath: string;
  port?: number;
  timeoutSeconds?: number;
  noBrowser?: boolean;
};

export async function runXaiOauthLogin(options: LoginOptions): Promise<void> {
  const discovery = await fetchDiscovery();
  const { verifier, challenge } = makePkcePair();
  const state = crypto.randomUUID().replace(/-/g, "");
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const server = await startCallbackServer(options.port ?? 56121);
  const redirectUri = server.redirectUri;
  const authorizeUrl = buildAuthorizeUrl({
    authorizationEndpoint: discovery.authorization_endpoint,
    redirectUri,
    challenge,
    state,
    nonce,
  });

  try {
    console.log("Open this URL to authorize Grok Video Studio with xAI:");
    console.log(authorizeUrl);
    console.log();
    console.log(`Waiting for callback on ${redirectUri}`);
    console.log("If xAI shows a fallback code, paste that code here and press Return.");
    if (!options.noBrowser) openBrowser(authorizeUrl);
    const callback = await waitForCallbackOrFallbackInput({
      server,
      timeoutMs: (options.timeoutSeconds ?? 600) * 1000,
      redirectUri,
      expectedState: state,
    });
    if (callback.error) {
      throw new Error(`xAI authorization failed: ${callback.error_description ?? callback.error}`);
    }
    if (callback.state !== state) {
      throw new Error("xAI authorization failed: state mismatch.");
    }
    if (!callback.code) {
      throw new Error("xAI authorization failed: missing code.");
    }

    const tokenPayload = await exchangeCodeForTokens({
      tokenEndpoint: discovery.token_endpoint,
      code: callback.code,
      redirectUri,
      verifier,
      challenge,
    });
    const accessToken = String(tokenPayload.access_token ?? "").trim();
    const refreshToken = String(tokenPayload.refresh_token ?? "").trim();
    if (!accessToken || !refreshToken) {
      throw new Error("xAI token exchange did not return access_token + refresh_token.");
    }
    const expiresIn = Number(tokenPayload.expires_in ?? 0);
    writeJson0600(options.outputPath, {
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        id_token: String(tokenPayload.id_token ?? ""),
        expires_in: Number.isFinite(expiresIn) && expiresIn > 0 ? Math.floor(expiresIn) : undefined,
        expires_at: Number.isFinite(expiresIn) && expiresIn > 0
          ? new Date(Date.now() + expiresIn * 1000).toISOString()
          : undefined,
        token_type: String(tokenPayload.token_type ?? "Bearer") || "Bearer",
      },
      discovery,
      redirect_uri: redirectUri,
      base_url: DEFAULT_BASE_URL,
      last_refresh: new Date().toISOString(),
      source: "grok-video-web-oauth-login",
    });
    console.log(`xAI OAuth login successful. Token state saved to ${options.outputPath}`);
  } finally {
    await closeServer(server.server);
  }
}

async function fetchDiscovery(): Promise<Discovery> {
  const response = await fetch(DISCOVERY_URL, { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error(`xAI discovery failed: ${response.status} ${response.statusText}`);
  const json = await response.json() as Record<string, unknown>;
  return {
    authorization_endpoint: validateXaiEndpoint(String(json.authorization_endpoint ?? ""), "authorization_endpoint"),
    token_endpoint: validateXaiEndpoint(String(json.token_endpoint ?? ""), "token_endpoint"),
  };
}

function buildAuthorizeUrl(input: {
  authorizationEndpoint: string;
  redirectUri: string;
  challenge: string;
  state: string;
  nonce: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: input.redirectUri,
    scope: SCOPE,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
    state: input.state,
    nonce: input.nonce,
    plan: "generic",
    referrer: "grok-video-web",
  });
  return `${input.authorizationEndpoint}?${params.toString()}`;
}

async function exchangeCodeForTokens(input: {
  tokenEndpoint: string;
  code: string;
  redirectUri: string;
  verifier: string;
  challenge: string;
}): Promise<Record<string, unknown>> {
  const response = await fetch(input.tokenEndpoint, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: CLIENT_ID,
      code_verifier: input.verifier,
      code_challenge: input.challenge,
      code_challenge_method: "S256",
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`xAI token exchange failed: ${response.status} ${response.statusText} -- ${body.slice(0, 800)}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

function makePkcePair(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(64).toString("base64url").slice(0, 128);
  const challenge = crypto.createHash("sha256").update(verifier, "utf8").digest("base64url");
  return { verifier, challenge };
}

async function startCallbackServer(preferredPort: number): Promise<{
  server: http.Server;
  result: CallbackResult;
  redirectUri: string;
}> {
  const result: CallbackResult = {};
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://${REDIRECT_HOST}`);
    if (requestUrl.pathname !== REDIRECT_PATH) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found.");
      return;
    }
    if (!result.code && !result.error) {
      result.code = requestUrl.searchParams.get("code") ?? undefined;
      result.state = requestUrl.searchParams.get("state") ?? undefined;
      result.error = requestUrl.searchParams.get("error") ?? undefined;
      result.error_description = requestUrl.searchParams.get("error_description") ?? undefined;
    }
    response.writeHead(result.error ? 400 : 200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(
      result.error
        ? "<html><body><h1>xAI authorization failed.</h1>You can close this tab.</body></html>"
        : "<html><body><h1>xAI authorization received.</h1>You can close this tab.</body></html>",
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(preferredPort, REDIRECT_HOST, () => resolve());
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : preferredPort;
  return {
    server,
    result,
    redirectUri: `http://${REDIRECT_HOST}:${actualPort}${REDIRECT_PATH}`,
  };
}

async function waitForCallback(serverState: { result: CallbackResult }, timeoutMs: number): Promise<CallbackResult> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (serverState.result.code || serverState.result.error) return serverState.result;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for xAI OAuth callback.");
}

async function waitForCallbackOrFallbackInput(input: {
  server: { result: CallbackResult };
  timeoutMs: number;
  redirectUri: string;
  expectedState: string;
}): Promise<CallbackResult> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await Promise.race([
      waitForCallback(input.server, input.timeoutMs),
      waitForFallbackInput(rl, { redirectUri: input.redirectUri, expectedState: input.expectedState }),
    ]);
  } finally {
    rl.close();
  }
}

async function waitForFallbackInput(
  rl: readline.Interface,
  input: { redirectUri: string; expectedState: string },
): Promise<CallbackResult> {
  while (true) {
    const value = await rl.question(`Paste the full ${input.redirectUri} callback URL or xAI fallback code: `);
    const parsed = parseCallbackInput(value, input.expectedState);
    if (parsed) return parsed;
  }
}

function parseCallbackInput(value: string, expectedState: string): CallbackResult | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    return {
      code: url.searchParams.get("code") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
      error: url.searchParams.get("error") ?? undefined,
      error_description: url.searchParams.get("error_description") ?? undefined,
    };
  } catch {
    return { code: trimmed.replace(/\s+/g, ""), state: expectedState };
  }
}

function openBrowser(url: string): void {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  execFile(command, args, (error) => {
    if (error) console.warn(`Could not open browser automatically: ${error.message}`);
  });
}

async function closeServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

function validateXaiEndpoint(value: string, field: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") throw new Error(`xAI ${field} is not HTTPS: ${value}`);
  const host = parsed.hostname.toLowerCase();
  if (host !== "x.ai" && !host.endsWith(".x.ai")) {
    throw new Error(`xAI ${field} is not on x.ai: ${value}`);
  }
  return value;
}

function writeJson0600(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tempPath, filePath);
  fs.chmodSync(filePath, 0o600);
}

