import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, Text, type DOMElement } from "ink";
import { loadCoverArt, loadCoverImage, type CoverArt } from "../../player/art";
import { graphicsPainter, cellAspect, type CoverImage, type ImageRect } from "../../player/graphics";
import { COLOR, RULE } from "../theme";

/** Hidden ancestors must remove pixel art too (Ink's display:none only hides text). */
export function imageRect(node: DOMElement | null): ImageRect | null {
  if (!node?.yogaNode || !node.parentNode) return null;
  let x = 0, y = 0;
  for (let n: DOMElement | undefined = node; n; n = n.parentNode) {
    if (n.style.display === "none") return null;
    x += n.yogaNode?.getComputedLeft() ?? 0;
    y += n.yogaNode?.getComputedTop() ?? 0;
  }
  return { x: Math.round(x), y: Math.round(y), cols: Math.floor(node.yogaNode.getComputedWidth()), rows: Math.floor(node.yogaNode.getComputedHeight()) };
}
const hex = (rgb: readonly number[]) => `#${rgb.map(c => c.toString(16).padStart(2, "0")).join("")}`;
const Blocks = memo(function Blocks({ art }: { art: CoverArt }) {
  return <Box flexDirection="column">{Array.from({ length: art.rows }, (_, y) =>
    <Text key={y}>{art.cells.slice(y * art.cols, (y + 1) * art.cols).map((c, x) =>
      <Text key={x} color={hex(c.top)} backgroundColor={hex(c.bottom)}>▀</Text>)}</Text>)}</Box>;
});
export function Cover({ source, cols, rows, visible }: { source?: string; cols: number; rows: number; visible: boolean }) {
  const ref = useRef<DOMElement>(null);
  const [loaded, setLoaded] = useState<{ key: string; image: CoverImage | null; art: CoverArt | null }>();
  const key = `${source}:${cols}:${rows}`;
  useEffect(() => {
    if (!source || !visible) return;
    let cancelled = false;
    void (async () => {
      const image = graphicsPainter ? await loadCoverImage(source) : null;
      const art = image ? null : await loadCoverArt(source, cols, rows);
      if (!cancelled) setLoaded({ key, image, art });
    })();
    return () => { cancelled = true; };
  }, [source, key, cols, rows, visible]);
  const mine = visible && loaded?.key === key ? loaded : undefined;
  const image = mine?.image;
  useLayoutEffect(() => {
    if (!image || !graphicsPainter) return;
    const remove = graphicsPainter.set(image, () => imageRect(ref.current));
    // React effects can run after Ink's first frame callback.
    const task = setImmediate(() => graphicsPainter?.paint());
    return () => { clearImmediate(task); remove(); };
  }, [image]);
  // Fit with the probed cell dimensions; the terminal preserves pixel aspect.
  let w = cols, h = rows;
  if (image) { w = Math.min(cols, Math.max(1, Math.floor(rows * image.width / image.height / cellAspect)));
    h = Math.min(rows, Math.max(1, Math.ceil(w * image.height / image.width * cellAspect))); }
  return <Box width={cols} height={rows} alignItems="center" justifyContent="center">
    {image ? <Box ref={ref} width={w} height={h} /> : mine?.art ? <Blocks art={mine.art} /> :
      <Box width={cols} height={rows} borderStyle="round" borderColor={RULE} alignItems="center" justifyContent="center">
        <Text color={COLOR.muted}>{!visible ? "Artwork hidden · b" : !source || mine ? "No cover art" : "Loading artwork…"}</Text>
      </Box>}
  </Box>;
}
