#!/usr/bin/env node

import { printError, runCli } from "./cli.js";
import { runServer } from "./server.js";

const cliCommands = new Set([
  "setup",
  "login",
  "checkin",
  "answer-latest",
  "skip-latest",
  "snooze",
  "dnd",
  "hook",
  "logout",
  "doctor",
  "help",
  "--help",
  "-h"
]);
const command = process.argv[2];

try {
  if (command && cliCommands.has(command)) {
    await runCli(process.argv.slice(2));
  } else {
    await runServer();
  }
} catch (error) {
  printError(error);
  process.exitCode = 1;
}
