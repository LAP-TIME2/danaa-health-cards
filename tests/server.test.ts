import { describe, expect, it } from "vitest";

import { DanaaApiError, type DanaaNextCheckin } from "../src/api.js";
import { answersFromNumbers, resultWithCompletionHint } from "../src/server.js";

const twoQuestionCard: DanaaNextCheckin = {
  has_question: true,
  lease_id: "lease-1",
  bundle_key: "bundle",
  bundle_name: "테스트",
  log_date: "2026-05-04",
  expires_at: "2099-01-01T00:00:00+09:00",
  notice: "생활습관 기록용",
  questions: [
    {
      field: "meal_balance",
      summary_label: "식사 균형",
      text: "오늘 식사 구성은?",
      input_type: "select",
      options: ["balanced", "carb_heavy", "protein_veg_heavy"]
    },
    {
      field: "alcohol_today",
      summary_label: "음주 여부",
      text: "최근에 술을 드셨나요?",
      input_type: "select",
      options: [true, false]
    }
  ]
};

describe("answersFromNumbers", () => {
  it("maps option numbers to exact server answer values", () => {
    expect(answersFromNumbers(twoQuestionCard, [2, 1])).toEqual({
      meal_balance: "carb_heavy",
      alcohol_today: true
    });
  });

  it("rejects incomplete answers before submitting to the server", () => {
    expect(() => answersFromNumbers(twoQuestionCard, [2])).toThrow(DanaaApiError);
    expect(() => answersFromNumbers(twoQuestionCard, [2])).toThrow("질문 개수");
  });

  it("rejects out-of-range option numbers before submitting to the server", () => {
    expect(() => answersFromNumbers(twoQuestionCard, [4, 1])).toThrow(DanaaApiError);
    expect(() => answersFromNumbers(twoQuestionCard, [4, 1])).toThrow("1~3");
  });
});

describe("resultWithCompletionHint", () => {
  it("does not claim that another card definitely remains", () => {
    const rendered = resultWithCompletionHint({
      status: "saved",
      saved_fields: ["meal_balance"],
      skipped_fields: [],
      daily_log_date: "2026-05-04",
      message: "server message"
    });

    expect(rendered).toContain("기록 완료");
    expect(rendered).toContain("남은 카드가 있는지 확인");
    expect(rendered).not.toContain("다음 카드");
    expect(rendered).not.toContain("더 남아");
  });
});
