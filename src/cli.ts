#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  answerCheckin,
  DanaaApiError,
  danaaFetch,
  getApiBase,
  getSettings,
  nextCheckin,
  revokeExternalToken,
  setApiBase,
  skipCheckin,
  snoozeCheckin,
  type DanaaNextCheckin
} from "./api.js";
import { formatCard } from "./format.js";
import { runStopHook } from "./hook.js";
import { completeLatestCard, ensureInstalledAt, getDataDir, readState, rememberLatestCard, updateState } from "./local-state.js";
import { redact } from "./security/redact.js";
import { deleteStoredToken, saveStoredToken, TokenStoreError } from "./token-store.js";

type DeviceStart = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

type DeviceToken = {
  access_token: string;
  expires_in: number;
  scopes: string[];
};

type SetupScope = "user" | "local";

type CliOptions = {
  command: string;
  rest: string[];
  dryRun: boolean;
  force: boolean;
  manualOnly: boolean;
  noOpen: boolean;
  scope: SetupScope;
};

const MCP_NAME = "danaa-health-cards";
const GITHUB_PACKAGE = "github:LAP-TIME2/danaa-health-cards";
const AFTER_ANSWER_AUTO_SUPPRESS_MINUTES = 10;
const ALLOWED_HTTPS_LOGIN_HOSTS = new Set(["danaa-project.vercel.app", "danaa.r-e.kr"]);
const ALLOWED_LOCAL_LOGIN_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const SENSITIVE_LOGIN_QUERY_KEY = /(?:^|_|\b)(access[_-]?token|refresh[_-]?token|token|jwt|secret|session|cookie|email|device[_-]?code|user[_-]?code)(?:$|_|\b)/iu;
const CLAUDE_SKILL_TEXT = `---
name: danaa-checkin
description: DANAA health check-in cards and number answers.
---

# DANAA Check-in

- Use DANAA tools quietly. Do not mention tool names, MCP, lease IDs, cache, internal IDs, or implementation details to the user.
- If the user asks for a health check-in card, says "질문카드 보여줘", "질문카드 줘", "남아있어?", "아직 할 게 남았어?", or asks whether any cards remain, call \`danaa_checkin_next\` and show the returned text once.
- Do not use \`danaa_checkin_status\` to answer whether cards remain. Status is only local automation state, not the server's remaining-card result.
- If the user answers with numbers such as "1", "2 1", or "1,2", call \`danaa_checkin_answer_latest_numbers\` with the numbers in order.
- If the user says skip, 스킵, 건너뛰기, call \`danaa_checkin_skip_latest\`.
- If the user says 30분 뒤, 1시간 뒤, 2시간 뒤, 오늘 그만, call \`danaa_checkin_snooze\`.
- Never infer health answers from the surrounding coding conversation.
- Never ask for or print tokens. DANAA tokens live in the OS keyring.
- Keep wording short and say this is lifestyle tracking, not medical advice.
`;

const CODEX_SKILL_TEXT = `---
name: danaa-checkin
description: DANAA health check-in cards and number answers.
---

# DANAA Check-in

- Use DANAA tools quietly. Do not mention tool names, MCP, lease IDs, cache, internal IDs, or implementation details to the user.
- Do not run shell commands to read this skill file. Follow these rules directly.
- If the user asks for a health check-in card, says "질문카드 보여줘", "질문카드 줘", "남아있어?", "아직 할 게 남았어?", or asks whether any cards remain, call \`danaa_checkin_next\`.
- Codex shows the tool result in the transcript. Treat that visible tool result as the card; do not copy, rewrite, or repeat the card body in your assistant message.
- After \`danaa_checkin_next\`, reply only with a short line such as: "위 카드에 번호로 답해주세요. 예: 1, 2. 건너뛰려면 건너뛰기라고 말해주세요."
- Do not use \`danaa_checkin_status\` to answer whether cards remain. Status is only local automation state, not the server's remaining-card result.
- If the user answers with numbers such as "1", "2 1", or "1,2", call \`danaa_checkin_answer_latest_numbers\` with the numbers in order.
- If the user says skip, 스킵, 건너뛰기, call \`danaa_checkin_skip_latest\`.
- If the user says 30분 뒤, 1시간 뒤, 2시간 뒤, 오늘 그만, call \`danaa_checkin_snooze\`.
- Never infer health answers from the surrounding coding conversation.
- Never ask for or print tokens. DANAA tokens live in the OS keyring.
- Keep wording short and say this is lifestyle tracking, not medical advice.
`;

