import { useRowMenu } from "./RowActions";
import type { ContextAction } from "./ContextMenu";
import { useContext, useEffect, useRef, type ReactNode } from "react";
import { Box, type DOMElement } from "ink";
import { mouseEvents, type MousePress } from "../mouse";
import { StoreContext } from "../store";
import { imageRect } from "./Cover";

export function MouseRow({ children, active, onClick, onContextMenu, marginTop = 0, width, allowDuringText = false, menuActions, menuTitle = "Actions", allowDuringMenu = false }: {
  menuActions?: ContextAction[]; menuTitle?: string; allowDuringMenu?: boolean; children: ReactNode; active: boolean; onClick: (fraction: number) => void; onContextMenu?: (point: { x: number; y: number }) => void; marginTop?: number; width?: number; allowDuringText?: boolean;
}) {
  const rowMenu = useRowMenu();
  const menuRef = useRef({ rowMenu, menuActions, menuTitle }); menuRef.current = { rowMenu, menuActions, menuTitle };
  const store = useContext(StoreContext);
  const config = store?.config;
  const captureMode = store?.captureMode;
  const ref = useRef<DOMElement>(null);
  const callback = useRef(onClick); callback.current = onClick;
  const contextCallback = useRef(onContextMenu); contextCallback.current = onContextMenu;
  useEffect(() => {
    if (!active || (!allowDuringMenu && (rowMenu.menu || captureMode === "menu")) || config?.mouseMode !== "click" || (captureMode === "text" && !allowDuringText)) return;
    const handler = (event: MousePress) => {
      if (event.handled) return;
      const { x, y, button } = event;
      const rect = imageRect(ref.current);
      if (rect && x >= rect.x && x < rect.x + rect.cols && y >= rect.y && y < rect.y + rect.rows) {
        if (button === "right") {
          if (menuRef.current.menuActions?.length) {
            event.handled = true;
            menuRef.current.rowMenu.open({ actions: menuRef.current.menuActions, title: menuRef.current.menuTitle, anchor: { x, y } });
          } else if (contextCallback.current) {
            event.handled = true;
            contextCallback.current({ x: x - rect.x, y: y - rect.y });
          }
        } else { event.handled = true; callback.current(rect.cols <= 1 ? 0 : (x - rect.x) / (rect.cols - 1)); }
      }
    };
    mouseEvents.on("press", handler);
    return () => { mouseEvents.off("press", handler); };
  }, [active, config?.mouseMode, captureMode, allowDuringText, allowDuringMenu, rowMenu.menu]);
  return <Box ref={ref} marginTop={marginTop} width={width}>{children}</Box>;
}
