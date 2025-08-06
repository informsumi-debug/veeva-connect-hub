-- First, let's identify and remove duplicate configurations
-- We'll keep only the most recent configuration for each unique combination of environment_name, veeva_url, and username per user

WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, environment_name, veeva_url, username 
      ORDER BY created_at DESC
    ) as rn
  FROM veeva_configurations
)
DELETE FROM veeva_configurations 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Ensure only one active configuration per user
WITH active_configs AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id 
      ORDER BY updated_at DESC
    ) as rn
  FROM veeva_configurations
  WHERE is_active = true
)
UPDATE veeva_configurations 
SET is_active = false 
WHERE id IN (
  SELECT id FROM active_configs WHERE rn > 1
);