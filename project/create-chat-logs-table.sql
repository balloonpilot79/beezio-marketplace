-- Create chat_logs table for the chatbot
CREATE TABLE IF NOT EXISTS chat_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    event TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own chat logs
CREATE POLICY "Users can insert their own chat logs" ON chat_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow users to view their own chat logs
CREATE POLICY "Users can view their own chat logs" ON chat_logs
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Admin users can view all chat logs
CREATE POLICY "Admins can view all chat logs" ON chat_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );