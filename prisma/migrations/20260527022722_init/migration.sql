-- CreateEnum
CREATE TYPE "DownloadStatus" AS ENUM ('PENDING', 'FETCHING_INFO', 'DOWNLOADING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'DELETED');

-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('CHANNEL', 'PLAYLIST', 'USER');

-- CreateEnum
CREATE TYPE "MonitorType" AS ENUM ('YOUTUBE_LIVE', 'TWITCH');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "format" TEXT,
    "quality" TEXT,
    "codec" TEXT,
    "audioOnly" BOOLEAN NOT NULL DEFAULT false,
    "audioFormat" TEXT,
    "audioBitrate" TEXT,
    "customFlags" TEXT[],
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "download_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "downloads" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "DownloadStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT,
    "thumbnail" TEXT,
    "duration" INTEGER,
    "uploader" TEXT,
    "channelUrl" TEXT,
    "uploadDate" TIMESTAMP(3),
    "format" TEXT,
    "filesize" BIGINT,
    "height" INTEGER,
    "videoType" TEXT,
    "description" TEXT,
    "category" TEXT,
    "tags" TEXT[],
    "dislikeCount" INTEGER,
    "videoId" TEXT,
    "artist" TEXT,
    "album" TEXT,
    "trackNumber" INTEGER,
    "releaseYear" INTEGER,
    "musicBrainzId" TEXT,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "speed" TEXT,
    "eta" TEXT,
    "downloadedBytes" BIGINT DEFAULT 0,
    "totalBytes" BIGINT,
    "filename" TEXT,
    "filepath" TEXT,
    "customFlags" TEXT[],
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "profileId" TEXT NOT NULL,
    "userId" TEXT,
    "storagePool" TEXT NOT NULL DEFAULT 'cache',
    "subscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "allWatchedAt" TIMESTAMP(3),

    CONSTRAINT "downloads_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SubscriptionType" NOT NULL DEFAULT 'CHANNEL',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "checkInterval" INTEGER NOT NULL DEFAULT 1800,
    "lastChecked" TIMESTAMP(3),
    "lastVideoDate" TIMESTAMP(3),
    "profileId" TEXT NOT NULL,
    "autoDownload" BOOLEAN NOT NULL DEFAULT true,
    "saveToLibrary" BOOLEAN NOT NULL DEFAULT false,
    "customFlags" TEXT[],
    "thumbnail" TEXT,
    "description" TEXT,
    "videoCount" INTEGER,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitors" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MonitorType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "lastChecked" TIMESTAMP(3),
    "waitTime" INTEGER,
    "liveDate" TIMESTAMP(3),
    "profileId" TEXT NOT NULL,
    "autoDownload" BOOLEAN NOT NULL DEFAULT true,
    "customFlags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "maxConcurrentDownloads" INTEGER NOT NULL DEFAULT 3,
    "downloadPath" TEXT NOT NULL DEFAULT '/downloads',
    "ytdlpPath" TEXT NOT NULL DEFAULT '/usr/local/bin/yt-dlp',
    "ytdlpVersion" TEXT,
    "lastYtdlpUpdate" TIMESTAMP(3),
    "autoUpdateYtdlp" BOOLEAN NOT NULL DEFAULT true,
    "updateCheckInterval" INTEGER NOT NULL DEFAULT 86400,
    "enableArchive" BOOLEAN NOT NULL DEFAULT true,
    "archivePath" TEXT,
    "cookiePath" TEXT,
    "authMode" TEXT NOT NULL DEFAULT 'password',
    "libraryPath" TEXT,
    "musicLibraryPath" TEXT,
    "cacheQuotaBytes" BIGINT NOT NULL DEFAULT 10737418240,
    "jellyfinUrl" TEXT,
    "jellyfinApiKey" TEXT,
    "jellyfinExternalUrl" TEXT,
    "plexUrl" TEXT,
    "plexToken" TEXT,
    "cleanupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cleanupUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cleanupIntervalSeconds" INTEGER NOT NULL DEFAULT 3600,
    "cleanupProfileTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cleanupGraceHours" INTEGER NOT NULL DEFAULT 24,
    "maxDurationSeconds" INTEGER DEFAULT 10800,
    "rateLimit" TEXT,
    "sleepInterval" INTEGER,
    "autoDeleteWatchedDays" INTEGER,
    "appriseUrl" TEXT,
    "notifyOnComplete" BOOLEAN NOT NULL DEFAULT false,
    "notifyOnFail" BOOLEAN NOT NULL DEFAULT false,
    "rydEnabled" BOOLEAN NOT NULL DEFAULT false,
    "backupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "backupCron" TEXT,
    "backupPath" TEXT,
    "proxyAuthEnabled" BOOLEAN NOT NULL DEFAULT false,
    "proxyAuthHeader" TEXT NOT NULL DEFAULT 'X-Forwarded-User',
    "ldapEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ldapUrl" TEXT,
    "ldapBindDn" TEXT,
    "ldapBindPassword" TEXT,
    "ldapSearchBase" TEXT,
    "ldapSearchFilter" TEXT,
    "versionCheckEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "prefs" JSONB NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archive" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "playlists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlist_items" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "downloadId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_overrides" (
    "id" TEXT NOT NULL,
    "channelUrl" TEXT NOT NULL,
    "channelName" TEXT,
    "profileId" TEXT,
    "autoDeleteDays" INTEGER,
    "sponsorblock" BOOLEAN NOT NULL DEFAULT true,
    "customFlags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backups" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "download_profiles_userId_name_key" ON "download_profiles"("userId", "name");

-- CreateIndex
CREATE INDEX "downloads_status_idx" ON "downloads"("status");

-- CreateIndex
CREATE INDEX "downloads_userId_idx" ON "downloads"("userId");

-- CreateIndex
CREATE INDEX "downloads_subscriptionId_idx" ON "downloads"("subscriptionId");

-- CreateIndex
CREATE INDEX "downloads_createdAt_idx" ON "downloads"("createdAt");

-- CreateIndex
CREATE INDEX "downloads_storagePool_idx" ON "downloads"("storagePool");

-- CreateIndex
CREATE INDEX "downloads_videoId_idx" ON "downloads"("videoId");

-- CreateIndex
CREATE INDEX "subtitle_lines_downloadId_idx" ON "subtitle_lines"("downloadId");

-- CreateIndex
CREATE INDEX "download_tasks_downloadId_idx" ON "download_tasks"("downloadId");

-- CreateIndex
CREATE INDEX "subscriptions_enabled_idx" ON "subscriptions"("enabled");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "monitors_url_key" ON "monitors"("url");

-- CreateIndex
CREATE INDEX "monitors_enabled_idx" ON "monitors"("enabled");

-- CreateIndex
CREATE INDEX "monitors_isLive_idx" ON "monitors"("isLive");

-- CreateIndex
CREATE INDEX "user_preferences_userId_idx" ON "user_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_mode_key" ON "user_preferences"("userId", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "archive_videoId_key" ON "archive"("videoId");

-- CreateIndex
CREATE INDEX "archive_videoId_idx" ON "archive"("videoId");

-- CreateIndex
CREATE INDEX "watch_progress_userId_idx" ON "watch_progress"("userId");

-- CreateIndex
CREATE INDEX "watch_progress_downloadId_idx" ON "watch_progress"("downloadId");

-- CreateIndex
CREATE UNIQUE INDEX "watch_progress_userId_downloadId_key" ON "watch_progress"("userId", "downloadId");

-- CreateIndex
CREATE INDEX "playlists_userId_idx" ON "playlists"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "playlists_userId_name_key" ON "playlists"("userId", "name");

-- CreateIndex
CREATE INDEX "playlist_items_playlistId_idx" ON "playlist_items"("playlistId");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_items_playlistId_downloadId_key" ON "playlist_items"("playlistId", "downloadId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_overrides_channelUrl_key" ON "channel_overrides"("channelUrl");

-- CreateIndex
CREATE INDEX "scheduled_job_runs_jobName_idx" ON "scheduled_job_runs"("jobName");

-- CreateIndex
CREATE INDEX "scheduled_job_runs_startedAt_idx" ON "scheduled_job_runs"("startedAt");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_profiles" ADD CONSTRAINT "download_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "download_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtitle_lines" ADD CONSTRAINT "subtitle_lines_downloadId_fkey" FOREIGN KEY ("downloadId") REFERENCES "downloads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_tasks" ADD CONSTRAINT "download_tasks_downloadId_fkey" FOREIGN KEY ("downloadId") REFERENCES "downloads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "download_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "download_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_downloadId_fkey" FOREIGN KEY ("downloadId") REFERENCES "downloads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_downloadId_fkey" FOREIGN KEY ("downloadId") REFERENCES "downloads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_overrides" ADD CONSTRAINT "channel_overrides_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "download_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
