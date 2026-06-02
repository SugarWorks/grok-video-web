import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const repoRoot = process.cwd();
const env = readEnv(path.join(repoRoot, ".env"));
const host = env.HOST || "127.0.0.1";
const port = env.PORT || "8787";
const token = env.ACCESS_TOKEN || "";
const url = new URL(`http://${host}:${port}/`);
if (token) url.searchParams.set("token", token);

const consoleErrors = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto(url.toString());
  await page.waitForLoadState("networkidle");
  await page.waitForSelector("text=Grok Video Studio", { timeout: 10_000 });
  await page.waitForSelector("text=动作预设", { timeout: 10_000 });
  await page.waitForSelector("text=开始生成", { timeout: 10_000 });
  await page.screenshot({ path: "/tmp/grok-video-web-smoke.png", fullPage: true });
  if (consoleErrors.length > 0) {
    throw new Error(`browser console errors: ${consoleErrors.join(" | ")}`);
  }
  console.log("smoke ok: /tmp/grok-video-web-smoke.png");
} finally {
  await browser.close();
}

function readEnv(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    result[match[1]] = match[2].trim();
  }
  return result;
}

