# 0006 — Serve avatars and cover images from a public prefix; keep submissions private

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-28 |

## Context

The threat model left "which media is public" to implementation. Avatars and cover images are shown to guests on every list screen and are copied into other services through events (`user.updated.avatarUrl`). A presigned read URL expires, so a URL stored in another service's cache would break; re-signing on every list response costs time and defeats image caching. Submission media, by contrast, should only be visible to the creator and the host until results are published.

## Decision

- One private bucket. Objects under `public/` (`public/avatars/<userId>/…`, `public/covers/<competitionId>/…`) get anonymous `GetObject` through a bucket policy; their stable URL (`S3_PUBLIC_BASE_URL/<key>`) is stored.
- Everything else (`submissions/…`) is private and read through short-lived presigned GET URLs issued after an ownership check.
- Uploads always use presigned POST with `content-length-range` and an exact `Content-Type`, keyed under the uploader's own ID, and the service verifies the object exists before saving its key.

## Consequences

- Public images can sit behind CloudFront later (SCALING.md stage 1) without code changes.
- Object keys contain random UUIDv7s, so public objects can't be enumerated by guessing.
- A user could upload an arbitrary image as an avatar; moderation is out of scope for the MVP (A-5).
