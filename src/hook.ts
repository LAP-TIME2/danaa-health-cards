import { closeSync, existsSync, mkdirSync, openSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

import { DanaaApiError, nextCheckin } from "./api.js";
import { formatAutoHookInstruction } from "./format.js";
import {
  ensureInstalledAt,
  getDataDir,
  isFuture,
  rememberLatestCard,
  suppressAutoForMinutes,
  updateState
} from "./local-state.js";

type HookClient = "claude" | "codex";

type StopHookInput = {
  hook_event_name?: string;
  stop_hook_active?: boolean;
  last_assistant_message?: string | null;
  turn_id?: string;
};

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseInput(raw: string): StopHookInput {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as StopHookInput;
  } catch {
    return {};
  }
}

function shouldSkipByLocalState(input: StopHookInput): boolean {
  if (input.stop_hook_active) return true;
  if (input.last_assistant_message?.includes("DANAA_CARD_PENDING")) return true;

  const state = ensureInstalledAt();
  if (isFuture(state.snoozeUntil) || isFuture(state.dndUntil) || isFuture(state.autoSuppressedUntil)) return true;
  if (input.turn_id && state.lastHookTurnId === input.turn_id) return true;
  if (state.latestLeaseId && isFuture(state.latestCard?.expires_at ?? undefined)) return true;

  return false;
}

function outputContinuation(reason: string): void {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
}

function acquireHookLock(): (() => void) | null {
  const lockPath = path.join(getDataDir(), "hook.lock");
  mkdirSync(getDataDir(), { recursive: true });
  try {
    const fd = openSync(lockPath, "wx");
    closeSync(fd);
  } catch {
    try {
      const ageMs = Date.now() - statSync(lockPath).mtimeMs;
      if (ageMs > 15_000) {
        unlinkSync(lockPath);
        const fd = openSync(lockPath, "wx");
        closeSync(fd);
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }
  return () => {
    if (existsSync(lockPath)) unlinkSync(lockPath);
  };
}

function rememberBlockedCheckin(card: Awaited<ReturnType<typeof nextCheckin>>): void {
  if (card.blocked_reason === "cooldown" && card.next_available_at) {
    updateState((state) => ({ ...state, autoSuppressedUntil: card.next_available_at ?? state.autoSuppressedUntil }));
  }
  if (card.blocked_reason === "snoozed" && card.next_available_at) {
    updateState((state) => ({ ...state, snoozeUntil: card.next_available_at ?? state.snoozeUntil }));
  }
  if ((card.blocked_reason === "daily_limit" || card.blocked_reason === "no_pending") && card.next_available_at) {
    updateState((state) => ({ ...state, autoSuppressedUntil: card.next_available_at ?? state.autoSuppressedUntil }));
  }
}

export async function runStopHook(client: HookClient): Promise<void> {
  const input = parseInput(await readStdin());
  if (shouldSkipByLocalState(input)) return;
  const releaseLock = acquireHookLock();
  if (!releaseLock) return;

  try {
    const card = await nextCheckin();
    updateState((state) => ({
      ...state,
      lastHookTurnId: input.turn_id ?? state.lastHookTurnId
    }));

    if (!card.has_question || !card.lease_id) {
      rememberBlockedCheckin(card);
      return;
    }

    rememberLatestCard(card);
    outputContinuation(formatAutoHookInstruction(card));
  } catch (error) {
    if (!(error instanceof DanaaApiError)) {
      return;
    }
    // Hooks must never interrupt coding work. API/keyring/network failures fail silently.
    return;
  } finally {
    releaseLock();
  }

  void client;
}
