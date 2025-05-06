-- Migration: 026_enhanced_prompt_tracking.sql
-- Description: Enhances prompt success tracking with more detailed feedback options and analytics

-- Add new columns to system_prompt_success_tracking table
ALTER TABLE public.system_prompt_success_tracking 
  ADD COLUMN IF NOT EXISTS feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  ADD COLUMN IF NOT EXISTS feedback_category TEXT,
  ADD COLUMN IF NOT EXISTS feedback_tags TEXT[],
  ADD COLUMN IF NOT EXISTS response_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS user_session_id TEXT,
  ADD COLUMN IF NOT EXISTS auto_detected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS detection_method TEXT;

-- Create a table for prompt usage analytics
CREATE TABLE IF NOT EXISTS public.prompt_usage_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID NOT NULL REFERENCES public.system_prompts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_uses INTEGER NOT NULL DEFAULT 0,
  successful_uses INTEGER NOT NULL DEFAULT 0,
  failed_uses INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC(3,2),
  average_response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create a unique constraint on prompt_id and date
CREATE UNIQUE INDEX IF NOT EXISTS prompt_usage_analytics_prompt_id_date_idx 
  ON public.prompt_usage_analytics (prompt_id, date);

-- Create a table for prompt monitoring alerts
CREATE TABLE IF NOT EXISTS public.prompt_monitoring_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID NOT NULL REFERENCES public.system_prompts(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  threshold NUMERIC(5,2) NOT NULL,
  current_value NUMERIC(5,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS prompt_monitoring_alerts_prompt_id_idx 
  ON public.prompt_monitoring_alerts (prompt_id);
CREATE INDEX IF NOT EXISTS prompt_monitoring_alerts_is_active_idx 
  ON public.prompt_monitoring_alerts (is_active);

-- Create a table for prompt monitoring settings
CREATE TABLE IF NOT EXISTS public.prompt_monitoring_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID REFERENCES public.system_prompts(id) ON DELETE CASCADE,
  setting_type TEXT NOT NULL,
  threshold NUMERIC(5,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notification_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(prompt_id, setting_type)
);

-- Create a function to update prompt_usage_analytics
CREATE OR REPLACE FUNCTION update_prompt_usage_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update the analytics record for today
  INSERT INTO public.prompt_usage_analytics (
    prompt_id, 
    date, 
    total_uses,
    successful_uses,
    failed_uses,
    average_rating,
    average_response_time_ms
  )
  VALUES (
    NEW.prompt_id,
    CURRENT_DATE,
    1,
    CASE WHEN NEW.is_successful THEN 1 ELSE 0 END,
    CASE WHEN NOT NEW.is_successful THEN 1 ELSE 0 END,
    NEW.feedback_rating,
    NEW.response_time_ms
  )
  ON CONFLICT (prompt_id, date) 
  DO UPDATE SET
    total_uses = prompt_usage_analytics.total_uses + 1,
    successful_uses = prompt_usage_analytics.successful_uses + CASE WHEN NEW.is_successful THEN 1 ELSE 0 END,
    failed_uses = prompt_usage_analytics.failed_uses + CASE WHEN NOT NEW.is_successful THEN 1 ELSE 0 END,
    average_rating = CASE 
      WHEN NEW.feedback_rating IS NOT NULL THEN 
        (prompt_usage_analytics.average_rating * prompt_usage_analytics.total_uses + NEW.feedback_rating) / (prompt_usage_analytics.total_uses + 1)
      ELSE 
        prompt_usage_analytics.average_rating
      END,
    average_response_time_ms = CASE 
      WHEN NEW.response_time_ms IS NOT NULL THEN 
        (prompt_usage_analytics.average_response_time_ms * prompt_usage_analytics.total_uses + NEW.response_time_ms) / (prompt_usage_analytics.total_uses + 1)
      ELSE 
        prompt_usage_analytics.average_response_time_ms
      END,
    updated_at = NOW();
    
  -- Check for alerts
  DECLARE
    success_rate NUMERIC(5,2);
    setting_record RECORD;
  BEGIN
    -- Calculate current success rate
    SELECT 
      CASE 
        WHEN total_uses > 0 THEN (successful_uses::NUMERIC / total_uses::NUMERIC) * 100
        ELSE 0
      END INTO success_rate
    FROM public.prompt_usage_analytics
    WHERE prompt_id = NEW.prompt_id AND date = CURRENT_DATE;
    
    -- Check each monitoring setting
    FOR setting_record IN 
      SELECT * FROM public.prompt_monitoring_settings 
      WHERE prompt_id = NEW.prompt_id AND is_active = true
    LOOP
      -- Low success rate alert
      IF setting_record.setting_type = 'low_success_rate' AND success_rate < setting_record.threshold THEN
        INSERT INTO public.prompt_monitoring_alerts (
          prompt_id,
          alert_type,
          threshold,
          current_value,
          is_active
        )
        VALUES (
          NEW.prompt_id,
          'low_success_rate',
          setting_record.threshold,
          success_rate,
          true
        )
        ON CONFLICT (id) DO NOTHING;
      END IF;
      
      -- Low rating alert
      IF setting_record.setting_type = 'low_rating' AND 
         NEW.feedback_rating IS NOT NULL AND 
         NEW.feedback_rating < setting_record.threshold THEN
        INSERT INTO public.prompt_monitoring_alerts (
          prompt_id,
          alert_type,
          threshold,
          current_value,
          is_active
        )
        VALUES (
          NEW.prompt_id,
          'low_rating',
          setting_record.threshold,
          NEW.feedback_rating,
          true
        )
        ON CONFLICT (id) DO NOTHING;
      END IF;
    END LOOP;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update analytics on insert or update
DROP TRIGGER IF EXISTS update_prompt_analytics_trigger ON public.system_prompt_success_tracking;
CREATE TRIGGER update_prompt_analytics_trigger
AFTER INSERT OR UPDATE ON public.system_prompt_success_tracking
FOR EACH ROW
EXECUTE FUNCTION update_prompt_usage_analytics();

-- Create RLS policies for new tables
ALTER TABLE public.prompt_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_monitoring_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view analytics
CREATE POLICY "Admins can view prompt analytics" ON public.prompt_usage_analytics
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can view alerts
CREATE POLICY "Admins can view prompt alerts" ON public.prompt_monitoring_alerts
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can manage monitoring settings
CREATE POLICY "Admins can manage monitoring settings" ON public.prompt_monitoring_settings
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.prompt_usage_analytics IS 'Daily analytics for prompt usage';
COMMENT ON TABLE public.prompt_monitoring_alerts IS 'Alerts for prompt monitoring';
COMMENT ON TABLE public.prompt_monitoring_settings IS 'Settings for prompt monitoring alerts';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('026_enhanced_prompt_tracking.sql', NOW())
ON CONFLICT (name) DO NOTHING;
