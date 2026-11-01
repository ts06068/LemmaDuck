# Development practice

Inspect the implementation and callers before editing. Check whether the requested behavior already exists, whether the standard library or platform supplies it, and whether installed dependencies can provide it. Add the smallest readable change that satisfies the requirement.

Preserve supported inputs, partial-failure recovery and existing callers. Validate trust boundaries and preserve data integrity and accessibility. Keep code explicit when shortening it would obscure behavior. Introduce a helper or dependency only when it reduces real duplication or complexity. Run the checks relevant to the changed behavior and record their results.

Use the repository's Git or Jujutsu workflow. Inspect status and the diff before modifying history. Use separate branches, bookmarks or workspaces for concurrent changes. Connect issue references, the resulting commit and test evidence. Treat repository rules and the user's stated publishing authority as the scope for remote writes.

The host's `lemmaduck vcs PATH status|diff|log` commands inspect version control. `lemmaduck connector list`, `tools ACCOUNT` and `call ACCOUNT TOOL ARGS.json` access configured GitHub, Linear and Jira tools. Remote write calls require explicit user authorization and a unique `--apply REQUEST-ID` receipt.
