import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./config.js";
import { runXaiOauthLogin } from "./oauth-login.js";
import { resolveXaiAuth } from "./xai-auth.js";

type LoginCliArgs = {
  output?: string;
  force: boolean;
  noBrowser: boolean;
  check: boolean;
  printUrlOnly: boolean;
  port?: number;
  timeoutSeconds?: number;
};

const args = parseArgs(process.argv.slice(2));
const config = loadConfig();

if (config.xai.authMode !== "oauth") {
  throw new Error("Grok login flow only applies when XAI_AUTH_MODE=oauth.");
}

const outputPath = path.resolve(expandHome(args.output ?? config.xai.oauthTokenFile));
const authConfig = { ...config, xai: { ...config.xai, oauthTokenFile: outputPath } };

if (args.check) {
  const auth = await resolveXaiAuth(authConfig);
  console.log(`xAI OAuth ready: ${outputPath}`);
  console.log(`Auth mode: ${auth.label}`);
  console.log(`Base URL: ${auth.baseUrl}`);
  process.exit(0);
}

if (fs.existsSync(outputPath) && !args.force && !args.printUrlOnly) {
  console.error(`Refusing to overwrite existing token state: ${outputPath}`);
  console.error("Pass --force to refresh this token file, or --output <path> to test into a separate file.");
  process.exit(1);
}

await runXaiOauthLogin({
  outputPath,
  noBrowser: args.noBrowser,
  port: args.port,
  timeoutSeconds: args.timeoutSeconds,
  printUrlOnly: args.printUrlOnly,
});

if (!args.printUrlOnly) {
  await resolveXaiAuth(authConfig);
  console.log("xAI OAuth token verified with the API.");
}

function parseArgs(values: string[]): LoginCliArgs {
  const parsed: LoginCliArgs = {
    force: false,
    noBrowser: false,
    check: false,
    printUrlOnly: false,
  };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    }
    if (value === "--force") {
      parsed.force = true;
      continue;
    }
    if (value === "--no-browser") {
      parsed.noBrowser = true;
      continue;
    }
    if (value === "--check") {
      parsed.check = true;
      continue;
    }
    if (value === "--print-url-only") {
      parsed.printUrlOnly = true;
      parsed.noBrowser = true;
      continue;
    }
    if (value === "--output") {
      parsed.output = requireValue(values, index, value);
      index += 1;
      continue;
    }
    if (value === "--port") {
      parsed.port = parseInteger(requireValue(values, index, value), value);
      index += 1;
      continue;
    }
    if (value === "--timeout") {
      parsed.timeoutSeconds = parseInteger(requireValue(values, index, value), value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }
  return parsed;
}

function printHelp(): void {
  console.log(`Usage: npm run login:grok -- [options]

Options:
  --output <path>       Token state file to write. Defaults to XAI_OAUTH_TOKEN_FILE.
  --force               Allow replacing an existing token state file.
  --check               Verify the selected token file without opening login.
  --no-browser          Print the auth URL and wait instead of opening a browser.
  --print-url-only      Print a disposable auth URL for smoke testing, then exit.
  --port <number>       Local callback port. Default: 56121.
  --timeout <seconds>   Login wait timeout. Default: 600.

Safe test example:
  npm run login:grok -- --output ~/.grok-video-web/login-test/xai-oauth.json
`);
}

function requireValue(values: string[], index: number, flag: string): string {
  const next = values[index + 1];
  if (!next || next.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return next;
}

function parseInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} requires a positive integer.`);
  return parsed;
}

function expandHome(value: string): string {
  if (value === "~") return process.env.HOME ?? process.cwd();
  if (value.startsWith("~/")) return path.join(process.env.HOME ?? process.cwd(), value.slice(2));
  return value;
}
