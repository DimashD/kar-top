-- CreateEnum
CREATE TYPE "Fulfillment" AS ENUM ('DELIVERY', 'PICKUP');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "fulfillment" "Fulfillment" NOT NULL DEFAULT 'DELIVERY',
ADD COLUMN     "pickupAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pickupLeadMinutes" INTEGER NOT NULL DEFAULT 60;
