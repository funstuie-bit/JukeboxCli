# JukeboxCli roadmap

## Current milestone: Now Playing search — dev.11

the maintainer authorised moving to the next feature after parking the visualiser. The
previously planned search panel is implemented; the maintainer tested it successfully and
approved promotion to main on 2026-09-09. S opens it from queue or lyrics, / opens it from queue only, preserving
lyrics' existing / search. l: local (also the default), s: songs, v: videos.
Enter submits then plays the selected result; A/P append/next; d explicitly
starts the existing download workflow. Esc restores queue/lyrics and selection.
Typing/results own the keyboard; ordinary transport shortcuts resume on Esc.
Requests abort on close/edit/hide; late responses are ignored. Shared client
initialisation has its existing 20-second network timeout and is not cancelled
for other consumers. Online pages deduplicate/cap at 200; local search caps at
200 and requires a narrower query beyond that. No automatic downloads.

Full App tests cover both layouts, keyboard isolation, queue actions, lyrics
restoration and 60×18 sizing. The isolated smoke-player-search.tsx harness checks
real muted mpv advancing during local search plus append/next/play/Esc. A live
Oasis Acquiesce query returned 20 playable songs and 20 playable videos through
the updated service; both offered further pages. 604 tests pass / 4 inherited
skips; typecheck/build/import guard pass. Other-Mac/terminal and end-to-end online
workflow coverage remain ongoing. Public main now includes dev.11 following
the maintainer's approval; visualiser still comes last.

## Current work: media controls and installation — authorised 2026-09-09

Dev.13 now addresses the maintainer's fresh Mac screenshots: listening-first welcome/Home,
static ASCII/Braille jukebox, branded new profiles with legacy preservation and
iTerm2 inline artwork. See [first-run notes](first-run-and-home.md). These changes
are now on main following the maintainer's explicit promotion request for other-Mac testing.
Home design approved; first-launch/iTerm2 and physical media-key acceptance remain.
Visualiser remains parked.

the maintainer authorised both. Dev.12 uses mpv's existing macOS integration, routing media
keys through JukeboxCli's full queue with safe fallback and descriptive titles;
no native helper needed. Physical keys/system presentation still need acceptance.
Independent npm-archive installer, fast-forward update script, read-only doctor,
managed Homebrew tools and source-formula packaging accompany isolated install/
reinstall checks and Intel/Apple Silicon CI. See [details and limits](mac-controls-and-install.md).
Both architecture jobs passed run34365507402, including actual Homebrew install/test.
Next is the maintainer's physical media-key/background-window and clean first-launch acceptance
using main dev.13. Latest runtime CI at 83b6fb2 passed both architectures.
Visualiser remains parked; promotion does not claim physical/GUI acceptance.

## Parked until all other work is finished: macOS visualiser

Parked explicitly by the maintainer on 2026-09-08 after testing the dotted preview: better
than blocks, but the single line still looks odd and the demo is too short.
Do not extend the demo, redesign the renderer or integrate it into Now Playing
until the other project work is finished and the maintainer agrees to revisit it.

Initial feasibility work authorised 2026-09-08: prove an mpv-native analysis tap, stereo preservation,
playback-clock alignment, pause/seek/silence behaviour, bounded memory and CPU
cost before integrating it into Now Playing. No system-audio capture permission
or extra stream download should be required. The prototype stays outside the
production player; see [visualiser prototype](visualiser-prototype.md).

## Removed from scope: separate YouTube Music sign-in

the maintainer explicitly removed separate Music sign-in/sign-out on 2026-09-08. Keep the
existing browser-cookie playback/download workflow; no new login UI, OAuth or
Keychain authentication project. Cookies do not by themselves implement Music
account APIs. Own playlists/likes and personalised radio remain unimplemented,
not a reason to reintroduce sign-in without a new explicit request.

## Original scope: search within Now Playing (now implemented above)

Added 2026-09-08 at the maintainer's request, initially non-urgent. The following original
scope informed dev.11; it does not authorise promotion to main by itself.

Bring existing local-library search, online discovery and download/queue actions
into the player, inspired by the search bar in the supplied Mousiki screenshot.

- A visible search bar in full-screen and embedded Now Playing.
- `/l: query` searches the local library, without network access.
- `/s: query` searches YouTube songs/videos using existing discovery services.
- Results temporarily occupy the lyrics/queue panel; artwork, current-track
  details and playback remain visible and uninterrupted.
- Enter plays the selection; A appends to queue; P queues next; d explicitly
  opens the existing download workflow. Playing/queueing does not download.
- Esc cancels requests and returns to the previous panel, retaining its state
  and queue selection. Clearly label the search source and result actions.

### Implementation sequence and acceptance

1. Define focus/key routing and visible local/online mode hints. The lyrics
   panel already uses `/` for lyric search: preserve access to that feature and
   resolve the conflict explicitly before implementation, not with an invisible
   or ambiguous shortcut change.
2. Reuse library/discovery services and add the temporary results panel; support
   loading, empty/error states, bounded pagination and stale-request cancellation.
3. Wire existing play/append/next/download actions, without duplicate engines,
   implicit downloads or changes to saved music from browsing.
4. Test full App input capture, Esc restoration, queue ordering, local offline
   search, online errors/cancellation and 60×18/resized terminals. Verify real
   playback continues while searching; obtain the maintainer's visual/workflow acceptance.

Other outstanding work remains tracked in [feature status](../FEATURES.md),
including the clean Mac installation matrix and releases. Visualiser work comes last;
parking it does not automatically authorise another feature or main promotion.
