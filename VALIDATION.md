# Validation for LemmaDuck 0.5.0

Recorded on November 1, 2026. Execution host was Linux x86-64 with Python 3.12.14 and Node 24.22.1. Task data and model responses were synthetic. Cloud inference and personal subscription sign-in require owner-side validation.

| Check | Observed result |
| --- | --- |
| Source installation | Ran `./lemmaduck setup --full` with a disposable user data root. npm installed the locked Pi and Paseo dependencies, TypeScript compiled, Google Antigravity ACP 1.2.1 passed its archive check and both workflow trees were verified. Paseo reported 0.14.0. The OMP 18.14.2 binary matched the pinned SHA-256. A repeat installation reused the packages and binary. |
| Full source integrity | Verified 1,137 file paths for pstack 0.15.36 and 4,528 for gstack 1.92.10.0. Verification covers Git object contents, modes, path inventory and the resolved commit. |
| TypeScript and runtime | Type checking and compilation passed. The suite now has **46 Node tests**, including the public OMP launcher, account-route checks, unmarked-project compatibility and explicit Pi use inside development projects. CI runs this suite in a loopback-only network namespace. Five coding/authentication/Pi regression checks also passed locally with all socket creation and outbound network syscalls denied by seccomp. |
| Research example and setup | **6 Python tests passed**. The demo flagged a mean of 25 against a recomputed mean of 20 across 3 observations, and detected stale results. Setup tests cover project-kind markers, preservation of existing Paseo settings, repeat registration and preservation of the installed OMP binary after a checksum failure. |
| Real OMP protocols | With all network sockets blocked by seccomp, the pinned OMP executable started through the public `agent` entry point in both `rpc` and `rpc-ui` modes and returned the selected synthetic model and a new empty session. `tests/omp_smoke.py` adds a CI check of state and commands inside a loopback-only namespace. |
| Distribution | The package dry run includes the OMP launcher, native Paseo dependency lock, provider catalog and development marker. Relative links in the updated getting-started and provider guides were checked. |
| Task resumption | Started the managed worker, saved a task and decision, then opened the same task through a new Pi RPC process. The task ID, decision and SHA-256 of the attached workflow matched. |
| Account connector | An isolated stdio MCP server exercised the allowlist, read calls, explicit writes, request-ID replay prevention, unknown-outcome receipts and account separation. |

## Boundaries

Paseo's desktop and mobile steps follow its [official connectivity guide](https://paseo.sh/docs/connectivity). The host installation, merged native-provider configuration and OMP protocol startup were exercised. Desktop/mobile pairing and an end-to-end Paseo chat with a real account remain owner-device checks. Windows, WSL, Surface and Android were outside the execution environment.

An initial OMP fixture run attempted background catalog access to `zenmux.ai`, and a later unrestricted test command attempted `pi.dev`. Automatic approval review blocked those commands. Managed OMP now disables background discovery for unselected built-in providers. Subsequent local protocol and targeted regression checks used a deny-all seccomp filter. Full CI uses a network namespace with only loopback. Actual inference, real correspondence and tenant-specific permissions remain account-side checks.

The [full design](docs/DESIGN.ko.md) and [module catalog](catalog/full.json) include additional capabilities. This release implements the terminal worker, source bootstrap, workflow attachment, account-scoped MCP CLI, starter projects and the reproducible research exercise. The hosted web client, first-party connector onboarding, unattended assistant, hospital-specific pipelines and self-improvement experiments remain implementation or integration work. Host-specific upstream automations run in their supported hosts.
