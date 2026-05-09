-- Add reply and delete support to direct_messages
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.direct_messages(id) ON DELETE SET NULL;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS is_deleted_for_all BOOLEAN DEFAULT false;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS deleted_by_users UUID[] DEFAULT '{}';

-- Update policy to allow users to update their own messages (for deletion)
CREATE POLICY "Users can update their own messages (is_deleted)"
    ON public.direct_messages
    FOR UPDATE
    USING (auth.uid() = sender_id)
    WITH CHECK (auth.uid() = sender_id);
