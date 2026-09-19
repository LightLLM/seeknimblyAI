import {
  GOLDEN_QUESTIONS,
  FIXTURE_PASSING_ANSWERS,
  scoreAnswer,
} from "@/lib/eval/golden";

describe("compliance golden-question eval harness", () => {
  it("defines questions for ON, BC, QC, and federal CA", () => {
    const provinces = new Set(GOLDEN_QUESTIONS.map((q) => q.province));
    expect(provinces.has("ON")).toBe(true);
    expect(provinces.has("BC")).toBe(true);
    expect(provinces.has("QC")).toBe(true);
    expect(provinces.has("CA")).toBe(true);
    expect(GOLDEN_QUESTIONS.length).toBeGreaterThanOrEqual(6);
  });

  it("scores fixture answers as pass", () => {
    for (const q of GOLDEN_QUESTIONS) {
      const answer = FIXTURE_PASSING_ANSWERS[q.id];
      expect(answer).toBeTruthy();
      const result = scoreAnswer(q, answer);
      expect(result.pass).toBe(true);
    }
  });

  it("fails answers missing required phrases or disclaimer", () => {
    const q = GOLDEN_QUESTIONS.find((x) => x.id === "roe-timing")!;
    const bad = scoreAnswer(q, "Issue paperwork eventually.");
    expect(bad.pass).toBe(false);
    expect(bad.missing.length).toBeGreaterThan(0);
  });

  it("fails when forbidden phrasing appears", () => {
    const q = GOLDEN_QUESTIONS.find((x) => x.id === "on-min-wage")!;
    const bad = scoreAnswer(
      q,
      "Ontario minimum wage changes in October. This is legal advice."
    );
    expect(bad.pass).toBe(false);
    expect(bad.forbidden_hits.length).toBeGreaterThan(0);
  });
});
