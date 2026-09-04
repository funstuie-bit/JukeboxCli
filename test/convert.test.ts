import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  convertTracks,
  isMissingEncoder,
  needsConversion,
  targetPath,
  type ConvertExec,
  type ConvertFormat,
} from "../src/library/convert";
import type { Track } from "../src/library/types";

function trackAt(filePath: string): Track {
  const name = path.basename(filePath);
  return {
    id: `t-${name}`,
    source: "youtube",
    sourceTrackId: name,
    title: name,
    filePath,
    addedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("convert: paths and classification", () => {
  it("targetPath swaps the extension and keeps the folder", () => {
    expect(targetPath("/lib/YouTube/Set/Song.opus", "mp3")).toBe(
      "/lib/YouTube/Set/Song.mp3",
    );
    expect(targetPath("/lib/a/b/Track.m4a", "flac")).toBe("/lib/a/b/Track.flac");
  });

  it("needsConversion is only true for a different extension", () => {
    expect(needsConversion({ filePath: "/x/Song.opus" }, "mp3")).toBe(true);
    expect(needsConversion({ filePath: "/x/Song.mp3" }, "mp3")).toBe(false);
    expect(needsConversion({ filePath: "/x/Song.MP3" }, "mp3")).toBe(false);
  });

  it("isMissingEncoder matches ffmpeg's unknown-encoder phrasings only", () => {
    expect(isMissingEncoder("Unknown encoder 'libopus'")).toBe(true);
    expect(isMissingEncoder("encoder not found: aac")).toBe(true);
    expect(isMissingEncoder("could not find encoder for codec flac")).toBe(true);
    expect(isMissingEncoder("Permission denied")).toBe(false);
    expect(isMissingEncoder("No such file or directory")).toBe(false);
  });
});

describe("convert: ffmpeg arguments", () => {
  const cases: Array<{
    format: ConvertFormat;
    encoder: string[];
    art: string[];
    muxer: string;
  }> = [
    { format: "m4a", encoder: ["-c:a", "aac", "-b:a", "192k"], art: ["-c:v", "copy"], muxer: "ipod" },
    {
      format: "mp3",
      encoder: ["-c:a", "libmp3lame", "-b:a", "192k", "-id3v2_version", "3"],
      art: ["-c:v", "copy"],
      muxer: "mp3",
    },
    { format: "opus", encoder: ["-c:a", "libopus", "-b:a", "128k"], art: ["-vn"], muxer: "opus" },
    { format: "flac", encoder: ["-c:a", "flac"], art: ["-vn"], muxer: "flac" },
    { format: "wav", encoder: ["-c:a", "pcm_s16le"], art: ["-vn"], muxer: "wav" },
  ];

  for (const { format, encoder, art, muxer } of cases) {
    it(`builds the full ${format} command`, async () => {
      const calls: string[][] = [];
      const exec: ConvertExec = async (_file, args) => {
        calls.push(args);
        return { ok: false, errText: "skip rename" };
      };
      await convertTracks([trackAt("/x/Song.webm")], format, { exec });
      expect(calls.length).toBe(1);
      expect(calls[0]).toEqual([
        "-y",
        "-i",
        "/x/Song.webm",
        ...encoder,
        ...art,
        "-f",
        muxer,
        "/x/Song." + format + ".tmp",
      ]);
    });
  }
});

describe("convert: runs", () => {
  it("swaps files atomically and reports the new path", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sndcli-convert-"));
    const original = path.join(dir, "a.opus");
    await fs.writeFile(original, "old-bytes");
    const converted: Array<{ id: string; newPath: string }> = [];
    const exec: ConvertExec = async (_file, args) => {
      await fs.writeFile(args[args.length - 1]!, "new-bytes");
      return { ok: true, errText: "" };
    };
    const res = await convertTracks([trackAt(original)], "mp3", {
      exec,
      onConverted: (t, newPath) => {
        converted.push({ id: t.id, newPath });
      },
    });
    expect(res.converted).toBe(1);
    expect(res.failed).toEqual([]);
    expect(converted).toEqual([
      { id: "t-a.opus", newPath: path.join(dir, "a.mp3") },
    ]);
    // New file in place, old file gone, no .tmp left behind.
    expect(await fs.readFile(path.join(dir, "a.mp3"), "utf8")).toBe(
      "new-bytes",
    );
    await expect(fs.stat(original)).rejects.toThrow();
    await expect(fs.stat(path.join(dir, "a.mp3.tmp"))).rejects.toThrow();
  });

  it("skips tracks already in the target format", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sndcli-convert-"));
    const a = trackAt(path.join(dir, "a.mp3"));
    const b = trackAt(path.join(dir, "b.opus"));
    let calls = 0;
    const exec: ConvertExec = async (_file, args) => {
      calls++;
      await fs.writeFile(args[args.length - 1]!, "x");
      return { ok: true, errText: "" };
    };
    const res = await convertTracks([a, b], "mp3", { exec });
    expect(calls).toBe(1);
    expect(res.converted).toBe(1);
  });

  it("a missing encoder ends the run instead of failing every song", async () => {
    const tracks = [trackAt("/x/a.webm"), trackAt("/x/b.webm"), trackAt("/x/c.webm")];
    let calls = 0;
    const exec: ConvertExec = async () => {
      calls++;
      return { ok: false, errText: "Unknown encoder 'libopus'" };
    };
    const res = await convertTracks(tracks, "opus", { exec });
    expect(calls).toBe(1);
    expect(res.missingEncoder).toBe(true);
    expect(res.failed).toEqual(["/x/a.webm"]);
  });

  it("ordinary failures are logged and the run continues", async () => {
    const tracks = [trackAt("/x/a.webm"), trackAt("/x/b.webm"), trackAt("/x/c.webm")];
    let calls = 0;
    const exec: ConvertExec = async () => {
      calls++;
      return { ok: false, errText: "Permission denied" };
    };
    const res = await convertTracks(tracks, "mp3", { exec });
    expect(calls).toBe(3);
    expect(res.missingEncoder).toBe(false);
    expect(res.failed).toEqual(["/x/a.webm", "/x/b.webm", "/x/c.webm"]);
    expect(res.converted).toBe(0);
  });

  it("respects a stop request between files", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sndcli-convert-"));
    const tracks = [trackAt(path.join(dir, "a.opus")), trackAt(path.join(dir, "b.opus"))];
    // Both originals exist on disk: the untouched one must survive the stop.
    for (const t of tracks) await fs.writeFile(t.filePath, "orig");
    let stopped = false;
    let calls = 0;
    const exec: ConvertExec = async (_file, args) => {
      calls++;
      await fs.writeFile(args[args.length - 1]!, "x");
      if (calls >= 1) stopped = true;
      return { ok: true, errText: "" };
    };
    const res = await convertTracks(tracks, "mp3", {
      exec,
      shouldStop: () => stopped,
    });
    expect(calls).toBe(1);
    expect(res.stopped).toBe(true);
    expect(res.converted).toBe(1);
    // The untouched original is still there.
    expect(await fs.stat(tracks[1]!.filePath)).toBeTruthy();
  });
});
