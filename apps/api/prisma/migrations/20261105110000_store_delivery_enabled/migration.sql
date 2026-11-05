-- Своя доставка магазина: вкл/выкл (выключена — только самовывоз).
ALTER TABLE "Store" ADD COLUMN "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true;
