#!/usr/bin/env node
import fs from "node:fs";
import { Command } from "commander";
import { loadConfig } from "./config.js";
import { runGenCli } from "./gen.js";
import { runLoginCli } from "./login.js";
import { startServer } from "./serve.js";
import { resolveXaiAuth } from "./xai-auth.js";

const program = new Command();

program
  .name("grok-studio")
  .description("Self-hosted Grok image-to-video studio (web app + CLI).")
  .version(readVersion(), "-v, --version");

program
  .command("serve", { isDefault: true })
  .description("Start the web app (ensures xAI auth, then serves HTTP).")
  .option("--open", "open the browser after starting")
  .action(async (opts: { open?: boolean }) => {
    await startServer({ open: Boolean(opts.open) });
  });

program
  .command("login")
  .description("Run the xAI OAuth login.")
  .option("--live", "write to the live token file instead of the safe test path")
  .option("--output <path>", "token state file to write")
  .option("--force", "allow replacing an existing token file")
  .option("--check", "verify the selected token file without logging in")
  .option("--no-browser", "print the auth URL and wait instead of opening a browser")
  .option("--print-url-only", "print a disposable auth URL, then exit")
  .option("--port <number>", "local callback port", Number)
  .option("--timeout <seconds>", "login wait timeout", Number)
  .action(async (opts) => {
    await runLoginCli(opts);
  });

program
  .command("gen")
  .description("Headlessly turn an image into a video (no UI).")
  .requiredOption("--image <path>", "source image")
  .option("--prompt <text>", "motion prompt")
  .option("--prep", "run a first-frame prep pass before the video")
  .option("--duration <seconds>", "clip length", Number)
  .option("--resolution <res>", "e.g. 720p / 1080p")
  .option("--aspect <ratio>", "e.g. source / 9:16 / 16:9 / 1:1")
  .option("--count <n>", "number of takes", Number)
  .option("--out <path>", "write the result here (count>1 appends -N)")
  .action(async (opts) => {
    await runGenCli(opts);
  });

program
  .command("status")
  .description("Print config, xAI auth, and server health.")
  .action(async () => {
    await runStatus();
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

async function runStatus(): Promise<void> {
  const config = loadConfig();
  const browserHost = config.host === "0.0.0.0" || config.host === "::" ? "127.0.0.1" : config.host;
  console.log("Grok Studio status");
  console.log(`  url:        http://${browserHost}:${config.port}`);
  console.log(`  workspace:  ${config.workspaceDir}`);
  console.log(`  auth mode:  ${config.xai.authMode}`);
  console.log(`  access:     ${config.accessToken ? "token required" : "open (no ACCESS_TOKEN)"}`);
  try {
    const auth = await resolveXaiAuth(config);
    console.log(`  xAI auth:   ready (${auth.label})`);
  } catch (error) {
    console.log(
      `  xAI auth:   NOT ready — ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    const response = await fetch(`http://${browserHost}:${config.port}/health`);
    console.log(`  server:     ${response.ok ? "running" : `responded ${response.status}`}`);
  } catch {
    console.log("  server:     not running");
  }
}

function readVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}
