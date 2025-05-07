/**
 * Agent Activity Logger
 * 
 * Provides specialized logging for agent activities, including task execution,
 * agent creation, and other agent-related events.
 */

import { createLogger } from '../services';

// Create a specialized logger for agent activities
const activityLogger = createLogger('AgentActivity');

/**
 * Log agent activity
 * 
 * @param agentId - ID of the agent
 * @param activity - Activity details
 */
export function logAgentActivity(
  agentId: string,
  activity: {
    action: 'agent_creation' | 'agent_deletion' | 'task_execution' | 'task_completion' | 'error';
    status: 'start' | 'success' | 'error' | 'warning';
    details?: Record<string, any>;
    error?: Error;
  }
): void {
  const { action, status, details, error } = activity;
  
  // Create a structured log entry
  const logEntry = {
    agentId,
    action,
    status,
    timestamp: new Date().toISOString(),
    ...details
  };
  
  // Log at the appropriate level based on status
  switch (status) {
    case 'start':
      activityLogger.info(`Agent ${agentId} ${action} started`, logEntry);
      break;
    case 'success':
      activityLogger.info(`Agent ${agentId} ${action} succeeded`, logEntry);
      break;
    case 'warning':
      activityLogger.warn(`Agent ${agentId} ${action} warning`, logEntry);
      break;
    case 'error':
      activityLogger.error(`Agent ${agentId} ${action} failed`, error, logEntry);
      break;
  }
}
