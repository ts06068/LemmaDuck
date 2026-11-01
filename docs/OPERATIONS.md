# Local storage and task recovery

On a fresh Linux installation, LemmaDuck stores provider profiles and installed tools under `~/.local/share/lemmaduck` and task state under `~/.local/state/lemmaduck`. The launcher lives at `~/.local/bin/lemmaduck`.

Override these locations with `LEMMADUCK_INSTALL_HOME`, `LEMMADUCK_DATA_DIR` and `LEMMADUCK_STATE_DIR`. On an upgraded host the launcher can find a single installation by its LemmaDuck setup marker. If multiple installations exist or the roots were independently customized, set the data and state variables to the directories belonging to that account before running setup or starting a worker.

## Reopen a task

```sh
lemmaduck status /absolute/path/to/project
lemmaduck agent /absolute/path/to/project
```

Return to the same host, account and absolute project path. In the agent prompt, use `/task` to inspect the current goal and `/handoff` to save its inputs and decisions. Use `/switch` when you are ready to continue with a worker.

If an operation is listed as `unknown`, inspect its effect in the target system first. Record the observation with `lemmaduck reconcile PROJECT OPERATION_ID completed 'observed result'` or use `failed` when failure is confirmed. Keep provider credentials and private task journals on the execution host.
