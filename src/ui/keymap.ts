// Single source of truth for keyboard shortcuts. The footer shows a tiny
// context-relevant subset; the `?` overlay shows everything. Defining them once
// here means the quick hint and the full cheatsheet can never drift apart, and
// the UI never has to dump a wall of commands at the user.

import type { PlaylistsDepth, Region, Section } from "./store";

export interface Hint {
  keys: string;
  label: string;
}

interface HelpGroup {
  title: string;
  hints: Hint[];
}

/** Sidebar sections in display order, so digit keys can jump straight to one. */
const SECTION_ORDER: Section[] = [
  "library",
  "playlists",
  "history",
  "download",
  "settings",
  "player",
  "queue",
  "discover",
  "listen",
];

/** Map sidebar digit shortcuts to sections; null otherwise. */
export function sectionForDigit(input: string): Section | null {
  if (!/^[1-9]$/.test(input)) return null;
  return SECTION_ORDER[Number(input) - 1] ?? null;
}

/** The full cheatsheet, shown in the `?` overlay, grouped by intent. */
export const HELP_GROUPS: HelpGroup[] = [
  {
    title: "Navigate",
    hints: [
      { keys: "↑ ↓", label: "Move" },
      { keys: "PgUp PgDn", label: "Jump a page" },
      { keys: "↵", label: "Open / play" },
      { keys: "1-9", label: "Jump section" },
      { keys: "H", label: "Home" },
      { keys: "o", label: "Play URL (no download)" },
      { keys: "/", label: "Search" },
      { keys: "d", label: "Delete" },
      { keys: "t", label: "Rename" },
      { keys: "tab", label: "Switch pane" },
      { keys: "esc", label: "Back" },
      { keys: "q", label: "Quit" },
    ],
  },
  {
    title: "Player",
    hints: [
      { keys: "space", label: "Play / pause" },
      { keys: "← →", label: "Seek 15s" },
      { keys: ", .", label: "Seek 5s" },
      { keys: "0", label: "Restart song" },
      { keys: "n p", label: "Next / prev" },
      { keys: "r", label: "Repeat" },
      { keys: "s", label: "Shuffle" },
      { keys: "+ -", label: "Volume" },
      { keys: "m", label: "Now Playing screen" },
      { keys: "b", label: "Player: show / hide artwork" },
      { keys: "T", label: "Player: lavender / calm theme" },
      { keys: "V", label: "Player: decorative motion on / off" },
      { keys: "l", label: "Player: lyrics / queue panel" },
      { keys: "S", label: "Player search: l: local, s: songs, v: videos; Esc back" },
      { keys: "/", label: "Player queue: music search; lyrics panel: lyrics search" },
      { keys: "L", label: "Lyrics: enable / disable online lookup" },
      { keys: "↑↓ / Pg", label: "Lyrics: scroll (does not edit queue)" },
      { keys: "f", label: "Lyrics: follow timed lines again" },
      { keys: "/", label: "Lyrics: search / choose recording" },
      { keys: "R", label: "Lyrics: retry lookup" },
      { keys: "O", label: "Lyrics: other provider (plain)" },
    ],
  },
  {
    title: "Listening queue",
    hints: [
      { keys: "A", label: "Append selected song" },
      { keys: "P", label: "Queue selected song next" },
      { keys: "7", label: "Open queue" },
      { keys: "↵", label: "Queue: play selected" },
      { keys: "u D", label: "Queue: move up / down" },
      { keys: "x", label: "Queue: remove (keeps file)" },
      { keys: "X", label: "Queue: clear and stop (confirm)" },
    ],
  },
  {
    title: "Discover (YouTube Music)",
    hints: [
      { keys: "8 /", label: "Open Discover / search" },
      { keys: "[ ]", label: "Song / video / album / artist / playlist" },
      { keys: "↵", label: "Stream song or browse collection" },
      { keys: "A P", label: "Append / queue next" },
      { keys: "d", label: "Download selected song" },
      { keys: "L", label: "Load more results" },
      { keys: "esc", label: "Back / cancel loading" },
    ],
  },
  {
    title: "Radio / URL (9)",
    hints: [
      { keys: "o", label: "YouTube / website / audio URL" },
      { keys: "R", label: "Detect radio website / feed / playlist" },
      { keys: "↵", label: "Accept link, then play selected" },
      { keys: "A P", label: "Append / queue next" },
      { keys: "f / t", label: "Save / rename radio favourite" },
      { keys: "x / d", label: "Remove favourite (confirm) / new link" },
      { keys: "g", label: "Refresh artwork from station website" },
      { keys: "space", label: "Live: disconnect / reconnect" },
    ],
  },
  {
    title: "Downloads",
    hints: [
      { keys: "[ ]", label: "Pause / resume all" },
      { keys: "c", label: "Cancel all" },
      { keys: "↵", label: "Dismiss done" },
      { keys: "f", label: "Retry failed" },
      { keys: "space", label: "Pick: toggle row" },
    ],
  },
];

