import { closeSync, existsSync, mkdirSync, openSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

import { nextCheckin } from "./api.js";
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

type ParsedStopHookInput = {
  input: StopHookInput;
  valid: boolean;
};

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseInput(raw: string): ParsedStopHookInput {
  if (!raw.trim()) return { input: {}, valid: true };
  try {
    return { input: JSON.parse(raw) as StopHookInput, valid: true };
  } catch {
    return { input: {}, valid: false };
  }
}

function shouldSkipByLocalState(input: StopHookInput): boolean {
  const lastMessage = input.last_assistant_message ?? "";
  if (input.stop_hook_active) return true;
  if (lastMessage.includes("DANAA_CARD_PENDING")) return true;
  if (lastMessage.includes("DANAA 건강 체크인 카드")) return true;
  if (lastMessage.includes("DANAA") && (lastMessage.includes("Q1.") || lastMessage.includes("질문") || lastMessage.includes("체크인"))) return true;

  const state = ensureInstalledAt();
  if (isFuture(state.snoozeUntil) || isFuture(state.dndUntil) || isFuture(state.autoSuppressedUntil)) return true;
  if (input.turn_id && state.lastHookTurnId === input.turn_id) return true;
  if (state.latestLeaseId && isFuture(state.latestCard?.expires_at ?? undefined)) return true;

  return false;
}

function outputContinuation(reason: string): void {
  process.stdout.write(JSON.stringify({ decision: "block", reason, suppressOutput: true }));
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
  let releaseLock: (() => void) | null = null;

  try {
    const { input, valid } = parseInput(await readStdin());
    if (!valid) return;
    if (shouldSkipByLocalState(input)) return;

    releaseLock = acquireHookLock();
    if (!releaseLock) return;

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
  } catch {
    // Hooks must never interrupt coding work. Any API, keyring, local-state, or client encoding failure fails silently.
    return;
  } finally {
    releaseLock?.();
  }

  void client;
}
