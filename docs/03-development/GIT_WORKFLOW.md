# Git Workflow

Trunk-based development ([PROJECT_PLAN](../PROJECT_PLAN.md#environments-and-delivery)).

## Branches

- `main` is always deployable and protected: changes land only through a pull request with green CI.
- Work happens on short-lived branches cut from `main`, merged within a few days:
  - `feat/<scope>-<topic>` — a user story or part of one (`feat/competition-join-hold`)
  - `fix/<scope>-<topic>` — a bug
  - `docs/<topic>`, `chore/<topic>`, `ci/<topic>`
- Rebase on `main` before merging; squash-merge so each PR is one commit on `main`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), checked by commitlint on every commit:

```text
feat(competition): hold a spot atomically when joining

Closes #42
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`, `ci`, `build`. Scopes: `mobile`, `identity`, `competition`, `payment`, `notification`, `shared`, `server-kit`, `infra`, `ci`, `docs`.

release-please turns `feat`/`fix` commits on `main` into versions and the changelog (Phase 5).

## Pull requests

- Link the issue (`Closes #n`) and fill in the template's Definition of Done.
- Keep them small: one story, or one slice of one.
- Schema changes follow expand → migrate → contract; say so in the PR.

## Hooks

Installed by `pnpm install` (Husky):

| Hook | Runs |
|---|---|
| `pre-commit` | Prettier on staged files; gitleaks on the staged diff (if installed) |
| `commit-msg` | commitlint |

Never bypass them with `--no-verify`; fix the cause instead.
