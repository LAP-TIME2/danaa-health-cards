import { describe, expect, it } from "vitest";

import { formatCard } from "../src/format.js";

describe("formatCard", () => {
  it("renders numbered options without raw health storage", () => {
    const rendered = formatCard({
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
    });

    expect(rendered).toContain("lease_id: lease-1");
    expect(rendered).toContain("1) good");
    expect(rendered).toContain("2) normal");
  });
});
