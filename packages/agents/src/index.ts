/**
 * KAI crewAI Integration
 *
 * This module provides agent-based capabilities for the KAI platform
 * using crewAI for both frontend user interactions and backend processing.
 */

// Initialize services
import { initializeServices } from './services';

// Initialize services on module load
initializeServices();

// Core exports
export { initializeAgentSystem } from './core/agentSystem';
export { AgentConfig, AgentType } from './core/types';

// Frontend agents
export { RecognitionAssistant } from './frontend/recognitionAssistant';
export { MaterialExpert } from './frontend/materialExpert';
export { ProjectAssistant } from './frontend/projectAssistant';

// Backend agents
export { KnowledgeBaseAgent } from './backend/knowledgeBaseAgent';
export { AnalyticsAgent } from './backend/analyticsAgent';
export { OperationsAgent } from './backend/operationsAgent';

// Tools
export * from './tools';

// Utilities
export * from './utils';

// Services
export * from './services';