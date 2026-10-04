import { playerPalette, type PlayerPalette } from "./theme";

export interface Appearance {
  background?: "transparent" | "solid";
  border?: "round" | "single" | "double" | "none";
  highContrast?: boolean;
  accent?: string;
}
export function validAppearance(value: unknown): Appearance {
  const v = value && typeof value === "object" ? value as Appearance : {};
  return {
    background: v.background === "solid" ? "solid" : "transparent",
    border: ["single", "double", "none"].includes(v.border ?? "") ? v.border : "round",
    highContrast: v.highContrast === true,
    accent: typeof v.accent === "string" && /^#[0-9a-f]{6}$/i.test(v.accent) ? v.accent : undefined,
  };
}
export function appearancePalette(theme?: string, appearance?: Appearance, artwork?: string): PlayerPalette {
  const a = validAppearance(appearance);
  const base = playerPalette(theme);
  if (!a.accent && !artwork && !a.highContrast) return base;
  const accent = a.accent ?? artwork ?? (a.highContrast ? "#ffffff" : base.accent);
  return { ...base, ...(a.highContrast ? { text: "#ffffff", muted: "#d8e0ee", alt: "#b6dcff" } : {}),
    accent, selection: accent, selectedText: readableForeground(accent) };
}
export function readableForeground(hex: string): string {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722 > 0.179 ? "#000000" : "#ffffff";
}
export function playerBackground(a?: Appearance) { return a?.background === "solid" ? "#10131b" : undefined; }
export function playerBorder(a?: Appearance) { return a?.border === "none" ? undefined : a?.border ?? "round"; }
