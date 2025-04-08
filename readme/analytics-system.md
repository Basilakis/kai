# Analytics System

This document outlines the analytics system architecture, implementation details, and data storage considerations for tracking searches, Agent AI prompts, and API requests on our platform.

## Overview

The analytics system captures and stores user interaction data to provide insights into:

- Search patterns and most common search queries
- Agent AI usage and popular prompts
- API request volumes, patterns, and performance metrics
- Material view trends and popular materials

This data enables trend analysis, performance monitoring, and feature optimization based on actual usage patterns.

## Data Captured

The analytics system collects the following data points:

- **Event Type**: The type of interaction (search, agent_prompt, api_request, material_view)
- **Timestamp**: When the interaction occurred
- **User ID**: Which user performed the action (if authenticated)
- **Resource Type**: What resource was accessed (materials, collections, etc.)
- **Query**: The actual search query or agent prompt text
- **Response Time**: How long the operation took to complete (ms)
- **Response Status**: HTTP status code for API requests
- **Additional Context**: JSON field for variable additional data

## Implementation Architecture

The analytics system consists of these key components:

1. **Analytics Middleware**: An Express middleware that automatically captures all API requests
2. **Analytics Service**: Service methods to track specific events (searches, agent prompts, etc.)
3. **Database Schema**: Table structure and indexes for storing analytics data
4. **Database Functions**: PostgreSQL functions that process raw data into insights
5. **Admin Dashboard**: UI for visualizing analytics data and trends

## Data Storage Options

### Option 1: Supabase PostgreSQL (Current Implementation)

Our current implementation uses Supabase's PostgreSQL database:

#### Advantages

- **Seamless Integration**: Works within our existing Supabase infrastructure
- **Simplicity**: Single database system for application and analytics data
- **Real-time Access**: Low latency for dashboard visualizations
- **SQL Power**: Full PostgreSQL capabilities for complex queries
- **Data Integrity**: ACID compliance ensures reliable analytics
- **Implementation Speed**: Faster to implement with existing Supabase knowledge

#### Limitations

- **Scaling Challenges**: May struggle with very high volumes (billions of records)
- **Cost Structure**: Storage costs increase linearly with data volume
- **Mixed Workload**: Analytics queries compete with operational queries

#### Implementation Details

The Supabase implementation uses:

- A dedicated `analytics_events` table with appropriate indexes
- PostgreSQL functions for aggregation and trend analysis
- Row-level security policies to protect sensitive data

Database schema details are defined in the migration file:
`packages/server/src/services/supabase/migrations/005_analytics_system.sql`

### Option 2: BigQuery Alternative

For larger-scale deployments, Google BigQuery provides an alternative:

#### Advantages

- **Massive Scale**: Handles petabytes of data with ease
- **Query Performance**: Superior performance for complex analytical queries
- **Separation of Concerns**: Analytics workload isolated from operational database
- **Cost Efficiency**: Pay-per-query pricing can be cost-effective for intermittent analysis
- **Advanced Features**: Machine learning integrations and advanced analytics
- **No Storage Management**: Serverless architecture requires no capacity planning

#### Limitations

- **Implementation Complexity**: Requires ETL pipelines to load data from application
- **Higher Latency**: Not ideal for real-time dashboard updates
- **Learning Curve**: Team needs to learn BigQuery-specific SQL dialect
- **Additional Service**: Adds another external dependency

#### Implementation Approach

To implement BigQuery storage:

1. Create a BigQuery dataset and table schema matching our analytics structure
2. Implement a data export service that regularly:
   - Queries recent analytics events from Supabase
   - Transforms data if needed
   - Loads data into BigQuery tables
3. Update admin dashboard to query BigQuery for historical analytics
4. Optionally implement a hybrid approach:
   - Recent data (30-90 days) stays in Supabase for real-time access
   - Historical data moves to BigQuery for long-term storage and analysis

## Hybrid Approach Considerations

For systems with high analytics volume, consider a hybrid approach:

