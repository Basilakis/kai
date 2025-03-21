/**
 * JinaAI Crawler Service
 * 
 * Implements the crawler service interface for the JinaAI API.
 * Handles authentication, job management, and result transformation.
 */

import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { 
  CrawlerService, 
  CrawlerConfig, 
  CrawlerResult, 
  CrawlerJobOptions,
  CrawlerPage 
} from './crawlerService.interface';

export class JinaAIService implements CrawlerService {
  readonly provider = 'jina';
  private apiClient: AxiosInstance | null = null;
  private apiKey: string = '';
  private baseUrl: string = 'https://api.jina.ai/crawler';
  private activeJobs: Map<string, { 
    externalJobId: string;
    status: string;
    config: CrawlerConfig;
  }> = new Map();

  /**
   * Initialize the service with API credentials
   * @param credentials API credentials including apiKey
   */
  async initialize(credentials: Record<string, string>): Promise<boolean> {
    try {
      if (!credentials.apiKey) {
        logger.error('JinaAI service initialization failed: API key is required');
        return false;
      }

      this.apiKey = credentials.apiKey;
      
      // Configure axios instance with base URL and default headers
      this.apiClient = axios.create({
        baseURL: this.baseUrl,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });
      
      // Test the API connection
      const response = await this.apiClient.get('/status');
      
      if (response.status === 200) {
        logger.info('JinaAI service initialized successfully');
        return true;
      } else {
        logger.error(`JinaAI service initialization failed: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (error) {
      logger.error(`JinaAI service initialization failed: ${error}`);
      return false;
    }
  }

  /**
   * Validate a crawler configuration
   * @param config Crawler configuration to validate
   */
  async validateConfig(config: CrawlerConfig): Promise<{ valid: boolean; errors?: string[] }> {
    if (!this.apiClient) {
      return { valid: false, errors: ['Service not initialized'] };
    }

    try {
      const errors: string[] = [];
      
      // Basic validation
      if (!config.url) {
        errors.push('URL is required');
      }
      
      if (!config.name) {
        errors.push('Name is required');
      }
      
      // Additional JinaAI-specific validation
      if (config.maxPages && config.maxPages > 1000) {
        errors.push('JinaAI supports a maximum of 1000 pages per job');
      }
      
      // If we have basic errors, return them without calling the API
      if (errors.length > 0) {
        return { valid: false, errors };
      }
      
      // Validate with the API
      const response = await this.apiClient.post('/validate-config', {
        url: config.url,
        selectors: config.selectors,
        depth: config.depth,
        max_pages: config.maxPages,
        follow_links: config.followLinks,
        include_patterns: config.includePatterns,
        exclude_patterns: config.excludePatterns
      });
      
      if (response.data.valid) {
        return { valid: true };
      } else {
        return {
          valid: false,
          errors: response.data.errors || ['Invalid configuration']
        };
      }
    } catch (error) {
      logger.error(`JinaAI config validation failed: ${error}`);
      return {
        valid: false,
        errors: [(error as Error).message || 'Unknown error during validation']
      };
    }
  }

  /**
   * Test a selector against a URL
   * @param url URL to test selector against
   * @param selector CSS or XPath selector to test
   */
  async testSelector(url: string, selector: string): Promise<{ matches: number; sample: string[] }> {
    if (!this.apiClient) {
      throw new Error('Service not initialized');
    }

    try {
      const response = await this.apiClient.post('/test-selector', {
        url,
        selector
      });
      
      return {
        matches: response.data.matches,
        sample: response.data.sample
      };
    } catch (error) {
      logger.error(`JinaAI selector test failed: ${error}`);
      throw new Error(`Failed to test selector: ${(error as Error).message}`);
    }
  }

  /**
   * Start a crawler job
   * @param config Crawler configuration
   * @param options Job options
   */
  async startJob(config: CrawlerConfig, options?: CrawlerJobOptions): Promise<{ jobId: string; status: string }> {
    if (!this.apiClient) {
      throw new Error('Service not initialized');
    }

    try {
      // Generate internal job ID
      const jobId = uuidv4();
      
      // Convert our config format to JinaAI's expected format
      const jinaConfig = {
        url: config.url,
        selectors: config.selectors,
        depth: config.depth || 1,
        max_pages: config.maxPages || 100,
        follow_links: config.followLinks || false,
        include_patterns: config.includePatterns || [],
        exclude_patterns: config.excludePatterns || [],
        headers: config.headers || {},
        timeout: config.timeout || 30000,
        retries: config.retries || 3,
        priority: options?.priority || 0,
        schedule: options?.schedule,
        notify_webhook: options?.notify ? `https://your-webhook-url/crawler/jobs/${jobId}/notify` : undefined
      };
      
      // Start the job with the JinaAI API
      const response = await this.apiClient.post('/jobs', jinaConfig);
      
      // Store the mapping between our job ID and JinaAI's job ID
      this.activeJobs.set(jobId, {
        externalJobId: response.data.job_id,
        status: 'running',
        config
      });
      
      logger.info(`Started JinaAI crawler job ${jobId} (External ID: ${response.data.job_id})`);
      
      return {
        jobId,
        status: 'running'
      };
    } catch (error) {
      logger.error(`Failed to start JinaAI crawler job: ${error}`);
      throw new Error(`Failed to start crawler job: ${(error as Error).message}`);
    }
  }

  /**
   * Stop a running crawler job
   * @param jobId ID of the job to stop
   */
  async stopJob(jobId: string): Promise<boolean> {
    if (!this.apiClient) {
      throw new Error('Service not initialized');
    }

    try {
      // Get the external job ID
      const jobInfo = this.activeJobs.get(jobId);
      
      if (!jobInfo) {
        logger.warn(`Attempted to stop unknown job: ${jobId}`);
        return false;
      }
      
      // Call the JinaAI API to stop the job
      await this.apiClient.post(`/jobs/${jobInfo.externalJobId}/stop`);
      
      // Update job status
      this.activeJobs.set(jobId, {
        ...jobInfo,
        status: 'stopped'
      });
      
      logger.info(`Stopped JinaAI crawler job ${jobId} (External ID: ${jobInfo.externalJobId})`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to stop JinaAI crawler job ${jobId}: ${error}`);
      return false;
    }
  }

  /**
   * Get the status of a crawler job
   * @param jobId ID of the job to get status for
   */
  async getJobStatus(jobId: string): Promise<{ 
    jobId: string; 
    status: string; 
    progress: number; 
    pagesProcessed: number; 
    error?: string; 
  }> {
    if (!this.apiClient) {
      throw new Error('Service not initialized');
    }
    
    try {
      // Get the external job ID
      const jobInfo = this.activeJobs.get(jobId);
      
      if (!jobInfo) {
        logger.warn(`Attempted to get status for unknown job: ${jobId}`);
        throw new Error(`Job not found: ${jobId}`);
      }
      
      // Call the JinaAI API to get job status
      const response = await this.apiClient.get(`/jobs/${jobInfo.externalJobId}/status`);
      
      // Update job status in our local state
      this.activeJobs.set(jobId, {
        ...jobInfo,
        status: response.data.status
      });
      
      return {
        jobId,
        status: response.data.status,
        progress: response.data.progress,
        pagesProcessed: response.data.pages_processed,
        error: response.data.error
      };
    } catch (error) {
      logger.error(`Failed to get status for JinaAI crawler job ${jobId}: ${error}`);
      throw new Error(`Failed to get job status: ${(error as Error).message}`);
    }
  }

  /**
   * Get the results of a completed crawler job
   * @param jobId ID of the job to get results for
   * @param page Page number for pagination
   * @param limit Number of results per page
   */
  async getJobResults(jobId: string, page: number = 1, limit: number = 100): Promise<CrawlerResult> {
    if (!this.apiClient) {
      throw new Error('Service not initialized');
    }
    
    try {
      // Get the external job ID
      const jobInfo = this.activeJobs.get(jobId);
      
      if (!jobInfo) {
        logger.warn(`Attempted to get results for unknown job: ${jobId}`);
        throw new Error(`Job not found: ${jobId}`);
      }
      
      // Call the JinaAI API to get job results
      const response = await this.apiClient.get(`/jobs/${jobInfo.externalJobId}/results`, {
        params: { page, limit }
      });
      
      // Transform the response to our internal format
      const pages: CrawlerPage[] = response.data.pages.map((page: any) => ({
        url: page.url,
        title: page.title,
        content: page.text_content,
        html: page.html,
        images: page.images,
        links: page.links,
        metadata: page.metadata,
        timestamp: new Date(page.crawled_at).getTime()
      }));
      
      return {
        jobId,
        configId: jobInfo.config.name,
        startTime: new Date(response.data.start_time).getTime(),
        endTime: response.data.end_time ? new Date(response.data.end_time).getTime() : undefined,
        status: response.data.status,
        pagesProcessed: response.data.pages_processed,
        totalPages: response.data.total_pages,
        error: response.data.error,
        pages
      };
    } catch (error) {
      logger.error(`Failed to get results for JinaAI crawler job ${jobId}: ${error}`);
      throw new Error(`Failed to get job results: ${(error as Error).message}`);
    }
  }

  /**
   * Transform crawler results into training data format
   * @param result Crawler results to transform
   * @param outputDir Directory to save transformed data
   */
  async transformResultsToTrainingData(
    result: CrawlerResult, 
    outputDir: string
  ): Promise<{ 
    datasetPath: string; 
    totalItems: number; 
    categories: string[];
  }> {
    try {
      // Create the output directory structure
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const datasetDir = path.join(outputDir, `jina-crawl-${result.jobId}-${timestamp}`);
      
      // Create directory and subdirectories for different content types
      fs.mkdirSync(datasetDir, { recursive: true });
      fs.mkdirSync(path.join(datasetDir, 'text'), { recursive: true });
      fs.mkdirSync(path.join(datasetDir, 'images'), { recursive: true });
      
      // Track categories/content types found in the data
      const categories = new Set<string>(['text', 'image']);
      let totalItems = 0;
      
      // Process each crawled page
      for (const page of result.pages) {
        if (!page.content && !page.images?.length) {
          continue; // Skip pages with no useful content
        }
        
        // Extract domain as a basic category
        const domain = new URL(page.url).hostname.replace(/^www\./i, '');
        const pageId = uuidv4().substring(0, 8);
        
        // Save text content
        if (page.content) {
          const textPath = path.join(datasetDir, 'text', `${domain}_${pageId}.txt`);
          fs.writeFileSync(textPath, page.content);
          totalItems++;
        }
        
        // Save images (if any)
        if (page.images && page.images.length > 0) {
          // In a real implementation, we would download these images
          // For now, just track them in the manifest
          const imageManifest = page.images.map(img => ({
            url: img,
            source_page: page.url,
            title: page.title,
            domain
          }));
          
          const imageManifestPath = path.join(datasetDir, 'images', `${domain}_${pageId}_manifest.json`);
          fs.writeFileSync(imageManifestPath, JSON.stringify(imageManifest, null, 2));
          totalItems += page.images.length;
        }
      }
      
      // Create a manifest file with metadata about the dataset
      const manifest = {
        source: 'jina_crawler',
        job_id: result.jobId,
        config_id: result.configId,
        created_at: new Date().toISOString(),
        total_items: totalItems,
        categories: Array.from(categories),
        pages_processed: result.pagesProcessed,
        original_urls: result.pages.map(p => p.url)
      };
      
      fs.writeFileSync(
        path.join(datasetDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      );
      
      logger.info(`Transformed crawler results to training data at ${datasetDir}`);
      
      return {
        datasetPath: datasetDir,
        totalItems,
        categories: Array.from(categories)
      };
    } catch (error) {
      logger.error(`Failed to transform crawler results to training data: ${error}`);
      throw new Error(`Failed to transform results: ${(error as Error).message}`);
    }
  }
}