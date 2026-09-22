import { describe, it, expect } from "vitest";
import { parseCliArgs, HELP_TEXT } from "../src/cli/args";

describe("parseCliArgs", () => {
  it("installs the Linux companion without opening the player", () => {
    expect(parseCliArgs(["--install-linux-visualizer"])).toEqual({ kind: "install-linux-visualizer" });
  });
  it("requires an explicit known pack for downloads or selection", () => {
    expect(parseCliArgs(["--install-preset-pack", "cream-of-the-crop"])).toEqual({ kind: "install-preset-pack" });
    expect(parseCliArgs(["--preset-pack", "classic"])).toEqual({ kind: "preset-pack", pack: "classic" });
    expect(parseCliArgs(["--preset-pack", "combined"])).toEqual({ kind: "preset-pack", pack: "combined" });
    for (const args of [["--install-preset-pack"], ["--install-preset-pack", "unknown"], ["--preset-pack", "../other"], ["--preset-pack", "classic", "extra"]]) {
      expect(parseCliArgs(args).kind).toBe("invalid");
    }
  });
  it("runs the dashboard with no args", () => {
    expect(parseCliArgs([])).toEqual({ kind: "run" });
  });

  it("recognizes version flags", () => {
    expect(parseCliArgs(["--version"])).toEqual({ kind: "version" });
    expect(parseCliArgs(["-v"])).toEqual({ kind: "version" });
  });

  it("recognizes help flags", () => {
    expect(parseCliArgs(["--help"])).toEqual({ kind: "help" });
    expect(parseCliArgs(["-h"])).toEqual({ kind: "help" });
  });

  it("treats a single positional as a link or handle to add", () => {
    expect(parseCliArgs(["https://soundcloud.com/somehandle"])).toEqual({
      kind: "run",
      initialAdd: "https://soundcloud.com/somehandle",
    });
    expect(parseCliArgs(["somehandle"])).toEqual({
      kind: "run",
      initialAdd: "somehandle",
    });
  });

  it("rejects unknown double-dash flags", () => {
    expect(parseCliArgs(["--unknown-flag"])).toEqual({ kind: "invalid", arg: "--unknown-flag" });
  });

  it("parses --format flag", () => {
    expect(parseCliArgs(["--format", "mp3"])).toEqual({
      kind: "run",
      initialAdd: undefined,
      overrides: { audioFormat: "mp3" },
    });
  });

  it("parses --format=flac inline", () => {
    expect(parseCliArgs(["--format=flac"])).toEqual({
      kind: "run",
      initialAdd: undefined,
      overrides: { audioFormat: "flac" },
    });
  });

  it("parses --cookies flag", () => {
    expect(parseCliArgs(["--cookies", "~/cookies.txt"])).toEqual({
      kind: "run",
      initialAdd: undefined,
      overrides: { cookiesFile: "~/cookies.txt" },
    });
  });

  it("parses --output-dir flag", () => {
    expect(parseCliArgs(["--output-dir", "~/Music/MyLibrary"])).toEqual({
      kind: "run",
      initialAdd: undefined,
      overrides: { libraryDir: "~/Music/MyLibrary" },
    });
  });

  it("parses --quality flag", () => {
    expect(parseCliArgs(["--quality", "5"])).toEqual({
      kind: "run",
      initialAdd: undefined,
      overrides: { audioQuality: "5" },
    });
  });

  it("parses --sleep and --max-sleep flags", () => {
    expect(parseCliArgs(["--sleep", "2", "--max-sleep", "10"])).toEqual({
      kind: "run",
      initialAdd: undefined,
      overrides: { sleepInterval: 2, maxSleepInterval: 10 },
    });
  });

  it("parses --output-template flag", () => {
    expect(parseCliArgs(["--output-template", "~/Music/%(title)s.%(ext)s"])).toEqual({
      kind: "run",
      initialAdd: undefined,
      overrides: { outputTemplate: "~/Music/%(title)s.%(ext)s" },
    });
  });

  it("combines flags with a link argument", () => {
    expect(parseCliArgs(["--format", "mp3", "https://youtube.com/watch?v=abc"])).toEqual({
      kind: "run",
      initialAdd: "https://youtube.com/watch?v=abc",
      overrides: { audioFormat: "mp3" },
    });
  });

  it("help text mentions the link pass-through", () => {
    expect(HELP_TEXT).toContain("jukeboxcli <link>");
    expect(HELP_TEXT).not.toContain("soundcli <link>");
  });

  it("help text mentions new flags", () => {
    expect(HELP_TEXT).toContain("--format");
    expect(HELP_TEXT).toContain("--cookies");
    expect(HELP_TEXT).toContain("--output-dir");
  });
});
