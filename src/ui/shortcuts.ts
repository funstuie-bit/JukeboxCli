import type { Key } from "ink";

export const ACTIONS = [
  { id: "pause", label: "Play / pause", key: "space", scope: "global" },
  { id: "next", label: "Next track", key: "n", scope: "global" },
  { id: "previous", label: "Previous track", key: "p", scope: "global" },
  { id: "shuffle", label: "Shuffle", key: "s", scope: "global" },
  { id: "repeat", label: "Repeat", key: "r", scope: "global" },
  { id: "volumeUp", label: "Volume up", key: "+", scope: "global" },
  { id: "volumeDown", label: "Volume down", key: "-", scope: "global" },
  { id: "restart", label: "Restart track", key: "0", scope: "global" },
  { id: "player", label: "Now Playing", key: "m", scope: "global" },
  { id: "home", label: "Home", key: "H", scope: "global" },
  { id: "help", label: "Help", key: "?", scope: "global" },
  { id: "quit", label: "Quit (Ctrl+C always works)", key: "q", scope: "global" },
  { id: "artwork", label: "Show / hide artwork", key: "b", scope: "player" },
  { id: "lyrics", label: "Lyrics / queue", key: "l", scope: "player" },
  { id: "playerSearch", label: "Player search", key: "S", scope: "player" },
  { id: "visualizer", label: "Cycle visualiser", key: "v", scope: "player" },
  { id: "fullscreen", label: "Fullscreen effects", key: "F", scope: "player" },
  { id: "theme", label: "Cycle theme", key: "T", scope: "player" },
  { id: "motion", label: "Decorative motion", key: "V", scope: "player" },
  { id: "queueRemove", label: "Remove queue row", key: "x", scope: "queue" },
  { id: "queueUp", label: "Move queue row up", key: "u", scope: "queue" },
  { id: "queueDown", label: "Move queue row down", key: "D", scope: "queue" },
] as const;
export type ShortcutScope = "global" | "player" | "queue";
export type Bindings = Partial<Record<typeof ACTIONS[number]["id"], string>>;
// Reserved editing/navigation and section keys are deliberately not rebindable.
const fixed = new Set("123456789ojk/[]dtafRLOAPXCEBIyN=_,.".split(""));
export function bindingError(bindings: Bindings): string | undefined {
  const used = new Map<string, string>();
  for (const a of ACTIONS) {
    const key = bindings[a.id] ?? a.key;
    if (!(key === "space" || /^[!-~]$/.test(key) || /^ctrl\+[abefgknoprtuvwxy]$/.test(key)))
      return "Use one printable key, space, or Ctrl plus a supported letter; navigation and Ctrl+C are reserved.";
    if (key !== a.key && fixed.has(key)) return `${key} is reserved for an existing section action.`;
    const other = used.get(key);
    if (other) return `${key} conflicts with ${other}.`;
    used.set(key, a.label);
  }
  for (const a of ACTIONS) {
    const key = bindings[a.id];
    if (key && key !== a.key && ACTIONS.some(other => other.key === key)) return `${key} is reserved in another context.`;
  }
}
export function validBindings(value: unknown): Bindings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Bindings = {};
  for (const a of ACTIONS) {
    const key = (value as Record<string, unknown>)[a.id];
    if (typeof key === "string" && key !== a.key) result[a.id] = key;
  }
  return bindingError(result) ? {} : result;
}
export function keyToken(input: string, key: Key): string {
  if (key.ctrl) return `ctrl+${input.toLowerCase()}`;
  if (key.meta) return "";
  return input === " " ? "space" : input;
}
/** Translate actions, not text. Null suppresses a replaced shortcut. */
export function shortcutInput(input: string, key: Key, bindings: Bindings | undefined, scope: ShortcutScope): [string, Key] | null {
  if (!bindings || !Object.keys(bindings).length) return [input, key];
  const token = keyToken(input, key);
  const actions = ACTIONS.filter(a => a.scope === scope);
  const matched = actions.find(a => (bindings[a.id] ?? a.key) === token);
  if (matched) return [matched.key === "space" ? " " : matched.key, { ...key, ctrl: false, meta: false, shift: matched.key !== matched.key.toLowerCase() }];
  if (actions.some(a => bindings[a.id] && a.key === token)) return null;
  // Legacy aliases must not silently undo an explicit rebind.
  if (scope === "global" && ((bindings.pause && input === "k") || (bindings.volumeUp && input === "=") || (bindings.volumeDown && input === "_"))) return null;
  return [input, key];
}
export function shortcutLabel(canonical: string, bindings?: Bindings, scope?: ShortcutScope): string {
  // Delimiters stay intact in compound hints like m/esc and n p.
  return canonical.split(/([ /]+)/).map(token => {
    const a = ACTIONS.find(a => a.key === token && (!scope || a.scope === scope || a.scope === "global"));
    return a && bindings?.[a.id] ? bindings[a.id]! : token;
  }).join("");
}
