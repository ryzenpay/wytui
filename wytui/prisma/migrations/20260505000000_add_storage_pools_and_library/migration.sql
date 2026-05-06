-- AlterTable: Add storagePool to downloads
ALTER TABLE "downloads" ADD COLUMN "storagePool" TEXT NOT NULL DEFAULT 'cache';

-- AlterTable: Add saveToLibrary to subscriptions
ALTER TABLE "subscriptions" ADD COLUMN "saveToLibrary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add library and Jellyfin settings, remove autoDeleteAfter
ALTER TABLE "settings" ADD COLUMN "libraryPath" TEXT;
ALTER TABLE "settings" ADD COLUMN "cacheQuotaBytes" BIGINT NOT NULL DEFAULT 10737418240;
ALTER TABLE "settings" ADD COLUMN "jellyfinUrl" TEXT;
ALTER TABLE "settings" ADD COLUMN "jellyfinApiKey" TEXT;
ALTER TABLE "settings" DROP COLUMN IF EXISTS "autoDeleteAfter";

-- CreateIndex
CREATE INDEX "downloads_storagePool_idx" ON "downloads"("storagePool");
