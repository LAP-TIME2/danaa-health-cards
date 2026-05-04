import { describe, expect, it } from "vitest";

import { DanaaApiError } from "../src/api.js";
import { browserOpenCommand, loginInstructionLines, manualOpenInstruction, safeLoginUrl } from "../src/cli.js";

describe("login browser helpers", () => {
  it("builds an OS browser command only for safe web URLs", () => {
    const command = browserOpenCommand("https://danaa-project.vercel.app/settings/integrations/danaa-health-cards");

    expect(command.command.length).toBeGreaterThan(0);
    expect(command.args.join(" ")).toContain("https://danaa-project.vercel.app/settings/integrations/danaa-health-cards");
  });

  it("rejects non-web URLs before launching a process", () => {
    expect(() => browserOpenCommand("file:///C:/Windows/System32/calc.exe")).toThrow(DanaaApiError);
    expect(() => browserOpenCommand("javascript:alert(1)")).toThrow(DanaaApiError);
  });

  it("rejects untrusted or insecure login hosts", () => {
    expect(() => safeLoginUrl("https://evil.example.com/login")).toThrow(DanaaApiError);
    expect(() => safeLoginUrl("http://danaa-project.vercel.app/settings/integrations/danaa-health-cards")).toThrow(DanaaApiError);
    expect(safeLoginUrl("http://localhost:8000/settings/integrations/danaa-health-cards")).toContain("http://localhost:8000");
  });

  it("rejects login URLs that contain secret-looking query parameters", () => {
    expect(() => safeLoginUrl("https://danaa-project.vercel.app/settings/integrations/danaa-health-cards?token=secret")).toThrow(DanaaApiError);
    expect(() => safeLoginUrl("https://danaa-project.vercel.app/settings/integrations/danaa-health-cards?user_code=ABCD")).toThrow(DanaaApiError);
    expect(() => safeLoginUrl("https://danaa-project.vercel.app/settings/integrations/danaa-health-cards?utm_source=cli")).not.toThrow();
  });

  it("prints a URL fallback, not a shell command", () => {
    const instruction = manualOpenInstruction("https://danaa-project.vercel.app/settings/integrations/danaa-health-cards");

    expect(instruction).toContain("https://danaa-project.vercel.app/settings/integrations/danaa-health-cards");
    expect(instruction).not.toMatch(/Start-Process|powershell|cmd \/c|xdg-open|^open /iu);
  });

  it("always includes a copy fallback and explains the waiting dots", () => {
    const lines = loginInstructionLines("https://danaa-project.vercel.app/settings/integrations/danaa-health-cards", "ABCD-EFGH", "opened");

    expect(lines.join("\n")).toContain("Browser open requested");
    expect(lines.join("\n")).toContain("Copy this URL");
    expect(lines.join("\n")).toContain("ABCD-EFGH");
    expect(lines.join("\n")).toContain("Dots mean");
  });
});
