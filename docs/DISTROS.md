# LemmaDuck distros

The family contains three workspaces and one shared engine. Editor repos contain
editor code and configuration; they call the installed engine for account login,
model routing, connectors and managed research task state.

| Distro | Repository | Release tag | GitHub Packages name |
| --- | --- | --- | --- |
| Base | `ts06068/lemmaduck` | `base-v0.5.0` | `@ts06068/lemmaduck-base` |
| Emacs | `ts06068/lemmaduck-emacs` | `emacs-v0.1.0-alpha.1` | `@ts06068/lemmaduck-emacs` |
| Neovim | `ts06068/lemmaduck-neovim` | `neovim-v0.1.0-alpha.1` | `@ts06068/lemmaduck-neovim` |

Versions are independent. An editor distro records its tested engine commit in
`distro.json`; an editor version is not a claim that it includes a new engine.
The editor previews run the existing workers in terminal buffers. Native agent
buffers and cross-client attachment to a live session are not implemented there.

## Release identity

GitHub has release titles, tags and assets, rather than a custom distro selector.
Use all three consistently:

- Title: `LemmaDuck Base v0.5.0`, `LemmaDuck Emacs v0.1.0-alpha.1`, etc.
- Tag: `<distro>-v<version>`.
- Assets: `lemmaduck-<distro>-<version>.zip`, `.tar.gz`, `.npm.tgz`, `.manifest.json`, `.sha256`.
- Each source archive includes `release-manifest.json`: distro, version, source SHA,
  engine reference where applicable, integration type and host support.
- Mark editor alpha releases as prereleases. Keep each distro's releases in its
  own repo; use this README as the common entry point.

The `Release LemmaDuck ...` workflow validates the tag and builds/upload assets
when a release is published. Before publication, confirm the commit's CI passed.
An asset upload failure does not mean the source tag or its auto-generated GitHub
archives are missing; check the release workflow before claiming all assets exist.

## GitHub Packages

The package workflow is deliberately separate from a source release. Run
**Actions → Publish GitHub package → Run workflow**, supplying the tested release
tag. It publishes a scoped npm package through `GITHUB_TOKEN` to
`npm.pkg.github.com`; it does not publish to npmjs.org. Package publication may
also depend on account or organization policy.

Base keeps its existing source package name and `lemmaduck` CLI for compatibility;
the packaging script gives the GitHub transport the name `@ts06068/lemmaduck-base`.
The editor transports bundle their editor files and launchers. They are not MELPA,
ELPA or LuaRocks registrations. GitHub Packages requires authentication even for
public npm packages, so public source releases are the recommended download path.

The package's name and `repository` field identify its distro and link it to the
corresponding repository. `lemmaduckDistro` is project metadata, not a built-in
GitHub Packages UI field. This documentation names configured package identities;
only a successful package workflow means a version has actually been published.

## Workspace and state

Use the same execution host, OS account and project path to continue saved tasks.
The shared engine owns research locks, recovery and task identifiers. Editor
configuration/state is separate (`lemmaduck-emacs` / `lemmaduck-neovim`). The
existing optional editor setup in the base repo remains available; adopting the
new Neovim distro is an explicit choice and does not move existing configuration.

References: [GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
and [GitHub npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).
