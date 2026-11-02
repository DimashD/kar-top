-- Лид «Стать партнёром» (заявка мерчанта с сайта/приложения). docs/27
CREATE TYPE "PartnerLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'REJECTED');

CREATE TABLE "PartnerLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "company" TEXT,
    "twogisUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'web',
    "status" "PartnerLeadStatus" NOT NULL DEFAULT 'NEW',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartnerLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerLead_status_createdAt_idx" ON "PartnerLead"("status", "createdAt");
CREATE INDEX "PartnerLead_phone_idx" ON "PartnerLead"("phone");
