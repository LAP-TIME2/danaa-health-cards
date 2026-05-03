import type { DanaaNextCheckin, DanaaQuestion } from "./api.js";

function formatOption(option: string | number | boolean): string {
  if (option === true) return "예";
  if (option === false) return "아니오";
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
    "번호로 답하려면 `danaa_checkin_answer_numbers` 도구에 answerNumbers를 질문 순서대로 넣으세요.",
    "예: 질문이 2개면 answerNumbers: [2, 4]"
  ].join("\n");
}