1. **Real-time Tier**: Keep recent data (last 30-90 days) in Supabase
   - Powers real-time dashboards with low latency
   - Handles rapid writes efficiently
   - Enables immediate analysis of current activity

2. **Historical Tier**: Archive older data to BigQuery
   - Stores historical data cost-effectively
   - Enables complex analytical queries over large datasets
   - Removes pressure from operational database

This approach provides the benefits of both systems while minimizing their limitations.

## Setup Instructions

### Supabase Setup

1. Run the migration script:
   ```bash
   cd packages/server
   npm run migration:run
   ```

2. The migration creates:
   - The analytics_events table
   - Required indexes
   - PostgreSQL functions for aggregation
   - Row-level security policies

3. The analytics service will use the new table automatically

### BigQuery Setup (Optional)

1. Create a BigQuery project and dataset
2. Create tables matching our analytics schema
3. Set up the data export service to run on schedule
4. Update dashboard services to query BigQuery for historical data

## Using the Analytics System

The system automatically tracks all API requests through the middleware. For additional manual tracking:

```typescript
// Track a search operation
await analyticsService.trackSearch(
  query,                // The search query
  resourceType,         // Type of resource being searched
  userId,               // Optional user ID
  parameters,           // Optional additional parameters
  responseTimeMs,       // Optional response time
  responseStatus        // Optional HTTP status code
);

// Track an agent prompt
await analyticsService.trackAgentPrompt(
  prompt,              // The agent prompt
  agentType,           // Type of agent
  userId,              // Optional user ID
  sessionId,           // Optional session ID
  parameters           // Optional additional parameters
);

// Track a material view
await analyticsService.trackMaterialView(
  materialId,          // ID of the material being viewed
  userId,              // Optional user ID
  parameters           // Optional additional parameters
);
```

## Accessing Analytics Data

Analytics data can be accessed through:

1. **Admin Dashboard**: Navigate to `/admin/analytics` for visualizations
2. **Analytics API**: Endpoints for programmatic access:
   - `GET /api/admin/analytics/events` - List raw events
   - `GET /api/admin/analytics/stats` - Get summary statistics
   - `GET /api/admin/analytics/trends` - Get time-based trends
   - `GET /api/admin/analytics/top-searches` - Get most common searches
   - `GET /api/admin/analytics/top-prompts` - Get most common agent prompts
   - `GET /api/admin/analytics/top-materials` - Get most viewed materials

## Best Practices

1. **Data Retention**: Define a clear data retention policy:
   - How long to keep detailed events
   - When to aggregate and discard raw data
   - Legal compliance considerations (GDPR, etc.)

2. **Privacy Considerations**:
   - Store only necessary data
   - Anonymize sensitive information
   - Ensure proper authorization for analytics access

3. **Performance Optimization**:
   - Use time-based partitioning for large datasets
   - Create materialized views for common queries
   - Consider a read replica for analytics queries

4. **Monitoring**:
   - Set up alerts for unusual patterns
   - Monitor storage growth and query performance
   - Periodically audit access to analytics data

## Making the Decision: Supabase vs BigQuery

The choice between Supabase PostgreSQL and BigQuery depends on several factors:

### Choose Supabase When:

- Expected analytics volume is under 100GB or ~50 million events
- Real-time analytics are critical
- Simplicity and fast implementation are priorities
- Team is already familiar with PostgreSQL
- Cost predictability is important

### Choose BigQuery When:

- Expected analytics volume exceeds 100GB or ~50 million events
- Complex analytical queries are frequent
- Real-time access is less important than historical analysis
- Separate analytical workloads from operational database
- Team is comfortable with data pipeline management

### Choose Hybrid Approach When:

- Both real-time and historical analytics are important
- Data volume is growing rapidly
- Different teams have different analysis needs
- Cost optimization for large datasets is a priority

## Conclusion

The analytics system provides valuable insights into user behavior while maintaining system performance. The initial Supabase PostgreSQL implementation offers a good balance of simplicity and functionality, with options to migrate to BigQuery or implement a hybrid approach as data volume grows.