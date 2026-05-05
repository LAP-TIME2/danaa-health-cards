import { afterEach, describe, expect, it, vi } from "vitest";

import {
  answerCheckin,
  DEFAULT_DANAA_API_BASE,
  exchangeDeviceToken,
  getApiBase,
  setApiBase,
  skipCheckin,
  snoozeCheckin,
  startDeviceLogin
} from "../src/api.js";

describe("api base", () => {
  const originalApiBase = process.env.DANAA_API_BASE;
  const originalToken = process.env.DANAA_HEALTH_TOKEN;

  afterEach(() => {
    if (originalApiBase === undefined) {
      delete process.env.DANAA_API_BASE;
    } else {
      process.env.DANAA_API_BASE = originalApiBase;
    }
    if (originalToken === undefined) {
      delete process.env.DANAA_HEALTH_TOKEN;
    } else {
      process.env.DANAA_HEALTH_TOKEN = originalToken;
    }
    vi.restoreAllMocks();
  });

  it("uses the deployed DANAA API by default", () => {
    delete process.env.DANAA_API_BASE;

    expect(getApiBase()).toBe(DEFAULT_DANAA_API_BASE);
    expect(getApiBase()).toBe("https://danaa.r-e.kr/api/v1");
  });

  it("allows explicit local override for development", () => {
    setApiBase("http://localhost:8000/api/v1/");

    expect(getApiBase()).toBe("http://localhost:8000/api/v1");
  });

  it("submits explicit user confirmation when answering or skipping", async () => {
    process.env.DANAA_HEALTH_TOKEN = "test-token";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "saved", saved_fields: [], skipped_fields: [], message: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "skipped", saved_fields: [], skipped_fields: [], message: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );

    await answerCheckin("lease-1", { sleep_quality: "good" }, "idem-1");
    await skipCheckin("lease-2", "idem-2");

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      lease_id: "lease-1",
      answers: { sleep_quality: "good" },
      user_confirmed: true
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      lease_id: "lease-2",
      skip: true,
      user_confirmed: true
    });
  });

  it("calls the snooze endpoint with an allowed duration", async () => {
    process.env.DANAA_HEALTH_TOKEN = "test-token";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "snoozed", snoozed_until: "2026-05-04T12:00:00+09:00", message: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await snoozeCheckin(60);

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://danaa.r-e.kr/api/v1/external/checkins/snooze");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ duration_minutes: 60 });
  });

  it("starts and finishes device login without requiring an existing token", async () => {
    delete process.env.DANAA_HEALTH_TOKEN;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            device_code: "device-code",
            user_code: "ABCD-EFGH",
            verification_uri: "https://danaa-project.vercel.app/settings/integrations/danaa-health-cards",
            expires_in: 600,
            interval: 5
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "new-token", expires_in: 3600, scopes: ["checkin"] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );

    await startDeviceLogin("DANAA Health Cards MCP");
    await exchangeDeviceToken("device-code");

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://danaa.r-e.kr/api/v1/external-auth/device/start");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      client_name: "DANAA Health Cards MCP",
      client_type: "cli"
    });
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("https://danaa.r-e.kr/api/v1/external-auth/device/token");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ device_code: "device-code" });
  });
});
