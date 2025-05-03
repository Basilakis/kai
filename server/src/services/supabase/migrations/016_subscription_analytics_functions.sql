-- Migration: 016_subscription_analytics_functions.sql
-- Description: Creates functions for subscription analytics

-- Function to get subscription tier analytics
CREATE OR REPLACE FUNCTION public.get_subscription_tier_analytics()
RETURNS TABLE (
  tier_id UUID,
  tier_name TEXT,
  count BIGINT,
  revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.id AS tier_id,
    st.name AS tier_name,
    COUNT(us.id) AS count,
    SUM(st.price) AS revenue
  FROM
    public.subscription_tiers st
  LEFT JOIN
    public.user_subscriptions us ON st.id = us.tier_id AND us.status = 'active'
  GROUP BY
    st.id, st.name
  ORDER BY
    revenue DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get credit usage by feature
CREATE OR REPLACE FUNCTION public.get_credit_usage_by_feature()
RETURNS TABLE (
  feature TEXT,
  credits BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(ct.metadata->>'feature', 'Other') AS feature,
    SUM(ABS(ct.amount)) AS credits
  FROM
    public.credit_transactions ct
  WHERE
    ct.type = 'usage'
  GROUP BY
    feature
  ORDER BY
    credits DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get subscription churn by tier
CREATE OR REPLACE FUNCTION public.get_subscription_churn_by_tier()
RETURNS TABLE (
  tier_id UUID,
  tier_name TEXT,
  total_subscribers BIGINT,
  churned_subscribers BIGINT,
  churn_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH tier_stats AS (
    SELECT
      st.id AS tier_id,
      st.name AS tier_name,
      COUNT(us.id) AS total_subscribers,
      COUNT(CASE WHEN us.status = 'canceled' THEN 1 END) AS churned_subscribers
    FROM
      public.subscription_tiers st
    LEFT JOIN
      public.user_subscriptions us ON st.id = us.tier_id
    GROUP BY
      st.id, st.name
  )
  SELECT
    tier_id,
    tier_name,
    total_subscribers,
    churned_subscribers,
    CASE
      WHEN total_subscribers > 0 THEN churned_subscribers::NUMERIC / total_subscribers
      ELSE 0
    END AS churn_rate
  FROM
    tier_stats
  ORDER BY
    churn_rate DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get subscription churn by period
CREATE OR REPLACE FUNCTION public.get_subscription_churn_by_period()
RETURNS TABLE (
  period TEXT,
  total_subscribers BIGINT,
  churned_subscribers BIGINT,
  churn_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH period_stats AS (
    SELECT
      TO_CHAR(DATE_TRUNC('month', us.created_at), 'YYYY-MM') AS period,
      COUNT(us.id) AS total_subscribers,
      COUNT(CASE WHEN us.status = 'canceled' THEN 1 END) AS churned_subscribers
    FROM
      public.user_subscriptions us
    WHERE
      us.created_at >= NOW() - INTERVAL '6 months'
    GROUP BY
      period
    ORDER BY
      period
  )
  SELECT
    period,
    total_subscribers,
    churned_subscribers,
    CASE
      WHEN total_subscribers > 0 THEN churned_subscribers::NUMERIC / total_subscribers
      ELSE 0
    END AS churn_rate
  FROM
    period_stats;
END;
$$ LANGUAGE plpgsql;

-- Function to get subscription revenue by tier
CREATE OR REPLACE FUNCTION public.get_subscription_revenue_by_tier()
RETURNS TABLE (
  tier_id UUID,
  tier_name TEXT,
  subscribers BIGINT,
  revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.id AS tier_id,
    st.name AS tier_name,
    COUNT(us.id) AS subscribers,
    SUM(st.price) AS revenue
  FROM
    public.subscription_tiers st
  LEFT JOIN
    public.user_subscriptions us ON st.id = us.tier_id AND us.status = 'active'
  GROUP BY
    st.id, st.name
  ORDER BY
    revenue DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get subscription revenue by period
CREATE OR REPLACE FUNCTION public.get_subscription_revenue_by_period()
RETURNS TABLE (
  period TEXT,
  subscribers BIGINT,
  revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH period_revenue AS (
    SELECT
      TO_CHAR(DATE_TRUNC('month', us.created_at), 'YYYY-MM') AS period,
      COUNT(us.id) AS subscribers,
      SUM(st.price) AS revenue
    FROM
      public.user_subscriptions us
    JOIN
      public.subscription_tiers st ON us.tier_id = st.id
    WHERE
      us.status = 'active' AND
      us.created_at >= NOW() - INTERVAL '6 months'
    GROUP BY
      period
    ORDER BY
      period
  )
  SELECT
    period,
    subscribers,
    revenue
  FROM
    period_revenue;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_subscription_tier_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_credit_usage_by_feature TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_churn_by_tier TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_churn_by_period TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_revenue_by_tier TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_revenue_by_period TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION public.get_subscription_tier_analytics IS 'Function to get analytics on subscription tiers';
COMMENT ON FUNCTION public.get_credit_usage_by_feature IS 'Function to get credit usage by feature';
COMMENT ON FUNCTION public.get_subscription_churn_by_tier IS 'Function to get subscription churn by tier';
COMMENT ON FUNCTION public.get_subscription_churn_by_period IS 'Function to get subscription churn by period';
COMMENT ON FUNCTION public.get_subscription_revenue_by_tier IS 'Function to get subscription revenue by tier';
COMMENT ON FUNCTION public.get_subscription_revenue_by_period IS 'Function to get subscription revenue by period';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('016_subscription_analytics_functions.sql', NOW())
ON CONFLICT (name) DO NOTHING;
