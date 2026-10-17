/** Kitty images live outside Ink's text buffer. Paint only after Ink has drawn,
 * preserve its cursor, and delete only the image owned by this application. */
export interface ImageRect { x: number; y: number; cols: number; rows: number }
export interface CoverImage { png: Uint8Array; width: number; height: number; sixel?: string }
const ESC = "\x1b";
const ID = 197704;
export const graphicsQuery = `${ESC}[16t${ESC}[c${ESC}_Gi=${ID},s=1,v=1,a=q,t=d,f=24;AAAA${ESC}\\`;
export let cellAspect = 0.5;
export let cellWidth = 8;
export let cellHeight = 16;
export type GraphicsProtocol = "kitty" | "iterm" | "sixel";
export let graphicsProtocol: GraphicsProtocol = "kitty";
/** Native Terminal defaults to a drawing; block artwork remains an explicit opt-in. */
export function simpleArtwork(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.JUKEBOXCLI_ART === "simple" ||
    (!graphicsPainter && env.TERM_PROGRAM === "Apple_Terminal" && env.JUKEBOXCLI_ART !== "blocks");
}
export const inlineQuery = `${ESC}]1337;Capabilities${ESC}\\${ESC}]1337;ReportCellSize${ESC}\\`;
export function supportsInline(features: string): boolean {
  const codes: string[] = features.match(/^[A-Za-z0-9]*/)?.[0].match(/[A-Z][a-z]*[0-9]*/g) ?? [];
  return codes.includes("F");
}
export function inlineImage(image: CoverImage, rect: ImageRect): string {
  if (image.png.length > 740000) return ""; // Defensive cap; decoder normally produces <=480px RGB.
  return `${ESC}7${ESC}[${rect.y + 1};${rect.x + 1}H${ESC}]1337;File=inline=1;size=${image.png.length};width=${rect.cols};height=${rect.rows};preserveAspectRatio=1:${Buffer.from(image.png).toString("base64")}\x07${ESC}8`;
}
const deleteImageId = (id: number) => `${ESC}_Ga=d,d=I,i=${id},q=2${ESC}\\`;
export const deleteImage = deleteImageId(ID);
export function imagePackets(png: Uint8Array, id = ID): string {
  const encoded = Buffer.from(png).toString("base64");
  const chunks: string[] = [];
  for (let at = 0; at < encoded.length; at += 4096) {
    chunks.push(`${ESC}_G${at === 0 ? `a=t,f=100,t=d,i=${id},q=2,` : ""}m=${at + 4096 < encoded.length ? 1 : 0};${encoded.slice(at, at + 4096)}${ESC}\\`);
  }
  return chunks.join("");
}
export function imagePlacement(rect: ImageRect, id = ID): string {
  // Give only the width: Kitty computes height from the source aspect ratio.
  return `${ESC}7${ESC}[${rect.y + 1};${rect.x + 1}H${ESC}_Ga=p,i=${id},p=1,c=${rect.cols},C=1,q=2${ESC}\\${ESC}8`;
}
export function sixelPlacement(image: CoverImage, rect: ImageRect): string {
  return image.sixel ? `${ESC}7${ESC}[${rect.y + 1};${rect.x + 1}H${image.sixel}${ESC}8` : "";
}

