-- ADD DELETION_REQUESTED_AT COLUMN TO PROFILES TABLE
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deletion_requested_at timestamp with time zone;
