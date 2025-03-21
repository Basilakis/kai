/**
 * Type definitions for web crawler-related entities
 */

/**
 * Represents a web crawler configuration
 */
export interface CrawlerConfig {
  id: string;
  name: string;
  description?: string;
  provider: CrawlerProvider;
  status: CrawlerStatus;
  
  // Target configuration
  startUrls: string[];
  allowedDomains?: string[];
  excludePatterns?: string[];
  maxDepth?: number;
  maxPages?: number;
  
  // Scheduling
  schedule?: CrawlerSchedule;
  lastRunAt?: Date;
  nextRunAt?: Date;
  
  // Extraction rules
  extractionRules: ExtractionRule[];
  
  // Processing options
  processingOptions?: {
    extractImages: boolean;
    extractText: boolean;
    extractLinks: boolean;
    followLinks: boolean;
    respectRobotsTxt: boolean;
    delay?: number; // in milliseconds
    concurrency?: number;
    timeout?: number; // in milliseconds
    retries?: number;
  };
  
  // Authentication
  authentication?: CrawlerAuthentication;
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

/**
 * Represents the provider of a web crawler
 */
export type CrawlerProvider = 
  | 'firecrawl'
  | 'jina'
  | 'internal'
  | 'custom';

/**
 * Represents the status of a web crawler
 */
export type CrawlerStatus = 
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'scheduled';

/**
 * Represents the schedule of a web crawler
 */
export interface CrawlerSchedule {
  frequency: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
  cronExpression?: string;
  startDate?: Date;
  endDate?: Date;
  timeZone?: string;
}

/**
 * Represents an extraction rule for a web crawler
 */
export interface ExtractionRule {
  id: string;
  name: string;
  description?: string;
  type: 'material' | 'tile' | 'product' | 'specification' | 'image' | 'custom';
  selector: {
    type: 'css' | 'xpath' | 'regex' | 'jsonpath';
    value: string;
  };
  attribute?: string;
  multiple: boolean;
  required: boolean;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    allowEmpty?: boolean;
  };
  transformation?: {
    trim?: boolean;
    lowercase?: boolean;
    uppercase?: boolean;
    replace?: {
      pattern: string;
      replacement: string;
    }[];
  };
  mapping?: Record<string, string>;
}

/**
 * Represents authentication for a web crawler
 */
export interface CrawlerAuthentication {
  type: 'basic' | 'form' | 'oauth' | 'cookie' | 'header';
  username?: string;
  password?: string;
  formSelector?: string;
  usernameField?: string;
  passwordField?: string;
  submitButton?: string;
  loginUrl?: string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
  token?: string;
}

/**
 * Represents a crawl job
 */
export interface CrawlJob {
  id: string;
  configId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  stats?: {
    pagesVisited: number;
    pagesSucceeded: number;
    pagesFailed: number;
    itemsExtracted: number;
    imagesExtracted: number;
    bytesDownloaded: number;
    duration: number; // in milliseconds
  };
  results?: CrawlResult[];
}

/**
 * Represents a result from a crawl job
 */
export interface CrawlResult {
  id: string;
  url: string;
  title?: string;
  extractedAt: Date;
  statusCode: number;
  contentType?: string;
  data: Record<string, any>;
  images?: {
    url: string;
    alt?: string;
    width?: number;
    height?: number;
    size?: number;
    localPath?: string;
  }[];
  links?: {
    url: string;
    text?: string;
    isExternal: boolean;
    isFollowed: boolean;
  }[];
  html?: string;
  text?: string;
  metadata?: Record<string, any>;
}

/**
 * Represents a FireCrawl.dev specific configuration
 */
export interface FireCrawlConfig extends CrawlerConfig {
  provider: 'firecrawl';
  apiKey: string;
  projectId: string;
  customOptions?: Record<string, any>;
}

/**
 * Represents a Jina.ai specific configuration
 */
export interface JinaConfig extends CrawlerConfig {
  provider: 'jina';
  apiKey: string;
  flowId: string;
  executors?: string[];
  customOptions?: Record<string, any>;
}

/**
 * Represents statistics about crawlers
 */
export interface CrawlerStats {
  totalCrawlers: number;
  activeCrawlers: number;
  totalJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalPagesVisited: number;
  totalItemsExtracted: number;
  totalImagesExtracted: number;
  averageCrawlDuration: number; // in milliseconds
  crawlersByProvider: Record<CrawlerProvider, number>;
  jobsPerDay: Record<string, number>;
}