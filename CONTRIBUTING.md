# Contributing

You'll need macOS, Node.js 22+ and npm. Tests that play audio also need mpv and
ffmpeg on PATH; tests that resolve online audio need yt-dlp.

## Setup and verification

```sh
npm ci
npm test
npm run typecheck
npm run build
npx --no-install tsx scripts/check-dist-imports.ts
```

Vitest uses one worker and a 20-second test timeout locally and in CI.
If a test fails, fix the cause. Don't remove the assertion or skip the test to
get a green check. Add a regression test for behaviour you change, including
keyboard input through the full app where it matters.

## Keep tests isolated

Never run manual checks against your real library or profile:

```sh
JUKEBOXCLI_HOME="$HOME/JukeboxCli-contributor-test" npm run dev
```

Use generated fixtures or a new, disposable profile containing only test data.
Tests isolate their storage; real-player smoke scripts document their fixture
requirements. Do not commit cookies, credentials, direct URLs with private query
tokens, music, profiles, logs or generated personal data. Inspect screenshots,
recordings and error output before sharing them.

Playing a track is not permission to download it. Removing it from the queue is
not permission to delete the file. Keep those actions separate, and ask before
moving or deleting user data.

## Documentation

Say what works, what doesn't and what data leaves the machine. Keep commands,
key hints and install instructions accurate. Preserve upstream credits and the
MIT licence.

Keep the wording direct and practical. Use specific examples, contractions and
short paragraphs. Lists and tables are fine when they make instructions easier
to follow. Skip sales pitches, corporate language, em dashes and swearing.
Don't turn a limitation into a feature or claim testing that hasn't happened.
Technical names and commands still need to be exact.

## Generated previews

`npm run previews` renders current components with placeholder fixture data:

- [Welcome](preview/welcome.svg)
- [Library](preview/library.svg)
- [Key guide](preview/keys.svg)

These are generated documentation illustrations, not screenshots or runtime
assets. Regenerate them after relevant UI changes. `scripts/preview.tsx` provides
additional text-only fixture views. README screenshots live in `docs/assets/`;
review media for private information before replacing it.
