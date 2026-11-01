# Git, Jujutsu and issue tracking

Git and Jujutsu track the local checkout. GitHub hosts repositories, pull requests and checks. Linear and Jira track project work. LemmaDuck connects those roles without requiring a change of editor.

Full setup installs checksum-pinned Jujutsu 0.46.0 on the Linux x64 host. Git is a setup prerequisite. Existing Git repositories continue to work. To adopt Jujutsu for a chosen checkout, review its [Git compatibility guide](https://www.jj-vcs.dev/latest/git-compatibility/) and initialize a colocated workspace yourself:

```sh
cd /path/to/repo
jj git init --colocate
```

This changes local repository metadata. LemmaDuck never converts a repository automatically. In colocated repositories it detects `.jj` first. Git commands remain available for GitHub and editor integrations; follow Jujutsu's synchronization guidance when mixing commands.

Inspect either backend from the host terminal:

```sh
duck vcs /path/to/repo status
duck vcs /path/to/repo diff
duck vcs /path/to/repo log
```

Pi and Gemini expose the same inspection through `inspect_vcs`. Task checkpoints include backend, revision, status and diff summary. Jujutsu inspection uses `--ignore-working-copy --at-op=@`: it reports the **last recorded working-copy state** and avoids creating an operation or merging concurrent operation heads. Run `jj status` in the terminal when you intend to refresh that snapshot. Untracked files appear in status; they are not guaranteed to have content in a diff. Missing executables or invalid metadata produce an explicit inspection error.

OMP can use the installed Git/jj commands for normal development, commits and bookmarks. Review the current changes before history edits or remote publishing. Do not rewrite shared history unless the task authorizes it.

Configure GitHub, Linear or Jira with the [connector guide](CONNECTORS.md). Link an issue or pull request to the Pi task:

```text
/task link https://github.com/OWNER/REPO/issues/123
```

The link is retained in checkpoints and handoffs. Use a Linear/Jira issue URL the same way. Linking records context; it does not fetch the issue or synchronize its status. After reviewing a patch and test results, explicitly authorize any issue transition or PR action through the configured connector. OMP keeps its own coding session record, so include the issue URL and validation result in that session and the eventual commit/PR description.

[Jujutsu CLI reference](https://www.jj-vcs.dev/latest/cli-reference/)
