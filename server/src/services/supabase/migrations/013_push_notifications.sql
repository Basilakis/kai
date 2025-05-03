-- Migration: 013_push_notifications.sql
-- Description: Creates tables and functions for push notifications

-- Add expo_push_token to profiles table if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- Create device tokens table for multiple devices per user
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  push_token TEXT NOT NULL,
  device_type TEXT NOT NULL, -- 'ios', 'android', 'web'
  device_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id, device_id)
);

-- Create push notifications table
CREATE TABLE IF NOT EXISTS public.push_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'opened'
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create push notification logs table
CREATE TABLE IF NOT EXISTS public.push_notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID REFERENCES public.push_notifications(id) ON DELETE CASCADE,
  device_token_id UUID REFERENCES public.device_tokens(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  push_token TEXT,
  status TEXT NOT NULL, -- 'success', 'error'
  provider_response JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create push notification settings table
CREATE TABLE IF NOT EXISTS public.push_notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT TRUE,
  marketing_enabled BOOLEAN DEFAULT TRUE,
  transaction_enabled BOOLEAN DEFAULT TRUE,
  social_enabled BOOLEAN DEFAULT TRUE,
  security_enabled BOOLEAN DEFAULT TRUE,
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON public.device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_push_token ON public.device_tokens(push_token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_is_active ON public.device_tokens(is_active);

CREATE INDEX IF NOT EXISTS idx_push_notifications_user_id ON public.push_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_status ON public.push_notifications(status);
CREATE INDEX IF NOT EXISTS idx_push_notifications_created_at ON public.push_notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_push_notification_logs_notification_id ON public.push_notification_logs(notification_id);
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_user_id ON public.push_notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_status ON public.push_notification_logs(status);

-- Create RLS policies
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_settings ENABLE ROW LEVEL SECURITY;

-- User can only see and manage their own device tokens
CREATE POLICY device_tokens_select_policy ON public.device_tokens
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY device_tokens_insert_policy ON public.device_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY device_tokens_update_policy ON public.device_tokens
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY device_tokens_delete_policy ON public.device_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- User can only see their own push notifications
CREATE POLICY push_notifications_select_policy ON public.push_notifications
  FOR SELECT USING (auth.uid() = user_id);

-- User can only see their own push notification logs
CREATE POLICY push_notification_logs_select_policy ON public.push_notification_logs
  FOR SELECT USING (auth.uid() = user_id);

-- User can only see and update their own push notification settings
CREATE POLICY push_notification_settings_select_policy ON public.push_notification_settings
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY push_notification_settings_insert_policy ON public.push_notification_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY push_notification_settings_update_policy ON public.push_notification_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Create function to update the updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update the updated_at column
DROP TRIGGER IF EXISTS update_device_tokens_updated_at ON public.device_tokens;
CREATE TRIGGER update_device_tokens_updated_at
BEFORE UPDATE ON public.device_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_push_notification_settings_updated_at ON public.push_notification_settings;
CREATE TRIGGER update_push_notification_settings_updated_at
BEFORE UPDATE ON public.push_notification_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new push notifications
CREATE OR REPLACE FUNCTION public.handle_new_push_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- This is a placeholder - the actual implementation would depend on your setup
  -- In a real implementation, you would call an Edge Function or external service
  -- to send the push notification
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to send push notifications
DROP TRIGGER IF EXISTS send_push_notification_trigger ON public.push_notifications;
CREATE TRIGGER send_push_notification_trigger
AFTER INSERT ON public.push_notifications
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_push_notification();

-- Add comments for documentation
COMMENT ON TABLE public.device_tokens IS 'Device tokens for push notifications';
COMMENT ON TABLE public.push_notifications IS 'Push notifications sent to users';
COMMENT ON TABLE public.push_notification_logs IS 'Logs of push notification delivery attempts';
COMMENT ON TABLE public.push_notification_settings IS 'User settings for push notifications';
COMMENT ON FUNCTION public.update_updated_at_column IS 'Function to automatically update the updated_at column';
COMMENT ON FUNCTION public.handle_new_push_notification IS 'Function to handle sending push notifications';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('013_push_notifications.sql', NOW())
ON CONFLICT (name) DO NOTHING;
