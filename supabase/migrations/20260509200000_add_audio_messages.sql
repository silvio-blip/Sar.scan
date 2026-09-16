
-- Add audio_url support to direct_messages
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS audio_duration INTEGER;

-- Create storage bucket for audio messages if not exists
-- Note: SQL for bucket creation might vary depending on Supabase version, 
-- but usually we can try inserting into storage.buckets.
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-messages', 'audio-messages', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for audio-messages bucket
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'audio-messages');
CREATE POLICY "Users can upload audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio-messages' AND auth.uid() IS NOT NULL);
