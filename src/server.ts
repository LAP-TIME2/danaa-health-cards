#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  answerCheckin,
  getSettings,
  nextCheckin,
  skipCheckin,
  updateSettings,
  type DanaaNextCheckin
} from "./api.js";
import { formatCard } from "./format.js";
import { redact } from "./security/redact.js";

const leaseCache = new Map<string, DanaaNextCheckin>();

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
    if (card.lease_id) {
      leaseCache.set(card.lease_id, card);
    }
    return text(formatCard(card));
  } catch (error) {
    return errorText(error);
  }
});

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
      const result = await answerCheckin(leaseId, answers, idempotencyKey);
      leaseCache.delete(leaseId);
      return text(result);
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
      return text(result);
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
      return text(result);
    } catch (error) {
      return errorText(error);
    }
  }
);

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

const transport = new StdioServerTransport();
await server.connect(transport);
