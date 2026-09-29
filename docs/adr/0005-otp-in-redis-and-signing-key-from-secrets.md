# 0005 — Keep OTP codes in Redis (HMAC-hashed) and the JWT signing key in secrets, not in Postgres

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-28 |

## Context

The Phase 1 ERD drafted `otp_requests` and `signing_keys` tables in `identity_db`, while the approved project plan puts OTP codes in Redis with a TTL. The LLD suggested argon2id for code hashes.

## Decision

1. **OTP codes live in Redis**: `otp:code:<email>` (hash of the code + attempt counter, TTL = code lifetime) and `otp:cooldown:<email>` (resend cooldown, `SET NX EX`). Expiry is the TTL; single use is "whoever deletes the key signs in".
2. **Codes are hashed with HMAC-SHA256 and a server-side pepper** (`OTP_PEPPER`), not argon2id. A 6-digit code has only 10⁶ possibilities, so a slow hash doesn't stop offline brute force — only a secret key does. Online guessing is stopped by the 5-attempt limit and rate limits.
3. **The RS256 private key comes from configuration** (SSM Parameter Store SecureString in production, a throwaway key per boot in development), not a database table. Rotation publishes the old public key through `JWT_PREVIOUS_PUBLIC_JWKS` for a grace window.

## Consequences

- No OTP rows to clean up; codes vanish on their own.
- A Redis flush signs nobody in and just forces users to request a new code.
- A database dump never contains the signing key.
- ERD §2 and LLD/identity.md are updated to match.
