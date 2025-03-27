/**
 * Base Service Connector
 * 
 * Provides a foundation for connecting to KAI services with authentication
 * and error handling. All service-specific connectors should extend this class.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import { createLogger } from '../utils/logger';
import { authService } from './authService';

const logger = createLogger('BaseService');

/**
 * Service configuration interface
 */
export interface ServiceConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  useAuth?: boolean;
}

/**
 * API Error class for consistent error handling
 */
export class ApiError extends Error {
  statusCode: number;
  data?: any;
  
  constructor(message: string, statusCode: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

/**
 * Base service class for API connections
 */
export class BaseService {
  protected client: AxiosInstance;
  protected baseURL: string;
  protected useAuth: boolean;

  constructor(config: ServiceConfig) {
    this.baseURL = config.baseURL;
    this.useAuth = config.useAuth !== false; // Default to true
    
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
      async (config: AxiosRequestConfig) => {
        // Add authentication token if available and auth is enabled
        if (this.useAuth) {
          try {
            const token = await this.getAuthToken();
            if (token && config.headers) {
              config.headers['Authorization'] = `Bearer ${token}`;
            }
          } catch (error) {
            logger.warn(`Failed to get authentication token: ${error}`);
          }
        }
        return config;
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
          if (error.response.status === 401 && this.useAuth) {
            logger.warn('Received 401 Unauthorized, auth token may be expired');
            
            // Clear credentials if unauthorized
            // This will force a re-authentication on next request
            authService.clearCredentials();
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
   * Get the authentication token
   * Uses the AuthService for token management
   */
  protected async getAuthToken(): Promise<string | null> {
    if (!this.useAuth) {
      return null;
    }
    
    return await authService.getToken();
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
}