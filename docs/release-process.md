# Release process

macOS and Linux share one main branch and one version. GitHub is the canonical
public history; the private mirror receives the exact same commits, not a
separately replayed copy. Fetch before publishing and stop if another contributor
has advanced either target. Never overwrite concurrent work to complete a release.

1. Branch from current main. Keep machine paths, credentials, local agent notes
   and private infrastructure addresses out of tracked files.
2. Run tests, typecheck, build and distribution-import validation. Use isolated
   profiles for installer and playback tests. Document remaining platform limits.
3. Update package/lockfile versions, README, changelog and release notes together.
   Stable releases use normal semantic versions, without a beta suffix.
4. Create an immutable annotated version tag on the release source commit.
   Update the Homebrew formula to that tag and full source revision in a following
   commit. Never move a public release tag to pick up later fixes.
5. Push main and the explicit release tag. Wait for both Mac and Linux CI on the
   final main commit, including source-install and Homebrew checks. Keep release
   publication in draft until the checks pass.
6. Publish stable releases without the prerelease flag and mark the current stable
   release as Latest. Verify the active mirror branches and new release tag match.

Historical beta release notes stay historical. Production status does not imply
that every terminal, processor architecture or external music service was tested.

Old checkouts from before the history reconciliation must not merge their history
back into main. Retain them as backups and clone afresh; port only reviewed,
unpublished changes. Routine releases never need a force push.
