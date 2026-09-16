-- Backfill profiles & roles for existing auth users
INSERT INTO public.profiles (id, email, nome)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'nome', split_part(u.email,'@',1))
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::public.app_role FROM auth.users u
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role FROM auth.users u WHERE u.email = 'silviok5000@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.subscriptions (user_id, status)
SELECT u.id, 'free' FROM auth.users u
LEFT JOIN public.subscriptions s ON s.user_id = u.id
WHERE s.user_id IS NULL;

-- Ensure trigger exists on auth.users for future signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Allow admins to manage subscriptions and to set premium for any user
-- (already covered by subs_admin_all)

-- Add a "seeded" flag table is overkill — just use foods_basic count as cache check.