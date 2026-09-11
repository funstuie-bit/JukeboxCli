import { defineConfig } from "vitest/config";

// Ink colors its frames whenever the test process looks like a TTY, so the
// plain-text assertions in test/ui.test.tsx would pass or fail depending on
// the shell running the suite. Pin rendering to plain text everywhere.
export default defineConfig({
  test: {
    // Use the same bounded, serial UI-test configuration locally and in CI.
    testTimeout: 20000,
    maxWorkers: 1,
    setupFiles: ["./test/isolate.ts"],
    env: {
      FORCE_COLOR: "0",
      // Rows flash "saved" for ~1.2s in the real app; tests were written
      // against instant clearing, so default the flash off and let the
      // linger tests turn it on explicitly.
      SOUNDCLI_LINGER_MS: "0",
    },
  },
});
