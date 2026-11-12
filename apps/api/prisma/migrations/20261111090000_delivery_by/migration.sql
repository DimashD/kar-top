-- Два вида доставки: своя доставка магазина и курьерская служба (за счёт покупателя).
ALTER TABLE "Order" ADD COLUMN "deliveryBy" "DeliveryMode";
UPDATE "Order" o SET "deliveryBy" = CASE WHEN s."deliveryMode" = 'SERVICE' THEN 'SERVICE'::"DeliveryMode" ELSE 'OWN'::"DeliveryMode" END
  FROM "Store" s WHERE o."storeId" = s."id" AND o."fulfillment" = 'DELIVERY';
-- Курьерская служба доступна всем магазинам вместе со своей доставкой.
ALTER TABLE "Store" ALTER COLUMN "deliveryMode" SET DEFAULT 'BOTH';
UPDATE "Store" SET "deliveryMode" = 'BOTH' WHERE "deliveryMode" = 'OWN';
