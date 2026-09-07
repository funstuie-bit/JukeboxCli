// The full-screen Now Playing view (toggled with `m` from anywhere):
// truecolor cover art rendered as half-block cells, a waveform progress bar
// precomputed from the audio's loudness envelope, and the shuffle-aware
// up-next list. All transport keys keep working while it is open; `m` or esc
// closes it. Every visual is best-effort — no art, no waveform, or no in-app
// player each fall back to an honest smaller layout, never blocking playback.

import { memo, useEffect, useState, type ReactNode } from "react";
import { Box, Text } from "ink";
import { usePlayback, useStore } from "../store";
import {
  loadCoverArt,
  loadWaveform,
  type CoverArt,
  type Waveform,
} from "../../player/art";
import {
  cleanText,
  formatDuration,
  truncate,
  trackDisplayTitle,
} from "../../util/format";
import { ACCENT_RAMP, COLOR, ICON, RULE, lerpHex } from "../theme";
import { GradientBar } from "../components/GradientBar";
import type { Track } from "../../library/types";

/** Amplitude → block-glyph ramp (same trusted glyph block as GradientBar). */
const WAVE_GLYPHS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;

/** [r, g, b] bytes → "#rrggbb" (the inverse of theme's rgb() parser). */
function hexRGB(rgb: readonly [number, number, number]): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(rgb[0])}${c(rgb[1])}${c(rgb[2])}`;
}

/**
 * Cover art as half-block cells: one `▀` per terminal cell with the top pixel
 * as foreground and the bottom pixel as background, so a cols×rows block
 * shows a cols×(2·rows) image. Memoized on the art object identity — the
 * extraction state holds one stable reference per track/size, so 1 Hz
 * playback ticks never rebuild the (cols×rows) element tree.
 */
const ArtBlock = memo(function ArtBlock({ art }: { art: CoverArt }) {
  const rowsOut: ReactNode[] = [];
  for (let y = 0; y < art.rows; y++) {
    const cells: ReactNode[] = [];
    for (let x = 0; x < art.cols; x++) {
      const cell = art.cells[y * art.cols + x]!;
      cells.push(
        <Text
          key={x}
          color={hexRGB(cell.top)}
          backgroundColor={hexRGB(cell.bottom)}
        >
          ▀
        </Text>,
      );
    }
    rowsOut.push(<Text key={y}>{cells}</Text>);
  }
  return <Box flexDirection="column">{rowsOut}</Box>;
});

/**
 * One waveform row: per-column amplitude glyphs, colored along the accent
 * ramp up to the play position and dim beyond it. Memoized on the samples
 * array (stable per track) and the integer play column, so only the once-per-
 * second boundary crossing re-renders the row.
 */
const WaveRow = memo(function WaveRow({
  samples,
  played,
}: {
  samples: number[];
  played: number;
}) {
  const last = Math.max(1, samples.length - 1);
  return (
    <Text>
      {samples.map((v, i) => {
        const glyph = WAVE_GLYPHS[Math.min(7, Math.floor(v * 8))]!;
        return i < played ? (
          <Text
            key={i}
            color={lerpHex(ACCENT_RAMP[0], ACCENT_RAMP[1], i / last)}
          >
            {glyph}
          </Text>
        ) : (
          <Text key={i} dimColor>
            {glyph}
          </Text>
        );
      })}
    </Text>
  );
});

/** The art-sized placeholder while extracting, or after a file had no art. */
function ArtPlaceholder({
  cols,
  rows,
  label,
}: {
  cols: number;
  rows: number;
  label: string;
}) {
  return (
    <Box
      width={cols}
      height={rows}
      borderStyle="single"
      borderColor={RULE}
      justifyContent="center"
      alignItems="center"
    >
      <Text dimColor>{label}</Text>
    </Box>
  );
}

export function NowPlaying() {
  const store = useStore();
  const st = usePlayback(store.playback);
  const { playback, cols, listRows } = store;

  // Geometry. The view owns the body's rows (listRows + the header+slack the
  // body reserves) and the full terminal width minus root padding.
  const width = Math.max(30, cols - 2);
  const viewH = listRows + 2;
  // Rich layout needs room for art beside info plus an up-next list; small
  // terminals get the honest minimal stack instead of a squeezed collage.
  const rich = viewH >= 10 && width >= 50;
  const upNextCount = viewH >= 14 ? 3 : viewH >= 12 ? 2 : 0;
  const artCols = Math.max(16, Math.min(34, Math.floor(width * 0.38)));
  // Art height: what remains beside the info column after the up-next block.
  const artRows = Math.max(
    4,
    Math.min(14, viewH - (upNextCount ? upNextCount + 2 : 0) - 4),
  );
  const infoW = rich ? Math.max(24, width - artCols - 2) : width;
  const buckets = Math.max(8, Math.min(infoW, 64));

  const file = st.track?.filePath;

  // Extraction state, keyed to the file it belongs to: a stale frame can
  // never paint the previous track's cover over the new title. `visual` is
  // null while extracting (spinner placeholder) and set once both loaders
  // settle — a null art/wave inside it means "resolved, none available".
  const [visual, setVisual] = useState<{
    file: string;
    art: CoverArt | null;
    wave: Waveform | null;
  } | null>(null);

  useEffect(() => {
    if (!file || !rich) return;
    let cancelled = false;
    setVisual(null);
    void (async () => {
      const [art, wave] = await Promise.all([
        loadCoverArt(file, artCols, artRows),
        loadWaveform(file, buckets),
      ]);
      if (!cancelled) setVisual({ file, art, wave });
    })();
    return () => {
      cancelled = true;
    };
  }, [file, rich, artCols, artRows, buckets]);

  // Guarded by the file check so a stale extraction never paints the previous
  // track's art over the new title while its own extraction runs.
  const mine =
    visual !== null && visual.file === file ? visual : null;
  const art: CoverArt | null = mine?.art ?? null;
  const wave: Waveform | null = mine?.wave ?? null;
  const artReady = mine !== null;

  if (!st.track) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text dimColor>{ICON.play} Nothing playing</Text>
        <Box marginTop={1}>
          <Text dimColor>
            Pick a song from the library {ICON.dot}{" "}
            <Text color={COLOR.alt}>m</Text> closes this screen
          </Text>
        </Box>
      </Box>
    );
  }

  const t = st.track;
  const title = truncate(cleanText(trackDisplayTitle(t)), infoW);
  const artist = t.artist ? truncate(cleanText(t.artist), infoW - 4) : "";
  const canTrack = st.engine === "mpv" && !st.loading;
  const pct =
    canTrack && st.duration > 0
      ? (st.position / st.duration) * 100
      : 0;
  const played =
    canTrack && st.duration > 0
      ? Math.max(
          0,
          Math.min(buckets, Math.floor((st.position / st.duration) * buckets)),
        )
      : 0;
  const clock =
    st.duration > 0
      ? `${formatDuration(st.position)} / ${formatDuration(st.duration)}`
      : "";

  const badges: string[] = [];
  if (st.shuffle) badges.push(ICON.shuffle);
  if (st.repeat === "all") badges.push(ICON.repeat);
  else if (st.repeat === "one") badges.push(`${ICON.repeat}1`);

  const info = (
    <Box
      flexDirection="column"
      width={infoW}
      justifyContent={rich ? "center" : "flex-start"}
    >
      <Text bold color={COLOR.text} wrap="truncate-end">
        {title}
      </Text>
      {artist ? (
        <Text dimColor wrap="truncate-end">
          {artist}
          {t.playlist ? `  ${ICON.dot}  ${truncate(cleanText(t.playlist), 28)}` : ""}
        </Text>
      ) : null}
      {canTrack ? (
        <Box marginTop={1} flexDirection="column">
          {wave ? (
            <WaveRow samples={wave.samples} played={played} />
          ) : (
            <GradientBar pct={pct} width={buckets} />
          )}
          <Text>
            <Text color={COLOR.warn}>
              {st.paused ? `${ICON.pause} ` : ""}
            </Text>
            <Text dimColor>{clock}</Text>
            <Text dimColor>{`  ${ICON.dot}  ${st.volume}%`}</Text>
            {badges.length ? (
              <Text dimColor>{`  ${badges.join(" ")}`}</Text>
            ) : null}
          </Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text dimColor>
            {st.loading
              ? "loading…"
              : "Playing in your default app — seek and progress need the in-app player"}
          </Text>
        </Box>
      )}
    </Box>
  );

  const upNext: Track[] = upNextCount ? playback.upNext(upNextCount) : [];

  return (
    <Box flexDirection="column" width={width}>
      {rich ? (
        <Box flexDirection="row">
          {art ? (
            <ArtBlock art={art} />
          ) : (
            <ArtPlaceholder
              cols={artCols}
              rows={artRows}
              label={artReady ? "no cover art" : "…"}
            />
          )}
          <Box flexDirection="column" justifyContent="center" marginLeft={2}>
            {info}
          </Box>
        </Box>
      ) : (
        info
      )}
      {upNext.length ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={COLOR.alt} bold>
            Up next
          </Text>
          {upNext.map((u, i) => (
            <Box key={u.id}>
              <Text dimColor>{` ${i + 1} `}</Text>
              <Text wrap="truncate-end">
                <Text color={COLOR.text}>
                  {truncate(cleanText(trackDisplayTitle(u)), width - 8)}
                </Text>
                {u.artist ? (
                  <Text dimColor>{` · ${truncate(cleanText(u.artist), 30)}`}</Text>
                ) : null}
              </Text>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
