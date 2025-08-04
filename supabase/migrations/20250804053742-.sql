-- Clean up duplicate active configurations by keeping only the most recent one for each user
UPDATE veeva_configurations 
SET is_active = false 
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id 
  FROM veeva_configurations 
  WHERE is_active = true 
  ORDER BY user_id, created_at DESC
);