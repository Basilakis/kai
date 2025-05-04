/**
 * Specialized Crawlers
 * 
 * This module provides specialized crawlers for different property types.
 */

import { logger } from '../../utils/logger';
import { CrawlerServiceFactory } from './crawler-service-factory';
import { CrawlerService } from './crawler-service';
import { MaterialType } from '@kai/ml';
import { prisma } from '../prisma';

/**
 * Specialized Crawler Configuration
 */
export interface SpecializedCrawlerConfig {
  id: string;
  name: string;
  description?: string;
  propertyName: string;
  materialType: MaterialType;
  crawlerType: string;
  baseConfig: any;
  extractionRules: any;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Specialized Crawler Result
 */
export interface SpecializedCrawlerResult {
  jobId: string;
  propertyName: string;
  materialType: MaterialType;
  status: string;
  results: any[];
  stats: {
    pagesVisited: number;
    imagesExtracted: number;
    dataExtracted: number;
  };
}

/**
 * Specialized Crawler Service
 */
export class SpecializedCrawlerService {
  private crawlerServiceFactory: CrawlerServiceFactory;
  
  constructor() {
    this.crawlerServiceFactory = new CrawlerServiceFactory();
  }
  
  /**
   * Create a specialized crawler configuration
   * 
   * @param name The name of the crawler
   * @param propertyName The name of the property
   * @param materialType The type of material
   * @param crawlerType The type of crawler
   * @param baseConfig The base configuration
   * @param extractionRules The extraction rules
   * @param description Optional description
   * @returns The crawler configuration
   */
  public async createCrawlerConfig(
    name: string,
    propertyName: string,
    materialType: MaterialType,
    crawlerType: string,
    baseConfig: any,
    extractionRules: any,
    description?: string
  ): Promise<SpecializedCrawlerConfig> {
    try {
      logger.info(`Creating specialized crawler config: ${name} for ${propertyName} (${materialType})`);
      
      // Create crawler configuration
      const config = await prisma.specializedCrawlerConfig.create({
        data: {
          name,
          description,
          propertyName,
          materialType,
          crawlerType,
          baseConfig,
          extractionRules
        }
      });
      
      return config as unknown as SpecializedCrawlerConfig;
    } catch (error) {
      logger.error(`Error creating specialized crawler config: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get a specialized crawler configuration
   * 
   * @param configId The ID of the configuration
   * @returns The crawler configuration
   */
  public async getCrawlerConfig(configId: string): Promise<SpecializedCrawlerConfig> {
    try {
      logger.info(`Getting specialized crawler config: ${configId}`);
      
      // Get crawler configuration
      const config = await prisma.specializedCrawlerConfig.findUnique({
        where: { id: configId }
      });
      
      if (!config) {
        throw new Error(`Crawler configuration not found: ${configId}`);
      }
      
      return config as unknown as SpecializedCrawlerConfig;
    } catch (error) {
      logger.error(`Error getting specialized crawler config: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get all specialized crawler configurations
   * 
   * @param propertyName Optional property name filter
   * @param materialType Optional material type filter
   * @returns The list of crawler configurations
   */
  public async getAllCrawlerConfigs(
    propertyName?: string,
    materialType?: MaterialType
  ): Promise<SpecializedCrawlerConfig[]> {
    try {
      logger.info(`Getting all specialized crawler configs`);
      
      // Build query
      const where: any = {};
      
      if (propertyName) {
        where.propertyName = propertyName;
      }
      
      if (materialType) {
        where.materialType = materialType;
      }
      
      // Get crawler configurations
      const configs = await prisma.specializedCrawlerConfig.findMany({
        where
      });
      
      return configs as unknown as SpecializedCrawlerConfig[];
    } catch (error) {
      logger.error(`Error getting all specialized crawler configs: ${error}`);
      throw error;
    }
  }
  
  /**
   * Update a specialized crawler configuration
   * 
   * @param configId The ID of the configuration
   * @param updates The updates to apply
   * @returns The updated crawler configuration
   */
  public async updateCrawlerConfig(
    configId: string,
    updates: Partial<SpecializedCrawlerConfig>
  ): Promise<SpecializedCrawlerConfig> {
    try {
      logger.info(`Updating specialized crawler config: ${configId}`);
      
      // Update crawler configuration
      const config = await prisma.specializedCrawlerConfig.update({
        where: { id: configId },
        data: updates
      });
      
      return config as unknown as SpecializedCrawlerConfig;
    } catch (error) {
      logger.error(`Error updating specialized crawler config: ${error}`);
      throw error;
    }
  }
  
  /**
   * Delete a specialized crawler configuration
   * 
   * @param configId The ID of the configuration
   */
  public async deleteCrawlerConfig(configId: string): Promise<void> {
    try {
      logger.info(`Deleting specialized crawler config: ${configId}`);
      
      // Delete crawler configuration
      await prisma.specializedCrawlerConfig.delete({
        where: { id: configId }
      });
    } catch (error) {
      logger.error(`Error deleting specialized crawler config: ${error}`);
      throw error;
    }
  }
  
  /**
   * Run a specialized crawler
   * 
   * @param configId The ID of the configuration
   * @param options Optional options
   * @returns The crawler result
   */
  public async runCrawler(
    configId: string,
    options?: {
      startUrl?: string;
      maxPages?: number;
      maxDepth?: number;
      credentials?: Record<string, string>;
    }
  ): Promise<SpecializedCrawlerResult> {
    try {
      logger.info(`Running specialized crawler: ${configId}`);
      
      // Get crawler configuration
      const config = await this.getCrawlerConfig(configId);
      
      // Get crawler service
      const crawlerService = this.crawlerServiceFactory.getCrawlerService(config.crawlerType);
      
      if (!crawlerService) {
        throw new Error(`Crawler service not found: ${config.crawlerType}`);
      }
      
      // Prepare crawler configuration
      const crawlerConfig = {
        ...config.baseConfig,
        ...options,
        extractionRules: config.extractionRules
      };
      
      // Run crawler
      const jobId = await crawlerService.startCrawlJob(crawlerConfig);
      
      // Create job record
      await prisma.specializedCrawlerJob.create({
        data: {
          jobId,
          configId: config.id,
          propertyName: config.propertyName,
          materialType: config.materialType,
          status: 'running',
          config: crawlerConfig
        }
      });
      
      // Wait for job to complete
      const result = await this.waitForJobCompletion(jobId, crawlerService);
      
      // Update job record
      await prisma.specializedCrawlerJob.update({
        where: { jobId },
        data: {
          status: result.status,
          results: result.results,
          stats: result.stats
        }
      });
      
      return {
        jobId,
        propertyName: config.propertyName,
        materialType: config.materialType,
        status: result.status,
        results: result.results,
        stats: result.stats
      };
    } catch (error) {
      logger.error(`Error running specialized crawler: ${error}`);
      throw error;
    }
  }
  
  /**
   * Wait for a crawler job to complete
   * 
   * @param jobId The ID of the job
   * @param crawlerService The crawler service
   * @returns The job result
   */
  private async waitForJobCompletion(
    jobId: string,
    crawlerService: CrawlerService
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        try {
          const status = await crawlerService.getCrawlJobStatus(jobId);
          
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(checkInterval);
            
            if (status.status === 'completed') {
              const results = await crawlerService.getCrawlJobResults(jobId);
              resolve({
                status: 'completed',
                results: results.results,
                stats: {
                  pagesVisited: results.stats?.pagesVisited || 0,
                  imagesExtracted: results.stats?.imagesExtracted || 0,
                  dataExtracted: results.stats?.dataExtracted || 0
                }
              });
            } else {
              resolve({
                status: 'failed',
                results: [],
                stats: {
                  pagesVisited: 0,
                  imagesExtracted: 0,
                  dataExtracted: 0
                }
              });
            }
          }
        } catch (error) {
          clearInterval(checkInterval);
          reject(error);
        }
      }, 5000); // Check every 5 seconds
    });
  }
  
  /**
   * Get all specialized crawler jobs
   * 
   * @param propertyName Optional property name filter
   * @param materialType Optional material type filter
   * @param status Optional status filter
   * @returns The list of crawler jobs
   */
  public async getAllCrawlerJobs(
    propertyName?: string,
    materialType?: MaterialType,
    status?: string
  ): Promise<any[]> {
    try {
      logger.info(`Getting all specialized crawler jobs`);
      
      // Build query
      const where: any = {};
      
      if (propertyName) {
        where.propertyName = propertyName;
      }
      
      if (materialType) {
        where.materialType = materialType;
      }
      
      if (status) {
        where.status = status;
      }
      
      // Get crawler jobs
      const jobs = await prisma.specializedCrawlerJob.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      return jobs;
    } catch (error) {
      logger.error(`Error getting all specialized crawler jobs: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get a specialized crawler job
   * 
   * @param jobId The ID of the job
   * @returns The crawler job
   */
  public async getCrawlerJob(jobId: string): Promise<any> {
    try {
      logger.info(`Getting specialized crawler job: ${jobId}`);
      
      // Get crawler job
      const job = await prisma.specializedCrawlerJob.findUnique({
        where: { jobId }
      });
      
      if (!job) {
        throw new Error(`Crawler job not found: ${jobId}`);
      }
      
      return job;
    } catch (error) {
      logger.error(`Error getting specialized crawler job: ${error}`);
      throw error;
    }
  }
  
  /**
   * Import crawler results to visual reference library
   * 
   * @param jobId The ID of the job
   * @param options Import options
   * @returns The import result
   */
  public async importToVisualReferenceLibrary(
    jobId: string,
    options: {
      autoClassify?: boolean;
      maxImages?: number;
    } = {}
  ): Promise<any> {
    try {
      logger.info(`Importing crawler results to visual reference library: ${jobId}`);
      
      // Get crawler job
      const job = await this.getCrawlerJob(jobId);
      
      // Import to visual reference library
      const response = await fetch('/api/ai/visual-reference/import/crawler/' + jobId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          propertyName: job.propertyName,
          materialType: job.materialType,
          autoClassify: options.autoClassify,
          maxImages: options.maxImages
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error importing to visual reference library: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      return result;
    } catch (error) {
      logger.error(`Error importing to visual reference library: ${error}`);
      throw error;
    }
  }
}

// Create a singleton instance
export const specializedCrawlerService = new SpecializedCrawlerService();
