CREATE TYPE "FeedbackSource" AS ENUM ('CUSTOMER', 'MERCHANT');
CREATE TYPE "FeedbackKind" AS ENUM ('IDEA', 'PROBLEM', 'COMPLAINT', 'PRAISE', 'OTHER');
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE');

CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "source" "FeedbackSource" NOT NULL,
    "kind" "FeedbackKind" NOT NULL,
    "text" TEXT NOT NULL,
    "phone" TEXT,
    "userId" TEXT,
    "storeId" TEXT,
    "storeSlug" TEXT,
    "page" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt");
