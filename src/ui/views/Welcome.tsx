import { useEffect, useState } from "react";
import { Box, Text, useInput, usePaste } from "ink";
import { Spinner, Select } from "@inkjs/ui";
import { useStore } from "../store";
import { GradientBar } from "../components/GradientBar";
import { TextField } from "../components/TextField";
import { SelectField, TextInputField } from "../components/FormHelpers";
import { makeYoutube } from "../../sources/youtube";
import { makeSoundcloud } from "../../sources/soundcloud";
import { makeSpotify } from "../../sources/spotify/adapter";
import { clearPartials } from "../../sources/partials";
import { mpvInstallHint } from "../../player/playback";
import { normalizeHandle } from "../../sources/handle";
import { persistableHandle } from "../../sources/persist-handle";
import { displayPath, expandTilde } from "../../util/format";
import { wrapStep } from "../move";
import { COLOR, ICON } from "../theme";
import { detectBrowserProfiles, type BrowserProfile } from "../../config/cookies";
import { findYtDlpConfig, importFromYtDlpConfig, type ImportResult } from "../../config/import";
import { defaultLibraryDir } from "../../config/paths";
import type { SourceId } from "../../library/types";
import type { SourceAdapter, SourcePlaylist } from "../../sources/types";

type Step =
  | "intro"
  | "handle"
  | "format"
  | "cookies"
  | "cookies-browser"
  | "cookies-file"
  | "output"
  | "loading"
  | "downloading"
  | "error";

/** Sources the tour can sync from a typed handle (not link-pasted or local). */
type HandleSource = Exclude<SourceId, "link" | "local">;

const SOURCES: {
  id: HandleSource;
  name: string;
  hint: string;
}[] = [
  { id: "youtube", name: "YouTube", hint: "Your public playlists" },
  { id: "soundcloud", name: "SoundCloud", hint: "Your likes & playlists" },
  { id: "spotify", name: "Spotify", hint: "Your public playlists" },
];

const PROMPTS: Record<
  HandleSource,
  { title: string; hint: string; placeholder: string }
> = {
  youtube: {
    title: "Your YouTube handle or link",
    hint: "Type a handle, or paste any channel or playlist link",
    placeholder: "@username or URL",
  },
  soundcloud: {
    title: "Your SoundCloud handle or link",
    hint: "Type a handle, or paste any profile or playlist link",
    placeholder: "@username or URL",
  },
  spotify: {
    title: "Your Spotify handle or link",
    hint: "Type a handle, or paste any profile or playlist link",
    placeholder: "@username or URL",
  },
};

function adapterFor(source: SourceId, value: string): SourceAdapter {
  if (source === "youtube") return makeYoutube(value);
  if (source === "soundcloud") return makeSoundcloud(value);
  return makeSpotify(value);
}

