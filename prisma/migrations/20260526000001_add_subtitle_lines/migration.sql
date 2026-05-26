-- CreateTable
CREATE TABLE "subtitle_lines" (
    "id" TEXT NOT NULL,
    "downloadId" TEXT NOT NULL,
    "startTime" DOUBLE PRECISION NOT NULL,
    "endTime" DOUBLE PRECISION NOT NULL,
    "text" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'en',

    CONSTRAINT "subtitle_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subtitle_lines_downloadId_idx" ON "subtitle_lines"("downloadId");

-- AddForeignKey
ALTER TABLE "subtitle_lines" ADD CONSTRAINT "subtitle_lines_downloadId_fkey" FOREIGN KEY ("downloadId") REFERENCES "downloads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
