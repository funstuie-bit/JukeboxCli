import { createContext, useContext, type ReactNode } from "react";
import { appearancePalette, playerBackground } from "./appearance";
import { COLOR, type PlayerPalette } from "./theme";
import type { Config } from "../config/config";
import { Box } from "ink";
import { ThemeProvider, defaultTheme, extendTheme } from "@inkjs/ui";
const Palette = createContext<PlayerPalette>(COLOR);
export const usePalette = () => useContext(Palette);
export function PaletteProvider({ config, children }: { config: Config; children: ReactNode }) {
  const colours = appearancePalette(config.playerTheme, config.appearance);
  const theme = extendTheme(defaultTheme, { components: { Spinner: { styles: { frame: () => ({color:colours.accent}) } } } });
  return <Palette.Provider value={colours}>
    <ThemeProvider theme={theme}><Box flexDirection="column" backgroundColor={playerBackground(config.appearance)}>{children}</Box></ThemeProvider>
  </Palette.Provider>;
}
