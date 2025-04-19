/**
 * Base Service Implementation
 * 
 * Provides a standardized foundation for all service implementations across packages.
 * Handles common concerns like HTTP requests, error handling, logging, and configuration.
 */

import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse, AxiosError, AxiosInstance } from 'axios';
import { createLogger } from '../../utils/unified-logger';

const logger = createLogger('BaseService');

/**
 * API Error class for consistent error handling across services
 */
export class ApiError extends Error {
  statusCode: number;
  data?: any;
  
  constructor(message: string, statusCode: number = 0, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

/**
 * Service configuration interface
 */
export interface ServiceConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  useAuth?: boolean;
  retryAttempts?: number;
}

/**
 * Authentication provider interface
 * Implementations can handle different auth mechanisms
 */
export interface AuthProvider {
  getToken(): Promise<string | null>;
  clearTokens(): void;
}

/**
 * Base service class that all service implementations should extend
 */
export abstract class BaseService {
  protected client: AxiosInstance;
  protected baseURL: string;
  protected useAuth: boolean;
  protected authProvider?: AuthProvider;
  
  /**
   * Create a new service instance
   */
  constructor(config: ServiceConfig, authProvider?: AuthProvider) {
    this.baseURL = config.baseURL;
    this.useAuth = config.useAuth !== false; // Default to true
    this.authProvider = authProvider;
    
    // Create axios instance with default configuration
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers || {}),
      },
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use(
      async (requestConfig: AxiosRequestConfig) => {
        // Add authentication token if available and auth is enabled
        if (this.useAuth && this.authProvider) {
          try {
            const token = await this.authProvider.getToken();
            if (token && requestConfig.headers) {
              requestConfig.headers['Authorization'] = `Bearer ${token}`;
            }
          } catch (error) {
            logger.warn(`Failed to get authentication token: ${error}`);
          }
        }
        return requestConfig;
      },
      (error: Error) => {
        logger.error(`Request error: ${error.message}`);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        if (error.response) {
          logger.error(`Service error: ${error.response.status} ${error.response.statusText}`);
          logger.debug(`Error details: ${JSON.stringify(error.response.data)}`);
          
          // Handle authentication errors (401)
          if (error.response.status === 401 && this.useAuth && this.authProvider) {
            logger.warn('Received 401 Unauthorized, auth token may be expired');
            
            // Clear credentials if unauthorized
            this.authProvider.clearTokens();
          }
          
          throw new ApiError(
            error.response.statusText || 'Service error',
            error.response.status,
            error.response.data
          );
        } else if (error.request) {
          logger.error(`Network error: ${error.message}`);
          throw new ApiError('Network error', 0);
        } else {
          logger.error(`Error: ${error.message}`);
          throw new ApiError(error.message || 'Unknown error', 0);
        }
      }
    );
    
    logger.info(`Service initialized with base URL: ${this.baseURL}`);
  }

  /**
   * Perform a GET request
   */
  protected async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      logger.debug(`GET ${url}`);
      const response: AxiosResponse<T> = await this.client.get(url, config);
      return response.data;
    } catch (error) {
      logger.error(`GET ${url} failed: ${error}`);
      throw error;
    }
  }

  /**
   * Perform a POST request
   */
  protected async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      logger.debug(`POST ${url}`);
      const response: AxiosResponse<T> = await this.client.post(url, data, config);
      return response.data;
    } catch (error) {
      logger.error(`POST ${url} failed: ${error}`);
      throw error;
    }
  }

  /**
   * Perform a PUT request
   */
  protected async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      logger.debug(`PUT ${url}`);
      const response: AxiosResponse<T> = await this.client.put(url, data, config);
      return response.data;
    } catch (error) {
      logger.error(`PUT ${url} failed: ${error}`);
      throw error;
    }
  }

  /**
   * Perform a DELETE request
   */
  protected async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      logger.debug(`DELETE ${url}`);
      const response: AxiosResponse<T> = await this.client.delete(url, config);
      return response.data;
    } catch (error) {
      logger.error(`DELETE ${url} failed: ${error}`);
      throw error;
    }
  }
  
  /**
   * Perform a PATCH request
   */
  protected async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      logger.debug(`PATCH ${url}`);
      const response: AxiosResponse<T> = await this.client.patch(url, data, config);
      return response.data;
    } catch (error) {
      logger.error(`PATCH ${url} failed: ${error}`);
      throw error;
    }
  }
}