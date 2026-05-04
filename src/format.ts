import type { DanaaNextCheckin, DanaaQuestion } from "./api.js";

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
  balanced: "고르게 먹었어요",
  carb_heavy: "밥·빵·면 위주였어요",
  protein_veg_heavy: "고기·채소 위주였어요",
  none: "없음",
  no: "아니요",
  one: "한 번",
  two_plus: "두 번 이상",
  yes: "예",
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

export function formatQuestion(question: DanaaQuestion, index: number): string {
  const lines = [`Q${index + 1}. ${question.summary_label} - ${question.text}`];
  if (question.input_type === "number") {
    lines.push("숫자로 답해주세요.");
    return lines.join("\n");
  }
  lines.push(
    question.options
      .map((option, optionIndex) => `${optionIndex + 1}. ${formatOption(option)}`)
      .join("  ")
  );
  return lines.join("\n");
}

export function formatCard(card: DanaaNextCheckin): string {
  if (!card.has_question) {
    return `DANAA 체크인: ${card.notice}`;
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

export function formatAutoCardPrompt(card: DanaaNextCheckin): string {
  return formatCard(card);
}
