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
  exchangeDeviceToken,
  getSettings,
  nextCheckin,
  revokeExternalToken,
  skipCheckin,
  snoozeCheckin,
  startDeviceLogin,
  updateSettings,
  type DanaaNextCheckin
} from "./api.js";
import { formatAutomationStatus, formatCard, formatDateTime, formatPostAnswerHint } from "./format.js";
import {
  clearAccountState,
  clearLatestCard,
  clearPendingDeviceLogin,
  completeLatestCard,
  isFuture,
  readState,
  rememberLatestCard,
  rememberPendingDeviceLogin,
  updateState
} from "./local-state.js";
import { redact } from "./security/redact.js";
import { deleteStoredToken, saveStoredToken, TokenStoreError } from "./token-store.js";

const leaseCache = new Map<string, DanaaNextCheckin>();
// Prevents same-turn Stop hook duplication without hiding the next card for a whole work session.
const AFTER_ANSWER_AUTO_SUPPRESS_MINUTES = 0.25;

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

function accountLoginInstruction(verificationUri: string, userCode: string): string {
  return [
    "DANAA 계정 연결 승인을 시작했어요.",
    "",
    `1. 아래 링크를 브라우저에서 열어주세요: ${verificationUri}`,
    `2. 승인 코드 입력: ${userCode}`,
    '3. 승인 후 Claude/Codex에 "승인 완료"라고 말하면 연결을 마무리할게요.',
    "",
    "토큰은 화면에 표시하지 않고 OS 보안 저장소에만 저장됩니다."
  ].join("\n");
}

async function startAccountLogin(): Promise<string> {
  const start = await startDeviceLogin("DANAA Health Cards MCP");
  rememberPendingDeviceLogin({
    deviceCode: start.device_code,
    userCode: start.user_code,
    verificationUri: start.verification_uri,
    expiresIn: start.expires_in,
    intervalSeconds: start.interval
  });
  return accountLoginInstruction(start.verification_uri, start.user_code);
}

async function disconnectAccount(): Promise<{ deleted: boolean; revoked: boolean }> {
  let revoked = false;
  try {
    const result = await revokeExternalToken();
    revoked = Boolean(result.revoked);
  } catch {
    revoked = false;
  }
  const deleted = deleteStoredToken();
  clearAccountState();
  return { deleted, revoked };
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

server.tool("danaa_account_status", "Check whether this computer is connected to a DANAA account. Never returns tokens.", {}, async () => {
  try {
    const settings = await getSettings();
    return text(
      [
        "DANAA 계정 연결 상태: 연결됨",
        "",
        "이 컴퓨터의 Claude/Codex 플러그인은 사용자가 승인한 DANAA 계정과 연결되어 있어요.",
        "정확한 이메일이나 토큰은 보안상 표시하지 않습니다.",
        `자동 질문 간격: ${settings.health_question_interval_minutes === 0 ? "꺼짐" : `${settings.health_question_interval_minutes}분`}`,
        `하루 최대 카드 수: ${settings.max_bundles_per_day}개`
      ].join("\n")
    );
  } catch (error) {
    if (error instanceof DanaaApiError && error.status === 401) {
      return text('DANAA 계정 연결 상태: 연결 안 됨\n\n계정을 연결하려면 "DANAA 계정 연결해줘"라고 말해주세요.');
    }
    return errorText(error);
  }
});

server.tool("danaa_account_login_start", "Start DANAA device login from Claude/Codex. Returns only approval link and user code.", {}, async () => {
  try {
    return text(await startAccountLogin());
  } catch (error) {
    return errorText(error);
  }
});

server.tool("danaa_account_switch_start", "Disconnect the current DANAA account and start a new explicit device login.", {}, async () => {
  try {
    await disconnectAccount();
    const instruction = await startAccountLogin();
    return text(["기존 DANAA 연결을 이 컴퓨터에서 해제했어요.", "", instruction].join("\n"));
  } catch (error) {
    return errorText(error);
  }
});

server.tool("danaa_account_login_finish", "Finish DANAA device login after the user approved the code in the browser.", {}, async () => {
  try {
    const state = readState();
    const pending = state.pendingDeviceLogin;
    if (!pending) {
      return text('진행 중인 DANAA 로그인 승인이 없어요. 먼저 "DANAA 계정 연결해줘" 또는 "DANAA 계정 전환해줘"라고 말해주세요.');
    }
    if (!isFuture(pending.expiresAt)) {
      clearPendingDeviceLogin();
      return text("DANAA 승인 코드가 만료됐어요. 다시 계정 연결을 시작해주세요.");
    }
    const token = await exchangeDeviceToken(pending.deviceCode);
    try {
      saveStoredToken(token.access_token);
    } catch (error) {
      if (error instanceof TokenStoreError) {
        return text("DANAA 토큰을 OS 보안 저장소에 저장하지 못했어요. 운영체제 자격 증명 저장소를 확인한 뒤 다시 시도해주세요.");
      }
      throw error;
    }
    clearAccountState();
    return text("DANAA 계정 연결이 완료됐어요. 토큰은 화면에 표시하지 않고 OS 보안 저장소에 저장했습니다.");
  } catch (error) {
    if (error instanceof DanaaApiError && error.status === 428) {
      return text("아직 DANAA 웹에서 승인이 완료되지 않았어요. 승인 후 다시 '승인 완료'라고 말해주세요.");
    }
    return errorText(error);
  }
});

server.tool("danaa_account_logout", "Disconnect DANAA from this computer and remove the local OS keyring token.", {}, async () => {
  try {
    const result = await disconnectAccount();
    return text(
      [
        "DANAA 연결을 이 컴퓨터에서 해제했어요.",
        result.deleted ? "OS 보안 저장소의 로컬 토큰도 제거했습니다." : "OS 보안 저장소에 제거할 토큰은 없었습니다.",
        result.revoked ? "서버 토큰도 폐기했습니다." : "서버 토큰은 이미 만료됐거나 확인할 수 없어서 로컬 연결만 제거했습니다."
      ].join("\n")
    );
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
