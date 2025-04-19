-- Notification System Tables

-- Table for storing notification logs
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL,
  content JSONB NOT NULL,
  metadata JSONB,
  event_type TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT DEFAULT 'sent'
);

-- Table for storing user notification preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Table for storing in-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for storing message templates
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  format TEXT NOT NULL,
  content TEXT NOT NULL,
  subject TEXT,
  variables JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name)
);

-- Table for storing notification rules
CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  channels JSONB NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  template_name TEXT,
  priority TEXT DEFAULT 'medium',
  conditions JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for storing webhook configurations
CREATE TABLE IF NOT EXISTS webhook_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events JSONB NOT NULL,
  headers JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  secret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for storing webhook delivery logs
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhook_configurations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  request_payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  error TEXT,
  duration INTEGER,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for storing event logs
CREATE TABLE IF NOT EXISTS event_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data JSONB NOT NULL,
  metadata JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_timestamp ON notification_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_webhook_configurations_user_id ON webhook_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_configurations_is_active ON webhook_configurations(is_active);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_webhook_id ON webhook_delivery_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_timestamp ON webhook_delivery_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_event_logs_event_type ON event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_event_logs_user_id ON event_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_timestamp ON event_logs(timestamp);

-- Create RLS policies
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;

-- User can only see their own notifications
CREATE POLICY notification_logs_user_policy ON notification_logs
  FOR SELECT USING (auth.uid() = user_id);

-- User can only see and update their own preferences
CREATE POLICY user_notification_preferences_select_policy ON user_notification_preferences
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY user_notification_preferences_update_policy ON user_notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- User can only see their own in-app notifications
CREATE POLICY notifications_select_policy ON notifications
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY notifications_update_policy ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- User can only see and manage their own webhook configurations
CREATE POLICY webhook_configurations_select_policy ON webhook_configurations
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY webhook_configurations_insert_policy ON webhook_configurations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY webhook_configurations_update_policy ON webhook_configurations
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY webhook_configurations_delete_policy ON webhook_configurations
  FOR DELETE USING (auth.uid() = user_id);

-- User can only see their own webhook delivery logs
CREATE POLICY webhook_delivery_logs_select_policy ON webhook_delivery_logs
  FOR SELECT USING (
    webhook_id IN (
      SELECT id FROM webhook_configurations WHERE user_id = auth.uid()
    )
  );

-- User can only see their own event logs
CREATE POLICY event_logs_select_policy ON event_logs
  FOR SELECT USING (auth.uid() = user_id);
