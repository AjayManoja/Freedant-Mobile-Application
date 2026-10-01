-- Competition title at order time, so wallet lines can say what the money was for.
ALTER TABLE "orders" ADD COLUMN "title" TEXT;
