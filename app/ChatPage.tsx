"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { signOut } from "next-auth/react";
import {
  getStoredTranscript,
  setStoredTranscript,
  clearStoredTranscript,
  type ChatMessage,
  type AgentStep,
} from "@/lib/storage";

const MAX_MESSAGE_LENGTH = 8000;
const JURISDICTIONS = ["NA", "CA", "US"] as const;
type Jurisdiction = (typeof JURISDICTIONS)[number];

function ReasoningSteps({ steps, compact = false }: { steps: AgentStep[]; compact?: boolean }) {
  if (!steps.length) return null;
  return (
    <div className={`rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] ${compact ? "px-3 py-2" : "px-4 py-3"} mb-2`}>
      <p className={`font-medium text-[var(--text-secondary)] ${compact ? "text-[11px] uppercase tracking-wider mb-1.5" : "text-[12px] uppercase tracking-wider mb-2"}`}>
        Compliance reasoning
      </p>
      <ul className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-[var(--text-secondary)]">
            <span className={`shrink-0 flex items-center justify-center w-4 h-4 rounded-full ${s.status === "done" ? "bg-[var(--accent)]/20 text-[var(--accent)]" : "bg-[var(--border)] text-[var(--text-tertiary)]"}`}>
              {s.status === "done" ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M1.5 5l2.5 2.5L8.5 3" />
                </svg>
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              )}
            </span>
            <span className={compact ? "text-[12px]" : "text-[13px]"}>{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("NA");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages(getStoredTranscript());
  }, []);

  useEffect(() => {
    if (messages.length > 0) setStoredTranscript(messages);
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom, streamingText]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
      setError(`Message is too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }
    setError(null);
    const userMessage: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setAgentSteps([]);
    setStreamingText("");

    try {
      const history = messages.slice(-20);
      const res = await fetch("/api/hr/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, jurisdiction, history }),
      });

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
      let steps: AgentStep[] = [];
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
            const ev = JSON.parse(line) as { type: string; id?: string; label?: string; status?: "active" | "done"; delta?: string; text?: string; error?: string };
            if (ev.type === "step" && ev.id != null && ev.label != null && ev.status) {
              steps = steps.filter((s) => s.id !== ev.id);
              steps = [...steps, { id: ev.id, label: ev.label, status: ev.status }];
              setAgentSteps([...steps]);
            } else if (ev.type === "text" && typeof ev.delta === "string") {
              fullText += ev.delta;
              setStreamingText(fullText);
            } else if (ev.type === "done" && typeof ev.text === "string") {
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: ev.text, steps: steps.length ? [...steps] : undefined },
              ]);
              steps = [];
              setAgentSteps([]);
              setStreamingText("");
            } else if (ev.type === "error" && typeof ev.error === "string") {
              setMessages((prev) => [...prev, { role: "assistant", content: `[Error] ${ev.error}` }]);
              setError(ev.error);
            }
          } catch {
            // skip malformed line
          }
        }
      }
    } catch {
      const errMsg = "Network error. Please check your connection and try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: `[Error] ${errMsg}` }]);
      setError(errMsg);
    } finally {
      setLoading(false);
      setAgentSteps([]);
      setStreamingText("");
    }
  }, [input, loading, jurisdiction, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    clearStoredTranscript();
    setError(null);
    setInput("");
    setAgentSteps([]);
    setStreamingText("");
  };

  const isErrorBubble = (content: string) => content.startsWith("[Error]");
  const stripErrorPrefix = (content: string) =>
    content.replace(/^\[Error\]\s*/, "");

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--bg)]/70">
        <div className="max-w-3xl mx-auto px-5 py-3.5 flex items-center justify-between gap-4">
          <h1 className="text-[17px] font-semibold tracking-tight text-[var(--text)] truncate">
            Seeknimbly HR
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            <select
              aria-label="Jurisdiction (NA, CA, US)"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value as Jurisdiction)}
              className="select-arrow h-8 pl-3 pr-8 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-[13px] font-medium appearance-none cursor-pointer hover:bg-[var(--surface-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg)]"
            >
              {JURISDICTIONS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleNewChat}
              className="h-8 px-3.5 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg)]"
            >
              New chat
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="h-8 px-3.5 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-5 py-8 min-h-full">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-[var(--text-secondary)] text-[15px] leading-relaxed max-w-sm">
                Ask a question about HR compliance in North America. Your conversation is saved in this browser.
              </p>
              <p className="mt-2 text-[var(--text-tertiary)] text-[13px]">
                Jurisdiction: {jurisdiction}
              </p>
            </div>
          )}
          <ul className="space-y-5">
            {messages.map((msg, i) => (
              <li
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} flex-col ${msg.role === "assistant" ? "items-start" : "items-end"} animate-fade-in`}
              >
                {msg.role === "assistant" && msg.steps && msg.steps.length > 0 && (
                  <div className="max-w-[85%] w-full mb-1.5">
                    <ReasoningSteps steps={msg.steps} compact />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-[var(--radius-lg)] px-4 py-3 shadow-[var(--shadow-sm)] ${
                    msg.role === "user"
                      ? "bg-[var(--user-bubble)] text-white"
                      : isErrorBubble(msg.content)
                        ? "bg-[var(--error-bg)] border border-[var(--error-border)]"
                        : "bg-[var(--assistant-bubble)] border border-[var(--border)]"
                  }`}
                >
                  {isErrorBubble(msg.content) ? (
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words text-[var(--text)]">
                      {stripErrorPrefix(msg.content)}
                    </p>
                  ) : msg.role === "assistant" ? (
                    <div className="text-[15px] leading-relaxed break-words [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_strong]:text-inherit">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {loading && (
            <div className="flex justify-start flex-col items-start mt-5 max-w-[85%]">
              {agentSteps.length > 0 && <ReasoningSteps steps={agentSteps} />}
              <div className="rounded-[var(--radius-lg)] px-4 py-3 bg-[var(--assistant-bubble)] border border-[var(--border)] shadow-[var(--shadow-sm)] w-full">
                {streamingText ? (
                  <div className="text-[15px] leading-relaxed break-words [&_p]:my-1.5 [&_ul]:my-2 [&_ul]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold">
                    <ReactMarkdown>{streamingText}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="flex items-center gap-1.5 text-[15px] text-[var(--text-tertiary)]">
                    <span className="inline-flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)] animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)] animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)] animate-bounce [animation-delay:300ms]" />
                    </span>
                  </span>
                )}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="sticky bottom-0 border-t border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--bg)]/70">
        <div className="max-w-3xl mx-auto px-5 py-4">
          {input.length > MAX_MESSAGE_LENGTH && (
            <p className="text-[13px] text-amber-400/90 mb-3">
              Message is too long ({input.length}/{MAX_MESSAGE_LENGTH} characters).
            </p>
          )}
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about HR compliance…"
              rows={2}
              maxLength={MAX_MESSAGE_LENGTH + 100}
              className="flex-1 min-h-[44px] max-h-[120px] resize-none rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[15px] text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-shadow disabled:opacity-60"
              disabled={loading}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={loading || !input.trim() || input.length > MAX_MESSAGE_LENGTH}
              className="shrink-0 h-11 px-5 rounded-[var(--radius-lg)] bg-[var(--accent)] text-white text-[15px] font-medium hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg)]"
            >
              Send
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </footer>
    </div>
  );
}
