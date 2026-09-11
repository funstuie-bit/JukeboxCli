/** Kitty images live outside Ink's text buffer. Paint only after Ink has drawn,
 * preserve its cursor, and delete only the image owned by this application. */
export interface ImageRect { x: number; y: number; cols: number; rows: number }
export interface CoverImage { png: Uint8Array; width: number; height: number }
const ESC = "\x1b";
const ID = 197704;
export const graphicsQuery = `${ESC}[16t${ESC}_Gi=${ID},s=1,v=1,a=q,t=d,f=24;AAAA${ESC}\\`;
export let cellAspect = 0.5;
export type GraphicsProtocol = "kitty" | "iterm";
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
export const deleteImage = `${ESC}_Ga=d,d=I,i=${ID},q=2${ESC}\\`;
export function imagePackets(png: Uint8Array): string {
  const encoded = Buffer.from(png).toString("base64");
  const chunks: string[] = [];
  for (let at = 0; at < encoded.length; at += 4096) {
    chunks.push(`${ESC}_G${at === 0 ? `a=t,f=100,t=d,i=${ID},q=2,` : ""}m=${at + 4096 < encoded.length ? 1 : 0};${encoded.slice(at, at + 4096)}${ESC}\\`);
  }
  return chunks.join("");
}
export function imagePlacement(rect: ImageRect): string {
  // Give only the width: Kitty computes height from the source aspect ratio.
  return `${ESC}7${ESC}[${rect.y + 1};${rect.x + 1}H${ESC}_Ga=p,i=${ID},p=1,c=${rect.cols},C=1,q=2${ESC}\\${ESC}8`;
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
      const rest = buffer.replace(/\x1b_G[^\x1b]*(?:\x1b\\|$)/g, "").replace(/\x1b\[6;\d+;\d+t/g, "").replace(/\x1b\]1337;(?:Capabilities|ReportCellSize)[^\x07\x1b]*(?:\x07|\x1b\\|$)/g, "");
      if (rest) input.unshift(Buffer.from(rest));
      resolve(supported);
    };
    const onData = (data: Buffer | string) => {
      buffer += data.toString();
      const cell = buffer.match(/\x1b\[6;(\d+);(\d+)t/);
      const inlineCell = buffer.match(/\x1b\]1337;ReportCellSize=([\d.]+);([\d.]+)(?:;[\d.]+)?(?:\x07|\x1b\\)/);
      const ratio = cell ? Number(cell[2]) / Number(cell[1]) : inlineCell ? Number(inlineCell[2]) / Number(inlineCell[1]) : 0;
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
      } else if (!inline && new RegExp(`\\x1b_Gi=${ID};(?!OK)[^\\x1b]+\\x1b\\\\`).test(buffer)) finish(false);
    };
    const timer = setTimeout(() => finish(negotiated), 700);
    input.on("data", onData); input.resume(); output.write(graphicsQuery + (inline ? inlineQuery : ""));
  });
}

export class GraphicsPainter {
  private targets = new Set<{ image: CoverImage; rect: () => ImageRect | null }>();
  private uploaded?: CoverImage;
  private rect: ImageRect | null = null;
  get status() { return { visible: Boolean(this.uploaded), rect: this.rect, pixels: this.uploaded ? [this.uploaded.width, this.uploaded.height] : null }; }
  constructor(private readonly write: (s: string) => void, private readonly protocol: GraphicsProtocol = "kitty") {}
  set(image: CoverImage, rect: () => ImageRect | null): () => void {
    const target = { image, rect }; this.targets.add(target);
    return () => { this.targets.delete(target); this.paint(); };
  }
  clear(): void {
    // Inline images are text-cell content: Ink's full-frame redraw erases them.
    // Never erase a stale rectangle after Ink has painted new text there.
    if (this.uploaded && this.protocol === "kitty") this.write(deleteImage);
    this.uploaded = undefined;
    this.rect = null;
  }
  paint(): void {
    // An embedded player can stay mounted behind the expanded player. Keep
    // both registrations so closing the modal restores the underlying art.
    const target = [...this.targets].reverse().find(t => t.rect() !== null);
    const rect = target?.rect();
    if (!rect || rect.cols < 1 || rect.rows < 1) { this.clear(); return; }
    const image = target!.image;
    if (this.protocol === "iterm") {
      this.write(inlineImage(image, rect)); this.uploaded = image; this.rect = rect; return;
    }
    if (this.uploaded !== image) {
      this.clear(); this.write(imagePackets(image.png)); this.uploaded = image;
    }
    this.write(imagePlacement(rect));
    this.rect = rect;
  }
}
export let graphicsPainter: GraphicsPainter | undefined;
export function enableGraphics(): void {
  graphicsPainter = new GraphicsPainter(s => { process.stdout.write(s); }, graphicsProtocol);
}
