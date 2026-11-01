# Install and update with npm

The three distros are npm packages hosted on **GitHub Packages**. They are not
published on npmjs.org. Use a persistent global install on the Linux x86-64 host
that runs the agents. Prerequisites: Node.js 22.19+ (CI uses 24), npm, Python 3.12+
and Git. Emacs requires 29.1+; Neovim requires 0.9.5+ for the minimal profile or
0.11+ for LazyVim. Editor binaries are separate OS prerequisites.

## One-time registry login

GitHub's npm registry requires authentication even for public packages. Use your
GitHub username and a **personal access token (classic) with `read:packages`** at
the password prompt. Keep the token in the local npm login flow; never paste it
into an issue, chat, repository file or install command.

```sh
npm config set @ts06068:registry https://npm.pkg.github.com --location=user
npm login --scope=@ts06068 --auth-type=legacy --registry=https://npm.pkg.github.com
```

## Install

Install Base once. `--prefix` keeps the installation in your user directory:

```sh
npm install --global --prefix "$HOME/.local" @ts06068/lemmaduck-base@latest
export PATH="$HOME/.local/bin:$PATH"
duck setup --full
duck --version
```

The npm package contains the compiled worker; setup uses it without reinstalling
development dependencies or recompiling the package. Full setup installs the
pinned host runtimes and workflow sources. Provider sign-in remains a separate
step in the [getting started guide](GETTING_STARTED.md#4-sign-in-to-one-worker-and-ask-it-to-check-the-claim).

Add whichever editor workspace you want (both can coexist):

```sh
npm install --global --prefix "$HOME/.local" @ts06068/lemmaduck-emacs@preview
duck-emacs --doctor
duck-emacs /path/to/project

npm install --global --prefix "$HOME/.local" @ts06068/lemmaduck-neovim@preview
duck-neovim --doctor
duck-neovim /path/to/project
```

Base provides the shared `duck` engine and must be installed before either
editor is used. Set `LEMMADUCK_EXECUTABLE` if you deliberately use a different
engine executable. `LEMMADUCK_EDITOR` selects an installed editor binary.

The short commands are `duck`, `duck-emacs`, and `duck-neovim`. The original
`lemmaduck`, `lemmaduck-emacs`, and `lemmaduck-neovim` commands remain supported.
Package names, configuration paths, and task state are unchanged.

## Update

Run the install command again with the desired channel. `latest` follows stable
Base versions; `preview` follows editor alpha versions. Install only the editor
packages you use; the example updates all three:

```sh
npm install --global --prefix "$HOME/.local" \
  @ts06068/lemmaduck-base@latest \
  @ts06068/lemmaduck-emacs@preview \
  @ts06068/lemmaduck-neovim@preview
duck setup --full
duck --version
duck-emacs --version
duck-neovim --version
```

Finish or stop running workers before updating, then reopen the editor/worker.
Package updates replace installed program files, while engine task records,
credentials, editor state and projects stay in their existing user directories.
Use `npm outdated --global --prefix "$HOME/.local"` to inspect installed versions.
For an exact version, replace the channel with `@0.5.3` or `@0.1.0-alpha.4`.

If migrating from a source checkout, first inspect `command -v duck lemmaduck` and
the targets of `~/.local/bin/duck` and `~/.local/bin/lemmaduck`. Existing checkout symlinks can block
npm with EEXIST or keep the old CLI first in PATH. Remove only that old launcher
symlink after verifying its target, then install with npm. Preserve the checkout,
projects, credentials and state. Do not force npm to overwrite an unrelated file.

## Install without registry authentication

The public release npm archives can be installed directly. The same npm commands
manage the installed package, but updates require selecting a new release URL:

```sh
npm install --global --prefix "$HOME/.local" \
  https://github.com/ts06068/lemmaduck/releases/download/base-v0.5.3/lemmaduck-base-0.5.3.npm.tgz
npm install --global --prefix "$HOME/.local" \
  https://github.com/ts06068/lemmaduck/releases/download/emacs-v0.1.0-alpha.4/lemmaduck-emacs-0.1.0-alpha.4.npm.tgz
npm install --global --prefix "$HOME/.local" \
  https://github.com/ts06068/lemmaduck/releases/download/neovim-v0.1.0-alpha.4/lemmaduck-neovim-0.1.0-alpha.4.npm.tgz
```

Use the registry channels for name-based updates. Direct-URL installs do not gain
registry channel updates automatically. Release SHA-256 files cover these npm
archives; npm also verifies registry integrity when installing from the registry.

## Maintainers

Publishing a tested `<distro>-v<version>` release builds its assets, normalizes the
release title to the tag, publishes the matching npm package, verifies registry
integrity and advances `latest` or `preview`. All three packages link to this
repository. The manual **Publish GitHub package** workflow can retry publication
for package-enabled releases. It accepts an already published version only if
its bytes match; changed contents require a new version.

CI performs an actual global npm upgrade from Base 0.5.1 and editor alpha.2 to
the current packages in an isolated prefix. It checks all three commands, the
compiled worker, shared-engine lookup, and preservation of existing task state.
Interactive provider login and live model inference are separate checks.

Reference: [GitHub npm registry authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).
