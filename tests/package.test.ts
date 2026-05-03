import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("package entrypoints", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

  it("supports GitHub npx one-line install", () => {
    expect(packageJson.name).toBe("danaa-health-cards");
    expect(packageJson.scripts.prepare).toBe("npm run build");
    expect(packageJson.bin["danaa-health-cards"]).toBe("dist/index.js");
  });
});
