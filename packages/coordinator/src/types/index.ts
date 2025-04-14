/**
 * Type definitions for the Kubernetes workflow orchestration system
 */

/**
 * Quality level for ML processing
 */
export type QualityLevel = 'low' | 'medium' | 'high';

/**
 * Priority level for workflow scheduling
 */
export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low' | 'background';

/**
 * Processing stage in an ML workflow
 */
export enum ProcessingStage {
  PREPARATION = 'preparation',
  ANALYSIS = 'analysis',
  PREPROCESSING = 'preprocessing',
  INFERENCE = 'inference',
  POSTPROCESSING = 'postprocessing',
  CONVERSION = 'conversion',
  CLEANUP = 'cleanup'
}

/**
 * Quality preference for workflow processing
 */
export type QualityPreference = 'quality' | 'speed' | 'balanced';

/**
 * Subscription tier levels
 */
export type SubscriptionTier = 'free' | 'standard' | 'premium';

/**
 * Workflow request for creating a new workflow
 */
export interface WorkflowRequest {
  /**
   * Type of workflow to create
   */
  type: string;
  
  /**
   * User ID for tracking and resource allocation
   */
  userId: string;
  
  /**
   * User's subscription tier
   */
  subscriptionTier?: SubscriptionTier;
  
  /**
   * Target quality level or 'auto' for automatic determination
   */
  qualityTarget?: string;
  
  /**
   * Preference for quality vs. speed
   */
  qualityPreference?: QualityPreference;
  
  /**
   * Priority level for scheduling
   */
  priority?: PriorityLevel;
  
  /**
   * Enable caching of results
   */
  enableCaching?: boolean;
  
  /**
   * Workflow-specific parameters
   */
  parameters?: Record<string, any>;
  
  /**
   * Workflow ID (assigned by coordinator service)
   */
  workflowId?: string;
}

/**
 * Workflow template definition
 */
export interface WorkflowTemplate {
  /**
   * API version for Kubernetes
   */
  apiVersion: string;
  
  /**
   * Resource kind
   */
  kind: string;
  
  /**
   * Metadata for the template
   */
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
  };
  
  /**
   * Template specification
   */
  spec: {
    /**
     * Entry point template name
     */
    entrypoint: string;
    
    /**
     * Template timeout in seconds
     */
    activeDeadlineSeconds?: number;
    
    /**
     * Pod cleanup strategy
     */
    podGC?: {
      strategy: 'OnPodCompletion' | 'OnPodSuccess' | 'OnWorkflowCompletion' | 'OnWorkflowSuccess';
    };
    
    /**
     * Artifact repository reference
     */
    artifactRepositoryRef?: {
      configMap: string;
      key: string;
    };
    
    /**
     * Volume claim templates
     */
    volumeClaimTemplates?: Array<{
      metadata: {
        name: string;
      };
      spec: {
        accessModes: string[];
        resources: {
          requests: {
            storage: string;
          };
        };
        storageClassName?: string;
      };
    }>;
    
    /**
     * Arguments for the workflow
     */
    arguments?: {
      parameters?: Array<{
        name: string;
        value?: string;
        default?: string;
        description?: string;
      }>;
    };
    
    /**
     * Template definitions
     */
    templates: Array<{
      name: string;
      [key: string]: any;
    }>;
  };
}

/**
 * Workflow status response
 */
export interface WorkflowStatus {
  /**
   * Workflow ID
   */
  id: string;
  
  /**
   * Workflow type
   */
  type: string;
  
  /**
   * User ID
   */
  userId: string;
  
  /**
   * Quality level used
   */
  qualityLevel: QualityLevel;
  
  /**
   * Creation timestamp
   */
  createdAt: string;
  
  /**
   * Current status
   */
  status: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Error';
  
  /**
   * Progress percentage (0-100)
   */
  progress: number;
  
  /**
   * Estimated completion time
   */
  estimatedCompletionTime?: string;
  
  /**
   * Workflow start time
   */
  startedAt?: string;
  
  /**
   * Workflow finish time
   */
  finishedAt?: string;
  
  /**
   * Duration in seconds
   */
  duration?: number;
  
  /**
   * Workflow nodes
   */
  nodes?: Array<{
    id: string;
    name: string;
    type: string;
    phase: string;
    message?: string;
    startedAt?: string;
    finishedAt?: string;
    progress?: number;
  }>;
}

/**
 * Resource allocation for a workflow
 */
export interface ResourceAllocation {
  /**
   * CPU request
   */
  cpu: string;
  
  /**
   * Memory request
   */
  memory: string;
  
  /**
   * GPU request
   */
  gpu: string;
  
  /**
   * Node selectors
   */
  nodeSelectors: Record<string, string>;
  
  /**
   * Tolerations
   */
  tolerations?: Array<{
    key: string;
    operator: string;
    value?: string;
    effect: string;
  }>;
}

/**
 * Quality assessment result
 */
export interface QualityAssessment {
  /**
   * Determined quality level
   */
  qualityLevel: QualityLevel;
  
  /**
   * Contributing factors with scores (0-1)
   */
  factors: Record<string, number>;
}

/**
 * Cached workflow result
 */
export interface CachedWorkflowResult {
  /**
   * Workflow ID
   */
  workflowId: string;
  
  /**
   * Result data
   */
  data: any;
  
  /**
   * Cache creation timestamp
   */
  createdAt: string;
  
  /**
   * Cache TTL in seconds
   */
  ttl: number;
}

/**
 * Monitoring metrics for workflow
 */
export interface WorkflowMetrics {
  /**
   * Duration by processing stage
   */
  stageDurations: Record<ProcessingStage, number>;
  
  /**
   * Resource utilization
   */
  resourceUtilization: {
    cpu: number;
    memory: number;
    gpu: number;
  };
  
  /**
   * Error counts
   */
  errorCount: number;
  
  /**
   * Cache hit rate
   */
  cacheHitRate: number;
}