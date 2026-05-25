-- Add new fields to downloads table
ALTER TABLE "downloads" ADD COLUMN "videoType" TEXT;
ALTER TABLE "downloads" ADD COLUMN "description" TEXT;
ALTER TABLE "downloads" ADD COLUMN "category" TEXT;
ALTER TABLE "downloads" ADD COLUMN "tags" TEXT[] DEFAULT '{}';
ALTER TABLE "downloads" ADD COLUMN "dislikeCount" INTEGER;
ALTER TABLE "downloads" ADD COLUMN "videoId" TEXT;

-- Add index on videoId
CREATE INDEX "downloads_videoId_idx" ON "downloads"("videoId");

-- Add new fields to settings table
ALTER TABLE "settings" ADD COLUMN "autoDeleteWatchedDays" INTEGER;
ALTER TABLE "settings" ADD COLUMN "appriseUrl" TEXT;
ALTER TABLE "settings" ADD COLUMN "notifyOnComplete" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "settings" ADD COLUMN "notifyOnFail" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "settings" ADD COLUMN "backupEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "settings" ADD COLUMN "backupCron" TEXT;
ALTER TABLE "settings" ADD COLUMN "backupPath" TEXT;
ALTER TABLE "settings" ADD COLUMN "ldapEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "settings" ADD COLUMN "ldapUrl" TEXT;
ALTER TABLE "settings" ADD COLUMN "ldapBindDn" TEXT;
ALTER TABLE "settings" ADD COLUMN "ldapBindPassword" TEXT;
ALTER TABLE "settings" ADD COLUMN "ldapSearchBase" TEXT;
ALTER TABLE "settings" ADD COLUMN "ldapSearchFilter" TEXT;

-- Create watch_progress table
CREATE TABLE "watch_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "downloadId" TEXT NOT NULL,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duration" DOUBLE PRECISION,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "watchedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watch_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "watch_progress_userId_downloadId_key" ON "watch_progress"("userId", "downloadId");
CREATE INDEX "watch_progress_userId_idx" ON "watch_progress"("userId");
CREATE INDEX "watch_progress_downloadId_idx" ON "watch_progress"("downloadId");

ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_downloadId_fkey" FOREIGN KEY ("downloadId") REFERENCES "downloads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create playlists table
CREATE TABLE "playlists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "playlists_userId_name_key" ON "playlists"("userId", "name");
CREATE INDEX "playlists_userId_idx" ON "playlists"("userId");

ALTER TABLE "playlists" ADD CONSTRAINT "playlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create playlist_items table
CREATE TABLE "playlist_items" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "downloadId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "playlist_items_playlistId_downloadId_key" ON "playlist_items"("playlistId", "downloadId");
CREATE INDEX "playlist_items_playlistId_idx" ON "playlist_items"("playlistId");

ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_downloadId_fkey" FOREIGN KEY ("downloadId") REFERENCES "downloads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create channel_overrides table
CREATE TABLE "channel_overrides" (
    "id" TEXT NOT NULL,
    "channelUrl" TEXT NOT NULL,
    "channelName" TEXT,
    "profileId" TEXT,
    "autoDeleteDays" INTEGER,
    "sponsorblock" BOOLEAN NOT NULL DEFAULT true,
    "customFlags" TEXT[] DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "channel_overrides_channelUrl_key" ON "channel_overrides"("channelUrl");

ALTER TABLE "channel_overrides" ADD CONSTRAINT "channel_overrides_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "download_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create backups table
CREATE TABLE "backups" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- Create scheduled_job_runs table
CREATE TABLE "scheduled_job_runs" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "error" TEXT,
    "details" TEXT,

    CONSTRAINT "scheduled_job_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scheduled_job_runs_jobName_idx" ON "scheduled_job_runs"("jobName");
CREATE INDEX "scheduled_job_runs_startedAt_idx" ON "scheduled_job_runs"("startedAt");

-- Full-text search on downloads
ALTER TABLE "downloads" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("uploader", ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS "downloads_search_idx" ON "downloads" USING GIN ("search_vector");
