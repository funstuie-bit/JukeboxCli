import { describe, expect, it } from "vitest";
import { execa } from "execa";
import { parseCliArgs } from "../src/cli/args";
describe("installation entry points", () => {
  it("parses doctor without opening the player", () => expect(parseCliArgs(["--doctor"])).toEqual({ kind: "doctor" }));
  it("rejects unknown options and relative prefixes before any install", async () => {
    for (const args of [["--bad"], ["--prefix"], ["--prefix", "relative"]]) {
      const result = await execa("sh", ["install.sh", ...args], { reject: false });
      expect(result.exitCode).toBe(2); expect(result.stdout).not.toContain("Installing dependencies");
    }
  });
});
