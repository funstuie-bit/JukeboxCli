// Decode a repository image through the production Sixel path without drawing it.
import assert from "node:assert/strict";
import path from "node:path";
import { loadSixelImage } from "../src/player/art";
import { ensureFfmpeg, resolvedFfmpegPath } from "../src/bin/ffmpeg-fetch";

const source = path.resolve("docs/assets/home.png");
await ensureFfmpeg();
const image = await loadSixelImage(source, 160, 120);
assert(image?.sixel, "Sixel image was not generated");
assert.equal(image.width, 160);
assert.equal(image.height, 120);
assert(image.sixel.startsWith("\x1bP0;1;0q"));
assert(image.sixel.endsWith("\x1b\\"));
console.log(`PASS: production Sixel encoder via ${resolvedFfmpegPath()} (${image.sixel.length} bytes)`);
