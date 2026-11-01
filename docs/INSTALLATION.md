# Installing LemmaDuck

Follow [Getting started with Herdr](../README.md#getting-started-with-herdr) on your x86-64 Linux host. From an authenticated source checkout, run:

```sh
./lemmaduck setup --full
export PATH="$HOME/.local/bin:$PATH"
lemmaduck doctor
```

On Windows x64, use Ubuntu in WSL2. From a Windows checkout, `powershell -File scripts/install-windows.ps1 -DryRun` previews the optional installer. The installer uses the selected Linux account’s authenticated Git client to clone the private repository. It accepts `-Distribution` and `-SkipFonts`. The Herdr guide also covers remote hosts.

## Optional terminal editor

For the Zellij workspace and isolated Neovim configuration, run `sh scripts/bootstrap.sh` from the same source checkout, then `lemmaduck open /path/to/project`. For a Herdr terminal and VS Code, `setup --full` is sufficient.

## Updating a checkout

Close active workers, update the checkout and rerun `./lemmaduck setup --full`. The installer checks the worker build and the pinned workflow sources. Reopen the project on the same host and account. See [local storage and recovery](OPERATIONS.md).
