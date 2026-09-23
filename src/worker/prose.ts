import type { PromptStyle } from "@jev-poker/agent";
import allowlist from "./prose-allowlist.json";

export interface ProseAllowlist {
  tasks: Record<string, PromptStyle>;
  lines: string[];
}

/** Every sentence the library can put in front of Jev; see scripts/prose-allowlist.ts. */
export const PROSE = allowlist as ProseAllowlist;

export function styleOfTask(task: string, prose: ProseAllowlist = PROSE): PromptStyle | null {
  return Object.hasOwn(prose.tasks, task) ? (prose.tasks[task] as PromptStyle) : null;
}

/**
 * Known lines, each at most once — so no request can be longer than the allowlist. The length
 * check comes first only so an oversized array is refused without walking it.
 */
export function allowedLines(lines: unknown, prose: ProseAllowlist = PROSE): lines is string[] {
  if (!Array.isArray(lines) || lines.length > prose.lines.length) return false;
  const known = new Set(prose.lines);
  const seen = new Set<string>();
  for (const line of lines) {
    if (typeof line !== "string" || !known.has(line) || seen.has(line)) return false;
    seen.add(line);
  }
  return true;
}
