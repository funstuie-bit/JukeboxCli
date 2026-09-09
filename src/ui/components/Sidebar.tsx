import { Box, Text, useInput } from "ink";
import { useStore, type Section } from "../store";
import { wrapStep } from "../move";
import { playerPalette, ICON } from "../theme";

interface NavItem {
  key: Section;
  label: string;
}

const NAV: NavItem[] = [
  { key: "home", label: "Home" },
  { key: "library", label: "Library" },
  { key: "playlists", label: "Playlists" },
  { key: "history", label: "History" },
  { key: "download", label: "Download" },
  { key: "settings", label: "Settings" },
  { key: "player", label: "Now Playing" },
  { key: "queue", label: "Queue" },
  { key: "discover", label: "Discover" },
  { key: "listen", label: "Radio / URL" },
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
      {NAV.map((item, i) => {
        const selected = item.key === section;
        // Settings is a utility, so set it off from the content sections.
        const pinned = item.key === "settings";
        return (
          <Box key={item.key} marginTop={pinned ? 1 : 0}>
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
              {`${i === 0 ? "H" : i} ${item.label}`}
            </Text>
            {item.key === "download" && active > 0 ? (
              <Text color={COLOR.muted}>{` (${active})`}</Text>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}
