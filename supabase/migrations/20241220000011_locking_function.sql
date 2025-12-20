-- Database function to acquire a lock on an item
-- This allows us to handle locking logic securely on the server side
CREATE OR REPLACE FUNCTION acquire_item_lock(target_item_id UUID, locker_id UUID, lock_until TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
DECLARE
    now_time TIMESTAMPTZ := now();
BEGIN
    UPDATE items
    SET 
        locked_by = locker_id,
        locked_until = lock_until
    WHERE 
        id = target_item_id
        AND (
            locked_by IS NULL 
            OR locked_until < now_time 
            OR locked_by = locker_id
        );
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION acquire_item_lock IS 'Atomsically attempts to acquire a 10-minute lock on an item for a specific user.';
