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
  toggleChatPinned,
  type ChatMessage,
  type AgentStep,
  type Chat,
  type ChatAgentTag,
} from "@/lib/storage";
import { Sidebar } from "./Sidebar";
import { ApprovalsPanel } from "./ApprovalsPanel";
import { AGENTS_META, agentLabel } from "@/lib/agents/meta";
import { getDisabledAgents } from "@/lib/agents/prefs";
import { pullConversations, pushConversation } from "@/lib/chat-sync";

const MAX_MESSAGE_LENGTH = 8000;
/** Max length per history item content (must match API schema). */
const MAX_HISTORY_ITEM_LENGTH = 8000;
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB (Vercel serverless limit ~4.5 MB)
const ACCEPT_FILE_TYPES = "application/pdf,.txt,.md,.csv,image/jpeg,image/png,image/gif,image/webp";
const JURISDICTIONS = ["NA", "CA", "US"] as const;
type Jurisdiction = (typeof JURISDICTIONS)[number];

type PendingRequest = {
  message: string;
  suggestedAgent: ChatAgentTag;
  reason: string;
  fileFilenames: string[];
};

type PendingToolCall = { id: string; name: string; args: Record<string, unknown> };
type PendingToolCalls = { calls: PendingToolCall[]; continuation: string; agent: ChatAgentTag };

