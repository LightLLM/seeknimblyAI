"use client";

import { signOut } from "next-auth/react";
import type { Chat } from "@/lib/storage";

type SidebarProps = {
  chats: Chat[];
  activeId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onCloseSidebar?: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export function Sidebar({
  chats,
  activeId,
  onNewChat,
  onSelectChat,
  onCloseSidebar,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  return (
    <>
      <aside
        className={`shrink-0 flex flex-col bg-[var(--surface)] border-r border-[var(--border)] transition-[width] duration-200 ease-out ${
          collapsed ? "w-0 overflow-hidden" : "w-[260px] min-w-0"
        }`}
      >
        <div className="flex items-center gap-2 h-12 px-3 border-b border-[var(--border)] shrink-0">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <h2 className="text-[15px] font-semibold text-[var(--text)] truncate flex-1">
            Seeknimbly HR
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onCloseSidebar?.();
          }}
          className="mx-2 mt-3 flex items-center gap-2 h-9 px-3 rounded-lg text-[13px] font-medium text-[var(--text)] bg-[var(--surface-hover)] border border-[var(--border)] hover:bg-[var(--border)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New chat
        </button>
        <nav className="flex-1 overflow-y-auto mt-2 px-2 pb-4" aria-label="Chat history">
          <ul className="space-y-0.5">
            {chats.map((chat) => (
              <li key={chat.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectChat(chat.id);
                    onCloseSidebar?.();
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] truncate transition-colors ${
                    activeId === chat.id
                      ? "bg-[var(--surface-hover)] text-[var(--text)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                  }`}
                >
                  {chat.title || "New chat"}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-2 border-t border-[var(--border)] shrink-0">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center gap-2 h-9 px-3 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
