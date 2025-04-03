import { logger } from '../../utils/logger';
import { storage, UploadResult } from '../storage/s3StorageAdapter';
import {
  RecognitionOptions,
  RecognitionResult,
  RecognitionRequest,
  RecognitionError,
  RecognitionStats,
  RecognitionMatch
} from './types';

/**
 * Base class for recognition providers
 */
export abstract class BaseRecognitionProvider<T extends RecognitionMatch = RecognitionMatch> {
  protected readonly logger = logger.child('RecognitionProvider');
  private stats: RecognitionStats = {
    totalRequests: 0,
    averageProcessingTime: 0,
    successRate: 1,
    lastUpdated: new Date()
  };

  /**
   * Recognize content using the provider's implementation
   */
  public async recognize(content: File | Blob | string, options?: RecognitionOptions): Promise<RecognitionResult> {
    const startTime = Date.now();
    const request: RecognitionRequest = {
      id: crypto.randomUUID(),
      status: 'pending',
      options: this.validateOptions(options || {}),
      startTime: new Date()
    };

    try {
      this.logger.info('Starting recognition', { requestId: request.id, options });
      request.status = 'processing';

      const result = await this.recognizeImpl(content, request.options);
      
      request.status = 'completed';
      request.result = result;
      request.endTime = new Date();

      this.updateStats(startTime, true);
      this.logger.info('Recognition completed', { requestId: request.id, matches: result.matches.length });

      return result;
    } catch (error) {
      request.status = 'failed';
      request.error = error instanceof Error ? error.message : 'Unknown error';
      request.endTime = new Date();

      this.updateStats(startTime, false);
      this.logger.error('Recognition failed', { requestId: request.id, error });

      if (error instanceof RecognitionError) {
        throw error;
      }
      throw new RecognitionError(
        'Recognition failed',
        error instanceof Error ? error.message : undefined
      );
    }
  }

  /**
   * Get current recognition statistics
   */
  public getStats(): RecognitionStats {
    return { ...this.stats };
  }

  /**
   * Reset recognition statistics
   */
  public resetStats(): void {
    this.stats = {
      totalRequests: 0,
      averageProcessingTime: 0,
      successRate: 1,
      lastUpdated: new Date()
    };
  }

  /**
   * Provider-specific recognition implementation
   */
  /**
   * Upload content for recognition
   */
  protected async uploadContent(content: File | Blob, bucket: string): Promise<UploadResult> {
    try {
      const filename = content instanceof File ? content.name : `${crypto.randomUUID()}.bin`;
      return await storage.upload(content, {
        bucket,
        path: `temp/${filename}`
      });
    } catch (error) {
      throw new RecognitionError(
        'Failed to upload content',
        error instanceof Error ? error.message : 'UPLOAD_FAILED'
      );
    }
  }

  /**
   * Clean up temporary content
   */
  protected async cleanupContent(contentPath: string, bucket: string): Promise<void> {
    try {
      await storage.delete([contentPath], { bucket });
    } catch (error) {
      this.logger.warn('Failed to delete temporary content', { error, contentPath });
    }
  }

  /**
   * Enrich matches with metadata
   */
  protected abstract enrichMatchesWithMetadata(
    matches: T[]
  ): Promise<T[]>;

  /**
   * Provider-specific recognition implementation
   */
  protected abstract recognizeImpl(
    content: File | Blob | string,
    options: RecognitionOptions
  ): Promise<RecognitionResult>;

  /**
   * Validate and normalize recognition options
   */
  protected validateOptions(options: RecognitionOptions): RecognitionOptions {
    return {
      modelType: options.modelType || 'hybrid',
      confidenceThreshold: this.validateConfidenceThreshold(options.confidenceThreshold),
      maxResults: this.validateMaxResults(options.maxResults),
      metadata: options.metadata
    };
  }

  /**
   * Validate confidence threshold
   */
  protected validateConfidenceThreshold(threshold?: number): number {
    if (threshold === undefined) return 0.5;
    if (threshold < 0 || threshold > 1) {
      throw new RecognitionError(
        'Confidence threshold must be between 0 and 1',
        'INVALID_CONFIDENCE_THRESHOLD'
      );
    }
    return threshold;
  }

  /**
   * Validate max results
   */
  protected validateMaxResults(maxResults?: number): number {
    if (maxResults === undefined) return 10;
    if (maxResults < 1) {
      throw new RecognitionError(
        'Max results must be greater than 0',
        'INVALID_MAX_RESULTS'
      );
    }
    return maxResults;
  }

  /**
   * Filter matches by confidence threshold
   */
  protected filterMatchesByConfidence(
    matches: RecognitionMatch[],
    threshold: number
  ): RecognitionMatch[] {
    return matches.filter(match => match.confidence >= threshold);
  }

  /**
   * Sort matches by confidence
   */
  protected sortMatchesByConfidence(matches: RecognitionMatch[]): RecognitionMatch[] {
    return [...matches].sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Limit number of matches
   */
  protected limitMatches(matches: RecognitionMatch[], limit: number): RecognitionMatch[] {
    return matches.slice(0, limit);
  }

  /**
   * Update recognition statistics
   */
  private updateStats(startTime: number, success: boolean): void {
    const processingTime = Date.now() - startTime;
    const totalRequests = this.stats.totalRequests + 1;
    const totalTime = this.stats.averageProcessingTime * this.stats.totalRequests + processingTime;
    const successCount = success 
      ? this.stats.successRate * this.stats.totalRequests + 1 
      : this.stats.successRate * this.stats.totalRequests;

    this.stats = {
      totalRequests,
      averageProcessingTime: totalTime / totalRequests,
      successRate: successCount / totalRequests,
      lastUpdated: new Date()
    };
  }
}