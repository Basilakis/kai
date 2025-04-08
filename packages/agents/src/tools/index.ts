/**
 * Agent Tools
 * 
 * This file exports all tools available for use by crewAI agents in the KAI platform.
 * Tools provide specialized capabilities that agents can use to interact with the platform.
 */

// Export tool creator functions
export { createMaterialSearchTool } from './materialSearch';
export { createImageAnalysisTool } from './imageAnalysis';
export { createVectorSearchTool } from './vectorSearch';
export { 
  createAnalyticsQueryTool,
  createTrendAnalysisTool,
  createAnalyticsStatsTool,
  createTopSearchQueriesTool,
  createTopAgentPromptsTool,
  createTopMaterialsTool,
  createAnalyticsTools
} from './analytics';

// Re-export tool types
export type { Tool } from 'crewai';