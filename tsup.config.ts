import { defineConfig } from "tsup";
import { cp, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export default defineConfig({
  entry: { app: "src/index.tsx" },
  format: ["esm"],
  target: "node22",
  platform: "node",
  // Dependencies stay external (resolved from node_modules at runtime): the
  // runtime dependencies are pure-JS packages, and an unbundled build keeps
  // stack traces readable and the publish simple. One exception: @inkjs/ui
  // lives in devDependencies so tsup inlines it, because upstream imports
  // react without declaring it and pnpm's strict linking crashes on that
  // missing edge (issue #7); bundled, the broken import disappears from the
  // installed artifact while react/ink stay external and declared here.
  banner: { js: "#!/usr/bin/env node" },
  clean: true,
  sourcemap: false,
  dts: false,
  splitting: false,
  shims: false,
  minify: true,
  async onSuccess() {
    // ESM static imports run before a module body: use a separate launcher so
    // external React/Ink select production before any UI dependency is loaded.
    await writeFile("dist/index.js", '#!/usr/bin/env node\nprocess.env.NODE_ENV = "production";\nawait import("./app.js");\n', { mode: 0o755 });
    await cp("native/linux-visualizer", "dist/native/linux-visualizer", { recursive: true });
    await cp("native/macos-visualizer", "dist/native/macos-visualizer", { recursive: true });
    await cp("native/platform-events", "dist/native/platform-events", { recursive: true });
    if (process.platform === "darwin") {
      try { await promisify(execFile)("xcrun", ["clang", "-fobjc-arc", "-fblocks", "-O2", "native/platform-events/main.m", "-framework", "Foundation", "-framework", "IOKit", "-framework", "CoreAudio", "-o", "dist/native/platform-events/watch"], { timeout: 30_000 }); }
      catch { console.warn("Optional platform-events helper could not be built; manual player controls remain available."); }
    }
  },
  esbuildOptions(options) {
    options.jsx = "automatic";
    options.jsxImportSource = "react";
  },
});
