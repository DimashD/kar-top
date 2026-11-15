-- Видимость магазинов: по умолчанию не в общем списке (только по ссылке и у тех, кто заходил).
ALTER TABLE "Store" ADD COLUMN "listed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Store" ADD COLUMN "listingRequestedAt" TIMESTAMP(3);
-- Показ всем: бесплатный период (новым магазинам) → подписка; цена и отметка о напоминании.
ALTER TABLE "Store" ADD COLUMN "listedFreeUntil" TIMESTAMP(3);
ALTER TABLE "Store" ADD COLUMN "listedPaidUntil" TIMESTAMP(3);
ALTER TABLE "Store" ADD COLUMN "listingPriceTiyn" INTEGER;
ALTER TABLE "Store" ADD COLUMN "listingReminder" TEXT;

-- Магазины, которые покупатель открывал (для его списка на всех устройствах).
CREATE TABLE "StoreVisit" (
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreVisit_pkey" PRIMARY KEY ("userId","storeId")
);
ALTER TABLE "StoreVisit" ADD CONSTRAINT "StoreVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreVisit" ADD CONSTRAINT "StoreVisit_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