/** Probe before Ink owns stdin. Never infer support from the terminal's name. */
export async function probeGraphics(input = process.stdin, output = process.stdout): Promise<boolean> {
  if (!input.isTTY || !output.isTTY || process.env.TMUX || process.env.STY || ["blocks", "simple"].includes(process.env.JUKEBOXCLI_ART ?? "")) return false;
  const wasRaw = input.isRaw;
  graphicsProtocol = "kitty";
  const inline = process.env.JUKEBOXCLI_ART === "iterm" || process.env.TERM_PROGRAM === "iTerm.app" || supportsInline(process.env.TERM_FEATURES ?? "");
  let inlineSupported = process.env.JUKEBOXCLI_ART === "iterm" || supportsInline(process.env.TERM_FEATURES ?? "");
  input.setRawMode(true);
  return new Promise(resolve => {
    let buffer = "";
    let negotiated = false;
    const finish = (supported: boolean) => {
      clearTimeout(timer); input.off("data", onData); input.pause(); input.setRawMode(wasRaw);
      // Preserve early user keystrokes, excluding complete protocol replies.
      const rest = buffer.replace(/\x1b_G[^\x1b]*(?:\x1b\\|$)/g, "").replace(/\x1b\[6;\d+;\d+t/g, "").replace(/\x1b\[\?[\d;]*c/g, "").replace(/\x1b\]1337;(?:Capabilities|ReportCellSize)[^\x07\x1b]*(?:\x07|\x1b\\|$)/g, "");
      if (rest) input.unshift(Buffer.from(rest));
      // Ink is launched with incremental rendering, so unchanged Sixel rows
      // are left alone while the player and visualizer update around them.
      resolve(supported);
    };
    const onData = (data: Buffer | string) => {
      buffer += data.toString();
      const cell = buffer.match(/\x1b\[6;(\d+);(\d+)t/);
      const inlineCell = buffer.match(/\x1b\]1337;ReportCellSize=([\d.]+);([\d.]+)(?:;[\d.]+)?(?:\x07|\x1b\\)/);
      const ratio = cell ? Number(cell[2]) / Number(cell[1]) : inlineCell ? Number(inlineCell[2]) / Number(inlineCell[1]) : 0;
      if (cell) { cellHeight = Number(cell[1]); cellWidth = Number(cell[2]); }
      const features = buffer.match(/\x1b\]1337;Capabilities=([^\x07\x1b]*)(?:\x07|\x1b\\)/);
      if (features) inlineSupported = supportsInline(features[1]!);
      // Older iTerm2 predates feature reporting. Require its live cell-size
      // response as well as its identity, never the environment name alone.
      else if (inlineCell && process.env.TERM_PROGRAM === "iTerm.app") inlineSupported = true;
      negotiated = false;
      if (inlineSupported && ratio >= 0.1 && ratio <= 2) {
        cellAspect = ratio; graphicsProtocol = "iterm"; negotiated = true; return;
      }
      if (buffer.includes(`${ESC}_Gi=${ID};OK${ESC}\\`) && ratio >= 0.1 && ratio <= 2) {
        cellAspect = ratio; graphicsProtocol = "kitty"; negotiated = true; if (!inline) finish(true);
      }
      const attributes = buffer.match(/\x1b\[\?([\d;]+)c/)?.[1]?.split(";") ?? [];
      if (!negotiated && attributes.includes("4") && ratio >= 0.1 && ratio <= 2) {
        cellAspect = ratio; graphicsProtocol = "sixel"; negotiated = true;
      }
    };
    const timer = setTimeout(() => finish(negotiated), 700);
    input.on("data", onData); input.resume(); output.write(graphicsQuery + (inline ? inlineQuery : ""));
  });
}

interface ImageTarget { image: CoverImage; rect: () => ImageRect | null; id: number }
interface PaintedImage { image: CoverImage; rect: ImageRect }
export class GraphicsPainter {
  private targets = new Set<ImageTarget>();
  private painted = new Map<ImageTarget, PaintedImage>();
  private nextId = ID;
  private cellImagesDirty = false;
  get status() {
    const last = [...this.painted.values()].at(-1);
    return { visible: Boolean(last), rect: last?.rect ?? null,
      pixels: last ? [last.image.width, last.image.height] : null, count: this.painted.size };
  }
  constructor(private readonly write: (s: string) => void, private readonly protocol: GraphicsProtocol = "kitty") {}
  set(image: CoverImage, rect: () => ImageRect | null): () => void {
    const target = { image, rect, id: this.nextId++ }; this.targets.add(target);
    this.cellImagesDirty = true;
    return () => { this.targets.delete(target); this.paint(); };
  }
  /** A changed text row can erase cell-backed Sixel pixels; restore only matching images. */
  repaintSixel(image: CoverImage): void {
    if (this.protocol !== "sixel") return;
    let dirty = false;
    for (const [target, previous] of this.painted) if (previous.image === image) {
      this.painted.delete(target); dirty = true;
    }
    if (dirty) this.paint();
    if (dirty) this.cellImagesDirty = true;
  }
  clear(): void {
    // Ink owns cell-backed image erasure; never clear stale rectangles over new text.
    if (this.protocol === "kitty") for (const target of this.painted.keys()) this.write(deleteImageId(target.id));
    this.painted.clear();
  }
  /** Commit cell images after Ink flushes any throttled text output. */
  paintAfterRender(): void {
    if (this.protocol !== "kitty" && this.cellImagesDirty) this.painted.clear();
    this.paint();
    this.cellImagesDirty = false;
  }
  paint(): void {
    const visible: { target: ImageTarget; rect: ImageRect }[] = [];
    // Newer overlapping registrations belong to the foreground player. Disjoint
    // Home covers each keep their own placement and image lifetime.
    for (const target of [...this.targets].reverse()) {
      const rect = target.rect();
      if (!rect || rect.cols < 1 || rect.rows < 1 || visible.some(other => overlaps(other.rect, rect))) continue;
      visible.push({ target, rect });
    }
    const wanted = new Set(visible.map(item => item.target));
    for (const target of this.painted.keys()) if (!wanted.has(target)) {
      if (this.protocol === "kitty") this.write(deleteImageId(target.id));
      this.painted.delete(target);
    }
    for (const { target, rect } of visible.reverse()) {
      const image = target.image, previous = this.painted.get(target);
      if (this.protocol === "kitty") {
        if (!previous) this.write(imagePackets(image.png, target.id));
        this.write(imagePlacement(rect, target.id));
      } else if (!previous || !sameRect(previous.rect, rect)) {
        this.cellImagesDirty = true;
        this.write(this.protocol === "iterm" ? inlineImage(image, rect) : sixelPlacement(image, rect));
      }
      this.painted.set(target, { image, rect });
    }
  }
}
/** Coalesce frame callbacks; Ink's onRender can run before its throttled stdout write. */
export function createGraphicsRenderer(flush: () => Promise<void>, painter: () => GraphicsPainter | undefined) {
  let pending = false, closed = false;
  let task: NodeJS.Immediate | undefined;
  return {
    onRender() {
      if (pending || closed) return;
      pending = true;
      task = setImmediate(() => {
        task = undefined;
        void (async () => {
          try { await flush(); if (!closed) painter()?.paintAfterRender(); }
          finally { pending = false; }
        })().catch(() => { /* App's waitUntilExit reports render/exit failures. */ });
      });
    },
    dispose() { closed = true; if (task) clearImmediate(task); },
  };
}
function overlaps(a: ImageRect, b: ImageRect): boolean {
  return a.x < b.x + b.cols && b.x < a.x + a.cols && a.y < b.y + b.rows && b.y < a.y + a.rows;
}
function sameRect(a: ImageRect, b: ImageRect): boolean {
  return a.x === b.x && a.y === b.y && a.cols === b.cols && a.rows === b.rows;
}
export let graphicsPainter: GraphicsPainter | undefined;
export function enableGraphics(): void {
  graphicsPainter = new GraphicsPainter(s => { process.stdout.write(s); }, graphicsProtocol);
}
