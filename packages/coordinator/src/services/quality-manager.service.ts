import { Redis } from 'ioredis';
import { Logger } from 'winston';
import { QualityLevel, WorkflowRequest } from '../types';

/**
 * Quality Manager Service
 * 
 * Assesses the appropriate quality level for ML processing based on:
 * 1. Input characteristics (size, quantity, complexity)
 * 2. Available resources (cluster capacity, current load)
 * 3. User subscription tier
 * 4. Historical processing performance
 */
export class QualityManager {
  constructor(
    private redis: Redis,
    private logger: Logger
  ) {
    this.logger.info('Quality Manager service initialized');
  }
  
  /**
   * Assess the appropriate quality level for a workflow request
   * @param request The workflow request
   * @returns The assessed quality level and contributing factors
   */
  public async assessQuality(request: WorkflowRequest): Promise<{
    qualityLevel: QualityLevel,
    factors: Record<string, number>
  }> {
    const factors: Record<string, number> = {};
    
    // 1. Analyze input parameters
    const inputFactor = this.analyzeInputs(request);
    factors.input = inputFactor.score;
    
    // 2. Check available resources
    const resourceFactor = await this.checkResourceAvailability();
    factors.resources = resourceFactor.score;
    
    // 3. Consider subscription tier
    const subscriptionFactor = this.evaluateSubscription(request.subscriptionTier);
    factors.subscription = subscriptionFactor.score;
    
    // 4. Check historical processing performance
    const historyFactor = await this.checkProcessingHistory(request.type);
    factors.history = historyFactor.score;
    
    // 5. Consider user preferences (if specified)
    if (request.qualityPreference) {
      factors.preference = this.mapPreferenceToScore(request.qualityPreference);
    }
    
    // Combine factors and determine quality level
    const qualityLevel = this.determineQualityLevel(factors);
    
    this.logger.info('Quality assessment completed', {
      requestType: request.type,
      factors,
      qualityLevel
    });
    
    return { qualityLevel, factors };
  }
  
  /**
   * Analyze input parameters to determine complexity and size
   * @param request The workflow request
   * @returns Input analysis result with score (0-1)
   */
  private analyzeInputs(request: WorkflowRequest): {
    score: number,
    complexity: 'low' | 'medium' | 'high',
    size: 'small' | 'medium' | 'large'
  } {
    // Start with 'medium' complexity as the default value
    let complexity: 'low' | 'medium' | 'high' = 'medium';
    let size: 'small' | 'medium' | 'large' = 'medium';
    
    // Analyze based on request type and parameters
    switch (request.type) {
      case '3d-reconstruction':
        return this.analyze3DReconstructionInputs(request);
      
      case 'material-recognition':
        return this.analyzeMaterialRecognitionInputs(request);
      
      case 'scene-graph-generation':
        return this.analyzeSceneGraphInputs(request);
      
      case 'room-layout':
        return this.analyzeRoomLayoutInputs(request);
      
      default:
        // Default analysis for unknown types
        // Score of 0.5 represents medium quality
        return {
          score: 0.5,
          complexity: 'medium',
          size: 'medium'
        };
    }
  }
  
  /**
   * Analyze 3D reconstruction inputs
   * @param request The workflow request
   * @returns Input analysis result
   */
  private analyze3DReconstructionInputs(request: WorkflowRequest): {
    score: number,
    complexity: 'low' | 'medium' | 'high',
    size: 'small' | 'medium' | 'large'
  } {
    const params = request.parameters || {};
    const inputImages = params['input-images'] || [];
    const imageCount = Array.isArray(inputImages) ? inputImages.length : 1;
    
    // Determine size based on number of images
    let size: 'small' | 'medium' | 'large';
    if (imageCount <= 5) {
      size = 'small';
    } else if (imageCount <= 20) {
      size = 'medium';
    } else {
      size = 'large';
    }
    
    // Determine complexity
    // Default to medium complexity
    // Default to medium for complexity
    let complexity: 'low' | 'medium' | 'high' = 'medium';
    
    // Check for scene complexity parameter
    if (params['scene-complexity']) {
      complexity = params['scene-complexity'] as any;
    }
    
    // Calculate score based on size and complexity
    const sizeScore = size === 'small' ? 0.25 : (size === 'medium' ? 0.5 : 0.75);
    const complexityScore = complexity === 'low' ? 0.25 : (complexity === 'medium' ? 0.5 : 0.75);
    
    // Combined score
    const score = (sizeScore + complexityScore) / 2;
    
    return { score, complexity, size };
  }
  
