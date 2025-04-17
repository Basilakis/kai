# Analytics Agent

This document provides detailed information about the Analytics Agent, a specialized crewAI agent designed for data analytics, market research, and decision support within the KAI platform.

## Overview

The Analytics Agent uses the KAI platform's analytics data to provide intelligent insights, market research, trend analysis, and decision support. It connects to the analytics API, processes historical data, and delivers context-aware recommendations based on actual usage patterns.

## Key Capabilities

The Analytics Agent offers multiple specialized functions:

1. **User Behavior Analysis**
   - Understand how users interact with the platform
   - Identify usage patterns and engagement metrics
   - Segment users based on behavior and preferences
   - Recommend enhancements based on actual usage

2. **Market Trend Analysis**
   - Identify emerging trends in material interests
   - Detect shifts in search patterns over time
   - Analyze seasonal variations in user behavior
   - Provide competitive market insights

3. **Decision Support**
   - Offer data-driven recommendations for strategic decisions
   - Compare options using historical performance data
   - Identify potential risks and opportunities
   - Quantify expected outcomes of different choices

4. **Product Performance Analysis**
   - Track the performance of specific products or categories
   - Compare performance across different time periods
   - Identify factors affecting product popularity
   - Recommend improvements based on usage data

5. **Natural Language Analytics Queries**
   - Process questions about data in plain English
   - Generate appropriate analytics queries from natural language
   - Present findings in an accessible, conversational format
   - Explain technical metrics in business-relevant terms

## Architecture

The Analytics Agent integrates with the broader KAI platform through several key components:

### Component Structure

```
packages/
├── agents/
│   ├── src/
│   │   ├── backend/
│   │   │   └── analyticsAgent.ts        # Agent implementation
│   │   ├── services/
│   │   │   ├── analyticsService.ts      # Analytics data access layer
│   │   │   └── serviceFactory.ts        # Service creation system
│   │   ├── tools/
│   │   │   ├── analytics.ts             # Analytics-specific tools
│   │   │   └── index.ts                 # Tool exports
│   │   └── core/
│   │       └── types.ts                 # Agent type definitions
└── client/
    └── src/
        └── components/
            └── agents/
                ├── AnalyticsPanel.tsx   # Client-side interface
                └── AgentDashboard.tsx   # Agent integration in UI
```

### Architectural Layers

1. **Agent Layer** (`analyticsAgent.ts`)
   - Implements the agent's reasoning capabilities
   - Defines specialized methods for analytics tasks
   - Handles event processing and response generation
   - Manages context and memory for ongoing analysis

2. **Service Layer** (`analyticsService.ts`)
   - Provides data access methods for analytics information
   - Handles API communication with error management
   - Formats requests and responses appropriately
   - Acts as a centralized client for the analytics API

3. **Tool Layer** (`analytics.ts`)
   - Implements specialized tools for the agent to use
   - Translates agent intents into service operations
   - Formats results for agent consumption
   - Handles errors and provides fallbacks

4. **UI Layer** (`AnalyticsPanel.tsx`)
   - Presents the agent's capabilities in the user interface
   - Manages agent session and communication
   - Displays analytics visualizations and insights
   - Provides interaction mechanisms for users

## Implementation Details

### Agent Implementation

The Analytics Agent is a SystemAgent type that implements specific methods for analytics tasks:

```typescript
export class AnalyticsAgent implements SystemAgent {
  // Standard SystemAgent properties
  public id: string;
  public type: AgentType;
  public name: string;
  public description: string;
  public agent: Agent;
  public config: AgentConfig;

  // Analytics-specific methods
  public async getUserBehaviorInsights(startDate?: Date, endDate?: Date, segment?: string): Promise<string>;
  public async getMarketTrendAnalysis(timeframe?: 'day' | 'week' | 'month', category?: string): Promise<string>;
  public async getCompetitiveAnalysis(competitorData: Array<{name: string; metrics: Record<string, any>}>, focusAreas?: string[]): Promise<string>;
  public async getDecisionSupport(decision: string, options: Array<{name: string; pros: string[]; cons: string[]}>, criteria?: Array<{name: string; weight: number}>): Promise<string>;
  public async getProductPerformanceAnalysis(productId: string, startDate?: Date, endDate?: Date): Promise<string>;
  public async processAnalyticsQuery(query: string): Promise<string>;
}
```

### Analytics Tools

The Analytics Agent leverages specialized tools to interact with the analytics system:

