import type { DanaaNextCheckin, DanaaQuestion } from "./api.js";

function formatOption(option: string | number | boolean): string {
  if (option === true) return "예";
  if (option === false) return "아니요";
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