export function skillTextForClient(client: "claude" | "codex"): string {
  return client === "codex" ? CODEX_SKILL_TEXT : CLAUDE_SKILL_TEXT;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(args: string[]): CliOptions {
  const rest: string[] = [];
  let command = "help";
  let dryRun = false;
  let force = false;
  let manualOnly = false;
  let noOpen = false;
  let scope: SetupScope = "user";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg === "--manual-only") {
      manualOnly = true;
      continue;
    }
    if (arg === "--no-open") {
      noOpen = true;
      continue;
    }
    if (arg === "--scope") {
      const value = args[index + 1];
      if (value !== "user" && value !== "local") {
        throw new DanaaApiError("--scope must be user or local", 400, { option: "--scope" });
      }
      scope = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--scope=")) {
      const value = arg.slice("--scope=".length);
      if (value !== "user" && value !== "local") {
        throw new DanaaApiError("--scope must be user or local", 400, { option: "--scope" });
      }
      scope = value;
      continue;
    }
    if (arg === "--api-base") {
      const value = args[index + 1];
      if (!value) {
        throw new DanaaApiError("Missing value for --api-base", 400, { option: "--api-base" });
      }
      setApiBase(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--api-base=")) {
      setApiBase(arg.slice("--api-base=".length));
      continue;
    }
    if (command === "help") {
      command = arg;
    } else {
      rest.push(arg);
    }
  }

  return { command, rest, dryRun, force, manualOnly, noOpen, scope };
}

export function safeLoginUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new DanaaApiError("DANAA login URL is invalid.", 500, {
      error_code: "INVALID_LOGIN_URL"
    });
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new DanaaApiError("DANAA login URL must be http or https.", 500, {
      error_code: "UNSAFE_LOGIN_URL"
    });
  }

  const isLocalHost = ALLOWED_LOCAL_LOGIN_HOSTS.has(parsed.hostname);
  const isDanaaHttpsHost = ALLOWED_HTTPS_LOGIN_HOSTS.has(parsed.hostname);
  if (!isLocalHost && !isDanaaHttpsHost) {
    throw new DanaaApiError("DANAA login URL host is not allowed.", 500, {
      error_code: "UNTRUSTED_LOGIN_URL_HOST"
    });
  }
  if (!isLocalHost && parsed.protocol !== "https:") {
    throw new DanaaApiError("DANAA login URL must use https outside local development.", 500, {
      error_code: "INSECURE_LOGIN_URL"
    });
  }
  for (const key of parsed.searchParams.keys()) {
    if (SENSITIVE_LOGIN_QUERY_KEY.test(key)) {
      throw new DanaaApiError("DANAA login URL must not contain sensitive query values.", 500, {
        error_code: "SENSITIVE_LOGIN_URL"
      });
    }
  }
  return parsed.toString();
}

export function browserOpenCommand(url: string): { command: string; args: string[] } {
  const safeUrl = safeLoginUrl(url);
  if (process.platform === "win32") {
    return { command: "rundll32.exe", args: ["url.dll,FileProtocolHandler", safeUrl] };
  }
  if (process.platform === "darwin") {
    return { command: "open", args: [safeUrl] };
  }
  return { command: "xdg-open", args: [safeUrl] };
}

export function manualOpenInstruction(url: string): string {
  return `Copy this URL into the browser you want to use: ${safeLoginUrl(url)}`;
}

function openBrowser(url: string): boolean {
  try {
    const { command, args } = browserOpenCommand(url);
    const opened = spawnSync(command, args, {
      encoding: "utf8",
      stdio: "ignore",
      timeout: 10_000,
      windowsHide: true
    });
    return opened.status === 0;
  } catch {
    return false;
  }
}

