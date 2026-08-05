-- Add API connection fields to ai_models
ALTER TABLE ai_models
  ADD COLUMN IF NOT EXISTS model_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS api_key TEXT,
  ADD COLUMN IF NOT EXISTS endpoint TEXT;
