-- W3C trace context of the request that created the order, so the capture that arrives
-- later by webhook continues the join's trace (US-36). Nullable: expand-only migration.
ALTER TABLE "orders" ADD COLUMN "trace_parent" TEXT;
