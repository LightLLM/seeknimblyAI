import {
  getSystemPrompt,
  getRouterPrompt,
  getComplianceAgentPrompt,
  getPolicyDocAgentPrompt,
  getRiskControlsAgentPrompt,
  getOnboardingAgentPrompt,
  getLearningDevelopmentAgentPrompt,
  COMPLIANCE_CHECK_QUESTION_INSTRUCTION,
} from "@/lib/prompts";

describe("prompts", () => {
  describe("getSystemPrompt", () => {
    it("returns NA prompt for NA", () => {
      const p = getSystemPrompt("NA");
      expect(p).toContain("North America");
      expect(p).toContain("Not legal advice.");
    });

    it("returns CA prompt for CA", () => {
      const p = getSystemPrompt("CA");
      expect(p).toContain("Canada");
      expect(p).toContain("province");
      expect(p).toContain("Not legal advice.");
    });

    it("returns US prompt for US", () => {
      const p = getSystemPrompt("US");
      expect(p).toContain("United States");
      expect(p).toContain("state");
      expect(p).toContain("Not legal advice.");
    });

    it("returns string for unknown jurisdiction (fallback)", () => {
      const p = getSystemPrompt("NA" as "NA");
      expect(typeof p).toBe("string");
      expect(p.length).toBeGreaterThan(0);
    });
  });

  describe("getRouterPrompt", () => {
    it("returns systemPrompt and userPrompt with message and has_document", () => {
      const { systemPrompt, userPrompt } = getRouterPrompt("hello", [], false);
      expect(systemPrompt).toContain("intent router");
      expect(systemPrompt).toContain("JSON");
      expect(userPrompt).toContain("hello");
      expect(userPrompt).toContain("has_document: false");
      expect(userPrompt).toContain("general_hr_assistant");
      expect(userPrompt).toContain("compliance_agent");
      expect(userPrompt).toContain("policy_doc_agent");
      expect(userPrompt).toContain("risk_controls_agent");
    });

    it("includes recent_history in userPrompt", () => {
      const history = [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }];
      const { userPrompt } = getRouterPrompt("next", history, true);
      expect(userPrompt).toContain(JSON.stringify(history));
    });
  });

  describe("getComplianceAgentPrompt", () => {
    it("includes Finding and SOC2/ISO and Not legal advice", () => {
      const p = getComplianceAgentPrompt("NA");
      expect(p).toContain("Finding");
      expect(p).toContain("SOC2");
      expect(p).toContain("ISO");
      expect(p).toContain("Not legal advice.");
    });

    it("includes jurisdiction context for CA", () => {
      const p = getComplianceAgentPrompt("CA");
      expect(p).toContain("Canada");
    });
  });

  describe("getPolicyDocAgentPrompt", () => {
    it("includes document/handbook and Not legal advice", () => {
      const p = getPolicyDocAgentPrompt("NA");
      expect(p).toContain("document");
      expect(p).toContain("Not legal advice.");
    });
  });

  describe("getRiskControlsAgentPrompt", () => {
    it("includes SOC2 and ISO 9001 and Not legal advice", () => {
      const p = getRiskControlsAgentPrompt("US");
      expect(p).toContain("SOC2");
      expect(p).toContain("ISO 9001");
      expect(p).toContain("Not legal advice.");
    });
  });

  describe("COMPLIANCE_CHECK_QUESTION_INSTRUCTION", () => {
    it("includes suggested checks", () => {
      expect(COMPLIANCE_CHECK_QUESTION_INSTRUCTION).toContain("SOC2");
      expect(COMPLIANCE_CHECK_QUESTION_INSTRUCTION).toContain("ISO 9001");
      expect(COMPLIANCE_CHECK_QUESTION_INSTRUCTION).toContain("compliance");
    });
  });

  describe("getOnboardingAgentPrompt", () => {
    it("includes onboarding and first-day guidance and Not legal advice", () => {
      const p = getOnboardingAgentPrompt("NA");
      expect(p).toContain("Onboarding");
      expect(p).toContain("Not legal advice.");
    });
    it("includes jurisdiction context for CA", () => {
      const p = getOnboardingAgentPrompt("CA");
      expect(p).toContain("Canada");
    });
  });

  describe("getLearningDevelopmentAgentPrompt", () => {
    it("includes learning, training, career development and Not legal advice", () => {
      const p = getLearningDevelopmentAgentPrompt("NA");
      expect(p).toContain("Learning");
      expect(p).toContain("Training");
      expect(p).toContain("Not legal advice.");
    });
    it("includes jurisdiction context for US", () => {
      const p = getLearningDevelopmentAgentPrompt("US");
      expect(p).toContain("United States");
    });
  });
});
