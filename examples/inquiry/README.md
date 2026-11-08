# Synthetic unit-normalization inquiry

Create a fresh copy with `duck init PROJECT --kind inquiry`, then run
`duck research PROJECT demo`. This authorizes and executes only the local synthetic
exercise described in [the research guide](https://github.com/ts06068/LemmaDuck/blob/main/docs/RESEARCH.md).

The development data use a scale of 18; the transfer data use 10 and different rows.
The analysis imports `method.py`. The verifier recomputes results using Decimal and
never imports that method. Expected mean-absolute-error reductions are 340 and 144
synthetic units. The records include predictions, verified runs, a bounded claim,
synthetic feedback, a domain rule and a method with transfer evidence. No model
account, patient data, or real-world scientific claim is involved.

Run `duck research PROJECT evaluation-demo` for an eight-trial paired evaluation of identical deterministic adapters. Both should be correct; the expected difference is zero. It tests the evaluator contract and establishes no AI performance advantage.

Use `duck research PROJECT compare actions.json` to compare declared next tests
without a model account or saved task. It excludes an already known answer and an
unavailable independent measurement, and retains the feasible unit-normalization
check. Learning and replication are ranked separately. Availability, independence,
and predicted compatibility are explicit assumptions, not facts verified by the tool.
