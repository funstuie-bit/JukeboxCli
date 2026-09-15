# Roadmap

## 1.0.0

The first production release includes the accepted Linux work: stable Sixel artwork in
Foot, six live visualisers for music and radio, Radio Browser discovery, the
balanced wide player, and GNOME-Keyring-aware Chromium cookies.

It also adds:

- Stable or nightly yt-dlp channels under Settings, with an immediate update
  action. Nightly is the default for app-managed installs; package-managed
  installs stay package-managed.
- Managed yt-dlp path, version and selected channel in `--doctor`.
- Ten Radio Browser quick channels: Lo-fi, Synthwave, Ambient, Chillout, Jazz,
  Classical, House, Drum & Bass, Reggae and Rock. These are directory searches,
  not copied or proxied cliamp feeds.
- Ember, Ocean and Forest player themes alongside Lavender and Calm.

## Next

- Further hands-on checks on macOS, especially iTerm2 artwork repainting, physical media
  keys/Control Centre and a clean Intel Mac installation.
- Wider Linux terminal, browser and keyring coverage; KWallet continues through
  yt-dlp's own platform handling.
- Keep an eye on online extractor and Radio Browser changes.

## Later

- Try colours taken from cover artwork.
- Consider optional mouse controls, a Vim key preset and automatic pagination
  while playing very large online collections.
- Consider other platforms once there are installation and playback tests.

## Not planned

- Separate YouTube Music sign-in, account likes or personalised-radio sync.
  Existing browser cookies remain the playback/download authentication route.
- DRM bypass, arbitrary website script execution or universal station discovery.
- Automatic downloads just from playing or queueing a track.
- Rewriting the interface framework just to look like another player.

There is no universal gapless guarantee, DRM support, general Radio Garden
browsing or automatic signed-in Music API access. See
[feature status](../FEATURES.md) for the current contract and known limits.
