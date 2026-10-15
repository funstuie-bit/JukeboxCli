import { defineConfig } from "tsup";
import { cp, writeFile } from "node:fs/promises";

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
    await writeFile("dist/index.js", '#!/usr/bin/env node\nprocess.env.NODE_ENV = "production";\nawait import("./app.js");\n');
    await cp("native/linux-visualizer", "dist/native/linux-visualizer", { recursive: true });
    await cp("native/macos-visualizer", "dist/native/macos-visualizer", { recursive: true });
  },
  esbuildOptions(options) {
    options.jsx = "automatic";
    options.jsxImportSource = "react";
  },
});
