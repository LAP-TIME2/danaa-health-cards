#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  DanaaApiError,
  danaaFetch,
  getApiBase,
  nextCheckin,
  setApiBase,
  type DanaaNextCheckin
} from "./api.js";
import { formatCard } from "./format.js";
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

type CliOptions = {
  command: string;
  rest: string[];
  dryRun: boolean;
  force: boolean;
};

const MCP_NAME = "danaa-health-cards";
const GITHUB_PACKAGE = "github:LAP-TIME2/danaa-health-cards";

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(args: string[]): CliOptions {
  const rest: string[] = [];
  let command = "help";
  let dryRun = false;
  let force = false;
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
  return { command, rest, dryRun, force };
}

async function login(): Promise<void> {
  const start = await danaaFetch<DeviceStart>("/external-auth/device/start", {
    method: "POST",
    body: { client_name: "DANAA Health Cards CLI", client_type: "cli" }
  });
  console.log("DANAA device login");
  console.log(`1. Open: ${start.verification_uri}`);
  console.log(`2. Enter code: ${start.user_code}`);
  console.log("3. After approving in DANAA, keep this terminal open.");

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

async function checkin(): Promise<void> {
  const card: DanaaNextCheckin = await nextCheckin();
  console.log(formatCard(card));
}

function commandForClient(client: "claude" | "codex"): { command: string; args: string[] } {
  if (client === "claude") {
    const launcher = process.platform === "win32" ? ["cmd", "/c", "npx", "-y", GITHUB_PACKAGE] : ["npx", "-y", GITHUB_PACKAGE];
    return {
      command: "claude",
      args: ["mcp", "add", "--scope", "local", MCP_NAME, "--", ...launcher]
    };
  }

  return {
    command: "codex",
    args: ["mcp", "add", MCP_NAME, "--", "npx", "-y", GITHUB_PACKAGE]
  };
}

function getCommandForClient(client: "claude" | "codex"): { command: string; args: string[] } {
  if (client === "claude") {
    return { command: "claude", args: ["mcp", "get", MCP_NAME] };
  }
  return { command: "codex", args: ["mcp", "get", "--json", MCP_NAME] };
}

function removeCommandForClient(client: "claude" | "codex"): { command: string; args: string[] } {
  if (client === "claude") {
    return { command: "claude", args: ["mcp", "remove", "--scope", "local", MCP_NAME] };
  }
  return { command: "codex", args: ["mcp", "remove", MCP_NAME] };
}

function runCommand(command: string, args: string[]): { ok: boolean; output: string } {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return { ok: result.status === 0, output };
}

function formatShellCommand(command: string, args: string[]): string {
  return [command, ...args].join(" ");
}

function ensureToolAvailable(toolName: "claude" | "codex"): void {
  const result = runCommand(toolName, ["--help"]);
  if (!result.ok) {
    throw new DanaaApiError(`${toolName} CLI was not found. Install ${toolName} first, then rerun setup.`, 127, {
      error_code: "CLI_NOT_FOUND"
    });
  }
}

function registerMcp(client: "claude" | "codex", options: Pick<CliOptions, "dryRun" | "force">): void {
  const add = commandForClient(client);
  const get = getCommandForClient(client);
  const remove = removeCommandForClient(client);

  if (options.dryRun) {
    console.log(`[dry-run] Would check: ${formatShellCommand(get.command, get.args)}`);
    if (options.force) {
      console.log(`[dry-run] Would remove if needed: ${formatShellCommand(remove.command, remove.args)}`);
    }
    console.log(`[dry-run] Would register: ${formatShellCommand(add.command, add.args)}`);
    return;
  }

  ensureToolAvailable(client);
  const existing = runCommand(get.command, get.args);
  if (existing.ok && !options.force) {
    console.log(`${client} MCP server '${MCP_NAME}' is already registered. Leaving it unchanged.`);
    return;
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

async function setup(target: string, options: Pick<CliOptions, "dryRun" | "force">): Promise<void> {
  const normalizedTarget = target || "all";
  if (!["claude", "codex", "all"].includes(normalizedTarget)) {
    throw new DanaaApiError("Setup target must be one of: claude, codex, all.", 400, {
      error_code: "INVALID_SETUP_TARGET"
    });
  }

  const targets = normalizedTarget === "all" ? (["claude", "codex"] as const) : ([normalizedTarget] as Array<"claude" | "codex">);

  if (options.dryRun) {
    console.log(`[dry-run] Would use DANAA API: ${getApiBase()}`);
    console.log("[dry-run] Would start device login and save token to OS keyring.");
    for (const client of targets) registerMcp(client, options);
    return;
  }

  await login();
  for (const client of targets) registerMcp(client, options);
  console.log("Setup complete. Restart Claude Code/Codex if the new MCP server is not visible yet.");
}

function logout(): void {
  const deleted = deleteStoredToken();
  console.log(deleted ? "DANAA token removed from OS keyring." : "No DANAA token was found in OS keyring.");
}

function doctor(): void {
  console.log(`DANAA Health Cards doctor

API base:
  ${getApiBase()}

Token lookup order:
  1. DANAA_HEALTH_TOKEN environment variable
  2. OS keyring service "DANAA Health Cards"

If setup fails at login with 404, the DANAA external API is not deployed yet.
If setup fails at keyring, unlock your OS credential store and rerun setup.
`);
}

function printHelp(): void {
  console.log(`DANAA Health Cards

Usage:
  danaa-health-cards setup claude [--dry-run] [--force]
  danaa-health-cards setup codex [--dry-run] [--force]
  danaa-health-cards setup all [--dry-run] [--force]
  danaa-health-cards login [--api-base <url>]
  danaa-health-cards checkin [--api-base <url>]
  danaa-health-cards logout
  danaa-health-cards doctor
  danaa-health-cards mcp

One-line setup:
  npx -y github:LAP-TIME2/danaa-health-cards setup claude
  npx -y github:LAP-TIME2/danaa-health-cards setup codex
  npx -y github:LAP-TIME2/danaa-health-cards setup all

Environment:
  DANAA_API_BASE=${getApiBase()}
  DANAA_HEALTH_TOKEN=<developer override>
`);
}

export function printError(error: unknown): void {
  if (error instanceof DanaaApiError) {
    console.error(redact(`DANAA error: ${error.message} (${error.status})`));
    if (error.status === 404) {
      console.error("DANAA Health Cards installed correctly, but the DANAA external check-in API is not live at this API base yet.");
      console.error("Users do not need to choose localhost or production. Try again after the DANAA backend deployment is updated.");
      console.error("Developer override: --api-base http://localhost:8000/api/v1");
    }
    if (error.status === 0) {
      console.error("Check your network or use --api-base for a local DANAA backend.");
    }
    return;
  }
  console.error(redact(error instanceof Error ? error.message : String(error)));
}

export async function runCli(args = process.argv.slice(2)): Promise<void> {
  const { command, rest, dryRun, force } = parseArgs(args);
  if (command === "setup") {
    await setup(rest[0] ?? "all", { dryRun, force });
    return;
  }
  if (command === "login") {
    await login();
    return;
  }
  if (command === "checkin") {
    await checkin();
    return;
  }
  if (command === "logout") {
    logout();
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
