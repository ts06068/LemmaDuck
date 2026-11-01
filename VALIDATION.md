# Validation for LemmaDuck 0.4.0

Recorded on November 1, 2026. Execution host: Linux x86-64, Python 3.12.14, Node 24.22.1. All task data were synthetic. No personal account or model inference was involved in these checks.

| Check | Observed result |
| --- | --- |
| Source installation | Ran `./lemmaduck setup --full` with a fresh user data root. npm installed the locked dependencies, TypeScript compiled, Google Antigravity ACP 1.2.1 passed its archive check and both workflow trees were fetched. A repeat run reused the build and verified the sources again. |
| Full source integrity | Verified 1,137 file paths for pstack 0.15.36 and 4,528 for gstack 1.92.10.0. Verification covers Git object contents, modes, path inventory and the resolved commit. |
| TypeScript and runtime | `npm run check` passed. **42 Node tests passed**, including real Pi startup and worker/review switching through RPC, managed shell, bounded task artifacts, accounting, cancellation and recovery. |
| Research example | **3 Python tests passed**. The README demo rebuilt a table, a claim note and their manifest. It flagged the draft mean of 25 against a recomputed mean of 20 across 3 observations. A modified input failed the stale-results check. |
| Task resumption | Started the managed worker, saved a task and decision, then opened the same task through a new Pi RPC process. The task ID, decision and SHA-256 of the attached workflow matched. |
| Account connector | An isolated stdio MCP server exercised the allowlist, read calls, explicit writes, request-ID replay prevention, unknown-outcome receipts and account separation. |

## Boundaries

Herdr's desktop installation and tab steps follow its [official guide](https://herdr.dev/guide/). The concrete Linux commands were exercised. Windows, WSL, Surface, Android and the live Herdr desktop were not part of the test environment. Actual subscription sign-in, cloud inference, real correspondence and tenant-specific tool permissions require validation on the owner's devices and accounts.

The [full design](docs/DESIGN.ko.md) and [module catalog](catalog/full.json) include additional capabilities. This release implements the terminal worker, source bootstrap, workflow attachment, account-scoped MCP CLI, starter projects and the reproducible research exercise. The hosted web client, first-party connector onboarding, unattended assistant, hospital-specific pipelines and self-improvement experiments remain implementation or integration work. Host-specific upstream automations run in their supported hosts.
