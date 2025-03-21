/**
 * Crawler Credentials Manager
 * 
 * Manages API credentials for crawler services.
 * Uses basic encoding for development. In production,
 * this would be replaced with proper encryption.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { CrawlerProvider } from './crawlerServiceFactory';

/**
 * Simple encoding/decoding functions for development
 * NOT secure - just prevents plain text storage
 */
function encodeString(str: string): string {
  // Simple encoding - not secure!
  let encoded = '';
  for (let i = 0; i < str.length; i++) {
    encoded += String.fromCharCode(str.charCodeAt(i) + 1);
  }
  return `KAI_CRED_${btoa(encoded)}`;
}

function decodeString(encoded: string): string {
  if (!encoded.startsWith('KAI_CRED_')) {
    throw new Error('Invalid encoded format');
  }
  
  // Remove prefix and decode
  const base64 = encoded.substring(9);
  const decoded = atob(base64);
  
  // Reverse the encoding
  let result = '';
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) - 1);
  }
  return result;
}

/**
 * Provider credential data structure
 */
export interface ProviderCredentials {
  provider: CrawlerProvider;
  apiKey: string;
  additionalKeys?: Record<string, string>;
  created: number;
  lastUsed?: number;
  lastTested?: number;
  isValid?: boolean;
}

/**
 * Credentials test result
 */
export interface CredentialsTestResult {
  provider: CrawlerProvider;
  isValid: boolean;
  message?: string;
  details?: any;
}

/**
 * Crawler Credentials Manager
 */
export class CrawlerCredentialsManager {
  private storageDir: string;
  private credentialsFile: string;
  private credentials: Map<CrawlerProvider, ProviderCredentials> = new Map();
  
  /**
   * Create a new credentials manager
   * @param storageDir Directory for storing credentials
   */
  constructor(storageDir?: string) {
    this.storageDir = storageDir || path.join(process.cwd(), 'data', 'secure');
    this.credentialsFile = path.join(this.storageDir, 'crawler-credentials.enc');
    
    // Create the storage directory if it doesn't exist
    fs.mkdirSync(this.storageDir, { recursive: true });
    
    // Load credentials on initialization
    this.loadCredentials();
  }
  
  /**
   * Load credentials from storage
   */
  private loadCredentials(): void {
    try {
      if (fs.existsSync(this.credentialsFile)) {
        const encryptedData = fs.readFileSync(this.credentialsFile, 'utf-8');
        const data = this.decrypt(encryptedData);
        
        const parsed = JSON.parse(data) as Record<string, ProviderCredentials>;
        
        this.credentials.clear();
        Object.values(parsed).forEach(cred => {
          this.credentials.set(cred.provider, cred);
        });
        
        logger.info(`Loaded credentials for ${this.credentials.size} providers`);
      } else {
        logger.info('No credentials file found, starting with empty credentials');
      }
    } catch (err) {
      logger.error(`Failed to load credentials: ${err}`);
    }
  }
  
  /**
   * Save credentials to storage
   */
  private saveCredentials(): void {
    try {
      const data: Record<string, ProviderCredentials> = {};
      
      this.credentials.forEach((cred, provider) => {
        data[provider] = cred;
      });
      
      const serialized = JSON.stringify(data);
      const encrypted = this.encrypt(serialized);
      
      fs.writeFileSync(this.credentialsFile, encrypted, 'utf-8');
      
      logger.debug(`Saved credentials for ${this.credentials.size} providers`);
    } catch (err) {
      logger.error(`Failed to save credentials: ${err}`);
    }
  }
  
  /**
   * Encrypt data
   * @param data Data to encrypt
   * @returns Encrypted data
   */
  private encrypt(data: string): string {
    try {
      return encodeString(data);
    } catch (err) {
      logger.error(`Encryption failed: ${err}`);
      throw new Error('Failed to encrypt credentials');
    }
  }
  
