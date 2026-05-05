import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearAccountState,
  clearLatestCard,
  clearPendingDeviceLogin,
  completeLatestCard,
  getStatePath,
  isFuture,
  readState,
  rememberLatestCard,
  rememberPendingDeviceLogin,
  suppressAutoForMinutes,
  writeState
} from "../src/local-state.js";

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

  it("stores a temporary automatic prompt suppression timestamp", () => {
    suppressAutoForMinutes(10);

    expect(isFuture(readState().autoSuppressedUntil)).toBe(true);
  });

  it("clears a completed lease and suppresses the next automatic card in one state update", () => {
    rememberLatestCard({
      has_question: true,
      lease_id: "lease-complete",
      bundle_key: "bundle_1",
      bundle_name: "Sleep",
      log_date: "2026-05-04",
      expires_at: "2099-01-01T00:00:00+09:00",
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

    completeLatestCard("lease-complete", 10);

    const state = readState();
    expect(state.latestLeaseId).toBeUndefined();
    expect(state.latestCard).toBeUndefined();
    expect(isFuture(state.autoSuppressedUntil)).toBe(true);
  });

  it("uses a short default suppression after completing a card", () => {
    rememberLatestCard({
      has_question: true,
      lease_id: "lease-short-suppress",
      bundle_key: "bundle_1",
      bundle_name: "Sleep",
      log_date: "2026-05-04",
      expires_at: "2099-01-01T00:00:00+09:00",
      questions: [],
      notice: "Lifestyle check-in only"
    });

    const before = Date.now();
    completeLatestCard("lease-short-suppress");
    const suppressMs = Date.parse(readState().autoSuppressedUntil ?? "") - before;

    expect(suppressMs).toBeGreaterThan(0);
    expect(suppressMs).toBeLessThanOrEqual(30_000);
  });

  it("stores and clears a pending device login without storing tokens", () => {
    rememberPendingDeviceLogin({
      deviceCode: "device-secret",
      userCode: "ABCD-EFGH",
      verificationUri: "https://danaa-project.vercel.app/settings/integrations/danaa-health-cards",
      expiresIn: 600,
      intervalSeconds: 5
    });

    const rawState = readFileSync(getStatePath(), "utf8");
    expect(readState().pendingDeviceLogin?.userCode).toBe("ABCD-EFGH");
    expect(rawState).not.toContain("access_token");
    expect(rawState).not.toContain("DANAA_HEALTH_TOKEN");

    clearPendingDeviceLogin();
    expect(readState().pendingDeviceLogin).toBeUndefined();
  });

  it("clears account-specific local state when disconnecting", () => {
    writeState({
      installedAt: "2026-05-05T00:00:00.000Z",
      latestLeaseId: "old-account-lease",
      latestCard: { has_question: false, questions: [], notice: "old" },
      snoozeUntil: "2099-01-01T00:00:00.000Z",
      pendingDeviceLogin: {
        deviceCode: "old-device",
        userCode: "OLD",
        verificationUri: "https://danaa-project.vercel.app/settings/integrations/danaa-health-cards",
        expiresAt: "2099-01-01T00:00:00.000Z",
        intervalSeconds: 5
      }
    });

    const state = clearAccountState();

    expect(state.installedAt).toBe("2026-05-05T00:00:00.000Z");
    expect(state.latestLeaseId).toBeUndefined();
    expect(state.latestCard).toBeUndefined();
    expect(state.snoozeUntil).toBeUndefined();
    expect(state.pendingDeviceLogin).toBeUndefined();
  });
});
