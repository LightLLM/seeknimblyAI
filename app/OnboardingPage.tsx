"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
  getOnboardingChecklist,
  setOnboardingItemDone,
  resetOnboardingChecklist,
  type OnboardingItem,
} from "@/lib/storage";

const JURISDICTIONS = ["NA", "CA", "US"] as const;
type Jurisdiction = (typeof JURISDICTIONS)[number];
const MAX_MESSAGE_LENGTH = 4000;

export function OnboardingPage() {
  const [items, setItems] = useState<OnboardingItem[]>([]);
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("NA");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(getOnboardingChecklist());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const toggleItem = useCallback((id: string) => {
    const list = getOnboardingChecklist();
    const item = list.find((i) => i.id === id);
    if (!item) return;
    setOnboardingItemDone(id, !item.done);
    setItems(getOnboardingChecklist());
  }, []);

  const handleResetChecklist = useCallback(() => {
    if (typeof window !== "undefined" && window.confirm("Reset all checklist items?")) {
      resetOnboardingChecklist();
      setItems(getOnboardingChecklist());
    }
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
      setError(`Keep messages under ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setStreamingText("");

    const history = [...messages, { role: "user" as const, content: text }].slice(-20).slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
    const FETCH_TIMEOUT_MS = 60_000;
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch("/api/hr/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          jurisdiction,
          history,
          mode: "onboarding",
        }),
        signal: ac.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errMsg = data?.error ?? "Something went wrong. Please try again.";
        setMessages((prev) => [...prev, { role: "assistant", content: `[Error] ${errMsg}` }]);
        setError(errMsg);
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setMessages((prev) => [...prev, { role: "assistant", content: "[Error] No response stream." }]);
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line) as { type: string; text?: string; delta?: string; error?: string };
            if (ev.type === "text" && typeof ev.delta === "string") {
              fullText += ev.delta;
              setStreamingText(fullText);
            } else if (ev.type === "done" && typeof ev.text === "string") {
              setMessages((prev) => [...prev, { role: "assistant", content: ev.text! }]);
              setStreamingText("");
            } else if (ev.type === "error" && typeof ev.error === "string") {
              setMessages((prev) => [...prev, { role: "assistant", content: `[Error] ${ev.error}` }]);
              setError(ev.error);
              setStreamingText("");
            }
          } catch {
            // skip
          }
        }
      }

    } catch (e) {
      clearTimeout(timeoutId);
      const isAbort = e instanceof Error && e.name === "AbortError";
      const errMsg = isAbort ? "Request timed out. Please try again." : "Network error. Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: `[Error] ${errMsg}` }]);
      setError(errMsg);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      setStreamingText("");
    }
  }, [input, loading, jurisdiction, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const doneCount = items.filter((i) => i.done).length;
  const totalCount = items.length;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[var(--bg)]">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 p-4 md:p-6 max-w-6xl w-full mx-auto flex-1 min-h-0">
        {/* Checklist */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-semibold text-[var(--text)]">New hire checklist</h2>
              <button
                type="button"
                onClick={handleResetChecklist}
                className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              >
                Reset
              </button>
            </div>
            <p className="text-[12px] text-[var(--text-secondary)] mb-3">
              {doneCount} of {totalCount} completed
            </p>
            <div className="flex-1 overflow-y-auto space-y-2">
              {items.map((item) => (
                <label
                  key={item.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    item.done ? "border-[var(--accent)]/30 bg-[var(--accent)]/5" : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggleItem(item.id)}
                    className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                  <span className={`text-[13px] ${item.done ? "text-[var(--text-secondary)] line-through" : "text-[var(--text)]"}`}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Ask about onboarding */}
        <div className="lg:col-span-3 flex flex-col min-h-0 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h2 className="text-[15px] font-semibold text-[var(--text)]">Ask about onboarding</h2>
            <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
              First-day steps, forms, who to contact, benefits — general guidance for North America.
            </p>
            <div className="mt-2">
              <select
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value as Jurisdiction)}
                className="text-[13px] bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-[var(--text)]"
                aria-label="Jurisdiction for onboarding guidance"
              >
                {JURISDICTIONS.map((j) => (
                  <option key={j} value={j}>
                    {j === "NA" ? "North America" : j === "CA" ? "Canada" : "United States"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !streamingText && (
              <p className="text-[13px] text-[var(--text-tertiary)]">
                e.g. &quot;What should I do on my first day?&quot; or &quot;Who do I contact for IT access?&quot;
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    m.role === "user"
                      ? "bg-[var(--user-bubble)] text-white"
                      : "bg-[var(--assistant-bubble)] border border-[var(--border)] text-[var(--text)]"
                  }`}
                >
                  {m.role === "assistant" && m.content.startsWith("[Error]") ? (
                    <p className="text-[13px] text-red-400">{m.content}</p>
                  ) : m.role === "assistant" ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-[13px] whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            {streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-[var(--assistant-bubble)] border border-[var(--border)]">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{streamingText}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="p-3 border-t border-[var(--border)]">
            {error && (
              <p className="text-[12px] text-red-400 mb-2" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about onboarding…"
                rows={2}
                className="flex-1 min-h-[44px] max-h-[120px] resize-y rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[14px] text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="shrink-0 h-11 px-4 rounded-xl bg-[var(--accent)] text-white font-medium text-[14px] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                {loading ? "…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
