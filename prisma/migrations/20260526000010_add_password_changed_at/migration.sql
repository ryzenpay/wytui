-- Add passwordChangedAt column to User model for session revocation
ALTER TABLE "users" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
