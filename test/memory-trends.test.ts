import { afterEach, expect, it, vi } from "vitest";
import { memorySample, startMemoryLogging } from "../src/diagnostics/memory";
afterEach(() => vi.useRealTimers());
it("records only numeric process counters, with no user metadata", () => {
  const sample = memorySample();
  expect(sample).toMatch(/^Memory pid=\d+ uptimeSec=\d+ rssMiB=[\d.]+ heapUsedMiB=/);
  expect(sample).toContain("heapLimitMiB=");
  expect(sample).not.toContain(process.env.HOME);
});
it("skips samples during slow writes and clears its timer on stop", async () => {
  vi.useFakeTimers();
  let finish!: () => void;
  const write = vi.fn(() => new Promise<void>(r => { finish = r; }));
  const stop = startMemoryLogging(1000, write);
  await vi.advanceTimersByTimeAsync(5000);
  expect(write).toHaveBeenCalledTimes(1);
  finish(); await vi.advanceTimersByTimeAsync(1000);
  expect(write).toHaveBeenCalledTimes(2);
  stop(); finish(); await vi.advanceTimersByTimeAsync(5000);
  expect(write).toHaveBeenCalledTimes(2);
});
