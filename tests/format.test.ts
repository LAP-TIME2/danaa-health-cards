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
    expect(rendered).toContain("1. good");
    expect(rendered).toContain("2. normal");
    expect(rendered).toContain('답변하시려면 번호를 알려주세요 (예: "1").');
    expect(rendered).not.toContain("lease_id");
    expect(rendered).not.toContain("danaa_checkin");
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
