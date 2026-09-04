import { promises as fs } from "node:fs";
import path from "node:path";
import { execa } from "execa";
import { ffmpegPath, toolEnv } from "../bin/binaries";
import { downloadLogFile } from "../config/paths";
import type { Track } from "./types";

/**
 * In-place library conversion: re-encode every song into one container,
 * replacing each file where it lives. Each song is atomic — a stop or a crash
 * leaves it as its old file or its new one, never a half-written song — and
 * re-runs skip whatever is already in the target format.
 */

/** Formats the converter can produce (the lossy + lossless download choices). */
export type ConvertFormat = "m4a" | "mp3" | "opus" | "flac" | "wav";

/**
 * Encoder settings per target container. Bitrates sit where another
 * generation of lossy re-encoding stops being audible against sources that
 * hand us 128–256k in the first place; opus reaches the same place lower.
 * FLAC and WAV are lossless, so no bitrate applies.
 */
const ENCODER: Record<ConvertFormat, string[]> = {
  m4a: ["-c:a", "aac", "-b:a", "192k"],
  mp3: ["-c:a", "libmp3lame", "-b:a", "192k", "-id3v2_version", "3"],
  opus: ["-c:a", "libopus", "-b:a", "128k"],
  flac: ["-c:a", "flac"],
  wav: ["-c:a", "pcm_s16le"],
};

/**
 * Cover art rides along for m4a and mp3, which carry an embedded picture
 * stream. The other containers can't take one from ffmpeg, so those
 * conversions drop the video stream rather than fail on it.
 */
const ART: Record<ConvertFormat, string[]> = {
  m4a: ["-c:v", "copy"],
  mp3: ["-c:v", "copy"],
  opus: ["-vn"],
  flac: ["-vn"],
  wav: ["-vn"],
};

/**
 * The muxer, named rather than inferred: the temp file deliberately ends in
 * `.tmp` (so a leftover from a crash is invisible to the library walk, which
 * only sees known audio extensions), and ffmpeg cannot read the container
 * off that extension.
 */
const MUXER: Record<ConvertFormat, string> = {
  m4a: "ipod",
  mp3: "mp3",
  opus: "opus",
  flac: "flac",
  wav: "wav",
};

/** Same folder, same name, new extension: the library's layout never moves. */
export function targetPath(filePath: string, format: ConvertFormat): string {
  const dir = path.dirname(filePath);
  const stem = path.basename(filePath, path.extname(filePath));
  return path.join(dir, `${stem}.${format}`);
}

/** True when this track is not already in the target format. */
export function needsConversion(
  track: Pick<Track, "filePath">,
  format: ConvertFormat,
): boolean {
  return path.extname(track.filePath).toLowerCase() !== `.${format}`;
}

/** ffmpeg's own words for a codec this build was not compiled with. */
export function isMissingEncoder(detail: string): boolean {
  return /unknown encoder|encoder not found|could not find encoder/i.test(
    detail,
  );
}

export interface ConvertProgress {
  /** Songs actually re-encoded so far. Never counts a failure as a success. */
  converted: number;
  /** Songs ffmpeg could not convert so far. */
  failed: number;
  /** Songs that need re-encoding; already-correct ones are excluded. */
  total: number;
}

export interface ConvertResult {
  /** Files re-encoded and swapped into place. */
  converted: number;
  /** Paths ffmpeg could not convert; their originals are still there. */
  failed: string[];
  /** True when a stop was requested before the batch finished. */
  stopped: boolean;
  /**
   * This ffmpeg cannot make this format at all. ffmpeg-static packages a
   * different upstream build per OS, so rather than assume every one ships
   * libmp3lame and libopus, the first "unknown encoder" ends the run: one
   * clear answer beats the same failure repeated for every song.
   */
  missingEncoder: boolean;
}

/** Minimal spawn shape, so tests can fake ffmpeg without a real process. */
export type ConvertExec = (
  file: string,
  args: string[],
) => Promise<{ ok: boolean; errText: string }>;

async function defaultExec(
  file: string,
  args: string[],
): Promise<{ ok: boolean; errText: string }> {
  try {
    await execa(file, args, { env: toolEnv() });
    return { ok: true, errText: "" };
  } catch (e) {
    const err = e as { message?: string; stderr?: string };
    return { ok: false, errText: `${err.message ?? ""}\n${err.stderr ?? ""}` };
  }
}

/** One line per failure so "2 failed" has somewhere to lead. */
async function logFailure(filePath: string, detail: string): Promise<void> {
  if (process.env.VITEST) return;
  try {
    await fs.mkdir(path.dirname(downloadLogFile), { recursive: true });
    await fs.appendFile(
      downloadLogFile,
      `${new Date().toISOString()} [convert] ${filePath} | ${detail}\n`,
    );
  } catch {
    // Never let logging affect the conversion.
  }
}

/**
 * Re-encode a library into one format, in place.
 *
 * `onConverted` fires after a file is swapped so the caller can update the
 * library index; keeping it a callback (rather than importing Library) leaves
 * this module about files, with the UI owning bookkeeping.
 */
export async function convertTracks(
  tracks: Track[],
  format: ConvertFormat,
  opts: {
    onProgress?: (p: ConvertProgress) => void;
    onConverted?: (track: Track, newPath: string) => void | Promise<void>;
    shouldStop?: () => boolean;
    /** Injectable spawn so tests never need a real ffmpeg. */
    exec?: ConvertExec;
  } = {},
): Promise<ConvertResult> {
  const { onProgress, onConverted, shouldStop, exec = defaultExec } = opts;
  const pending = tracks.filter((t) => needsConversion(t, format));
  const progress: ConvertProgress = {
    converted: 0,
    failed: 0,
    total: pending.length,
  };
  const failed: string[] = [];
  const report = () => onProgress?.({ ...progress });
  report();

  for (const t of pending) {
    if (shouldStop?.()) {
      report();
      return {
        converted: progress.converted,
        failed,
        stopped: true,
        missingEncoder: false,
      };
    }
    const target = targetPath(t.filePath, format);
    const tmp = `${target}.tmp`;
    const res = await exec(ffmpegPath(), [
      "-y",
      "-i",
      t.filePath,
      ...ENCODER[format],
      ...ART[format],
      "-f",
      MUXER[format],
      tmp,
    ]);
    if (!res.ok) {
      progress.failed++;
      failed.push(t.filePath);
      await logFailure(t.filePath, res.errText.trim() || "ffmpeg failed");
      if (isMissingEncoder(res.errText)) {
        report();
        return {
          converted: progress.converted,
          failed,
          stopped: false,
          missingEncoder: true,
        };
      }
      report();
      continue;
    }
    // Swap atomically: the rename is instant on the same volume, so a crash
    // leaves either the old file or the new one — never a half-written song.
    await fs.rename(tmp, target);
    await fs.rm(t.filePath, { force: true });
    progress.converted++;
    await onConverted?.(t, target);
    report();
  }
  return {
    converted: progress.converted,
    failed,
    stopped: false,
    missingEncoder: false,
  };
}
