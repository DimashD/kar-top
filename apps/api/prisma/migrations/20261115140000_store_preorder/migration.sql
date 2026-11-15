-- Предзаказ: заказы до cutoff — на следующий рабочий день, после — через день.
ALTER TABLE "Store" ADD COLUMN "preorderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Store" ADD COLUMN "preorderCutoff" TEXT NOT NULL DEFAULT '20:00';
