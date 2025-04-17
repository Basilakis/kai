-- Migration: Predictive Analytics System
-- This migration sets up the tables and functions needed for the predictive analytics system

-- Create predictive_analytics_results table
CREATE TABLE IF NOT EXISTS predictive_analytics_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_type TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  prediction_type TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  input_parameters JSONB NOT NULL,
  results JSONB NOT NULL,
  accuracy FLOAT,
  confidence FLOAT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create index on model_type and prediction_type
CREATE INDEX IF NOT EXISTS idx_predictive_analytics_model ON predictive_analytics_results(model_type, prediction_type);

-- Create index on date range
CREATE INDEX IF NOT EXISTS idx_predictive_analytics_dates ON predictive_analytics_results(start_date, end_date);

-- Create function to create the predictive analytics table
CREATE OR REPLACE FUNCTION create_predictive_analytics_table()
RETURNS VOID AS $$
BEGIN
  -- Create the table if it doesn't exist
  CREATE TABLE IF NOT EXISTS predictive_analytics_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_type TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    prediction_type TEXT NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    input_parameters JSONB NOT NULL,
    results JSONB NOT NULL,
    accuracy FLOAT,
    confidence FLOAT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
  );
  
  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_predictive_analytics_model ON predictive_analytics_results(model_type, prediction_type);
  CREATE INDEX IF NOT EXISTS idx_predictive_analytics_dates ON predictive_analytics_results(start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- Create function to generate time-series forecast
CREATE OR REPLACE FUNCTION generate_time_series_forecast(
  p_event_type TEXT,
  p_resource_type TEXT,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_forecast_periods INTEGER,
  p_interval TEXT
)
RETURNS JSONB AS $$
DECLARE
  historical_data JSONB;
  forecast_data JSONB;
BEGIN
  -- Get historical data
  SELECT json_agg(json_build_object(
    'date', date_trunc(p_interval, timestamp),
    'count', COUNT(*)
  ))
  INTO historical_data
  FROM analytics_events
  WHERE 
    (p_event_type IS NULL OR event_type = p_event_type) AND
    (p_resource_type IS NULL OR resource_type = p_resource_type) AND
    timestamp >= p_start_date AND
    timestamp <= p_end_date
  GROUP BY date_trunc(p_interval, timestamp)
  ORDER BY date_trunc(p_interval, timestamp);
  
  -- Simple moving average forecast (placeholder for more sophisticated algorithms)
  -- In a real implementation, this would use more advanced statistical methods
  WITH historical AS (
    SELECT 
      date_trunc(p_interval, timestamp) AS date,
      COUNT(*) AS count
    FROM analytics_events
    WHERE 
      (p_event_type IS NULL OR event_type = p_event_type) AND
      (p_resource_type IS NULL OR resource_type = p_resource_type) AND
      timestamp >= p_start_date AND
      timestamp <= p_end_date
    GROUP BY date_trunc(p_interval, timestamp)
    ORDER BY date_trunc(p_interval, timestamp)
  ),
  avg_counts AS (
    SELECT AVG(count) AS avg_count
    FROM historical
    ORDER BY date DESC
    LIMIT 3 -- Use last 3 periods for moving average
  ),
  forecast_dates AS (
    SELECT 
      (p_end_date + (n || ' ' || p_interval)::INTERVAL) AS forecast_date
    FROM generate_series(1, p_forecast_periods) AS n
  )
  SELECT json_agg(json_build_object(
    'date', forecast_date,
    'count', avg_count,
    'is_forecast', TRUE
  ))
  INTO forecast_data
  FROM forecast_dates, avg_counts;
  
  -- Return combined historical and forecast data
  RETURN json_build_object(
    'historical', COALESCE(historical_data, '[]'::JSONB),
    'forecast', COALESCE(forecast_data, '[]'::JSONB),
    'parameters', json_build_object(
      'event_type', p_event_type,
      'resource_type', p_resource_type,
      'start_date', p_start_date,
      'end_date', p_end_date,
      'forecast_periods', p_forecast_periods,
      'interval', p_interval
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to detect anomalies in analytics data
CREATE OR REPLACE FUNCTION detect_analytics_anomalies(
  p_event_type TEXT,
  p_resource_type TEXT,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_interval TEXT,
  p_threshold FLOAT DEFAULT 2.0 -- Standard deviations from mean
)
RETURNS JSONB AS $$
DECLARE
  time_series JSONB;
  anomalies JSONB;
  mean_value FLOAT;
  std_dev FLOAT;
BEGIN
  -- Get time series data
  WITH time_data AS (
    SELECT 
      date_trunc(p_interval, timestamp) AS date,
      COUNT(*) AS count
    FROM analytics_events
    WHERE 
      (p_event_type IS NULL OR event_type = p_event_type) AND
      (p_resource_type IS NULL OR resource_type = p_resource_type) AND
      timestamp >= p_start_date AND
      timestamp <= p_end_date
    GROUP BY date_trunc(p_interval, timestamp)
    ORDER BY date_trunc(p_interval, timestamp)
  )
  SELECT json_agg(json_build_object(
    'date', date,
    'count', count
  ))
  INTO time_series
  FROM time_data;
  
  -- Calculate mean and standard deviation
  SELECT 
    AVG(count), 
    STDDEV(count)
  INTO mean_value, std_dev
  FROM (
    SELECT 
      date_trunc(p_interval, timestamp) AS date,
      COUNT(*) AS count
    FROM analytics_events
    WHERE 
      (p_event_type IS NULL OR event_type = p_event_type) AND
      (p_resource_type IS NULL OR resource_type = p_resource_type) AND
      timestamp >= p_start_date AND
      timestamp <= p_end_date
    GROUP BY date_trunc(p_interval, timestamp)
  ) AS stats;
  
  -- Detect anomalies (values outside threshold * standard deviation)
  WITH time_data AS (
    SELECT 
      date_trunc(p_interval, timestamp) AS date,
      COUNT(*) AS count
    FROM analytics_events
    WHERE 
      (p_event_type IS NULL OR event_type = p_event_type) AND
      (p_resource_type IS NULL OR resource_type = p_resource_type) AND
      timestamp >= p_start_date AND
      timestamp <= p_end_date
    GROUP BY date_trunc(p_interval, timestamp)
    ORDER BY date_trunc(p_interval, timestamp)
  ),
  anomaly_data AS (
    SELECT 
      date,
      count,
      mean_value,
      std_dev,
      ABS(count - mean_value) / NULLIF(std_dev, 0) AS z_score
    FROM time_data
    CROSS JOIN (SELECT mean_value, std_dev) AS stats
    WHERE ABS(count - mean_value) > p_threshold * NULLIF(std_dev, 0)
  )
  SELECT json_agg(json_build_object(
    'date', date,
    'count', count,
    'mean', mean_value,
    'std_dev', std_dev,
    'z_score', z_score,
    'severity', 
      CASE 
        WHEN z_score > 3 THEN 'high'
        WHEN z_score > 2 THEN 'medium'
        ELSE 'low'
      END
  ))
  INTO anomalies
  FROM anomaly_data;
  
  -- Return results
  RETURN json_build_object(
    'time_series', COALESCE(time_series, '[]'::JSONB),
    'anomalies', COALESCE(anomalies, '[]'::JSONB),
    'statistics', json_build_object(
      'mean', mean_value,
      'std_dev', std_dev,
      'threshold', p_threshold
    ),
    'parameters', json_build_object(
      'event_type', p_event_type,
      'resource_type', p_resource_type,
      'start_date', p_start_date,
      'end_date', p_end_date,
      'interval', p_interval
    )
  );
END;
$$ LANGUAGE plpgsql;
