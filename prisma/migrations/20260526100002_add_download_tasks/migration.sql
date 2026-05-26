-- CreateTable
CREATE TABLE "download_tasks" (
    "id" TEXT NOT NULL,
    "downloadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" DOUBLE PRECISION,
    "message" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "download_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "download_tasks_downloadId_idx" ON "download_tasks"("downloadId");

-- AddForeignKey
ALTER TABLE "download_tasks" ADD CONSTRAINT "download_tasks_downloadId_fkey" FOREIGN KEY ("downloadId") REFERENCES "downloads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
