#!/usr/bin/env node
import fs from "node:fs";
import { loadConfig } from "./config.js";
import { runGenCli } from "./gen.js";
import { runLoginCli } from "./login.js";
import { startServer } from "./serve.js";
import { resolveXaiAuth } from "./xai-auth.js";

const [command, ...rest] = process.argv.slice(2);

try {
  switch (command) {
    case undefined:
    case "serve":
      await startServer({ open: rest.includes("--open") });
      break;
    case "login":
      await runLoginCli(rest);
      break;
    case "gen":
      await runGenCli(rest);
      break;
    case "status":
      await runStatus();
      break;
    case "-v":
    case "--version":
      console.log(readVersion());
      break;
    case "-h":
    case "--help":
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      printHelp();
      process.exit(1);
  }
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

function printHelp(): void {
  console.log(`Grok Studio — self-hosted image-to-video studio

Usage: grok-studio <command> [options]

Commands:
  serve            Start the web app (default). Ensures xAI auth, then serves HTTP.
                     --open   open the browser after starting
  login [options]  Run the xAI OAuth login (see: grok-studio login --help)
  gen [options]    Headlessly turn an image into a video (see: grok-studio gen --help)
  status           Print config, xAI auth, and server health
  --version, -v    Print the version
  --help, -h       Print this help
`);
}