const ALWAYS: Hint = { keys: "?", label: "Keys" };
const PLAYER: Hint = { keys: "m", label: "Player" };
export const PLAYER_HINTS: Hint[] = [
  { keys: "m/esc", label: "Back" }, { keys: "space", label: "Pause" },
  { keys: "← →", label: "Seek" }, { keys: "l", label: "Lyrics" }, { keys: "b", label: "Artwork" }, { keys: "v", label: "Visualizer" }, { keys: "T/V", label: "Look/motion" }, { keys: "7", label: "Queue" }, ALWAYS,
];
// tab is the one movement key the arrows can't cover (they belong to lists
// and seeking), so every footer variant advertises it under the same name.
const PANE: Hint = { keys: "tab", label: "Pane" };

/**
 * The handful of hints worth showing inline for the current focus. Always ends
 * with "? Keys" so the full set is one keystroke away without crowding the bar.
 */
export function footerHints(
  region: Region,
  section: Section,
  playlistsDepth: PlaylistsDepth = "sets",
): Hint[] {
  if (region === "sidebar") {
    return [
      { keys: "↑↓", label: "Move" },
      { keys: "↵", label: "Open" },
      PANE,
      PLAYER,
      ALWAYS,
      { keys: "q", label: "Quit" },
    ];
  }
  // In content, esc only mirrors tab (back to the sidebar), so the hint slot
  // goes to tab; esc appears only where it means something else (songs depth).
  switch (section) {
    case "home":
      return [{ keys: "↑↓", label: "Choose" }, { keys: "↵", label: "Open" }, PANE, PLAYER, ALWAYS];
    case "listen":
      return [{ keys: "o", label: "Play URL" }, { keys: "R", label: "Radio URL" },
        { keys: "x/d", label: "Remove" }, { keys: "g", label: "Artwork" }, { keys: "f/t", label: "Save/rename" }, ALWAYS];
    case "discover":
      return [{ keys: "/", label: "Search" }, { keys: "↵", label: "Stream" },
        { keys: "o", label: "Play URL" }, { keys: "A/P", label: "Queue" }, ALWAYS];
    case "player":
      return [{ keys: "l", label: "Lyrics/queue" }, { keys: "← →", label: "Seek" }, PANE, PLAYER, ALWAYS];
    case "queue":
      return [{ keys: "↵", label: "Play" }, { keys: "u D", label: "Move" },
        { keys: "x", label: "Remove" }, PANE, PLAYER, ALWAYS];
    case "settings":
      return [
        { keys: "↵", label: "Choose" },
        PANE,
        ALWAYS,
      ];
    case "download":
      // Download explains ↵ contextually in-section (choose / pause-resume), so
      // the footer stays neutral and never contradicts the in-list legend.
      return [
        PANE,
        ALWAYS,
      ];
    case "playlists":
      if (playlistsDepth === "songs") {
        return [
          { keys: "↵", label: "Play" },
          { keys: "/", label: "Search" },
          { keys: "d", label: "Delete" },
          { keys: "t", label: "Rename" },
          { keys: "esc", label: "Back" },
          PANE,
          ALWAYS,
        ];
      }
      return [
        { keys: "↵", label: "Open" },
        { keys: "/", label: "Search" },
        { keys: "[ ]", label: "Source" },
        { keys: "d", label: "Delete" },
        { keys: "t", label: "Rename" },
        PANE,
        ALWAYS,
      ];
    case "history":
      return [
        { keys: "↵", label: "Play" },
        { keys: "/", label: "Search" },
        { keys: "[ ]", label: "Source" },
        { keys: "d", label: "Delete" },
        PANE,
        ALWAYS,
      ];
    case "library":
      return [
        { keys: "↵", label: "Play" },
        { keys: "/", label: "Search" },
        { keys: "[ ]", label: "Source" },
        { keys: "d", label: "Delete" },
        { keys: "t", label: "Rename" },
        PANE,
        ALWAYS,
      ];
  }
}
