-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "customFlags" TEXT[] DEFAULT '{}';

-- AlterTable
ALTER TABLE "monitors" ADD COLUMN "customFlags" TEXT[] DEFAULT '{}';
