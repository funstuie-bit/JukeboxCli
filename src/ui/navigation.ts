import type { Section } from "./store";

/** Display order and fixed section shortcuts share one definition. */
interface NavItem {
  key: Section;
  label: string;
  shortcut: string;
}

export const NAV: NavItem[] = [
  { key: "home", shortcut: "H", label: "Home" },
  { key: "library", shortcut: "1", label: "Library" },
  { key: "playlists", shortcut: "2", label: "Playlists" },
  { key: "history", shortcut: "3", label: "History" },
  { key: "download", shortcut: "4", label: "Download" },
  { key: "player", shortcut: "5", label: "Now Playing" },
  { key: "queue", shortcut: "6", label: "Queue" },
  { key: "discover", shortcut: "7", label: "Music Discover" },
  { key: "listen", shortcut: "8", label: "Radio / URL" },
  { key: "videos", shortcut: "Y", label: "YouTube Videos" },
  { key: "settings", shortcut: "9", label: "Settings" },
];
