# Observational-medicine evaluation, 2026-11-09

The public-data reproduction verified the numerical analysis. The live review pilot
**did not demonstrate an advantage for the inquiry instructions**. All 24 planned
trials completed; repeats are grouped within four cases. No prompt or rubric was
retuned to improve these results.

| Outcome | Baseline | Candidate |
| --- | ---: | ---: |
| Issue F1 | 0.950 | 0.933 |
| Critical-problem recall | 1.000 | 1.000 |
| Appropriate claim scope | 1.000 | 1.000 |
| Selected next check | 1.000 | 1.000 |
| Model calls | 20 | 26 |
| Tool calls | 8 | 15 |
| Provider-reported tokens | 15,514 | 25,980 |
| Persona validity (1–5) | 4.75 | 4.50 |
| Persona importance (1–5) | 3.00 | 3.00 |
| Persona usefulness (1–5) | 3.50 | 3.25 |

Both conditions used the authenticated `openai-codex` subscription route and the same
`gpt-6-sol` model, adapter, case facts, shared tools and declared ceilings. The candidate
received the inquiry instructions. Extra usage and auto-refill were owner-confirmed
off. Neither monetary cost nor remaining quota is inferred from token receipts.

The original report hash is
`64507b092ac6425a57aad2860b1b317d4ef0fd5d45aa3714af1042244420ebb5`.
The original private report is retained locally. [summary.json](summary.json) records
aggregates and limitations; [cases.json](cases.json) preserves the visible answers;
[ratings.json](ratings.json) contains every persona rating; identities were revealed
through the CLI after the ratings were recorded. The same implementation agent had
already seen aggregate results and seven condition labels. The user requested a
separate reviewer persona. This is role-based AI self-review, not an independent or
blinded domain evaluation. See the [review and methodological references](persona-review.md).

The frozen exact-label rubric penalizes qualified extra confounding warnings and
misses some actionable wording errors. Original automated scores are preserved.
Future evaluations should use independently authored cases, richer scoring anchors,
and genuinely informative next actions. The first pilot captured parent-runtime
modules during the run; future protocols commit their hashes and instructions before
dispatch. The installed Codex adapter does not forward an output-token cap, so token
ceilings are checked after a response, with overruns counted as failures.

The NHEFS reproduction used 1,566 complete cases from 1,629 records, with 63 missing
outcomes. The crude contrast was 2.5406 kg and the normalized IPW contrast 3.4405 kg;
the refitted participant-bootstrap interval was [2.5572, 4.5403] kg. Independent
numerical verification passed. The +0.9000 kg adjustment shift contradicted both
initial exploratory hypotheses and remains an open anomaly. This is an **association**
in a public teaching sample, not an identified clinical treatment effect. Source,
denominators, diagnostics and the original record hashes are in
[nhefs-reproduction.json](nhefs-reproduction.json).

These findings support the software's provenance and inquiry controls. They do not
establish new science, general improvements in reasoning, or usefulness in real
observational research. The promoted method and correction in the separate inquiry
demo were validated on synthetic development/transfer inputs; field transfer and
qualified independent domain review remain outside this evidence.
