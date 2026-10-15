// Exercise the actual packaged entry before loading React, as a fresh CLI does.
// Keep development-mode unit tests separate from this production smoke check.
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
process.env.NODE_ENV = 'development';
process.argv = [process.execPath, 'dist/index.js', '--version'];
await import('../dist/index.js');
assert.equal(process.env.NODE_ENV, 'production');
const { default: React } = await import('react');
const { render, Text } = await import('ink');
const stdout = new PassThrough();
stdout.columns = 80;
stdout.rows = 24;
stdout.on('data', () => {});
const stdin = new PassThrough();
const before = performance.getEntriesByType('measure').length;
const app = render(React.createElement(Text, null, 'start'), {
  stdout, stdin, stderr: stdout, exitOnCtrlC: false, patchConsole: false,
});
try {
  for (let frame = 0; frame < 600; frame++) {
    app.rerender(React.createElement(Text, null, String(frame)));
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(performance.getEntriesByType('measure').length, before,
    'Packaged redraws must not accumulate React development performance entries');
} finally {
  app.unmount();
  stdout.destroy();
  stdin.destroy();
}
console.log('check-production-runtime: 600 redraws, no retained performance entries');
