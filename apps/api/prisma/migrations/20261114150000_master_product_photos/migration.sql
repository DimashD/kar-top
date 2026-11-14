-- Фото реального товара (исходник для генерации) и сгенерированная карточка товара.
ALTER TABLE "MasterProduct" ADD COLUMN "sourcePhoto" BYTEA;
ALTER TABLE "MasterProduct" ADD COLUMN "sourcePhotoType" TEXT;
ALTER TABLE "MasterProduct" ADD COLUMN "sourcePhotoAt" TIMESTAMP(3);
ALTER TABLE "MasterProduct" ADD COLUMN "photoDraft" BYTEA;
ALTER TABLE "MasterProduct" ADD COLUMN "photoDraftType" TEXT;
ALTER TABLE "MasterProduct" ADD COLUMN "photo" BYTEA;
ALTER TABLE "MasterProduct" ADD COLUMN "photoType" TEXT;
ALTER TABLE "MasterProduct" ADD COLUMN "photoAt" TIMESTAMP(3);
