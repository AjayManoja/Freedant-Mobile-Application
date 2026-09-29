# Contributing

1. **Pick a story** from the board. Every story has acceptance criteria in [USER_STORIES.md](../01-requirements/USER_STORIES.md); if it doesn't, it isn't ready.
2. **Branch** from `main` per [GIT_WORKFLOW.md](GIT_WORKFLOW.md).
3. **Set up** once with [LOCAL_SETUP.md](LOCAL_SETUP.md).
4. **Build it** following [CODING_STANDARDS.md](CODING_STANDARDS.md). Write the integration test from the acceptance criteria first when you can.
5. **Check locally:** `pnpm lint && pnpm typecheck && pnpm test`.
6. **Update the docs** that describe what you changed: API.md / EVENTS.md contracts, ERD.md for schema changes, an ADR for a decision (template in [docs/adr](../adr/0000-template.md)).
7. **Open a PR** using the template; CI must be green before merge.

## Definition of Done

- [ ] Acceptance criteria met, each proved by a test
- [ ] Unit and integration tests written; CI green
- [ ] No hard-coded config or secrets
- [ ] Input validated, authorisation (including ownership) checked, standard error format
- [ ] Logs carry request ID; new endpoints traced
- [ ] API/event docs updated; ADR written if a decision was made
- [ ] Deployed and smoke-tested

## Reporting a bug

Use the bug-report issue template. Include the `X-Request-Id` from the failing response — it finds every log line for that request across services.