function ReasoningSteps({ steps, compact = false }: { steps: AgentStep[]; compact?: boolean }) {
  if (!steps.length) return null;
  return (
    <div className={`rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] ${compact ? "px-3 py-2" : "px-4 py-3"} mb-2`}>
      <p className={`font-medium text-[var(--text-secondary)] ${compact ? "text-[11px] uppercase tracking-wider mb-1.5" : "text-[12px] uppercase tracking-wider mb-2"}`}>
        Agent steps
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
  const [agentChoice, setAgentChoice] = useState<"auto" | ChatAgentTag>("auto");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [approvalsRefreshKey, setApprovalsRefreshKey] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<{ file: File; id: string }[]>([]);
  const [documentText, setDocumentText] = useState("");
  const [documentExpanded, setDocumentExpanded] = useState(false);
  const [approvalPending, setApprovalPending] = useState<PendingRequest | null>(null);
  const [pendingToolCalls, setPendingToolCalls] = useState<PendingToolCalls | null>(null);

  const [disabledAgents, setDisabledAgents] = useState<string[]>([]);

  // Desktop: sidebar expanded by default. Mobile: drawer closed by default.
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setSidebarOpen(true);
    setDisabledAgents(getDisabledAgents());
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

    // Server sync: merge remote conversations (newer wins), then refresh.
    pullConversations().then((changed) => {
      if (changed) {
        setChatListState(getChatList());
        const current = getActiveChatId();
        if (current) {
          const chat = getChat(current);
          if (chat) setMessages(chat.messages);
        }
      }
    });
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

  // Persist the active chat server-side after each turn (debounced).
  useEffect(() => {
    if (!activeChatId || loading || messages.length === 0) return;
    pushConversation(activeChatId);
  }, [activeChatId, messages, loading]);

  const dispatchToAgent = useCallback(
    async (pending: PendingRequest, chosenAgent: ChatAgentTag) => {
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
      const titleFromFirst = pending.message.slice(0, 40).trim() || "New session";
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
      const history = nextMessages.slice(-20).slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content.slice(0, MAX_HISTORY_ITEM_LENGTH),
      }));
      const FETCH_TIMEOUT_MS = 90_000;
      const ac = new AbortController();
      const timeoutId = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
      const fileIds = fileIdsForApprovalRef.current;
      const agentTag: ChatAgentTag = chosenAgent;
      try {
        // Compliance questions about an attached document use the document-grounded
        // /api/hr/stream flow (quotes, SOC2/ISO mapping). Everything else runs the
        // full tool-using agent at /api/agents/[id]/stream.
        const complianceDocMode =
          chosenAgent === "compliance" && (Boolean(documentText.trim()) || fileIds.length > 0);
        const url = complianceDocMode ? "/api/hr/stream" : `/api/agents/${chosenAgent}/stream`;
        const body: Record<string, unknown> = complianceDocMode
          ? {
              message: pending.message,
              jurisdiction,
              history,
              ...(documentText.trim() && { document_text: documentText.trim().slice(0, 12000) }),
              ...(fileIds.length > 0 && { file_ids: fileIds, file_filenames: pending.fileFilenames }),
            }
          : { message: pending.message, history, jurisdiction };
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
                setPendingToolCalls({ calls: ev.calls, continuation: ev.continuation, agent: chosenAgent });
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
        setApprovalsRefreshKey((k) => k + 1);
      }
    },
    [activeChatId, messages, jurisdiction, documentText, refreshChatList]
  );

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

    // Manual agent choice skips routing and goes straight to that agent.
    if (agentChoice !== "auto") {
      setInput("");
      setLoading(false);
      await dispatchToAgent({ message: text, suggestedAgent: agentChoice, reason: "Manually selected.", fileFilenames }, agentChoice);
      return;
    }

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
      const { suggestedAgent, reason } = (await res.json()) as { suggestedAgent: ChatAgentTag; reason: string };
      setApprovalPending({ message: text, suggestedAgent, reason, fileFilenames });
      setInput("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [input, loading, approvalPending, attachedFiles, agentChoice, dispatchToAgent]);

  const confirmRoute = useCallback(
    async (chosenAgent: ChatAgentTag) => {
      const pending = approvalPending;
      if (!pending || loading) return;
      await dispatchToAgent(pending, chosenAgent);
    },
    [approvalPending, loading, dispatchToAgent]
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
      const agentTag: ChatAgentTag = pending.agent;

      try {
        const decisions = pending.calls.map((c) => ({
          id: c.id,
          name: c.name,
          args: c.args ?? {},
          approved: approvedIds.includes(c.id),
        }));
        const res = await fetch(`/api/agents/${pending.agent}/stream/continue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ continuation: pending.continuation, decisions, jurisdiction }),
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
                setPendingToolCalls({ calls: ev.calls, continuation: ev.continuation, agent: pending.agent });
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
        setApprovalsRefreshKey((k) => k + 1);
      }
    },
    [pendingToolCalls, refreshChatList, jurisdiction]
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

  const handleNewChat = useCallback(() => {
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
  }, [refreshChatList]);

  // Ctrl/Cmd+N — new session (matches the sidebar shortcut chip)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNewChat]);

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    setActiveChatIdState(id);
    setError(null);
  };

  const handleTogglePin = (id: string) => {
    toggleChatPinned(id);
    refreshChatList();
    pushConversation(id, 300);
  };

  const handleAttachClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = "";
    setUploadError(null);
    const next = chosen
      .filter((file) => {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          setUploadError(`"${file.name}" exceeds 4 MB.`);
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

  const isErrorBubble = (content: string) => content.startsWith("[Error]");
  const stripErrorPrefix = (content: string) => content.replace(/^\[Error\]\s*/, "");
  const enabledAgents = AGENTS_META.filter((a) => !disabledAgents.includes(a.id));
  const isEmpty = messages.length === 0 && !loading;

  return (
    <div className="h-full w-full flex bg-[var(--bg)] text-[var(--text)] overflow-hidden">
      <div
        className={`fixed inset-0 z-40 bg-black/40 md:hidden ${sidebarOpen ? "block" : "hidden"}`}
        aria-hidden
        onClick={() => setSidebarOpen(false)}
      />
      <div
        className={`${sidebarOpen ? "fixed inset-y-0 left-0 z-50 md:relative md:z-0 shadow-xl md:shadow-none" : "hidden md:block"} h-full`}
      >
        <Sidebar
          chats={chatList}
          activeId={activeChatId}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          onTogglePin={handleTogglePin}
          onCloseSidebar={() => setSidebarOpen(false)}
          collapsed={!sidebarOpen}
          onToggleCollapsed={() => setSidebarOpen((v) => !v)}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 canvas-wash relative">
        {/* Mobile: open sidebar */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="md:hidden absolute top-3 left-3 z-30 p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)]"
          aria-label="Open sessions"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        {/* Toggle right panel */}
        <button
          type="button"
          onClick={() => setRightPanelOpen((v) => !v)}
          className="hidden lg:block absolute top-3 right-3 z-30 p-2 rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
          aria-label={rightPanelOpen ? "Hide approvals panel" : "Show approvals panel"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M15 4v16" />
          </svg>
        </button>

        <main className="flex-1 overflow-y-auto">
          <div className="w-full max-w-3xl xl:max-w-4xl 2xl:max-w-5xl mx-auto px-3 sm:px-5 pt-14 md:pt-8 pb-6 min-h-full flex flex-col">
            {isEmpty && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <h1 className="wordmark text-[clamp(34px,9vw,76px)] 2xl:text-[92px] select-none px-2">
                  SEEKNIMBLY AI
                </h1>
                <p className="mt-4 text-[var(--text-secondary)] text-[14px] leading-relaxed max-w-md">
                  Recruit, onboard, train, and stay compliant. Tell me the goal and your agents handle the mechanical parts — you approve before anything leaves the building.
                </p>
                <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl xl:max-w-2xl">
                  {enabledAgents.slice(0, 4).map(({ id, label, sample }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setInput(sample)}
                      className="px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 backdrop-blur text-[12.5px] text-left hover:bg-[var(--surface)] hover:border-[var(--border-strong)] transition-colors shadow-[var(--shadow-sm)]"
                    >
                      <span className="font-semibold text-[var(--accent)]">{label}</span>
                      <p className="mt-0.5 text-[var(--text-secondary)] leading-snug line-clamp-2">{sample}</p>
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
                    className={`max-w-[92%] sm:max-w-[85%] rounded-[var(--radius-lg)] px-4 py-3 shadow-[var(--shadow-sm)] ${
                      msg.role === "user"
                        ? "bg-[var(--user-bubble)] text-white"
                        : isErrorBubble(msg.content)
                          ? "bg-[var(--error-bg)] border border-[var(--error-border)]"
                          : "bg-[var(--assistant-bubble)] border border-[var(--border)]"
                    }`}
                  >
                    {msg.role === "assistant" && msg.agent && (
                      <p className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">{agentLabel(msg.agent)} agent</p>
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
                    {msg.role === "assistant" && msg.agent === "compliance" && !isErrorBubble(msg.content) && (
                      <button
                        type="button"
                        className="mt-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text)] underline-offset-2 hover:underline"
                        onClick={async () => {
                          const note = window.prompt("What looks wrong? (optional note)") ?? undefined;
                          try {
                            const res = await fetch("/api/report-error", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                agent: "compliance",
                                note: note || undefined,
                                message_excerpt: msg.content.slice(0, 2000),
                              }),
                            });
                            const data = await res.json();
                            window.alert(res.ok ? data.message ?? "Reported." : data.error ?? "Could not report.");
                          } catch {
                            window.alert("Network error reporting this answer.");
                          }
                        }}
                      >
                        Report an error
                      </button>
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

        <footer className="shrink-0 px-3 sm:px-5 pb-[max(0.9rem,env(safe-area-inset-bottom))]">
          <div className="w-full max-w-2xl xl:max-w-3xl mx-auto">
            {pendingToolCalls ? (
              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 mb-3 shadow-[var(--shadow-md)]">
                <p className="text-[13px] text-[var(--text-secondary)] mb-2">
                  The {agentLabel(pendingToolCalls.agent)} agent wants to run (approve before it executes)
                </p>
                <ul className="list-disc list-inside text-[13px] text-[var(--text)] mb-3 space-y-1">
                  {pendingToolCalls.calls.map((c) => {
                    const target =
                      c.args?.candidate_email ?? c.args?.recipient ?? c.args?.legal_name ?? c.args?.company ?? c.args?.stage ?? null;
                    const status = c.args?.status ?? c.args?.stage ?? null;
                    return (
                      <li key={c.id}>
                        <strong>{c.name}</strong>
                        {target != null ? ` → ${String(target)}` : null}
                        {status != null && c.name === "update_ats" ? ` (${String(status)})` : null}
                      </li>
                    );
                  })}
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
              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 mb-3 shadow-[var(--shadow-md)]">
                <p className="text-[13px] text-[var(--text-secondary)] mb-1">Route to agent</p>
                <p className="text-[15px] text-[var(--text)] mb-2 line-clamp-2">&quot;{approvalPending.message}&quot;</p>
                <p className="text-[12px] text-[var(--text-tertiary)] mb-3">{approvalPending.reason}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] text-[var(--text-secondary)] mr-1">
                    Suggested: <strong className="text-[var(--text)]">{agentLabel(approvalPending.suggestedAgent)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => confirmRoute(approvalPending.suggestedAgent)}
                    className="h-8 px-3 rounded-lg bg-[var(--accent)] text-white text-[13px] font-medium hover:bg-[var(--accent-hover)]"
                  >
                    Approve
                  </button>
                  {enabledAgents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => confirmRoute(agent.id as ChatAgentTag)}
                      className={`h-8 px-3 rounded-lg text-[13px] font-medium ${agent.id === approvalPending.suggestedAgent ? "bg-[var(--surface-hover)] text-[var(--text)]" : "border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"}`}
                    >
                      {agent.label}
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

            {documentExpanded && (
              <div className="mb-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)] space-y-1">
                <textarea
                  value={documentText}
                  onChange={(e) => setDocumentText(e.target.value)}
                  placeholder="Paste policy or handbook text for a compliance check (or attach .txt)"
                  rows={4}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[13px] text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-y max-h-[200px]"
                  disabled={loading}
                />
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
            {uploadError && <p className="text-[13px] text-amber-500 mb-2">{uploadError}</p>}
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
              <p className="text-[13px] text-amber-500 mb-2">
                Message is too long ({input.length}/{MAX_MESSAGE_LENGTH} characters).
              </p>
            )}

            {/* Floating input: textarea row + controls row (responsive at all widths) */}
            <div className="rounded-[22px] sm:rounded-[26px] border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-md)] px-3 pt-2 pb-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Give Seeknimbly a task…"
                rows={1}
                maxLength={MAX_MESSAGE_LENGTH + 100}
                className="w-full min-h-[40px] max-h-[140px] py-2 resize-none bg-transparent text-[15px] text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none disabled:opacity-60"
                disabled={loading || !!approvalPending || !!pendingToolCalls}
              />
              <div className="flex items-center gap-1 sm:gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={handleAttachClick}
                  disabled={loading}
                  className="shrink-0 p-2 rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] disabled:opacity-50 transition-colors"
                  aria-label="Attach file"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentExpanded((v) => !v)}
                  className={`shrink-0 p-2 rounded-full transition-colors ${documentExpanded || documentText.trim() ? "text-[var(--accent)] bg-[var(--accent)]/10" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"}`}
                  aria-label="Toggle compliance document panel"
                  title="Paste a policy/handbook for compliance checks"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                </button>
                <div className="flex-1 min-w-0" />
                <select
                  aria-label="Agent"
                  value={agentChoice}
                  onChange={(e) => setAgentChoice(e.target.value as "auto" | ChatAgentTag)}
                  className="select-arrow shrink min-w-0 max-w-[42vw] sm:max-w-none h-8 pl-2 sm:pl-2.5 pr-6 sm:pr-7 rounded-full bg-transparent text-[var(--text-secondary)] text-[12px] font-medium appearance-none cursor-pointer hover:text-[var(--text)] truncate"
                >
                  <option value="auto">Auto</option>
                  {AGENTS_META.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Jurisdiction (NA, CA, US)"
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value as Jurisdiction)}
                  className="select-arrow shrink-0 h-8 pl-2 sm:pl-2.5 pr-6 sm:pr-7 rounded-full bg-transparent text-[var(--text-secondary)] text-[12px] font-medium appearance-none cursor-pointer hover:text-[var(--text)]"
                >
                  {JURISDICTIONS.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={requestRoute}
                  disabled={loading || !!approvalPending || !!pendingToolCalls || !input.trim() || input.length > MAX_MESSAGE_LENGTH}
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:scale-[0.96] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Send"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
              </div>
            </div>
            <p className="mt-2 text-center text-[11px] text-[var(--text-tertiary)]">
              <span className="hidden sm:inline">Enter to send · Shift+Enter for new line · </span>Agents draft, you approve
            </p>
          </div>
        </footer>
      </div>

      {rightPanelOpen && (
        <div className="hidden lg:block w-[300px] xl:w-[340px] 2xl:w-[400px] shrink-0 h-full border-l border-[var(--border)] bg-[var(--bg-elevated)]">
          <ApprovalsPanel refreshKey={approvalsRefreshKey} />
        </div>
      )}
    </div>
  );
}