export function loginInstructionLines(
  verificationUri: string,
  userCode: string,
  state: "opened" | "failed" | "skipped"
): string[] {
  const safeUri = safeLoginUrl(verificationUri);
  const firstLine =
    state === "opened"
      ? `1. Browser open requested: ${safeUri}`
      : state === "skipped"
        ? `1. Browser auto-open skipped: ${safeUri}`
        : `1. Browser auto-open failed. Open this URL manually: ${safeUri}`;
  return [
    firstLine,
    `   If the browser did not open or opened in the wrong profile, ${manualOpenInstruction(safeUri)}`,
    `2. Enter code: ${userCode}`,
    "3. After approving in DANAA, keep this terminal open.",
    "   Dots mean the CLI is waiting for browser approval. If the code expires, rerun the same setup command."
  ];
}

async function login(options: Pick<CliOptions, "noOpen"> = { noOpen: false }): Promise<void> {
  const start = await danaaFetch<DeviceStart>("/external-auth/device/start", {
    method: "POST",
    body: { client_name: "DANAA Health Cards CLI", client_type: "cli" }
  });
  console.log("DANAA device login");
  const browserOpened = options.noOpen ? false : openBrowser(start.verification_uri);
  loginInstructionLines(start.verification_uri, start.user_code, options.noOpen ? "skipped" : browserOpened ? "opened" : "failed").forEach((line) =>
    console.log(line)
  );

  const deadline = Date.now() + start.expires_in * 1000;
  while (Date.now() < deadline) {
    await sleep(start.interval * 1000);
    try {
      const token = await danaaFetch<DeviceToken>("/external-auth/device/token", {
        method: "POST",
        body: { device_code: start.device_code }
      });
      console.log("");
      console.log("Login approved.");
      try {
        saveStoredToken(token.access_token);
      } catch (error) {
        if (error instanceof TokenStoreError) {
          throw new DanaaApiError(
            "DANAA token could not be saved to the OS keyring. Run `danaa-health-cards doctor`.",
            500,
            { error_code: "TOKEN_KEYRING_UNAVAILABLE" }
          );
        }
        throw error;
      }
      ensureInstalledAt();
      console.log("DANAA token saved to your OS keyring.");
      console.log("No token was printed or written to Claude/Codex config.");
      return;
    } catch (error) {
      if (error instanceof DanaaApiError && error.status === 428) {
        process.stdout.write(".");
        continue;
      }
      throw error;
    }
  }
  throw new DanaaApiError("Device login expired. Please run setup or login again.", 408, {
    error_code: "DEVICE_LOGIN_EXPIRED"
  });
}

async function hasReusableToken(): Promise<boolean> {
  try {
    await getSettings();
    return true;
  } catch {
    return false;
  }
}

async function checkin(): Promise<void> {
  const card: DanaaNextCheckin = await nextCheckin();
  if (card.has_question) rememberLatestCard(card);
  console.log(formatCard(card));
}

function quoteCmdArg(value: string): string {
  if (!/[\s"]/u.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function quoteHookArg(value: string): string {
  const normalized = process.platform === "win32" && /^[A-Za-z]:[\\/]/u.test(value) ? value.replace(/\\/g, "/") : value;
  if (process.platform === "win32" && /^[A-Za-z]:\//u.test(normalized)) {
    return `"${normalized.replace(/"/g, '\\"')}"`;
  }
  return quoteCmdArg(normalized);
}

function formatShellCommand(command: string, args: string[]): string {
  return [command, ...args].map(quoteCmdArg).join(" ");
}

function runCommand(command: string, args: string[]): { ok: boolean; output: string } {
  const spawned =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/c", formatShellCommand(command, args)], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"]
        })
      : spawnSync(command, args, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"]
        });
  const output = `${spawned.stdout ?? ""}${spawned.stderr ?? ""}`;
  return { ok: spawned.status === 0, output };
}

function getRunnerDir(): string {
  return path.join(getDataDir(), "runner");
}

function getRunnerEntry(): string {
  return path.join(getRunnerDir(), "node_modules", "danaa-health-cards", "dist", "index.js");
}

function ensureLocalRunner(options: Pick<CliOptions, "dryRun">): string {
  const runnerEntry = getRunnerEntry();
  if (options.dryRun) {
    console.log(`[dry-run] Would install stable runner under: ${getRunnerDir()}`);
    console.log(`[dry-run] Would use runner entry: ${runnerEntry}`);
    return runnerEntry;
  }
  mkdirSync(getRunnerDir(), { recursive: true });
  const installed = runCommand("npm", ["install", "--prefix", getRunnerDir(), "--omit=dev", "--no-audit", "--no-fund", GITHUB_PACKAGE]);
  if (!installed.ok) {
    throw new DanaaApiError("Failed to install the stable DANAA Health Cards runner.", 1, {
      error_code: "RUNNER_INSTALL_FAILED",
      output: redact(installed.output)
    });
  }
  if (!existsSync(runnerEntry)) {
    throw new DanaaApiError("DANAA runner was installed but the entry file was not found.", 1, {
      error_code: "RUNNER_ENTRY_MISSING"
    });
  }
  return runnerEntry;
}

