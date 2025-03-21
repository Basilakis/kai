/**
 * Crawler Service Factory
 * 
 * Factory pattern implementation for selecting and initializing
 * different crawler service providers.
 */

import { CrawlerService, CrawlerConfig } from './crawlerService.interface';
import { JinaAIService } from './jinaService';
import { FirecrawlService } from './firecrawlService';
import { logger } from '../../utils/logger';
import { credentialsManager } from './credentialsManager';

/**
 * Available crawler providers
 */
export const CRAWLER_PROVIDERS = ['jina', 'firecrawl'] as const;
export type CrawlerProvider = typeof CRAWLER_PROVIDERS[number];

/**
 * Credentials required for different providers
 */
export interface CrawlerCredentials {
  provider: CrawlerProvider;
  apiKey: string;
  [key: string]: any; // Additional provider-specific credentials
}

/**
 * Singleton factory class for crawler services
 */
export class CrawlerServiceFactory {
  private static instance: CrawlerServiceFactory;
  private initializedServices: Map<CrawlerProvider, CrawlerService> = new Map();
  // We don't need to store credentials here anymore as we use the credentials manager

  private constructor() {
    // Private constructor to prevent direct instantiation
  }

  /**
   * Get the singleton instance of the factory
   */
  public static getInstance(): CrawlerServiceFactory {
    if (!CrawlerServiceFactory.instance) {
      CrawlerServiceFactory.instance = new CrawlerServiceFactory();
    }
    return CrawlerServiceFactory.instance;
  }

  /**
   * Set credentials for a provider
   * @param credentials Credentials for the provider
   */
   public setCredentials(credentials: CrawlerCredentials): void {
    // Use the credentials manager to store the credentials
    const { provider, apiKey, ...otherCredentials } = credentials;
    credentialsManager.setCredentials(provider, apiKey, otherCredentials);
    
    // If the service is already initialized, reinitialize it with new credentials
    if (this.initializedServices.has(provider)) {
      this.initializedServices.delete(provider);
    }
    
    logger.info(`Updated credentials for provider: ${provider}`);
  }

  /**
   * Get a crawler service instance for the specified provider
   * @param provider The crawler provider to use
   * @returns Initialized crawler service
   */
  public async getService(provider: CrawlerProvider): Promise<CrawlerService> {
    // Check if service is already initialized
    if (this.initializedServices.has(provider)) {
      return this.initializedServices.get(provider)!;
    }
    
    // Get credentials for the provider from the credentials manager
    const credentials = credentialsManager.getFlattenedCredentials(provider);
    if (!credentials) {
      throw new Error(`Credentials not set for provider: ${provider}`);
    }
    
    // Create and initialize the service
    let service: CrawlerService;
    
    switch (provider) {
      case 'jina':
        service = new JinaAIService();
        break;
      case 'firecrawl':
        service = new FirecrawlService();
        break;
      default:
        throw new Error(`Unsupported crawler provider: ${provider}`);
    }
    
    // Initialize the service
    const initialized = await service.initialize(credentials);
    
    if (!initialized) {
      throw new Error(`Failed to initialize crawler service for provider: ${provider}`);
    }
    
    // Cache the initialized service
    this.initializedServices.set(provider, service);
    logger.info(`Initialized crawler service for provider: ${provider}`);
    
    return service;
  }

  /**
   * Get a crawler service based on a configuration's provider
   * @param config Crawler configuration with provider specified
   * @returns Initialized crawler service
   */
  public async getServiceForConfig(config: CrawlerConfig): Promise<CrawlerService> {
    return this.getService(config.provider);
  }

  /**
   * Get the list of available providers
   * @returns Array of available provider names
   */
  public getAvailableProviders(): CrawlerProvider[] {
    return [...CRAWLER_PROVIDERS];
  }

  /**
   * Check if a provider is supported
   * @param provider Provider name to check
   * @returns True if the provider is supported
   */
  public isProviderSupported(provider: string): provider is CrawlerProvider {
    return CRAWLER_PROVIDERS.includes(provider as CrawlerProvider);
  }
}

// Export a singleton instance
export const crawlerServiceFactory = CrawlerServiceFactory.getInstance();