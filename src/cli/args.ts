// Tiny argv parser for the few things soundcli accepts beyond "just open the
// dashboard". Kept as a pure function so it's trivially testable.

import type { Config } from "../config/config";

export type CliCommand =
  | { kind: "install-linux-visualizer" }
  | { kind: "install-preset-pack" }
  | { kind: "preset-pack"; pack: "classic" | "cream-of-the-crop" | "combined" }
  | { kind: "doctor" }
  | { kind: "version" }
  | { kind: "help" }
  | { kind: "run"; initialAdd?: string; overrides?: Partial<Config> }
  | { kind: "invalid"; arg: string };

/** Parse a --flag=value or --flag value pair. Returns [flagName, value] or null. */
function tryParseFlag(
  args: string[],
  i: number,
): { name: string; value: string; nextIndex: number } | null {
  const arg = args[i]!;
  // --flag=value
  const eqMatch = arg.match(/^--([\w-]+)=(.*)$/);
  if (eqMatch) {
    return { name: eqMatch[1]!, value: eqMatch[2]!, nextIndex: i + 1 };
  }
  // --flag value (next arg is the value)
  const spaceMatch = arg.match(/^--([\w-]+)$/);
  if (spaceMatch && i + 1 < args.length) {
    return { name: spaceMatch[1]!, value: args[i + 1]!, nextIndex: i + 2 };
  }
  return null;
}

/** Map a CLI flag name to a Config field. */
function flagToConfig(name: string, value: string): Partial<Config> {
  switch (name) {
    case "format":
    case "audio-format":
      return { audioFormat: value };
    case "quality":
    case "audio-quality":
      return { audioQuality: value };
    case "yt-format":
      return { formatString: value };
    case "output-dir":
    case "output":
    case "o":
      return { libraryDir: value };
    case "cookies":
    case "cookies-file":
      return { cookiesFile: value };
    case "cookies-from-browser":
    case "browser-cookies":
      return { cookiesFromBrowser: value };
    case "output-template":
      return { outputTemplate: value };
    case "sleep":
    case "sleep-interval":
      return { sleepInterval: Number(value) };
    case "max-sleep":
    case "max-sleep-interval":
      return { maxSleepInterval: Number(value) };
    case "retries":
      return { retries: Number(value) };
    case "reencode":
      return { reencodeAudio: value === "true" || value === "1" };
    default:
      return {};
  }
}

export function parseCliArgs(argv: string[]): CliCommand {
  const args = argv.filter((a) => a.trim() !== "");
  if (args.length === 0) return { kind: "run" };
  if (args.length === 1 && args[0] === "--install-linux-visualizer") return { kind: "install-linux-visualizer" };

  if (args[0] === "--install-preset-pack") {
    return args.length === 2 && args[1] === "cream-of-the-crop"
      ? { kind: "install-preset-pack" } : { kind: "invalid", arg: "--install-preset-pack (expected cream-of-the-crop)" };
  }
  if (args[0] === "--preset-pack") {
    const pack = args[1];
    return args.length === 2 && (pack === "classic" || pack === "cream-of-the-crop" || pack === "combined")
      ? { kind: "preset-pack", pack } : { kind: "invalid", arg: "--preset-pack (expected classic, cream-of-the-crop or combined)" };
  }

  // Check for version/help first
  if (args.length === 1) {
    const a = args[0]!;
    if (a === "--doctor") return { kind: "doctor" };
    if (a === "--version" || a === "-v") return { kind: "version" };
    if (a === "--help" || a === "-h") return { kind: "help" };
  }

  // Walk args: collect flags and the first non-flag (link/handle)
  let initialAdd: string | undefined;
  const overrides: Partial<Config> = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i]!;

    if (arg === "--version" || arg === "-v") return { kind: "version" };
    if (arg === "--help" || arg === "-h") return { kind: "help" };

    // Try to parse as a flag
    if (arg.startsWith("--")) {
      const parsed = tryParseFlag(args, i);
      if (parsed) {
        Object.assign(overrides, flagToConfig(parsed.name, parsed.value));
        i = parsed.nextIndex;
        continue;
      }
      // Unknown flag with no value
      return { kind: "invalid", arg };
    }

    // Non-flag: treat as link/handle (only the first one)
    if (!initialAdd) {
      initialAdd = arg;
    }
    i++;
  }

  return {
    kind: "run",
    initialAdd,
    overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
  };
}

export const HELP_TEXT = `JukeboxCli — your music, your queue

usage
  jukeboxcli                open the player and library
  jukeboxcli <link>         download that song on launch
  jukeboxcli --version      print the version
  jukeboxcli --doctor       read-only installation/tool diagnostics
  jukeboxcli --install-linux-visualizer
                           build the Linux fullscreen companion without the logo intro
  jukeboxcli --install-preset-pack cream-of-the-crop
                           download Linux presets + textures (~14 MB), then select
  jukeboxcli --preset-pack classic|cream-of-the-crop|combined
                           select installed Linux presets for the next F launch

player keys
  m / 6                    Now Playing
  7                        listening queue
  A / P                    append / play next (selected library song)
  u / D / x                move up / down / remove (queue)
  X                        clear queue and stop (confirm)
  ?                        all keys

download options (this launch only; do not change saved settings)
  --format <fmt>            audio format: best, mp3, flac, wav, m4a, opus, vorbis
  --quality <0-10>          audio quality (0=best, 10=worst)
  --yt-format <str>         yt-dlp format string (e.g. "bestaudio[ext=m4a]")
  --output-dir <path>       where to save downloads
  --output-template <tpl>   yt-dlp -o template (overrides folder structure)
  --cookies <path>          cookies.txt file (Netscape format)
  --cookies-from-browser <id>  read cookies from browser (e.g. "chrome:Default")
  --sleep <sec>             min seconds between downloads
  --max-sleep <sec>         max seconds between downloads
  --retries <n>             number of retries on failure
  --reencode <true|false>   force re-encode even if format matches

examples
  jukeboxcli "https://youtube.com/watch?v=..."
  jukeboxcli --format mp3 --cookies ~/cookies.txt "https://..."
  jukeboxcli --output-dir ~/Music/MyLibrary @somehandle

Change preferences in Settings to save them for future launches.
tip: quote links that contain & (e.g. "https://...?list=...")
`;
