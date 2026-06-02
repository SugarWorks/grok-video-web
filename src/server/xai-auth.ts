import crypto from "node:crypto";
import fs from "node:fs";
import type { AppConfig } from "./config.js";

const XAI_OAUTH_ISSUER = "https://auth.x.ai";
const XAI_OAUTH_DISCOVERY_URL = `${XAI_OAUTH_ISSUER}/.well-known/openid-configuration`;
const XAI_OAUTH_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const REFRESH_SKEW_SECONDS = 120;

type XaiOAuthDiscovery = {
  token_endpoint: string;
};

type XaiOAuthTokenState = {
  tokens?: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: string;
    expires_in?: number;
    token_type?: string;
  };
  discovery?: Partial<XaiOAuthDiscovery>;
  base_url?: string;
};

export type XaiRuntimeAuth = {
  token: string;
  label: "xai-api-key" | "xai-oauth";
  baseUrl: string;
};

export async function resolveXaiAuth(config: AppConfig): Promise<XaiRuntimeAuth> {
  if (config.xai.authMode === "api_key") {
    if (!config.xai.apiKey) throw new Error("XAI_API_KEY is not configured.");
    return { token: config.xai.apiKey, label: "xai-api-key", baseUrl: config.xai.baseUrl };
  }

  if (config.xai.oauthToken) {
    return { token: config.xai.oauthToken, label: "xai-oauth", baseUrl: config.xai.baseUrl };
  }

  if (!fs.existsSync(config.xai.oauthTokenFile)) {
    throw new Error(`XAI_OAUTH_TOKEN_FILE not found: ${config.xai.oauthTokenFile}`);
  }
  const state = readTokenState(config.xai.oauthTokenFile);
  const accessToken = cleanBearerToken(state.tokens?.access_token);
  if (accessToken && !accessTokenIsExpiring(accessToken, state.tokens?.expires_at)) {
    return { token: accessToken, label: "xai-oauth", baseUrl: cleanBaseUrl(state.base_url ?? config.xai.baseUrl) };
  }

  const refreshed = await refreshTokenState(state);
  writeTokenState(config.xai.oauthTokenFile, refreshed);
  const refreshedToken = cleanBearerToken(refreshed.tokens?.access_token);
  if (!refreshedToken) throw new Error("xAI OAuth refresh did not return an access token.");
  return { token: refreshedToken, label: "xai-oauth", baseUrl: cleanBaseUrl(refreshed.base_url ?? config.xai.baseUrl) };
}

export function randomId(prefix = "job"): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function readTokenState(filePath: string): XaiOAuthTokenState {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  return raw ? JSON.parse(raw) as XaiOAuthTokenState : {};
}

function writeTokenState(filePath: string, state: XaiOAuthTokenState): void {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tempPath, filePath);
  fs.chmodSync(filePath, 0o600);
}

async function refreshTokenState(state: XaiOAuthTokenState): Promise<XaiOAuthTokenState> {
  const refreshToken = cleanBearerToken(state.tokens?.refresh_token);
  if (!refreshToken) throw new Error("xAI OAuth token expired and refresh_token is missing.");
  const discovery = state.discovery?.token_endpoint ? state.discovery as XaiOAuthDiscovery : await fetchDiscovery();
  const response = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: XAI_OAUTH_CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`xAI OAuth refresh failed: ${response.status} ${response.statusText} - ${body.slice(0, 400)}`);
  }
  const payload = await response.json() as Record<string, unknown>;
  const accessToken = cleanBearerToken(String(payload.access_token ?? ""));
  if (!accessToken) throw new Error("xAI OAuth refresh response did not include access_token.");
  const expiresIn = Number(payload.expires_in ?? 0);
  return {
    ...state,
    discovery,
    tokens: {
      access_token: accessToken,
      refresh_token: cleanBearerToken(String(payload.refresh_token ?? "")) ?? refreshToken,
      token_type: String(payload.token_type ?? "Bearer"),
      expires_in: Number.isFinite(expiresIn) ? expiresIn : undefined,
      expires_at: Number.isFinite(expiresIn) && expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : state.tokens?.expires_at,
    },
  };
}

async function fetchDiscovery(): Promise<XaiOAuthDiscovery> {
  const response = await fetch(XAI_OAUTH_DISCOVERY_URL, { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error(`xAI OIDC discovery failed: ${response.status} ${response.statusText}`);
  const payload = await response.json() as Partial<XaiOAuthDiscovery>;
  const tokenEndpoint = String(payload.token_endpoint ?? "");
  const parsed = new URL(tokenEndpoint);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith("x.ai")) {
    throw new Error("xAI OIDC discovery returned an invalid token endpoint.");
  }
  return { token_endpoint: tokenEndpoint };
}

function cleanBearerToken(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/^[`'"“”‘’]+|[`'"“”‘’]+$/g, "").trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/^Bearer\s+/i, "").trim() || undefined;
}

function accessTokenIsExpiring(accessToken: string, expiresAt: string | undefined): boolean {
  const explicitMs = expiresAt ? Date.parse(expiresAt) : NaN;
  if (Number.isFinite(explicitMs)) return explicitMs <= Date.now() + REFRESH_SKEW_SECONDS * 1000;
  const jwtMs = jwtExpiryMs(accessToken);
  return jwtMs !== undefined ? jwtMs <= Date.now() + REFRESH_SKEW_SECONDS * 1000 : false;
}

function jwtExpiryMs(token: string): number | undefined {
  const [, payload] = token.split(".");
  if (!payload) return undefined;
  try {
    const normalized = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    const json = JSON.parse(Buffer.from(normalized, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof json.exp === "number" ? json.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

function cleanBaseUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:" && parsed.hostname.endsWith("x.ai")) return value.replace(/\/+$/, "");
  } catch {
    // fall through
  }
  return "https://api.x.ai/v1";
}