function nodeCommand(entry: string, args: string[]): string {
  return [process.execPath, entry, ...args].map(quoteHookArg).join(" ");
}

function commandForClient(client: "claude" | "codex", runnerEntry: string, scope: SetupScope): { command: string; args: string[] } {
  const launcher = ["node", runnerEntry];
  if (client === "claude") {
    return { command: "claude", args: ["mcp", "add", "--scope", scope, MCP_NAME, "--", ...launcher] };
  }
  return { command: "codex", args: ["mcp", "add", MCP_NAME, "--", ...launcher] };
}

function getCommandForClient(client: "claude" | "codex"): { command: string; args: string[] } {
  if (client === "claude") return { command: "claude", args: ["mcp", "get", MCP_NAME] };
  return { command: "codex", args: ["mcp", "get", "--json", MCP_NAME] };
}

function removeCommandForClient(client: "claude" | "codex", scope: SetupScope): { command: string; args: string[] } {
  if (client === "claude") return { command: "claude", args: ["mcp", "remove", "--scope", scope, MCP_NAME] };
  return { command: "codex", args: ["mcp", "remove", MCP_NAME] };
}

function ensureToolAvailable(toolName: "claude" | "codex"): void {
  const result = runCommand(toolName, ["--help"]);
  if (!result.ok) {
    throw new DanaaApiError(`${toolName} CLI was not found. Install ${toolName} first, then rerun setup.`, 127, {
      error_code: "CLI_NOT_FOUND"
    });
  }
}

function registerMcp(client: "claude" | "codex", runnerEntry: string, options: Pick<CliOptions, "dryRun" | "force" | "scope">): void {
  const add = commandForClient(client, runnerEntry, options.scope);
  const get = getCommandForClient(client);
  const remove = removeCommandForClient(client, options.scope);

  if (options.dryRun) {
    console.log(`[dry-run] Would check: ${formatShellCommand(get.command, get.args)}`);
    if (options.force) console.log(`[dry-run] Would remove if needed: ${formatShellCommand(remove.command, remove.args)}`);
    console.log(`[dry-run] Would register: ${formatShellCommand(add.command, add.args)}`);
    return;
  }

  ensureToolAvailable(client);
  let existing = runCommand(get.command, get.args);
  if (client === "claude" && options.scope === "user" && existing.ok && /Scope:\s*Local config/iu.test(existing.output)) {
    const localRemove = removeCommandForClient("claude", "local");
    console.log(`${client} MCP server '${MCP_NAME}' has a local entry that shadows user setup. Removing the local entry.`);
    const removedLocal = runCommand(localRemove.command, localRemove.args);
    if (!removedLocal.ok) {
      throw new DanaaApiError(`Failed to remove shadowing local ${client} MCP server.`, 1, {
        error_code: "MCP_LOCAL_REMOVE_FAILED",
        output: redact(removedLocal.output)
      });
    }
    existing = runCommand(get.command, get.args);
  }

  if (existing.ok && !options.force) {
    const normalizedOutput = existing.output.replace(/\\/g, "/");
    const normalizedRunnerEntry = runnerEntry.replace(/\\/g, "/");
    if (normalizedOutput.includes(normalizedRunnerEntry)) {
      console.log(`${client} MCP server '${MCP_NAME}' is already registered. Leaving it unchanged.`);
      return;
    }
    console.log(`${client} MCP server '${MCP_NAME}' exists but points to an older runner. Updating it.`);
    const removed = runCommand(remove.command, remove.args);
    if (!removed.ok) {
      throw new DanaaApiError(`Failed to remove stale ${client} MCP server.`, 1, {
        error_code: "MCP_REMOVE_FAILED",
        output: redact(removed.output)
      });
    }
  }

  if (existing.ok && options.force) {
    const removed = runCommand(remove.command, remove.args);
    if (!removed.ok) {
      throw new DanaaApiError(`Failed to remove existing ${client} MCP server.`, 1, {
        error_code: "MCP_REMOVE_FAILED",
        output: redact(removed.output)
      });
    }
  }

  const added = runCommand(add.command, add.args);
  if (!added.ok) {
    throw new DanaaApiError(`Failed to register ${client} MCP server.`, 1, {
      error_code: "MCP_ADD_FAILED",
      output: redact(added.output)
    });
  }
  console.log(`${client} MCP server '${MCP_NAME}' registered.`);
}

