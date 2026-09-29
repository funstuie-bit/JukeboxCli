import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { Select } from "@inkjs/ui";
import {
  useStore,
  useQueueDoneCount,
  useLibrary,
  usePlaybackSelector,
} from "../store";
import { Header } from "../components/Header";
import { SourceTabs, type SourceFilter } from "../components/SourceTabs";
import { TextField } from "../components/TextField";
import { SongList, type SongGroup } from "../components/SongList";
import { COLOR, ICON } from "../theme";
import { cleanText, formatDuration } from "../../util/format";
import { deleteTracks } from "../../library/delete";
import { displaySource } from "../../library/drift";
import { renameTrack } from "../../library/rename";
import { SOURCE_LABELS, type SourceId, type Track } from "../../library/types";
import { libraryCollections, type BrowseMode } from "../../library/browse";
import path from "node:path";

const SOURCE_ORDER: SourceId[] = [
  "youtube",
  "soundcloud",
  "spotify",
  "link",
  "local",
];

/** Fisher-Yates shuffle (returns a new array). */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Source/search filters shared by song, artist and album browsing. */
export function Library() {
  const {
    library,
    config,
    playTrack,
    region,
    setSection,
    setCaptureMode,
    queue,
    playback,
    pendingSearch,
    setPendingSearch,
    compact,
    contentWidth,
    listRows,
  } = useStore();
  const doneCount = useQueueDoneCount(queue);
  const libVersion = useLibrary(library);
  const playingId = usePlaybackSelector(playback, (s) => s.track?.id);
  const focused = region === "content";

  // Text search + a source tab filter.
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [browseMode, setBrowseMode] = useState<BrowseMode>("songs");
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [details, setDetails] = useState(true);
  const searching = q.trim().length > 0;
  // Pending one-song delete, shown as a y/esc confirm in the search row.
  const [confirm, setConfirm] = useState<{ id: string; title: string } | null>(
    null,
  );
  // Pending track rename.
  const [renamingTrackId, setRenamingTrackId] = useState<string | null>(null);
  const [newTrackTitle, setNewTrackTitle] = useState("");

  const songs = useMemo(
    // library.all() is already newest-first (addedAt desc); recompute on new
    // downloads and on drift cleanup (prune/merge).
    () => library.all(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [library, doneCount, libVersion],
  );

  // Tabs group by where each file sits on disk, not where it was downloaded
  // from, so re-sorting music between the top-level folders re-tabs it.
  const srcOf = useMemo(() => {
    const m = new Map<string, SourceId>();
    for (const t of songs) m.set(t.id, displaySource(t, config.libraryDir));
    return (t: Track): SourceId => m.get(t.id) ?? t.source;
  }, [songs, config.libraryDir]);

  // Sources that actually have songs, in canonical order, for the filter tabs.
  const presentSources = useMemo(() => {
    const set = new Set(songs.map(srcOf));
    return SOURCE_ORDER.filter((s) => set.has(s));
  }, [songs, srcOf]);
  const tabs = useMemo<SourceFilter[]>(
    () => ["all", ...presentSources],
    [presentSources],
  );

  // Per-source totals shown beside each tab, so the bar reads as a real
  // segmented control. Counts reflect the whole library, not the search.
  const countBySource = useMemo(() => {
    const m = new Map<SourceId, number>();
    for (const t of songs) {
      const s = srcOf(t);
      m.set(s, (m.get(s) ?? 0) + 1);
    }
    return m;
  }, [songs, srcOf]);
  const tabCount = (tb: SourceFilter): number =>
    tb === "all" ? songs.length : countBySource.get(tb) ?? 0;

  // If the active source disappears (e.g. its last song is removed), fall back.
  useEffect(() => {
    if (filter !== "all" && !presentSources.includes(filter)) setFilter("all");
  }, [filter, presentSources]);

  // Tracks narrowed to the active source tab.
  const inSource = useMemo(
    () => (filter === "all" ? songs : songs.filter((t) => srcOf(t) === filter)),
    [filter, songs, srcOf],
  );

  // Memoized: fuzzy search over the whole library must run on query/tab/data
  // changes only, never on playback-tick or cursor re-renders.
  const matching = useMemo(
    () =>
      searching
        ? library
            .search(q)
            .filter((t) => filter === "all" || srcOf(t) === filter)
        : inSource,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searching, q, filter, inSource, srcOf],
  );

  const collections = useMemo(() => browseMode === "songs" ? [] : libraryCollections(matching, browseMode), [matching, browseMode]);
  const collection = collections.find(c => c.id === collectionId);
  const browsingCollections = browseMode !== "songs" && collectionId === null;
  const visible = collectionId === null ? matching : collection?.tracks ?? [];

  // Memoized: the per-track item arrays must rebuild on data/tab/query changes
  // only, never on playback-tick or cursor re-renders. Independent of playback
  // and cursor state by design (playingId reaches SongList separately).
  const groups = useMemo<SongGroup[]>(() => {
    if (browsingCollections) return [{ items: collections.map(c => ({ value: c.id, title: c.title, artist: c.artist, meta: `${c.tracks.length} tracks` })) }];
    const toItem = (t: Track) => ({
      value: t.id,
      title: t.title,
      artist: t.artist,
      meta: formatDuration(t.durationSec),
    });
    if (searching || collectionId !== null) return [{ items: visible.map(toItem) }];
    if (filter === "all" && presentSources.length > 1) {
      return presentSources
        .map((src) => {
          const tracks = inSource.filter((t) => srcOf(t) === src);
          return {
            title: `${SOURCE_LABELS[src]}  ${ICON.dot}  ${tracks.length}`,
            items: tracks.map(toItem),
          };
        })
        .filter((g) => g.items.length > 0);
    }
    return [{ items: visible.map(toItem) }];
  }, [searching, visible, filter, presentSources, inSource, srcOf, browsingCollections, collections, collectionId]);

  // Shuffle action for the browse view only; search results play in order.
  // Memoized so its identity holds across unrelated re-renders.
  const action = useMemo(
    () =>
      !browsingCollections && !searching && visible.length > 1
        ? {
            value: "__shuffle__",
            label: `${ICON.shuffle} Shuffle ${
              collection ? cleanText(collection.title) : filter === "all" ? "all" : SOURCE_LABELS[filter]
            } (${visible.length})`,
          }
        : undefined,
    [searching, visible, filter, browsingCollections, collection],
  );

  // Take over the keyboard only while typing in the search box; a pending
  // delete confirm owns esc so the global one doesn't bounce to the sidebar.
  const renaming = focused && renamingTrackId !== null;
  useEffect(() => {
    setCaptureMode(
      focused && (editing || renaming)
        ? "text"
        : focused && (confirm || collectionId !== null)
          ? "esc"
          : "none",
    );
    return () => setCaptureMode("none");
  }, [focused, editing, confirm, renaming, collectionId, setCaptureMode]);

  // Consume the global "/" intent: arrive with the search box already open.
  useEffect(() => {
    if (pendingSearch && focused) {
      setPendingSearch(false);
      setEditing(true);
    }
  }, [pendingSearch, focused, setPendingSearch]);

  // Browsing keys:
  //   "/" opens search
  //   "[" / "]" step the source tabs
  useInput(
    (input, key) => {
      if (input === "B") {
        setBrowseMode(browseMode === "songs" ? "artists" : browseMode === "artists" ? "albums" : "songs");
        setCollectionId(null);
        return;
      }
      if (input === "i") { setDetails(v => !v); return; }
      if (key.escape && collectionId !== null) { setCollectionId(null); return; }
      if (input === "/") {
        setEditing(true);
        return;
      }
      if (input === "[" || input === "]") {
        const dir = input === "]" ? 1 : -1;
        const i = tabs.indexOf(filter);
        setFilter(tabs[(i + dir + tabs.length) % tabs.length]!);
        setCollectionId(null);
      }
    },
    { isActive: focused && !editing && !confirm && !renaming },
  );

  // esc closes the search box (back to browsing), without leaving the section.
  useInput(
    (_input, key) => {
      if (key.escape) setEditing(false);
    },
    { isActive: focused && editing },
  );

  // esc cancels rename.
  useInput(
    (_input, key) => {
      if (key.escape) {
        setRenamingTrackId(null);
        setNewTrackTitle("");
      }
    },
    { isActive: renaming },
  );

  const handleRenameSubmit = async () => {
    const track = renamingTrackId ? library.get(renamingTrackId) : undefined;
    if (track) {
      const result = await renameTrack(library, track, newTrackTitle);
      // The new name is already taken on disk: keep the field open so it can
      // be adjusted (esc cancels) instead of silently dropping the rename.
      if (result === "collision") return;
    }
    setRenamingTrackId(null);
    setNewTrackTitle("");
  };

  // y commits the pending delete, esc keeps the song. Playback stops first
  // when it's the one playing: the player holds the file handle open and
  // Windows refuses to unlink it.
  useInput(
    (input, key) => {
      if (key.escape) setConfirm(null);
      else if (input === "y" && confirm) {
        const t = library.get(confirm.id);
        setConfirm(null);
        if (!t) return;
        void (async () => {
          if (playingId === t.id) await playback.stop();
          await deleteTracks(library, [t], config.libraryDir);
        })();
      }
    },
    { isActive: focused && confirm !== null },
  );

  // Stable handler identities, so a memoized SongList can skip re-renders
  // that only touch this section's local state.
  const handleDelete = useCallback(
    (value: string) => {
      const t = library.get(value);
      if (t) setConfirm({ id: t.id, title: t.title });
    },
    [library],
  );
  const handleSelect = useCallback(
    (value: string) => {
      if (browsingCollections) { setCollectionId(value); return; }
      if (value === "__shuffle__") {
        const shuffled = shuffle(visible);
        if (shuffled.length > 0) playTrack(shuffled[0]!, shuffled);
        return;
      }
      const t = library.get(value);
      if (t) playTrack(t, visible);
    },
    [library, playTrack, visible, browsingCollections],
  );
  const handleRename = useCallback(
    (value: string) => {
      const t = library.get(value);
      if (t) {
        setRenamingTrackId(t.id);
        setNewTrackTitle(t.title);
      }
    },
    [library],
  );

  if (songs.length === 0) {
    return (
      <Box flexDirection="column">
        <Header title="Library" focused={focused} />
        <Text color={COLOR.muted}>Nothing here yet. Stream now, or save music for offline listening.</Text>
        <Box marginTop={1}>
          <Select
            isDisabled={!focused}
            options={[{ label: "Search and stream ›", value: "discover" }, { label: "Download ›", value: "download" }, { label: "Music folder settings ›", value: "settings" }]}
            onChange={value => setSection(value as "discover" | "download" | "settings")}
          />
        </Box>
      </Box>
    );
  }

  const subtitle = browsingCollections ? `${collections.length} ${browseMode}` : `${visible.length.toLocaleString()} song${visible.length === 1 ? "" : "s"}`;

  // The search/hint row carries content only while typing, confirming a
  // delete, or showing an active query; when compact and idle, drop it so the
  // list gets the row back.
  const showSearchRow =
    !compact || editing || confirm !== null || searching || renaming;
  // In the smallest windows, search/confirmation replaces the browse hint.
  const showBrowseRow = !compact || !showSearchRow;
  const reserveRows = 1 + (showBrowseRow ? 1 : 0) + (showSearchRow ? (compact ? 1 : 2) : 0);
  // Keep at least three song rows; hide details in short terminals.
  const showDetails = details && !compact && listRows - reserveRows >= 7;
  const preview = showDetails ? (id: string | undefined) => {
    if (browsingCollections) {
      const c = collections.find(item => item.id === id);
      return <>
        <Text color={COLOR.accent} wrap="truncate-end">{cleanText(c?.title ?? "Details")}</Text>
        <Text wrap="truncate-end">{c ? `${c.tracks.length} tracks${c.artist ? ` · ${cleanText(c.artist)}` : ""}` : "Choose a collection"}</Text>
        <Text color={COLOR.muted} wrap="truncate-end">{c?.tracks.slice(0, 3).map(t => cleanText(t.title)).join(" · ")}</Text>
      </>;
    }
    const t = id ? library.get(id) : undefined;
    return <>
      <Text color={COLOR.accent} wrap="truncate-end">{cleanText(t?.title ?? "Track details")}</Text>
      <Text wrap="truncate-end">{t ? `${cleanText(t.artist || "Unknown artist")} · ${cleanText(t.album || "Unknown album")}` : "Highlight a track to inspect it"}</Text>
      <Text color={COLOR.muted} wrap="truncate-end">{t ? `${path.extname(t.filePath).slice(1).toUpperCase()} · ${formatDuration(t.durationSec)} · ${cleanText(path.basename(t.filePath))}` : "Enter plays · A appends · P queues next"}</Text>
    </>;
  } : undefined;

  return (
    <Box flexDirection="column">
      <Header title="Library" subtitle={subtitle} focused={focused} />
      <SourceTabs tabs={tabs} active={filter} count={tabCount} />
      {showBrowseRow ? <Text color={COLOR.accent} wrap="truncate-end">B Browse: {browseMode}{collectionId !== null ? ` / ${cleanText(collection?.title ?? "No matches")} · esc Back` : ""} · i Details {details ? showDetails ? "on" : "auto-hidden" : "off"}</Text> : null}
      {/* The search row doubles as the delete confirm: same single row, so
          the list's height budget never moves. Hidden when compact + idle. */}
      {showSearchRow ? (
        <Box marginBottom={compact ? 0 : 1}>
          {confirm ? (
            <Text color={COLOR.warn} wrap="truncate-end">
              {`Delete '${cleanText(confirm.title)}'?  y Delete  ${ICON.dot}  esc Keep`}
            </Text>
          ) : renaming ? (
            <>
              <Text dimColor>{`${ICON.pointer} `}</Text>
              <TextField
                defaultValue={newTrackTitle}
                placeholder="New title…"
                onChange={setNewTrackTitle}
                onSubmit={handleRenameSubmit}
              />
            </>
          ) : (
            <>
              <Text dimColor>{`${ICON.pointer} `}</Text>
              {focused && editing ? (
                <TextField
                  defaultValue={q}
                  placeholder="Search by name…"
                  onChange={setQ}
                  onSubmit={() => setEditing(false)}
                />
              ) : (
                <Text dimColor>{q || "Press / to search…"}</Text>
              )}
            </>
          )}
        </Box>
      ) : null}
      {searching && visible.length === 0 ? (
        <Text dimColor>No matches.</Text>
      ) : (
        <SongList
          key={JSON.stringify([browseMode, collectionId, filter, q])}
          groups={groups}
          action={action}
          playingId={playingId}
          focused={focused && !editing && !confirm && !renaming}
          reserveRows={reserveRows}
          deleteTargetsPlaying
          onDelete={browsingCollections ? undefined : handleDelete}
          onSelect={handleSelect}
          onQueue={browsingCollections ? undefined : (id, next) => { const t = library.get(id); if (t) playback.enqueue(t, next); }}
          onQueueMany={browsingCollections ? undefined : (ids, next) => {
            const tracks = ids.map(id => library.get(id)).filter((t): t is Track => !!t);
            playback.enqueueMany(tracks, next);
          }}
          onRename={browsingCollections ? undefined : handleRename}
          preview={preview}
          previewWidth={contentWidth >= 100 ? 36 : 0}
        />
      )}
    </Box>
  );
}
