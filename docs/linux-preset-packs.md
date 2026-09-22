# Linux MilkDrop preset packs

Current main adds optional packs; the latest tagged release is still 1.1.1.
Use `./install.sh` from an updated checkout to get this feature.

## Basic install and optional downloads

The Arch installer installs missing Node/npm, mpv, ffmpeg and projectM dependencies.
projectM supplies its Classic presets through the distro package. Native libraries
and the basic pack are not copied into the npm archive: pacman manages their
dependencies and updates. No separate long pacman command is needed after cloning.
The default fullscreen setup also installs GCC, make, pkgconf and Qt 5 build
tools and builds a private frontend against system libprojectM 3.1.12. Only
missing packages require sudo, with pacman's normal transaction confirmation.
Git itself must already be available to clone the source.

| Installer option | Effect |
| --- | --- |
| default | Core dependencies and projectM/Classic on Arch |
| `--no-visualizer` | Core only; terminal visualisers still work |
| `--with-cream-of-the-crop` | Download extra presets/textures and select Cream |
| `--with-browser-cookies` | Add Chromium, GNOME Keyring and libsecret on Arch |
| `--no-system-deps` | Leave OS packages to the user/package manager |
| `--check` | Build checks only; no system install or preset download |

Other Linux distributions still need their native packages installed separately.
Chromium is useful for authenticated downloads, but is not required for local
playback or signed-out discovery. Installing it does not sign you in: choose a
profile in Settings → Cookies after browser login and keyring setup.

## No branded startup frames

The old stock-frontend launcher displayed the M/headphones animation for about
1.8 seconds before sending a random-preset shortcut. Current main removes that
approach: its private Qt/PulseAudio frontend selects a valid preset with a hard
cut before rendering the first frame. Empty/failed preset loading never renders
the idle logo. The launcher waits for a native readiness marker, times out a
failed startup and displays an error instead of reporting success at spawn.

Arch's installer builds this companion automatically unless `--no-visualizer`
is specified. Existing installs can run `jukeboxcli --install-linux-visualizer`.
On other distributions, first install the Qt 5, libprojectM 3.1.12 and PulseAudio
development packages, GCC, make and pkg-config. Other core versions are not yet
supported by this pinned frontend build. Ordinary playback works without it.

First setup fetches ~53 MB of upstream source, SHA-256 verifies it, patches only
the frontend and builds against the existing shared core. Allow ~300 MB during
build and ~112 MiB installed. Source, upstream GPL/LGPL notices, qmake recipe and
manifest remain under the profile's `projectM/frontend/` directory alongside the
executable. No system binaries or libraries are modified. A healthy cached build
is reused; changed core headers invalidate it so it can be rebuilt explicitly.
The normal F launch never downloads or compiles anything.

Source: [projectM v3.1.12](https://github.com/projectM-visualizer/projectm/tree/v3.1.12),
archive SHA-256 `62b5b1b543b25cb8ad392d879378cfdc5c129165cf4d4f33fb159e364d42f135`.
The source remains under its upstream licences; JukeboxCli's MIT licence does not
replace them. The additional compatibility edits name the Qt resource correctly
and match the installed core's preset-switch callback signature.

## Download, select and switch back

Settings → Player appearance → MilkDrop packs offers Built-in Classic and a
confirmed download of Cream of the Crop. Once installed, Cream and Combined /
shuffled become selectable. Close projectM and press `F` again after a change.
Playback continues while the optional pack downloads.

```sh
jukeboxcli --install-preset-pack cream-of-the-crop
jukeboxcli --preset-pack combined
jukeboxcli --preset-pack classic
```

Cream has 9,795 presets and the accompanying texture archive has 67 images.
Download size is approximately 14 MB; allow 140 MB for the installed pack and
300 MB of free space during extraction. Combined reuses files through local
links. Normal launch never fetches packs. Selection is saved in the profile;
failure does not change the selected pack or replace a healthy installation.

Packs live under the profile's data directory, normally
`~/.local/share/JukeboxCli/projectM/`. They are not placed in `/usr/share/projectM`.
Pinned archives are SHA-256 checked before extraction. Nested preset names are
flattened with collision-safe names; texture basenames are retained. The launch
configuration sets both the Qt playlist and the core texture/preset search path.
Missing or incomplete extras fall back to Classic with a visible message.

projectM 3 cannot render every MilkDrop shader identically to newer engines.
If a preset is blank or malformed, press `Ctrl+R` in projectM to skip it or select
Classic in JukeboxCli. Fullscreen uses the active system audio monitor; unrelated
audio can also drive effects. An open projectM window must be closed before pack
changes apply. Importing arbitrary user archives and a larger pack catalogue are
not implemented in this first optional-download workflow.

## Provenance

- [Cream of the Crop](https://github.com/projectM-visualizer/presets-cream-of-the-crop),
  curated by Jason Fletcher / ISOSCELES, revision
  `0180df21f5e0bd39b9060cc5de420ed2f1f9e509`.
  SHA-256 `77ef8e527fb00343afdfb267f5a2e8d3d00430c563ca9f5ab2104fc306f5c674`.
- [MilkDrop texture pack](https://github.com/projectM-visualizer/presets-milkdrop-texture-pack),
  revision `6368812f27bc747b517218fbf89d21d59afce4d9`.
  SHA-256 `6e6ea0a0363334a79cf15e5c79115e1b99a24993c4238f14d222d9eea91c52b7`.

Downloaded content is not relicensed under JukeboxCli's MIT licence. Cream's
upstream notice says individual authors retain copyright and most presets lack
an explicit licence; it describes the project's historical redistribution basis
and author-removal policy. The texture repository supplies a README but no
separate licence at this revision. Available upstream notices are retained in
the installation's `provenance/` directory; `manifest.json` records both sources,
revisions, checksums and installed counts. These archives are downloaded on
request, not vendored into this repository or its npm package.
