import { describe, expect, it } from "vitest";

import type { DanaaNextCheckin } from "../src/api.js";
import { selectHookCard } from "../src/hook.js";

const localPendingCard: DanaaNextCheckin = {
  has_question: true,
  lease_id: "local-lease",
  bundle_key: "bundle_2",
  bundle_name: "아침식사",
  log_date: "2026-05-05",
  expires_at: "2099-01-01T00:00:00+09:00",
  notice: "Lifestyle check-in only",
  questions: [
    {
      field: "breakfast_status",
      summary_label: "아침 식사 여부",
      text: "아침 드셨어요?",
      input_type: "select",
      options: ["hearty", "skipped"]
    }
  ]
};

describe("selectHookCard", () => {
  it("uses the server-issued next card first", () => {
    const serverCard: DanaaNextCheckin = {
      ...localPendingCard,
      lease_id: "server-lease",
      bundle_name: "식단"
    };

    expect(selectHookCard(serverCard, localPendingCard)?.lease_id).toBe("server-lease");
  });

  it("reuses a pending local card when the server says an active lease already exists", () => {
    const activeLeaseBlocked: DanaaNextCheckin = {
      has_question: false,
      questions: [],
      notice: "active lease",
      blocked_reason: "active_lease"
    };

    expect(selectHookCard(activeLeaseBlocked, localPendingCard)?.lease_id).toBe("local-lease");
  });

  it("does not show a card when the server blocks and there is no local active lease", () => {
    const cooldown: DanaaNextCheckin = {
      has_question: false,
      questions: [],
      notice: "cooldown",
      blocked_reason: "cooldown",
      next_available_at: "2099-01-01T00:00:00+09:00"
    };

    expect(selectHookCard(cooldown, null)).toBeNull();
  });
});
