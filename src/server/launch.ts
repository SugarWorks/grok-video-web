import fs from "node:fs";
import { createServer } from "./server.js";
import { loadConfig } from "./config.js";
import { runXaiOauthLogin } from "./oauth-login.js";
import { resolveXaiAuth } from "./xai-auth.js";

const config = loadConfig();

await ensureAuthReady();

const { app } = createServer(config);
app.listen(config.port, config.host, () => {
  console.log(`Grok Video Studio is running: http://${config.host}:${config.port}`);
  if (config.accessToken) {
    console.log("ACCESS_TOKEN is configured; enter the value from .env in the browser gate.");
  } else {
    console.log("ACCESS_TOKEN is not set; API access is open to whoever can reach this host.");
  }
});

async function ensureAuthReady(): Promise<void> {
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
