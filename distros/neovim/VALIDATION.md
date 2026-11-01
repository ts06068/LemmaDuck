# Validation

This is the `neovim` distro, version `0.1.0-alpha.2`.

The automated checks exercise argument handling with spaces and shell characters,
project validation, isolated editor startup, and missing-program diagnostics.
Headless Neovim checks cover worker selection, source-context preservation and registered dashboard commands.
Release packaging records the distro and source SHA and generates checksums.

CI runs on Ubuntu 24.04. No live model account, provider request or private research
data is used by these tests. Interactive full-screen rendering of Pi/OMP,
subscription login, device pairing and native RPC/ACP integrations require further
validation; this preview exposes the existing CLI through an editor terminal.

This distro is tested with the shared engine in the same monorepo checkout.
Release and package manifests resolve that checkout to an exact commit SHA.
