# Identity service

Owns **who the user is**.

- **Data:** users, profiles, refresh tokens (OTP codes live in Redis with a TTL)
- **Responsibilities:** email OTP login, access/refresh token issue and rotation, profile read/update, publishing the JWKS public key
- **Publishes:** `user.registered`, `user.updated`
- **Consumes:** —
- **Built in:** Sprint 1
