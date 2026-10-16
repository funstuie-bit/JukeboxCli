import { NAV, SIDEBAR_WIDTH } from "../navigation";
import { Box, Text } from "ink";
import { useActionInput as useInput } from "../hooks/useActionInput";
import { useStore } from "../store";
import { wrapStep } from "../move";
import { playerPalette, ICON } from "../theme";
import { navigationIcon } from "../icons";
import { MouseRow } from "./MouseRow";


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
    <Box flexDirection="column" width={SIDEBAR_WIDTH} marginRight={1}>
      {NAV.map((item) => {
        const selected = item.key === section;
        // Settings is a utility, so set it off from the content sections.
        const pinned = item.key === "settings";
        return (
          <MouseRow allowDuringText key={item.key} marginTop={pinned ? 1 : 0} active={region !== "help"}
            onClick={() => { setSection(item.key); setRegion("content"); }}>
            <Box width={2} flexShrink={0}>
              <Text color={COLOR.alt} bold>{selected ? ICON.bar : " "}</Text>
            </Box>
            <Box width={3} flexShrink={0}>
              <Text color={COLOR.alt} bold>{navigationIcon(item.key)}</Text>
            </Box>
            <Text color={selected ? COLOR.accent : COLOR.text} bold={selected}>
              {`${item.shortcut} ${item.label}`}
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
