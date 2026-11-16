# Buddget Team Workflow (for everyone, including vibe coders)

Read this once before your first ticket. Roles are defined in [TEAM_STRUCTURE.md](TEAM_STRUCTURE.md).

## 1. The one-line rule

**One Linear ticket = one branch = one worktree = one PR.** Never mix tickets. Never work on `main`. Never touch files outside your role's paths.

## 2. Your daily loop

1. **Pick a ticket** in Linear (assigned to you, status Todo). Move it to **In Progress**.
2. **Start clean.** In a terminal at the main checkout, open Claude Code and paste:

   > Start ticket BUD-123. Run `git fetch origin`, create a worktree at `../buddget-wt/bud-123` on a new branch from `origin/main` using Linear's branch name for BUD-123, run `npm ci` there, and work only inside that worktree.

3. **Build with Claude Code inside that worktree only.** Tell Claude your role's paths (see TEAM_STRUCTURE) and "do not edit outside them".
4. **Before you open a PR**, paste:

   > Run `npm run verify`. Fix failures that are in my change only. Then show me `git diff --stat origin/main` so I can confirm I only touched my paths.

5. **Open the PR.** Title starts with the ticket ID: `BUD-123 fix goals empty state`. Fill the PR template (what, why, screenshots, how to test, migration needed yes/no, "depends on" line). Move the ticket to **In Review**.
6. **Wait.** Do not merge your own PR. The Owner merges. Do not start a second ticket on top of the first one's branch (see section 6).
7. **After merge**, QA verifies, ticket goes to Done. Remove your worktree:

   > Remove the worktree for BUD-123 and delete its local branch.

**Rebase every morning** on open branches: ask Claude "update this branch with origin/main and resolve conflicts, but ask me before deleting anything".

## 3. Stop and ask (do not let Claude decide these)

Stop and message the Owner in the ticket if Claude wants to:
- create or edit anything in `supabase/migrations/`, `ios/`, `android/`, `scripts/`, `.github/`, or `CLAUDE*.md`
- change a database column, table or `src/lib/store/types.ts`
- add or upgrade a dependency (`package.json`)
- create a new UI component or change an existing one in `src/components/ui`
- delete files, force-push, or run any command with `reset --hard`, `clean -fd`, `push --force`
- touch production keys, `.env*` files, or anything that says "production"

If your change needs files owned by another role, **do not edit them**: create a ticket for that role and link it.

## 4. Environments and secrets

- Use the **dev** Supabase project and dev keys only. Never point your local app at production.
- Never paste keys into code, tickets, PRs or chats. Keys live in `.env.local` (git-ignored).
- Run your app on your own port so worktrees do not clash: `PORT=31xx npm run dev`.

## 5. Branches, commits, PR size

- Branch names come from Linear (`bud-123-short-title`). Do not invent your own.
- Small PRs: under about 400 changed lines. If it is bigger, split the ticket before coding.
- Commit messages: `type(area): what` (`fix(goals): empty state copy`). Squash-merge means only the PR title matters.
- Unfinished user-facing work goes behind a flag from `src/lib/flags`, never a long-lived branch. A branch should live under 3 days.

## 6. Independent vs dependent PRs (Owner guide)

**Independent PR:** based on `main`, touches files no other open PR touches, and needs nothing from another unmerged PR. Can merge in any order.

**Dependent PR:** one of:
- **Overlapping:** two open PRs edit the same file. Whichever merges second will conflict.
- **Stacked / blocked:** PR B needs code, a migration or a Linear ticket from PR A that is not on `main` yet. B cannot work or pass `verify` until A merges.

**You do not need to classify them by eye.** Use this process, which is safe for both types:

1. **Merge one PR at a time, oldest first.** Never two in parallel.
2. After each merge, every other open PR gets **Update branch** (or the author rebases). This turns a hidden dependency into a visible conflict or failing check.
3. **Merge only when** the PR is up to date with `main`, `npm run verify` passes on it, the preview deploy works, a CODEOWNER approved, and QA ticked the test plan for risky ones.
4. A PR that conflicts or fails after update goes back to its author ("Changes requested"). It is **never closed unmerged without a comment** stating why and where the work went.
5. Blocked-by relation: if a PR needs another, the author writes `Depends on #45` in the description and sets the Linear relation "blocked by". Do not review or merge a PR whose dependency is unmerged.
6. **Rule for authors: no stacking.** If your work needs an unmerged PR, wait, or ask the Owner to merge the first one now. Stacking is how fixes get lost.

**Quick check (Owner, 2 minutes):** ask Claude in your checkout:

> List all open PRs with number, title, author and branch. For each, list the changed files (`gh pr diff N --name-only`). Report which PRs share files, which mention "Depends on", which touch migrations, and recommend a merge order (migrations first, then overlap-free PRs, then overlapping ones oldest first). Do not merge anything.

(If `gh` complains about auth, use the `GH_TOKEN` workaround from your memory notes.)

**Order of preference:** 1) PRs with a migration, because the DB must change first, applied by you; 2) bug fixes that unblock others; 3) independent PRs, oldest first; 4) PRs that overlap with one just merged, after the author updates them.

## 7. Making sure no fix is lost

- **Every PR has a Linear ticket and every ticket has a PR.** A ticket cannot reach Done without a merged PR; a PR without a ticket is not reviewed.
- **Linear statuses:** Backlog (not planned) -> Todo (planned this week) -> In Progress (branch exists) -> In Review (PR open) -> Ready for QA (merged to `main`, awaiting check) -> Done (QA verified) or Failed QA (back to the author).
- **Linear-GitHub integration** moves tickets automatically when a PR with the ticket ID opens or merges. Turn it on in Linear settings.
- **Weekly sweep (Owner, Monday, 5 min):** filter Linear for "In Review" older than 3 days and PRs open older than 3 days. Each gets merged, sent back with comments, or explicitly closed with a note. Nothing sits.
- **Closed-without-merge** PRs are listed in the sweep: if the fix still matters, the ticket goes back to Todo.

## 8. Linear conventions

- Team key `BUD`. One ticket per deliverable, with acceptance criteria written as a checklist.
- **Labels = role** (`app`, `platform`, `qa`, `growth`, `brand`, `owner`) and one type (`bug`, `feature`, `chore`, `content`).
- **Priority:** Urgent only for production-down or data loss; Owner sets priority, others suggest.
- **Bug tickets (QA template):** steps, expected, actual, device/OS/app version, screenshot or video, severity.
- Non-code tickets (marketing, content, support) use the same statuses; their "PR" is the doc, post or asset link in the ticket.
- Need something from another role? Create a ticket for them, do not edit their files. Mention the ticket in your PR.
- The old Linear release bot stays off (`scripts/linear-bot.sh` inactive per `CLAUDE.md`).

## 9. Owner runbook

- **Merge:** GitHub PR -> check the conditions in section 6 -> Squash and merge -> confirm `git log origin/main -1` -> move ticket to Ready for QA.
- **Migration PR:** read the SQL, check for drops/alters (run a SELECT for row counts first, per `CLAUDE.md`), number it, apply to dev, then production after merge, regenerate `database.types.ts`, then merge the code.
- **Release (Thursday):** working tree clean and on `main`, `npm run verify`, QA (Salah) signs off the TestFlight and Android build against the checklist, then on your explicit instruction run `bash scripts/native-release.sh`. Builds are never started automatically.
- **Hotfix:** branch from `main`, smallest possible fix, same PR rules, skip the weekly train, ship right after QA checks that specific bug.
- **Rollback:** `git revert <squash-commit>` through a PR; for a bad migration, fix forward with a new migration, never edit an applied one.
- **Backup person:** keep this runbook current so a second person could ship in an emergency.

## 10. If something goes wrong

| Problem | Do |
|---------|----|
| "My branch has conflicts" | Ask Claude to update from `origin/main`; if unsure, stop and message the Owner. Never "accept theirs" on files you did not write. |
| "Claude edited files outside my paths" | `git diff --stat origin/main`, ask Claude to revert those files, then re-run verify. |
| "verify fails on code I did not touch" | `main` may be broken or your branch is stale: update the branch; if still failing, tell the Owner. Do not "fix" unrelated failures. |
| "I committed a secret" | Tell the Owner immediately. The key must be rotated; deleting the commit is not enough. |
| "I pushed to the wrong branch" | Do nothing more; message the Owner. |
| "Two of us need the same file" | Ticket for the file's owner role, or agree on order in the ticket; never edit in parallel. |

## 11. Required reviewers (CODEOWNERS, replace with GitHub usernames)

```
*                                              @mousa
/supabase/ /scripts/ /.github/ /ios/ /android/ @mousa @fadeel
/src/app/api/ /src/lib/ /src/components/{ai,auth,sync,voice,notifications,receipt}/ @kareem @salah @fadeel
/src/app/(app)/ /src/components/               @fadeel
/src/lib/i18n/ /docs/COPY_GLOSSARY.md /docs/email-templates/ /src/app/(site-en)/ /src/app/(site-ar)/ @osama
/docs/QA_* /scripts/qa/                        @kareem @salah
/docs/growth/ /docs/analytics/                 @gabal
```

Ahmed (`@fadeel`) is the required security reviewer on every sensitive path; the Owner still does the final merge.
