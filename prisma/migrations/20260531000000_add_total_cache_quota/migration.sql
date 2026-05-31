-- Global total cache cap across all users (null = auto: disk capacity − 5 GB).
ALTER TABLE "settings" ADD COLUMN "totalCacheQuotaBytes" BIGINT;
