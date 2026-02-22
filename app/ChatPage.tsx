"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
  getChatList,
  getActiveChatId,
  getChat,
  setChat,
  setActiveChatId,
  createChat,
  type ChatMessage,
  type AgentStep,
  type Chat,
  type ChatAgentTag,
} from "@/lib/storage";
import { Sidebar } from "./Sidebar";
import type { ChatAgent } from "@/lib/chatRouter";

const MAX_MESSAGE_LENGTH = 8000;
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB (Vercel serverless limit ~4.5 MB)
const ACCEPT_FILE_TYPES = "application/pdf,.txt,.md,.csv,image/jpeg,image/png,image/gif,image/webp";
const JURISDICTIONS = ["NA", "CA", "US"] as const;
type Jurisdiction = (typeof JURISDICTIONS)[number];

type ApprovalPending = {
  message: string;
  suggestedAgent: ChatAgent;
  reason: string;
  fileFilenames: string[];
};

type PendingToolCall = { id: string; name: string; args: Record<string, unknown> };
type PendingToolCalls = { calls: PendingToolCall[]; continuation: string };

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
  const [chatList, setChatListState] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatIdState] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("NA");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ file: File; id: string }[]>([]);
  const [documentText, setDocumentText] = useState("");
  const [documentExpanded, setDocumentExpanded] = useState(false);
  const [approvalPending, setApprovalPending] = useState<ApprovalPending | null>(null);
  const [pendingToolCalls, setPendingToolCalls] = useState<PendingToolCalls | null>(null);

  // Desktop: sidebar expanded by default. Mobile: drawer closed by default.
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setSidebarOpen(true);
  }, []);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentFileInputRef = useRef<HTMLInputElement>(null);
  const fileIdsForApprovalRef = useRef<string[]>([]);
  const toolContinueContextRef = useRef<{ nextMessages: ChatMessage[]; currentId: string | null } | null>(null);

  const refreshChatList = useCallback(() => {
    setChatListState(getChatList());
  }, []);

  useEffect(() => {
    const list = getChatList();
    let active = getActiveChatId();
    if (list.length > 0 && (active === null || !list.some((c) => c.id === active))) {
      active = list[0].id;
      setActiveChatId(active);
    }
    setChatListState(list);
    setActiveChatIdState(active);
  }, []);

  useEffect(() => {
    if (activeChatId === null) {
      setMessages([]);
      return;
    }
    const chat = getChat(activeChatId);
    setMessages(chat?.messages ?? []);
  }, [activeChatId]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom, streamingText]);

  const requestRoute = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || approvalPending) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
      setError(`Message is too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }
    setError(null);
    setUploadError(null);
    setLoading(true);
    let fileFilenames: string[] = [];
    let fileIds: string[] = [];
    if (attachedFiles.length > 0) {
      const formData = new FormData();
      attachedFiles.forEach(({ file }) => formData.append("files", file));
      try {
        const uploadRes = await fetch("/api/files", { method: "POST", body: formData });
        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}));
          setUploadError(data?.error ?? "File upload failed.");
          setLoading(false);
          return;
        }
        const data = (await uploadRes.json()) as { files: { file_id: string; filename: string }[] };
        fileIds = data.files.map((f) => f.file_id);
        fileFilenames = data.files.map((f) => f.filename);
        setAttachedFiles([]);
      } catch {
        setUploadError("File upload failed. Please try again.");
        setLoading(false);
        return;
      }
    }
    fileIdsForApprovalRef.current = fileIds;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Could not determine agent.");
        setLoading(false);
        return;
      }
      const { suggestedAgent, reason } = (await res.json()) as { suggestedAgent: ChatAgent; reason: string };
      setApprovalPending({ message: text, suggestedAgent, reason, fileFilenames });
      setInput("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [input, loading, approvalPending, attachedFiles]);

  const confirmRoute = useCallback(
    async (chosenAgent: ChatAgent) => {
      const pending = approvalPending;
      if (!pending || loading) return;
      setApprovalPending(null);
      setError(null);
      setUploadError(null);
      let currentId = activeChatId;
      const isNewChat = !currentId || messages.length === 0;
      if (isNewChat && !currentId) {
        currentId = createChat();
        setActiveChatId(currentId);
        setActiveChatIdState(currentId);
        refreshChatList();
      }
      const titleFromFirst = pending.message.slice(0, 40).trim() || "New chat";
      const userMessage: ChatMessage = {
        role: "user",
        content: pending.message,
        ...(pending.fileFilenames.length > 0 && { attachments: pending.fileFilenames.map((name) => ({ name })) }),
      };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      if (isNewChat && currentId) setChat(currentId, { title: titleFromFirst, messages: nextMessages, updatedAt: Date.now() });
      setAgentSteps([]);
      setStreamingText("");
      setLoading(true);
      const history = nextMessages.slice(-20).slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
      const FETCH_TIMEOUT_MS = 90_000;
      const ac = new AbortController();
      const timeoutId = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
      const fileIds = fileIdsForApprovalRef.current;
      const agentTag: ChatAgentTag = chosenAgent;
      try {
        const url = chosenAgent === "recruiting" ? "/api/agent/stream" : "/api/hr/stream";
        const body: Record<string, unknown> =
          chosenAgent === "recruiting"
            ? { message: pending.message, history }
            : {
                message: pending.message,
                jurisdiction,
                history,
                ...(chosenAgent === "onboarding" && { mode: "onboarding" }),
                ...(chosenAgent === "learning_development" && { mode: "learning_development" }),
                ...(chosenAgent === "compliance" && documentText.trim() && { document_text: documentText.trim().slice(0, 12000) }),
                ...(chosenAgent === "compliance" && fileIds.length > 0 && { file_ids: fileIds, file_filenames: pending.fileFilenames }),
              };
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ac.signal,
        });
        clearTimeout(timeoutId);

      if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const errMsg = data?.error ?? "Something went wrong. Please try again.";
          const withError = [...nextMessages, { role: "assistant" as const, content: `[Error] ${errMsg}`, agent: agentTag }];
          setMessages(withError);
          if (currentId) setChat(currentId, { messages: withError, updatedAt: Date.now() });
          setError(errMsg);
          setLoading(false);
          refreshChatList();
          return;
        }
        const reader = res.body?.getReader();
        if (!reader) {
          const withError = [...nextMessages, { role: "assistant" as const, content: "[Error] No response stream.", agent: agentTag }];
          setMessages(withError);
          if (currentId) setChat(currentId, { messages: withError, updatedAt: Date.now() });
          setLoading(false);
          refreshChatList();
          return;
        }

      const decoder = new TextDecoder();
      let buffer = "";
      let steps: AgentStep[] = [];
      let fullText = "";
      let gotDone = false;
      let gotPendingToolCalls = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line) as {
              type: string;
              id?: string;
              label?: string;
              status?: "active" | "done";
              delta?: string;
              text?: string;
              error?: string;
              calls?: PendingToolCall[];
              continuation?: string;
            };
            if (ev.type === "step" && ev.id != null && ev.label != null && ev.status) {
              steps = steps.filter((s) => s.id !== ev.id);
              steps = [...steps, { id: ev.id, label: ev.label, status: ev.status }];
              setAgentSteps([...steps]);
            } else if (ev.type === "text" && typeof ev.delta === "string") {
              fullText += ev.delta;
              setStreamingText(fullText);
            } else if (ev.type === "done" && typeof ev.text === "string") {
              gotDone = true;
              const withAssistant = [...nextMessages, { role: "assistant" as const, content: ev.text, steps: steps.length ? [...steps] : undefined, agent: agentTag }];
              setMessages(withAssistant);
              if (currentId) setChat(currentId, { messages: withAssistant, updatedAt: Date.now() });
              setAgentSteps([]);
              setStreamingText("");
            } else if (ev.type === "error" && typeof ev.error === "string") {
              const withError = [...nextMessages, { role: "assistant" as const, content: `[Error] ${ev.error}`, agent: agentTag }];
              setMessages(withError);
              if (currentId) setChat(currentId, { messages: withError, updatedAt: Date.now() });
              setError(ev.error);
            } else if (ev.type === "pending_tool_calls" && Array.isArray(ev.calls) && typeof ev.continuation === "string") {
              gotPendingToolCalls = true;
              toolContinueContextRef.current = { nextMessages, currentId };
              setPendingToolCalls({ calls: ev.calls, continuation: ev.continuation });
            }
          } catch {
            // skip malformed line
          }
        }
      }

      if (gotPendingToolCalls) {
        refreshChatList();
        setLoading(false);
        setAgentSteps([]);
        setStreamingText("");
        return;
      }

      if (!gotDone && fullText.trim()) {
          const withAssistant = [...nextMessages, { role: "assistant" as const, content: fullText.trim(), steps: steps.length ? [...steps] : undefined, agent: agentTag }];
          setMessages(withAssistant);
          if (currentId) setChat(currentId, { messages: withAssistant, updatedAt: Date.now() });
        }
        refreshChatList();
      } catch (e) {
        clearTimeout(timeoutId);
        const isAbort = e instanceof Error && e.name === "AbortError";
        const errMsg = isAbort ? "Request timed out. Please try again." : "Network error. Please check your connection and try again.";
        const withError = [...nextMessages, { role: "assistant" as const, content: `[Error] ${errMsg}`, agent: agentTag }];
        setMessages(withError);
        if (currentId) setChat(currentId, { messages: withError, updatedAt: Date.now() });
        setError(errMsg);
        refreshChatList();
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
        setAgentSteps([]);
        setStreamingText("");
      }
    },
    [approvalPending, loading, activeChatId, messages, jurisdiction, documentText, refreshChatList]
  );

  const cancelApproval = useCallback(() => setApprovalPending(null), []);

  const confirmToolCalls = useCallback(
    async (approvedIds: string[]) => {
      const pending = pendingToolCalls;
      const context = toolContinueContextRef.current;
      if (!pending || !context) return;
      setPendingToolCalls(null);
      toolContinueContextRef.current = null;
      setError(null);
      setLoading(true);
      const { nextMessages, currentId } = context;
      const agentTag: ChatAgentTag = "recruiting";

      try {
        const res = await fetch("/api/agent/stream/continue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ continuation: pending.continuation, approved_tool_call_ids: approvedIds }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const errMsg = data?.error ?? "Continue request failed.";
          const withError = [...nextMessages, { role: "assistant" as const, content: `[Error] ${errMsg}`, agent: agentTag }];
          setMessages(withError);
          if (currentId) setChat(currentId, { messages: withError, updatedAt: Date.now() });
          setError(errMsg);
          setLoading(false);
          refreshChatList();
          return;
        }
        const reader = res.body?.getReader();
        if (!reader) {
          const withError = [...nextMessages, { role: "assistant" as const, content: "[Error] No response stream.", agent: agentTag }];
          setMessages(withError);
          if (currentId) setChat(currentId, { messages: withError, updatedAt: Date.now() });
          setLoading(false);
          refreshChatList();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let steps: AgentStep[] = [];
        let fullText = "";
        let gotDone = false;
        let gotPendingAgain = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const ev = JSON.parse(line) as {
                type: string;
                id?: string;
                label?: string;
                status?: "active" | "done";
                delta?: string;
                text?: string;
                error?: string;
                calls?: PendingToolCall[];
                continuation?: string;
              };
              if (ev.type === "step" && ev.id != null && ev.label != null && ev.status) {
                steps = steps.filter((s) => s.id !== ev.id);
                steps = [...steps, { id: ev.id, label: ev.label, status: ev.status }];
                setAgentSteps([...steps]);
              } else if (ev.type === "text" && typeof ev.delta === "string") {
                fullText += ev.delta;
                setStreamingText(fullText);
              } else if (ev.type === "done" && typeof ev.text === "string") {
                gotDone = true;
                const withAssistant = [...nextMessages, { role: "assistant" as const, content: ev.text, steps: steps.length ? [...steps] : undefined, agent: agentTag }];
                setMessages(withAssistant);
                if (currentId) setChat(currentId, { messages: withAssistant, updatedAt: Date.now() });
                setAgentSteps([]);
                setStreamingText("");
              } else if (ev.type === "error" && typeof ev.error === "string") {
                const withError = [...nextMessages, { role: "assistant" as const, content: `[Error] ${ev.error}`, agent: agentTag }];
                setMessages(withError);
                if (currentId) setChat(currentId, { messages: withError, updatedAt: Date.now() });
                setError(ev.error);
              } else if (ev.type === "pending_tool_calls" && Array.isArray(ev.calls) && typeof ev.continuation === "string") {
                gotPendingAgain = true;
                toolContinueContextRef.current = { nextMessages, currentId };
                setPendingToolCalls({ calls: ev.calls, continuation: ev.continuation });
              }
            } catch {
              // skip malformed line
            }
          }
        }

        if (gotPendingAgain) {
          setLoading(false);
          setAgentSteps([]);
          setStreamingText("");
          refreshChatList();
          return;
        }
        if (!gotDone && fullText.trim()) {
          const withAssistant = [...nextMessages, { role: "assistant" as const, content: fullText.trim(), steps: steps.length ? [...steps] : undefined, agent: agentTag }];
          setMessages(withAssistant);
          if (currentId) setChat(currentId, { messages: withAssistant, updatedAt: Date.now() });
        }
        refreshChatList();
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Network error.";
        const withError = [...nextMessages, { role: "assistant" as const, content: `[Error] ${errMsg}`, agent: agentTag }];
        setMessages(withError);
        if (currentId) setChat(currentId, { messages: withError, updatedAt: Date.now() });
        setError(errMsg);
        refreshChatList();
      } finally {
        setLoading(false);
        setAgentSteps([]);
        setStreamingText("");
      }
    },
    [pendingToolCalls, refreshChatList]
  );

  const cancelToolCalls = useCallback(() => {
    if (!pendingToolCalls) return;
    confirmToolCalls([]);
  }, [pendingToolCalls, confirmToolCalls]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (approvalPending || pendingToolCalls) return;
      requestRoute();
    }
  };

  const handleNewChat = () => {
    const id = createChat();
    setActiveChatId(id);
    setActiveChatIdState(id);
    setMessages([]);
    setError(null);
    setInput("");
    setAgentSteps([]);
    setStreamingText("");
    setApprovalPending(null);
    setPendingToolCalls(null);
    toolContinueContextRef.current = null;
    refreshChatList();
  };

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    setActiveChatIdState(id);
    setError(null);
  };

  const handleAttachClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = "";
    setUploadError(null);
    const next = chosen
      .filter((file) => {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          setUploadError(`"${file.name}" exceeds 8 MB.`);
          return false;
        }
        return true;
      })
      .map((file) => ({ file, id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}` }));
    setAttachedFiles((prev) => [...prev, ...next]);
  };
  const removeAttachedFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((a) => a.id !== id));
    setUploadError(null);
  };

  const handleDocumentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.name.toLowerCase().endsWith(".txt")) return;
    const reader = new FileReader();
    reader.onload = () => setDocumentText((prev) => (prev ? prev + "\n\n" : "") + (reader.result as string));
    reader.readAsText(file);
  };

  const currentChat = activeChatId ? getChat(activeChatId) : null;
  const currentTitle = currentChat?.title ?? "New chat";

  const isErrorBubble = (content: string) => content.startsWith("[Error]");
  const stripErrorPrefix = (content: string) =>
    content.replace(/^\[Error\]\s*/, "");

  return (
    <div className="min-h-screen flex bg-[var(--bg)] text-[var(--text)]">
      <div
        className={`fixed inset-0 z-40 bg-black/50 md:hidden ${sidebarOpen ? "block" : "hidden"}`}
        aria-hidden
        onClick={() => setSidebarOpen(false)}
      />
      <div
        className={`${sidebarOpen ? "fixed inset-y-0 left-0 z-50 md:relative md:z-0 shadow-xl md:shadow-none" : "hidden md:block"}`}
      >
        <Sidebar
          chats={chatList}
          activeId={activeChatId}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          onCloseSidebar={() => setSidebarOpen(false)}
          collapsed={!sidebarOpen}
          onToggleCollapsed={() => setSidebarOpen((v) => !v)}
        />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--bg)]/70">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface)]"
              aria-label="Open chat list"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <h1 className="text-[17px] font-semibold tracking-tight text-[var(--text)] truncate flex-1">
              {currentTitle}
            </h1>
            <select
              aria-label="Jurisdiction (NA, CA, US)"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value as Jurisdiction)}
              className="select-arrow h-8 pl-3 pr-8 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-[13px] font-medium appearance-none cursor-pointer hover:bg-[var(--surface-hover)]"
            >
              {JURISDICTIONS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-5 py-8 min-h-full">
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-[var(--text-secondary)] text-[15px] leading-relaxed max-w-sm">
                  Ask anything — recruiting, compliance, onboarding, or learning & development. We’ll suggest the right agent; you approve before we answer.
                </p>
                <p className="mt-2 text-[var(--text-tertiary)] text-[13px]">
                  Jurisdiction: {jurisdiction}
                </p>
                <p className="mt-6 text-[12px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
                  Try these prompts
                </p>
                <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
                  {[
                    { label: "Recruiting", prompt: "Find me 5 backend engineers in Toronto with 3+ years experience." },
                    { label: "Compliance", prompt: "What are the overtime rules in Ontario?" },
                    { label: "Onboarding", prompt: "What should I do on my first day? Who do I contact for IT access?" },
                    { label: "Learning & Development", prompt: "What training do you recommend for leadership development?" },
                  ].map(({ label, prompt }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setInput(prompt)}
                      className="px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[13px] text-left hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] transition-colors w-full sm:w-[280px]"
                    >
                      <span className="font-semibold text-[var(--accent)]">{label}</span>
                      <p className="mt-1 text-[var(--text-secondary)] leading-snug">{prompt}</p>
                    </button>
                  ))}
                </div>
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
                    {msg.role === "assistant" && msg.agent && (
                      <p className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">{msg.agent === "learning_development" ? "Learning & Development" : msg.agent} agent</p>
                    )}
                    {msg.role === "user" && msg.attachments && msg.attachments.length > 0 && (
                      <p className="text-[12px] opacity-90 mb-2">
                        Attached: {msg.attachments.map((a) => a.name).join(", ")}
                      </p>
                    )}
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
            {pendingToolCalls ? (
              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 mb-4">
                <p className="text-[13px] text-[var(--text-secondary)] mb-2">Agent wants to run (approve before we execute)</p>
                <ul className="list-disc list-inside text-[13px] text-[var(--text)] mb-3 space-y-1">
                  {pendingToolCalls.calls.map((c) => (
                    <li key={c.id}>
                      <strong>{c.name}</strong>
                      {c.name === "send_outreach" && c.args?.candidate_email != null ? ` → ${String(c.args.candidate_email)}` : null}
                      {c.name === "schedule_interview" && c.args?.candidate_email != null ? ` → ${String(c.args.candidate_email)}` : null}
                      {c.name === "update_ats" && c.args?.candidate_email != null ? ` → ${String(c.args.candidate_email)} (${String(c.args?.status ?? "")})` : null}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => confirmToolCalls(pendingToolCalls.calls.map((c) => c.id))}
                    className="h-8 px-3 rounded-lg bg-[var(--accent)] text-white text-[13px] font-medium hover:bg-[var(--accent-hover)]"
                  >
                    Approve all
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelToolCalls()}
                    className="h-8 px-3 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-[13px] font-medium hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                  >
                    Reject all
                  </button>
                </div>
              </div>
            ) : null}
            {approvalPending ? (
              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 mb-4">
                <p className="text-[13px] text-[var(--text-secondary)] mb-1">Route to agent</p>
                <p className="text-[15px] text-[var(--text)] mb-2 line-clamp-2">&quot;{approvalPending.message}&quot;</p>
                <p className="text-[12px] text-[var(--text-tertiary)] mb-3">{approvalPending.reason}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] text-[var(--text-secondary)] mr-1">Suggested: <strong className="text-[var(--text)]">{approvalPending.suggestedAgent === "learning_development" ? "Learning & Development" : approvalPending.suggestedAgent.charAt(0).toUpperCase() + approvalPending.suggestedAgent.slice(1)}</strong></span>
                  <button
                    type="button"
                    onClick={() => confirmRoute(approvalPending.suggestedAgent)}
                    className="h-8 px-3 rounded-lg bg-[var(--accent)] text-white text-[13px] font-medium hover:bg-[var(--accent-hover)]"
                  >
                    Approve
                  </button>
                  {(["recruiting", "compliance", "onboarding", "learning_development"] as const).map((agent) => (
                    <button
                      key={agent}
                      type="button"
                      onClick={() => confirmRoute(agent)}
                      className={`h-8 px-3 rounded-lg text-[13px] font-medium ${agent === approvalPending.suggestedAgent ? "bg-[var(--surface-hover)] text-[var(--text)]" : "border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"}`}
                    >
                      {agent === "learning_development" ? "Learning & Development" : agent.charAt(0).toUpperCase() + agent.slice(1)}
                    </button>
                  ))}
                  <button type="button" onClick={cancelApproval} className="h-8 px-3 rounded-lg text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]">
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_FILE_TYPES}
              multiple
              className="hidden"
              onChange={handleFileChange}
              aria-label="Attach files for analysis"
            />
            <input
              ref={documentFileInputRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={handleDocumentFileChange}
              aria-label="Attach .txt as document for compliance check"
            />
            <div className="mb-2">
              <button
                type="button"
                onClick={() => setDocumentExpanded((v) => !v)}
                className="text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text)]"
              >
                {documentExpanded ? "− Document" : "+ Document"}
              </button>
              {documentExpanded && (
                <div className="mt-2 space-y-1">
                  <textarea
                    value={documentText}
                    onChange={(e) => setDocumentText(e.target.value)}
                    placeholder="Paste policy or handbook text for compliance check (or attach .txt below)"
                    rows={4}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-y max-h-[200px]"
                    disabled={loading}
                  />
                  <p className="text-[11px] text-[var(--text-tertiary)]">MVP: Only plain text. Paste or use a .txt file.</p>
                  <button
                    type="button"
                    onClick={() => documentFileInputRef.current?.click()}
                    disabled={loading}
                    className="text-[12px] text-[var(--accent)] hover:underline"
                  >
                    Attach .txt
                  </button>
                </div>
              )}
            </div>
            {uploadError && (
              <p className="text-[13px] text-amber-400/90 mb-2">{uploadError}</p>
            )}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachedFiles.map(({ file, id }) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[13px] text-[var(--text-secondary)]"
                  >
                    <span className="truncate max-w-[160px]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachedFile(id)}
                      className="shrink-0 p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
                      aria-label={`Remove ${file.name}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            {input.length > MAX_MESSAGE_LENGTH && (
              <p className="text-[13px] text-amber-400/90 mb-3">
                Message is too long ({input.length}/{MAX_MESSAGE_LENGTH} characters).
              </p>
            )}
            <div className="flex gap-3 items-end">
              <button
                type="button"
                onClick={handleAttachClick}
                disabled={loading}
                className="shrink-0 p-2.5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] disabled:opacity-50"
                aria-label="Attach file"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Recruiting, Compliance, Onboarding, or Learning & Development…"
                rows={2}
                maxLength={MAX_MESSAGE_LENGTH + 100}
                className="flex-1 min-h-[44px] max-h-[120px] resize-none rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[15px] text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-shadow disabled:opacity-60"
                disabled={loading || !!approvalPending || !!pendingToolCalls}
              />
              <button
                type="button"
                onClick={requestRoute}
                disabled={loading || !!approvalPending || !!pendingToolCalls || !input.trim() || input.length > MAX_MESSAGE_LENGTH}
                className="shrink-0 h-11 px-5 rounded-[var(--radius-lg)] bg-[var(--accent)] text-white text-[15px] font-medium hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg)]"
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
              Enter to send · Shift+Enter for new line · Attach PDF, text, images, or CSV (max 4 MB)
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
