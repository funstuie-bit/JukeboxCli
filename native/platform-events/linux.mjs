// Own the monitor and stop it on parent-pipe EOF, including an abrupt app exit.
import { spawn } from 'node:child_process';
const monitor = spawn('dbus-monitor', ['--system', "type='signal',interface='org.freedesktop.login1.Manager',member='PrepareForSleep'"], { stdio: ['ignore', 'pipe', 'ignore'] });
let pending = '';
const emit = type => process.stdout.write(JSON.stringify({ type }) + '\n');
monitor.on('error', () => { emit('unavailable'); process.exit(1); });
monitor.on('spawn', () => emit('ready-linux'));
monitor.stdout.on('data', chunk => {
  pending = (pending + chunk).slice(-8192);
  const lines = pending.split('\n'); pending = lines.pop() ?? '';
  for (const line of lines) {
    if (/^\s*boolean true\s*$/.test(line)) emit('sleep');
    if (/^\s*boolean false\s*$/.test(line)) emit('wake');
  }
});
const stop = () => { monitor.kill('SIGTERM'); setTimeout(() => { monitor.kill('SIGKILL'); process.exit(); }, 500).unref(); };
process.stdin.resume(); process.stdin.on('end', stop); process.on('SIGTERM', stop); process.on('SIGINT', stop);
process.stdout.on('error', stop);
monitor.on('exit', () => process.exit());
