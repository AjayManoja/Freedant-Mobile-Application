# Competition service

Owns the **core marketplace domain**. Registrations, submissions and judging stay in this service because they must change together in one local transaction.

- **Data:** categories, competitions, prize tiers, registrations (spot holds), submissions, scores, results, user snapshots
- **Responsibilities:** host wizard and publish, list/filter/search, competition detail, join (atomic spot hold), presigned uploads, judging, results, leaderboard
- **Publishes:** `competition.published`, `competition.updated`, `registration.confirmed`, `registration.rejected`, `results.published`
- **Consumes:** `user.registered`, `user.updated`, `payment.captured`, `payment.failed`
- **Built in:** Sprints 2–5
