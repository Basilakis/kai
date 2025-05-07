/**
 * Unified API Client
 *
 * This module provides a unified API client for making HTTP requests.
 * It consolidates duplicate API client implementations across packages.
 *
 * Features:
 * - Consistent error handling
 * - Automatic token management
 * - Request/response interceptors
 * - Retry mechanism
 * - Request cancellation
 * - Type-safe requests and responses
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError, CancelTokenSource } from 'axios';
import { createLogger } from '../../utils/unified-logger';
import { auth } from '../auth/authService';
import { config } from '../../utils/unified-config';
import { cache, CacheOptions } from '../cache';
import { tracing, SpanKind, SpanStatusCode } from '../tracing';

const logger = createLogger('ApiClient');

/**
 * API client configuration
 */
export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  useAuth?: boolean;
  retryCount?: number;
  retryDelay?: number;
  useCache?: boolean;
  cacheNamespace?: string;
  cacheTtl?: number;
  useTracing?: boolean;
  tracingAttributes?: Record<string, string>;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

/**
 * API error class
 */
export class ApiError extends Error {
  public status: number;
  public code?: string;
  public details?: any;
  public isApiError: boolean = true;

  constructor(message: string, status: number = 500, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /**
   * Create an ApiError from an AxiosError
   */
  public static fromAxiosError(error: AxiosError): ApiError {
    const status = error.response?.status || 500;
    const data = error.response?.data as any;

    if (data && typeof data === 'object') {
      return new ApiError(
        data.message || error.message,
        status,
        data.code,
        data.details
      );
    }

    return new ApiError(error.message, status);
  }
}

/**
 * Unified API Client
 */
export class ApiClient {
  protected client: AxiosInstance;
  protected config: ApiClientConfig;
  protected cancelTokens: Map<string, CancelTokenSource> = new Map();

  /**
   * Create a new API client
   */
  constructor(config: ApiClientConfig) {
    this.config = {
      ...config,
      timeout: config.timeout || 30000,
      retryCount: config.retryCount || 3,
      retryDelay: config.retryDelay || 1000,
      useCache: config.useCache !== undefined ? config.useCache : true,
      cacheNamespace: config.cacheNamespace || 'api',
      cacheTtl: config.cacheTtl || 300, // 5 minutes
      useTracing: config.useTracing !== undefined ? config.useTracing : true,
      tracingAttributes: config.tracingAttributes || {}
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      }
    });

    this.setupInterceptors();

