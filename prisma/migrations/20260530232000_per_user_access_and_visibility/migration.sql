-- AlterTable: per-user overrides (null = inherit global default)
ALTER TABLE "users" ADD COLUMN "libraryAccess" BOOLEAN;
ALTER TABLE "users" ADD COLUMN "cacheQuotaBytes" BIGINT;

-- AlterTable: multi-tenant / per-user access defaults
ALTER TABLE "settings" ADD COLUMN "libraryAccessMode" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "settings" ADD COLUMN "statsVisibleToNonAdmins" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "settings" ADD COLUMN "showTotalSizeToNonAdmins" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: library-save requests (used in "request" mode)
CREATE TABLE "library_requests" (
    "id" TEXT NOT NULL,
    "downloadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "library_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "library_requests_downloadId_key" ON "library_requests"("downloadId");
CREATE INDEX "library_requests_status_idx" ON "library_requests"("status");
CREATE INDEX "library_requests_userId_idx" ON "library_requests"("userId");

ALTER TABLE "library_requests" ADD CONSTRAINT "library_requests_downloadId_fkey" FOREIGN KEY ("downloadId") REFERENCES "downloads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "library_requests" ADD CONSTRAINT "library_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
