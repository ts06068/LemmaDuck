# Installing LemmaDuck

Follow [Getting started with Paseo](GETTING_STARTED.md#getting-started-with-paseo) on your x86-64 Linux host. From an authenticated source checkout, run:

```sh
./duck setup --full
export PATH="$HOME/.local/bin:$PATH"
duck doctor
```

On Windows x64, use Ubuntu in WSL2. From a Windows checkout, `powershell -File scripts/install-windows.ps1 -DryRun` previews the optional installer. The installer uses the selected Linux account’s authenticated Git client to clone the private repository. It accepts `-Distribution` and `-SkipFonts`. On ARM64 Windows, connect Paseo Desktop to a Linux x64 host.

## Optional terminal editor

For the Zellij workspace and isolated Neovim configuration, run `sh scripts/bootstrap.sh` from the same source checkout, then `duck open /path/to/project`. For a Paseo terminal and VS Code, `setup --full` is sufficient.

## Updating a checkout

Close active workers, update the checkout and rerun `./duck setup --full`. The installer checks the Pi build, the locked Paseo host, the OMP binary checksum and both workflow inventories. Reopen the project on the same host and account. See [local storage and recovery](OPERATIONS.md).
