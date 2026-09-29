# 0004 — Use RustFS instead of MinIO as local S3-compatible storage

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-28 |

## Context

The plan uses MinIO locally in place of AWS S3. MinIO's community edition no longer publishes container images on Docker Hub (`minio/minio` returns "not found" as of September 2026), and pinned historical images receive no security fixes.

## Options considered

1. **Pinned old MinIO image** from a mirror — works, unmaintained.
2. **LocalStack** — very faithful S3, heavier, and its free tier's terms have been changing.
3. **RustFS 1.0** — Apache-2.0, S3-compatible (including POST policies and bucket policies), single container, actively released.

## Decision

RustFS (`rustfs/rustfs:1.0.0`) in `infra/docker/compose.yaml`. The bucket, its `public/*` read policy and CORS are created by a one-shot `amazon/aws-cli` container, so the setup is plain S3 API calls that would work against any S3 implementation, including AWS itself.

## Consequences

- Application code only talks S3 API through `ObjectStorage`; production (AWS S3) is unaffected.
- If RustFS diverges from S3 on something we use (presigned POST conditions are the most likely), the integration shows it locally first; fall back to LocalStack and supersede this ADR.