export function Welcome() {
  const {
    config,
    setConfig,
    setSection,
    setRegion,
    queue,
    binaries,
    setCaptureMode,
    setPendingAdd,
  } = useStore();

  const [step, setStep] = useState<Step>("intro");
  const [source, setSource] = useState<HandleSource | null>(null);
  const [cursor, setCursor] = useState(0);
  const [error, setError] = useState("");
  /** The handle being looked up, so the loading screen can name it. */
  const [handle, setHandle] = useState("");
  /** Progress while enumerating each list's tracks, so big libraries don't
   *  sit on a static spinner with no sign of life. */
  const [gather, setGather] = useState({ done: 0, total: 0 });
  /** Browser profiles detected for the cookies wizard step. */
  const [browserProfiles, setBrowserProfiles] = useState<BrowserProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);

  // Capture input during text-entry steps so global keys don't fire.
  const capturing = step === "handle" || step === "cookies-file" || step === "output";
  useEffect(() => {
    setCaptureMode(capturing ? "text" : "none");
    return () => setCaptureMode("none");
  }, [capturing, setCaptureMode]);

  const acceptIntroPaste = (input: string): void => {
    const text = input.replace(/[\r\n]+/g, " ").trim();
    if (!text) return;
    setConfig({ ...config, firstRunComplete: true });
    setPendingAdd(text);
    setSection("download");
    setRegion("content");
  };

  usePaste(acceptIntroPaste, { isActive: step === "intro" });

  // Intro: pick a source (or skip with esc). A multi-character chunk can only
  // be a paste (every intro shortcut is a single key), so treat it as a link:
  // finish onboarding and drop into the Download add flow with it prefilled
  // (the same paste convention the Download landing uses).
  useInput(
    (input, key) => {
      if (!key.ctrl && !key.meta) {
        const text = input
          .replace(/\x1b?\[<\d+;\d+;\d+[Mm]/g, "")
          .replace(/[\r\n]+/g, " ")
          .trim();
        if (text.length > 1) {
          acceptIntroPaste(text);
          return;
        }
      }
      if (key.upArrow) setCursor((c) => wrapStep(c, -1, SOURCES.length));
      else if (key.downArrow)
        setCursor((c) => wrapStep(c, 1, SOURCES.length));
      else if (key.return) {
        setSource(SOURCES[cursor]!.id);
        // If there's already a saved handle for this source, skip to loading.
        const saved = savedValue(SOURCES[cursor]!.id);
        if (saved) {
          void startLoading(SOURCES[cursor]!.id, saved);
        } else {
          setStep("handle");
        }
      } else if (key.escape) {
        // Skip onboarding entirely.
        finishOnboarding();
      }
    },
    { isActive: step === "intro" },
  );

  // Handle entry: submit with enter, go back with esc.
  useInput(
    (_input, key) => {
      if (key.escape) {
        setStep("intro");
      }
    },
    { isActive: step === "handle" },
  );

  // Format step: esc goes back to handle.
  useInput(
    (_input, key) => {
      if (key.escape) setStep("handle");
    },
    { isActive: step === "format" },
  );

  // Cookies step: esc goes back to format.
  useInput(
    (_input, key) => {
      if (key.escape) setStep("format");
    },
    { isActive: step === "cookies" },
  );

  // Cookies-browser: esc goes back to cookies menu.
  useInput(
    (_input, key) => {
      if (key.escape) setStep("cookies");
    },
    { isActive: step === "cookies-browser" },
  );

  // Cookies-file: esc goes back to cookies menu.
  useInput(
    (_input, key) => {
      if (key.escape) setStep("cookies");
    },
    { isActive: step === "cookies-file" },
  );

  // Output step: esc goes back to cookies.
  useInput(
    (_input, key) => {
      if (key.escape) setStep("cookies");
    },
    { isActive: step === "output" },
  );

  // Detect browser profiles when entering the cookies-browser step.
  useEffect(() => {
    if (step === "cookies-browser" && !browserProfiles.length && !profilesLoading) {
      setProfilesLoading(true);
      void (async () => {
        const detected = await detectBrowserProfiles();
        setBrowserProfiles(detected);
        setProfilesLoading(false);
      })();
    }
  }, [step, browserProfiles.length, profilesLoading]);

  // Error: any key goes back to intro.
  useInput(
    () => {
      setStep("intro");
      setError("");
    },
    { isActive: step === "error" },
  );

  function savedValue(src: SourceId): string | undefined {
    if (src === "youtube") return config.youtubeHandle;
    if (src === "soundcloud") return config.soundcloudHandle;
    return config.spotifyHandle;
  }

  function saveHandle(src: SourceId, value: string): void {
    if (src === "youtube") setConfig({ ...config, youtubeHandle: value });
    else if (src === "soundcloud")
      setConfig({ ...config, soundcloudHandle: value });
    else setConfig({ ...config, spotifyHandle: value });
  }

  async function startLoading(src: SourceId, value: string): Promise<void> {
    setHandle(value);
    setStep("loading");
    const adapter = adapterFor(src, value);
    try {
      const lists = await adapter.listPlaylists();
      if (lists.length === 0) {
        setError(
          `Couldn't find anything public for "${
            value.startsWith("http") ? value : `@${normalizeHandle(value)}`
          }". Check the handle and try again.`,
        );
        setStep("error");
        return;
      }
      // Auto-download everything: enumerate all lists concurrently and enqueue.
      await autoDownloadAll(adapter, lists);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("error");
    }
  }

  async function autoDownloadAll(
    adapter: SourceAdapter,
    lists: SourcePlaylist[],
  ): Promise<void> {
    setStep("downloading");
    setGather({ done: 0, total: lists.length });
    clearPartials();
    let addedAny = false;
    let gathered = 0;
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < lists.length) {
        const pl = lists[cursor++]!;
        try {
          const tracks = await adapter.listTracks(pl);
          if (tracks.length > 0) {
            const r = queue.enqueue(
              tracks.map((t) => ({
                source: adapter.id,
                sourceLabel: adapter.label,
                track: t,
              })),
            );
            if (r.added > 0) addedAny = true;
          }
        } catch {
          // individual list failures are fine, keep going
        }
        gathered++;
        setGather({ done: gathered, total: lists.length });
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(5, lists.length) }, () => worker()),
    );

    // Done gathering. Finish onboarding and drop into the download queue.
    finishOnboarding(addedAny);
  }

  function finishOnboarding(hasDownloads = false): void {
    setConfig({ ...config, firstRunComplete: true });
    if (hasDownloads) {
      setSection("download");
      setRegion("content");
    }
  }

  function onHandleSubmit(value: string): void {
    const v = value.trim();
    if (!v || !source) return;

    const handle = persistableHandle(source, v);
    if (handle !== undefined) {
      saveHandle(source, handle);
    }

    // Go to format setup instead of straight to loading.
    setStep("format");
  }

  const nameWidth = Math.max(...SOURCES.map((s) => s.name.length));

  // ── Intro step ──────────────────────────────────────────────────────

  if (step === "intro") {
    return (
      <Box flexDirection="column">
        <Box flexDirection="column">
          <Text bold color={COLOR.text}>
            Own your music.
          </Text>
          <Text dimColor>
            Your YouTube, SoundCloud, and Spotify libraries, saved to local
            files, played offline.
          </Text>
        </Box>
        {!binaries.mpv ? (
          <Box marginTop={1}>
            <Text dimColor>
              {process.platform === "linux"
                ? // No auto-install on linux: hand over the one-liner instead.
                  `${ICON.dot} For the built-in player: ${mpvInstallHint()}`
                : `${ICON.dot} Setting up the in-app player in the background`}
            </Text>
          </Box>
        ) : null}
        <Box marginTop={1}>
          <Text dimColor>{"Saves to "}</Text>
          <Text color={COLOR.amber}>{displayPath(config.libraryDir)}</Text>
        </Box>
        <Box marginTop={1} marginBottom={1}>
          <Text bold color={COLOR.text}>
            Where's your music?
          </Text>
        </Box>
        {SOURCES.map((s, i) => {
          const here = i === cursor;
          return (
            <Box key={s.id}>
              <Text color={COLOR.accent}>
                {here ? `${ICON.pointer} ` : "  "}
              </Text>
              <Text
                color={here ? COLOR.accent : undefined}
                dimColor={!here}
                bold={here}
              >
                {s.name.padEnd(nameWidth)}
              </Text>
              <Text dimColor>{`   ${s.hint}`}</Text>
            </Box>
          );
        })}
        <Box marginTop={1}>
          <Text dimColor>{`↑↓ Move  ${ICON.dot}  ↵ Choose  ${ICON.dot}  esc Skip`}</Text>
        </Box>
      </Box>
    );
  }

  // ── Handle entry step ───────────────────────────────────────────────

  if (step === "handle" && source) {
    const p = PROMPTS[source];
    const sourceName = SOURCES.find((s) => s.id === source)!.name;
    return (
      <Box flexDirection="column">
        <Box>
          <Text bold color={COLOR.text}>
            {`Your ${sourceName} handle or link`}
          </Text>
        </Box>
        <Text dimColor>{p.hint}</Text>
        <Box marginTop={1}>
          <Text color={COLOR.accent}>{`${ICON.pointer} `}</Text>
          <TextField
            placeholder={p.placeholder}
            onSubmit={onHandleSubmit}
          />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>{`↵ Continue  ${ICON.dot}  esc Back`}</Text>
        </Box>
      </Box>
    );
  }

  // ── Format step ─────────────────────────────────────────────────────

  if (step === "format" && source) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color={COLOR.text}>
            Choose your audio format
          </Text>
        </Box>
        <SelectField
          title=""
          options={[
            { label: "Best (no conversion)", value: "best" },
            { label: "MP3", value: "mp3" },
            { label: "FLAC", value: "flac" },
            { label: "WAV", value: "wav" },
            { label: "M4A", value: "m4a" },
            { label: "Opus", value: "opus" },
            { label: "Vorbis", value: "vorbis" },
          ]}
          onSelect={(v) => {
            setConfig({ ...config, audioFormat: v });
            setStep("cookies");
          }}
          onCancel={() => setStep("handle")}
          focused
          hint={`↑↓ Move  ${ICON.dot}  ↵ Choose  ${ICON.dot}  esc Back`}
        />
      </Box>
    );
  }

  // ── Cookies step ────────────────────────────────────────────────────

  if (step === "cookies" && source) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color={COLOR.text}>
            Set up cookies?
          </Text>
        </Box>
        <Text dimColor>
          Avoids rate limits on YouTube and SoundCloud.
        </Text>
        <Box marginTop={1}>
          <SelectField
            title=""
            options={[
              { label: "Import from browser", value: "browser" },
              { label: "Choose cookies.txt file", value: "file" },
              { label: "Skip", value: "skip" },
            ]}
            onSelect={(v) => {
              if (v === "browser") {
                setStep("cookies-browser");
              } else if (v === "file") {
                setStep("cookies-file");
              } else {
                setStep("output");
              }
            }}
            onCancel={() => setStep("format")}
            focused
            hint={`↑↓ Move  ${ICON.dot}  ↵ Choose  ${ICON.dot}  esc Back`}
          />
        </Box>
      </Box>
    );
  }

  // ── Cookies: browser detection ──────────────────────────────────────

  if (step === "cookies-browser" && source) {
    if (profilesLoading) {
      return (
        <Box flexDirection="column">
          <Spinner label="Detecting browser profiles…" />
        </Box>
      );
    }
    if (browserProfiles.length === 0) {
      return (
        <Box flexDirection="column">
          <Text color={COLOR.warn}>
            {`${ICON.warn} No browser profiles found.`}
          </Text>
          <Box marginTop={1}>
            <Text dimColor>
              Export cookies.txt from your browser with a cookie extension,
              then choose "Choose cookies.txt file".
            </Text>
          </Box>
          <Box marginTop={1}>
            <SelectField
              title=""
              options={[
                { label: "Choose cookies.txt file instead", value: "file" },
                { label: "Skip", value: "skip" },
              ]}
              onSelect={(v) => {
                if (v === "file") setStep("cookies-file");
                else setStep("output");
              }}
              onCancel={() => setStep("cookies")}
              focused
              hint={`↵ Choose  ${ICON.dot}  esc Back`}
            />
          </Box>
        </Box>
      );
    }
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color={COLOR.text}>
            Pick a browser profile
          </Text>
        </Box>
        <SelectField
          title=""
          options={browserProfiles.map((p) => ({
            label: p.label,
            value: `${p.browser}:${p.profileName}`,
          }))}
          onSelect={(v) => {
            setConfig({ ...config, cookiesFromBrowser: v });
            setStep("output");
          }}
          onCancel={() => setStep("cookies")}
          focused
          hint={`↑↓ Move  ${ICON.dot}  ↵ Choose  ${ICON.dot}  esc Back`}
        />
      </Box>
    );
  }

  // ── Cookies: file path entry ─────────────────────────────────────────

  if (step === "cookies-file" && source) {
    return (
      <Box flexDirection="column">
        <TextInputField
          title="Path to cookies.txt"
          hint="Netscape format — export with a browser cookie extension"
          placeholder="~/cookies.txt"
          onSubmit={(v) => {
            setConfig({ ...config, cookiesFile: v });
            setStep("output");
          }}
          onCancel={() => setStep("cookies")}
          focused
        />
        <Box marginTop={1}>
          <Text dimColor>{`↵ Save  ${ICON.dot}  esc Back`}</Text>
        </Box>
      </Box>
    );
  }

  // ── Output location step ─────────────────────────────────────────────

  if (step === "output" && source) {
    return (
      <Box flexDirection="column">
        <TextInputField
          title="Where should downloads go?"
          hint="Press enter to keep the default, or type a new path"
          placeholder={displayPath(defaultLibraryDir)}
          defaultValue={displayPath(config.libraryDir)}
          onSubmit={(v) => {
            if (v.trim()) {
              setConfig({ ...config, libraryDir: expandTilde(v.trim()) });
            }
            // Start loading the source the user picked.
            void startLoading(source, handle || savedValue(source) || "");
          }}
          onCancel={() => setStep("cookies")}
          focused
        />
        <Box marginTop={1}>
          <Text dimColor>{`↵ Continue  ${ICON.dot}  esc Back`}</Text>
        </Box>
      </Box>
    );
  }

  // ── Loading step ────────────────────────────────────────────────────

  if (step === "loading") {
    const label =
      source === "spotify"
        ? "Reading your Spotify playlist…"
        : `Loading ${
            handle.startsWith("http") ? "link" : `@${normalizeHandle(handle)}`
          }…`;
    return (
      <Box flexDirection="column">
        <Spinner label={label} />
      </Box>
    );
  }

  // ── Downloading step ────────────────────────────────────────────────

  if (step === "downloading") {
    const pct = gather.total > 0 ? (gather.done / gather.total) * 100 : 0;
    return (
      <Box flexDirection="column">
        <Spinner label="Gathering your songs…" />
        {gather.total > 1 ? (
          <Box marginTop={1}>
            <GradientBar pct={pct} width={24} />
            <Text dimColor>{`  ${gather.done} of ${gather.total} lists`}</Text>
          </Box>
        ) : null}
        <Box marginTop={1}>
          <Text dimColor>
            We'll grab everything and start downloading right away.
          </Text>
        </Box>
      </Box>
    );
  }

  // ── Error step ──────────────────────────────────────────────────────

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={COLOR.warn}>{`${ICON.warn} ${error}`}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press any key to try again</Text>
      </Box>
    </Box>
  );
}
