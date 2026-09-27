# Documentation

Start with the [Project Plan](PROJECT_PLAN.md). Documents are written in the SDLC phase listed below; a feature is not done until its docs are updated.

| Folder | Documents | Written in |
|---|---|---|
| [`01-requirements/`](01-requirements/) | `SRS.md`, `USER_STORIES.md`, `SCOPE.md`, `ASSUMPTIONS.md`, `RISKS.md` | Phase 0 |
| [`02-design/`](02-design/) | `HLD.md` (C4), `LLD/<service>.md`, `ERD.md`, `EVENTS.md` (AsyncAPI), `API.md`, `THREAT_MODEL.md`, `UI_TOKENS.md`, `SCALING.md` | Phase 1 |
| [`adr/`](adr/) | Architecture decision records ([template](adr/0000-template.md)) | Phase 1, then whenever a decision is made |
| [`03-development/`](03-development/) | `LOCAL_SETUP.md`, `CONTRIBUTING.md`, `CODING_STANDARDS.md`, `GIT_WORKFLOW.md` | Phase 2 |
| [`04-testing/`](04-testing/) | `TEST_STRATEGY.md`, `TEST_REPORT.md`, `SECURITY_REVIEW.md` | Phase 4 (strategy drafted in Phase 1) |
| [`05-operations/`](05-operations/) | `DEPLOYMENT.md`, `INFRASTRUCTURE.md`, `RELEASE_PROCESS.md`, `SLO.md`, `DEBUGGING_LOG.md`, `runbooks/`, `postmortems/` | Phases 5–6 (debugging log from Phase 2 on) |

## Conventions

- Markdown only; diagrams as Mermaid so they render on GitHub and diff in PRs.
- Architecture diagrams follow the C4 model (context → container → component).
- One ADR per decision, numbered sequentially, never edited after acceptance — supersede it with a new ADR instead.
