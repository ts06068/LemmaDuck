<p align="center">
  <img src="assets/brand/lemmaduck.webp" width="176" height="176" alt="LemmaDuck, a yellow voxel rubber duck with an orange bill">
</p>

<h1 align="center">LemmaDuck</h1>

LemmaDuck gives a research or development project a persistent task and a choice of agent workers. Open a terminal in Herdr, choose a model, and give it a question. You can hand the work to another model with the inputs, decisions and checks still attached. VS Code can stay open alongside Herdr for editing and reviewing diffs.

The source distribution includes the Pi worker, ChatGPT and Claude subscription routes, Google Antigravity ACP, complete pinned pstack and gstack workflow sources, and an MCP client for accounts you configure. Version **0.4.0** installs from this repository. See [validation](VALIDATION.md) for the checks behind this version and the features that still need a live account or implementation.

## Getting started with Herdr

The first project checks a small error in a manuscript. The source data are synthetic, and you can verify the answer without calling a model.

### 1. Open a Linux terminal inside Herdr

Install **Herdr App** on the computer with your screen. Its official downloads include Windows x64, macOS and Linux. Open the app and use the **+** in the tab bar to start a terminal or custom program. A *space* groups related tabs. Use one space for the project. [Get Herdr App](https://herdr.dev/download/) · [Herdr guide](https://herdr.dev/guide/)

Choose the row for your machine. Run the rest of this guide **inside the Linux shell**. The agent host needs x86-64 Linux, Git and Python 3.12 or later. Ubuntu 24.04 is a suitable starting point.

| Your machine | What to do in the Herdr tab |
| --- | --- |
| x86-64 Linux desktop | Start `bash` on the local machine. |
| Windows x64 with Ubuntu in WSL2 | Start `powershell.exe`. Run `wsl -l -v` to see your distributions, then `wsl -d Ubuntu-24.04` using the installed name. For a new WSL installation, follow the [Microsoft WSL guide](https://learn.microsoft.com/windows/wsl/install). |
| Windows or macOS with an Ubuntu server | Start your usual shell. Run `ssh YOUR_USER@YOUR_SERVER`, replacing both placeholders with your own SSH login. For persistent Herdr tabs on that server, add it as a Herdr machine with `hc machine add YOUR_USER@YOUR_SERVER` and open a space on that machine. [Herdr remote machines](https://herdr.dev/core/) |
| Windows ARM64, including Surface Pro 11 | Open a Warp or system terminal and SSH to the same Linux host. Continue at step 2. |

Check where you are by running `uname -sm`. Expect `Linux x86_64`. If Git or Python is missing on Ubuntu 24.04, an administrator can install them with `sudo apt install git python3`.

### 2. Clone and set up LemmaDuck once on that host

Use a GitHub account with access to this repository. The commands below use GitHub CLI. If `gh` is missing, install it on the Linux host first. If you already use an authenticated Git client, use `git clone https://github.com/ts06068/lemmaduck.git "$HOME/src/lemmaduck"` in place of the `gh` commands. [GitHub CLI](https://cli.github.com/)

```sh
mkdir -p "$HOME/src"
gh auth login --hostname github.com --git-protocol https --web
gh repo clone ts06068/lemmaduck "$HOME/src/lemmaduck"
cd "$HOME/src/lemmaduck"
./lemmaduck setup --full
export PATH="$HOME/.local/bin:$PATH"
lemmaduck doctor
```

`setup --full` builds the worker, installs the pinned Google runtime and verifies **1,137 pstack paths** and **4,528 gstack paths**. It places the `lemmaduck` launcher in `~/.local/bin`. Keep the checkout at this location. You can preview the steps with `./lemmaduck setup --full --dry-run`. If a new terminal cannot find the command, repeat the `export PATH` line or use `~/.local/bin/lemmaduck`.

### 3. Prepare your first project

```sh
lemmaduck init "$HOME/projects/duck-first-study" --kind demo
cd "$HOME/projects/duck-first-study"
python3 reproduce.py
python3 reproduce.py --check
```

The draft reports **25 units**. The observations are **10, 20 and 30**, so their mean is **20 units**. You should see `C01: discrepancy; n=3, mean=20`. Open `results/claim.md` for the source rows and `results/manifest.json` for the file hashes. To repeat the exercise in the same folder, rerun `reproduce.py`.

### 4. Sign in to one worker and ask it to check the claim

In the **ordinary Linux shell**, sign in to the subscription you want to use. For ChatGPT:

```sh
lemmaduck login chatgpt
```

When Pi opens, enter `/login openai-codex`, follow the sign-in instructions, then enter `/quit` to return to the shell. After checking that paid extras and auto-refill are disabled on your account, record that setting and start the agent:

```sh
lemmaduck billing confirm chatgpt --extra-usage-off
lemmaduck agent "$HOME/projects/duck-first-study"
```

**You are now in the agent prompt.** Enter these lines **one at a time**. The last one opens a model picker. Select an available model and press Enter.

```text
/task new Check the mean reported in the manuscript
/task add observations.csv
/task add draft.md
/switch chatgpt
```

Then give the worker its first request:

> Read observations.csv and draft.md. Recompute the mean, show the arithmetic, and identify the sentence that needs a correction. Leave the original draft intact.

Use `/task` to inspect the saved task and `/usage` to see reported usage. For Claude or Gemini, replace `chatgpt` in the shell commands and the picker command with `claude` or `gemini`, and follow that provider's own login flow. A worker hitting its quota pauses the task. You choose whether to switch.

### 5. Save, review and return

Enter `/handoff` in the agent prompt to save a short packet. To review the work, enter `/review` and select a worker for a separate read-only review. If you leave the live Herdr tab open you can return to it. If the worker exited, open a Linux tab on the **same host, account and project path** and run:

```sh
export PATH="$HOME/.local/bin:$PATH"
lemmaduck status "$HOME/projects/duck-first-study"
lemmaduck agent "$HOME/projects/duck-first-study"
```

Use `/task` to inspect the existing goal, then `/switch chatgpt` to start the next segment. `/task new` starts a different task. If an interrupted operation shows `unknown`, inspect its effect before marking it completed or failed. [Task and recovery reference](docs/OPERATIONS.md)

## Workflows and project types

| For this work | Start here |
| --- | --- |
| Investigate a research question | `lemmaduck init PATH --kind research` creates a protocol and claim ledger. Attach `/workflow pstack:sharpen` in the agent prompt, switch workers, and ask for competing explanations and a discriminating experiment. |
| Build or review software | `--kind development` creates an implementation plan. Look up `pstack:tdd`, `gstack:plan-eng-review` or `gstack:qa`. |
| Draft in Korean or English | `--kind writing` creates a brief for audience, approved examples, facts and uncertainty. Attach `pstack:technical-writing` or `pstack:unslop`. |
| Triage messages or follow up on work | `--kind assistant` creates an inbox and action record. Configure each work or personal account separately through the [connector guide](docs/CONNECTORS.md). |
| Work on an existing project | Run `lemmaduck agent /path/to/project`. Use `/instructions` to preview and approve project guidance before selecting the worker. |

In a regular shell, run `lemmaduck workflow list pstack` to see available names or `lemmaduck workflow show gstack:qa` to read a pinned entry. In the agent prompt, `/workflow NAME` attaches that entry to the task and its handoff. The worker can read the full text in chunks. Interactive commands attach one workflow at a time. Cursor-hosted automations, browser QA and deployments require their own host, tools and permissions. [Full workflow inventory](catalog/workflow-routing.tsv)

## Development

```sh
npm ci --include=dev --ignore-scripts --no-audit --no-fund
npm run check
npm run build
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
```

Accounts, live tasks, retrieved records and connector credentials belong on the execution host. See the [full design (Korean)](docs/DESIGN.ko.md), [capability catalog](catalog/full.json), [provider configuration](docs/PROVIDERS.md), and [local storage and recovery guide](docs/OPERATIONS.md).
