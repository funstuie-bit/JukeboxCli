import { Box, Text } from "ink";
import { useActionInput as useInput } from "../hooks/useActionInput";
import { useStore, type Section } from "../store";
import { wrapStep } from "../move";
import { playerPalette, ICON } from "../theme";
import { navigationIcon } from "../icons";
import { MouseRow } from "./MouseRow";

interface NavItem {
  key: Section;
  label: string;
  shortcut: string;
}

const NAV: NavItem[] = [
  { key: "home", shortcut: "H", label: "Home" },
  { key: "library", shortcut: "1", label: "Library" },
  { key: "playlists", shortcut: "2", label: "Playlists" },
  { key: "history", shortcut: "3", label: "History" },
  { key: "download", shortcut: "4", label: "Download" },
  { key: "player", shortcut: "6", label: "Now Playing" },
  { key: "queue", shortcut: "7", label: "Queue" },
  { key: "discover", shortcut: "8", label: "Music Discover" },
  { key: "listen", shortcut: "9", label: "Radio / URL" },
  { key: "videos", shortcut: "Y", label: "YouTube Videos" },
  { key: "settings", shortcut: "5", label: "Settings" },
];

export function Sidebar() {
  const { section, setSection, region, setRegion, queue, config } = useStore();
  const COLOR = playerPalette(config.playerTheme);
  const focused = region === "sidebar";
  const idx = NAV.findIndex((n) => n.key === section);
  const active = queue.activeCount;

  useInput(
    (_input, key) => {
      if (key.upArrow) setSection(NAV[wrapStep(idx, -1, NAV.length)]!.key);
      else if (key.downArrow)
        setSection(NAV[wrapStep(idx, 1, NAV.length)]!.key);
      else if (key.return) setRegion("content");
    },
    { isActive: focused },
  );

  return (
    <Box flexDirection="column" width={20} marginRight={1}>
      {NAV.map((item) => {
        const selected = item.key === section;
        // Settings is a utility, so set it off from the content sections.
        const pinned = item.key === "settings";
        return (
          <MouseRow allowDuringText key={item.key} marginTop={pinned ? 1 : 0} active={region !== "help"}
            onClick={() => { setSection(item.key); setRegion("content"); }}>
            {selected ? (
              // The lit edge: the marker takes the ramp's sunlit end while the
              // label stays brand flame, a subtle two-tone glow.
              <Text color={COLOR.alt} bold={focused}>{`${ICON.bar} `}</Text>
            ) : (
              <Text>{"  "}</Text>
            )}
            <Text
              color={selected ? COLOR.accent : COLOR.muted}
              bold={selected && focused}
            >
              {`${navigationIcon(item.key)} ${item.shortcut} ${item.label}`}
            </Text>
            {item.key === "download" && active > 0 ? (
              <Text color={COLOR.muted}>{` (${active})`}</Text>
            ) : null}
          </MouseRow>
        );
      })}
    </Box>
  );
}
