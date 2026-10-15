# Audio and video playback

Source preview 1.6.0-dev.5; stable release/Homebrew remain 1.5.0.

Choose **YouTube Videos** in the sidebar or press **Y** (Shift+y) outside a text
field. On first visit the search field is ready to type into. Submit a query,
select a result and press **Enter to play video**, or **a for audio only**.
The query stays visible; `/` or clicking it in click mouse mode edits it.
Escape leaves typing. `L` loads more results. Searching does not play anything.

**Music Discover** remains on `8`, with YouTube Music's song/music-video/album/
artist/playlist filters and Enter for audio. Each section retains its own query,
results and selection when you leave and return during this app session. This
browsing state is held in memory, not saved across application restarts.
Player search's existing `v:` shortcut still searches music videos.

Video results have title, channel and duration columns when space permits,
otherwise a compact list. `▶` means video, `●` plus LIVE means live, and `✓` means
already queued. Music browsing uses `♫`. No special icon font is required.
`TERM=dumb` or `JUKEBOXCLI_ICONS=ascii` uses plain symbols instead.

In either section, `c` or right-click in click mouse mode opens Play audio,
Play video, Play next, Add to queue, Download or Details. Choose using arrows /
Enter or a left click; Escape dismisses. Downloads use the existing audio flow.
Details remain an explicit action; a persistent preview pane is deferred.

Video opens a separate mpv window. In Player (`m`), `W` switches the current item
between audio and video (rebindable in Settings). Existing transport, seeking
and volume still control the same mpv process. The change reloads the stream,
so there is a brief interruption; it retains pause, volume and the recorded
position when seekable. Live and non-seekable sources reconnect without seeking.

Closing the video window stops the current item, keeps the queue, and leaves
JukeboxCli running. Choose another queue row to play again. Following queue
entries, session restoration and Enter in Music Discover default to audio; Enter in YouTube Videos explicitly
requests video.
No second audio player is started, and existing parent-exit cleanup remains.

Video requires mpv and a source containing a video track. A failed video request
shows an error and offers switching back to audio. This preview selects the best
**combined audio/video format** supplied by yt-dlp; it does not merge separate
adaptive streams, so some sources offer lower resolution or no combined format.
The audio/video URL caches are separate, expire, and remain bounded. Signed URLs
are never saved in the listening session or displayed in errors.

Linux acceptance passed for generated local video, a public YouTube video and
a controlled live HTTP broadcast. Mode switching used one mpv PID, retained
paused local position/volume, and compositor window closure stopped the item.
One public YouTube live link could not resolve; broad live-source acceptance
remains pending. Automated coverage includes mode selection/cache separation,
queue defaults, window shutdown and keyboard/right-click actions. Physical macOS video-window acceptance remains pending;
shared source and automated checks do not establish that hardware result.

## Right-click menus

Set Settings → Keyboard and mouse → Mouse to **click**. Right-click a result in
Music Discover or YouTube Videos to choose its audio/video, queue, download or
details actions. Right-click Now Playing for pause/resume, previous/next,
volume, audio/video switching and fullscreen effects. **c** opens either menu
without mouse support; arrows and Enter choose, Escape closes. Player shortcuts
are suspended while its menu is open. Unavailable actions are dimmed.
