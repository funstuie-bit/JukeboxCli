import { getHeapStatistics } from "node:v8";
import { logEvent } from "./log";

export function memorySample(): string {
  const m = process.memoryUsage();
  const mib = (bytes: number) => Math.round(bytes / 1048576 * 10) / 10;
  return `Memory pid=${process.pid} uptimeSec=${Math.round(process.uptime())} rssMiB=${mib(m.rss)} heapUsedMiB=${mib(m.heapUsed)} heapTotalMiB=${mib(m.heapTotal)} heapLimitMiB=${mib(getHeapStatistics().heap_size_limit)} externalMiB=${mib(m.external)} arrayBuffersMiB=${mib(m.arrayBuffers)}`;
}

/** One outstanding write at most; no growing sample array or promise backlog. */
export function startMemoryLogging(intervalMs = 60_000, write = logEvent): () => void {
  let pending = false, stopped = false;
  const sample = () => {
    if (pending || stopped) return;
    pending = true;
    void write("app", memorySample()).catch(() => {}).finally(() => { pending = false; });
  };
  sample();
  const timer = setInterval(sample, intervalMs);
  timer.unref();
  return () => { stopped = true; clearInterval(timer); };
}
