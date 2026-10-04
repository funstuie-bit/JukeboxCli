import { useEffect, useRef, type ReactNode } from "react";
import { Box, type DOMElement } from "ink";
import { mouseEvents, type MousePress } from "../mouse";
import { useStore } from "../store";
import { imageRect } from "./Cover";

export function MouseRow({ children, active, onClick, marginTop = 0 }: {
  children: ReactNode; active: boolean; onClick: () => void; marginTop?: number;
}) {
  const { config, captureMode } = useStore();
  const ref = useRef<DOMElement>(null);
  const callback = useRef(onClick); callback.current = onClick;
  useEffect(() => {
    if (!active || config.mouseMode !== "click" || captureMode === "text") return;
    const handler = ({ x, y }: MousePress) => {
      const rect = imageRect(ref.current);
      if (rect && x >= rect.x && x < rect.x + rect.cols && y >= rect.y && y < rect.y + rect.rows) callback.current();
    };
    mouseEvents.on("press", handler);
    return () => { mouseEvents.off("press", handler); };
  }, [active, config.mouseMode, captureMode]);
  return <Box ref={ref} marginTop={marginTop}>{children}</Box>;
}
