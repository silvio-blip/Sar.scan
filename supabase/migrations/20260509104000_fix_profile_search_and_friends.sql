
-- 1. Fix Profiles select policy to allow all authenticated users to search/view other profiles
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 2. Create Friends table if it doesn't already exist (it might have been missed in earlier migrations)
CREATE TABLE IF NOT EXISTS public.friends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(sender_id, receiver_id)
);

-- Enable RLS for Friends
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- Friends Policies
DROP POLICY IF EXISTS "Users can view their own friend relations" ON public.friends;
CREATE POLICY "Users can view their own friend relations"
    ON public.friends FOR SELECT
    TO authenticated
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can insert their own friend requests" ON public.friends;
CREATE POLICY "Users can insert their own friend requests"
    ON public.friends FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update their own friend requests" ON public.friends;
CREATE POLICY "Users can update their own friend requests"
    ON public.friends FOR UPDATE
    TO authenticated
    USING (auth.uid() = receiver_id)
    WITH CHECK (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can delete their own friend requests" ON public.friends;
CREATE POLICY "Users can delete their own friend requests"
    ON public.friends FOR DELETE
    TO authenticated
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Enable Realtime for friends
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
