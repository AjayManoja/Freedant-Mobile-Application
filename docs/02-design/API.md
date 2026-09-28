# API Design

| | |
|---|---|
| **Version** | 1.0 (Phase 1) |
| **Status** | Draft for review |
| **Related** | [SRS §5](../01-requirements/SRS.md#5-external-interface-requirements) · [ERD](ERD.md) · [Events](EVENTS.md) · [HLD](HLD.md) |

This is the human-readable contract driving design review; each service publishes a generated OpenAPI document (`@nestjs/swagger`) once implemented (Phase 2+), committed under `docs/02-design/openapi/<service>.yaml` per `docs/README.md`. Endpoints are grouped by service and traced to their SRS requirement.

## 1. Conventions (apply to every endpoint)

| Concern | Rule |
|---|---|
| Base path | `https://<gateway>/v1/...`; every route is versioned |
| Auth | `Authorization: Bearer <access token>` (RS256 JWT, verified locally via JWKS — no call to Identity per request); routes marked **Guest** need no token |
| Ownership | Every resource-scoped route checks the token's `sub` against the resource owner (host/creator) server-side, never trusts a client-supplied user ID (NFR-SC-02, OWASP API #1 BOLA) |
| Validation | zod schemas; unknown body fields are rejected, not silently dropped (NFR-SC-04) |
| Idempotency | Mutating routes that must never double-execute require an `Idempotency-Key` header (UUID); documented per-endpoint below |
| Pagination | Cursor-based: `?cursor=<opaque>&limit=<n>`; response includes `nextCursor: string | null`. `OFFSET` is never used (NFR-PF-03) |
| Errors | One shape everywhere: `{ "error": { "code": "STRING_CODE", "message": "human string", "requestId": "uuid" } }`; HTTP status follows the code's category (400 validation, 401 auth, 403 ownership, 404 not found, 409 conflict, 429 rate-limited, 5xx server) |
| Rate limits | Per-IP and per-account via `@nestjs/throttler` + Redis; stricter limits on OTP request/verify and on join (NFR-SC-03) |
| Tracing | Every request carries/creates `X-Request-Id`, propagated into logs and into any event the request causes (NFR-MT-04) |

## 2. Identity service

| Method & path | Auth | Purpose | Idempotency | SRS |
|---|---|---|---|---|
| `POST /v1/auth/otp/request` | Guest | Send a 6-digit code to an email; rate-limited per email+IP | — | FR-ID-01 |
| `POST /v1/auth/otp/verify` | Guest | Verify code → tokens; first success requires `displayName` in the same call or a follow-up `POST /v1/auth/complete-signup` | — | FR-ID-02, FR-ID-03 |
| `POST /v1/auth/refresh` | Refresh token (body) | Rotate refresh token, issue new access token; reuse of a rotated token revokes the whole family | — | FR-ID-04 |
| `POST /v1/auth/logout` | Bearer | Revoke this device's refresh token | — | FR-ID-05 |
| `GET /v1/me` | Bearer | Current user's profile (own email included) | — | FR-ID-06 |
| `PATCH /v1/me` | Bearer | Update display name / avatar / bio | — | FR-ID-06 |
| `POST /v1/me/avatar-upload-url` | Bearer | Presigned PUT URL for an avatar image | — | FR-ID-06 |
| `DELETE /v1/me` | Bearer | Request account deletion (anonymise) | — | FR-ID-09 |
| `GET /v1/users/{id}/public-profile` | Guest | Display name, avatar, competitions joined/won, total winnings (aggregated from Competition's cached counters — see note) | — | FR-ID-07 |
| `GET /.well-known/jwks.json` | Guest | Public keys for RS256 verification by the gateway/other services | — | FR-ID-04 |

Note: `public-profile` win/join counters are maintained by Competition (it owns registrations/results) and exposed at `GET /v1/users/{id}/public-profile` on the **Competition** service in practice; Identity's route above is kept only if profile text (name/avatar/bio) is the sole payload. Resolved in [LLD/identity.md](LLD/identity.md#public-profile-aggregation).

## 3. Competition service

### Discovery (Guest)

| Method & path | Purpose | SRS |
|---|---|---|
| `GET /v1/home` | Home sections (featured, categories, trending, upcoming, ending-soon, top-prize, recent winners) + signed-in stats if authenticated | FR-DS-01, FR-DS-02 |
| `GET /v1/competitions?category=&phase=&sort=&cursor=&limit=` | Explore list, filterable/sortable, cursor-paginated | FR-DS-03 |
| `GET /v1/search?q=&cursor=&limit=` | Full-text + trigram search, min 2 chars | FR-DS-04 |
| `GET /v1/competitions/{id}` | Full detail incl. viewer's registration/submission status if authenticated | FR-DS-05, FR-DS-06 |
| `GET /v1/hosts/top` | Top hosts by competitions run / participants / completed | FR-DS-08 |
| `GET /v1/winners/{userId}` | Winner profile: wins, placements, prize amounts | FR-JG-06 |
| `GET /v1/competitions/{id}/leaderboard` | Ranked results (only once `RESULTS_PUBLISHED`) | FR-JG-05 |

### Notify me (Bearer)

| Method & path | Purpose | Idempotency | SRS |
|---|---|---|---|
| `PUT /v1/competitions/{id}/notify` | Turn "Notify me" on | naturally idempotent (upsert) | FR-DS-07 |
| `DELETE /v1/competitions/{id}/notify` | Turn it off | naturally idempotent | FR-DS-07 |

### Hosting (Bearer, ownership-checked)

| Method & path | Purpose | Idempotency | SRS |
|---|---|---|---|
| `POST /v1/competitions/drafts` | Start a draft | — | FR-HS-01 |
| `PATCH /v1/competitions/drafts/{id}` | Save wizard step (Basics/Prize/Schedule); server derives the timeline (A-14) | — | FR-HS-01…05 |
| `GET /v1/competitions/drafts/{id}` | Resume a draft | — | FR-HS-05 |
| `POST /v1/competitions/drafts/{id}/publish` | Validate Review step, call Payment to create the `PRIZE_FUNDING` order, return checkout details; competition moves to `AWAITING_FUNDING` | `Idempotency-Key` | FR-HS-06 |
| `PATCH /v1/competitions/{id}` | Edit a published competition — **409** if `registrations` exist for it | — | FR-HS-08 |
| `POST /v1/competitions/{id}/cancel` | Cancel before results published | `Idempotency-Key` | FR-HS-09 |
| `GET /v1/me/hosted-competitions?cursor=&limit=` | "My competitions" with status/phase/registrations/submissions/revenue | — | FR-HS-10 |

### Participation (Bearer, ownership-checked)

| Method & path | Purpose | Idempotency | SRS |
|---|---|---|---|
| `POST /v1/competitions/{id}/join` | Hold a spot; confirms immediately if free, else returns order/checkout details | `Idempotency-Key` (**required**) | FR-PT-01…05 |
| `GET /v1/registrations/{id}` | Poll registration status (`HELD`→`CONFIRMED`/`REJECTED`/`EXPIRED`) while the app waits on the webhook | — | FR-PT-05 |

### Submissions (Bearer, ownership-checked)

| Method & path | Purpose | Idempotency | SRS |
|---|---|---|---|
| `POST /v1/registrations/{id}/submission/media-upload-url` | Presigned PUT scoped by content type/size | — | FR-SB-01, FR-SB-02 |
| `PATCH /v1/registrations/{id}/submission` | Save caption/media/rules-accepted as a draft, autosave-friendly | — | FR-SB-03 |
| `POST /v1/registrations/{id}/submission/submit` | Final submit — **409** if checklist incomplete or window closed | `Idempotency-Key` | FR-SB-04 |
| `GET /v1/me/submissions?status=&cursor=&limit=` | "My submissions", filterable by status | — | FR-SB-05 |

### Judging (Bearer, host-ownership-checked)

| Method & path | Purpose | Idempotency | SRS |
|---|---|---|---|
| `GET /v1/competitions/{id}/submissions` | All submissions for judging (host only, judging phase only) | — | FR-JG-01 |
| `PUT /v1/submissions/{id}/score` | Set score (0–10, one decimal) + optional comment | naturally idempotent (last write wins pre-publish) | FR-JG-02 |
| `POST /v1/competitions/{id}/publish-results` | Rank, payout, lock — **409** if any submission unscored | `Idempotency-Key` | FR-JG-03…05 |

## 4. Payment service

| Method & path | Auth | Purpose | Idempotency | SRS |
|---|---|---|---|---|
| `POST /internal/orders` | Service-to-service only (blocked at gateway from the internet) | Create an order for `ENTRY_FEE` or `PRIZE_FUNDING`; amount is computed by the caller's trusted server-side data, never by the client | `Idempotency-Key` (**required**) | FR-PY-01 |
| `POST /v1/payments/webhook/razorpay` | Razorpay signature (HMAC over raw body) | Ingest `payment.captured` / `payment.failed` / `refund.processed` | dedupe by `razorpay_event_id` | FR-PY-02 |
| `GET /v1/wallet` | Bearer | Available balance, total winnings | — | FR-PY-07 |
| `GET /v1/wallet/transactions?filter=all\|earnings\|entries\|refunds&cursor=&limit=` | Bearer | Ledger history for the signed-in user | — | FR-PY-07 |
| `POST /internal/reconciliation/run` | Service-to-service / scheduled | Daily job comparing captured payments to ledger entries | — | FR-PY-08 |

Order creation and webhook ingestion are the only two Payment routes a client-adjacent path ever touches; everything else Payment does (refunds, payout postings) happens through consumed events (see [EVENTS.md](EVENTS.md#5-events-published-by-payment)), not HTTP calls.

## 5. Notification service

| Method & path | Auth | Purpose | SRS |
|---|---|---|---|
| `GET /v1/notifications?cursor=&limit=` | Bearer | List newest-first | FR-NT-02 |
| `GET /v1/notifications/unread-count` | Bearer | Badge count for Home | FR-NT-02 |
| `POST /v1/notifications/{id}/read` | Bearer | Mark one read | FR-NT-02 |
| `POST /v1/notifications/read-all` | Bearer | Mark all read | FR-NT-02 |

Notification never accepts a route that *creates* a notification from the client — every row originates from a consumed event (§6 of [EVENTS.md](EVENTS.md)), keeping the "who can notify a user" surface entirely server-controlled.

## 6. Gateway-level rules (Nginx)

| Rule | Applies to |
|---|---|
| `/internal/*` rejected from the public internet, reachable only container-to-container | `POST /internal/orders`, `POST /internal/reconciliation/run` |
| Stricter rate limit | `/v1/auth/otp/*`, `/v1/competitions/*/join` |
| Request size cap | all routes; a lower cap on JSON bodies, uploads go direct-to-S3 via presigned URLs so the gateway never proxies media |
| TLS only, HSTS | all routes |
