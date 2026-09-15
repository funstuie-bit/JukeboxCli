import { useEffect, useRef, useState, type ReactNode } from "react";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Box, Text, useInput } from "ink";
import { Select, Spinner } from "@inkjs/ui";
import { useQueueItems, useStore } from "../store";
import { TextField } from "../components/TextField";
import { SelectField, TextInputField } from "../components/FormHelpers";
import { Header } from "../components/Header";
import { openPath } from "../../util/open-path";
import { wrapStep } from "../move";
import {
  displayPath,
  expandTilde,
  formatBytes,
  truncate,
} from "../../util/format";
import { persistableHandle } from "../../sources/persist-handle";
import {
  moveLibraryDir,
  retargetTracks,
  samePath,
  validateMoveRoots,
  type MoveProgress,
} from "../../library/move-library";
import { defaultLibraryDir } from "../../config/paths";
import { COLOR, ICON, nextPlayerTheme, playerThemeLabel } from "../theme";
import { nextSpectrumMode, spectrumModeLabel } from "../../player/spectrum";
import {
  detectBrowserProfiles,
  browserCookieArg,
  type BrowserProfile,
} from "../../config/cookies";
import {
  findYtDlpConfig,
  importFromYtDlpConfig,
  type ImportResult,
} from "../../config/import";
import {
  convertTracks,
  needsConversion,
  type ConvertFormat,
  type ConvertProgress,
  type ConvertResult,
} from "../../library/convert";
import { detectSystemYtDlp, ytDlpPath } from "../../bin/ytdlp-fetch";
import { ytDlpProvider } from "../../bin/ytdlp-policy";
import { updateYtDlpNow } from "../../bin/ytdlp-update";
import { launchFullscreenVisualizer } from "../../player/fullscreen-visualizer";

type Mode =
  | "appearance"
  | "menu"
  | "youtube"
  | "soundcloud"
  | "spotify"
  | "folder"
  | "folder-confirm"
  | "moving"
  | "wipe-all"
  | "format"
  | "cookies"
  | "pacing"
  | "ytdlp"
  | "import"
  | "convert"
  | "convert-run";

/** Key hints pinned under the page content (Download's FooterHint idiom). */
function HintLine({ children }: { children: string }) {
  return (
    <Box marginTop={1}>
      <Text dimColor wrap="truncate-end">
        {children}
      </Text>
    </Box>
  );
}

