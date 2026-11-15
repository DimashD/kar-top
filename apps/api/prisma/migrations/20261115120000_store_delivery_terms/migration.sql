-- Условия своей доставки на уровне магазина: минимальный заказ и «бесплатно от».
ALTER TABLE "Store" ADD COLUMN "ownMinOrderTiyn" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Store" ADD COLUMN "ownFreeFromTiyn" INTEGER;
