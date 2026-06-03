import { execFile } from "node:child_process";
import fs from "node:fs";
import { loadConfig, type AppConfig } from "./config.js";
import { runXaiOauthLogin } from "./oauth-login.js";
import { createServer } from "./server.js";
import { resolveXaiAuth } from "./xai-auth.js";

export async function startServer(options: { open?: boolean } = {}): Promise<void> {
  const config = loadConfig();
  await ensureAuthReady(config);

  const { app } = createServer(config);
  app.listen(config.port, config.host, () => {
    const url = `http://${config.host}:${config.port}`;
    console.log(`Grok Studio is running: ${url}`);
    if (config.accessToken) {
      console.log("ACCESS_TOKEN is configured; enter the value from .env in the browser gate.");
    } else {
      console.log("ACCESS_TOKEN is not set; API access is open to whoever can reach this host.");
    }
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
    console.log(`xAI OAuth ready: ${config.xai.oauthTokenFile}`);
    return;
  } catch (error) {
    if (fs.existsSync(config.xai.oauthTokenFile)) {
      console.warn(
        `xAI OAuth token check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      console.warn("Starting OAuth login to repair the token state.");
    } else {
      console.log(`No xAI OAuth token found at ${config.xai.oauthTokenFile}. Starting login.`);
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
