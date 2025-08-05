-- Clean up duplicate active configurations and ensure only one active per user
-- First, create a function to clean up duplicates
DO $$
DECLARE
    user_rec RECORD;
    config_rec RECORD;
    active_count INTEGER;
BEGIN
    -- For each user with active configurations
    FOR user_rec IN 
        SELECT user_id, COUNT(*) as active_count
        FROM veeva_configurations 
        WHERE is_active = true 
        GROUP BY user_id 
        HAVING COUNT(*) > 1
    LOOP
        -- Deactivate all but the most recent configuration for this user
        UPDATE veeva_configurations 
        SET is_active = false 
        WHERE user_id = user_rec.user_id 
        AND is_active = true 
        AND id NOT IN (
            SELECT id 
            FROM veeva_configurations 
            WHERE user_id = user_rec.user_id 
            AND is_active = true 
            ORDER BY created_at DESC 
            LIMIT 1
        );
    END LOOP;
END $$;