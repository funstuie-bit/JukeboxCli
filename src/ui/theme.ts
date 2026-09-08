// Central visual vocabulary for the TUI: one place for accent colors and the
// small glyph set we trust to render in a terminal. Keeping these here means
// every section speaks the same visual language instead of each picking its own.

import { defaultTheme, extendTheme } from "@inkjs/ui";

export const COLOR = {
  /** Soft lavender focus and progress, paired with clear blue secondary text. */
  accent: "#b8a5ed",
  /** Explicit foreground avoids inheriting low-contrast terminal theme colours. */
  text: "#e3e7f2",
  /** Secondary blue for artists, headers and key labels. */
  alt: "#8fb9ed",
  muted: "#9aa8c3",
  selection: "#b8a5ed",
  selectedText: "#171b2b",
  /** Now-playing / success: soft mint-green, kept clearly apart from the warm
   *  accent so the playing marker reads at a glance. */
  good: "#86d6a2",
  /** Warnings (rate limits, empty results): golden amber, nudged yellow so it
   *  reads as caution rather than melting into the orange accent. */
  warn: "#f0c560",
  /** Failures: rose, pushed pink/cool so errors never read as the accent. */
  bad: "#ee7d92",
  /** Sunlit amber: the bright end of the accent ramp, and the saves-to path
   *  on the Welcome screen. */
  amber: "#ffb163",
} as const;

/**
 * Glyphs known to render in Windows Terminal, macOS Terminal, and common Linux
 * emulators. Kept deliberately tiny.
 */
export const ICON = {
  play: "▶",
  pause: "⏸",
  done: "✓",
  error: "✗",
  canceled: "⊘",
  skipped: "•",
  pending: "·",
  pointer: "❯",
  dot: "·",
  warn: "⚠",
  shuffle: "⇄",
  repeat: "↻",
  /** Solid left edge used to mark the active nav row. */
  bar: "▌",
} as const;

/** Slate separators sit behind the brighter text and selection. */
export const RULE = "#52617c";

/** Parse "#rrggbb" into [r, g, b]. */
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Linear-interpolate two "#rrggbb" colors; t in [0, 1]. */
export function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  const c = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
}

/**
 * Shared lavender-to-blue ramp for progress and the wordmark.
 */
export const ACCENT_RAMP: readonly [string, string] = [
  COLOR.accent,
  COLOR.alt,
];

/**
 * @inkjs/ui theme override so its Select and Spinner share our lavender accent
 * instead of their default green/blue. Without this the list cursor and
 * loading spinners would clash with the brand color.
 */
export const uiTheme = extendTheme(defaultTheme, {
  components: {
    Select: {
      styles: {
        focusIndicator: () => ({ color: COLOR.accent }),
        selectedIndicator: () => ({ color: COLOR.accent }),
        label: (props: { isFocused?: boolean; isSelected?: boolean } = {}) => ({
          color: props.isFocused || props.isSelected ? COLOR.accent : undefined,
        }),
      },
    },
    Spinner: {
      styles: {
        frame: () => ({ color: COLOR.accent }),
      },
    },
  },
});
