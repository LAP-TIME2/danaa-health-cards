import { DanaaApiError, nextCheckin } from "./api.js";
import { formatAutoCardPrompt } from "./format.js";
import { ensureInstalledAt, isFuture, readState, rememberLatestCard, updateState } from "./local-state.js";

type HookClient = "claude" | "codex";

type StopHookInput = {
  hook_event_name?: string;
  stop_hook_active?: boolean;
  last_assistant_message?: string | null;
  turn_id?: string;
};

const MIN_FIRST_CARD_MINUTES = 30;

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
  if (isFuture(state.snoozeUntil) || isFuture(state.dndUntil)) return true;
  if (input.turn_id && state.lastHookTurnId === input.turn_id) return true;

  const installedAt = state.installedAt ? Date.parse(state.installedAt) : Date.now();
  const allowEarly = process.env.DANAA_HEALTH_CARDS_ALLOW_EARLY === "1";
  if (!allowEarly && Date.now() - installedAt < MIN_FIRST_CARD_MINUTES * 60 * 1000) return true;

  return false;
}

function outputContinuation(reason: string): void {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
}

export async function runStopHook(client: HookClient): Promise<void> {
  const input = parseInput(await readStdin());
  if (shouldSkipByLocalState(input)) return;

  try {
    const card = await nextCheckin();
    updateState((state) => ({
      ...state,
      lastHookTurnId: input.turn_id ?? state.lastHookTurnId
    }));

    if (!card.has_question || !card.lease_id) return;

    rememberLatestCard(card);
    outputContinuation(formatAutoCardPrompt(card));
  } catch (error) {
    if (!(error instanceof DanaaApiError)) {
      return;
    }
    // Hooks must never interrupt coding work. API/keyring/network failures fail silently.
    return;
  }

  void client;
}