  /**
   * Decrypt data
   * @param data Data to decrypt
   * @returns Decrypted data
   */
  private decrypt(data: string): string {
    try {
      return decodeString(data);
    } catch (err) {
      logger.error(`Decryption failed: ${err}`);
      throw new Error('Failed to decrypt credentials');
    }
  }
  
  /**
   * Set credentials for a provider
   * @param provider Provider to set credentials for
   * @param apiKey API key for the provider
   * @param additionalKeys Additional keys for the provider
   * @returns Whether the credentials were set successfully
   */
  public setCredentials(
    provider: CrawlerProvider,
    apiKey: string,
    additionalKeys?: Record<string, string>
  ): boolean {
    try {
      const credentials: ProviderCredentials = {
        provider,
        apiKey,
        additionalKeys,
        created: Date.now(),
        isValid: undefined // Not validated yet
      };
      
      this.credentials.set(provider, credentials);
      this.saveCredentials();
      
      return true;
    } catch (err) {
      logger.error(`Failed to set credentials for ${provider}: ${err}`);
      return false;
    }
  }
  
  /**
   * Get credentials for a provider
   * @param provider Provider to get credentials for
   * @returns Credentials for the provider
   */
  public getCredentials(provider: CrawlerProvider): ProviderCredentials | undefined {
    const credentials = this.credentials.get(provider);
    
    if (credentials) {
      // Update last used timestamp
      credentials.lastUsed = Date.now();
      this.saveCredentials();
    }
    
    return credentials;
  }
  
  /**
   * Get a flattened object with all the provider's credentials
   * @param provider Provider to get credentials for
   * @returns Flattened credentials object
   */
  public getFlattenedCredentials(provider: CrawlerProvider): Record<string, string> | undefined {
    const credentials = this.getCredentials(provider);
    
    if (!credentials) {
      return undefined;
    }
    
    // Base credentials
    const result: Record<string, string> = {
      apiKey: credentials.apiKey
    };
    
    // Additional credentials
    if (credentials.additionalKeys) {
      Object.entries(credentials.additionalKeys).forEach(([key, value]) => {
        result[key] = value;
      });
    }
    
    return result;
  }
  
  /**
   * Check if credentials exist for a provider
   * @param provider Provider to check
   * @returns Whether credentials exist
   */
  public hasCredentials(provider: CrawlerProvider): boolean {
    return this.credentials.has(provider);
  }
  
  /**
   * Remove credentials for a provider
   * @param provider Provider to remove credentials for
   * @returns Whether the credentials were removed
   */
  public removeCredentials(provider: CrawlerProvider): boolean {
    const removed = this.credentials.delete(provider);
    
    if (removed) {
      this.saveCredentials();
    }
    
    return removed;
  }
  
  /**
   * Update credentials validation status
   * @param provider Provider to update
   * @param isValid Whether the credentials are valid
   */
  public updateValidationStatus(provider: CrawlerProvider, isValid: boolean): void {
    const credentials = this.credentials.get(provider);
    
    if (credentials) {
      credentials.isValid = isValid;
      credentials.lastTested = Date.now();
      this.saveCredentials();
    }
  }
  
  /**
   * List all providers with credentials
   * @returns List of providers
   */
  public listProviders(): CrawlerProvider[] {
    return Array.from(this.credentials.keys());
  }
  
  /**
   * Get credential status for all providers
   * @returns Status for each provider
   */
  public getStatus(): Record<CrawlerProvider, { 
    hasCredentials: boolean; 
    isValid?: boolean; 
    lastTested?: number;
  }> {
    const result: Record<string, any> = {};
    
    // Initialize all known providers
    for (const provider of ['jina', 'firecrawl'] as CrawlerProvider[]) {
      result[provider] = { hasCredentials: false };
    }
    
    // Update with actual credentials
    this.credentials.forEach((cred, provider) => {
      result[provider] = {
        hasCredentials: true,
        isValid: cred.isValid,
        lastTested: cred.lastTested
      };
    });
    
    return result as Record<CrawlerProvider, any>;
  }
}

// Export singleton instance
export const credentialsManager = new CrawlerCredentialsManager();