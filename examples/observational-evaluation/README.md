# Observational-method review pilot

Four constructed cases test time-zero alignment, positivity, patient/time leakage,
and conditional identification in an aligned study. These cases are separate from
the public NHEFS reproduction. They measure a methodological review component,
not end-to-end discovery, new clinical knowledge, or scientists' productivity.

The runner copies case inputs and the identical driver to a fresh agent project.
It keeps rubric answers outside that project. Both conditions receive the same
ChatGPT model, tools, case facts, call/token ceilings and timeout; the candidate
receives LemmaDuck inquiry instructions. Three repeats per case give 24 planned
trials. Order is randomized. Failures receive the preregistered worst score, and
repeats are grouped by case. Provider usage receipts are retained. No automatic
model fallback is used. Hidden reasoning is not included in answer artifacts.

The rubric was authored with the implementation and is not a validated domain
benchmark. The cases are public and same-user processes lack an adversarial OS
sandbox. A positive result would justify further testing, not a general scientific
benefit claim. Equal results or regressions must be reported. Independent blinded
human review is exported separately; no reviewer identity or rating is fabricated.

From a built checkout with an authenticated, billing-confirmed ChatGPT profile:

```sh
node scripts/evaluate-medical.mjs --live /absolute/path/to/new-pilot-root gpt-6-sol
```

This makes live subscription requests. It refuses an existing pilot root. Adjusting
the cases or rubric after inspecting results requires a new evaluation protocol.
