# JukeboxCli roadmap

## Next usability improvement: search within Now Playing

Added 2026-09-08 at the maintainer's request. Planned, non-urgent; not implemented.
the maintainer reports dev.10 lyrics are working. This item does not authorise a new build
or promotion to main by itself.

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
including the clean Mac installation matrix, Mac spectrum feasibility and releases.
