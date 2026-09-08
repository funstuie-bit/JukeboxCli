import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Each test file gets independent persistence. Do not remove while debounced
// writes may still be pending; the OS temporary-directory cleanup owns these.
process.env.JUKEBOXCLI_HOME = mkdtempSync(join(tmpdir(), "jukeboxcli-test-"));
