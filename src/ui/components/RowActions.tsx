import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Box, type DOMElement } from "ink";
import { ContextMenu, type ContextAction } from "./ContextMenu";
import { imageRect } from "./Cover";
import { useStore } from "../store";

type Menu = { actions: ContextAction[]; anchor: { x: number; y: number }; title: string };
const RowMenuContext = createContext<{ open: (menu: Menu) => void; menu: Menu | null; close: () => void }>({ open: () => {}, menu: null, close: () => {} });
export const useRowMenu = () => useContext(RowMenuContext);
export function RowMenuProvider({ children }: { children: ReactNode }) {
  const { section, region, captureMode, setCaptureMode } = useStore();
  const previousCapture = useRef(captureMode);
  const [menu, setMenu] = useState<Menu | null>(null);
  useEffect(() => { previousCapture.current = "none"; setMenu(null); }, [section, region]);
  useEffect(() => {
    if (!menu) return;
    setCaptureMode("menu");
    return () => setCaptureMode(previousCapture.current);
  }, [menu, setCaptureMode]);
  return <RowMenuContext.Provider value={{ menu, open: next => { previousCapture.current = captureMode; setMenu(next); }, close: () => setMenu(null) }}>{children}</RowMenuContext.Provider>;
}
/** Mounted last in the app, above every section and its artwork. */
export function RowMenuOverlay() {
  const { menu, close } = useRowMenu();
  const { cols, rows } = useStore();
  const ref = useRef<DOMElement>(null);
  const origin = imageRect(ref.current);
  return <Box ref={ref} position="absolute" left={0} top={0} width={cols} height={rows}>
    {menu ? <ContextMenu title={menu.title} width={cols} height={rows} active close={close}
      anchor={{ x: menu.anchor.x - (origin?.x ?? 0), y: menu.anchor.y - (origin?.y ?? 0) }}
      actions={menu.actions.map(action => ({ ...action, run: () => { close(); action.run(); } }))} /> : null}
  </Box>;
}