```typescript
// Tool for querying analytics events
const queryTool = await createAnalyticsQueryTool();

// Tool for analyzing trends over time
const trendsTool = await createTrendAnalysisTool();

// Tool for generating statistics about platform usage
const statsTool = await createAnalyticsStatsTool();

// Tool for getting top search queries
const searchQueriesTool = await createTopSearchQueriesTool();

// Tool for getting top agent prompts
const agentPromptsTool = await createTopAgentPromptsTool();

// Tool for getting top viewed materials
const materialsTool = await createTopMaterialsTool();

// Create a complete set of tools for the agent
const tools = await createAnalyticsTools();
```

### Client-Side Integration

The Analytics Agent is integrated into the client interface through a specialized panel with multiple tabs:

1. **Query Analytics** - Natural language analytics queries
2. **Usage Trends** - Visualization of platform usage patterns
3. **Market Research** - Competitive analysis and market insights
4. **Decision Support** - Data-driven recommendations for decisions

Each tab provides relevant context and examples to help users interact effectively with the agent.

## Setup Instructions

### Prerequisites

- Functioning KAI platform with analytics system enabled
- CrewAI integration set up according to [CrewAI installation guide](./agents-crewai-installation.md)
- Analytics API available and accessible

### Installation

The Analytics Agent is included in the standard crewAI integration package:

```bash
# Navigate to the agents directory
cd packages/agents

# Install dependencies if not already done
yarn install
```

### Configuration

Configure the agent in your application initialization:

```typescript
import { initializeAgentSystem, AgentType } from '@kai/agents';

// Initialize the agent system
await initializeAgentSystem({
  apiKey: process.env.OPENAI_API_KEY,
  defaultModel: {
    provider: 'openai',
    name: 'gpt-4',
    temperature: 0.7,
  },
  logLevel: 'info'
});

// Create an Analytics Agent instance
const analyticsAgent = await createAgent({
  id: 'analytics-expert-1',
  type: AgentType.ANALYTICS,
  name: 'Analytics Expert',
  description: 'Provides data-driven insights and decision support',
  // Optional additional tools
  additionalTools: [customAnalyticsTool],
  // Optional agent-specific settings
  settings: {
    dataRetentionPeriod: 90, // days
    defaultTimeframe: 'month'
  }
});
```

## Usage Examples

### Backend Usage

```typescript
import { createAgent, AgentType } from '@kai/agents';

// Create the Analytics Agent
const analyticsAgent = await createAgent({
  id: 'analytics-agent-1',
  type: AgentType.ANALYTICS,
  name: 'Analytics Expert'
});

// Get user behavior insights
const userInsights = await analyticsAgent.instance.getUserBehaviorInsights(
  new Date('2024-01-01'),
  new Date('2024-03-31'),
  'premium-subscribers'
);

// Analyze market trends
const trendAnalysis = await analyticsAgent.instance.getMarketTrendAnalysis(
  'month',
  'floor-tiles'
);

// Get decision support for a strategic question
const decisionSupport = await analyticsAgent.instance.getDecisionSupport(
  'Should we expand our ceramic or natural stone inventory?',
  [
    {
      name: 'Expand ceramic inventory',
      pros: ['Lower cost', 'Higher margin', 'More popular in searches'],
      cons: ['Market saturation', 'Price competition']
    },
    {
      name: 'Expand natural stone inventory',
      pros: ['Premium segment', 'Less competition', 'Higher ticket value'],
      cons: ['Higher inventory cost', 'Slower turnover']
    }
  ],
  [
    { name: 'Profit potential', weight: 0.4 },
    { name: 'Market demand', weight: 0.3 },
    { name: 'Operational complexity', weight: 0.2 },
    { name: 'Brand alignment', weight: 0.1 }
  ]
);

// Process natural language analytics query
const queryResult = await analyticsAgent.instance.processAnalyticsQuery(
  'Which product categories showed the highest growth in the last quarter?'
);
```

### Frontend Integration

The Analytics Agent is available through the AgentDashboard component:

```tsx
import React from 'react';
import { AgentDashboard } from '../components/agents/AgentDashboard';

const AgentsPage: React.FC = () => {
  return (
    <div>
      <h1>KAI Intelligent Assistants</h1>
      <AgentDashboard />
    </div>
  );
};

export default AgentsPage;
```

Users can access the Analytics Agent through the "Analytics Expert" tab in the dashboard, which provides:

- Natural language query interface
- Interactive visualizations
- Example questions and prompts
- Tabs for different analytics functions

## Event Processing

The Analytics Agent can process various system events:

