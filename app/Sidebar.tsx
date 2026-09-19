"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import type { Chat } from "@/lib/storage";

type SidebarProps = {
  chats: Chat[];
  activeId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onTogglePin: (id: string) => void;
  onCloseSidebar?: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

function useTheme(): [boolean, () => void] {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("seeknimbly_theme", next ? "dark" : "light");
    } catch {
      // ignore
    }
  };
  return [dark, toggle];
}

function SessionButton({
  chat,
  active,
  onSelect,
  onTogglePin,
  onCloseSidebar,
}: {
  chat: Chat;
  active: boolean;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  onCloseSidebar?: () => void;
}) {
  return (
    <button
      type="button"
      title={chat.pinned ? "Shift-click to unpin" : "Shift-click to pin"}
      onClick={(e) => {
        if (e.shiftKey) {
          onTogglePin(chat.id);
          return;
        }
        onSelect(chat.id);
        onCloseSidebar?.();
      }}
      className={`w-full flex items-center gap-1.5 text-left px-3 py-2 rounded-lg text-[13px] transition-colors ${
        active
          ? "bg-[var(--surface-hover)] text-[var(--text)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
      }`}
    >
      {chat.pinned && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-[var(--accent)]">
          <path d="M16 3l5 5-6 2-4 6-3-3-5 5-1-1 5-5-3-3 6-4 2-6z" />
        </svg>
      )}
      <span className="truncate">{chat.title || "New session"}</span>
    </button>
  );
}

type ClientRow = { id: string; legal_name: string; status?: string };

const NAV_ITEMS: { href: string; label: string; icon: string }[] = [
  { href: "/app/loop", label: "The Loop", icon: "M12 2a10 10 0 11-9.95 9M12 6v6l4 2" },
  { href: "/app/metrics", label: "Metrics", icon: "M18 20V10M12 20V4M6 20v-6" },
  { href: "/app/intake", label: "Intake", icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M12 18v-6M9 15h6" },
  { href: "/app/pipeline", label: "ATS Pipeline", icon: "M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M9 2h6v4H9z" },
  { href: "/app/crm", label: "CRM", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" },
  { href: "/app/compliance", label: "Compliance", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
  { href: "/app/capabilities", label: "Capabilities", icon: "M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8L12 2z" },
  { href: "/app/automations", label: "Automations", icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
  { href: "/app/messaging", label: "Messaging", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
  { href: "/app/artifacts", label: "Artifacts", icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6" },
  { href: "/app/memory", label: "Memory", icon: "M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z" },
  { href: "/app/approvals", label: "Approvals", icon: "M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3" },
  { href: "/app/audit", label: "Audit trail", icon: "M14 2v6h6M16 13H8M16 17H8M10 9H8" },
];

export function Sidebar({
  chats,
  activeId,
  onNewChat,
  onSelectChat,
  onTogglePin,
  onCloseSidebar,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const [dark, toggleTheme] = useTheme();
  const [clients, setClients] = useState<ClientRow[]>([]);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : { clients: [] }))
      .then((d: { clients?: ClientRow[] }) => setClients(d.clients ?? []))
      .catch(() => setClients([]));
  }, []);

  const filtered = query.trim()
    ? chats.filter((c) => (c.title || "").toLowerCase().includes(query.trim().toLowerCase()))
    : chats;
  const pinned = filtered.filter((c) => c.pinned);
  const sessions = filtered.filter((c) => !c.pinned);

  return (
    <aside
      className={`h-full shrink-0 flex flex-col bg-[var(--bg-elevated)] border-r border-[var(--border)] transition-[width] duration-200 ease-out ${
        collapsed ? "w-12 min-w-[3rem] overflow-hidden" : "w-[264px] min-w-0"
      }`}
    >
      <div className="flex items-center gap-2 h-12 px-3 shrink-0 min-w-0">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors shrink-0"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
          </svg>
        </button>
        {!collapsed && (
          <span className="wordmark text-[15px] tracking-wide truncate flex-1 min-w-0">Seeknimbly AI</span>
        )}
      </div>

      {!collapsed && (
        <>
          <nav className="px-2 space-y-0.5 shrink-0" aria-label="Main">
            <button
              type="button"
              onClick={() => {
                onNewChat();
                onCloseSidebar?.();
              }}
              className="w-full flex items-center gap-2.5 h-9 px-3 rounded-lg text-[13px] font-medium text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="flex-1 text-left">New session</span>
              <span className="flex gap-1">
                <kbd className="px-1.5 py-0.5 rounded border border-[var(--border)] text-[10px] text-[var(--text-tertiary)]">Ctrl</kbd>
                <kbd className="px-1.5 py-0.5 rounded border border-[var(--border)] text-[10px] text-[var(--text-tertiary)]">N</kbd>
              </span>
            </button>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 h-9 px-3 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="px-3 mt-3 shrink-0">
            <div className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[var(--text-tertiary)] shrink-0">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sessions…"
                className="flex-1 min-w-0 bg-transparent text-[12px] text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
                aria-label="Search sessions"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto mt-3 px-2 pb-3 min-h-0">
            <Link href="/app/projects" className="block px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)] hover:text-[var(--text)]">
              Projects <span className="ml-1 normal-case">{clients.length}</span>
            </Link>
            {clients.length === 0 ? (
              <p className="px-3 pb-2 text-[11px] text-[var(--text-tertiary)]">No clients yet — closed deals appear here</p>
            ) : (
              <ul className="space-y-0.5 pb-2">
                {clients.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <Link href="/app/projects" className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]" title={`Status: ${c.status ?? "onboarding"}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <rect x="2" y="7" width="20" height="14" rx="2" />
                        <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
                      </svg>
                      <span className="truncate flex-1">{c.legal_name}</span>
                      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${c.status === "live" ? "bg-emerald-500" : "bg-amber-400"}`} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="px-3 mb-1 mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
              Pinned
            </p>
            {pinned.length === 0 ? (
              <p className="px-3 pb-2 text-[11px] text-[var(--text-tertiary)]">Shift-click a session to pin</p>
            ) : (
              <ul className="space-y-0.5 pb-2">
                {pinned.map((chat) => (
                  <li key={chat.id}>
                    <SessionButton chat={chat} active={activeId === chat.id} onSelect={onSelectChat} onTogglePin={onTogglePin} onCloseSidebar={onCloseSidebar} />
                  </li>
                ))}
              </ul>
            )}
            <p className="px-3 mb-1 mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
              Sessions <span className="ml-1 normal-case">{sessions.length}</span>
            </p>
            <ul className="space-y-0.5" aria-label="Session history">
              {sessions.map((chat) => (
                <li key={chat.id}>
                  <SessionButton chat={chat} active={activeId === chat.id} onSelect={onSelectChat} onTogglePin={onTogglePin} onCloseSidebar={onCloseSidebar} />
                </li>
              ))}
            </ul>
          </div>

          <div className="p-2 border-t border-[var(--border)] shrink-0 space-y-0.5">
            <button
              type="button"
              onClick={toggleTheme}
              className="w-full flex items-center gap-2.5 h-9 px-3 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
            >
              {dark ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
              {dark ? "Light mode" : "Dark mode"}
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full flex items-center gap-2.5 h-9 px-3 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Sign out
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