export function Settings() {
  const { config, setConfig, library, queue, playback, binaries, region, setCaptureMode, listRows } =
    useStore();
  const focused = region === "content";
  const [mode, setMode] = useState<Mode>("menu");
  const [cursor, setCursor] = useState(0);
  const [folderDraft, setFolderDraft] = useState("");
  const [folderError, setFolderError] = useState<string | null>(null);
  const [moveProgress, setMoveProgress] = useState<MoveProgress | null>(null);
  const [moveNote, setMoveNote] = useState<string | null>(null);
  // Download-settings sub-pages: cookies + import do async detection.
  const [browserProfiles, setBrowserProfiles] = useState<BrowserProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [cookiesError, setCookiesError] = useState<string | null>(null);
  const [ytdlpStatus, setYtdlpStatus] = useState("");
  const [ytdlpBusy, setYtdlpBusy] = useState(false);
  const [fullscreenStatus, setFullscreenStatus] = useState("");
  const currentConfig = useRef(config);
  currentConfig.current = config;
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importConfigPath, setImportConfigPath] = useState<string | null>(null);
  // Pacing sub-page: cursor to track which of the 3 text fields is active.
  const [pacingCursor, setPacingCursor] = useState(0);
  // Convert-library sub-pages: chosen format, live progress, stop request,
  // and the finished result (kept so the run page can render the summary).
  const [convertFormat, setConvertFormat] = useState<ConvertFormat | null>(
    null,
  );
  const [convertProgress, setConvertProgress] =
    useState<ConvertProgress | null>(null);
  const [convertResult, setConvertResult] = useState<ConvertResult | null>(
    null,
  );
  const [convertRunning, setConvertRunning] = useState(false);
  // Ref mirror of the stop request: the run's shouldStop closure must see the
  // latest value without re-launching the run on every state change.
  const convertStopRef = useRef(false);
  // Keeps the confirm page's downloads-running gate live while it's open.
  useQueueItems(queue);

  const entries: {
    value: Mode | "open-folder";
    name: string;
    detail: string;
    set?: boolean;
    danger?: boolean;
    /** Blank line above: opens a new visual cluster (handles / folder / danger). */
    gap?: boolean;
  }[] = [
    {
      value: "youtube",
      name: "YouTube handle",
      detail: config.youtubeHandle ? `@${config.youtubeHandle}` : "not set",
      set: Boolean(config.youtubeHandle),
    },
    {
      value: "soundcloud",
      name: "SoundCloud handle",
      detail: config.soundcloudHandle
        ? `@${config.soundcloudHandle}`
        : "not set",
      set: Boolean(config.soundcloudHandle),
    },
    {
      value: "spotify",
      name: "Spotify handle",
      detail: config.spotifyHandle
        ? `@${config.spotifyHandle}`
        : "not set",
      set: Boolean(config.spotifyHandle),
    },
    {
      value: "format",
      name: "Audio format",
      detail:
        config.audioFormat && config.audioFormat !== "best"
          ? config.audioFormat
          : "Best",
      set:
        Boolean(config.audioFormat) && config.audioFormat !== "best",
      gap: true,
    },
    {
      value: "cookies",
      name: "Cookies",
      detail: config.cookiesFromBrowser
        ? `Browser: ${config.cookiesFromBrowser}`
        : config.cookiesFile
          ? `File: ${truncate(config.cookiesFile, 30)}`
          : "not set",
      set: Boolean(config.cookiesFromBrowser || config.cookiesFile),
    },
    {
      value: "pacing",
      name: "Download pacing",
      detail: `${config.sleepInterval ?? 1}s sleep, ${config.retries ?? 5} retries`,
      set:
        (config.sleepInterval ?? 1) !== 1 || (config.retries ?? 5) !== 5,
    },
    {
      value: "ytdlp",
      name: "yt-dlp updates",
      detail: ytDlpProvider(config.ytdlpProvider) === "system" ? "System · choose provider" : `App-managed ${config.ytdlpChannel ?? "nightly"}`,
      set: ytDlpProvider(config.ytdlpProvider) === "managed",
    },
    {
      value: "import",
      name: "Import config",
      detail: "Import from yt-dlp config",
    },
    {
      value: "convert",
      name: "Convert library",
      detail: `Re-encode downloads to ${
        config.audioFormat && config.audioFormat !== "best"
          ? config.audioFormat
          : "a format"
      }`,
    },
    {
      value: "open-folder",
      name: "Music folder",
      detail: displayPath(config.libraryDir),
      gap: true,
    },
    {
      value: "folder",
      name: "Move music folder",
      detail: "Change where songs live",
    },
    {
      value: "wipe-all",
      name: "Wipe all",
      detail: "Delete every download",
      danger: true,
    },
    { value: "appearance", name: "Player appearance", detail: `${playerThemeLabel(config.playerTheme)} · visualizer ${config.visualizerMode ?? "classic"}` },
  ];

  function openSetting(v: Mode | "open-folder"): void {
    if (v === "open-folder") {
      // The folder may not exist yet (fresh install, edited path): create it
      // first so the file manager always lands somewhere real.
      void fs
        .mkdir(config.libraryDir, { recursive: true })
        .catch(() => {})
        .then(() => openPath(config.libraryDir));
      return;
    }
    if (v === "folder") setFolderError(null);
    if (v === "cookies") {
      setCookiesError(null);
      setProfilesLoading(true);
      void detectBrowserProfiles()
        .then((profiles) => {
          setBrowserProfiles(profiles);
          setProfilesLoading(false);
        })
        .catch(() => {
          setBrowserProfiles([]);
          setProfilesLoading(false);
        });
    }
    if (v === "import") {
      setImportResult(null);
      setImportLoading(true);
      void findYtDlpConfig()
        .then((found) => {
          setImportConfigPath(found);
          if (!found) {
            setImportLoading(false);
            return;
          }
          return importFromYtDlpConfig(found).then((result) => {
            setImportResult(result);
            setImportLoading(false);
          });
        })
        .catch(() => setImportLoading(false));
    }
    setMode(v);
  }

  // Menu navigation (the sub-pages own the keyboard via their own handlers).
  useInput(
    (_input, key) => {
      if (key.upArrow) setCursor((c) => wrapStep(c, -1, entries.length));
      else if (key.end) setCursor(entries.length - 1);
      else if (key.home) setCursor(0);
      else if (key.downArrow)
        setCursor((c) => wrapStep(c, 1, entries.length));
      else if (key.return) openSetting(entries[cursor]!.value);
    },
    { isActive: focused && mode === "menu" },
  );

  // Any sub-page (not the menu) owns esc while open, so esc backs up exactly
  // one level instead of jumping to the sidebar. Text sub-pages take the whole
  // keyboard; the wipe page only claims space + esc, so a stray space
  // can't toggle the player mid-confirmation. The moving page also claims the
  // whole keyboard ("text"): quitting or firing a download mid-move would
  // race the file shuffle, so only ctrl-c gets through.
  const inSubPage = focused && mode !== "menu";
  const isTextPage =
    mode === "youtube" ||
    mode === "soundcloud" ||
    mode === "spotify" ||
    mode === "folder" ||
    mode === "moving" ||
    mode === "pacing";
  useEffect(() => {
    setCaptureMode(!inSubPage ? "none" : isTextPage ? "text" : "picker");
    return () => setCaptureMode("none");
  }, [inSubPage, isTextPage, setCaptureMode]);

  useInput(
    (_input, key) => {
      if (key.escape) setMode("menu");
    },
    // While a conversion runs, esc belongs to the run page (stop), not to
    // navigating away from the summary that is about to appear.
    { isActive: inSubPage && mode !== "moving" && !(mode === "convert-run" && convertRunning) },
  );

  // Hooks must run on every render, including the menu and other sub-pages.
  useInput(
    (_input, key) => {
      if (key.upArrow) setPacingCursor((c) => wrapStep(c, -1, 3));
      else if (key.downArrow) setPacingCursor((c) => wrapStep(c, 1, 3));
    },
    { isActive: focused && mode === "pacing" },
  );
  useInput(
    (_input, key) => {
      if (key.escape && convertRunning) convertStopRef.current = true;
    },
    { isActive: focused && mode === "convert-run" },
  );

  // Every settings sub-page is rendered through frame(), so the hint line
  // lives here once and matches Download's in-section footer language. esc
  // always goes back one level.
  function frame(title: string, node: ReactNode, hint = "esc Back") {
    return (
      <Box flexDirection="column">
        <Header title={title} focused={focused} />
        <Box>{node}</Box>
        <HintLine>{hint}</HintLine>
      </Box>
    );
  }

  function handleField(
    title: string,
    value: string | undefined,
    placeholder: string,
    save: (v: string | undefined) => void,
  ) {
    return frame(
      title,
      <Box flexDirection="column">
        <Box>
          <Text color={COLOR.accent}>{`${ICON.pointer} `}</Text>
          <TextField
            isDisabled={!focused}
            defaultValue={value ?? ""}
            placeholder={placeholder}
            onSubmit={(v) => {
              save(v.trim() || undefined);
              setMode("menu");
            }}
          />
        </Box>
      </Box>,
      `↵ Save  ${ICON.dot}  esc Back`,
    );
  }

  function saveHandleField(
    source: "youtube" | "soundcloud" | "spotify",
    key: "youtubeHandle" | "soundcloudHandle" | "spotifyHandle",
    title: string,
    value: string | undefined,
  ) {
    return handleField(title, value, "@username", (v) => {
      const raw = v ?? "";
      const handle = persistableHandle(source, raw);
      if (handle !== undefined || !raw.trim()) {
        setConfig({ ...config, [key]: handle });
      }
    });
  }

  function submitFolder(raw: string): void {
    // Windows Explorer's "Copy as path" wraps the path in quotes; accept it.
    let typed = raw.trim().replace(/^"(.+)"$/, "$1").trim();
    if (!typed) {
      setMode("menu");
      return;
    }
    // A bare drive letter resolves to that drive's current directory, not
    // its root; someone typing "D:" means the root.
    if (/^[A-Za-z]:$/.test(typed)) typed += path.sep;
    const current = path.resolve(config.libraryDir);
    const next = path.resolve(expandTilde(typed));
    if (samePath(current, next)) {
      setMode("menu"); // typed the current folder back: nothing to do
      return;
    }
    const invalid = validateMoveRoots(current, next);
    if (invalid) {
      setFolderError(invalid);
      return;
    }
    // Creating the folder up front proves the path is real and writable
    // before the confirm page promises a move.
    void fs
      .mkdir(next, { recursive: true })
      .then(() => {
        setFolderDraft(next);
        setFolderError(null);
        setMode("folder-confirm");
      })
      .catch(() => setFolderError("Can't create that folder"));
  }

  function runMove(): void {
    const oldRoot = path.resolve(config.libraryDir);
    const newRoot = folderDraft;
    setMoveNote(null);
    setMoveProgress(null);
    setMode("moving");
    void (async () => {
      // Stop playback first: on Windows a folder rename fails while mpv
      // holds a file inside it open.
      await playback.stop();
      // Point config at the new root BEFORE moving files: if the app dies
      // mid-move, the next scan walks the new folder and relinks everything
      // that already moved (by basename, then size), while unmoved tracks
      // keep their still-valid old paths. Config-last would instead prune
      // every moved track on a hard interrupt.
      setConfig({ ...config, libraryDir: newRoot });
      let note: string | null = null;
      try {
        let lastTick = 0;
        const result = await moveLibraryDir(oldRoot, newRoot, {
          onProgress: (p) => {
            // Big libraries tick per file; ~10 updates a second is plenty.
            const now = Date.now();
            if (now - lastTick < 100 && p.movedFiles < p.totalFiles) return;
            lastTick = now;
            setMoveProgress(p);
          },
        });
        if (result.failures.length) {
          note = `Moved ${result.movedFiles} of ${result.totalFiles} files. The rest stayed in the old folder.`;
        }
      } catch {
        note = "Move interrupted. The library heals itself on the next scan.";
      }
      try {
        const changed = await retargetTracks(library.all(), oldRoot, newRoot);
        if (changed.length) await library.upsertMany(changed);
        library.flushSync();
      } catch {
        note ??= "Move interrupted. The library heals itself on the next scan.";
      }
      setMoveNote(note);
      setMoveProgress(null);
      setMode("menu");
    })();
  }

  if (mode === "appearance") {
    return frame("Player appearance", <SelectField title="Colours, fallback motion and live visualizer style."
      focused={focused} options={[
        { label: `Theme: ${playerThemeLabel(config.playerTheme)} (cycle)`, value: "theme" },
        { label: `Reduced motion: ${config.reducedMotion === false ? "off" : "on"} (toggle)`, value: "motion" },
        { label: `Visualizer: ${spectrumModeLabel(config.visualizerMode ?? "classic")} (cycle)`, value: "visualizer" },
        ...(process.platform === "linux" ? [{ label: fullscreenStatus || "Fullscreen effects: open projectM", value: "fullscreen" }] : []),
      ]} onSelect={value => {
        if (value === "fullscreen") {
          setFullscreenStatus("Opening fullscreen effects…");
          void launchFullscreenVisualizer().then(result => setFullscreenStatus(result.message));
          return;
        }
        setConfig(value === "theme"
          ? { ...config, playerTheme: nextPlayerTheme(config.playerTheme) }
          : value === "visualizer"
            ? { ...config, visualizerMode: nextSpectrumMode(config.visualizerMode) }
            : { ...config, reducedMotion: !(config.reducedMotion ?? true) });
      }} onCancel={() => setMode("menu")} />);
  }

  if (mode === "ytdlp") {
    const selected = ytDlpProvider(config.ytdlpProvider);
    return frame("yt-dlp updates", <Box flexDirection="column">
      <Text wrap="truncate-end">Active this launch: {binaries.ytDlp === ytDlpPath() ? "app-managed" : "system"} · {displayPath(binaries.ytDlp)}</Text>
      <Text>Next launch: {selected === "system" ? "system / package manager" : `app-managed ${config.ytdlpChannel ?? "nightly"}`}</Text>
      <SelectField
      title="Choose yt-dlp only. App copies stay separate from system tools. Restart to apply."
      focused={focused && !ytdlpBusy}
      options={[
        { label: `App-managed nightly${selected === "managed" && (config.ytdlpChannel ?? "nightly") === "nightly" ? " · selected" : ""} (download/update)`, value: "nightly" },
        { label: `App-managed stable${selected === "managed" && config.ytdlpChannel === "stable" ? " · selected" : ""} (download/update)`, value: "stable" },
        { label: `System / package manager${selected === "system" ? " · selected" : ""}`, value: "system" },
      ]}
      onSelect={value => {
        if (ytdlpBusy) return;
        const channel = value === "stable" ? "stable" : "nightly";
        setYtdlpBusy(true);
        setYtdlpStatus(value === "system" ? "Checking system yt-dlp…" : `Updating ${channel}…`);
        void (async () => {
          if (value === "system") {
            if (!await detectSystemYtDlp()) throw Error("System yt-dlp not found. Install it with your package manager first.");
            setConfig({ ...currentConfig.current, ytdlpProvider: "system" });
            setYtdlpStatus("System yt-dlp selected. Restart JukeboxCli to apply; cached copies are kept.");
          } else {
            const version = await updateYtDlpNow(channel);
            setConfig({ ...currentConfig.current, ytdlpProvider: "managed", ytdlpChannel: channel });
            setYtdlpStatus(`${channel} ${version} ready. Restart JukeboxCli to apply. System tools unchanged.`);
          }
        })().catch(error => setYtdlpStatus(error instanceof Error ? error.message : "yt-dlp update failed"))
          .finally(() => setYtdlpBusy(false));
      }} onCancel={() => setMode("menu")} />
      {ytdlpStatus ? <Text color={ytdlpStatus.includes("failed") || ytdlpStatus.startsWith("Could not") ? COLOR.bad : COLOR.alt}>{ytdlpStatus}</Text> : null}
    </Box>);
  }

  if (mode === "youtube") {
    return saveHandleField(
      "youtube",
      "youtubeHandle",
      "Your YouTube handle",
      config.youtubeHandle,
    );
  }

  if (mode === "soundcloud") {
    return saveHandleField(
      "soundcloud",
      "soundcloudHandle",
      "Your SoundCloud handle",
      config.soundcloudHandle,
    );
  }

  if (mode === "spotify") {
    return saveHandleField(
      "spotify",
      "spotifyHandle",
      "Your Spotify handle",
      config.spotifyHandle,
    );
  }

  if (mode === "folder") {
    return frame(
      "Move music folder",
      <Box flexDirection="column">
        <Box>
          <Text color={COLOR.accent}>{`${ICON.pointer} `}</Text>
          <TextField
            isDisabled={!focused}
            defaultValue={displayPath(config.libraryDir)}
            placeholder={displayPath(defaultLibraryDir)}
            onSubmit={submitFolder}
          />
        </Box>
        {folderError && (
          <Box marginTop={1}>
            <Text color={COLOR.bad}>{folderError}</Text>
          </Box>
        )}
      </Box>,
      `↵ Continue  ${ICON.dot}  esc Back`,
    );
  }

  if (mode === "folder-confirm") {
    const busy = queue.activeCount > 0;
    const tracks = library.all();
    const size = formatBytes(
      tracks.reduce((n, t) => n + (t.fileSize ?? 0), 0),
    );
    return frame(
      "Move your music?",
      <Box flexDirection="column">
        {busy ? (
          <Text color={COLOR.bad}>
            Downloads are running. Wait for them to finish first.
          </Text>
        ) : (
          <>
            <Box marginBottom={1} flexDirection="column">
              <Text dimColor>
                {`${ICON.dot} ${tracks.length} song${
                  tracks.length === 1 ? "" : "s"
                }${size ? ` · ${size}` : ""}`}
              </Text>
              <Text dimColor>{`${ICON.dot} From ${displayPath(
                config.libraryDir,
              )}`}</Text>
              <Text dimColor>{`${ICON.dot} To ${displayPath(folderDraft)}`}</Text>
            </Box>
            <Select
              isDisabled={!focused}
              options={[
                { label: "‹ Cancel", value: "cancel" },
                { label: "Move everything", value: "confirm" },
              ]}
              onChange={(v) => {
                // A download may have started while the page sat open.
                if (v !== "confirm" || queue.activeCount > 0) {
                  setMode("menu");
                  return;
                }
                runMove();
              }}
            />
          </>
        )}
      </Box>,
      busy
        ? "esc Back"
        : `↑↓ Move  ${ICON.dot}  ↵ Choose  ${ICON.dot}  esc Back`,
    );
  }

  if (mode === "moving") {
    // Not frame(): its "esc Back" hint would lie, there is no backing out
    // of a move already writing files.
    return (
      <Box flexDirection="column">
        <Header title="Moving music folder" focused={focused} />
        <Box>
          <Spinner
            label={
              moveProgress && moveProgress.totalFiles > 0
                ? `Moving ${moveProgress.movedFiles}/${moveProgress.totalFiles} files…`
                : "Preparing move…"
            }
          />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Keep the app open until this finishes.</Text>
        </Box>
      </Box>
    );
  }

  if (mode === "wipe-all") {
    return frame(
      "Wipe all songs?",
      <Box flexDirection="column">
        <Box marginBottom={1} flexDirection="column">
          <Text dimColor>{`${ICON.dot} Delete every downloaded file`}</Text>
          <Text dimColor>{`${ICON.dot} Clear the library`}</Text>
          <Text dimColor>{`${ICON.dot} Empty the download queue`}</Text>
          <Text dimColor>{`${ICON.dot} Keep your handles & folder`}</Text>
        </Box>
        <Select
          isDisabled={!focused}
          options={[
            { label: "‹ Cancel", value: "cancel" },
            { label: "Yes, wipe everything", value: "confirm" },
          ]}
          onChange={(v) => {
            if (v !== "confirm") {
              setMode("menu");
              return;
            }
            void (async () => {
              // Stop downloads first so nothing is mid-write while we delete.
              queue.clearAll();
              const tracked = library.all().map((t) => t.filePath);
              await library.clear();
              // Remove the folders soundcli creates (catches completed files,
              // .part partials, orphans, and empty dirs), plus any tracked files
              // that live outside the current music folder (e.g. an old folder).
              const targets = [
                ...["YouTube", "SoundCloud", "Spotify", "Links"].map((s) =>
                  path.join(config.libraryDir, s),
                ),
                ...tracked,
              ];
              await Promise.all(
                targets.map((p) =>
                  fs.rm(p, { recursive: true, force: true }).catch(() => {}),
                ),
              );
              setMode("menu");
            })();
          }}
        />
      </Box>,
      `↑↓ Move  ${ICON.dot}  ↵ Choose  ${ICON.dot}  esc Back`,
    );
  }

  // ─── Audio format ──────────────────────────────────────────────────
  if (mode === "format") {
    const formatOptions = [
      { label: "Best (no conversion)", value: "best" },
      { label: "MP3", value: "mp3" },
      { label: "FLAC", value: "flac" },
      { label: "WAV", value: "wav" },
      { label: "M4A", value: "m4a" },
      { label: "Opus", value: "opus" },
      { label: "Vorbis", value: "vorbis" },
    ];
    return frame(
      "Audio format",
      <SelectField
        title=""
        options={formatOptions}
        focused={focused}
        onSelect={(v) => {
          setConfig({ ...config, audioFormat: v });
          setMode("menu");
        }}
        onCancel={() => setMode("menu")}
      />,
    );
  }

  // ─── Cookies ───────────────────────────────────────────────────────
  if (mode === "cookies") {
    // Build the options for the cookies sub-page.
    const cookieOptions: { label: string; value: string }[] = [];

    // Browser profiles (if detected)
    if (browserProfiles.length > 0) {
      for (const p of browserProfiles) {
        cookieOptions.push({
          label: p.label,
          value: `browser:${browserCookieArg(p)}`,
        });
      }
    }

    // Manual cookies file option
    cookieOptions.push({
      label: "Choose cookies file…",
      value: "file",
    });

    // Clear option (only if something is set)
    if (config.cookiesFromBrowser || config.cookiesFile) {
      cookieOptions.push({
        label: "Clear cookies",
        value: "clear",
      });
    }

    // No browser profiles detected: show a message and file path entry inline
    if (!profilesLoading && browserProfiles.length === 0) {
      return frame(
        "Cookies",
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text dimColor>
              {`${ICON.dot} No browser profiles detected.`}
            </Text>
          </Box>
          {config.cookiesFromBrowser || config.cookiesFile ? (
            <Box marginBottom={1}>
              <Text color={COLOR.alt}>
                {config.cookiesFromBrowser
                  ? `Browser: ${config.cookiesFromBrowser}`
                  : `File: ${truncate(config.cookiesFile ?? "", 40)}`}
              </Text>
            </Box>
          ) : null}
          <TextInputField
            title="Cookies file path"
            hint="Paste a path to a Netscape cookies.txt file"
            placeholder="~/cookies.txt"
            defaultValue={config.cookiesFile ?? ""}
            focused={focused}
            onSubmit={(v) => {
              setConfig({
                ...config,
                cookiesFile: v || undefined,
                cookiesFromBrowser: undefined,
              });
              setMode("menu");
            }}
            onCancel={() => setMode("menu")}
          />
          {cookiesError && (
            <Box marginTop={1}>
              <Text color={COLOR.bad}>{cookiesError}</Text>
            </Box>
          )}
        </Box>,
      );
    }

    // Browser profiles detected: show as a SelectField
    if (profilesLoading) {
      return frame(
        "Cookies",
        <Box>
          <Spinner label="Detecting browser profiles…" />
        </Box>,
      );
    }

    return frame(
      "Cookies",
      <Box flexDirection="column">
        {config.cookiesFromBrowser || config.cookiesFile ? (
          <Box marginBottom={1}>
            <Text color={COLOR.alt}>
              {config.cookiesFromBrowser
                ? `Current: Browser (${config.cookiesFromBrowser})`
                : `Current: File (${truncate(config.cookiesFile ?? "", 40)})`}
            </Text>
          </Box>
        ) : null}
        <SelectField
          title=""
          options={cookieOptions}
          focused={focused}
          onSelect={(v) => {
            if (v === "file") {
              // Switch to the file-entry mode by re-rendering with no profiles
              setBrowserProfiles([]);
              return;
            }
            if (v === "clear") {
              setConfig({
                ...config,
                cookiesFile: undefined,
                cookiesFromBrowser: undefined,
              });
              setMode("menu");
              return;
            }
            if (v.startsWith("browser:")) {
              const browserArg = v.slice("browser:".length);
              setConfig({
                ...config,
                cookiesFromBrowser: browserArg,
                cookiesFile: undefined,
              });
              setMode("menu");
              return;
            }
            setMode("menu");
          }}
          onCancel={() => setMode("menu")}
        />
      </Box>,
    );
  }

  // ─── Download pacing ───────────────────────────────────────────────
  if (mode === "pacing") {
    // Three text fields in sequence: sleep, max-sleep, retries.
    // pacingCursor (declared at top level for hooks safety) tracks which
    // field is active. ↑/↓ cycles, ↵ saves the active field.
    const pacingFields = [
      {
        key: "sleepInterval" as const,
        title: "Sleep interval (seconds)",
        placeholder: "1",
        value: String(config.sleepInterval ?? 1),
      },
      {
        key: "maxSleepInterval" as const,
        title: "Max sleep interval (seconds)",
        placeholder: "3",
        value: String(config.maxSleepInterval ?? 3),
      },
      {
        key: "retries" as const,
        title: "Retries on failure",
        placeholder: "5",
        value: String(config.retries ?? 5),
      },
    ];

    return frame(
      "Download pacing",
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text dimColor>
            {`${ICON.dot} ↑↓ to switch fields ${ICON.dot} ↵ to save`}
          </Text>
        </Box>
        {pacingFields.map((f, i) => {
          const isActive = i === pacingCursor;
          return (
            <Box key={f.key} marginTop={i > 0 ? 1 : 0}>
              <Box flexDirection="column">
                <Text
                  color={isActive ? COLOR.accent : undefined}
                  bold={isActive}
                >
                  {isActive ? `${ICON.pointer} ` : "  "}
                  {f.title}
                </Text>
                {isActive ? (
                  <Box>
                    <Text color={COLOR.accent}>{`${ICON.pointer} `}</Text>
                    <TextField
                      isDisabled={!focused}
                      defaultValue={f.value}
                      placeholder={f.placeholder}
                      onSubmit={(v) => {
                        const num = parseInt(v.trim(), 10);
                        if (!isNaN(num) && num >= 0) {
                          setConfig({
                            ...config,
                            [f.key]: num,
                          });
                        }
                        setMode("menu");
                      }}
                    />
                  </Box>
                ) : (
                  <Text dimColor>{`   ${f.value}`}</Text>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>,
      `↵ Save  ${ICON.dot}  esc Back  ${ICON.dot}  ↑↓ Switch field`,
    );
  }

  // ─── Convert library ───────────────────────────────────────────────
  if (mode === "convert") {
    // Only formats the converter can actually produce; "best" means "leave
    // each file in whatever it arrived as", which is nothing to convert to.
    const convertFormats: Array<{ label: string; value: ConvertFormat }> = [
      { label: "MP3", value: "mp3" },
      { label: "FLAC", value: "flac" },
      { label: "WAV", value: "wav" },
      { label: "M4A", value: "m4a" },
      { label: "Opus", value: "opus" },
    ];
    const counts = new Map<ConvertFormat, number>();
    for (const t of library.all()) {
      for (const f of convertFormats) {
        if (needsConversion(t, f.value)) {
          counts.set(f.value, (counts.get(f.value) ?? 0) + 1);
        }
      }
    }
    const current = config.audioFormat;
    return frame(
      "Convert library",
      <SelectField
        title={
          current && current !== "best"
            ? `Re-encode every download into one format  ${ICON.dot}  current: ${current}`
            : "Re-encode every download into one format"
        }
        options={convertFormats.map((f) => ({
          label:
            counts.get(f.value) !== undefined
              ? `${f.label} (${counts.get(f.value)} to convert)`
              : f.label,
          value: f.value,
        }))}
        focused={focused}
        onSelect={(v) => {
          const fmt = v as ConvertFormat;
          setConvertFormat(fmt);
          setConvertResult(null);
          setConvertProgress(null);
          convertStopRef.current = false;
          setConvertRunning(true);
          setMode("convert-run");
          void convertTracks(library.all(), fmt, {
            onProgress: (p) => setConvertProgress({ ...p }),
            onConverted: (t, newPath) =>
              library.upsert({ ...t, filePath: newPath }),
            shouldStop: () => convertStopRef.current,
          }).then((res) => {
            setConvertResult(res);
            setConvertRunning(false);
          });
        }}
        onCancel={() => setMode("menu")}
      />,
      `↑↓ Move  ${ICON.dot}  ↵ Convert to format  ${ICON.dot}  esc Back`,
    );
  }

  // ─── Convert library: run page ─────────────────────────────────────
  if (mode === "convert-run") {
    const fmt = convertFormat ?? "mp3";
    const progress = convertProgress;
    return frame(
      "Converting library",
      <Box flexDirection="column">
        {convertRunning || progress ? (
          <Box marginBottom={1}>
            <Text color={COLOR.alt}>
              {progress
                ? `${progress.converted} done${
                    progress.failed > 0
                      ? `, ${progress.failed} failed`
                      : ""
                  } of ${progress.total}`
                : "Counting songs…"}
            </Text>
          </Box>
        ) : null}
        {convertResult ? (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text color={COLOR.good}>
                {convertResult.stopped
                  ? `Stopped after ${convertResult.converted} songs.`
                  : `Converted ${convertResult.converted} songs to ${fmt}.`}
              </Text>
            </Box>
            {convertResult.failed.length > 0 ? (
              <Box marginBottom={1}>
                <Text color={COLOR.bad}>
                  {`${ICON.warn} ${convertResult.failed.length} failed  ${ICON.dot}  details in the downloads log`}
                </Text>
              </Box>
            ) : null}
            {convertResult.missingEncoder ? (
              <Box marginBottom={1}>
                <Text color={COLOR.bad}>
                  {`${ICON.warn} ffmpeg can't encode ${fmt}  ${ICON.dot}  nothing else was touched`}
                </Text>
              </Box>
            ) : null}
          </Box>
        ) : null}
        {convertRunning ? (
          <Box>
            <Text dimColor>{`esc Stop  ${ICON.dot}  already-converted songs are skipped`}</Text>
          </Box>
        ) : (
          <Box>
            <Text dimColor>esc Back</Text>
          </Box>
        )}
      </Box>,
      convertRunning
        ? `esc Stop (first press stops after the current song)`
        : "esc Back",
    );
  }

  // ─── Import config ─────────────────────────────────────────────────
  if (mode === "import") {
    if (importLoading) {
      return frame(
        "Import config",
        <Box>
          <Spinner label="Detecting yt-dlp config…" />
        </Box>,
      );
    }

    if (!importConfigPath && !importResult) {
      return frame(
        "Import config",
        <Box flexDirection="column">
          <Text dimColor>
            {`${ICON.dot} No yt-dlp config file found.`}
          </Text>
          <Box marginTop={1}>
            <Text dimColor>
              {`${ICON.dot} Checked: ~/yt-dlp.conf, ~/.config/yt-dlp/yt-dlp.conf,`}
            </Text>
          </Box>
          <Box>
            <Text dimColor>
              {`${ICON.dot} ~/Library/Application Support/yt-dlp/yt-dlp.conf`}
            </Text>
          </Box>
        </Box>,
      );
    }

    const result = importResult;
    const importedKeys = result
      ? Object.keys(result.imported)
      : [];
    const hasUnmapped = result && result.unmapped.length > 0;

    return frame(
      "Import config",
      <Box flexDirection="column">
        {importConfigPath && (
          <Box marginBottom={1}>
            <Text dimColor>
              {`${ICON.dot} Found: ${truncate(importConfigPath, 50)}`}
            </Text>
          </Box>
        )}
        {result && importedKeys.length > 0 && (
          <Box marginBottom={1} flexDirection="column">
            <Text color={COLOR.good}>
              {`${ICON.done} ${importedKeys.length} setting${importedKeys.length === 1 ? "" : "s"} detected:`}
            </Text>
            {importedKeys.map((k) => (
              <Text key={k} dimColor>
                {`  ${k}: ${String((result.imported as any)[k])}`}
              </Text>
            ))}
          </Box>
        )}
        {result && importedKeys.length === 0 && (
          <Box marginBottom={1}>
            <Text color={COLOR.warn}>
              {`${ICON.warn} No mappable settings found in config.`}
            </Text>
          </Box>
        )}
        {hasUnmapped && (
          <Box marginBottom={1} flexDirection="column">
            <Text dimColor>
              {`${ICON.dot} Unmapped flags (not imported):`}
            </Text>
            {result!.unmapped.map((f) => (
              <Text key={f} dimColor>
                {`  ${f}`}
              </Text>
            ))}
          </Box>
        )}
        {result && result.errors.length > 0 && (
          <Box marginBottom={1}>
            <Text color={COLOR.bad}>
              {`${ICON.error} ${result.errors[0]}`}
            </Text>
          </Box>
        )}
        {result && importedKeys.length > 0 && (
          <SelectField
            title=""
            options={[
              { label: "‹ Cancel", value: "cancel" },
              { label: "Import settings", value: "import" },
            ]}
            focused={focused}
            onSelect={(v) => {
              if (v === "import" && result) {
                setConfig({
                  ...config,
                  ...result.imported,
                });
              }
              setMode("menu");
            }}
            onCancel={() => setMode("menu")}
          />
        )}
      </Box>,
      result && importedKeys.length > 0
        ? `↑↓ Move  ${ICON.dot}  ↵ Choose  ${ICON.dot}  esc Back`
        : "esc Back",
    );
  }

  // Label column + inline detail (same rhythm as Download source rows), not
  // edge-pinned with flex — that leaves an ugly dead zone in wide terminals.
  const nameWidth = Math.max(...entries.map((e) => e.name.length));
  const DETAIL_MAX = 48;
  const menuRows = Math.max(1, listRows - 4);
  const menuStart = Math.max(0, Math.min(cursor - Math.floor(menuRows / 2), entries.length - menuRows));

  return (
    <Box flexDirection="column">
      <Header title="Settings" focused={focused} />
      <Box flexDirection="column">
        {entries.slice(menuStart, menuStart + menuRows).map((it, i) => {
          const here = i + menuStart === cursor && focused;
          const active = here && focused;
          const detailColor =
            it.danger ? COLOR.bad : it.set ? COLOR.alt : undefined;
          return (
            <Box key={it.value}>
              <Text color={COLOR.accent}>
                {active ? `${ICON.pointer} ` : "  "}
              </Text>
              <Text
                color={
                  it.danger ? COLOR.bad : active ? COLOR.accent : undefined
                }
                bold={active}
                dimColor={!active && !it.danger}
              >
                {it.name.padEnd(nameWidth)}
              </Text>
              <Text
                color={detailColor}
                dimColor={!it.set && !it.danger}
              >
                {`   ${truncate(it.detail, DETAIL_MAX)}`}
              </Text>
            </Box>
          );
        })}
      </Box>
      {moveNote && (
        <Box marginTop={1}>
          <Text dimColor>{moveNote}</Text>
        </Box>
      )}
      <HintLine>{`↑↓ Move  ${ICON.dot}  ↵ Choose  ${ICON.dot}  ${cursor + 1}/${entries.length}`}</HintLine>
    </Box>
  );
}
