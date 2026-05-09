
-- Final and Absolute Fix for Social Network Restrictions
-- This migration ensures that NO administrative role is required for profiles search or friend requests.

-- 1. Profiles Table - Full Read Access for all authenticated users
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON public.profiles;

CREATE POLICY "profiles_universal_select" ON public.profiles
FOR SELECT TO authenticated USING (true);

-- 2. Friends Table - Open Access for relationships
DROP POLICY IF EXISTS "Users can view their own friend relations" ON public.friends;
DROP POLICY IF EXISTS "Users can insert their own friend requests" ON public.friends;
DROP POLICY IF EXISTS "Users can update their own friend requests" ON public.friends;
DROP POLICY IF EXISTS "Users can delete their own friend requests" ON public.friends;
DROP POLICY IF EXISTS "friends_select_own" ON public.friends;
DROP POLICY IF EXISTS "friends_insert_own" ON public.friends;
DROP POLICY IF EXISTS "friends_update_own" ON public.friends;
DROP POLICY IF EXISTS "friends_delete_own" ON public.friends;

CREATE POLICY "friends_allow_select" ON public.friends
FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "friends_allow_insert" ON public.friends
FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "friends_allow_update" ON public.friends
FOR UPDATE TO authenticated USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

CREATE POLICY "friends_allow_delete" ON public.friends
FOR DELETE TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 3. User Roles Table - Allow anyone to check roles if needed (prevents internal query failures)
DROP POLICY IF EXISTS "roles_select_own_or_admin" ON public.user_roles;
DROP POLICY IF EXISTS "roles_select_all" ON public.user_roles;
CREATE POLICY "roles_universal_read" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- 4. Direct Messages
DROP POLICY IF EXISTS "Users can view their own direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can insert their own direct messages" ON public.direct_messages;
CREATE POLICY "dm_allow_select" ON public.direct_messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "dm_allow_insert" ON public.direct_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
