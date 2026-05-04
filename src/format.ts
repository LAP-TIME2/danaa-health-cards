import type { DanaaNextCheckin, DanaaQuestion } from "./api.js";

function formatOption(option: string | number | boolean): string {
  if (option === true) return "예";
  if (option === false) return "아니요";
  return String(option);
}

export function formatQuestion(question: DanaaQuestion, index: number): string {
  const lines = [`${index + 1}. ${question.summary_label}`, `   ${question.text}`];
  if (question.input_type === "number") {
    lines.push("   숫자로 입력하세요.");
    return lines.join("\n");
  }
  question.options.forEach((option, optionIndex) => {
    lines.push(`   ${optionIndex + 1}) ${formatOption(option)}`);
  });
  return lines.join("\n");
}

export function formatCard(card: DanaaNextCheckin): string {
  if (!card.has_question) {
    return `DANAA 체크인: ${card.notice}`;
  }
  return [
    `DANAA 건강 체크인 · ${card.bundle_name ?? card.bundle_key}`,
    card.notice,
    `lease_id: ${card.lease_id}`,
    "",
    ...card.questions.map((question, index) => formatQuestion(question, index)),
    "",
    "번호로 답하려면 `danaa_checkin_answer_latest_numbers` 도구에 answerNumbers를 질문 순서대로 넣으세요.",
    "예: 질문이 2개면 answerNumbers: [2, 4]",
    "건너뛰려면 `danaa_checkin_skip_latest` 도구를 사용하세요."
  ].join("\n");
}

export function formatAutoCardPrompt(card: DanaaNextCheckin): string {
  const cardBody = [
    "이전 답변은 수정하지 말고, 맨 아래에 아래 DANAA 건강 체크인 블록만 짧게 덧붙이세요.",
    "의료 진단이나 조언처럼 말하지 말고 생활습관 기록 보조로만 표현하세요.",
    "사용자가 번호만 입력하면 danaa_checkin_answer_latest_numbers 도구를 사용하세요.",
    "사용자가 skip, 스킵, 나중에, 오늘 그만이라고 답하면 skip/snooze 도구를 사용하세요.",
    "",
    "DANAA_CARD_PENDING",
    formatCard(card).replace(/^lease_id:.*$/m, "답변 방식: 번호 / skip / 30분 뒤 / 오늘 그만")
  ];
  return cardBody.join("\n");
}
