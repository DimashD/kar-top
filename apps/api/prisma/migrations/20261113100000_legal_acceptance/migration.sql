-- Юридические документы: журнал принятия и реквизиты продавца у магазина.
CREATE TYPE "LegalDoc" AS ENUM ('TERMS', 'PD_CONSENT', 'MERCHANT_OFFER');
CREATE TYPE "LegalMethod" AS ENUM ('CLICK', 'SMS', 'ECP', 'PAPER');

ALTER TABLE "Store" ADD COLUMN "legalName" TEXT;
ALTER TABLE "Store" ADD COLUMN "legalBin" TEXT;

CREATE TABLE "LegalAcceptance" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "storeId" TEXT,
  "doc" "LegalDoc" NOT NULL,
  "version" TEXT NOT NULL,
  "method" "LegalMethod" NOT NULL,
  "ip" TEXT,
  "userAgent" TEXT,
  "meta" JSONB,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LegalAcceptance_userId_doc_idx" ON "LegalAcceptance"("userId", "doc");
CREATE INDEX "LegalAcceptance_storeId_doc_idx" ON "LegalAcceptance"("storeId", "doc");
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
