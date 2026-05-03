import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_DANAA_API_BASE, getApiBase, setApiBase } from "../src/api.js";

describe("api base", () => {
  const originalApiBase = process.env.DANAA_API_BASE;

  afterEach(() => {
    if (originalApiBase === undefined) {
      delete process.env.DANAA_API_BASE;
    } else {
      process.env.DANAA_API_BASE = originalApiBase;
    }
  });

  it("uses the deployed DANAA API by default", () => {
    delete process.env.DANAA_API_BASE;

    expect(getApiBase()).toBe(DEFAULT_DANAA_API_BASE);
  });

  it("allows explicit local override for development", () => {
    setApiBase("http://localhost:8000/api/v1/");

    expect(getApiBase()).toBe("http://localhost:8000/api/v1");
  });
});
