import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Config } from "./config";

/**
 * Import settings from an existing yt-dlp config file.
 * yt-dlp reads from these locations in order:
 *   1. CLI flags
 *   2. --config-location
 *   3. ~/yt-dlp.conf
 *   4. /etc/yt-dlp.conf
 *   5. %APPDATA%/yt-dlp/yt-dlp.conf (Windows)
 *   6. ~/.config/yt-dlp/yt-dlp.conf (XDG)
 *   7. ~~/Library/Application Support/yt-dlp/yt-dlp.conf (macOS)
 *
 * The format is CLI args, one per line, with # for comments.
 */

export interface ImportResult {
  success: boolean;
  /** Settings that were found and could be mapped. */
  imported: Partial<Config>;
  /** Settings that were found but couldn't be mapped. */
  unmapped: string[];
  /** Settings that couldn't be parsed. */
  errors: string[];
  /** Path that was read, for the UI to display. */
  sourcePath?: string;
}

const MAPPABLE_FLAGS: { flags: string[]; configKey: keyof Config; transform?: (v: string) => any }[] = [
  { flags: ["--audio-format"], configKey: "audioFormat" },
  { flags: ["--audio-quality"], configKey: "audioQuality" },
  { flags: ["-f", "--format"], configKey: "formatString" },
  { flags: ["--output", "-o"], configKey: "outputTemplate" },
  { flags: ["--cookies"], configKey: "cookiesFile" },
  { flags: ["--cookies-from-browser"], configKey: "cookiesFromBrowser" },
  { flags: ["--sleep-interval"], configKey: "sleepInterval", transform: Number },
  { flags: ["--max-sleep-interval"], configKey: "maxSleepInterval", transform: Number },
  { flags: ["--retries"], configKey: "retries", transform: Number },
  {
    flags: ["--postprocessor-args"],
    // Only reencodeAudio=true is detectable; full arg passthrough not supported
    transform: (v) => /ffmpeg|libmp3lame/i.test(v),
    configKey: "reencodeAudio",
  },
];

/** Standard locations to check for yt-dlp config. */
export function ytDlpConfigPaths(): string[] {
  const home = os.homedir();
  return [
    path.join(home, "yt-dlp.conf"),
    path.join(home, "Library/Application Support/yt-dlp/yt-dlp.conf"),
    path.join(home, ".config/yt-dlp/yt-dlp.conf"),
    path.join(home, ".yt-dlp.conf"),
  ];
}

/** Find the first existing yt-dlp config file. */
export async function findYtDlpConfig(): Promise<string | null> {
  for (const p of ytDlpConfigPaths()) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // not found, try next
    }
  }
  return null;
}

/** Parse a single line from a yt-dlp config file. */
function parseLine(line: string): { flag: string; value?: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  // --flag value or -f value
  const spaceMatch = trimmed.match(/^(--?[\w-]+)\s+(.+)$/);
  if (spaceMatch) {
    return { flag: spaceMatch[1]!, value: stripQuotes(spaceMatch[2]!) };
  }
  // --flag=value
  const eqMatch = trimmed.match(/^(--?[\w-]+)=(.+)$/);
  if (eqMatch) {
    return { flag: eqMatch[1]!, value: stripQuotes(eqMatch[2]!) };
  }
  // bare flag
  return { flag: trimmed };
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/** Parse a yt-dlp config file content into flag/value pairs. */
function parseConfigContent(content: string): { flag: string; value?: string }[] {
  const lines = content.split("\n");
  return lines.map(parseLine).filter((p): p is { flag: string; value?: string } => p !== null);
}

/** Import settings from a yt-dlp config file. */
export async function importFromYtDlpConfig(filePath: string): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    imported: {},
    unmapped: [],
    errors: [],
    sourcePath: filePath,
  };

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const pairs = parseConfigContent(content);

    for (const { flag, value } of pairs) {
      // Some lines have multiple flags, e.g. "-f bestaudio --audio-format mp3"
      // We split those. But for now, treat the line as a single unit.
      const mapping = MAPPABLE_FLAGS.find((m) => m.flags.includes(flag));
      if (mapping) {
        if (value !== undefined) {
          const transformed = mapping.transform ? mapping.transform(value) : value;
          (result.imported as any)[mapping.configKey] = transformed;
        }
      } else {
        result.unmapped.push(flag);
      }
    }
    result.success = true;
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : String(e));
  }

  return result;
}

/** Detect if there's a yt-dlp config and offer to import it. */
export async function detectAndImport(): Promise<ImportResult | null> {
  const path = await findYtDlpConfig();
  if (!path) return null;
  return importFromYtDlpConfig(path);
}