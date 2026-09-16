-- Create function to append to array for soft delete
CREATE OR REPLACE FUNCTION public.append_to_deleted_by(msg_id UUID, user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.direct_messages
    SET deleted_by_users = array_append(COALESCE(deleted_by_users, '{}'), user_id)
    WHERE id = msg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
