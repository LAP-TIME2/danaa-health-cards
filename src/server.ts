#!/usr/bin/env node
import { pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  answerCheckin,
  DanaaApiError,
  type DanaaAnswerResponse,
  type DanaaSettings,
  getSettings,
  nextCheckin,
  skipCheckin,
  snoozeCheckin,
  updateSettings,
  type DanaaNextCheckin
} from "./api.js";
import { formatAutomationStatus, formatCard, formatDateTime, formatPostAnswerHint } from "./format.js";
import { clearLatestCard, completeLatestCard, isFuture, readState, rememberLatestCard, updateState } from "./local-state.js";
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
  if (!state.latestCard.has_question || !isFuture(state.latestCard.expires_at ?? undefined)) {
    clearLatestCard(state.latestLeaseId);
    return null;
  }
  return { leaseId: state.latestLeaseId, card: state.latestCard };
}

export function answersFromNumbers(
  card: DanaaNextCheckin,
  answerNumbers: number[]
): Record<string, string | number | boolean> {
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

function finishLatestLease(leaseId: string): void {
  leaseCache.delete(leaseId);
  completeLatestCard(leaseId, AFTER_ANSWER_AUTO_SUPPRESS_MINUTES);
}

export function resultWithCompletionHint(result: DanaaAnswerResponse): string {
  const headline = result.status === "skipped" ? "이번 질문카드는 건너뛰었어요." : "기록 완료.";
  return `${headline}\n\n${formatPostAnswerHint()}`;
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
  if (error instanceof DanaaApiError && error.status === 401) {
    return text("DANAA 연결 로그인이 필요해요. 터미널에서 `danaa-health-cards setup claude` 또는 `setup codex`를 다시 실행해주세요.");
  }
  if (error instanceof DanaaApiError && error.status === 404) {
    return text("DANAA 서버에서 체크인 기능을 찾지 못했어요. 서버 배포가 최신 상태인지 확인해주세요.");
  }
  return text(`DANAA 요청을 처리하지 못했어요. 잠시 뒤 다시 시도해주세요.${error instanceof Error ? ` (${redact(error.message)})` : ""}`);
}

function missingLatestCardText(): string {
  return '지금 다시 보여드릴 DANAA 질문카드를 찾지 못했어요. "질문카드 보여줘"라고 말하면 새 카드가 있는지 확인해드릴게요.';
}

function durationLabel(minutes: 30 | 60 | 120 | 1440): string {
  if (minutes === 30) return "30분";
  if (minutes === 60) return "1시간";
  if (minutes === 120) return "2시간";
  return "오늘";
}

function settingsText(settings: DanaaSettings): string {
  const interval =
    settings.health_question_interval_minutes === 0
      ? "자동 질문 끔"
      : `${settings.health_question_interval_minutes}분마다 최대 1회`;
  return [
    "DANAA 체크인 설정입니다.",
    `자동 질문: ${settings.auto_question_enabled ? "켜짐" : "꺼짐"}`,
    `질문 간격: ${interval}`,
    `하루 최대 카드 수: ${settings.max_bundles_per_day}개`
  ].join("\n");
}

const server = new McpServer({
  name: "danaa-health-cards",
  version: "0.1.0"
});

server.tool("danaa_checkin_next", "Get the next server-approved DANAA health check-in card.", {}, async () => {
  try {
    const latest = latestCard();
    if (latest) return text(formatCard(latest.card));

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
      if (!latest) return text(missingLatestCardText());
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
      const latest = latestCard();
      const card = leaseCache.get(leaseId) ?? (latest?.leaseId === leaseId ? latest.card : null);
      if (!card) return text(missingLatestCardText());

      const answers = answersFromNumbers(card, answerNumbers);
      const result = await answerCheckin(leaseId, answers, idempotencyKey);
      finishLatestLease(leaseId);
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
      finishLatestLease(leaseId);
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
      finishLatestLease(leaseId);
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
      if (!latest) return text(missingLatestCardText());

      const result = await answerCheckin(
        latest.leaseId,
        answersFromNumbers(latest.card, answerNumbers),
        idempotencyKey
      );
      finishLatestLease(latest.leaseId);
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
      if (!latest) return text(missingLatestCardText());

      const result = await skipCheckin(latest.leaseId, idempotencyKey);
      finishLatestLease(latest.leaseId);
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
      const until = formatDateTime(result.snoozed_until);
      return text(`DANAA 건강 체크인을 ${durationLabel(durationMinutes)} 미뤘어요.${until ? ` 다음 확인 가능 시간: ${until}` : ""}`);
    } catch (error) {
      return errorText(error);
    }
  }
);

server.tool(
  "danaa_checkin_status",
  "Read local DANAA Health Cards automation state. Do not use this to check whether server-side cards remain; use danaa_checkin_next for that.",
  {},
  async () => {
    try {
      latestCard();
      const state = readState();
      return text(formatAutomationStatus(state));
    } catch (error) {
      return errorText(error);
    }
  }
);

server.tool("danaa_settings_get", "Read DANAA Health Cards CLI settings.", {}, async () => {
  try {
    return text(settingsText(await getSettings()));
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
      return text(settingsText(await updateSettings(intervalMinutes)));
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
