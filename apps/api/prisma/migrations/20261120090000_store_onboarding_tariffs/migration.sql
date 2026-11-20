-- Самостоятельная регистрация магазинов: заявка, фото документов. Тарифы отдельно от оферты.
ALTER TABLE "Store" ADD COLUMN "selfRegistered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Store" ADD COLUMN "applicationSubmittedAt" TIMESTAMP(3);
ALTER TABLE "Store" ADD COLUMN "applicationRejectReason" TEXT;
ALTER TABLE "Store" ADD COLUMN "binCheck" JSONB;

CREATE TYPE "StoreDocKind" AS ENUM ('SIGN_PHOTO', 'INSIDE_PHOTO', 'CONTRACT', 'ID_CARD');

CREATE TABLE "StoreDocument" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "kind" "StoreDocKind" NOT NULL,
    "data" BYTEA NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StoreDocument_storeId_kind_idx" ON "StoreDocument"("storeId", "kind");
ALTER TABLE "StoreDocument" ADD CONSTRAINT "StoreDocument_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Tariff" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "monthlyFeeTiyn" INTEGER,
    "commissionBp" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "Tariff_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Tariff_effectiveFrom_idx" ON "Tariff"("effectiveFrom");
