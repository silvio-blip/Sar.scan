
-- Force public profiles for all authenticated users
-- Drop all possible old policy names to be safe
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;

-- Create the most permissive select policy for profiles
CREATE POLICY "profiles_select_all_authenticated" ON public.profiles 
FOR SELECT TO authenticated USING (true);

-- Ensure friends table is also fully permissive for users' own data
DROP POLICY IF EXISTS "Users can view their own friend relations" ON public.friends;
DROP POLICY IF EXISTS "Users can insert their own friend requests" ON public.friends;
DROP POLICY IF EXISTS "Users can update their own friend requests" ON public.friends;
DROP POLICY IF EXISTS "Users can delete their own friend requests" ON public.friends;

CREATE POLICY "friends_select_own" ON public.friends
FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "friends_insert_own" ON public.friends
FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "friends_update_own" ON public.friends
FOR UPDATE TO authenticated 
USING (auth.uid() = receiver_id OR auth.uid() = sender_id)
WITH CHECK (auth.uid() = receiver_id OR auth.uid() = sender_id);

CREATE POLICY "friends_delete_own" ON public.friends
FOR DELETE TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Also ensure user_roles doesn't block thing
DROP POLICY IF EXISTS "roles_select_own_or_admin" ON public.user_roles;
CREATE POLICY "roles_select_all" ON public.user_roles FOR SELECT TO authenticated USING (true);
