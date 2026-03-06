"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

/* ─────────────────────────────────────────────────────────────────────────────
   SeeknimblyAI — Agentic HR for Founders
   Swiss-grid · Playfair Display + DM Mono / DM Sans · Black ink on white
───────────────────────────────────────────────────────────────────────────── */

const GOOGLE_FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=DM+Sans:wght@300;400;500;600&display=swap');
`;

const C = {
  white: "#FFFFFF",
  offWhite: "#F7F6F3",
  paper: "#FAFAF8",
  black: "#0A0A0A",
  ink: "#1A1A1A",
  mid: "#4A4A4A",
  light: "#8A8A8A",
  border: "#E2E0DA",
  borderDk: "#C8C5BC",
  tag: "#F0EDE6",
};

function Tag({
  children,
  style = {},
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: "'DM Mono', monospace",
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: C.mid,
        background: C.tag,
        border: `1px solid ${C.border}`,
        padding: "4px 10px",
        borderRadius: 2,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function Divider({ style = {} }: { style?: React.CSSProperties }) {
  return <div style={{ width: "100%", height: 1, background: C.border, ...style }} />;
}

function useCounter(target: number, duration = 1800, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const prog = Math.min((ts - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - prog, 3);
      setVal(Math.floor(ease * target));
      if (prog < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return val;
}

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setInView(true);
      },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, inView] as const;
}

const CHAT_SEQUENCE = [
  { from: "founder", name: "Alex (CEO)", text: "Got a letter from the Texas Comptroller — no idea what to do 😬", time: "9:02 AM" },
  { from: "ai", name: "Nimble", text: "On it. That's a state tax registration notice. I'll register you with TX today and set up payroll taxes before your next hire.", time: "9:02 AM" },
  { from: "founder", name: "Alex (CEO)", text: "We're also hiring in Ontario next week — different rules?", time: "9:03 AM" },
  { from: "ai", name: "Nimble", text: "Yes — Ontario ESA uses a 44-hour overtime threshold (not 40 like US FLSA), plus French language requirements if you're hiring in Quebec. I'll prep compliant offer letters for both.", time: "9:03 AM" },
  { from: "founder", name: "Alex (CEO)", text: "That's incredible. You just saved me a week of research 🙏", time: "9:04 AM" },
  { from: "ai", name: "Nimble", text: "That's exactly why we exist. I've queued the state registrations and flagged 2 compliance items for your review. All clear by EOD.", time: "9:04 AM" },
];

function ChatDemo() {
  const [visible, setVisible] = useState(1);
  const [ref, inView] = useInView(0.3);
  useEffect(() => {
    if (!inView) return;
    if (visible >= CHAT_SEQUENCE.length) return;
    const t = setTimeout(() => setVisible((v) => v + 1), 900);
    return () => clearTimeout(t);
  }, [inView, visible]);

  return (
    <div
      ref={ref}
      style={{
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
        maxWidth: 520,
        width: "100%",
      }}
    >
      <div
        style={{
          background: C.black,
          color: C.white,
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: C.white,
            color: C.black,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "'Playfair Display', serif",
          }}
        >
          N
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
            Nimble · SeeknimblyAI
          </div>
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.5)",
              fontFamily: "'DM Mono', monospace",
              letterSpacing: "0.08em",
            }}
          >
            ALWAYS ON · COMPLIANCE + PAYROLL + HR
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
          {[C.white, "rgba(255,255,255,0.4)", "rgba(255,255,255,0.2)"].map((c, i) => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
          ))}
        </div>
      </div>
      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12, minHeight: 320 }}>
        {CHAT_SEQUENCE.slice(0, visible).map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: msg.from === "founder" ? "row-reverse" : "row",
              gap: 8,
              alignItems: "flex-end",
              animation: "fadeUp 0.35s ease forwards",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                flexShrink: 0,
                background: msg.from === "ai" ? C.black : C.tag,
                border: `1px solid ${C.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                color: msg.from === "ai" ? C.white : C.mid,
                fontFamily: "'DM Mono', monospace",
              }}
            >
              {msg.from === "ai" ? "N" : "A"}
            </div>
            <div style={{ maxWidth: "72%" }}>
              <div
                style={{
                  background: msg.from === "ai" ? C.black : C.offWhite,
                  color: msg.from === "ai" ? C.white : C.ink,
                  padding: "10px 14px",
                  borderRadius: msg.from === "ai" ? "12px 12px 12px 3px" : "12px 12px 3px 12px",
                  fontSize: 12.5,
                  fontFamily: "'DM Sans', sans-serif",
                  lineHeight: 1.55,
                  border: `1px solid ${msg.from === "ai" ? C.black : C.border}`,
                }}
              >
                {msg.text}
              </div>
              <div
                style={{
                  fontSize: 9.5,
                  color: C.light,
                  fontFamily: "'DM Mono', monospace",
                  marginTop: 4,
                  textAlign: msg.from === "founder" ? "right" : "left",
                  letterSpacing: "0.06em",
                }}
              >
                {msg.name} · {msg.time}
              </div>
            </div>
          </div>
        ))}
        {visible < CHAT_SEQUENCE.length && (
          <div style={{ display: "flex", gap: 4, padding: "4px 0 0 36px" }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: C.light,
                  animation: `bounce 1.2s ease ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const SERVICES = [
  { num: "01", title: "State Registration & Compliance", desc: "Multi-state tax registration, payroll setup, and ongoing compliance monitoring across all 50 US states plus Canada.", tags: ["All 50 States", "Canada", "Real-Time"] },
  { num: "02", title: "Payroll Management", desc: "Accurate, on-time payroll every cycle. We handle the complexity so your team gets paid correctly and you stay compliant.", tags: ["US + Canada", "Multi-Currency", "Automated"] },
  { num: "03", title: "Benefits Administration", desc: "Evaluate, enroll, and manage health insurance and benefits with transparent comparisons and real-time cost analytics.", tags: ["Health", "401k", "Benchmarked"] },
  { num: "04", title: "Onboarding & Offboarding", desc: "Compliant offer letters, I-9 verification, equipment provisioning, and graceful exits — all handled end to end.", tags: ["Day 1 Ready", "Compliant Docs", "Any State"] },
  { num: "05", title: "HR Compliance Monitoring", desc: "Agentic AI watches for FLSA violations, misclassification risks, PIPEDA deadlines, and Quebec Bill 96 — before they become fines.", tags: ["Proactive", "Agentic AI", "Audit Trail"] },
  { num: "06", title: "HR Back Office", desc: "Day-to-day HR operations: employee handbook updates, policy management, performance review cycles, and more.", tags: ["Ongoing", "On-Demand", "Expert-Led"] },
];

const TESTIMONIALS = [
  { name: "Alex V.", role: "Founder, Kivo Health", quote: "The key win is not being randomized anymore by HR chaos. Nimble has it covered — always." },
  { name: "Trey H.", role: "CEO, TENNR", quote: "Saves me 10+ hours a week on payroll and HR back office. Best investment I've made as a founder." },
  { name: "Georgia B.", role: "Executive Dir, Superbloom", quote: "As a small non-profit, having access to this depth of HR expertise at this price is extraordinary." },
  { name: "Yuran L.", role: "CTO, System2 Technologies", quote: "Super responsive. They follow up to make sure everything that needs to get done, gets done." },
  { name: "Atul R.", role: "Co-Founder & CTO, Hyperbound", quote: "Taken HR and back office tasks completely off my plate. That peace of mind is priceless for a founder." },
  { name: "Eric C.", role: "Executive Dir, Michigan Sleep", quote: "Reassuring knowing we have HR experts we can call upon 7 days a week. Incredible team." },
];

const STATS = [
  { value: 20, suffix: "+", label: "Hours saved per week" },
  { value: 50, suffix: "", label: "US states covered" },
  { value: 92, suffix: "%", label: "Fine reduction for clients" },
  { value: 4, suffix: "h", label: "Average response time" },
];

const COMPATIBLE = ["Rippling", "BambooHR", "Gusto", "Workday", "Ceridian", "ADP", "Greenhouse", "Lever", "QuickBooks", "Lattice"];

const COMPLIANCE_ITEMS = [
  { flag: "US", jur: "US Federal", rule: "FLSA Overtime — 40hr threshold", sev: "Critical" },
  { flag: "US", jur: "California", rule: "Pay Transparency SB 1162", sev: "Critical" },
  { flag: "US", jur: "California", rule: "Contractor ABC Test (AB5)", sev: "High" },
  { flag: "CA", jur: "Quebec", rule: "Bill 96 — French Language Requirement", sev: "Critical" },
  { flag: "CA", jur: "Ontario", rule: "ESA Overtime — 44hr threshold", sev: "High" },
  { flag: "CA", jur: "Canada Fed", rule: "PIPEDA — 30-Day Data Access Response", sev: "High" },
];

const HOW_STEPS = [
  { n: "1", title: "Connect your HRIS", desc: "Link Rippling, BambooHR, Ceridian, or any HR platform in 2 minutes. Your data stays yours." },
  { n: "2", title: "Nimble scans constantly", desc: "Our AI agent runs 24/7 — monitoring compliance rules across 50 states + Canada, flagging issues before they become fines." },
  { n: "3", title: "You approve, we execute", desc: "Nimble recommends. You decide. Once approved, we handle state registration, payroll setup, and compliance filing — end to end." },
  { n: "4", title: "Audit-ready always", desc: "Every action is logged with a citation, timestamp, and human decision. Board-ready compliance reports in one click." },
];

const PLANS = [
  { name: "Starter", price: "$799", period: "/mo", desc: "Perfect for seed-stage startups with a small team.", features: ["Up to 25 employees", "All 50 US states", "Payroll + compliance", "Slack support (48h SLA)", "Monthly HR report"] },
  { name: "Growth", price: "$1,999", period: "/mo", desc: "Growing teams across US and Canada, scaling fast.", features: ["Up to 150 employees", "US + Canada", "Proactive compliance agent", "Slack support (4h SLA)", "Weekly board report", "Benefits admin included"], highlight: true },
  { name: "Enterprise", price: "Custom", period: "", desc: "Multi-country, complex structures, dedicated expert.", features: ["Unlimited employees", "Global coverage", "Dedicated HR partner", "Slack + phone (1h SLA)", "Custom audit reports", "SOC 2 ready"] },
];

const LANDING_CSS = `
  ${GOOGLE_FONTS}
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes bounce { 0%,80%,100% { transform:translateY(0); } 40% { transform:translateY(-5px); } }
  @keyframes marquee { from { transform:translateX(0); } to { transform:translateX(-50%); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
  ::selection { background: #0A0A0A; color: #fff; }
  input:focus, textarea:focus { outline: 2px solid #0A0A0A; outline-offset: 2px; }
`;

export function LandingPage() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [activeService, setActiveService] = useState(0);
  const [statsRef, statsInView] = useInView(0.3);
  const [trialOpen, setTrialOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const s0 = useCounter(STATS[0].value, 1600, statsInView);
  const s1 = useCounter(STATS[1].value, 1800, statsInView);
  const s2 = useCounter(STATS[2].value, 2000, statsInView);
  const s3 = useCounter(STATS[3].value, 1200, statsInView);
  const statVals = [s0, s1, s2, s3];

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleTrialSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          company_name: companyName.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      setSubmitted(true);
      setTrialOpen(false);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const openTrial = () => setTrialOpen(true);

  return (
    <div style={{ background: C.white, minHeight: "100vh", color: C.ink }}>
      <style>{LANDING_CSS}</style>

      {/* Nav */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: navScrolled ? "rgba(255,255,255,0.96)" : C.white,
          backdropFilter: navScrolled ? "blur(12px)" : "none",
          borderBottom: navScrolled ? `1px solid ${C.border}` : "1px solid transparent",
          transition: "all 0.3s ease",
        }}
      >
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 32px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                background: C.black,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Playfair Display', serif",
                fontWeight: 900,
                color: C.white,
                fontSize: 14,
              }}
            >
              S
            </div>
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 17, color: C.black, letterSpacing: "-0.02em" }}>
              Seeknimbly<span style={{ fontStyle: "italic" }}>AI</span>
            </span>
          </div>
          <div style={{ display: "flex", gap: 36, alignItems: "center" }}>
            <a href="#services" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: C.mid, textDecoration: "none" }}>Services</a>
            <a href="#how" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: C.mid, textDecoration: "none" }}>How It Works</a>
            <a href="#pricing" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: C.mid, textDecoration: "none" }}>Pricing</a>
            <Link href="/login" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: C.mid, textDecoration: "none" }}>Sign in</Link>
          </div>
          <button
            type="button"
            onClick={openTrial}
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: C.white,
              background: C.black,
              padding: "9px 20px",
              borderRadius: 4,
              border: `1.5px solid ${C.black}`,
              cursor: "pointer",
            }}
          >
            Get started →
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ paddingTop: 140, paddingBottom: 100, maxWidth: 1160, margin: "0 auto", padding: "140px 32px 100px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          <div style={{ animation: "fadeUp 0.7s ease forwards" }}>
            <Tag style={{ marginBottom: 24 }}>Agentic HR for Founders · US + Canada</Tag>
            <h1
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(42px, 5vw, 64px)",
                fontWeight: 900,
                lineHeight: 1.05,
                color: C.black,
                letterSpacing: "-0.03em",
                marginBottom: 10,
              }}
            >
              HR That Works
              <br />
              <span style={{ fontStyle: "italic", fontWeight: 400 }}>While You Sleep.</span>
            </h1>
            <div style={{ height: 3, background: C.black, width: 60, marginBottom: 28, marginTop: 8 }} />
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 17,
                color: C.mid,
                lineHeight: 1.65,
                marginBottom: 36,
                fontWeight: 300,
                maxWidth: 460,
              }}
            >
              SeeknimblyAI is your always-on HR agent — handling payroll, compliance, onboarding, and benefits across all 50 US states and Canada. Save 20+ hours every week.
            </p>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 48 }}>
              <button
                type="button"
                onClick={openTrial}
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.white,
                  background: C.black,
                  padding: "13px 28px",
                  borderRadius: 4,
                  border: `1.5px solid ${C.black}`,
                  cursor: "pointer",
                }}
              >
                Start 15-day free trial →
              </button>
              <a
                href="#how"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 400,
                  color: C.black,
                  textDecoration: "none",
                  padding: "13px 28px",
                  borderRadius: 4,
                  border: `1.5px solid ${C.border}`,
                  display: "inline-block",
                }}
              >
                Watch intro ▶
              </a>
            </div>
            <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
              {["YC-backed founders", "General Catalyst", "50 states + Canada"].map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.black }} />
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: C.light, letterSpacing: "0.06em" }}>{t.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ animation: "fadeUp 0.7s ease 0.2s both", display: "flex", justifyContent: "center" }}>
            <ChatDemo />
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 64, padding: "24px 0", borderTop: `1px solid ${C.border}` }}>
          {["Offer Letters", "State Registration", "Payroll Taxes", "Benefits Admin", "I-9 Verification", "HR Audits", "FLSA Compliance", "Quebec Bill 96", "Ontario ESA", "PIPEDA", "Employee Handbook", "Onboarding Packs"].map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      </section>

      {/* Logos marquee */}
      <section style={{ padding: "48px 0", borderBottom: `1px solid ${C.border}`, overflow: "hidden" }}>
        <div style={{ marginBottom: 20, textAlign: "center" }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: C.light, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Fully compatible with your existing HR stack
          </span>
        </div>
        <div style={{ display: "flex", animation: "marquee 22s linear infinite", width: "max-content" }}>
          {[...COMPATIBLE, ...COMPATIBLE].map((name, i) => (
            <div
              key={i}
              style={{
                margin: "0 24px",
                fontFamily: "'Playfair Display', serif",
                fontSize: 15,
                fontWeight: 700,
                color: C.light,
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 10, color: C.border, fontFamily: "monospace" }}>◆</span>
              {name}
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section
        ref={statsRef}
        style={{ background: C.black, padding: "60px 32px" }}
      >
        <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
          {STATS.map((s, i) => (
            <div
              key={i}
              style={{
                textAlign: "center",
                padding: "0 32px",
                borderRight: i < STATS.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none",
              }}
            >
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 56,
                  fontWeight: 900,
                  color: C.white,
                  lineHeight: 1,
                  letterSpacing: "-0.03em",
                  marginBottom: 8,
                }}
              >
                {statVals[i]}
                {s.suffix}
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  color: "rgba(255,255,255,0.4)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" style={{ maxWidth: 1160, margin: "0 auto", padding: "100px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 80 }}>
          <div>
            <Tag style={{ marginBottom: 20 }}>Services</Tag>
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 38,
                fontWeight: 900,
                color: C.black,
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                marginBottom: 20,
              }}
            >
              One Stop.
              <br />
              <span style={{ fontStyle: "italic", fontWeight: 400 }}>End to End.</span>
            </h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: C.mid, lineHeight: 1.6, fontWeight: 300 }}>
              Every HR function your startup needs — handled by AI agents backed by expert HR consultants.
            </p>
          </div>
          <div>
            {SERVICES.map((svc, i) => (
              <div
                key={i}
                onClick={() => setActiveService(activeService === i ? -1 : i)}
                style={{ borderTop: `1px solid ${C.border}`, cursor: "pointer" }}
              >
                <div style={{ padding: "24px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 8 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: C.light, letterSpacing: "0.1em" }}>{svc.num}</span>
                      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: C.black, letterSpacing: "-0.02em" }}>{svc.title}</h3>
                    </div>
                    {activeService === i && (
                      <div style={{ animation: "fadeUp 0.25s ease forwards", paddingLeft: 32 }}>
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: C.mid, lineHeight: 1.65, marginBottom: 14 }}>{svc.desc}</p>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {svc.tags.map((t) => (
                            <Tag key={t}>{t}</Tag>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      border: `1.5px solid ${activeService === i ? C.black : C.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      flexShrink: 0,
                      marginTop: 2,
                      background: activeService === i ? C.black : "transparent",
                      color: activeService === i ? C.white : C.mid,
                    }}
                  >
                    {activeService === i ? "−" : "+"}
                  </div>
                </div>
              </div>
            ))}
            <Divider />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ background: C.offWhite, padding: "100px 32px", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ marginBottom: 60 }}>
            <Tag style={{ marginBottom: 16 }}>How it works</Tag>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 900, color: C.black, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              From chaos to clarity
              <br />
              <span style={{ fontStyle: "italic", fontWeight: 400 }}>in four steps.</span>
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32 }}>
            {HOW_STEPS.map((step, i) => (
              <div key={i}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: C.black,
                    color: C.white,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 700,
                    fontSize: 16,
                    marginBottom: 20,
                  }}
                >
                  {step.n}
                </div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: C.black, marginBottom: 10, letterSpacing: "-0.02em" }}>{step.title}</h3>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: C.mid, lineHeight: 1.65, fontWeight: 300 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "100px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 80, alignItems: "start" }}>
          <div>
            <Tag style={{ marginBottom: 20 }}>Compliance Coverage</Tag>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 38, fontWeight: 900, color: C.black, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 20 }}>
              50 States.
              <br />
              All of Canada.
              <br />
              <span style={{ fontStyle: "italic", fontWeight: 400 }}>Always current.</span>
            </h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: C.mid, lineHeight: 1.65, fontWeight: 300, marginBottom: 32 }}>
              Nimble monitors 100+ labor regulations in real time. When a new law takes effect, your account updates automatically.
            </p>
          </div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ background: C.black, padding: "12px 20px", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em" }}>ACTIVE COMPLIANCE RULES</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>LIVE MONITORING</span>
            </div>
            {COMPLIANCE_ITEMS.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 20px",
                  borderBottom: i < COMPLIANCE_ITEMS.length - 1 ? `1px solid ${C.border}` : "none",
                  background: i % 2 === 0 ? C.white : C.paper,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: C.ink, fontWeight: 500, marginBottom: 2 }}>{item.rule}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, color: C.light, letterSpacing: "0.06em" }}>{item.jur}</div>
                </div>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 9,
                    fontWeight: 500,
                    color: "#C0392B",
                    background: "#C0392B14",
                    border: "1px solid #C0392B33",
                    padding: "2px 8px",
                    borderRadius: 2,
                    letterSpacing: "0.08em",
                  }}
                >
                  {item.sev.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section style={{ background: C.black, padding: "100px 32px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ marginBottom: 60 }}>
            <Tag style={{ marginBottom: 16, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}>What founders say</Tag>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 38, fontWeight: 900, color: C.white, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              Built for
              <br />
              <span style={{ fontStyle: "italic", fontWeight: 400 }}>founders who move fast.</span>
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "rgba(255,255,255,0.06)" }}>
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                style={{
                  background: C.black,
                  padding: "36px 32px",
                  borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}
              >
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 42, color: "rgba(255,255,255,0.08)", lineHeight: 1, marginBottom: 16, fontWeight: 900 }}>"</div>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, marginBottom: 24, fontWeight: 300 }}>{t.quote}</p>
                <Divider style={{ background: "rgba(255,255,255,0.08)", marginBottom: 16 }} />
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: C.white }}>{t.name}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 3, letterSpacing: "0.06em" }}>{t.role.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ maxWidth: 1160, margin: "0 auto", padding: "100px 32px" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <Tag style={{ marginBottom: 16 }}>Pricing</Tag>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 900, color: C.black, letterSpacing: "-0.03em" }}>
            Transparent pricing.
            <br />
            <span style={{ fontStyle: "italic", fontWeight: 400 }}>No surprises.</span>
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          {PLANS.map((plan, i) => (
            <div
              key={i}
              style={{
                padding: "40px 32px",
                background: plan.highlight ? C.black : C.white,
                borderRight: i < PLANS.length - 1 ? `1px solid ${plan.highlight ? "rgba(255,255,255,0.1)" : C.border}` : "none",
              }}
            >
              {plan.highlight && (
                <Tag style={{ marginBottom: 16, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>Most Popular</Tag>
              )}
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: plan.highlight ? "rgba(255,255,255,0.4)" : C.light, letterSpacing: "0.1em", marginBottom: 8 }}>{plan.name.toUpperCase()}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 8 }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 44, fontWeight: 900, color: plan.highlight ? C.white : C.black, letterSpacing: "-0.03em" }}>{plan.price}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: plan.highlight ? "rgba(255,255,255,0.35)" : C.light }}>{plan.period}</span>
              </div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: plan.highlight ? "rgba(255,255,255,0.5)" : C.light, marginBottom: 28, lineHeight: 1.55 }}>{plan.desc}</p>
              <Divider style={{ background: plan.highlight ? "rgba(255,255,255,0.08)" : C.border, marginBottom: 24 }} />
              {plan.features.map((f, fi) => (
                <div key={fi} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                  <span style={{ color: plan.highlight ? "rgba(255,255,255,0.5)" : C.mid, fontSize: 13 }}>✓</span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: plan.highlight ? "rgba(255,255,255,0.75)" : C.mid }}>{f}</span>
                </div>
              ))}
              <button
                type="button"
                onClick={openTrial}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "center",
                  marginTop: 28,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  color: plan.highlight ? C.black : C.white,
                  background: plan.highlight ? C.white : C.black,
                  padding: "12px 0",
                  borderRadius: 4,
                  border: `1.5px solid ${plan.highlight ? C.white : C.black}`,
                  cursor: "pointer",
                }}
              >
                Get started →
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: C.offWhite, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "80px 32px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <Tag style={{ marginBottom: 20 }}>Get started</Tag>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 900, color: C.black, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 16 }}>
            Turn HR chaos
            <br />
            <span style={{ fontStyle: "italic", fontWeight: 400 }}>into clarity today.</span>
          </h2>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: C.mid, marginBottom: 24, lineHeight: 1.6, fontWeight: 300 }}>
            15-day free trial. Add your work email — we’ll send a link to access the app. Cancel anytime.
          </p>
          <button
            type="button"
            onClick={openTrial}
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              color: C.white,
              background: C.black,
              padding: "13px 32px",
              borderRadius: 4,
              border: `1.5px solid ${C.black}`,
              cursor: "pointer",
            }}
          >
            Start 15-day free trial →
          </button>
          {submitted && (
            <p style={{ marginTop: 16, fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: C.mid }} role="status">
              Check your email for a link to access the app.
            </p>
          )}
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: C.light, letterSpacing: "0.08em", marginTop: 24 }}>
            NO COMMITMENT · CANCEL ANYTIME · 15 DAYS FREE
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: C.white, borderTop: `1px solid ${C.border}`, padding: "60px 32px 40px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 60, marginBottom: 48 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <div style={{ width: 26, height: 26, background: C.black, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display', serif", fontWeight: 900, color: C.white, fontSize: 12 }}>S</div>
                <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 16, color: C.black, letterSpacing: "-0.02em" }}>Seeknimbly<span style={{ fontStyle: "italic" }}>AI</span></span>
              </div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: C.mid, lineHeight: 1.65, fontWeight: 300, maxWidth: 260 }}>
                Agentic HR for founders. US + Canada. Always on, always compliant.
              </p>
              <div style={{ marginTop: 20, fontFamily: "'DM Mono', monospace", fontSize: 10, color: C.light, letterSpacing: "0.06em" }}>
                Vancouver BC · San Francisco, CA
              </div>
            </div>
            {[
              { title: "Services", links: ["Payroll", "Compliance", "Benefits", "Onboarding", "HR Audit", "Back Office"] },
              { title: "Company", links: ["About", "Blog", "Pricing", "FAQ"] },
              { title: "Resources", links: ["Privacy Policy", "Terms", "API Docs"] },
            ].map((col) => (
              <div key={col.title}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: C.light, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>{col.title}</div>
                {col.links.map((l) => (
                  <a key={l} href="#" style={{ display: "block", fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: C.mid, textDecoration: "none", marginBottom: 8 }}>{l}</a>
                ))}
              </div>
            ))}
          </div>
          <Divider />
          <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: C.light, letterSpacing: "0.06em" }}>© 2026 SeeknimblyAI Inc. All rights reserved.</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: C.light, letterSpacing: "0.06em" }}>NOT LEGAL OR TAX ADVICE</span>
          </div>
        </div>
      </footer>

      {/* Trial modal — 15-day free trial */}
      {trialOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.6)" }}
          aria-modal="true"
          role="dialog"
          aria-labelledby="trial-title"
        >
          <div style={{ width: "100%", maxWidth: 440, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, boxShadow: "0 24px 48px rgba(0,0,0,0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <h2 id="trial-title" style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: C.black }}>
                Start your 15-day free trial
              </h2>
              <button
                type="button"
                onClick={() => { setTrialOpen(false); setError(null); }}
                style={{ padding: 8, border: "none", background: "none", cursor: "pointer", color: C.mid }}
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: C.mid, marginBottom: 24, lineHeight: 1.55 }}>
              Enter your work email. We’ll send a sign-in link — then you’ll set up payment (no charge for 15 days). Cancel anytime.
            </p>
            <form onSubmit={handleTrialSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label htmlFor="trial-email" style={{ display: "block", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: C.mid, marginBottom: 6 }}>Work email</label>
                <input
                  id="trial-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  style={{ width: "100%", padding: "12px 14px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: C.ink }}
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label htmlFor="trial-company" style={{ display: "block", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: C.mid, marginBottom: 6 }}>Company name (optional)</label>
                <input
                  id="trial-company"
                  name="company_name"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={loading}
                  style={{ width: "100%", padding: "12px 14px", border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: C.ink }}
                  placeholder="Acme Inc."
                />
              </div>
              {error && <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#C0392B" }} role="alert">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "14px",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.white,
                  background: C.black,
                  border: `1.5px solid ${C.black}`,
                  borderRadius: 4,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Sending…" : "Get trial link →"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}