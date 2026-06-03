import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";

const root = path.resolve(import.meta.dirname, "..");

describe("frontend architecture guardrails", () => {
  it("keeps the main app shell thin", () => {
    const app = readSource("src/client/App.tsx");

    expect(lineCount(app)).toBeLessThanOrEqual(520);
    expect(
      countMatches(app, /\buseState\s*</g) + countMatches(app, /\buseState\s*\(/g),
    ).toBeLessThanOrEqual(8);
    expect(countMatches(app, /\buseEffect\s*\(/g)).toBeLessThanOrEqual(5);
  });

  it("keeps stylesheet ownership split by surface", () => {
    expect(lineCount(readSource("src/client/styles.css"))).toBeLessThanOrEqual(900);
  });

  it("keeps server route files focused", () => {
    expect(lineCount(readSource("src/server/server.ts"))).toBeLessThanOrEqual(260);
  });
});

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function lineCount(source: string) {
  return source.split(/\r?\n/).length;
}

function countMatches(source: string, pattern: RegExp) {
  return [...source.matchAll(pattern)].length;
}
