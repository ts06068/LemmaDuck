# Commit history migration

All 10 original commits were converted to Conventional Commits on 2026-11-09.
Commit trees, parent topology, authors, and author/committer dates were preserved.
Main and the 10 lightweight release tags were updated with exact old-ref leases.

The local recovery bundle is `backups/pre-conventional-commits.bundle` (ignored by Git).
Published release assets and their embedded manifests remain the original artifacts;
their source hashes refer to the original commits below. Rewriting messages does not
rebuild or validate those assets. Existing clones must fetch and reconcile the rewritten history.

| Original commit | Conventional commit | Subject |
| --- | --- | --- |
| `816e90798940edc75dfc3dc13486171847e1330a` | `757bd42e0d5d6a27860a4f8d705ed2d57e813483` | feat: bootstrap LemmaDuck with pinned agent workflows |
| `210371887d61ad531e87d123c719aa6df6242e47` | `83e54b246ec20da646821bc3a54372f70b2fda46` | docs(brand): add proof slate and research tagline |
| `2cfadcbaf836ea48839b28333c4af4bac7e30067` | `b093cf1211571eae01d86b688402bdd7a998ab61` | feat(runtime): use Paseo and OMP with Claude plan authentication |
| `3163928cef3cd62ef2e5522b31a004a5d5f0ecba` | `be598da125429f8d4b0dbd73b202bcdd28e629b3` | feat(workflows): add routing, scoped connectors, and Git/Jujutsu support |
| `3085775617a05d0b10433ce3038148b533c4e9d3` | `7ae17a62a53d6790ad7ff7edc0898615642f17ef` | feat(distros): introduce Base, Emacs, and Neovim distributions |
| `f468260c56452799575e26eaf577eae28036fe12` | `384976f7e20f940b6acac1373ccd4bb18ebbe37d` | refactor(distros): consolidate distributions into one monorepo |
| `f9c9238b2641fd40298d93fb266335156e9bbd6c` | `cfdc1415e0805de87bea708101c00902e4a37903` | build(packages): publish installable distros with upgrade checks |
| `3f73286bafa5131e3f9e5ffccf7a0d563d272348` | `b7a58e2ea54ef87bc15f2e73658d6f8545ca6280` | docs: simplify README and move walkthrough into documentation |
| `8d360334c73549aa01217111b2696d56fd33d593` | `dc55c90f45ba57e47cef02d483f0576954e8270b` | feat(cli): add short duck commands and compatible launchers |
| `a311b58c809f7bf25aa3a6a552762d6973c5b048` | `aed1ef251d8be5e33bb7b8839e5b9331ada2ef41` | docs(install): add remote-host and AI-agent setup guidance |

Two later README-only commits arrived during implementation and were migrated with
their file contents, authors, dates and message bodies preserved:

| Original commit | Conventional commit | Subject |
| --- | --- | --- |
| `ab162b7c993c26fbd01747476613b12cd1520a6e` | `cef96f5a1b0f2d6e3c0bf4f5e2615d0e875196c0` | docs(readme): emphasize LemmaDuck in the introduction |
| `c53cd6963b954da1d1fa2c16bafcb62171e72a21` | `1d21c10db931ecad804c0dd2af75552cff306ea8` | docs(readme): remove the command compatibility note |
