
CREATE TABLE IF NOT EXISTS public.active_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'ringing', -- ringing, connected
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.active_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see calls they are part of"
ON public.active_calls FOR SELECT
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can initiate calls"
ON public.active_calls FOR INSERT
WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Users can update their calls"
ON public.active_calls FOR UPDATE
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can end their calls"
ON public.active_calls FOR DELETE
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.active_calls;
