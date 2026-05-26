-- Add full-text search support with PostgreSQL tsvector and GIN indexes

-- Add search_vector to downloads table
-- Combines title (weight A), description (B), uploader (C) with automatic updates
ALTER TABLE "downloads"
ADD COLUMN "search_vector" tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(uploader, '')), 'C')
) STORED;

-- GIN index for fast full-text queries on downloads
CREATE INDEX "downloads_search_vector_idx" ON "downloads" USING GIN (search_vector);

-- Add search_vector to subtitle_lines table
-- Weight D ensures lower ranking than download metadata
ALTER TABLE "subtitle_lines"
ADD COLUMN "search_vector" tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', COALESCE(text, '')), 'D')
) STORED;

-- GIN index for fast full-text queries on subtitle_lines
CREATE INDEX "subtitle_lines_search_vector_idx" ON "subtitle_lines" USING GIN (search_vector);