    logger.info(`ApiClient initialized with baseURL: ${this.config.baseURL}`);
  }

  /**
   * Set up request and response interceptors
   */
  protected setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        // Add authentication token if needed
        if (this.config.useAuth) {
          const token = await auth.getToken();
          if (token) {
            config.headers = config.headers || {};
            config.headers['Authorization'] = `Bearer ${token}`;
          }
        }

        // Add tracing headers if enabled
        if (this.config.useTracing) {
          const currentSpan = tracing.getCurrentSpan();

          if (currentSpan) {
            // Inject trace context into headers
            config.headers = config.headers || {};
            tracing.injectContext(
              {
                traceId: currentSpan.spanContext().traceId,
                spanId: currentSpan.spanContext().spanId,
                traceFlags: currentSpan.spanContext().traceFlags
              },
              config.headers
            );
          }
        }

        return config;
      },
      (error) => {
        logger.error('Request error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error) => {
        // Handle authentication errors
        if (error.response?.status === 401 && this.config.useAuth) {
          try {
            // Try to refresh the token
            await auth.refreshToken();

            // Retry the request with the new token
            const token = await auth.getToken();
            if (token) {
              error.config.headers['Authorization'] = `Bearer ${token}`;
              return this.client.request(error.config);
            }
          } catch (refreshError) {
            logger.error('Token refresh failed', refreshError);
          }
        }

        // Convert to ApiError
        const apiError = ApiError.fromAxiosError(error);
        logger.error(`API error: ${apiError.message}`, {
          status: apiError.status,
          code: apiError.code,
          url: error.config?.url
        });

        return Promise.reject(apiError);
      }
    );
  }

  /**
   * Make a request with retry capability
   */
  protected async requestWithRetry<T>(
    config: AxiosRequestConfig,
    retryCount: number = this.config.retryCount || 3,
    retryDelay: number = this.config.retryDelay || 1000
  ): Promise<AxiosResponse<T>> {
    let lastError: any;

    // Create a span for the request if tracing is enabled
    const spanName = `HTTP ${config.method?.toUpperCase() || 'REQUEST'} ${config.url || ''}`;
    const spanAttributes = {
      'http.method': config.method?.toUpperCase() || 'UNKNOWN',
      'http.url': this.config.baseURL + (config.url || ''),
      'http.target': config.url || '',
      ...this.config.tracingAttributes
    };

    // If params are present, add them to the span attributes
    if (config.params) {
      try {
        spanAttributes['http.params'] = JSON.stringify(config.params);
      } catch (e) {
        // Ignore serialization errors
      }
    }

    // Use tracing if enabled
    if (this.config.useTracing) {
      return await tracing.withSpan(
        spanName,
        async () => {
          // Get the current span
          const span = tracing.getCurrentSpan();

          if (span) {
            // Add attributes to the span
            tracing.addSpanAttributes(span, spanAttributes);
          }

          // Execute the request with retry logic
          for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
              const response = await this.client.request<T>(config);

              // Add response attributes to the span
              if (span) {
                tracing.addSpanAttributes(span, {
                  'http.status_code': response.status,
                  'http.response_content_length': response.headers['content-length'] || '0'
                });

                // Set span status
                tracing.setSpanStatus(span, SpanStatusCode.OK);
              }

              return response;
            } catch (error) {
              lastError = error;

              // Add error attributes to the span
              if (span) {
                tracing.addSpanEvent(span, 'error', {
                  'error.message': error instanceof Error ? error.message : String(error),
                  'error.attempt': attempt + 1,
                  'error.max_attempts': retryCount + 1
                });
              }

              // Don't retry if it's a client error (4xx) except for 429 (rate limit)
              if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) {
                break;
              }

              // Don't retry if it's a cancellation
              if (axios.isCancel(error)) {
                break;
              }

              // Last attempt, don't wait
              if (attempt === retryCount) {
                break;
              }

              // Wait before retrying
              const delay = retryDelay * Math.pow(2, attempt);
              logger.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${retryCount})`, {
                url: config.url,
                method: config.method,
                error: lastError.message
              });

              // Add retry event to the span
              if (span) {
                tracing.addSpanEvent(span, 'retry', {
                  'retry.attempt': attempt + 1,
                  'retry.delay': delay,
                  'retry.max_attempts': retryCount + 1
                });
              }

              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }

          // Set span status to error
          if (span) {
            tracing.setSpanStatus(
              span,
              SpanStatusCode.ERROR,
              lastError instanceof Error ? lastError.message : String(lastError)
            );
          }

          throw lastError;
        },
        {
          kind: SpanKind.CLIENT,
          attributes: spanAttributes
        }
      );
    } else {
      // Execute without tracing
      for (let attempt = 0; attempt <= retryCount; attempt++) {
        try {
          return await this.client.request<T>(config);
        } catch (error) {
          lastError = error;

          // Don't retry if it's a client error (4xx) except for 429 (rate limit)
          if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) {
            break;
          }

          // Don't retry if it's a cancellation
          if (axios.isCancel(error)) {
            break;
          }

          // Last attempt, don't wait
          if (attempt === retryCount) {
            break;
          }

          // Wait before retrying
          const delay = retryDelay * Math.pow(2, attempt);
          logger.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${retryCount})`, {
            url: config.url,
            method: config.method,
            error: lastError.message
          });

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      throw lastError;
    }
  }

  /**
   * Make a GET request
   * @param url URL to request
   * @param params Query parameters
   * @param config Request configuration
   * @param cacheOptions Caching options (set to false to disable caching for this request)
   * @returns Response data
   */
  public async get<T>(
    url: string,
    params?: Record<string, any>,
    config?: AxiosRequestConfig,
    cacheOptions?: CacheOptions | false
  ): Promise<T> {
    // Skip caching if disabled globally or for this request
    if (!this.config.useCache || cacheOptions === false) {
      const response = await this.requestWithRetry<T>({
        ...config,
        method: 'GET',
        url,
        params
      });

      return response.data;
    }

    // Generate cache key
    const cacheKey = this.generateCacheKey(url, params);

    // Try to get from cache
    const cachedData = await cache.get<T>(cacheKey, {
      namespace: this.config.cacheNamespace,
      ...cacheOptions
    });

    if (cachedData !== null) {
      logger.debug(`Cache hit for ${url}`, { params });
      return cachedData;
    }

    // Cache miss, make the request
    logger.debug(`Cache miss for ${url}`, { params });
    const response = await this.requestWithRetry<T>({
      ...config,
      method: 'GET',
      url,
      params
    });

    // Cache the response
    await cache.set<T>(
      cacheKey,
      response.data,
      {
        namespace: this.config.cacheNamespace,
        ttl: this.config.cacheTtl,
        ...cacheOptions
      }
    );

    return response.data;
  }

  /**
   * Generate a cache key for a request
   */
  private generateCacheKey(url: string, params?: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) {
      return url;
    }

    // Sort params to ensure consistent keys
    const sortedParams = Object.keys(params)
      .sort()
      .reduce<Record<string, any>>((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {});

    return `${url}?${JSON.stringify(sortedParams)}`;
  }

  /**
   * Make a POST request
   */
  public async post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.requestWithRetry<T>({
      ...config,
      method: 'POST',
      url,
      data
    });

    return response.data;
  }

  /**
   * Make a PUT request
   */
  public async put<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.requestWithRetry<T>({
      ...config,
      method: 'PUT',
      url,
      data
    });

    return response.data;
  }

  /**
   * Make a PATCH request
   */
  public async patch<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.requestWithRetry<T>({
      ...config,
      method: 'PATCH',
      url,
      data
    });

    return response.data;
  }

  /**
   * Make a DELETE request
   */
  public async delete<T>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.requestWithRetry<T>({
      ...config,
      method: 'DELETE',
      url
    });

    return response.data;
  }

  /**
   * Upload a file
   */
  public async uploadFile<T>(
    url: string,
    file: File | Blob | Buffer,
    fieldName: string = 'file',
    additionalData?: Record<string, any>,
    config?: AxiosRequestConfig
  ): Promise<T> {
    // Create form data
    const formData = new FormData();
    formData.append(fieldName, file);

    // Add additional data
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    const response = await this.requestWithRetry<T>({
      ...config,
      method: 'POST',
      url,
      data: formData,
      headers: {
        ...config?.headers,
        'Content-Type': 'multipart/form-data'
      }
    });

    return response.data;
  }

  /**
   * Download a file
   */
  public async downloadFile(
    url: string,
    params?: Record<string, any>,
    config?: AxiosRequestConfig
  ): Promise<{ data: Blob; filename?: string }> {
    const response = await this.requestWithRetry<Blob>({
      ...config,
      method: 'GET',
      url,
      params,
      responseType: 'blob'
    });

    // Try to get filename from Content-Disposition header
    const contentDisposition = response.headers['content-disposition'];
    let filename: string | undefined;

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }

    return {
      data: response.data,
      filename
    };
  }

  /**
   * Cancel all pending requests
   */
  public cancelAllRequests(reason: string = 'Request cancelled'): void {
    this.cancelTokens.forEach((source, key) => {
      source.cancel(reason);
      this.cancelTokens.delete(key);
    });

    logger.debug('All pending requests cancelled');
  }

  /**
   * Clear the API cache
   * @param url Optional URL to clear cache for a specific endpoint
   * @param params Optional parameters to clear cache for a specific request
   */
  public async clearCache(url?: string, params?: Record<string, any>): Promise<void> {
    if (!this.config.useCache) {
      return;
    }

    if (url) {
      // Clear cache for a specific endpoint
      const cacheKey = this.generateCacheKey(url, params);
      await cache.delete(cacheKey, { namespace: this.config.cacheNamespace });
      logger.debug(`Cache cleared for ${url}`, { params });
    } else {
      // Clear all cache for this API client
      await cache.clear({ namespace: this.config.cacheNamespace });
      logger.info(`All cache cleared for namespace: ${this.config.cacheNamespace}`);
    }
  }

  /**
   * Create a new instance with the same configuration
   */
  public clone(): ApiClient {
    return new ApiClient(this.config);
  }
}

/**
 * Create an API client with default configuration
 */
export function createApiClient(overrides?: Partial<ApiClientConfig>): ApiClient {
  const apiConfig = config.get('api');

  const defaultConfig: ApiClientConfig = {
    baseURL: apiConfig?.url || 'http://localhost:3000/api',
    timeout: apiConfig?.timeout || 30000,
    useAuth: true,
    useCache: apiConfig?.useCache !== undefined ? apiConfig.useCache : true,
    cacheNamespace: apiConfig?.cacheNamespace || 'api',
    cacheTtl: apiConfig?.cacheTtl || 300, // 5 minutes
    useTracing: apiConfig?.useTracing !== undefined ? apiConfig.useTracing : true,
    tracingAttributes: apiConfig?.tracingAttributes || {
      'service.name': 'api-client',
      'client.name': '@kai/shared'
    }
  };

  return new ApiClient({
    ...defaultConfig,
    ...overrides
  });
}

// Export default API client instance
export const apiClient = createApiClient();

// Export default for convenience
export default apiClient;
