# Writing with an accountable author

Gemini is the default for email, translation and sentence editing. High-effort reasoning and hypothesis work use the reasoning/abduction profiles. A writing task that also questions a causal claim can use `/route reasoning` before `/ask`.

Prepare a brief with audience, purpose, facts, intended claim, uncertainty and approved samples in the same language and genre. Attach those files with `/task add`. Choose **critique**, **edit** or **draft** in the request. Drafting is supported when requested; a substantive manuscript benefits from the author's own argument and evidence before expansion.

For an edit, keep the original and a reviewable revision. Check numbers, units, denominators, conditions, negation, citations and causal strength. Separate a substantive correction from a phrasing change. A suggested factual addition needs evidence. The author approves scientific claims, correspondence and publication.

Desloping includes removing filler and repetitive transitions, but also checking whether the writing contains a specific, supported contribution. Preserve useful technical language and the author's distinctive wording. Controlled procedural language—consistent terms, explicit conditions, one action per step—is useful for instructions. It is not a requirement to make every Korean or English manuscript sound like a maintenance manual. A detector score does not validate a claim or establish authorship.

The runtime policy is [config/writing.md](../config/writing.md). Project briefs and approved instructions can specialize it. For example:

```text
/ask Edit the selected Korean email for this recipient. Preserve all dates and commitments. Show the revised draft and list any substantive changes. Use the approved examples; do not send it.
/ask Critique the selected English paragraph. Identify unsupported causal language before suggesting sentence edits. Keep the original and all citations.
```

## Reading behind the policy

- [How we use AI without making AI slop — Ahrefs](https://ahrefs.com/blog/how-we-use-ai-without-making-ai-slop/): reader value, evidence and accountable editorial judgment. [User-supplied discussion](https://news.hada.io/topic?id=33225).
- [LLM Voice — Martin Fowler](https://martinfowler.com/bliki/LLM-Voice.html): author voice and writing as part of thinking. [User-supplied discussion](https://news.hada.io/topic?id=36244).
- [Ponytail](https://github.com/DietrichGebert/ponytail): inspect existing behavior and use existing facilities before adding code. Applied to [development practice](../config/coding.md), with correctness and readable maintenance as constraints. [User-supplied discussion](https://news.hada.io/topic?id=30701).

These are practical influences, not evidence that a particular prompt improves research quality. Abduction rules organize competing explanations and tests; they do not claim to reproduce a private OpenAI research workflow or guarantee publication.
