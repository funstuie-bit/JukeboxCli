// No network, audio or real user profile. q exits; --auto exits after five seconds.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { useEffect } from "react";
import { Box, render, useApp, useInput, useStdout } from "ink";
process.env.JUKEBOXCLI_HOME = mkdtempSync(path.join(tmpdir(), "jukeboxcli-home-visual-"));
const { makeStore } = await import("./fake-data");
const { StoreContext } = await import("../src/ui/store");
const { Home } = await import("../src/ui/sections/Home");
function Demo() {
  const { stdout } = useStdout(), { exit } = useApp();
  useInput(input => { if (input === "q") exit(); });
  useEffect(() => { if (!process.argv.includes("--auto")) return; const timer = setTimeout(exit, 5000); return () => clearTimeout(timer); }, [exit]);
  const store = makeStore({ cols: stdout.columns || 80, rows: stdout.rows || 30 });
  return <StoreContext.Provider value={store}><Box paddingX={1}><Home firstRun /></Box></StoreContext.Provider>;
}
render(<Demo />);
