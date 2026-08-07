/**
 * Shared form-helper components for the first-run wizard (Welcome) and the
 * Settings screen. Extracted from the inline render code in those views so a
 * settings row, select sub-page, text-entry sub-page, and on/off toggle can
 * all be spelled the same way from either site.
 *
 * Visual language follows theme.ts: dim rows at rest, the flame accent
 * (COLOR.accent) for the active row pointer, honey brass (COLOR.alt) for
 * "set" details, rose (COLOR.bad) for danger, and bold for the focused row.
 * Hints use dimColor and the same ICON.dot separator + key-hint rhythm
 * Settings and Welcome already speak.
 *
 * Each component renders only the body content. Callers still wrap with their
 * own Header / HintLine (Settings' `frame`) so page chrome stays consistent
 * across sub-pages.
 */

import { Box, Text, useInput } from "ink";
import { Select } from "@inkjs/ui";
import { COLOR, ICON } from "../theme";
import { TextField } from "./TextField";

/**
 * Visual detail column alongside a setting's label — colored honey brass when
 * the value is set, rose for danger, and dim otherwise — mirroring the inline
 * detail styling Settings.tsx used before extracting SettingRow.
 */
function detailColor(props: { set?: boolean; danger?: boolean }): string | undefined {
  if (props.danger) return COLOR.bad;
  if (props.set) return COLOR.alt;
  return undefined;
}

/**
 * A single row in a settings menu: a leading pointer glyph (or two spaces)
 * followed by a padded label and an inline detail value. The pointer, label
 * color, and weight all react to `active`; the detail color reacts to `set`
 * and `danger`. Matches the manual row markup in Settings' menu map and
 * Welcome's source list.
 */
export interface SettingRowProps {
  /** Left-column name, e.g. "YouTube handle". */
  label: string;
  /** Right-column value, e.g. "@foo" or "not set". Optional because danger
   *  rows may not have a meaningful value to show. */
  value?: string;
  /** Whether this row currently owns the cursor: shows the pointer, gains the
   *  accent color, and renders bold (same as Welcome's `here` flag). */
  active: boolean;
  /** Marks a row whose value is set, so the detail renders in COLOR.alt
   *  (honey brass) instead of dim — same as Settings' `it.set` flag. */
  set?: boolean;
  /** Destructive rows render the label and detail in COLOR.bad (rose), same
   *  as Settings' `it.danger` flag. Overrides `set` on the detail. */
  danger?: boolean;
  /** Optional click handler, reserved for forward-compat with mouse-driven
   *  menus. The keyboard path calls onSelect directly so this isn't wired to
   *  the rendered <Box> (Ink's Box doesn't accept onClick); it's here on the
   *  prop type for callers that want to thread it through and invoke it from
   *  their own mouse layer. */
  onClick?: () => void;
}

export function SettingRow({
  label,
  value,
  active,
  set = false,
  danger = false,
  onClick,
}: SettingRowProps) {
  // Intentionally not passed to <Box>: Ink's Box has no onClick prop. Kept on
  // the prop type for forward-compat with mouse layers; a caller wiring mouse
  // input can call onClick directly from their own useInput handler.
  void onClick;
  const detail = detailColor({ set, danger });
  return (
    <Box>
      <Text color={COLOR.accent}>{active ? `${ICON.pointer} ` : "  "}</Text>
      <Text
        color={danger ? COLOR.bad : active ? COLOR.accent : undefined}
        bold={active}
        dimColor={!active && !danger}
      >
        {label}
      </Text>
      {value !== undefined ? (
        <Text color={detail} dimColor={!set && !danger}>
          {`   ${value}`}
        </Text>
      ) : null}
    </Box>
  );
}

/**
 * A select sub-page body wrapping @inkjs/ui's `Select` with a title and dim
 * hint, matching the layout of Settings' folder-confirm and wipe-all pages
 * when rendered inside `frame`. The `Select` keyboard (↑/↓ to move, ↵ to
 * choose) is owned by @inkjs/ui; the esc-to-cancel handler installed here
 * only fires when `focused` (e.g. `region === "content"`).
 *
 * Note: the @inkjs/ui Select prop name is `onChange`; we expose it as the
 * semantically named `onSelect` so callers don't have to remember that.
 */
export interface SelectFieldProps {
  /** Page title shown in bold above the list, e.g. "Wipe all songs?". Pass an
   *  empty string when wrapping in Settings' `frame(title, …)` so the title
   *  is rendered once (by Header) instead of duplicated. Standalone callers
   *  (e.g. Welcome's handle step) pass a real title. */
  title: string;
  /** Pass-through to `Select.options`. */
  options: { label: string; value: string }[];
  /** Called with the chosen value when the user presses enter. */
  onSelect: (value: string) => void;
  /** Called on esc; callers typically flip back to their menu mode. */
  onCancel: () => void;
  /** Whether this field owns the keyboard — fed to `Select.isDisabled` and
   *  gates the esc handler, same way Settings gates sub-pages on `focused`. */
  focused: boolean;
  /** Dim hint rendered under the list (e.g. "↑↓ Move · ↵ Choose · esc Back").
   *  Omit when wrapping in Settings' `frame(_, _, hint)` so the hint is shown
   *  once via HintLine instead of duplicated here. */
  hint?: string;
}

