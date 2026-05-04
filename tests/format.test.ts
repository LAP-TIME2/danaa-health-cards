import { describe, expect, it } from "vitest";

import type { DanaaNextCheckin } from "../src/api.js";
import {
  formatAutomationStatus,
  formatAutoCardPrompt,
  formatAutoHookInstruction,
  formatCard,
  formatPostAnswerHint
} from "../src/format.js";

const bannedInternalWords = ["DANAA_CHECKIN_READY", "DANAA_CARD_PENDING", "MCP", "danaa_checkin_", "lease", "cache", "도구 호출"];

const sampleCard: DanaaNextCheckin = {
  has_question: true,
  lease_id: "lease-1",
  bundle_key: "bundle_1",
  bundle_name: "수면",
  log_date: "2026-05-03",
  expires_at: "2026-05-03T10:00:00+09:00",
  notice: "Lifestyle check-in only",
  questions: [
    {
      field: "sleep_quality",
      summary_label: "수면의 질",
      text: "어젯밤 잠은 잘 주무셨나요?",
      input_type: "select",
      options: ["good", "normal", "bad"]
    }
  ]
};

function expectNoInternalWords(rendered: string): void {
  for (const word of bannedInternalWords) {
    expect(rendered).not.toContain(word);
  }
}

describe("formatCard", () => {
  it("renders a compact user-facing card without internal identifiers", () => {
    const rendered = formatCard(sampleCard);

    expect(rendered).toContain("DANAA 건강 체크인 카드입니다 (수면).");
    expect(rendered).toContain("생활습관 기록용이며, 의료 조언은 아니에요.");
    expect(rendered).toContain("Q1. 수면의 질 - 어젯밤 잠은 잘 주무셨나요?");
    expect(rendered).toContain("선택: 1. 좋음 / 2. 보통 / 3. 나쁨");
    expect(rendered).toContain('답변하시려면 번호를 알려주세요. 예: "1".');
    expectNoInternalWords(rendered);
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

    expect(rendered).toContain("선택: 1. 고르게 먹었어요 / 2. 밥·빵·면 위주였어요 / 3. 고기·채소 위주였어요");
    expect(rendered).toContain("선택: 1. 없음 / 2. 한 번 / 3. 두 번 이상");
    expect(rendered).not.toContain("balanced");
    expect(rendered).not.toContain("carb_heavy");
    expect(rendered).not.toContain("two_plus");
  });

  it("localizes breakfast option codes instead of generic fallback labels", () => {
    const rendered = formatCard({
      has_question: true,
      lease_id: "lease-breakfast",
      bundle_key: "bundle_2",
      bundle_name: "아침식사",
      log_date: "2026-05-05",
      expires_at: "2026-05-05T10:00:00+09:00",
      notice: "Lifestyle check-in only",
      questions: [
        {
          field: "breakfast_status",
          summary_label: "아침 식사 여부",
          text: "아침 드셨어요? 🍳",
          input_type: "select",
          options: ["hearty", "skipped"]
        },
        {
          field: "took_medication",
          summary_label: "복약 여부",
          text: "오늘 약은 챙겨 드셨나요? 💊",
          input_type: "select",
          options: [true, false]
        }
      ]
    });

    expect(rendered).toContain("선택: 1. 든든하게 먹었어요 / 2. 거름");
    expect(rendered).toContain("선택: 1. 예 / 2. 아니요");
    expect(rendered).not.toContain("선택지 1");
    expect(rendered).not.toContain("hearty");
    expect(rendered).not.toContain("skipped");
  });

  it("localizes remaining bundled option codes used by DANAA server", () => {
    const rendered = formatCard({
      ...sampleCard,
      questions: [
        {
          field: "exercise_type",
          summary_label: "운동 종류",
          text: "어떤 운동을 하셨나요?",
          input_type: "select",
          options: ["walking", "running", "cycling", "swimming", "gym", "home_workout", "other"]
        },
        {
          field: "vegetable_intake_level",
          summary_label: "채소 섭취",
          text: "오늘 채소나 나물 반찬 드셨나요?",
          input_type: "select",
          options: ["enough", "little", "none"]
        }
      ]
    });

    expect(rendered).toContain("선택: 1. 걷기 / 2. 달리기 / 3. 자전거 / 4. 수영 / 5. 헬스장 / 6. 홈트 / 7. 기타");
    expect(rendered).toContain("선택: 1. 충분 / 2. 조금 / 3. 없음");
    expect(rendered).not.toContain("선택지");
    expect(rendered).not.toContain("home_workout");
  });

  it("does not expose unknown option enum values", () => {
    const rendered = formatCard({
      ...sampleCard,
      questions: [
        {
          field: "unknown",
          summary_label: "알 수 없는 선택지",
          text: "테스트 질문",
          input_type: "select",
          options: ["raw_backend_enum"]
        }
      ]
    });

    expect(rendered).toContain("선택: 1. 선택지 1");
    expect(rendered).not.toContain("raw_backend_enum");
  });

  it("renders a short auto-checkin continuation prompt", () => {
    const rendered = formatAutoCardPrompt(sampleCard);

    expect(rendered).toBe(formatCard(sampleCard));
    expect(rendered).toContain("DANAA 건강 체크인 카드입니다 (수면).");
    expectNoInternalWords(rendered);
  });

  it("puts the card body directly inside the Stop hook reason without internal commands", () => {
    const rendered = formatAutoHookInstruction(sampleCard);

    expect(rendered).toContain("답변 맨 아래에 한 번만 덧붙여주세요.");
    expect(rendered).toContain("DANAA 건강 체크인 카드입니다 (수면).");
    expect(rendered).toContain("Q1. 수면의 질 - 어젯밤 잠은 잘 주무셨나요?");
    expect(rendered).toContain("선택: 1. 좋음 / 2. 보통 / 3. 나쁨");
    expectNoInternalWords(rendered);
  });

  it("localizes stress option codes", () => {
    const rendered = formatCard({
      ...sampleCard,
      bundle_name: "정서",
      questions: [
        {
          field: "mood",
          summary_label: "기분 상태",
          text: "요즘 기분은 어떠신가요?",
          input_type: "select",
          options: ["excellent", "good", "normal", "stressed", "very_stressed"]
        }
      ]
    });

    expect(rendered).toContain("4. 스트레스 / 5. 매우 스트레스");
    expect(rendered).not.toContain("very_stressed");
  });

  it("localizes sleep duration codes and keeps question sections separated", () => {
    const rendered = formatCard({
      ...sampleCard,
      questions: [
        {
          field: "sleep_quality",
          summary_label: "Q1. 수면의 질",
          text: "어젯밤 잠은 잘 주무셨나요?",
          input_type: "select",
          options: ["excellent", "good", "normal", "bad", "very_bad"]
        },
        {
          field: "sleep_duration",
          summary_label: "Q2. 수면 시간",
          text: "Q2. 대략 몇 시간 정도 주무셨나요?",
          input_type: "select",
          options: ["under_5", "between_5_6", "between_6_7", "between_7_8", "over_8"]
        }
      ]
    });

    expect(rendered).toContain("Q1. 수면의 질 - 어젯밤 잠은 잘 주무셨나요?");
    expect(rendered).toContain("Q2. 수면 시간 - 대략 몇 시간 정도 주무셨나요?");
    expect(rendered).toContain("선택: 1. 5시간 미만 / 2. 5~6시간 / 3. 6~7시간 / 4. 7~8시간 / 5. 8시간 이상");
    expect(rendered).not.toContain("under_5");
    expect(rendered).not.toContain("between_5_6");
    expect(rendered).not.toContain("over_8");
    expect(rendered).not.toContain("Q2. Q2.");
  });

  it("does not imply that more cards definitely remain after saving", () => {
    const rendered = formatPostAnswerHint();

    expect(rendered).toContain("남은 카드가 있는지 확인");
    expect(rendered).not.toContain("더 남아");
    expect(rendered).not.toContain("다음 카드");
  });

  it("explains completed check-ins without asking the user to request another card", () => {
    const rendered = formatCard({
      has_question: false,
      log_date: "2026-05-04",
      questions: [],
      notice: "오늘 체크인 완료",
      blocked_reason: "no_pending",
      next_available_at: null
    });

    expect(rendered).toContain("오늘 체크인 완료");
    expect(rendered).toContain("지금 입력할 건강 카드는 모두 끝났어요.");
    expect(rendered).not.toContain("질문카드 줘");
    expect(rendered).not.toContain("더 남아");
  });

  it("distinguishes cooldown from completed check-ins", () => {
    const rendered = formatCard({
      has_question: false,
      log_date: "2026-05-04",
      questions: [],
      notice: "cooldown",
      blocked_reason: "cooldown",
      next_available_at: "2026-05-04T14:42:00+09:00"
    });

    expect(rendered).toContain("지금 바로 입력할 DANAA 질문카드는 없어요.");
    expect(rendered).toContain("다음 확인 가능 시간");
    expect(rendered).not.toContain("오늘 체크인 완료");
  });

  it("warns that local status is not the server remaining-card result", () => {
    const rendered = formatAutomationStatus({
      latestShownAt: "2026-05-04T14:31:00+09:00",
      autoSuppressedUntil: "2026-05-04T14:42:00+09:00"
    });

    expect(rendered).toContain("대기 중인 질문카드는 없어요.");
    expect(rendered).toContain('"질문카드 보여줘"라고 말해주세요.');
    expect(rendered).not.toContain("바로 받");
  });
});
