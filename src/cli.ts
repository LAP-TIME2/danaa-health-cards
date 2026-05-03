#!/usr/bin/env node
import {
  danaaFetch,
  getApiBase,
  type DanaaNextCheckin
} from "./api.js";
import { formatCard } from "./format.js";

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
  const card = await danaaFetch<DanaaNextCheckin>("/external/checkins/next", {
    token: process.env.DANAA_HEALTH_TOKEN
  });
  console.log(formatCard(card));
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "help";
  if (command === "login") {
    await login();
    return;
  }
  if (command === "checkin") {
    await checkin();
    return;
  }
  console.log(`DANAA Health Cards

Usage:
  danaa-health-cards login
  danaa-health-cards checkin

Environment:
  DANAA_API_BASE=${getApiBase()}
  DANAA_HEALTH_TOKEN=<issued by login>
`);
}

await main();
