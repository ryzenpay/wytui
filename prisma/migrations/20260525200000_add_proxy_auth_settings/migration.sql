-- AlterTable
ALTER TABLE "settings" ADD COLUMN "proxyAuthEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "settings" ADD COLUMN "proxyAuthHeader" TEXT NOT NULL DEFAULT 'X-Forwarded-User';