export function SelectField({
  title,
  options,
  onSelect,
  onCancel,
  focused,
  hint,
}: SelectFieldProps) {
  useInput(
    (_input, key) => {
      if (key.escape) onCancel();
    },
    { isActive: focused },
  );
  return (
    <Box flexDirection="column">
      {title ? (
        <Box>
          <Text bold color={COLOR.text}>
            {title}
          </Text>
        </Box>
      ) : null}
      <Select
        isDisabled={!focused}
        options={options}
        onChange={(v) => onSelect(v)}
      />
      {hint !== undefined ? (
        <Box marginTop={1}>
          <Text dimColor>{hint}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

/**
 * A text-entry sub-page body wrapping the existing TextField with a title row,
 * a dim hint, and the pointer glyph + Enter-to-save convention used in
 * Settings' `handleField` and Welcome's handle-entry step.
 *
 * TextField's own `useInput` deliberately ignores esc (it routes around
 * ctrl-c ambiguities and meta combos), so a separate esc handler installed
 * here gates on `focused` — same pattern Welcome's handle step uses
 * (`useInput(isActive: step === "handle")` for its esc handler alongside
 * the TextField for typing).
 */
export interface TextInputFieldProps {
  /** Bold title shown above the field, e.g. "Your YouTube handle". */
  title: string;
  /** Dim hint rendered under the title (e.g. "Type a handle, or paste a link"). */
  hint?: string;
  /** Pass-through to TextField's placeholder (shown when empty). */
  placeholder?: string;
  /** Pre-filled value (e.g. an existing handle being edited). Passes through
   *  as `defaultValue`, which TextField treats as controlled internal state. */
  defaultValue?: string;
  /** Called with the trimmed value when the user presses Enter. */
  onSubmit: (value: string) => void;
  /** Called on esc; callers typically navigate back to the parent mode. */
  onCancel: () => void;
  /** Whether this field owns the keyboard — fed to TextField's `isDisabled`
   *  and to the esc handler. */
  focused: boolean;
}

export function TextInputField({
  title,
  hint,
  placeholder,
  defaultValue,
  onSubmit,
  onCancel,
  focused,
}: TextInputFieldProps) {
  // Separate esc handler — TextField's own keymap ignores esc so global nav
  // (and ctrl-c) still works while typing.
  useInput(
    (_input, key) => {
      if (key.escape) onCancel();
    },
    { isActive: focused },
  );
  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color={COLOR.text}>
          {title}
        </Text>
      </Box>
      {hint !== undefined ? (
        <Box>
          <Text dimColor>{hint}</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text color={COLOR.accent}>{`${ICON.pointer} `}</Text>
        <TextField
          isDisabled={!focused}
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder}
          onSubmit={(v) => onSubmit(v.trim() || "")}
        />
      </Box>
    </Box>
  );
}

/**
 * A boolean on/off toggle driven by arrow keys (up/down or left/right). Like
 * `SettingRow` it renders a label with optional active styling, then shows
 * the current state as "on" / "off" — coloring on with the success/mint tone
 * and off with the dim text — so the toggle reads the same as other set /
 * not-set details across the app.
 *
 * The keys echo ink's up/down for "taller" nav lists and left/right for
 * horizontally-flavored pages, both common TUI conventions. Pressing either
 * direction calls `onToggle`; the parent is responsible for flipping the
 * boolean (controlled pattern — the field never holds state).
 */
export interface ToggleFieldProps {
  /** Label shown for the toggle row. */
  label: string;
  /** Current boolean value (controlled by the parent). */
  value: boolean;
  /** Called when the user presses any of ↑/↓/←/→. The parent should flip its
   *  `value` boolean in response — if you want toggle-cycling only on one
   *  direction, wrap this on the caller side. */
  onToggle: () => void;
  /** Whether the toggle currently owns the keyboard (renders accent pointer
   *  and bold label, same as SettingRow's `active`). */
  active: boolean;
}

export function ToggleField({
  label,
  value,
  onToggle,
  active,
}: ToggleFieldProps) {
  useInput(
    (_input, key) => {
      if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) {
        onToggle();
      }
    },
    { isActive: active },
  );
  return (
    <Box>
      <Text color={COLOR.accent}>{active ? `${ICON.pointer} ` : "  "}</Text>
      <Text
        color={active ? COLOR.accent : undefined}
        bold={active}
        dimColor={!active}
      >
        {label}
      </Text>
      <Text color={value ? COLOR.good : undefined} dimColor={!value}>
        {`   ${value ? "on" : "off"}`}
      </Text>
    </Box>
  );
}