```typescript
// Process a usage spike event
await analyticsAgent.instance.processEvent('usage_spike', {
  timestamp: new Date(),
  metric: 'search_volume',
  baseline: 150,
  actual: 450,
  duration: '2h'
});

// Process a search pattern change event
await analyticsAgent.instance.processEvent('search_pattern_change', {
  oldTopQueries: ['white marble', 'ceramic tile', 'porcelain'],
  newTopQueries: ['sustainable materials', 'recycled tile', 'eco-friendly'],
  changeVelocity: 'rapid',
  detectedAt: new Date()
});

// Process a new material trend event
await analyticsAgent.instance.processEvent('new_material_trend', {
  trendingMaterial: 'recycled glass mosaic',
  growthRate: 215, // percentage
  searchVolume: 850,
  relatedQueries: ['eco-friendly bathroom', 'sustainable kitchen']
});
```

## Advanced Configuration

### Custom Analytics Tools

Create custom analytics tools for specialized functionality:

```typescript
import { Tool } from 'crewai';

// Create a custom predictive analytics tool
const createPredictiveAnalyticsTool = async (): Promise<Tool> => {
  return new Tool({
    name: 'predictive_analytics',
    description: 'Predict future trends based on historical data',
    func: async (args) => {
      const { metric, timeframe, parameters } = JSON.parse(args);

      // Use the predictive analytics service
      let prediction;

      if (metric === 'time_series') {
        // Generate time-series forecast
        prediction = await predictiveAnalyticsService.generateTimeSeriesForecast({
          eventType: parameters.eventType,
          resourceType: parameters.resourceType,
          startDate: new Date(parameters.startDate),
          endDate: new Date(parameters.endDate),
          forecastPeriods: parameters.forecastPeriods || 7,
          interval: parameters.interval || 'day'
        });
      } else if (metric === 'anomalies') {
        // Detect anomalies
        prediction = await predictiveAnalyticsService.detectAnomalies({
          eventType: parameters.eventType,
          resourceType: parameters.resourceType,
          startDate: new Date(parameters.startDate),
          endDate: new Date(parameters.endDate),
          interval: parameters.interval || 'day',
          threshold: parameters.threshold || 2.0
        });
      } else if (metric === 'user_behavior') {
        // Predict user behavior
        prediction = await predictiveAnalyticsService.predictUserBehavior({
          userId: parameters.userId,
          predictionType: parameters.predictionType || 'next_action',
          lookbackDays: parameters.lookbackDays || 30,
          includeUserProfile: parameters.includeUserProfile !== false
        });
      }

      return JSON.stringify(prediction);
    }
  });
};

// Add it to the agent
const analyticsAgent = await createAgent({
  id: 'advanced-analytics-1',
  type: AgentType.ANALYTICS,
  additionalTools: [await createPredictiveAnalyticsTool()]
});
```

### Integration with External Analytics Systems

Connect the Analytics Agent to external analytics platforms:

```typescript
import { createAnalyticsService } from '../services/analyticsService';

// Create a custom analytics service with external system connection
const externalAnalyticsService = createAnalyticsService({
  baseURL: 'https://external-analytics-system.example.com/api',
  apiKey: process.env.EXTERNAL_ANALYTICS_API_KEY,
  timeout: 30000
});

// Create tools using the external service
const externalQueryTool = await createAnalyticsQueryTool(externalAnalyticsService);

// Add it to the agent
const analyticsAgent = await createAgent({
  id: 'multi-source-analytics-1',
  type: AgentType.ANALYTICS,
  additionalTools: [externalQueryTool]
});
```

## Performance Considerations

### Optimizing Response Times

1. **Caching Strategy**
   - Cache frequently requested analytics data
   - Implement TTL-based cache invalidation
   - Use materialized views for common queries

2. **Query Optimization**
   - Limit date ranges for historical queries
   - Use pagination for large result sets
   - Apply appropriate filters before processing

3. **Parallel Processing**
   - Execute independent analytics queries in parallel
   - Batch related requests when possible
   - Use Promise.all for concurrent operations

## Security Considerations

1. **Data Access Control**
   - Enforce appropriate permissions for analytics data
   - Filter sensitive information from responses
   - Audit analytics queries for security compliance

2. **PII Management**
   - Anonymize personally identifiable information
   - Apply data minimization principles
   - Implement proper data retention policies

3. **Agent Boundaries**
   - Restrict the agent to analytics operations only
   - Validate inputs to prevent injection attacks
   - Sanitize outputs to prevent sensitive data leakage

## Related Documentation

- [Analytics System](./analytics-system.md) - Core analytics system architecture
- [CrewAI Integration](./agents-crewai.md) - Overall agent system architecture
- [CrewAI Implementation](./agents-crewai-implementation.md) - Implementation details
- [Agent Installation](./agents-crewai-installation.md) - Setup instructions
- [Client Integration](./client-heroui-integration.md) - Frontend framework details