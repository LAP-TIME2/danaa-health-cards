#!/usr/bin/env node
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

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(args: string[]): { command: string; rest: string[] } {
  const rest: string[] = [];
  let command = "help";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
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
  return { command, rest };
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
      console.log("For this MVP, set the token as an environment variable. Do not commit it.");
      console.log(`DANAA_HEALTH_TOKEN=${token.access_token}`);
      return;
    } catch {
      process.stdout.write(".");
    }
  }
  console.error("Device login expired. Please run login again.");
  process.exitCode = 1;
}

async function checkin(): Promise<void> {
  const card: DanaaNextCheckin = await nextCheckin();
  console.log(formatCard(card));
}

function printHelp(): void {
  console.log(`DANAA Health Cards

Usage:
  danaa-health-cards login [--api-base <url>]
  danaa-health-cards checkin [--api-base <url>]
  danaa-health-cards mcp

One-line Claude Code install:
  claude mcp add danaa-health-cards -- npx -y github:LAP-TIME2/danaa-health-cards

Environment:
  DANAA_API_BASE=${getApiBase()}
  DANAA_HEALTH_TOKEN=<issued by login>
`);
}

export function printError(error: unknown): void {
  if (error instanceof DanaaApiError) {
    console.error(redact(`DANAA error: ${error.message} (${error.status})`));
    if (error.status === 404) {
      console.error("The DANAA external check-in API is not available at the selected API base yet.");
      console.error("For local backend testing, add: --api-base http://localhost:8000/api/v1");
    }
    if (error.status === 0) {
      console.error("Check your network or use --api-base for a local DANAA backend.");
    }
    return;
  }
  console.error(redact(error instanceof Error ? error.message : String(error)));
}

export async function runCli(args = process.argv.slice(2)): Promise<void> {
  const { command } = parseArgs(args);
  if (command === "login") {
    await login();
    return;
  }
  if (command === "checkin") {
    await checkin();
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
