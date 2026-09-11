# Contributing

Use macOS, Node.js 22+ and npm. Real playback smoke tests also need mpv and
ffmpeg on PATH; online extraction needs yt-dlp.

## Setup and verification

```sh
npm ci
npm test
npm run typecheck
npm run build
npx --no-install tsx scripts/check-dist-imports.ts
```

Vitest uses one worker and a 20-second test timeout locally and in CI.
Do not disable assertions or skip tests to hide failures. Runtime changes need
focused regression tests, including full-App keyboard behaviour where relevant.

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

Playing/queueing and downloading are separate actions. Preserve that distinction
and do not make migrations or deletion implicit.

## Documentation

Describe current behaviour, limitations and privacy boundaries rather than
development history. Keep CLI examples, key hints and install instructions in
sync. Preserve upstream attribution and the MIT licence.

## Generated previews

`npm run previews` renders current components with placeholder fixture data:

- [Welcome](preview/welcome.svg)
- [Library](preview/library.svg)
- [Key guide](preview/keys.svg)

These are generated documentation illustrations, not screenshots or runtime
assets. Regenerate them after relevant UI changes. `scripts/preview.tsx` provides
additional text-only fixture views. README screenshots live in `docs/assets/`;
review media for private information before replacing it.
