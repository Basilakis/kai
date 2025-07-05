/**
 * Crawler Service Interface
 * 
 * Defines the contract for different web crawling service implementations.
 * This interface ensures consistent behavior across different crawler API providers.
 */

export interface CrawlerConfig {
  name: string;
  description?: string;
  url: string;
  factoryId: string; // Added mandatory factoryId for catalog import
  selectors?: {
    title?: string;
    content?: string;
    images?: string;
    links?: string;
    custom?: Record<string, string>;
  };
  depth?: number;
  maxPages?: number;
  followLinks?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  provider: 'jina' | 'firecrawl';
  providerConfig?: Record<string, any>;
  
  // Training-related properties
  transformForTraining?: boolean;
  autoTrain?: boolean;
  trainingConfig?: {
    modelType?: 'hybrid' | 'feature-based' | 'ml-based';
    epochs?: number;
    batchSize?: number;
    learningRate?: number;
    outputDir?: string;
  };
}

export interface CrawlerPage {
  url: string;
  title?: string;
  content?: string;
  html?: string;
  images?: string[];
  links?: string[];
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface CrawlerResult {
  jobId: string;
  configId: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  pagesProcessed: number;
  totalPages?: number;
  error?: string;
  pages: CrawlerPage[];
}

/**
 * Priority type for crawler jobs - matched to align with pdfQueue
 */
export type CrawlerJobPriority = 'low' | 'normal' | 'high';

export interface CrawlerJobOptions {
  priority?: CrawlerJobPriority;
  schedule?: string; // cron format for scheduled jobs
  notify?: boolean;
}

export interface CrawlerService {
  /**
   * Name of the crawler service provider
   */
  readonly provider: string;
  
  /**
   * Initialize the crawler service with API credentials
   * @param credentials API credentials for the service
   */
  initialize(credentials: Record<string, string>): Promise<boolean>;
  
  /**
   * Validate a crawler configuration
   * @param config Crawler configuration to validate
   */
  validateConfig(config: CrawlerConfig): Promise<{ valid: boolean; errors?: string[] }>;
  
  /**
   * Test a selector against a URL
   * @param url URL to test selector against
   * @param selector CSS or XPath selector to test
   */
  testSelector(url: string, selector: string): Promise<{ 
    matches: number; 
    sample: string[]; 
  }>;
  
  /**
   * Start a crawler job
   * @param config Crawler configuration
   * @param options Job options
   */
  startJob(config: CrawlerConfig, options?: CrawlerJobOptions): Promise<{ 
    jobId: string; 
    status: string; 
  }>;
  
  /**
   * Stop a running crawler job
   * @param jobId ID of the job to stop
   */
  stopJob(jobId: string): Promise<boolean>;
  
  /**
   * Get the status of a crawler job
   * @param jobId ID of the job to get status for
   */
  getJobStatus(jobId: string): Promise<{ 
    jobId: string; 
    status: string; 
    progress: number; 
    pagesProcessed: number; 
    error?: string; 
  }>;
  
  /**
   * Get the results of a completed crawler job
   * @param jobId ID of the job to get results for
   * @param page Page number for pagination
   * @param limit Number of results per page
   */
  getJobResults(jobId: string, page?: number, limit?: number): Promise<CrawlerResult>;
  
  /**
   * Transform crawler results into training data format
   * @param result Crawler results to transform
   * @param outputDir Directory to save transformed data
   */
  transformResultsToTrainingData(
    result: CrawlerResult, 
    outputDir: string
  ): Promise<{ 
    datasetPath: string; 
    totalItems: number; 
    categories: string[];
  }>;
}