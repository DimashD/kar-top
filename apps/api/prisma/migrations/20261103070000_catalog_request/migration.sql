-- Заявки магазинов на категорию/товар в мастер-каталог. docs/27
CREATE TYPE "CatalogRequestType" AS ENUM ('CATEGORY', 'PRODUCT');
CREATE TYPE "CatalogRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "CatalogRequest" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "requestedBy" TEXT,
    "type" "CatalogRequestType" NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "categoryName" TEXT,
    "unit" "Unit",
    "note" TEXT,
    "status" "CatalogRequestStatus" NOT NULL DEFAULT 'PENDING',
    "resultId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CatalogRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CatalogRequest_status_createdAt_idx" ON "CatalogRequest"("status", "createdAt");
CREATE INDEX "CatalogRequest_storeId_idx" ON "CatalogRequest"("storeId");

ALTER TABLE "CatalogRequest" ADD CONSTRAINT "CatalogRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
