import { useRowMenu } from "./RowActions";
import type { ContextAction } from "./ContextMenu";
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Box, type DOMElement } from "ink";
import { mouseEvents, type MousePress } from "../mouse";
import { StoreContext } from "../store";
import { imageRect } from "./Cover";

export function MouseRow({ children, active, onClick, onDrag, onContextMenu, marginTop = 0, width, allowDuringText = false, menuActions, menuTitle = "Actions", allowDuringMenu = false }: {
  menuActions?: ContextAction[]; menuTitle?: string; allowDuringMenu?: boolean; children: ReactNode; active: boolean; onClick: (fraction: number) => void; onDrag?: (fraction: number) => void; onContextMenu?: (point: { x: number; y: number }) => void; marginTop?: number; width?: number; allowDuringText?: boolean;
}) {
  const rowMenu = useRowMenu();
  const menuRef = useRef({ rowMenu, menuActions, menuTitle }); menuRef.current = { rowMenu, menuActions, menuTitle };
  const store = useContext(StoreContext);
  const config = store?.config;
  const captureMode = store?.captureMode;
  const ref = useRef<DOMElement>(null);
  const [hovered, setHovered] = useState(false);
  const callback = useRef(onClick); callback.current = onClick;
  const dragCallback = useRef(onDrag); dragCallback.current = onDrag;
  const contextCallback = useRef(onContextMenu); contextCallback.current = onContextMenu;
  useEffect(() => {
    if (!active || (!allowDuringMenu && (rowMenu.menu || captureMode === "menu")) || config?.mouseMode !== "click" || (captureMode === "text" && !allowDuringText)) { setHovered(false); return; }
    let dragging = false;
    let pending: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => { clearTimeout(timer); timer = undefined; if (pending !== undefined) { dragCallback.current?.(pending); pending = undefined; } };
    const drag = (event: MousePress, release = false) => {
      if (!dragging) return;
      const rect = imageRect(ref.current); if (!rect) return;
      event.handled = true;
      pending = Math.max(0, Math.min(1, rect.cols <= 1 ? 0 : (event.x - rect.x) / (rect.cols - 1)));
      if (release) { dragging = false; flush(); } else timer ??= setTimeout(flush, 60);
    };
    const move = (event: MousePress) => {
      const rect = imageRect(ref.current);
      setHovered(!!rect && event.x >= rect.x && event.x < rect.x + rect.cols && event.y >= rect.y && event.y < rect.y + rect.rows);
      drag(event);
    };
    const release = (event: MousePress) => drag(event, true);
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
        } else { dragging = !!dragCallback.current; event.handled = true; callback.current(rect.cols <= 1 ? 0 : (x - rect.x) / (rect.cols - 1)); }
      }
    };
    mouseEvents.on("press", handler);
    mouseEvents.on("move", move); mouseEvents.on("release", release);
    return () => { clearTimeout(timer); mouseEvents.off("press", handler); mouseEvents.off("move", move); mouseEvents.off("release", release); };
  }, [active, config?.mouseMode, captureMode, allowDuringText, allowDuringMenu, rowMenu.menu]);
  return <Box ref={ref} marginTop={marginTop} width={width} backgroundColor={hovered ? "#232a38" : undefined}>{children}</Box>;
}
