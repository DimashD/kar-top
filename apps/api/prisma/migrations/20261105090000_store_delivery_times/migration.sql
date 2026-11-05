-- Время готовности к передаче курьерской службе и средняя продолжительность своей доставки (минуты).
ALTER TABLE "Store" ADD COLUMN "courierHandoverMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Store" ADD COLUMN "ownDeliveryMinutes" INTEGER NOT NULL DEFAULT 60;
