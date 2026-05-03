import { describe, expect, it } from "vitest";

import { redact } from "../src/security/redact.js";

describe("redact", () => {
  it("removes DANAA external tokens from text", () => {
    expect(redact("token=danaa_ext_secret")).not.toContain("danaa_ext_secret");
  });
});
