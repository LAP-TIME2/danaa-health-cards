import { describe, expect, it } from "vitest";

import { formatAutoCardPrompt, formatCard } from "../src/format.js";

const sampleCard = {
  has_question: true,
  lease_id: "lease-1",
  bundle_key: "bundle_1",
  bundle_name: "Sleep",
  log_date: "2026-05-03",
  expires_at: "2026-05-03T10:00:00+09:00",
  notice: "Lifestyle check-in only",
  questions: [
    {
      field: "sleep_quality",
      summary_label: "Sleep quality",
      text: "How was your sleep?",
      input_type: "select",
      options: ["good", "normal", "bad"]
    }
  ]
};

describe("formatCard", () => {
  it("renders a compact user-facing card without internal identifiers", () => {
    const rendered = formatCard(sampleCard);

    expect(rendered).toContain("DANAA 건강 체크인 카드입니다");
    expect(rendered).toContain("Q1. Sleep quality - How was your sleep?");
    expect(rendered).toContain("1. 좋음");
    expect(rendered).toContain("2. 보통");
    expect(rendered).toContain('답변하시려면 번호를 알려주세요 (예: "1").');
    expect(rendered).not.toContain("lease_id");
    expect(rendered).not.toContain("danaa_checkin");
  });

  it("shows Korean labels for server option codes", () => {
    const rendered = formatCard({
      has_question: true,
      lease_id: "lease-2",
      bundle_key: "bundle_2",
      bundle_name: "식단",
      log_date: "2026-05-04",
      expires_at: "2026-05-04T10:00:00+09:00",
      notice: "Lifestyle check-in only",
      questions: [
        {
          field: "meal_balance",
          summary_label: "식사 균형",
          text: "오늘 하루 식사가 주로 어떤 구성이었나요?",
          input_type: "select",
          options: ["balanced", "carb_heavy", "protein_veg_heavy"]
        },
        {
          field: "sweet_drinks",
          summary_label: "당류 음료나 간식",
          text: "오늘 단 음료나 달달한 간식 드셨나요?",
          input_type: "select",
          options: ["none", "one", "two_plus"]
        }
      ]
    });

    expect(rendered).toContain("1. 고르게 먹었어요");
    expect(rendered).toContain("2. 밥·빵·면 위주였어요");
    expect(rendered).toContain("3. 고기·채소 위주였어요");
    expect(rendered).toContain("1. 없음");
    expect(rendered).toContain("2. 한 번");
    expect(rendered).toContain("3. 두 번 이상");
    expect(rendered).not.toContain("balanced");
    expect(rendered).not.toContain("carb_heavy");
    expect(rendered).not.toContain("two_plus");
  });

  it("renders a short auto-checkin continuation prompt", () => {
    const rendered = formatAutoCardPrompt(sampleCard);

    expect(rendered).toBe(formatCard(sampleCard));
    expect(rendered).toContain("DANAA 건강 체크인 카드입니다");
    expect(rendered).toContain("Q1. Sleep quality - How was your sleep?");
    expect(rendered).not.toContain("DANAA_CARD_PENDING");
    expect(rendered).not.toContain("danaa_checkin");
    expect(rendered).not.toContain("lease_id");
  });
});
