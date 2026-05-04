#!/usr/bin/env node
import { pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  answerCheckin,
  getSettings,
  nextCheckin,
  skipCheckin,
  snoozeCheckin,
  updateSettings,
  type DanaaNextCheckin
} from "./api.js";
import { formatCard, formatPostAnswerHint } from "./format.js";
import { clearLatestCard, readState, rememberLatestCard, updateState } from "./local-state.js";
import { redact } from "./security/redact.js";

const leaseCache = new Map<string, DanaaNextCheckin>();
const AFTER_ANSWER_AUTO_SUPPRESS_MINUTES = 10;

function rememberCard(card: DanaaNextCheckin): void {
  if (!card.lease_id) return;
  leaseCache.set(card.lease_id, card);
  rememberLatestCard(card);
}

function latestCard(): { leaseId: string; card: DanaaNextCheckin } | null {
  const state = readState();
  if (!state.latestLeaseId || !state.latestCard) return null;
  return { leaseId: state.latestLeaseId, card: state.latestCard };
}

function answersFromNumbers(card: DanaaNextCheckin, answerNumbers: number[]): Record<string, string | number | boolean> {
  const answers: Record<string, string | number | boolean> = {};
  card.questions.forEach((question, index) => {
    const selectedNumber = answerNumbers[index];
    if (selectedNumber === undefined) return;
    if (question.input_type === "number") {
      answers[question.field] = selectedNumber;
      return;
    }
    const option = question.options[selectedNumber - 1];
    if (option !== undefined) {
      answers[question.field] = option;
    }
  });
  return answers;
}

function suppressAutoAfterAnswer(): void {
  const autoSuppressedUntil = new Date(
    Date.now() + AFTER_ANSWER_AUTO_SUPPRESS_MINUTES * 60 * 1000
  ).toISOString();
  updateState((state) => ({ ...state, autoSuppressedUntil }));
}

function resultWithCompletionHint(result: unknown): string {
  suppressAutoAfterAnswer();
  return `${typeof result === "string" ? result : JSON.stringify(result, null, 2)}\n\n${formatPostAnswerHint()}`;
}

function text(content: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof content === "string" ? content : JSON.stringify(content, null, 2)
      }
    ]
  };
}

function errorText(error: unknown) {
  return text(`DANAA error: ${redact(error instanceof Error ? error.message : error)}`);
}

const server = new McpServer({
  name: "danaa-health-cards",
  version: "0.1.0"
});

server.tool("danaa_checkin_next", "Get the next server-approved DANAA health check-in card.", {}, async () => {
  try {
    const card = await nextCheckin();
    rememberCard(card);
    return text(formatCard(card));
  } catch (error) {
    return errorText(error);
  }
});

server.tool(
  "danaa_checkin_show_latest",
  "Show the latest pending DANAA health check-in card without requesting a new server lease.",
  {},
  async () => {
    try {
      const latest = latestCard();
      if (!latest) {
        return text("No pending DANAA card was found. Ask for a new check-in first.");
      }
      return text(formatCard(latest.card));
    } catch (error) {
      return errorText(error);
    }
  }
);

server.tool(
  "danaa_checkin_answer_numbers",
  "Answer the latest DANAA health check-in with option numbers in question order.",
  {
    leaseId: z.string().min(1),
    answerNumbers: z.array(z.number().int().positive()).min(1),
    idempotencyKey: z.string().min(8).optional()
  },
  async ({ leaseId, answerNumbers, idempotencyKey }) => {
    try {
      const card = leaseCache.get(leaseId);
      if (!card) {
        return text("Lease cache is empty. Run danaa_checkin_next again, then answer.");
      }
      const answers = answersFromNumbers(card, answerNumbers);
      const result = await answerCheckin(leaseId, answers, idempotencyKey);
      leaseCache.delete(leaseId);
      clearLatestCard(leaseId);
      return text(resultWithCompletionHint(result));
    } catch (error) {
      return errorText(error);
    }
  }
);

