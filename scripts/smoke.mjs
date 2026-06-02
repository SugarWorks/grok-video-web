import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const repoRoot = process.cwd();
const env = readEnv(path.join(repoRoot, ".env"));
const host = env.HOST || "127.0.0.1";
const port = env.PORT || "8787";
const token = env.ACCESS_TOKEN || "";
const browserHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
const url = new URL(`http://${browserHost}:${port}/`);
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
  await page.waitForSelector("text=原始 Prompt", { timeout: 10_000 });
  await page.waitForSelector("text=先添加图片", { timeout: 10_000 });
  await page.evaluate(() => {
    const pngBytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="), (char) => char.charCodeAt(0));
    const file = new File([pngBytes], "pasted-smoke.png", { type: "image/png" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true }));
  });
  await page.waitForSelector('img[alt="source preview"]', { timeout: 10_000 });
  await page.waitForSelector("text=已从剪贴板粘贴图片。", { timeout: 10_000 });
  await page.waitForSelector("text=生成视频", { timeout: 10_000 });
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