  /**
   * Analyze material recognition inputs
   * @param request The workflow request
   * @returns Input analysis result
   */
  private analyzeMaterialRecognitionInputs(request: WorkflowRequest): {
    score: number,
    complexity: 'low' | 'medium' | 'high',
    size: 'small' | 'medium' | 'large'
  } {
    const params = request.parameters || {};
    
    // Default to medium for both
    // Begin with medium complexity
    let complexity: 'low' | 'medium' | 'high' = 'medium';
    let size: 'small' | 'medium' | 'large' = 'medium';
    
    // Check for property extraction flag
    // Property extraction requires higher quality
    if (params['extract-properties'] === 'true') {
      complexity = 'high';
    }
    
    // Check image resolution if available
    if (params['image-resolution']) {
      const resolution = params['image-resolution'];
      if (resolution === 'hd' || resolution === 'high') {
        size = 'large';
      } else if (resolution === 'low') {
        size = 'small';
      }
    }
    
    // Calculate score
    const sizeScore = size === 'small' ? 0.25 : (size === 'medium' ? 0.5 : 0.75);
    // Handle complexity scoring based on value
    let complexityScore: number;
    if ((complexity as 'low' | 'medium' | 'high') === 'low') {
      complexityScore = 0.25;
    } else if (complexity === 'medium') {
      complexityScore = 0.5;
    } else {
      complexityScore = 0.75; // 'high'
    }
    
    // Combined score
    const score = (sizeScore + complexityScore) / 2;
    
    return { score, complexity, size };
  }
  
  /**
   * Analyze scene graph inputs
   * @param request The workflow request
   * @returns Input analysis result
   */
  private analyzeSceneGraphInputs(request: WorkflowRequest): {
    score: number,
    complexity: 'low' | 'medium' | 'high',
    size: 'small' | 'medium' | 'large'
  } {
    const params = request.parameters || {};
    
    // Default to medium
    let complexity: 'low' | 'medium' | 'high' = 'medium';
    let size: 'small' | 'medium' | 'large' = 'medium';
    
    // Detailed relationships increases complexity
    if (params['relationship-detail'] === 'high') {
      complexity = 'high';
    }
    
    // Number of objects affects size
    if (params['max-objects']) {
      const maxObjects = parseInt(params['max-objects'] as string, 10);
      if (maxObjects <= 10) {
        size = 'small';
      } else if (maxObjects >= 50) {
        size = 'large';
      }
    }
    
    // Calculate score
    const sizeScore = size === 'small' ? 0.25 : (size === 'medium' ? 0.5 : 0.75);
    // Handle complexity scoring based on value
    let complexityScore: number;
    if ((complexity as 'low' | 'medium' | 'high') === 'low') {
      complexityScore = 0.25;
    } else if (complexity === 'medium') {
      complexityScore = 0.5;
    } else {
      complexityScore = 0.75; // 'high'
    }
    
    // Combined score
    const score = (sizeScore + complexityScore) / 2;
    
    return { score, complexity, size };
  }
  
