import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearLatestCard, getStatePath, readState, rememberLatestCard, writeState } from "../src/local-state.js";

describe("local state", () => {
  let stateDir: string;
  const originalHome = process.env.DANAA_HEALTH_CARDS_HOME;

  beforeEach(() => {
    stateDir = mkdtempSync(path.join(os.tmpdir(), "danaa-health-cards-"));
    process.env.DANAA_HEALTH_CARDS_HOME = stateDir;
  });

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.DANAA_HEALTH_CARDS_HOME;
    } else {
      process.env.DANAA_HEALTH_CARDS_HOME = originalHome;
    }
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("remembers the latest lease without storing tokens or answers", () => {
    rememberLatestCard({
      has_question: true,
      lease_id: "lease-1",
      bundle_key: "bundle_1",
      bundle_name: "Sleep",
      log_date: "2026-05-04",
      expires_at: "2026-05-04T12:00:00+09:00",
      questions: [
        {
          field: "sleep_quality",
          summary_label: "Sleep quality",
          text: "How was your sleep?",
          input_type: "select",
          options: ["good", "normal", "bad"]
        }
      ],
      notice: "Lifestyle check-in only"
    });

    const state = readState();
    const rawState = readFileSync(getStatePath(), "utf8");

    expect(state.latestLeaseId).toBe("lease-1");
    expect(rawState).not.toContain("DANAA_HEALTH_TOKEN");
    expect(rawState).not.toContain("test-token");
    expect(rawState).not.toContain("user_confirmed");
  });

  it("clears only the matching latest lease", () => {
    writeState({ latestLeaseId: "lease-1", latestCard: { has_question: false, questions: [], notice: "none" } });

    clearLatestCard("lease-2");
    expect(readState().latestLeaseId).toBe("lease-1");

    clearLatestCard("lease-1");
    expect(readState().latestLeaseId).toBeUndefined();
    expect(readState().latestCard).toBeUndefined();
  });
});
