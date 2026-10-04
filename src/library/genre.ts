import { execa } from "execa";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ffprobePath } from "../bin/binaries";
import type { Library } from "./library";

export function genreFromProbe(raw: string): string | undefined {
  const tags = JSON.parse(raw)?.format?.tags;
  if (!tags || typeof tags !== "object") return;
  const genre = Object.entries(tags).find(([key]) => key.toLowerCase() === "genre")?.[1];
  if (typeof genre !== "string") return;
  return genre.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 200) || undefined;
}

export async function probeGenre(file: string, signal: AbortSignal): Promise<string | undefined> {
  if (!path.isAbsolute(file) || !(await fs.stat(file)).isFile()) throw new Error("Not a local audio file");
  const { stdout } = await execa(ffprobePath(), ["-v", "error", "-protocol_whitelist", "file,pipe", "-show_entries", "format_tags=genre", "-of", "json", file],
    { timeout: 5000, maxBuffer: 64 * 1024, cancelSignal: signal });
  return genreFromProbe(stdout);
}

export interface GenreProgress { checked: number; updated: number; failed: number; total: number }
/** Explicit, cancellable read-only audio scan. Only the app's index is updated. */
export async function scanGenres(library: Library, signal: AbortSignal, progress: (p: GenreProgress) => void,
  probe = probeGenre): Promise<GenreProgress> {
  const tracks = [...library.all()];
  const result = { checked: 0, updated: 0, failed: 0, total: tracks.length };
  for (const track of tracks) {
    if (signal.aborted) break;
    try {
      const genre = await probe(track.filePath, signal);
      if (signal.aborted) break;
      const live = library.get(track.id);
      // Preserve concurrent renames/removals and existing tags when no tag was found.
      if (genre && live?.filePath === track.filePath && live.genre !== genre) {
        await library.upsert({ ...live, genre }); result.updated++;
      }
    } catch { if (!signal.aborted) result.failed++; }
    if (signal.aborted) break;
    result.checked++; progress({ ...result });
  }
  return result;
}
