import { describe, it, expect } from "vitest";
import path from "node:path";
import { outputTemplateInFolder, audioFormatArgs, cookieArgs, extraDownloadArgs } from "../src/ytdlp/args";
import type { Config } from "../src/config/config";

describe("outputTemplateInFolder", () => {
  it("places yt-dlp's filename inside the given folder without owner", () => {
    const p = outputTemplateInFolder(path.join("music"), "SoundCloud", "Liked Songs");
    expect(p).toBe(
      path.join(
        "music",
        "SoundCloud",
        "Liked Songs",
        "%(artist,uploader|Unknown Artist)s - %(track,title)s.%(ext)s",
      ),
    );
  });

  it("inserts the sanitized owner segment when provided", () => {
    const p = outputTemplateInFolder(path.join("music"), "YouTube", "Mix", "my/owner:name");
    expect(p).toBe(
      path.join(
        "music",
        "YouTube",
        "my_owner_name",
        "Mix",
        "%(artist,uploader|Unknown Artist)s - %(track,title)s.%(ext)s",
      ),
    );
  });

  it("sanitizes the folder name", () => {
    const p = outputTemplateInFolder(path.join("music"), "SoundCloud", "my/set:name");
    expect(p).toContain(path.join("music", "SoundCloud", "my_set_name"));
  });
});

describe("audioFormatArgs", () => {
  it("returns just -x for default/best format", () => {
    expect(audioFormatArgs()).toEqual(["-x"]);
    expect(audioFormatArgs({ audioFormat: "best" })).toEqual(["-x"]);
  });

  it("adds --audio-format for non-best formats", () => {
    expect(audioFormatArgs({ audioFormat: "mp3" })).toEqual(["-x", "--audio-format", "mp3"]);
    expect(audioFormatArgs({ audioFormat: "flac" })).toEqual(["-x", "--audio-format", "flac"]);
  });

  it("adds --audio-quality when not 0", () => {
    expect(audioFormatArgs({ audioFormat: "mp3", audioQuality: "5" })).toEqual([
      "-x", "--audio-format", "mp3", "--audio-quality", "5",
    ]);
  });

  it("adds -f format string when provided", () => {
    expect(audioFormatArgs({ formatString: "bestaudio[ext=m4a]" })).toEqual([
      "-x", "-f", "bestaudio[ext=m4a]",
    ]);
  });

  it("combines format string, audio format, and quality", () => {
    expect(audioFormatArgs({
      formatString: "bestaudio",
      audioFormat: "mp3",
      audioQuality: "3",
    })).toEqual([
      "-x", "-f", "bestaudio", "--audio-format", "mp3", "--audio-quality", "3",
    ]);
  });
});

describe("cookieArgs", () => {
  it("returns empty when no cookies configured", () => {
    expect(cookieArgs()).toEqual([]);
    expect(cookieArgs({})).toEqual([]);
  });

  it("uses --cookies when cookiesFile is set", () => {
    expect(cookieArgs({ cookiesFile: "~/cookies.txt" })).toEqual([
      "--cookies", "~/cookies.txt",
    ]);
  });

  it("uses --cookies-from-browser when cookiesFromBrowser is set", () => {
    expect(cookieArgs({ cookiesFromBrowser: "chrome:Default" })).toEqual([
      "--cookies-from-browser", "chrome:Default",
    ]);
  });

  it("cookiesFromBrowser takes precedence over cookiesFile", () => {
    expect(cookieArgs({
      cookiesFile: "~/cookies.txt",
      cookiesFromBrowser: "chrome:Default",
    })).toEqual([
      "--cookies-from-browser", "chrome:Default",
    ]);
  });
});

describe("extraDownloadArgs", () => {
  it("returns default pacing args", () => {
    const result = extraDownloadArgs();
    expect(result).toContain("--sleep-interval");
    expect(result).toContain("--max-sleep-interval");
    expect(result).toContain("--retries");
    expect(result).toContain("--retry-sleep");
  });

  it("uses config values when provided", () => {
    const result = extraDownloadArgs({
      sleepInterval: 5,
      maxSleepInterval: 15,
      retries: 10,
    });
    expect(result).toContain("5");
    expect(result).toContain("15");
    expect(result).toContain("10");
  });

  it("adds --embed-subs when configured", () => {
    const result = extraDownloadArgs({ embedSubs: true });
    expect(result).toContain("--embed-subs");
  });

  it("adds --embed-chapters when configured", () => {
    const result = extraDownloadArgs({ embedChapters: true });
    expect(result).toContain("--embed-chapters");
  });
});