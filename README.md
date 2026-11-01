<p align="center">
  <img src="assets/brand/lemmaduck.webp" width="176" height="176" alt="A yellow voxel duck holding chalk and a slate that reads ‘LEMMA’ and ‘P ⇒ Q’">
</p>

<h1 align="center">LemmaDuck</h1>

<p align="center"><strong>Talk to the duck. Test your hunch.</strong></p>

LemmaDuck is your lab copilot. Open the same Linux workspace from your desktop or tablet with **Paseo**. Use **Oh My Pi (OMP)** to implement and debug code. For research, manuscript writing, read-only review and assistant work, **Pi** keeps the inputs, decisions and checks together as you change models. VS Code can stay open for project navigation and editing.

## Getting started with Paseo

This walkthrough sets up the host once and opens a reproducible manuscript check. The project uses three synthetic observations and can be checked without a model account.

### 1. Choose the computer that will run the agents

Use **x86-64 Linux**, Git and Python 3.12 or later. Ubuntu 24.04 is a suitable host. On the host run `uname -sm` and look for `Linux x86_64`. On Ubuntu you can install the prerequisites with `sudo apt install git python3`.

| Where you sit | Where to open the first shell |
| --- | --- |
| Linux x64 desktop | Open a local terminal. Paseo Desktop can manage the local daemon. |
| Windows x64 with WSL2 | Open the Ubuntu x64 shell. Run the host setup and Paseo daemon inside that distribution. |
| Surface Pro 11 (Windows ARM64) or macOS | SSH into your Linux x64 host. Install Paseo Desktop on the device with your screen. |
| Galaxy Tab S11 Ultra | Set up the Linux host from an SSH client or another computer. Use the Paseo Android app to connect in step 2. |

[Download Paseo for desktop or Android](https://paseo.sh/download) · [WSL installation](https://learn.microsoft.com/windows/wsl/install)

### 2. Install once and connect the client

In the **Linux host shell**, clone this private repository using a GitHub account with access. The example uses GitHub CLI. An authenticated `git clone https://github.com/ts06068/lemmaduck.git` also works. [GitHub CLI](https://cli.github.com/)

```sh
mkdir -p "$HOME/src"
gh auth login --hostname github.com --git-protocol https --web
gh repo clone ts06068/lemmaduck "$HOME/src/lemmaduck"
cd "$HOME/src/lemmaduck"
./lemmaduck setup --full
export PATH="$HOME/.local/bin:$PATH"
lemmaduck doctor
```

Full setup installs Paseo **0.14.0**, OMP **18.14.2**, the Pi worker and Google runtime. It verifies **1,137 pstack paths** and **4,528 gstack paths** and adds a **LemmaDuck Code** provider to the host's Paseo configuration. Keep the checkout at this path. Use `./lemmaduck setup --full --dry-run` to preview. In a new terminal, repeat the `export PATH` line if needed.

- **Local Paseo Desktop** — Open the local host. If it was running during setup, run `lemmaduck paseo reload` in the host shell.
- **Headless Linux or WSL2** — Run `lemmaduck paseo` in the host shell and follow its connection prompt. On desktop choose **Settings → Add host → Remote SSH** for an SSH-reachable server. On Android use **Pair Device** and the QR from the host, or add a direct address on your private network. Use a connection approved for the host and its data. [Paseo connectivity](https://paseo.sh/docs/connectivity)

In Paseo, open a workspace on that host and open its **Terminal**. Use this terminal for the research walkthrough below. For a software project, skip to [Code development with OMP](#code-development-with-omp).

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

Use `/task` to inspect the saved task and `/usage` to see reported usage. For a personal Claude plan, use `lemmaduck login claude`, confirm the account setting with `lemmaduck billing confirm claude --extra-usage-off`, then enter `/switch claude`. The published Claude Code executable handles sign-in. For Gemini, use the corresponding `gemini` commands. [Provider and billing details](docs/PROVIDERS.md) A worker hitting its quota pauses the task. You choose whether to switch.

### 5. Save, review and return

Enter `/handoff` in the agent prompt to save a short packet. To review the work, enter `/review` and select a worker for a separate read-only review. Return to the same terminal from either Paseo client. If the worker exited, open a terminal on the **same host, account and project path** and run:

```sh
export PATH="$HOME/.local/bin:$PATH"
lemmaduck status "$HOME/projects/duck-first-study"
lemmaduck agent "$HOME/projects/duck-first-study"
```

Use `/task` to inspect the existing goal, then `/switch chatgpt` to start the next segment. `/task new` starts a different task. If an interrupted operation shows `unknown`, inspect its effect before marking it completed or failed. [Task and recovery reference](docs/OPERATIONS.md)

## Code development with OMP

Create a coding project in the host terminal. A development template contains a `.lemmaduck-kind` file, so the usual `agent` command starts OMP automatically.

```sh
lemmaduck init "$HOME/projects/duck-code" --kind development
lemmaduck agent "$HOME/projects/duck-code"
```

For an existing checkout, use `lemmaduck code /path/to/repo`. To use Paseo's chat, open that same folder as a workspace, choose **New Agent → LemmaDuck Code** and select your configured model. The terminal command and the Paseo provider use the same OMP profile. Register an account or a local model on the host first. For ChatGPT, open the terminal command, enter `/login openai-codex` and sign in to your own account, then select a model with `/model`. A registered loopback model can run without a cloud account. [Model configuration and Claude billing](docs/PROVIDERS.md)

Try “Reproduce the failing test, fix the underlying function and rerun that test.” Review the diff in Paseo or VS Code. For a manuscript or a read-only research review in that same checkout, run `lemmaduck agent /path/to/repo --pi` in a terminal. OMP keeps its coding sessions separately from Pi's task journal. In OMP, `/review` reviews code changes. In Pi, `/review` starts a separate read-only research segment.

## Workflows and project types

| For this work | Start here |
| --- | --- |
| Investigate a research question | `lemmaduck init PATH --kind research` creates a protocol and claim ledger. Attach `/workflow pstack:sharpen` in the agent prompt, switch workers, and ask for competing explanations and a discriminating experiment. |
| Build or review software | `--kind development` creates an OMP project with an implementation plan. Look up `pstack:tdd`, `gstack:plan-eng-review` or `gstack:qa`. |
| Draft in Korean or English | `--kind writing` creates a brief for audience, approved examples, facts and uncertainty. Attach `pstack:technical-writing` or `pstack:unslop`. |
| Triage messages or follow up on work | `--kind assistant` creates an inbox and action record. Configure each work or personal account separately through the [connector guide](docs/CONNECTORS.md). |
| Work on an existing project | Use `lemmaduck code PATH` for code or `lemmaduck agent PATH --pi` for research, writing or assistant work. Unmarked projects default to Pi. |

In a regular shell, run `lemmaduck workflow list pstack` to see available names or `lemmaduck workflow show gstack:qa` to read a pinned entry. In the Pi prompt, `/workflow NAME` attaches that entry to the task and its handoff. The worker can read the full text in chunks. Interactive commands attach one workflow at a time. Cursor-hosted automations, browser QA and deployments require their own host, tools and permissions. [Full workflow inventory](catalog/workflow-routing.tsv)

## Development

```sh
npm ci --include=dev --ignore-scripts --no-audit --no-fund
npm run check
npm run build
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
```

Accounts, live tasks, retrieved records and connector credentials belong on the execution host. See the [full design (Korean)](docs/DESIGN.ko.md), [capability catalog](catalog/full.json), [provider configuration](docs/PROVIDERS.md), and [local storage and recovery guide](docs/OPERATIONS.md).
