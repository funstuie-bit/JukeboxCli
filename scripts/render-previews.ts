// Entry point for the SVG previews. chalk decides its color support the
// moment it's evaluated, so FORCE_COLOR must be set before anything that
// transitively imports ink/chalk loads; the dynamic import defeats ESM
// hoisting. Run with: npm run previews
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
process.env.FORCE_COLOR = "3";
delete process.env.NO_COLOR;
process.env.JUKEBOXCLI_SYSTEM_TOOLS = "1";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// Components may read saved stations. Never let fixture previews read a real profile.
process.env.JUKEBOXCLI_HOME = mkdtempSync(path.join(os.tmpdir(), "jukeboxcli-previews-"));
await import("./render-previews-impl");

export {};
