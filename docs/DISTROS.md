# LemmaDuck distros

One repository contains three workspaces and one shared engine. Clone
`ts06068/lemmaduck` once. Base and the engine remain at the root; editor-specific
code lives in `distros/`. Editor configuration and task state remain separate.

| Distro | Source directory | Release tag | GitHub Packages name |
| --- | --- | --- | --- |
| Base | `.` | `base-v0.5.1` | `@ts06068/lemmaduck-base` |
| Emacs | `distros/emacs` | `emacs-v0.1.0-alpha.2` | `@ts06068/lemmaduck-emacs` |
| Neovim | `distros/neovim` | `neovim-v0.1.0-alpha.2` | `@ts06068/lemmaduck-neovim` |

Versions are independent. The editor manifests name the shared engine version
and `same-checkout` revision. CI tests them together. Release packaging resolves
that revision to the exact commit in `release-manifest.json` and the editor
archive's `distro.json`. An editor version does not imply a new engine version.

## Install and choose a workspace

Complete the root [installation and account setup](../README.md#getting-started-with-paseo)
once. From the checkout root, launch either editor against your project:

```sh
./distros/emacs/bin/lemmaduck-emacs /path/to/project
./distros/neovim/bin/lemmaduck-neovim /path/to/project
```

Emacs and Neovim are separate host prerequisites. The editor previews run the
existing workers in terminal buffers. Native agent buffers and attachment to a
live conversation from another client are not implemented. Details:
[Emacs](../distros/emacs/README.md), [Neovim](../distros/neovim/README.md).

## Releases in one repository

All three release channels live in [this repository's Releases](https://github.com/ts06068/lemmaduck/releases).
Use a consistent identity at every layer:

- Title: `LemmaDuck Base v0.5.1`, `LemmaDuck Emacs v0.1.0-alpha.2`, etc.
- Tag: `<distro>-v<version>`; versions must match that distro's manifests.
- Assets: `lemmaduck-<distro>-<version>.zip`, `.tar.gz`, `.npm.tgz`, `.manifest.json`, `.sha256`.
- Source archives and npm transports include `release-manifest.json` with distro,
  version, source directory, source commit and engine reference where applicable.
- Mark editor alpha releases as prereleases. Only stable Base releases should be
  marked Latest; GitHub's Latest label is repository-wide.

The shared `Release LemmaDuck distro` workflow selects the distro from the tag,
validates its version, tests/builds its files, and uploads only that distro's
assets. Main CI checks the shared engine, both editors, and archive/package
boundaries before publication. Source archives automatically supplied by GitHub
always contain the entire repository; the additional **editor-labelled assets**
contain just that editor subtree, flattened to `bin/`, `init.*`, and its files.
The Base source archive contains the complete checkout, including both editors.

Local packaging from the repository root:

```sh
npm ci --include=dev --ignore-scripts --no-audit --no-fund
npm run build
python3 scripts/build_release.py --distro base --npm
python3 scripts/build_release.py --distro emacs --npm
python3 scripts/build_release.py --distro neovim --npm
```

Outputs are separated under `build/release/<distro>/`. Add `--tag DISTRO-vVERSION`
to validate a proposed release tag. Stage new files before a local check; release
CI reads a clean tagged checkout and records its source SHA.

## GitHub Packages

The manual **Actions → Publish GitHub package → Run workflow** accepts an existing
tested release tag and selects the corresponding package. The three scoped
package names remain distinct, but all `repository` fields point to
`ts06068/lemmaduck`. Editor packages also set `repository.directory` to their
subdirectory. Publishing uses `GITHUB_TOKEN` and `npm.pkg.github.com`; it does not
publish to npmjs.org or run on an ordinary push.

Base preserves its source package name and `lemmaduck` CLI. Packaging renames its
GitHub transport to `@ts06068/lemmaduck-base`. Editor transports contain their
launchers and configurations; they are not MELPA, ELPA or LuaRocks registrations.
Registry authentication is required for GitHub npm packages, including public
ones. Public source release downloads remain available without registry login.
Configured package identities do not mean that registry versions are published;
only a successful package workflow establishes publication.

## Moving from the separate previews

Emacs `0.1.0-alpha.1` was imported from commit
`9f561a2f1f7f7599317d9c12348d532c4e1870be` of the former Emacs repository; Neovim
`0.1.0-alpha.1` was imported from
`de3271eb0469bfd1004a8d958a585a94b4817414` of the former Neovim repository.
The old repositories preserve those releases and point here. New work and new
releases belong to this repository. Existing tags and released archives are not
rewritten. Update launcher paths to `distros/<editor>/bin/lemmaduck-<editor>`.

Use the same execution host, OS account and project path to continue saved tasks.
Editor state directories remain `lemmaduck-emacs` and `lemmaduck-neovim`; the
shared engine still owns task locks and recovery. Repository consolidation does
not move user configuration or change those state directories.

References: [GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
and [GitHub npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).
