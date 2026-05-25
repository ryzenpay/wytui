-- AlterEnum
ALTER TYPE "DownloadStatus" ADD VALUE 'DELETED';

-- AlterTable
ALTER TABLE "downloads" ADD COLUMN     "allWatchedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "cleanupEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cleanupUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cleanupIntervalSeconds" INTEGER NOT NULL DEFAULT 3600,
ADD COLUMN     "cleanupProfileTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cleanupGraceHours" INTEGER NOT NULL DEFAULT 24;
