import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./config.js";
import { runXaiOauthLogin } from "./oauth-login.js";
import { resolveXaiAuth } from "./xai-auth.js";

const DEFAULT_TEST_TOKEN_FILE = "~/.grok-video-web/login-test/xai-oauth.json";

export type LoginOptions = {
  live?: boolean;
  output?: string;
  force?: boolean;
  check?: boolean;
  browser?: boolean;
  printUrlOnly?: boolean;
  port?: number;
  timeout?: number;
};

export async function runLoginCli(opts: LoginOptions): Promise<void> {
  const config = loadConfig();
  if (config.xai.authMode !== "oauth") {
    throw new Error("Grok login flow only applies when XAI_AUTH_MODE=oauth.");
  }

  const outputPath = path.resolve(
    expandHome(opts.output ?? (opts.live ? config.xai.oauthTokenFile : DEFAULT_TEST_TOKEN_FILE)),
  );
  const authConfig = { ...config, xai: { ...config.xai, oauthTokenFile: outputPath } };

  if (opts.check) {
    const auth = await resolveXaiAuth(authConfig);
    console.log(`xAI OAuth ready: ${outputPath}`);
    console.log(`Auth mode: ${auth.label}`);
    console.log(`Base URL: ${auth.baseUrl}`);
    return;
  }

  if (
    fs.existsSync(outputPath) &&
    !opts.force &&
    !opts.printUrlOnly &&
    (opts.live || opts.output)
  ) {
    throw new Error(
      `Refusing to overwrite existing token state: ${outputPath}. Pass --force to refresh it.`,
    );
  }

  await runXaiOauthLogin({
    outputPath,
    noBrowser: opts.browser === false,
    port: opts.port,
    timeoutSeconds: opts.timeout,
    printUrlOnly: opts.printUrlOnly,
  });

  if (!opts.printUrlOnly) {
    await resolveXaiAuth(authConfig);
    console.log("xAI OAuth token verified with the API.");
  }
}

function expandHome(value: string): string {
  if (value === "~") return process.env.HOME ?? process.cwd();
  if (value.startsWith("~/")) return path.join(process.env.HOME ?? process.cwd(), value.slice(2));
  return value;
}
