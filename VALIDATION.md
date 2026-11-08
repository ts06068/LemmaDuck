# Research inquiry implementation validation

Source branch update, November 9, 2026 (Asia/Seoul). The implemented research lifecycle,
commands, experiment/verifier contract, and limits are documented in
[RESEARCH.md](docs/RESEARCH.md) and [the milestone map](docs/RESEARCH_MILESTONES.md).

The local public-CLI inquiry exercise executed Python analysis and an independent
Decimal verifier on frozen synthetic development and transfer inputs. Observed error
reductions were 340 and 144 synthetic units. It recorded a bounded claim, explicitly
synthetic feedback, a domain rule, and a reusable method. The public paired-evaluator
exercise ran eight deterministic-control trials, all correct, with a paired difference
of zero. This is harness validation, not measured scientific benefit.

Local TypeScript compilation passed. Python launcher/package checks passed all
12 tests; the two editor Python suites passed four tests each. The complete local Node run passed 75 of 76 tests with no skips; one provider worker
missed its 40-second cold-start budget. After separating readiness from interaction
timeouts, the final focused suite passed all 25 tests, including that provider check,
quota stopping, parent provenance, scientific invariants, and deadline termination.
The CI result for the final commit is recorded below when available. An installed ChatGPT subscription
passed the live worker smoke checks. The medical-method comparison completed all
24 planned live trials and did not demonstrate an inquiry advantage. A user-requested
clinical epidemiology persona rated every answer; this is self-review, not independent
domain or clinical validation. The source functionality has not been published as an
updated npm release. [Full medical evidence](docs/evaluations/2026-11-09-observational-pilot/README.md).

The host installation completed with checksum-verified Node 22.22.1, Python 3.14.4,
and the locked npm tree. The medical adapters used Python 3.12.13 and hash-locked
NumPy/Pandas/SciPy/statsmodels dependencies. For the full local Node suite an
inherited Node-level guard denied non-loopback connections. This is an accidental
network-access guard for trusted tests, not OS-level containment. CI retains its
stronger loopback-only network namespace. Native editor execution, pinned Jujutsu,
and the real OMP protocol checks run in CI.

Historical results below remain attributable to their original recorded versions.

---

# Validation for LemmaDuck 0.5.2

The npm upgrade check installs the prior public Base/editor packages in an
isolated prefix, upgrades to the current packages, exercises all three CLIs and
the compiled worker, and verifies that existing task state survives. Packaged
setup tests ensure it never reinstalls development dependencies or recompiles.

The monorepo keeps the engine at the root and imports the editor previews into
`distros/emacs` and `distros/neovim`. Main CI runs the engine checks below plus
both editor suites. Packaging checks build all three source/npm assets, verify
checksums and metadata, reject mismatched distro tags, and launch the extracted
editor scripts in command-preview mode. Live account calls and native editor
RPC/ACP integration are outside these tests.

# Engine validation inherited from 0.5.0

Recorded on November 1, 2026. Execution host was Linux x86-64 with Python 3.12.14 and Node 24.22.1. Task data and model responses were synthetic. Cloud inference and personal subscription sign-in require owner-side validation.

| Check | Observed result |
| --- | --- |
| Source installation | Ran `./lemmaduck setup --full` with a disposable user data root. npm installed the locked Pi and Paseo dependencies, TypeScript compiled, Google Antigravity ACP 1.2.1 passed its archive check and both workflow trees were verified. Paseo reported 0.14.0. The OMP 18.14.2 binary matched the pinned SHA-256. A repeat installation reused the packages and binary. |
| Full source integrity | Verified 1,137 file paths for pstack 0.15.36 and 4,528 for gstack 1.92.10.0. Verification covers Git object contents, modes, path inventory and the resolved commit. |
| TypeScript and runtime | Type checking and compilation passed. The previous base passed **46 Node tests**, including the public OMP launcher, account-route checks, unmarked-project compatibility and explicit Pi use inside development projects. CI runs this suite in a loopback-only network namespace. Five coding/authentication/Pi regression checks also passed locally with all socket creation and outbound network syscalls denied by seccomp. |
| Research example and setup | **7 Python tests passed**. The demo flagged a mean of 25 against a recomputed mean of 20 across 3 observations, and detected stale results. Setup tests cover project-kind markers, preservation of existing Paseo settings, repeat registration and preservation of the installed OMP binary after a checksum failure. |
| Real OMP protocols | With all network sockets blocked by seccomp, the pinned OMP executable started through the public `agent` entry point in both `rpc` and `rpc-ui` modes and returned the selected synthetic model and a new empty session. `tests/omp_smoke.py` adds a CI check of state and commands inside a loopback-only namespace. |
| Distribution | The package dry run includes the OMP launcher, native Paseo dependency lock, provider catalog and development marker. Relative links in the updated getting-started and provider guides were checked. |
| Task resumption | Started the managed worker, saved a task and decision, then opened the same task through a new Pi RPC process. The task ID, decision and SHA-256 of the attached workflow matched. |
| Account connector | An isolated stdio MCP server exercised the allowlist, read calls, explicit writes, request-ID replay prevention, unknown-outcome receipts and account separation. |

## Routing and connected work update

Eleven targeted Node checks passed locally under the deny-all seccomp policy, including the real Pi event pipeline, automatic routing with a single dispatched request, unchanged follow-up sessions, profile overrides, an applied high reasoning level, unavailable-account refusal, OMP defaults, shared connector schemas/effects, uncertain-write journaling and receipt replay protection. Seven Python checks passed, including checksum failure preservation for Jujutsu installation. The official Jujutsu 0.46.0 archive matched the locked digest. Real Git and Jujutsu fixtures passed; Jujutsu inspection preserved its operation ID and distinguished recorded from unsnapshotted file contents.

The expanded CI suite also exercises Gemini's MCP surface and writing-policy injection with synthetic transports inside a loopback-only namespace. Consult the commit's GitHub Actions result for the full-suite outcome. No real Linear/Jira tenant, mailbox, subscription inference or author-style evaluation was exercised. Presets and protocol tests do not establish live account access or the quality of generated research.

## Boundaries

Paseo's desktop and mobile steps follow its [official connectivity guide](https://paseo.sh/docs/connectivity). The host installation, merged native-provider configuration and OMP protocol startup were exercised. Desktop/mobile pairing and an end-to-end Paseo chat with a real account remain owner-device checks. Windows, WSL, Surface and Android were outside the execution environment.

An initial OMP fixture run attempted background catalog access to `zenmux.ai`, and a later unrestricted test command attempted `pi.dev`. Automatic approval review blocked those commands. Managed OMP now disables background discovery for unselected built-in providers. Subsequent local protocol and targeted regression checks used a deny-all seccomp filter. Full CI uses a network namespace with only loopback. Actual inference, real correspondence and tenant-specific permissions remain account-side checks.

The [full design](docs/DESIGN.ko.md) and [module catalog](catalog/full.json) include additional capabilities. This release implements the terminal worker, source bootstrap, workflow attachment, account-scoped MCP CLI and agent tools, task-level model routing, Git/Jujutsu inspection, starter projects and the reproducible research exercise. The hosted web client, first-party connector onboarding, unattended assistant, hospital-specific pipelines and self-improvement experiments remain implementation or integration work. Host-specific upstream automations run in their supported hosts.
