"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Channel = {
  id: string;
  label: string;
  blurb: string;
  fields: { key: string; label: string; help: string; placeholder: string }[];
  guide: string;
};

const CHANNELS: Channel[] = [
  {
    id: "email",
    label: "Email (Resend)",
    blurb: "Send approved outreach, offers, and briefs by email.",
    fields: [
      { key: "from", label: "From address", help: "Verified sender on your Resend domain.", placeholder: "hello@seeknimbly.ai" },
      { key: "reply_to", label: "Reply-to", help: "Where candidate/client replies land.", placeholder: "nisar@seeknimbly.ai" },
    ],
    guide: "Set RESEND_API_KEY in the server environment (.env.local / Vercel). Approved email drafts can then be transmitted.",
  },
  {
    id: "slack",
    label: "Slack",
    blurb: "Approval notifications and daily agent digests in a channel.",
    fields: [{ key: "webhook", label: "Incoming webhook URL", help: "From Slack → Apps → Incoming Webhooks.", placeholder: "https://hooks.slack.com/services/…" }],
    guide: "Create an incoming webhook in your Slack workspace and paste it here.",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    blurb: "Candidate and prospect outreach drafts (manual send).",
    fields: [],
    guide: "LinkedIn has no messaging API for this use case — approved LinkedIn drafts are copy/paste from the Approvals page. CASL tip: LinkedIn is the preferred cold channel in Canada.",
  },
  {
    id: "sms",
    label: "SMS (Twilio)",
    blurb: "Interview reminders and check-in nudges.",
    fields: [{ key: "from_number", label: "From number", help: "Your Twilio number.", placeholder: "+1 555 0100" }],
    guide: "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in the server environment.",
  },
];

const CORE = [
  { key: "openai", label: "OpenAI", blurb: "Powers the agents and router" },
  { key: "supabase", label: "Supabase", blurb: "Persistence: ATS, CRM, outbox, audit, memory" },
  { key: "stripe", label: "Stripe", blurb: "Billing and trials" },
  { key: "resend", label: "Resend", blurb: "Email transmission" },
  { key: "cron", label: "Cron secret", blurb: "Secures scheduled automations" },
  { key: "stackone", label: "StackOne", blurb: "HCM MCP — Workday, ADP, Dayforce (/app/plugins)" },
  { key: "openrouter", label: "OpenRouter", blurb: "Multi-model router (/app model picker)" },
  { key: "ollama", label: "Ollama", blurb: "Local models — OLLAMA_ENABLED=1" },
  { key: "huggingface", label: "Hugging Face", blurb: "HF Inference via HF_TOKEN" },
] as const;

const STORE_KEY = "seeknimbly_messaging_config";

type Config = Record<string, Record<string, string>>;

function loadConfig(): Config {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") as Config;
  } catch {
    return {};
  }
}

export default function MessagingPage() {
  const [selected, setSelected] = useState<string>(CHANNELS[0].id);
  const [config, setConfig] = useState<Config>({});
  const [saved, setSaved] = useState(false);
  const [core, setCore] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    setConfig(loadConfig());
    fetch("/api/connectors")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { connectors?: Record<string, boolean> } | null) => setCore(d?.connectors ?? null))
      .catch(() => setCore(null));
  }, []);

  const current = useMemo(() => CHANNELS.find((c) => c.id === selected)!, [selected]);
  const currentValues = config[current.id] ?? {};
  const isConfigured = current.fields.length > 0 && current.fields.every((f) => (currentValues[f.key] ?? "").trim());

  const setField = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [current.id]: { ...(prev[current.id] ?? {}), [key]: value } }));
    setSaved(false);
  };

  const save = () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(config));
      setSaved(true);
    } catch {
      // ignore
    }
  };

  return (
    <div className="h-screen supports-[height:100dvh]:h-[100dvh] flex flex-col bg-[var(--bg)] text-[var(--text)] overflow-hidden">
      <header className="shrink-0 border-b border-[var(--border)] px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/app" className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)]">← Chat</Link>
        <h1 className="text-[16px] sm:text-[17px] font-semibold flex-1 min-w-[120px]">Messaging & Connectors</h1>
        <span className="text-[12px] text-[var(--text-tertiary)]">Delivery channels for approved drafts</span>
      </header>
      <div className="flex-1 min-h-0 flex">
        <div className="w-full md:w-[320px] shrink-0 overflow-y-auto border-r border-[var(--border)] p-2">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Channels</p>
          <ul className="space-y-1">
            {CHANNELS.map((c) => {
              const values = config[c.id] ?? {};
              const configured = c.fields.length > 0 && c.fields.every((f) => (values[f.key] ?? "").trim());
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${selected === c.id ? "bg-[var(--surface-hover)]" : "hover:bg-[var(--surface-hover)]"}`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-medium truncate">{c.label}</span>
                      <span className="block text-[12px] text-[var(--text-tertiary)] truncate">{c.blurb}</span>
                    </span>
                    <span className={`shrink-0 w-2 h-2 rounded-full ${configured ? "bg-emerald-500" : "bg-[var(--border-strong)]"}`} aria-label={configured ? "Configured" : "Needs setup"} />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Core connectors</p>
          <ul className="space-y-1 pb-2">
            {CORE.map((c) => (
              <li key={c.key} className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium truncate">{c.label}</span>
                  <span className="block text-[11.5px] text-[var(--text-tertiary)] truncate">{c.blurb}</span>
                </span>
                <span
                  className={`shrink-0 w-2 h-2 rounded-full ${core === null ? "bg-[var(--border-strong)]" : core[c.key] ? "bg-emerald-500" : "bg-amber-400"}`}
                  aria-label={core === null ? "Unknown" : core[c.key] ? "Connected" : "Not configured"}
                />
              </li>
            ))}
          </ul>
          {core === null && <p className="px-3 pb-3 text-[11px] text-[var(--text-tertiary)]">Sign in to see connector status.</p>}
        </div>
        <div className="hidden md:block flex-1 min-w-0 overflow-y-auto p-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-[22px] font-semibold">{current.label}</h2>
              <span className={`text-[11px] uppercase tracking-wider px-2 py-0.5 rounded ${isConfigured ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"}`}>
                {isConfigured ? "Configured" : "Needs setup"}
              </span>
            </div>
            <p className="mt-2 text-[14px] text-[var(--text-secondary)]">{current.blurb}</p>
            <p className="mt-3 text-[13px] text-[var(--text-tertiary)] leading-relaxed">{current.guide}</p>
            <p className="mt-3 text-[12px] text-[var(--text-tertiary)]">
              Reminder: agents only draft. Even with a channel configured, nothing is sent until a human approves it in the{" "}
              <Link href="/app/approvals" className="text-[var(--accent)] hover:underline">Approvals outbox</Link>.
            </p>
            {current.fields.length > 0 && (
              <div className="mt-8 space-y-5">
                {current.fields.map((f) => (
                  <div key={f.key}>
                    <label className="block text-[14px] font-medium mb-1" htmlFor={`${current.id}-${f.key}`}>{f.label}</label>
                    <p className="text-[12px] text-[var(--text-tertiary)] mb-1.5">{f.help}</p>
                    <input
                      id={`${current.id}-${f.key}`}
                      value={currentValues[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full h-10 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[14px] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={save}
                    className="h-9 px-4 rounded-lg bg-[var(--accent)] text-white text-[13px] font-medium hover:bg-[var(--accent-hover)]"
                  >
                    Save changes
                  </button>
                  {saved && <span className="text-[12px] text-emerald-500">Saved</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
