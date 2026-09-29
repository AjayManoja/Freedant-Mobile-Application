-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrderPurpose" AS ENUM ('ENTRY_FEE', 'PRIZE_FUNDING');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'CAPTURED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "RefundReason" AS ENUM ('CANCELLATION', 'LATE_CAPTURE_REJECTED', 'FUNDING_REJECTED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('EXTERNAL', 'PLATFORM', 'ESCROW', 'USER');

-- CreateEnum
CREATE TYPE "LedgerKind" AS ENUM ('ENTRY_FEE', 'PRIZE_FUNDING', 'REFUND', 'PRIZE', 'HOST_REVENUE', 'UNAWARDED_RETURN', 'ESCROW_RETURN');

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "purpose" "OrderPurpose" NOT NULL,
    "reference_id" UUID NOT NULL,
    "competition_id" UUID NOT NULL,
    "payer_id" UUID NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "platform_fee_paise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "idempotency_key" TEXT NOT NULL,
    "provider_order_id" TEXT,
    "provider_payment_id" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "failure_reason" TEXT,
    "captured_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "raw_body" TEXT NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "reason" "RefundReason" NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "provider_refund_id" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "type" "AccountType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" UUID NOT NULL,
    "kind" "LedgerKind" NOT NULL,
    "subject_user_id" UUID,
    "competition_id" UUID,
    "reference_id" UUID NOT NULL,
    "display_amount_paise" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_events" (
    "event_id" UUID NOT NULL,
    "consumer_name" TEXT NOT NULL,
    "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_events_pkey" PRIMARY KEY ("event_id","consumer_name")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "orders_provider_order_id_key" ON "orders"("provider_order_id");

-- CreateIndex
CREATE INDEX "orders_reference_id_idx" ON "orders"("reference_id");

-- CreateIndex
CREATE INDEX "orders_status_captured_at_idx" ON "orders"("status", "captured_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_event_id_key" ON "webhook_events"("provider_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_order_id_key" ON "refunds"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_provider_refund_id_key" ON "refunds"("provider_refund_id");

-- CreateIndex
CREATE INDEX "refunds_status_updated_at_idx" ON "refunds"("status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_type_owner_id_key" ON "ledger_accounts"("type", "owner_id");

-- CreateIndex
CREATE INDEX "ledger_transactions_subject_user_id_created_at_idx" ON "ledger_transactions"("subject_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_kind_reference_id_key" ON "ledger_transactions"("kind", "reference_id");

-- CreateIndex
CREATE INDEX "ledger_entries_account_id_created_at_idx" ON "ledger_entries"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries"("transaction_id");

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written (not expressible in schema.prisma) --------------------------

ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_valid" CHECK ("amount_paise" > 0 AND "platform_fee_paise" >= 0 AND "platform_fee_paise" < "amount_paise");
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_positive" CHECK ("amount_paise" > 0);
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_non_zero" CHECK ("amount_paise" <> 0);

-- NFR-RL-05: every ledger transaction sums to zero. Checked at COMMIT (deferred), so the
-- entries of one transaction can be inserted one by one.
CREATE FUNCTION ledger_assert_balanced() RETURNS trigger AS $$
DECLARE
  total bigint;
BEGIN
  SELECT coalesce(sum(amount_paise), 0) INTO total FROM ledger_entries WHERE transaction_id = NEW.transaction_id;
  IF total <> 0 THEN
    RAISE EXCEPTION 'ledger transaction % is unbalanced by % paise', NEW.transaction_id, total
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ledger_entries_balanced"
  AFTER INSERT ON "ledger_entries"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_assert_balanced();

-- FR-PY-03: entries are never updated or deleted; corrections are new transactions.
CREATE FUNCTION ledger_forbid_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'the ledger is append-only (% on %)', TG_OP, TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ledger_entries_append_only" BEFORE UPDATE OR DELETE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION ledger_forbid_change();
CREATE TRIGGER "ledger_transactions_append_only" BEFORE UPDATE OR DELETE ON "ledger_transactions"
  FOR EACH ROW EXECUTE FUNCTION ledger_forbid_change();

CREATE INDEX "refunds_pending_idx" ON "refunds"("updated_at") WHERE "status" = 'PENDING';
CREATE INDEX "outbox_events_unpublished_idx" ON "outbox_events"("created_at", "id") WHERE "published_at" IS NULL;

-- System accounts that always exist.
INSERT INTO "ledger_accounts" ("id", "type", "owner_id") VALUES
  ('00000000-0000-7000-8000-000000000001', 'EXTERNAL', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-7000-8000-000000000002', 'PLATFORM', '00000000-0000-0000-0000-000000000000');
