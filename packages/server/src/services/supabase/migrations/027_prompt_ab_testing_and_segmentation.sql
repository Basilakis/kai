-- Migration: 027_prompt_ab_testing_and_segmentation.sql
-- Description: Adds A/B testing and user segmentation for prompt success tracking

-- Create a table for A/B test experiments
CREATE TABLE IF NOT EXISTS public.prompt_ab_experiments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  traffic_allocation NUMERIC(5,2) NOT NULL DEFAULT 100.0 CHECK (traffic_allocation BETWEEN 0 AND 100),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create a table for A/B test variants
CREATE TABLE IF NOT EXISTS public.prompt_ab_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experiment_id UUID NOT NULL REFERENCES public.prompt_ab_experiments(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES public.system_prompts(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  is_control BOOLEAN NOT NULL DEFAULT false,
  weight NUMERIC(5,2) NOT NULL DEFAULT 1.0 CHECK (weight > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(experiment_id, variant_name)
);

-- Create a table for A/B test assignments
CREATE TABLE IF NOT EXISTS public.prompt_ab_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experiment_id UUID NOT NULL REFERENCES public.prompt_ab_experiments(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.prompt_ab_variants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(experiment_id, user_id) WHERE user_id IS NOT NULL,
  UNIQUE(experiment_id, session_id) WHERE session_id IS NOT NULL
);

-- Create a table for user segments
CREATE TABLE IF NOT EXISTS public.user_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  segment_type TEXT NOT NULL,
  segment_criteria JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create a table for user segment assignments
CREATE TABLE IF NOT EXISTS public.user_segment_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  segment_id UUID NOT NULL REFERENCES public.user_segments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(segment_id, user_id) WHERE user_id IS NOT NULL,
  UNIQUE(segment_id, session_id) WHERE session_id IS NOT NULL
);

-- Add segment_id to system_prompt_success_tracking
ALTER TABLE public.system_prompt_success_tracking 
  ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES public.user_segments(id),
  ADD COLUMN IF NOT EXISTS experiment_id UUID REFERENCES public.prompt_ab_experiments(id),
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.prompt_ab_variants(id),
  ADD COLUMN IF NOT EXISTS interaction_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interaction_duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS follow_up_sentiment TEXT,
  ADD COLUMN IF NOT EXISTS interaction_pattern TEXT[];

-- Add segment_id to prompt_usage_analytics
ALTER TABLE public.prompt_usage_analytics
  ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES public.user_segments(id),
  ADD COLUMN IF NOT EXISTS experiment_id UUID REFERENCES public.prompt_ab_experiments(id),
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.prompt_ab_variants(id);

-- Drop the unique constraint and recreate it with segment_id
ALTER TABLE public.prompt_usage_analytics 
  DROP CONSTRAINT IF EXISTS prompt_usage_analytics_prompt_id_date_idx;

CREATE UNIQUE INDEX IF NOT EXISTS prompt_usage_analytics_prompt_id_date_segment_idx 
  ON public.prompt_usage_analytics (prompt_id, date, COALESCE(segment_id, '00000000-0000-0000-0000-000000000000'::uuid), 
  COALESCE(experiment_id, '00000000-0000-0000-0000-000000000000'::uuid), 
  COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Create a function to update prompt_usage_analytics with segmentation and A/B testing
CREATE OR REPLACE FUNCTION update_prompt_usage_analytics_with_segments()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update the analytics record for today
  INSERT INTO public.prompt_usage_analytics (
    prompt_id, 
    date, 
    segment_id,
    experiment_id,
    variant_id,
    total_uses,
    successful_uses,
    failed_uses,
    average_rating,
    average_response_time_ms
  )
  VALUES (
    NEW.prompt_id,
    CURRENT_DATE,
    NEW.segment_id,
    NEW.experiment_id,
    NEW.variant_id,
    1,
    CASE WHEN NEW.is_successful THEN 1 ELSE 0 END,
    CASE WHEN NOT NEW.is_successful THEN 1 ELSE 0 END,
    NEW.feedback_rating,
    NEW.response_time_ms
  )
  ON CONFLICT (prompt_id, date, COALESCE(segment_id, '00000000-0000-0000-0000-000000000000'::uuid), 
               COALESCE(experiment_id, '00000000-0000-0000-0000-000000000000'::uuid), 
               COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)) 
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
    
  -- Check for alerts (same as before)
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
    WHERE prompt_id = NEW.prompt_id 
      AND date = CURRENT_DATE
      AND COALESCE(segment_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(NEW.segment_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND COALESCE(experiment_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(NEW.experiment_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(NEW.variant_id, '00000000-0000-0000-0000-000000000000'::uuid);
    
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

-- Drop the old trigger and create the new one
DROP TRIGGER IF EXISTS update_prompt_analytics_trigger ON public.system_prompt_success_tracking;
CREATE TRIGGER update_prompt_analytics_with_segments_trigger
AFTER INSERT OR UPDATE ON public.system_prompt_success_tracking
FOR EACH ROW
EXECUTE FUNCTION update_prompt_usage_analytics_with_segments();

-- Create RLS policies for new tables
ALTER TABLE public.prompt_ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_ab_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_ab_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_segment_assignments ENABLE ROW LEVEL SECURITY;

-- Only admins can manage A/B experiments
CREATE POLICY "Admins can manage A/B experiments" ON public.prompt_ab_experiments
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can manage A/B variants
CREATE POLICY "Admins can manage A/B variants" ON public.prompt_ab_variants
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can view A/B assignments
CREATE POLICY "Admins can view A/B assignments" ON public.prompt_ab_assignments
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can manage user segments
CREATE POLICY "Admins can manage user segments" ON public.user_segments
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can view user segment assignments
CREATE POLICY "Admins can view user segment assignments" ON public.user_segment_assignments
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.prompt_ab_experiments IS 'A/B test experiments for prompts';
COMMENT ON TABLE public.prompt_ab_variants IS 'Variants for A/B test experiments';
COMMENT ON TABLE public.prompt_ab_assignments IS 'User assignments to A/B test variants';
COMMENT ON TABLE public.user_segments IS 'User segments for analytics';
COMMENT ON TABLE public.user_segment_assignments IS 'User assignments to segments';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('027_prompt_ab_testing_and_segmentation.sql', NOW())
ON CONFLICT (name) DO NOTHING;
