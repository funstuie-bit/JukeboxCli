/**
 * Supervise one download, never the player's mpv. fd 3 is a lifetime pipe from
 * JukeboxCli: EOF also cleans up if the terminal or app disappears abruptly.
 * Keep this standalone JavaScript so it works in the bundled installation.
 */
export const DOWNLOAD_RUNNER = String.raw`
const { spawn } = require('node:child_process');
const { Socket } = require('node:net');
const grouped = process.platform !== 'win32';
const child = spawn(process.argv[1], process.argv.slice(2), {
  detached: grouped, stdio: ['ignore', 'inherit', 'inherit'],
});
let stopping = false;
let timer;
const kill = signal => {
  if (!child.pid) return;
  try { if (grouped) process.kill(-child.pid, signal); else child.kill(signal); }
  catch (error) { if (error.code !== 'ESRCH') process.stderr.write('Download cleanup: ' + error.message + '\n'); }
};
const finish = code => {
  clearTimeout(timer);
  process.exit(code);
};
const stop = code => {
  if (stopping) return;
  stopping = true;
  kill('SIGTERM');
  // The leader may exit before ffmpeg. Keep the supervisor alive long enough
  // to kill any remaining members, including helpers which ignore SIGTERM.
  timer = setTimeout(() => { kill('SIGKILL'); finish(code); }, 750);
};
process.on('exit', () => kill('SIGKILL'));
process.on('SIGTERM', () => stop(143));
process.on('SIGINT', () => stop(130));
process.on('SIGHUP', () => stop(129));
child.on('error', error => { process.stderr.write(error.message + '\n'); finish(1); });
child.on('exit', (code, signal) => { if (!stopping) finish(code ?? 1); });
const lifetime = new Socket({ fd: 3, readable: true, writable: false });
lifetime.on('end', () => stop(143));
lifetime.on('error', () => stop(143));
lifetime.resume();
`;
