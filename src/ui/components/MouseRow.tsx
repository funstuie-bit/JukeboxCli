import { useEffect, useRef, type ReactNode } from "react";
import { Box, type DOMElement } from "ink";
import { mouseEvents, type MousePress } from "../mouse";
import { useStore } from "../store";
import { imageRect } from "./Cover";

export function MouseRow({ children, active, onClick, onContextMenu, marginTop = 0, width }: {
  children: ReactNode; active: boolean; onClick: (fraction: number) => void; onContextMenu?: () => void; marginTop?: number; width?: number;
}) {
  const { config, captureMode } = useStore();
  const ref = useRef<DOMElement>(null);
  const callback = useRef(onClick); callback.current = onClick;
  const contextCallback = useRef(onContextMenu); contextCallback.current = onContextMenu;
  useEffect(() => {
    if (!active || config.mouseMode !== "click" || captureMode === "text") return;
    const handler = ({ x, y, button }: MousePress) => {
      const rect = imageRect(ref.current);
      if (rect && x >= rect.x && x < rect.x + rect.cols && y >= rect.y && y < rect.y + rect.rows) {
        if (button === "right") contextCallback.current?.();
        else callback.current(rect.cols <= 1 ? 0 : (x - rect.x) / (rect.cols - 1));
      }
    };
    mouseEvents.on("press", handler);
    return () => { mouseEvents.off("press", handler); };
  }, [active, config.mouseMode, captureMode]);
  return <Box ref={ref} marginTop={marginTop} width={width}>{children}</Box>;
}