  /**
   * Analyze room layout inputs
   * @param request The workflow request
   * @returns Input analysis result
   */
  private analyzeRoomLayoutInputs(request: WorkflowRequest): {
    score: number,
    complexity: 'low' | 'medium' | 'high',
    size: 'small' | 'medium' | 'large'
  } {
    const params = request.parameters || {};
    
    // Default to medium
    let complexity: 'low' | 'medium' | 'high' = 'medium';
    let size: 'small' | 'medium' | 'large' = 'medium';
    
    // Room type affects complexity
    if (params['room-type']) {
      const roomType = params['room-type'] as string;
      // Complex room types require higher quality
      if (['kitchen', 'bathroom', 'office'].includes(roomType)) {
        complexity = 'high';
      } else if (['bedroom', 'living-room'].includes(roomType)) {
        complexity = 'medium';
      } else {
        complexity = 'low';
      }
    }
    
    // Room size affects processing size
    if (params['room-size']) {
      const roomSize = params['room-size'] as string;
      if (roomSize === 'large') {
        size = 'large';
      } else if (roomSize === 'small') {
        size = 'small';
      }
    }
    
    // Calculate score
    const sizeScore = size === 'small' ? 0.25 : (size === 'medium' ? 0.5 : 0.75);
    const complexityScore = complexity === 'low' ? 0.25 : (complexity === 'medium' ? 0.5 : 0.75);
    
    // Combined score
    const score = (sizeScore + complexityScore) / 2;
    
    return { score, complexity, size };
  }
  
