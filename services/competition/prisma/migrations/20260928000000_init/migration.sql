-- pg_trgm: typo-tolerant search (A-19). Trusted extension: the database owner may create it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CompetitionStatus" AS ENUM ('DRAFT', 'AWAITING_FUNDING', 'PUBLISHED', 'RESULTS_PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('HELD', 'CONFIRMED', 'EXPIRED', 'REJECTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'AUDIO', 'VIDEO');

-- CreateTable
CREATE TABLE "categories" (
    "id" SMALLSERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "status" "CompetitionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "description" TEXT,
    "category_id" SMALLINT,
    "cover_key" TEXT,
    "cover_url" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "prize_pool_paise" INTEGER,
    "entry_fee_paise" INTEGER,
    "platform_fee_paise" INTEGER,
    "max_spots" INTEGER,
    "spots_remaining" INTEGER NOT NULL DEFAULT 0,
    "confirmed_count" INTEGER NOT NULL DEFAULT 0,
    "submission_count" INTEGER NOT NULL DEFAULT 0,
    "start_at" TIMESTAMPTZ(3),
    "duration_days" SMALLINT,
    "registration_opens_at" TIMESTAMPTZ(3),
    "registration_closes_at" TIMESTAMPTZ(3),
    "submission_starts_at" TIMESTAMPTZ(3),
    "submission_ends_at" TIMESTAMPTZ(3),
    "results_due_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "results_published_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "registration_opened_notified_at" TIMESTAMPTZ(3),
    "funding_order_id" UUID,
    "funding_provider_order_id" TEXT,
    "funding_key_id" TEXT,
    "funding_idempotency_key" TEXT,
    "funding_requested_at" TIMESTAMPTZ(3),
    "funding_error" TEXT,
    "search_document" tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", ''))) STORED,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prize_tiers" (
    "competition_id" UUID NOT NULL,
    "rank" SMALLINT NOT NULL,
    "amount_paise" INTEGER NOT NULL,

    CONSTRAINT "prize_tiers_pkey" PRIMARY KEY ("competition_id","rank")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" UUID NOT NULL,
    "competition_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "status" "RegistrationStatus" NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "payment_order_id" UUID,
    "provider_order_id" TEXT,
    "payment_key_id" TEXT,
    "last_payment_error" TEXT,
    "hold_expires_at" TIMESTAMPTZ(3),
    "confirmed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "competition_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "media_key" TEXT,
    "media_kind" "MediaKind",
    "media_content_type" TEXT,
    "caption" TEXT,
    "rules_accepted" BOOLEAN NOT NULL DEFAULT false,
    "score_tenths" SMALLINT,
    "score_comment" TEXT,
    "rank" SMALLINT,
    "prize_paise" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMPTZ(3),
    "scored_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notify_subscriptions" (
    "competition_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notify_subscriptions_pkey" PRIMARY KEY ("competition_id","user_id")
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
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "competitions_host_id_created_at_idx" ON "competitions"("host_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_idempotency_key_key" ON "registrations"("idempotency_key");

-- CreateIndex
CREATE INDEX "registrations_competition_id_status_idx" ON "registrations"("competition_id", "status");

-- CreateIndex
CREATE INDEX "registrations_creator_id_created_at_idx" ON "registrations"("creator_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_registration_id_key" ON "submissions"("registration_id");

-- CreateIndex
CREATE INDEX "submissions_competition_id_status_idx" ON "submissions"("competition_id", "status");

-- CreateIndex
CREATE INDEX "submissions_creator_id_updated_at_idx" ON "submissions"("creator_id", "updated_at");

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prize_tiers" ADD CONSTRAINT "prize_tiers_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notify_subscriptions" ADD CONSTRAINT "notify_subscriptions_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written (not expressible in schema.prisma) --------------------------

-- Invariants the application also enforces; the database is the last line of defence.
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_spots_non_negative" CHECK ("spots_remaining" >= 0);
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_counts_non_negative" CHECK ("confirmed_count" >= 0 AND "submission_count" >= 0);
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_spots_within_max" CHECK ("max_spots" IS NULL OR "spots_remaining" <= "max_spots");
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_money_non_negative" CHECK (coalesce("prize_pool_paise", 0) >= 0 AND coalesce("entry_fee_paise", 0) >= 0);
ALTER TABLE "prize_tiers" ADD CONSTRAINT "prize_tiers_amount_positive" CHECK ("amount_paise" > 0);
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_score_range" CHECK ("score_tenths" IS NULL OR "score_tenths" BETWEEN 0 AND 100);

-- A-21: one active registration per creator per competition, whatever the race.
CREATE UNIQUE INDEX "registrations_one_active_per_creator" ON "registrations"("competition_id", "creator_id")
  WHERE "status" IN ('HELD', 'CONFIRMED');

-- Hold-expiry sweep scans only live holds.
CREATE INDEX "registrations_live_holds_idx" ON "registrations"("hold_expires_at") WHERE "status" = 'HELD';

-- Discovery: lists filter published competitions and sort by one of these keys (keyset pagination).
CREATE INDEX "competitions_published_closing_idx" ON "competitions"("registration_closes_at", "id") WHERE "status" = 'PUBLISHED';
CREATE INDEX "competitions_published_prize_idx" ON "competitions"("prize_pool_paise" DESC, "id") WHERE "status" = 'PUBLISHED';
CREATE INDEX "competitions_published_popular_idx" ON "competitions"("confirmed_count" DESC, "id") WHERE "status" = 'PUBLISHED';
CREATE INDEX "competitions_published_newest_idx" ON "competitions"("published_at" DESC, "id") WHERE "status" IN ('PUBLISHED', 'RESULTS_PUBLISHED');
CREATE INDEX "competitions_opening_idx" ON "competitions"("registration_opens_at") WHERE "status" = 'PUBLISHED' AND "registration_opened_notified_at" IS NULL;
CREATE INDEX "registrations_confirmed_recent_idx" ON "registrations"("confirmed_at", "competition_id") WHERE "status" = 'CONFIRMED';

-- Search (FR-DS-04): full text plus trigram similarity on title, category and host name.
CREATE INDEX "competitions_search_document_idx" ON "competitions" USING GIN ("search_document");
CREATE INDEX "competitions_title_trgm_idx" ON "competitions" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "categories_name_trgm_idx" ON "categories" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "user_profiles_name_trgm_idx" ON "user_profiles" USING GIN ("display_name" gin_trgm_ops);

-- The outbox relay polls only unpublished rows (HLD §5.1).
CREATE INDEX "outbox_events_unpublished_idx" ON "outbox_events"("created_at", "id") WHERE "published_at" IS NULL;

-- Reference data (A-20). The seed script adds demo content; categories ship with the schema.
INSERT INTO "categories" ("slug", "name", "icon", "sort_order") VALUES
  ('dance', 'Dance', 'dance', 1),
  ('music', 'Music', 'music', 2),
  ('photography', 'Photography', 'camera', 3),
  ('writing', 'Writing', 'pen', 4),
  ('art', 'Art', 'palette', 5),
  ('coding', 'Coding', 'code', 6),
  ('cooking', 'Cooking', 'chef', 7),
  ('gaming', 'Gaming', 'gamepad', 8);
