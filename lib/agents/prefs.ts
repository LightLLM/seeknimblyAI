/**
 * Client-side agent preferences: which agents are enabled in the chat UI.
 * Stored in localStorage; all agents enabled by default. Server routes stay
 * available regardless — this is a UI preference, not an access control.
 */

const KEY = "seeknimbly_disabled_agents";

export function getDisabledAgents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function setAgentEnabled(id: string, enabled: boolean): string[] {
  const disabled = new Set(getDisabledAgents());
  if (enabled) disabled.delete(id);
  else disabled.add(id);
  const list = Array.from(disabled);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  return list;
}

export function isAgentEnabled(id: string): boolean {
  return !getDisabledAgents().includes(id);
}
