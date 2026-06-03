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
  await page.waitForSelector("text=Grok Studio", { timeout: 10_000 });
  await page.waitForSelector("text=Run Graph", { timeout: 10_000 });
  await page.waitForSelector(".result-node.source", { timeout: 10_000 });
  await page.waitForSelector("text=Drop / Paste / Select", { timeout: 10_000 });

  const jobs = await page.evaluate(async () => {
    const response = await fetch("/api/jobs");
    if (!response.ok) return [];
    return (await response.json()).jobs;
  });
  const legacyJobs = jobs.filter((job) => !job.inputFrame);
  if (legacyJobs[0]) {
    const card = page.locator(`.output-card[data-key="video:${legacyJobs[0].id}"]`);
    if ((await card.count()) > 0) {
      await card.first().click();
      // The legacy run surfaces as its own video node...
      await page.waitForSelector(".result-node.video", { timeout: 10_000 });
      // ...but a lineage-less run must not resurrect unrelated prep frame nodes.
      await page.waitForTimeout(500);
      const prepNodes = await page.locator(".result-node.prep").count();
      if (prepNodes !== 0) {
        throw new Error("legacy history run restored unrelated prep candidates");
      }
    }
  }

  // Switching to a different source's output must NOT string the previous
  // lineage into the new graph (lineage is data-derived, not a UI cache).
  if (legacyJobs[1]) {
    const firstId = legacyJobs[0].id;
    const secondCard = page.locator(`.output-card[data-key="video:${legacyJobs[1].id}"]`);
    if ((await secondCard.count()) > 0) {
      await secondCard.first().click();
      await page.waitForFunction(
        (staleId) => {
          const nodes = [...document.querySelectorAll(".result-node.video")];
          return (
            nodes.length > 0 &&
            !nodes.some((node) => node.textContent?.includes(staleId.slice(0, 6)))
          );
        },
        firstId,
        { timeout: 10_000 },
      );
    }
  }

  await page.evaluate(() => {
    const pngBytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      ),
      (char) => char.charCodeAt(0),
    );
    const file = new File([pngBytes], "pasted-smoke.png", { type: "image/png" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    window.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true }),
    );
  });
  await page.waitForSelector("text=Image pasted.", { timeout: 10_000 });
  await page.getByRole("button", { name: /Animate source/ }).click();
  await page.waitForSelector("text=Motion presets", { timeout: 10_000 });
  await page.waitForSelector("text=Raw prompt", { timeout: 10_000 });
  await page.waitForSelector("text=Run video", { timeout: 10_000 });
  await page.locator(".preview-image").first().click();
  await page.waitForSelector(".yarl__container", { timeout: 10_000 });
  await page.keyboard.press("Escape");
  await page.waitForSelector(".yarl__container", { state: "detached", timeout: 10_000 });
  const videoCardScrollTop = await page.evaluate(() => {
    const card = document.querySelector(".video-card");
    if (!card) return 0;
    card.scrollTop = 120;
    return card.scrollTop;
  });
  if (videoCardScrollTop !== 0) {
    throw new Error("video card has internal scroll");
  }
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
