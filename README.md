# LemmaDuck

<img src="assets/brand/lemmaduck.webp" alt="LemmaDuck proof duck" width="160" height="160">

A lab copilot for reproducible research, writing, and code.

Talk to the duck. Test your hunch. **LemmaDuck** brings your model accounts, project tools, and saved research tasks into one workspace. Use Paseo on desktop or tablet, or open the same workers in Emacs and Neovim.

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [Documentation](#documentation)
- [Development](#development)
- [Maintainers](#maintainers)
- [Acknowledgements](#acknowledgements)
- [Contributing](#contributing)
- [License](#license)

## Background

Research runs across conversations, code, data, and manuscripts. LemmaDuck keeps a task's selected inputs, decisions, execution records, and handoffs together so you can return to the work and inspect its evidence.

- **Research and writing:** Pi runs the managed worker, with checkpoints, explicit model switches, and read-only review.
- **Code:** OMP runs development sessions with the project's tools and instructions.
- **Models:** choose ChatGPT, Claude, Gemini, or an explicitly configured API or local provider. Set provider, model, and reasoning preferences by task.
- **Connected projects:** allow specific MCP tools for named accounts, including GitHub, Linear, and Jira. Modifying actions have approval and receipt records.
- **Workspaces:** Base uses Paseo. The Emacs and Neovim previews run the shared workers in editor terminals.

A saved execution record establishes what ran. Scientific conclusions still require appropriate methods, evidence, and review. See [validation coverage](VALIDATION.md) for what has been exercised.

## Install

### Dependencies

Run the engine on **Linux x86-64** with **Node.js 22.19+**, **Python 3.12+**, and **Git**. Emacs and Neovim are separate prerequisites for their editor distributions.

For Windows with a remote Linux or GPU server, install on the server over SSH. GPU jobs use the server's configured Python/CUDA environment. WSL is optional for that arrangement. [Choose an execution host](docs/GETTING_STARTED.md#getting-started-with-paseo).

### Base

Complete the one-time GitHub Packages login, then install Base in your user prefix:

```sh
npm config set @ts06068:registry https://npm.pkg.github.com --location=user
npm login --scope=@ts06068 --auth-type=legacy --registry=https://npm.pkg.github.com
npm install --global --prefix "$HOME/.local" @ts06068/lemmaduck-base@latest
export PATH="$HOME/.local/bin:$PATH"
duck setup --full
duck doctor
duck paseo
```

Use your GitHub username and a classic token with `read:packages` at the private login prompt. Public release archives provide an [installation path without registry login](docs/INSTALL.md#install-without-registry-authentication).

Connect [Paseo Desktop or Android](https://paseo.sh/download) to the execution host. Follow [the walkthrough](docs/GETTING_STARTED.md) to sign into your model accounts and start a task.

### Editors

Install Base first, then add the editor you use:

```sh
npm install --global --prefix "$HOME/.local" @ts06068/lemmaduck-emacs@preview
duck-emacs /path/to/project

npm install --global --prefix "$HOME/.local" @ts06068/lemmaduck-neovim@preview
duck-neovim /path/to/project
```

Both editor distributions are previews. They provide terminal workers, project navigation, and context copying. Native chat buffers and cross-client attachment to a live conversation are not implemented. [Emacs guide](distros/emacs/README.md) · [Neovim guide](distros/neovim/README.md).

To update, rerun the npm install command for your chosen channel, run `duck setup --full`, and reopen the workers. [Versions and updates](docs/INSTALL.md) · [Source installation](docs/INSTALLATION.md).

## Usage

### CLI

Create a research project after connecting a [model account](docs/PROVIDERS.md):

```sh
duck init "$HOME/projects/my-study" --kind research
duck agent "$HOME/projects/my-study"
```

Inside Pi:

```text
/ask Compare the competing explanations in protocol.md and propose a discriminating test.
/task
/checkpoint
/handoff
```

`/ask` routes a new segment. Follow-up messages stay with its worker. `/switch` selects another worker, and `/review` opens a read-only review segment. Return with `duck agent` using the same host, account, and project path.

For software development:

```sh
duck code /path/to/repository
```

For a reproducible exercise that needs no model account:

```sh
duck init "$HOME/projects/duck-first-study" --kind demo
cd "$HOME/projects/duck-first-study"
python3 reproduce.py
python3 reproduce.py --check
```

The synthetic draft claims a mean of 25. The three observations yield 20. The script writes the discrepancy and a manifest that detects changed inputs or outputs.

`duck` is the everyday command. `lemmaduck` remains available for compatibility.

## Documentation

| Guide | Contents |
| --- | --- |
| [Getting started](docs/GETTING_STARTED.md) | Host selection, setup, account sign-in, and a first task |
| [Installation](docs/INSTALL.md) | npm packages, public archives, and updates |
| [Providers](docs/PROVIDERS.md) · [Routing](docs/ROUTING.md) | Model accounts, local endpoints, and task preferences |
| [Distros](docs/DISTROS.md) | Base, Emacs, and Neovim |
| [Connectors](docs/CONNECTORS.md) · [Version control](docs/VCS.md) | Scoped MCP tools, Git, and Jujutsu |
| [Operations](docs/OPERATIONS.md) | Checkpoints, handoffs, and interruption recovery |
| [Writing](docs/WRITING.md) | Author intent, evidence, and editing rules |
| [Validation](VALIDATION.md) | Recorded checks and their limits |

## Development

```sh
npm ci --include=dev --ignore-scripts --no-audit --no-fund
npm run check
npm run build
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
```

CI runs Node tests with loopback-only networking and checks both editor distributions. Live account inference and owner-device pairing require separate validation.

## Maintainers

[@ts06068](https://github.com/ts06068).

## Acknowledgements

LemmaDuck builds on Pi, OMP, Paseo, the Agent Client Protocol, and the Model Context Protocol. Workflow sources and tool versions are recorded in `locks/`.

This README follows [Standard Readme](https://github.com/RichardLitt/standard-readme), selected from [Awesome README](https://github.com/matiassingers/awesome-readme): a short description, direct installation and usage examples, and links to detailed guides.

## Contributing

[Open an issue](https://github.com/ts06068/LemmaDuck/issues) for questions or proposed changes. Pull requests are welcome. Describe the behavior, preserve existing user state, and report the checks you ran. Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), for example `feat(research): track experiment predictions`.

## License

UNLICENSED. This repository has no declared project license. Upstream components retain their own licenses.
