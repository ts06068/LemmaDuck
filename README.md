<h1 align="center">🦆 LemmaDuck</h1>
<p align="center"><strong>Your lab copilot for research, writing, and code.</strong><br>Talk to the duck. Test your hunch.</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#how-it-works">How It Works</a> ·
  <a href="#documentation">Documentation</a> ·
  <a href="https://github.com/ts06068/lemmaduck/releases">Releases</a>
</p>

LemmaDuck brings your model accounts, research tasks, and development tools into one workspace. Work in Paseo on desktop or tablet, or use the Emacs and Neovim distros with the same shared engine.

<table align="center">
  <tr>
    <td align="center" width="33%">
      <a href="#quick-start"><img src="assets/brand/lemmaduck.webp" width="176" height="176" alt="LemmaDuck Base proof duck"></a><br>
      <strong><a href="#quick-start">Base</a></strong><br>Paseo desktop &amp; tablet
    </td>
    <td align="center" width="33%">
      <a href="distros/emacs"><img src="assets/brand/lemmaduck-emacs.png" width="176" height="176" alt="LemmaDuck Emacs with a purple lambda beret"></a><br>
      <strong><a href="distros/emacs">Emacs</a></strong><br>Editor workspace · preview
    </td>
    <td align="center" width="33%">
      <a href="distros/neovim"><img src="assets/brand/lemmaduck-neovim.png" width="176" height="176" alt="LemmaDuck Neovim with a green cap"></a><br>
      <strong><a href="distros/neovim">Neovim</a></strong><br>Editor workspace · preview
    </td>
  </tr>
</table>

The editor previews run the shared workers in editor terminals.

<a id="getting-started-with-paseo"></a>

<a id="quick-start"></a>

## 🚀 Quick Start

**Host requirements:** Linux x86-64, Node.js 22.19+, Python 3.12+, and Git.

Complete the one-time [GitHub Packages login](docs/INSTALL.md#one-time-registry-login), then install Base:

```sh
npm install --global --prefix "$HOME/.local" @ts06068/lemmaduck-base@latest
export PATH="$HOME/.local/bin:$PATH"
duck setup --full
duck paseo
```

`duck` is the everyday command; `lemmaduck` remains available for compatibility.

Connect with [Paseo Desktop or Android](https://paseo.sh/download). The [getting started guide](docs/GETTING_STARTED.md) walks through host connection, model sign-in, and your first research task.

<details>
<summary>Use Emacs or Neovim</summary>

Install Base first, then add the editor distro you want. The editor itself must be installed on the host.

```sh
# Emacs
npm install --global --prefix "$HOME/.local" @ts06068/lemmaduck-emacs@preview
duck-emacs /path/to/project

# Neovim
npm install --global --prefix "$HOME/.local" @ts06068/lemmaduck-neovim@preview
duck-neovim /path/to/project
```

[Emacs guide](distros/emacs/README.md) · [Neovim guide](distros/neovim/README.md)

</details>

[Update with npm](docs/INSTALL.md#update) · [Install without registry login](docs/INSTALL.md#install-without-registry-authentication) · [Install from source](docs/INSTALLATION.md)

<a id="usage"></a>

## 🛠️ Usage

After [connecting a model account](docs/PROVIDERS.md), create a research project:

```sh
duck init "$HOME/projects/my-study" --kind research
duck agent "$HOME/projects/my-study"
```

For software development, run `duck code /path/to/repo`. To return to saved research work, run `duck agent /path/to/project` again.

<a id="how-it-works"></a>

## ✨ How It Works

- 🔬 **Research and writing.** Pi manages goals, source files, checkpoints, reviews, and handoffs so you can return to an ongoing task.
- 💻 **Code development.** OMP runs coding sessions with the project's tools and instructions, alongside Git or Jujutsu.
- 🧠 **Your choice of models.** Use ChatGPT, Claude, Gemini, or explicitly configured API and local-model providers. Set preferred providers, models, and reasoning levels by task.
- 🔗 **Connected projects.** Configure GitHub, Linear, and Jira connectors, and keep issue references with your research tasks.

<a id="documentation"></a>

## 📚 Documentation

| Guide | Contents |
| --- | --- |
| [Getting started](docs/GETTING_STARTED.md) | Host setup, account sign-in, and a complete first-task walkthrough |
| [Installation and updates](docs/INSTALL.md) | npm packages, release downloads, versions, and upgrades |
| [Models](docs/PROVIDERS.md) · [Routing](docs/ROUTING.md) | Accounts, local models, and task-based model preferences |
| [Distros](docs/DISTROS.md) | Base, Emacs, and Neovim workspaces |
| [Connectors](docs/CONNECTORS.md) · [Version control](docs/VCS.md) | GitHub, Linear, Jira, Git, and Jujutsu |
| [Task state and recovery](docs/OPERATIONS.md) | Checkpoints, handoffs, and resuming work |
| [Development](docs/GETTING_STARTED.md#development) · [Validation](VALIDATION.md) | Build commands, tests, and current coverage |
