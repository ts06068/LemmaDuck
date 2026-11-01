# Local storage and task recovery

On a fresh Linux installation, LemmaDuck stores provider profiles and installed tools under `~/.local/share/lemmaduck` and task state under `~/.local/state/lemmaduck`. The primary launcher lives at `~/.local/bin/duck`; `~/.local/bin/lemmaduck` remains available.

Override these locations with `LEMMADUCK_INSTALL_HOME`, `LEMMADUCK_DATA_DIR` and `LEMMADUCK_STATE_DIR`. On an upgraded host the launcher can find a single installation by its LemmaDuck setup marker. If multiple installations exist or the roots were independently customized, set the data and state variables to the directories belonging to that account before running setup or starting a worker.

## Reopen a Pi task

```sh
duck status /absolute/path/to/project
duck agent /absolute/path/to/project --pi
```

Return to the same host, account and absolute project path. In the agent prompt, use `/task` to inspect the current goal and `/handoff` to save its inputs and decisions. Use `/ask REQUEST` to route a new segment automatically or `/switch` to select a worker manually. `/route` shows the current profile and last routing decision.

If an operation is listed as `unknown`, inspect its effect in the target system first. Record the observation with `duck reconcile PROJECT OPERATION_ID completed 'observed result'` or use `failed` when failure is confirmed. Keep provider credentials and private task journals on the execution host.

## Reopen a coding session

Reconnect to the same host and open the original **LemmaDuck Code** conversation in Paseo. From a terminal use `duck code /path/to/repo --resume` to choose an OMP session for that workspace. A Pi task ID and a Paseo/OMP session ID identify different records. For a research handoff, record the coding commit, test command and result in the Pi task.

Model-routing overrides live at the path printed by `duck routing path`. Connector configuration lives at `~/.config/lemmaduck/connections.json`; its credentials remain in named environment variables. Connector receipts live under the task state root in `connector-receipts/ACCOUNT`. An unknown connector outcome requires checking the service before reconciling the corresponding task operation. `/task link URL` retains an issue/PR reference in the handoff.