server.tool(
  "danaa_checkin_answer",
  "Answer a DANAA health check-in with exact field values from the card.",
  {
    leaseId: z.string().min(1),
    answers: z.record(z.union([z.string(), z.number(), z.boolean()])),
    idempotencyKey: z.string().min(8).optional()
  },
  async ({ leaseId, answers, idempotencyKey }) => {
    try {
      const result = await answerCheckin(leaseId, answers, idempotencyKey);
      leaseCache.delete(leaseId);
      clearLatestCard(leaseId);
      return text(resultWithCompletionHint(result));
    } catch (error) {
      return errorText(error);
    }
  }
);

server.tool(
  "danaa_checkin_skip",
  "Skip a server-issued DANAA check-in lease without saving health data.",
  {
    leaseId: z.string().min(1),
    idempotencyKey: z.string().min(8).optional()
  },
  async ({ leaseId, idempotencyKey }) => {
    try {
      const result = await skipCheckin(leaseId, idempotencyKey);
      leaseCache.delete(leaseId);
      clearLatestCard(leaseId);
      return text(resultWithCompletionHint(result));
    } catch (error) {
      return errorText(error);
    }
  }
);

server.tool(
  "danaa_checkin_answer_latest_numbers",
  "Answer the latest pending DANAA health check-in with option numbers in question order.",
  {
    answerNumbers: z.array(z.number().int().positive()).min(1),
    idempotencyKey: z.string().min(8).optional()
  },
  async ({ answerNumbers, idempotencyKey }) => {
    try {
      const latest = latestCard();
      if (!latest) {
        return text("No pending DANAA card was found. Ask for a new check-in first.");
      }
      const result = await answerCheckin(
        latest.leaseId,
        answersFromNumbers(latest.card, answerNumbers),
        idempotencyKey
      );
      leaseCache.delete(latest.leaseId);
      clearLatestCard(latest.leaseId);
      return text(resultWithCompletionHint(result));
    } catch (error) {
      return errorText(error);
    }
  }
);

server.tool(
  "danaa_checkin_skip_latest",
  "Skip the latest pending DANAA health check-in without saving health data.",
  {
    idempotencyKey: z.string().min(8).optional()
  },
  async ({ idempotencyKey }) => {
    try {
      const latest = latestCard();
      if (!latest) {
        return text("No pending DANAA card was found. Ask for a new check-in first.");
      }
      const result = await skipCheckin(latest.leaseId, idempotencyKey);
      leaseCache.delete(latest.leaseId);
      clearLatestCard(latest.leaseId);
      return text(resultWithCompletionHint(result));
    } catch (error) {
      return errorText(error);
    }
  }
);

server.tool(
  "danaa_checkin_snooze",
  "Snooze automatic DANAA health check-ins.",
  {
    durationMinutes: z.union([z.literal(30), z.literal(60), z.literal(120), z.literal(1440)])
  },
  async ({ durationMinutes }) => {
    try {
      const result = await snoozeCheckin(durationMinutes);
      updateState((state) => ({ ...state, snoozeUntil: result.snoozed_until }));
      return text(result);
    } catch (error) {
      return errorText(error);
    }
  }
);

server.tool("danaa_checkin_status", "Read local DANAA Health Cards automation state.", {}, async () => {
  try {
    const state = readState();
    return text({
      hasPendingCard: Boolean(state.latestLeaseId),
      latestShownAt: state.latestShownAt ?? null,
      autoSuppressedUntil: state.autoSuppressedUntil ?? null,
      snoozeUntil: state.snoozeUntil ?? null,
      dndUntil: state.dndUntil ?? null
    });
  } catch (error) {
    return errorText(error);
  }
});

server.tool("danaa_settings_get", "Read DANAA Health Cards CLI settings.", {}, async () => {
  try {
    return text(await getSettings());
  } catch (error) {
    return errorText(error);
  }
});

server.tool(
  "danaa_settings_update",
  "Update the minimum automatic question interval. Use 0 to disable automatic questions.",
  {
    intervalMinutes: z.union([z.literal(0), z.literal(60), z.literal(90), z.literal(120)])
  },
  async ({ intervalMinutes }) => {
    try {
      return text(await updateSettings(intervalMinutes));
    } catch (error) {
      return errorText(error);
    }
  }
);

export async function runServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  await runServer();
}