function backupFile(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  const backupPath = `${filePath}.bak-${Date.now()}`;
  copyFileSync(filePath, backupPath);
  return backupPath;
}

function readJsonFile(filePath: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    if (!existsSync(filePath)) return {};
    throw new DanaaApiError(`Could not read ${filePath} as JSON. Fix or rename that file, then rerun setup.`, 1, {
      error_code: "CONFIG_JSON_INVALID",
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

function writeJsonFile(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  backupFile(filePath);
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function filterDanaaStopHooks(settings: Record<string, unknown>): { settings: Record<string, unknown>; removed: boolean } {
  const hooks = (settings.hooks && typeof settings.hooks === "object" ? settings.hooks : {}) as Record<string, unknown[]>;
  const stopHooks = Array.isArray(hooks.Stop) ? hooks.Stop : [];
  const nextStopHooks = stopHooks.filter((entry) => !JSON.stringify(entry).includes(MCP_NAME));
  hooks.Stop = nextStopHooks;
  settings.hooks = hooks;
  return { settings, removed: nextStopHooks.length !== stopHooks.length };
}

function installClaudeHook(runnerEntry: string, options: Pick<CliOptions, "dryRun">): void {
  const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
  const command = nodeCommand(runnerEntry, ["hook", "stop", "--client", "claude"]);
  if (options.dryRun) {
    console.log(`[dry-run] Would add Claude Stop hook to ${settingsPath}: ${command}`);
    return;
  }
  const settings = readJsonFile(settingsPath);
  const { settings: filtered } = filterDanaaStopHooks(settings);
  const hooks = filtered.hooks as Record<string, unknown[]>;
  const stopHooks = Array.isArray(hooks.Stop) ? hooks.Stop : [];
  hooks.Stop = [
    ...stopHooks,
    {
      hooks: [{ type: "command", command, timeout: 5 }]
    }
  ];
  filtered.hooks = hooks;
  writeJsonFile(settingsPath, filtered);
  console.log("Claude Stop hook registered.");
}

function removeClaudeHook(options: Pick<CliOptions, "dryRun">): void {
  const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
  if (options.dryRun) {
    console.log(`[dry-run] Would remove DANAA Claude Stop hook from ${settingsPath}`);
    return;
  }
  const settings = readJsonFile(settingsPath);
  const { settings: filtered, removed } = filterDanaaStopHooks(settings);
  if (removed) writeJsonFile(settingsPath, filtered);
  console.log(removed ? "Claude Stop hook removed for manual-only mode." : "Claude Stop hook was not installed.");
}

function updateCodexHooksFeature(configPath: string): void {
  let content = "";
  try {
    content = readFileSync(configPath, "utf8");
  } catch {
    content = "";
  }
  const lines = content ? content.split(/\r?\n/u) : [];
  const featuresIndex = lines.findIndex((line) => /^\s*\[features\]\s*$/iu.test(line));
  if (featuresIndex >= 0) {
    let sectionEnd = featuresIndex + 1;
    while (sectionEnd < lines.length && !/^\s*\[[^\]]+\]\s*$/u.test(lines[sectionEnd])) {
      sectionEnd += 1;
    }
    const bodyLines = lines.slice(featuresIndex + 1, sectionEnd).filter((line) => !/^\s*codex_hooks\s*=/iu.test(line));
    while (bodyLines[0] === "") bodyLines.shift();
    lines.splice(featuresIndex, sectionEnd - featuresIndex, "[features]", "codex_hooks = true", ...bodyLines);
    content = lines.join("\n");
  } else {
    content = `${content.trimEnd()}\n\n[features]\ncodex_hooks = true\n`;
  }
  mkdirSync(path.dirname(configPath), { recursive: true });
  backupFile(configPath);
  writeFileSync(configPath, content, "utf8");
}

function installCodexHook(runnerEntry: string, options: Pick<CliOptions, "dryRun">): void {
  const codexDir = path.join(os.homedir(), ".codex");
  const hooksPath = path.join(codexDir, "hooks.json");
  const configPath = path.join(codexDir, "config.toml");
  const command = nodeCommand(runnerEntry, ["hook", "stop", "--client", "codex"]);
  if (options.dryRun) {
    console.log(`[dry-run] Would enable codex_hooks in ${configPath}`);
    console.log(`[dry-run] Would add Codex Stop hook to ${hooksPath}: ${command}`);
    return;
  }
  updateCodexHooksFeature(configPath);
  const hooksJson = readJsonFile(hooksPath);
  const { settings: filtered } = filterDanaaStopHooks(hooksJson);
  const hooks = filtered.hooks as Record<string, unknown[]>;
  const stopHooks = Array.isArray(hooks.Stop) ? hooks.Stop : [];
  hooks.Stop = [
    ...stopHooks,
    {
      hooks: [{ type: "command", command, timeout: 5, statusMessage: "Checking DANAA health card" }]
    }
  ];
  filtered.hooks = hooks;
  writeJsonFile(hooksPath, filtered);
  console.log("Codex Stop hook registered.");
}

function removeCodexHook(options: Pick<CliOptions, "dryRun">): void {
  const hooksPath = path.join(os.homedir(), ".codex", "hooks.json");
  if (options.dryRun) {
    console.log(`[dry-run] Would remove DANAA Codex Stop hook from ${hooksPath}`);
    return;
  }
  const hooksJson = readJsonFile(hooksPath);
  const { settings: filtered, removed } = filterDanaaStopHooks(hooksJson);
  if (removed) writeJsonFile(hooksPath, filtered);
  console.log(removed ? "Codex Stop hook removed for manual-only mode." : "Codex Stop hook was not installed.");
}

function installSkill(client: "claude" | "codex", options: Pick<CliOptions, "dryRun">): void {
  const baseDir =
    client === "claude" ? path.join(os.homedir(), ".claude", "skills", "danaa-checkin") : path.join(os.homedir(), ".codex", "skills", "danaa-checkin");
  const skillPath = path.join(baseDir, "SKILL.md");
  if (options.dryRun) {
    console.log(`[dry-run] Would write ${client} skill to ${skillPath}`);
    return;
  }
  mkdirSync(baseDir, { recursive: true });
  writeFileSync(skillPath, skillTextForClient(client), "utf8");
  console.log(`${client} DANAA skill installed.`);
}

function installHook(client: "claude" | "codex", runnerEntry: string, options: Pick<CliOptions, "dryRun">): void {
  if (client === "claude") installClaudeHook(runnerEntry, options);
  if (client === "codex") installCodexHook(runnerEntry, options);
}

function removeHook(client: "claude" | "codex", options: Pick<CliOptions, "dryRun">): void {
  if (client === "claude") removeClaudeHook(options);
  if (client === "codex") removeCodexHook(options);
}

export function codexPermissionGuide(): string {
  return [
    "Codex first-use permission:",
    "  Codex may ask whether to allow the DANAA MCP server to run a tool.",
    "  Choose `3. Always allow` once for each DANAA action you trust.",
    "  This is Codex's own safety prompt, so DANAA setup does not bypass it automatically.",
    "  If Windows keeps showing `Stop hook failed` or `CreateProcessAsUser failed: 5`, rerun `setup codex --manual-only`.",
    "  Manual-only mode still supports `질문카드 보여줘` and number answers through MCP."
  ].join("\n");
}

async function setup(target: string, options: Pick<CliOptions, "dryRun" | "force" | "manualOnly" | "noOpen" | "scope">): Promise<void> {
  const normalizedTarget = target || "all";
  if (!["claude", "codex", "all"].includes(normalizedTarget)) {
    throw new DanaaApiError("Setup target must be one of: claude, codex, all.", 400, {
      error_code: "INVALID_SETUP_TARGET"
    });
  }

  const targets = normalizedTarget === "all" ? (["claude", "codex"] as const) : ([normalizedTarget] as Array<"claude" | "codex">);

  if (!options.dryRun) {
    for (const client of targets) ensureToolAvailable(client);
  }

  if (options.dryRun) {
    console.log(`[dry-run] Would use DANAA API: ${getApiBase()}`);
    console.log("[dry-run] Would reuse a valid OS keyring token, or start device login if no valid token exists.");
  } else if (await hasReusableToken()) {
    console.log("Existing DANAA token is valid. Skipping device login.");
    ensureInstalledAt();
  } else {
    await login({ noOpen: options.noOpen });
  }

  const runnerEntry = ensureLocalRunner(options);
  for (const client of targets) {
    registerMcp(client, runnerEntry, options);
    installSkill(client, options);
    if (options.manualOnly) {
      removeHook(client, options);
    } else {
      installHook(client, runnerEntry, options);
    }
  }

  console.log(
    options.manualOnly
      ? "Setup complete in manual MCP mode. Automatic DANAA Stop hooks are off."
      : "Setup complete. Restart Claude Code/Codex if the new MCP server or hook is not visible yet."
  );
  if (targets.includes("codex")) {
    console.log("");
    console.log(codexPermissionGuide());
  }
}

function answerNumbersFromCard(card: DanaaNextCheckin, answerNumbers: number[]): Record<string, string | number | boolean> {
  if (answerNumbers.length !== card.questions.length) {
    throw new DanaaApiError(`답변 번호는 질문 개수(${card.questions.length}개)에 맞춰 입력해주세요.`, 400, {
      error_code: "ANSWER_COUNT_MISMATCH"
    });
  }
  const answers: Record<string, string | number | boolean> = {};
  card.questions.forEach((question, index) => {
    const selectedNumber = answerNumbers[index];
    if (question.input_type === "number") {
      answers[question.field] = selectedNumber;
      return;
    }
    const option = question.options[selectedNumber - 1];
    if (option === undefined) {
      throw new DanaaApiError(`${index + 1}번 질문은 1~${question.options.length} 사이 번호로 답해주세요.`, 400, {
        error_code: "ANSWER_OPTION_OUT_OF_RANGE"
      });
    }
    answers[question.field] = option;
  });
  return answers;
}

async function answerLatest(rawNumbers: string[]): Promise<void> {
  const state = readState();
  if (!state.latestLeaseId || !state.latestCard) {
    throw new DanaaApiError("No pending DANAA card was found. Run `danaa-health-cards checkin` first.", 404, {
      error_code: "LATEST_LEASE_MISSING"
    });
  }
  const numbers = rawNumbers
    .flatMap((value) => value.split(/[,\s]+/u))
    .filter(Boolean)
    .map((value) => Number(value));
  if (numbers.length === 0 || numbers.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new DanaaApiError("Answer numbers must be positive integers.", 400, {
      error_code: "INVALID_ANSWER_NUMBERS"
    });
  }
  const result = await answerCheckin(state.latestLeaseId, answerNumbersFromCard(state.latestCard, numbers));
  completeLatestCard(state.latestLeaseId, AFTER_ANSWER_AUTO_SUPPRESS_MINUTES);
  console.log(result.message);
}

async function skipLatest(): Promise<void> {
  const state = readState();
  if (!state.latestLeaseId) {
    throw new DanaaApiError("No pending DANAA card was found. Run `danaa-health-cards checkin` first.", 404, {
      error_code: "LATEST_LEASE_MISSING"
    });
  }
  const result = await skipCheckin(state.latestLeaseId);
  completeLatestCard(state.latestLeaseId, AFTER_ANSWER_AUTO_SUPPRESS_MINUTES);
  console.log(result.message);
}

function parseDuration(value: string): 30 | 60 | 120 | 1440 {
  const normalized = value.trim().toLowerCase().replace(/\s+/gu, "");
  if (["30m", "30min", "30분"].includes(normalized)) return 30;
  if (["1h", "60m", "60min", "1시간", "1시간뒤"].includes(normalized)) return 60;
  if (["2h", "120m", "120min", "2시간", "2시간뒤"].includes(normalized)) return 120;
  if (["today", "오늘", "오늘그만"].includes(normalized)) return 1440;
  throw new DanaaApiError("Duration must be 30m, 1h, 2h, or today.", 400, {
    error_code: "INVALID_DURATION"
  });
}

async function snooze(value: string): Promise<void> {
  const duration = parseDuration(value || "1h");
  const result = await snoozeCheckin(duration);
  updateState((state) => ({ ...state, snoozeUntil: result.snoozed_until }));
  console.log(result.message);
}

function dnd(value: string): void {
  const normalized = value || "on";
  if (normalized === "off") {
    updateState((state) => ({ ...state, dndUntil: undefined }));
    console.log("DANAA local DND is off.");
    return;
  }
  const duration = normalized === "today" ? 1440 : 120;
  const dndUntil = new Date(Date.now() + duration * 60 * 1000).toISOString();
  updateState((state) => ({ ...state, dndUntil }));
  console.log(`DANAA local DND is on until ${dndUntil}.`);
}

async function logout(): Promise<void> {
  try {
    await revokeExternalToken();
  } catch {
    // Local logout must still work if the server is unavailable or the token is already invalid.
  }
  const deleted = deleteStoredToken();
  console.log(deleted ? "DANAA token removed from OS keyring." : "No DANAA token was found in OS keyring.");
}

function doctor(): void {
  const state = readState();
  console.log(`DANAA Health Cards doctor

API base:
  ${getApiBase()}

Data directory:
  ${getDataDir()}

Token lookup order:
  1. DANAA_HEALTH_TOKEN environment variable
  2. OS keyring service "DANAA Health Cards"

Automation:
  latestLeaseId=${state.latestLeaseId ?? "(none)"}
  snoozeUntil=${state.snoozeUntil ?? "(none)"}
  dndUntil=${state.dndUntil ?? "(none)"}

${codexPermissionGuide()}

If setup fails at keyring, unlock your OS credential store and rerun setup.
`);
}

function printHelp(): void {
  console.log(`DANAA Health Cards

Usage:
  danaa-health-cards setup claude|codex|all [--scope user|local] [--manual-only] [--no-open] [--dry-run] [--force]
  danaa-health-cards login [--api-base <url>] [--no-open]
  danaa-health-cards checkin [--api-base <url>]
  danaa-health-cards answer-latest 1 2
  danaa-health-cards skip-latest
  danaa-health-cards snooze 30m|1h|2h|today
  danaa-health-cards dnd on|off|today
  danaa-health-cards hook stop --client claude|codex
  danaa-health-cards logout
  danaa-health-cards doctor

One-line setup:
  npx -y github:LAP-TIME2/danaa-health-cards setup claude
  npx -y github:LAP-TIME2/danaa-health-cards setup codex
  npx -y github:LAP-TIME2/danaa-health-cards setup all
  npx -y github:LAP-TIME2/danaa-health-cards setup claude --no-open

Environment:
  DANAA_API_BASE=${getApiBase()}
  DANAA_HEALTH_TOKEN=<developer override>
`);
}

export function printError(error: unknown): void {
  if (error instanceof DanaaApiError) {
    console.error(redact(`DANAA error: ${error.message} (${error.status})`));
    if (error.status === 404) console.error("DANAA Health Cards could not find the requested DANAA resource.");
    if (error.status === 0) console.error("Check your network or use --api-base for a local DANAA backend.");
    return;
  }
  console.error(redact(error instanceof Error ? error.message : String(error)));
}

export async function runCli(args = process.argv.slice(2)): Promise<void> {
  const { command, rest, dryRun, force, manualOnly, noOpen, scope } = parseArgs(args);
  if (command === "setup") {
    await setup(rest[0] ?? "all", { dryRun, force, manualOnly, noOpen, scope });
    return;
  }
  if (command === "login") {
    await login({ noOpen });
    return;
  }
  if (command === "checkin") {
    await checkin();
    return;
  }
  if (command === "answer-latest") {
    await answerLatest(rest);
    return;
  }
  if (command === "skip-latest") {
    await skipLatest();
    return;
  }
  if (command === "snooze") {
    await snooze(rest[0] ?? "1h");
    return;
  }
  if (command === "dnd") {
    dnd(rest[0] ?? "on");
    return;
  }
  if (command === "hook" && rest[0] === "stop") {
    const clientIndex = rest.indexOf("--client");
    const client = rest[clientIndex + 1] === "codex" ? "codex" : "claude";
    await runStopHook(client);
    return;
  }
  if (command === "logout") {
    await logout();
    return;
  }
  if (command === "doctor") {
    doctor();
    return;
  }
  printHelp();
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  try {
    await runCli();
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}
