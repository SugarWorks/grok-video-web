import { execFile } from "node:child_process";
import fs from "node:fs";
import * as clack from "@clack/prompts";
import { loadConfig, type AppConfig } from "./config.js";
import { runXaiOauthLogin } from "./oauth-login.js";
import { createServer } from "./server.js";
import { resolveXaiAuth } from "./xai-auth.js";

export async function startServer(options: { open?: boolean } = {}): Promise<void> {
  clack.intro("Grok Studio");
  const config = loadConfig();
  await ensureAuthReady(config);

  const { app } = createServer(config);
  app.listen(config.port, config.host, () => {
    const host = config.host === "0.0.0.0" || config.host === "::" ? "127.0.0.1" : config.host;
    const url = `http://${host}:${config.port}`;
    const access = config.accessToken
      ? "Access: token required (set in .env)"
      : "Access: open — no ACCESS_TOKEN set";
    clack.note(`${url}\n${access}`, "Running");
    clack.outro("Press Ctrl+C to stop.");
    if (options.open) openBrowser(url);
  });
}

async function ensureAuthReady(config: AppConfig): Promise<void> {
  if (config.xai.authMode === "api_key") {
    if (!config.xai.apiKey) throw new Error("XAI_API_KEY is required when XAI_AUTH_MODE=api_key.");
    return;
  }
  try {
    await resolveXaiAuth(config);
    clack.log.success(`xAI OAuth ready (${config.xai.oauthTokenFile})`);
    return;
  } catch (error) {
    if (fs.existsSync(config.xai.oauthTokenFile)) {
      clack.log.warn(
        `xAI token check failed: ${error instanceof Error ? error.message : String(error)} — re-running login.`,
      );
    } else {
      clack.log.info("No xAI token found — starting login.");
    }
  }
  await runXaiOauthLogin({ outputPath: config.xai.oauthTokenFile });
  await resolveXaiAuth(config);
}

function openBrowser(url: string): void {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  execFile(command, [url], (error) => {
    if (error) console.warn(`Could not open browser: ${error.message}`);
  });
}
