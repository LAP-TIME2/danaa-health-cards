import type { DanaaNextCheckin, DanaaQuestion } from "./api.js";
import type { LocalState } from "./local-state.js";

const OPTION_LABELS: Record<string, string> = {
  excellent: "매우 좋음",
  very_good: "매우 좋음",
  good: "좋음",
  normal: "보통",
  average: "보통",
  fair: "보통",
  bad: "나쁨",
  poor: "나쁨",
  very_bad: "매우 나쁨",
  stressed: "스트레스",
  very_stressed: "매우 스트레스",
  balanced: "고르게 먹었어요",
  carb_heavy: "밥·빵·면 위주였어요",
  protein_veg_heavy: "고기·채소 위주였어요",
  none: "없음",
  no: "아니요",
  one: "한 번",
  two_plus: "두 번 이상",
  yes: "예",
  under_5: "5시간 미만",
  between_5_6: "5~6시간",
  between_6_7: "6~7시간",
  between_7_8: "7~8시간",
  over_8: "8시간 이상",
  less_than_5h: "5시간 미만",
  "5_6h": "5~6시간",
  "6_7h": "6~7시간",
  "7_8h": "7~8시간",
  over_8h: "8시간 이상"
};

function formatOption(option: string | number | boolean): string {
  if (option === true) return "예";
  if (option === false) return "아니요";
  if (typeof option === "string" && OPTION_LABELS[option]) return OPTION_LABELS[option];
  return String(option);
}

function formatDateTime(value?: string | null): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(timestamp));
}

function cleanQuestionText(value: string): string {
  return value.replace(/^\s*Q\d+\s*[.)]\s*/iu, "").trim();
}

export function formatQuestion(question: DanaaQuestion, index: number): string {
  const summary = cleanQuestionText(question.summary_label);
  const text = cleanQuestionText(question.text);
  const header = summary && text && summary !== text ? `${summary} - ${text}` : summary || text;
  const lines = [`Q${index + 1}. ${header}`];
  if (question.input_type === "number") {
    lines.push("숫자로 답해주세요.");
    return lines.join("\n");
  }
  lines.push(
    question.options
      .map((option, optionIndex) => `${optionIndex + 1}) ${formatOption(option)}`)
      .join("\n")
  );
  return lines.join("\n");
}

export function formatCard(card: DanaaNextCheckin): string {
  if (!card.has_question) {
    return formatNoQuestionCard(card);
  }

  const title = `DANAA 건강 체크인 카드입니다${card.bundle_name ? ` (${card.bundle_name})` : ""}.`;
  const answerHint =
    card.questions.length > 1
      ? `답변하시려면 ${card.questions.length}개 질문의 번호를 알려주세요 (예: "1, 2").`
      : '답변하시려면 번호를 알려주세요 (예: "1").';

  return [
    title,
    "",
    ...card.questions.flatMap((question, index) => [formatQuestion(question, index), ""]),
    `${answerHint} 건너뛰고 싶으면 "건너뛰기"라고 말해주세요.`
  ].join("\n").trim();
}

export function formatNoQuestionCard(card: DanaaNextCheckin): string {
  const nextAvailable = formatDateTime(card.next_available_at);
  const datePrefix = card.log_date ? `${card.log_date} 기준으로 ` : "";

  if (card.blocked_reason === "disabled") {
    return "DANAA 건강 체크인이 꺼져 있어요. 다시 받고 싶으면 DANAA 설정에서 자동 체크인을 켜주세요.";
  }

  if (card.blocked_reason === "snoozed") {
    return [
      "지금은 DANAA 건강 체크인이 잠시 미뤄진 상태예요.",
      nextAvailable ? `다음 확인 가능 시간: ${nextAvailable}` : null,
      "생활습관 기록용 알림이며, 의료 조언은 아니에요."
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (card.blocked_reason === "cooldown") {
    return [
      "지금 바로 입력할 DANAA 질문카드는 없어요.",
      nextAvailable ? `다음 확인 가능 시간: ${nextAvailable}` : null,
      "작업 흐름이 끊기는 시점에 다시 확인해드릴게요."
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (card.blocked_reason === "daily_limit" || card.blocked_reason === "no_pending" || card.blocked_reason === null) {
    return [
      "✅ 오늘 체크인 완료!",
      `${datePrefix}지금 입력할 건강 카드는 모두 끝났어요.`,
      card.notice && !card.notice.includes("완료") ? card.notice : null,
      "내일 다시 확인할 수 있어요. 수고하셨습니다."
    ]
      .filter(Boolean)
      .join("\n");
  }

  return card.notice ? `DANAA 체크인: ${card.notice}` : "지금 바로 입력할 DANAA 질문카드는 없어요.";
}

export function formatAutoCardPrompt(card: DanaaNextCheckin): string {
  return formatCard(card);
}

export function formatAutoHookInstruction(card: DanaaNextCheckin): string {
  const bundleName = card.bundle_name ? ` (${card.bundle_name})` : "";
  return `DANAA_CHECKIN_READY${bundleName}: 이전 답변은 수정하지 말고 MCP 도구 danaa_checkin_show_latest를 호출해 반환된 카드만 한 번 보여주세요. 실패하면 아무것도 덧붙이지 마세요.`;
}

export function formatPostAnswerHint(): string {
  return '이어서 입력하고 싶을 때 "질문카드 보여줘"라고 말하면 현재 남은 카드가 있는지 확인해드릴게요.';
}

export function formatAutomationStatus(state: LocalState): string {
  const latestShownAt = formatDateTime(state.latestShownAt);
  const autoSuppressedUntil = formatDateTime(state.autoSuppressedUntil);
  const snoozeUntil = formatDateTime(state.snoozeUntil);
  const dndUntil = formatDateTime(state.dndUntil);

  const lines = ["DANAA 로컬 자동 체크인 상태입니다."];
  if (state.latestLeaseId) {
    lines.push('대기 중인 질문카드가 있어요. 방금 준비된 카드를 보려면 "질문카드 보여줘"라고 말해주세요.');
  } else {
    lines.push("로컬에 대기 중인 질문카드는 없어요.");
  }
  if (latestShownAt) lines.push(`마지막 카드 표시: ${latestShownAt}`);
  if (autoSuppressedUntil) lines.push(`답변 직후 자동 표시 억제: ${autoSuppressedUntil}까지`);
  if (snoozeUntil) lines.push(`사용자 미루기: ${snoozeUntil}까지`);
  if (dndUntil) lines.push(`오늘 그만/집중 모드: ${dndUntil}까지`);
  lines.push('오늘 남은 카드가 있는지 확인하려면 로컬 상태가 아니라 "질문카드 보여줘"로 서버 확인을 해야 합니다.');
  return lines.join("\n");
}