  /**
   * Check available resources in the cluster
   * @returns Resource availability factor with score (0-1)
   */
  private async checkResourceAvailability(): Promise<{
    score: number,
    cpuAvailability: number,
    memoryAvailability: number,
    gpuAvailability: number
  }> {
    try {
      // Check resource metrics from Redis (cached from monitoring)
      const [cpuStr, memStr, gpuStr] = await this.redis.mget(
        'resources:cpu:availability',
        'resources:memory:availability',
        'resources:gpu:availability'
      );
      
      // Parse values (0-1 representing available percentage)
      // Default to moderate availability if data is missing
      const cpuAvailability = cpuStr ? parseFloat(cpuStr) : 0.5;
      const memoryAvailability = memStr ? parseFloat(memStr) : 0.5;
      const gpuAvailability = gpuStr ? parseFloat(gpuStr) : 0.5;
      
      // Calculate overall resource score
      // GPU availability is weighted more heavily for ML tasks
      const score = (cpuAvailability * 0.3) + (memoryAvailability * 0.3) + (gpuAvailability * 0.4);
      
      return {
        score,
        cpuAvailability,
        memoryAvailability,
        gpuAvailability
      };
    } catch (error) {
      this.logger.warn('Error checking resource availability', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      // Default to moderate availability on error
      return {
        score: 0.5,
        cpuAvailability: 0.5,
        memoryAvailability: 0.5,
        gpuAvailability: 0.5
      };
    }
  }
  
  /**
   * Evaluate subscription tier impact on quality
   * @param subscriptionTier The user's subscription tier
   * @returns Subscription factor with score (0-1)
   */
  private evaluateSubscription(subscriptionTier: string = 'standard'): {
    score: number,
    maxQuality: QualityLevel
  } {
    let score: number;
    let maxQuality: QualityLevel;
    
    switch (subscriptionTier) {
      case 'premium':
        // Premium users get high quality by default
        score = 1.0;
        maxQuality = 'high';
        break;
      
      case 'standard':
        // Standard users get medium quality by default
        score = 0.5;
        maxQuality = 'medium';
        break;
      
      case 'free':
        // Free users get low quality by default
        score = 0.25;
        maxQuality = 'low';
        break;
      
      default:
        // Unknown tier, treat as standard
        score = 0.5;
        maxQuality = 'medium';
    }
    
    return { score, maxQuality };
  }
  
  /**
   * Check historical processing performance for similar requests
   * @param requestType The workflow request type
   * @returns History factor with score (0-1)
   */
  private async checkProcessingHistory(requestType: string): Promise<{
    score: number,
    averageQuality: QualityLevel
  }> {
    try {
      // Get historical quality metrics from Redis
      const historyKey = `history:${requestType}:quality`;
      const historyValue = await this.redis.get(historyKey);
      
      if (!historyValue) {
        // No history available, use default
        return {
          score: 0.5,
          averageQuality: 'medium'
        };
      }
      
      // Parse historical data
      const history = JSON.parse(historyValue);
      const { lowCount = 0, mediumCount = 0, highCount = 0, totalCount = 0 } = history;
      
      // Calculate quality distribution
      const lowPercentage = totalCount > 0 ? lowCount / totalCount : 0;
      const mediumPercentage = totalCount > 0 ? mediumCount / totalCount : 0;
      const highPercentage = totalCount > 0 ? highCount / totalCount : 0;
      
      // Calculate weighted score
      const score = (lowPercentage * 0.25) + (mediumPercentage * 0.5) + (highPercentage * 0.75);
      
      // Determine average quality level
      let averageQuality: QualityLevel;
      if (highPercentage > mediumPercentage && highPercentage > lowPercentage) {
        averageQuality = 'high';
      } else if (mediumPercentage > lowPercentage) {
        averageQuality = 'medium';
      } else {
        averageQuality = 'low';
      }
      
      return { score, averageQuality };
    } catch (error) {
      this.logger.warn('Error checking processing history', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      // Default on error
      return {
        score: 0.5,
        averageQuality: 'medium'
      };
    }
  }
  
  /**
   * Map quality preference to score
   * @param preference The quality preference
   * @returns Score value (0-1)
   */
  private mapPreferenceToScore(preference: string): number {
    switch (preference) {
      case 'quality':
        return 0.8; // Prefer high quality
      case 'speed':
        return 0.2; // Prefer speed (lower quality)
      case 'balanced':
        return 0.5; // Balanced
      default:
        return 0.5; // Default to balanced
    }
  }
  
  /**
   * Determine final quality level based on combined factors
   * @param factors The assessment factors
   * @returns The determined quality level
   */
  private determineQualityLevel(factors: Record<string, number>): QualityLevel {
    // Calculate weighted average score
    let totalWeight = 0;
    let weightedSum = 0;
    
    // Define weights for different factors
    const weights: Record<string, number> = {
      input: 0.25,
      resources: 0.3,
      subscription: 0.3,
      history: 0.1,
      preference: 0.05
    };
    
    // Calculate weighted sum
    for (const [factor, score] of Object.entries(factors)) {
      const weight = weights[factor] || 0.1; // Default weight for unknown factors
      weightedSum += score * weight;
      totalWeight += weight;
    }
    
    // Normalize score
    const finalScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
    
    // Map score to quality level
    if (finalScore >= 0.7) {
      return 'high';
    } else if (finalScore >= 0.4) {
      return 'medium';
    } else {
      return 'low';
    }
  }
  
  /**
   * Records the selected quality level for future reference
   * @param requestType The workflow request type
   * @param qualityLevel The selected quality level
   */
  public async recordQualitySelection(requestType: string, qualityLevel: QualityLevel): Promise<void> {
    try {
      const historyKey = `history:${requestType}:quality`;
      
      // Get existing history or create new
      const historyValue = await this.redis.get(historyKey);
      const history = historyValue ? JSON.parse(historyValue) : {
        lowCount: 0,
        mediumCount: 0,
        highCount: 0,
        totalCount: 0
      };
      
      // Update counts
      if (qualityLevel === 'low') {
        history.lowCount++;
      } else if (qualityLevel === 'medium') {
        history.mediumCount++;
      } else if (qualityLevel === 'high') {
        history.highCount++;
      }
      
      history.totalCount++;
      
      // Store updated history
      await this.redis.set(historyKey, JSON.stringify(history));
      await this.redis.expire(historyKey, 60 * 60 * 24 * 30); // 30 days TTL
      
      this.logger.debug('Quality selection recorded', {
        requestType,
        qualityLevel,
        history
      });
    } catch (error) {
      this.logger.warn('Error recording quality selection', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}