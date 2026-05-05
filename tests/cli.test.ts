import { afterEach, describe, expect, it, vi } from "vitest";

import { DanaaApiError } from "../src/api.js";
import { browserOpenCommand, codexPermissionGuide, loginInstructionLines, manualOpenInstruction, runCli, safeLoginUrl, skillTextForClient } from "../src/cli.js";

describe("login browser helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("explains Codex first-use MCP permission without claiming automatic bypass", () => {
    const guide = codexPermissionGuide();

    expect(guide).toContain("3. Always allow");
    expect(guide).toContain("does not bypass");
    expect(guide).toContain("DANAA MCP server");
    expect(guide).toContain("setup codex --manual-only");
  });

  it("keeps codex manual-only setup manual while still installing the skill", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runCli(["setup", "codex", "--manual-only", "--dry-run"]);

    const output = log.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(output).toContain("Would write codex skill");
    expect(output).toContain("Would remove DANAA Codex Stop hook");
    expect(output).not.toContain("Would add Codex Stop hook");
    expect(output).toContain("Setup complete in manual MCP mode");
  });

  it("keeps Codex skill from repeating visible MCP card results", () => {
    const codexSkill = skillTextForClient("codex");
    const claudeSkill = skillTextForClient("claude");

    expect(codexSkill).toContain("Treat that visible tool result as the card");
    expect(codexSkill).toContain("do not copy, rewrite, or repeat the card body");
    expect(codexSkill).not.toContain("show the returned text once");
    expect(claudeSkill).toContain("show the returned text once");
  });

  it("teaches Claude and Codex to use account management tools without exposing tokens", () => {
    const codexSkill = skillTextForClient("codex");
    const claudeSkill = skillTextForClient("claude");

    for (const skill of [codexSkill, claudeSkill]) {
      expect(skill).toContain("다나아 계정 변경");
      expect(skill).toContain("계정 전환해줘");
      expect(skill).toContain("Do not ask whether this is an app, DB, env, GitHub, or deployment account change");
      expect(skill).toContain("danaa_account_status");
      expect(skill).toContain("danaa_account_login_start");
      expect(skill).toContain("danaa_account_switch_start");
      expect(skill).toContain("danaa_account_login_finish");
      expect(skill).toContain("danaa_account_logout");
      expect(skill).toContain("Never ask for or print tokens");
    }
  });

  it("keeps skill descriptions short but explicit enough for Korean account triggers", () => {
    const codexSkill = skillTextForClient("codex");
    const descriptionLine = codexSkill.split("\n").find((line) => line.startsWith("description:"));

    expect(descriptionLine).toContain("질문카드");
    expect(descriptionLine).toContain("다나아 계정 변경");
    expect(descriptionLine).toContain("DANAA 연결 상태");
    expect(descriptionLine?.length ?? 0).toBeLessThanOrEqual(150);
  });
});
