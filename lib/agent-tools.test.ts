import {
  TOOLS_REQUIRING_APPROVAL,
  toolRequiresApproval,
  executeTool,
  AGENT_TOOLS,
} from "@/lib/agent-tools";

describe("agent-tools", () => {
  describe("TOOLS_REQUIRING_APPROVAL", () => {
    it("includes send_outreach, schedule_interview, update_ats only", () => {
      expect(TOOLS_REQUIRING_APPROVAL).toEqual([
        "send_outreach",
        "schedule_interview",
        "update_ats",
      ]);
    });

    it("does not include read-only or workflow tools", () => {
      expect(TOOLS_REQUIRING_APPROVAL).not.toContain("search_candidates");
      expect(TOOLS_REQUIRING_APPROVAL).not.toContain("screen_resume");
      expect(TOOLS_REQUIRING_APPROVAL).not.toContain("get_sourcing_workflow");
    });
  });

  describe("toolRequiresApproval", () => {
    it("returns true for send_outreach, schedule_interview, update_ats", () => {
      expect(toolRequiresApproval("send_outreach")).toBe(true);
      expect(toolRequiresApproval("schedule_interview")).toBe(true);
      expect(toolRequiresApproval("update_ats")).toBe(true);
    });

    it("returns false for search_candidates, screen_resume, get_sourcing_workflow", () => {
      expect(toolRequiresApproval("search_candidates")).toBe(false);
      expect(toolRequiresApproval("screen_resume")).toBe(false);
      expect(toolRequiresApproval("get_sourcing_workflow")).toBe(false);
    });

    it("returns false for unknown tool names", () => {
      expect(toolRequiresApproval("unknown_tool")).toBe(false);
      expect(toolRequiresApproval("")).toBe(false);
    });
  });

  describe("executeTool", () => {
    describe("approval-required tools (stub behavior)", () => {
      it("send_outreach returns stub with would_send_to and subject", async () => {
        const result = await executeTool("send_outreach", {
          candidate_email: "jane@example.com",
          subject: "Interview",
          body: "Hi",
        });
        const parsed = JSON.parse(result) as { would_send_to?: string; subject?: string; status?: string };
        expect(parsed.would_send_to).toBe("jane@example.com");
        expect(parsed.subject).toBe("Interview");
        expect(parsed.status).toBe("simulated");
      });

      it("schedule_interview returns stub with candidate_email and booking_link", async () => {
        const result = await executeTool("schedule_interview", {
          candidate_email: "bob@example.com",
          duration_minutes: 45,
        });
        const parsed = JSON.parse(result) as { candidate_email?: string; duration_minutes?: number; booking_link?: string };
        expect(parsed.candidate_email).toBe("bob@example.com");
        expect(parsed.duration_minutes).toBe(45);
        expect(parsed.booking_link).toBeDefined();
      });

      it("update_ats returns stub with candidate_email and status", async () => {
        const result = await executeTool("update_ats", {
          candidate_email: "alice@example.com",
          status: "scheduled",
        });
        const parsed = JSON.parse(result) as { candidate_email?: string; status?: string; ats_id?: string };
        expect(parsed.candidate_email).toBe("alice@example.com");
        expect(parsed.status).toBe("scheduled");
        expect(parsed.ats_id).toBeDefined();
      });
    });

    describe("auto-execute tools", () => {
      it("search_candidates returns list of candidates", async () => {
        const result = await executeTool("search_candidates", {
          job_title: "Engineer",
          location: "Toronto",
          max_results: 3,
        });
        const parsed = JSON.parse(result) as { candidates?: unknown[]; total?: number };
        expect(Array.isArray(parsed.candidates)).toBe(true);
        expect(parsed.candidates!.length).toBe(3);
        expect(parsed.total).toBe(3);
      });

      it("screen_resume returns score and summary", async () => {
        const result = await executeTool("screen_resume", {
          job_title: "Backend",
          resume_text: "Experience with Go",
        });
        const parsed = JSON.parse(result) as { score?: number; summary?: string };
        expect(typeof parsed.score).toBe("number");
        expect(parsed.score).toBeGreaterThanOrEqual(60);
        expect(parsed.score).toBeLessThanOrEqual(100);
        expect(typeof parsed.summary).toBe("string");
      });

      it("get_sourcing_workflow returns workflow text", async () => {
        const result = await executeTool("get_sourcing_workflow", {
          job_title: "Backend Engineer",
          location: "Toronto",
        });
        const parsed = JSON.parse(result) as { workflow?: string; job_title?: string; location?: string };
        expect(typeof parsed.workflow).toBe("string");
        expect(parsed.workflow!.length).toBeGreaterThan(0);
        expect(parsed.job_title).toBe("Backend Engineer");
        expect(parsed.location).toBe("Toronto");
      });
    });

    it("returns error JSON for unknown tool", async () => {
      const result = await executeTool("unknown_tool", {});
      const parsed = JSON.parse(result) as { error?: string };
      expect(parsed.error).toContain("Unknown tool");
      expect(parsed.error).toContain("unknown_tool");
    });
  });

  describe("AGENT_TOOLS", () => {
    it("defines all expected tool names", () => {
      const names = AGENT_TOOLS.map((t) => t.function.name).filter(Boolean);
      expect(names).toContain("search_candidates");
      expect(names).toContain("screen_resume");
      expect(names).toContain("send_outreach");
      expect(names).toContain("schedule_interview");
      expect(names).toContain("update_ats");
      expect(names).toContain("get_sourcing_workflow");
      expect(names.length).toBe(6);
    });
  });
});
