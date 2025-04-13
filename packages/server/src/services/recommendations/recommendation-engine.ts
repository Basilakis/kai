/**
 * Recommendation Engine
 *
 * Uses vector embeddings to match users with materials based on preference similarity.
 * Leverages Supabase Vector for storing and querying user preference vectors and
 * material feature vectors, enabling personalized recommendations and "more like this"
 * functionality throughout the application.
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { supabase } from '../supabase/supabaseClient';
import { handleSupabaseError } from '../../../../shared/src/utils/supabaseErrorHandler';
import { vectorSearch } from '../supabase/vector-search';

/**
 * User preference data
 */
export interface UserPreference {
  userId: string;
  preferenceVector: number[];
  categoryWeights?: Record<string, number>;
  explicitPreferences?: string[];
  lastUpdated: Date;
}

/**
 * Recommendation result
 */
export interface RecommendationResult {
  materialId: string;
  materialName: string;
  materialType: string;
  relevanceScore: number;
  matchReason: string;
  categoryMatch?: string;
  attributes?: Record<string, any>;
}

/**
 * Recommendation request options
 */
export interface RecommendationOptions {
  userId: string;
  count?: number;
  materialTypes?: string[];
  excludeMaterialIds?: string[];
  diversityFactor?: number;  // 0-1 scale (0: similar, 1: diverse)
  includeExplanations?: boolean;
  categoryFilter?: string;
  minRelevance?: number;
}

/**
 * Material interaction event type for feedback
 */
export enum InteractionType {
  VIEW = 'view',
  LIKE = 'like',
  SAVE = 'save',
  DOWNLOAD = 'download',
  SHARE = 'share',
  DISLIKE = 'dislike',
  IGNORE = 'ignore'
}

/**
 * Material interaction event
 */
export interface MaterialInteraction {
  userId: string;
  materialId: string;
  interactionType: InteractionType;
  timestamp: Date;
  durationSeconds?: number;
  context?: string;
  metadata?: Record<string, any>;
}

/**
 * Recommendation Engine
 *
 * Provides personalized material recommendations based on user preferences
 * and material feature vectors using Supabase Vector similarity search
 */
export class RecommendationEngine {
  private static instance: RecommendationEngine;
  private userPreferenceTableName = 'user_preference_vectors';
  private materialFeatureTableName = 'material_feature_vectors';
  private interactionHistoryTableName = 'user_material_interactions';
  private vectorColumnName = 'embedding';
  private initialized = false;

  private constructor() {
    logger.info('Recommendation Engine initialized');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RecommendationEngine {
    if (!RecommendationEngine.instance) {
      RecommendationEngine.instance = new RecommendationEngine();
    }
    return RecommendationEngine.instance;
  }

  /**
   * Initialize the recommendation engine
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.ensureTables();
      this.initialized = true;
      logger.info('Recommendation engine initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize recommendation engine: ${error}`);
      throw new Error(`Failed to initialize recommendation engine: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Ensure necessary tables and indices exist
   */
  private async ensureTables(): Promise<void> {
    try {
      // Create user preference vectors table if it doesn't exist
      try {
        await supabase.getClient().rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS ${this.userPreferenceTableName} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT NOT NULL UNIQUE,
            ${this.vectorColumnName} vector(384),
            category_weights JSONB DEFAULT '{}',
            explicit_preferences TEXT[] DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_${this.userPreferenceTableName}_user_id
            ON ${this.userPreferenceTableName}(user_id);
        `
      });

      // Create interaction history table if it doesn't exist
      try {
        await supabase.getClient().rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS ${this.interactionHistoryTableName} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT NOT NULL,
            material_id TEXT NOT NULL,
            interaction_type TEXT NOT NULL,
            duration_seconds INTEGER,
            context TEXT,
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_${this.interactionHistoryTableName}_user_id
            ON ${this.interactionHistoryTableName}(user_id);

          CREATE INDEX IF NOT EXISTS idx_${this.interactionHistoryTableName}_material_id
            ON ${this.interactionHistoryTableName}(material_id);

          CREATE INDEX IF NOT EXISTS idx_${this.interactionHistoryTableName}_interaction
            ON ${this.interactionHistoryTableName}(interaction_type);
        `
      }, { count: 1 });
      } catch (err) {
        throw handleSupabaseError(err, 'ensureRecommendationHistoryTable');
      }

      // Create vector index if it doesn't exist
      await vectorSearch.createIndex(
        this.userPreferenceTableName,
        this.vectorColumnName,
        'hnsw',
        384
      );

      logger.info('Recommendation engine tables and indices are ready');
    } catch (error) {
      logger.error(`Failed to create tables: ${error}`);
      throw error;
    }
  }

  /**
   * Get personalized recommendations for a user
   *
   * @param options Recommendation options
   * @returns Array of recommended materials with relevance scores
   */
  public async getRecommendations(
    options: RecommendationOptions
  ): Promise<RecommendationResult[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const {
        userId,
        count = 10,
        materialTypes = [],
        excludeMaterialIds = [],
        diversityFactor = 0.3,
        includeExplanations = true,
        categoryFilter,
        minRelevance = 0.6
      } = options;

      logger.info(`Getting recommendations for user ${userId}`);

      // Get user preference vector
      const userPreference = await this.getUserPreference(userId);

      if (!userPreference) {
        // Fall back to general popularity-based recommendations for new users
        return this.getPopularRecommendations(
          count,
          materialTypes,
          excludeMaterialIds,
          categoryFilter
        );
      }

      // Prepare filters for material search
      const filters: Record<string, any> = {};

      if (materialTypes.length > 0) {
        filters.material_type = { $in: materialTypes };
      }

      if (categoryFilter) {
        filters.category = categoryFilter;
      }

      if (excludeMaterialIds.length > 0) {
        filters.material_id = { $nin: excludeMaterialIds };
      }

      // Find similar materials based on user preference vector
      const similarMaterials = await vectorSearch.findSimilar(
        userPreference.preferenceVector,
        this.materialFeatureTableName,
        this.vectorColumnName,
        {
          threshold: minRelevance,
          limit: count * 2, // Get more than needed for diversity filtering
          filters
        }
      );

      if (!similarMaterials || similarMaterials.length === 0) {
        return this.getPopularRecommendations(
          count,
          materialTypes,
          excludeMaterialIds,
          categoryFilter
        );
      }

      // Apply diversity factor if needed
      let recommendations = similarMaterials;
      if (diversityFactor > 0 && similarMaterials.length > count) {
        recommendations = this.applyDiversityFilter(
          similarMaterials,
          diversityFactor,
          count
        );
      }

      // Limit to requested count
      recommendations = recommendations.slice(0, count);

      // Generate explanations if requested
      if (includeExplanations) {
        return recommendations.map((material: any) => ({
          materialId: material.material_id,
          materialName: material.material_name,
          materialType: material.material_type,
          relevanceScore: material.similarity,
          matchReason: this.generateExplanation(material, userPreference),
          categoryMatch: this.findMatchingCategory(material, userPreference),
          attributes: material.attributes
        }));
      } else {
        return recommendations.map((material: any) => ({
          materialId: material.material_id,
          materialName: material.material_name,
          materialType: material.material_type,
          relevanceScore: material.similarity,
          matchReason: ''
        }));
      }

    } catch (error) {
      logger.error(`Error getting recommendations: ${error}`);
      throw new Error(`Error getting recommendations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get similar materials to a specified material
   *
   * @param materialId Material ID to find similar materials for
   * @param options Options for similar material search
   * @returns Array of similar materials
   */
  public async getSimilarMaterials(
    materialId: string,
    options: {
      count?: number;
      sameMaterialType?: boolean;
      excludeMaterialIds?: string[];
      minRelevance?: number;
    } = {}
  ): Promise<RecommendationResult[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const {
        count = 10,
        sameMaterialType = false,
        excludeMaterialIds = [],
        minRelevance = 0.7
      } = options;

      logger.info(`Finding materials similar to ${materialId}`);

      // First, get the feature vector for the material
      let materialFeature;
      try {
        const { data, error } = await supabase.getClient()
          .from(this.materialFeatureTableName)
          .select('material_id, material_type, material_name, embedding, attributes')
          .eq('material_id', materialId)
          .maybeSingle();

        if (error) {
          throw handleSupabaseError(error, 'getSimilarMaterials', { materialId });
        }

        materialFeature = data;
      } catch (err) {
        throw handleSupabaseError(err, 'getSimilarMaterials', { materialId });
      }

      if (!materialFeature) {
        throw new Error(`Material ${materialId} not found or has no feature vectors`);
      }

      // Prepare filters
      const filters: Record<string, any> = {
        material_id: { $ne: materialId } // Exclude the same material
      };

      // Add excluded material IDs
      if (excludeMaterialIds.length > 0) {
        // Merge with existing exclusions
        filters.material_id = {
          $nin: [materialId, ...excludeMaterialIds]
        };
      }

      // Filter by same material type if requested
      if (sameMaterialType) {
        filters.material_type = materialFeature.material_type;
      }

      // Find similar materials
      const similarMaterials = await vectorSearch.findSimilar(
        materialFeature.embedding,
        this.materialFeatureTableName,
        this.vectorColumnName,
        {
          threshold: minRelevance,
          limit: count,
          filters
        }
      );

      // Convert to recommendation results
      return similarMaterials.map((material: any) => ({
        materialId: material.material_id,
        materialName: material.material_name,
        materialType: material.material_type,
        relevanceScore: material.similarity,
        matchReason: `Similar to ${materialFeature.material_name}`,
        attributes: material.attributes
      }));

    } catch (error) {
      logger.error(`Error finding similar materials: ${error}`);
      throw new Error(`Error finding similar materials: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Record a user's interaction with a material
   *
   * @param interaction User interaction data
   * @returns Success indicator
   */
  public async recordInteraction(
    interaction: MaterialInteraction
  ): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Prepare data
      const data = {
        id: uuidv4(),
        user_id: interaction.userId,
        material_id: interaction.materialId,
        interaction_type: interaction.interactionType,
        duration_seconds: interaction.durationSeconds,
        context: interaction.context,
        metadata: interaction.metadata,
        created_at: interaction.timestamp.toISOString()
      };

      // Insert into interaction history
      try {
        const { error } = await supabase.getClient()
          .from(this.interactionHistoryTableName)
          .insert(data);

        if (error) {
          throw handleSupabaseError(error, 'recordInteraction', {
            userId: interaction.userId,
            materialId: interaction.materialId
          });
        }
      } catch (err) {
        throw handleSupabaseError(err, 'recordInteraction', {
          userId: interaction.userId,
          materialId: interaction.materialId
        });
      }

      // Update user preference based on interaction
      await this.updateUserPreferenceFromInteraction(interaction);

      return true;
    } catch (error) {
      logger.error(`Error recording interaction: ${error}`);
      return false;
    }
  }

  /**
   * Get user preference vector
   *
   * @param userId User ID
   * @returns User preference data or null if not found
   */
  private async getUserPreference(
    userId: string
  ): Promise<UserPreference | null> {
    try {
      const { data, error } = await supabase.getClient()
        .from(this.userPreferenceTableName)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw handleSupabaseError(error, 'getUserPreference', { userId });
      }

      if (!data) {
        return null;
      }

      return {
        userId: data.user_id,
        preferenceVector: data.embedding,
        categoryWeights: data.category_weights,
        explicitPreferences: data.explicit_preferences,
        lastUpdated: new Date(data.updated_at)
      };
    } catch (error) {
      logger.error(`Error getting user preference: ${error}`);
      return null;
    }
  }

  /**
   * Update or create user preference vector
   *
   * @param preference User preference data
   * @returns Success indicator
   */
  public async updateUserPreference(
    preference: UserPreference
  ): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Check if user preference exists
      let existingPreference;
      try {
        const { data, error } = await supabase.getClient()
          .from(this.userPreferenceTableName)
          .select('id')
          .eq('user_id', preference.userId)
          .maybeSingle();

        if (error) {
          throw handleSupabaseError(error, 'checkUserPreference', { userId: preference.userId });
        }

        existingPreference = data;
      } catch (err) {
        throw handleSupabaseError(err, 'checkUserPreference', { userId: preference.userId });
      }

      const now = new Date().toISOString();

      if (existingPreference) {
        // Update existing preference
        try {
          const { error } = await supabase.getClient()
            .from(this.userPreferenceTableName)
            .update({
              embedding: preference.preferenceVector,
              category_weights: preference.categoryWeights || {},
              explicit_preferences: preference.explicitPreferences || [],
              updated_at: now
            })
            .eq('id', existingPreference.id);

          if (error) {
            throw handleSupabaseError(error, 'updateUserPreference', { userId: preference.userId });
          }
        } catch (err) {
          throw handleSupabaseError(err, 'updateUserPreference', { userId: preference.userId });
        }
      } else {
        // Create new preference
        try {
          const { error } = await supabase.getClient()
            .from(this.userPreferenceTableName)
            .insert({
              user_id: preference.userId,
              embedding: preference.preferenceVector,
              category_weights: preference.categoryWeights || {},
              explicit_preferences: preference.explicitPreferences || [],
              created_at: now,
              updated_at: now
            });

          if (error) {
            throw handleSupabaseError(error, 'createUserPreference', { userId: preference.userId });
          }
        } catch (err) {
          throw handleSupabaseError(err, 'createUserPreference', { userId: preference.userId });
        }
      }

      return true;
    } catch (error) {
      logger.error(`Error updating user preference: ${error}`);
      return false;
    }
  }

  /**
   * Update user preference based on material interaction
   *
   * @param interaction User material interaction
   */
  private async updateUserPreferenceFromInteraction(
    interaction: MaterialInteraction
  ): Promise<void> {
    try {
      // Get material feature vector
      const client = supabaseClient.getClient();

      const { data: material, error } = await (client as any)
        .from(this.materialFeatureTableName)
        .select('embedding, material_type, category')
        .eq('material_id', interaction.materialId)
        .maybeSingle();

      if (error || !material) {
        logger.error(`Cannot find material for preference update: ${interaction.materialId}`);
        return;
      }

      // Get current user preference
      const preference = await this.getUserPreference(interaction.userId);

      // Default weight for how much to adjust the preference vector
      let adjustmentWeight = 0.1;

      // Adjust weight based on interaction type
      switch (interaction.interactionType) {
        case InteractionType.LIKE:
          adjustmentWeight = 0.2;
          break;
        case InteractionType.SAVE:
          adjustmentWeight = 0.3;
          break;
        case InteractionType.DOWNLOAD:
          adjustmentWeight = 0.4;
          break;
        case InteractionType.SHARE:
          adjustmentWeight = 0.5;
          break;
        case InteractionType.DISLIKE:
          adjustmentWeight = -0.2;
          break;
        case InteractionType.IGNORE:
          adjustmentWeight = -0.1;
          break;
        case InteractionType.VIEW:
        default:
          // For views, adjust weight based on duration if available
          if (interaction.durationSeconds) {
            // Longer views have more influence
            const normalizedDuration = Math.min(interaction.durationSeconds / 60, 1);
            adjustmentWeight = 0.05 + (normalizedDuration * 0.15);
          }
          break;
      }

      // If no existing preference, initialize with the material vector
      if (!preference) {
        await this.updateUserPreference({
          userId: interaction.userId,
          preferenceVector: material.embedding,
          categoryWeights: { [material.category || material.material_type]: 1 },
          lastUpdated: new Date()
        });
        return;
      }

      // Update category weights
      const categoryKey = material.category || material.material_type;
      const categoryWeights = preference.categoryWeights ? { ...preference.categoryWeights } : {};

      if (adjustmentWeight > 0) {
        // Increase weight for positive interactions
        categoryWeights[categoryKey] = (categoryWeights[categoryKey] || 0) + adjustmentWeight;
      } else if (adjustmentWeight < 0 && categoryWeights[categoryKey]) {
        // Decrease weight for negative interactions, but don't go below 0
        categoryWeights[categoryKey] = Math.max(0, (categoryWeights[categoryKey] || 0) + adjustmentWeight);
      }

      // Update preference vector by combining with material vector
      const updatedVector = this.combineVectors(
        preference.preferenceVector,
        material.embedding,
        adjustmentWeight
      );

      // Update preference in database
      await this.updateUserPreference({
        userId: interaction.userId,
        preferenceVector: updatedVector,
        categoryWeights,
        explicitPreferences: preference.explicitPreferences,
        lastUpdated: new Date()
      });

    } catch (error) {
      logger.error(`Error updating preference from interaction: ${error}`);
    }
  }

  /**
   * Combine two vectors with a weighted average
   *
   * @param baseVector Base vector (user preference)
   * @param newVector New vector to combine (material feature)
   * @param weight Weight of the new vector (0-1 or negative for "moving away")
   * @returns Combined vector
   */
  private combineVectors(
    baseVector: number[],
    newVector: number[],
    weight: number
  ): number[] {
    if (!baseVector || !newVector || !Array.isArray(baseVector) || !Array.isArray(newVector)) {
      // Return original if invalid inputs
      return baseVector || [];
    }

    const length = Math.min(baseVector.length, newVector.length);
    const result = new Array(length);

    // Calculate effective weights
    const baseWeight = 1 - Math.abs(weight);
    const effectiveWeight = weight;

    // Combine vectors
    for (let i = 0; i < length; i++) {
      // Add null checks for vector elements
      const baseVal = baseVector[i] || 0;
      const newVal = newVector[i] || 0;
      result[i] = (baseVal * baseWeight) + (newVal * effectiveWeight);
    }

    // Normalize to unit length
    const magnitude = Math.sqrt(
      result.reduce((sum, val) => sum + val * val, 0)
    );

    if (magnitude === 0) {
      return baseVector;
    }

    for (let i = 0; i < length; i++) {
      result[i] = result[i] / magnitude;
    }

    return result;
  }

  /**
   * Generate an explanation for why a material was recommended
   *
   * @param material Material data
   * @param userPreference User preference data
   * @returns Explanation string
   */
  private generateExplanation(
    material: any,
    userPreference: UserPreference
  ): string {
    // In a real implementation, this would be more sophisticated
    // For this example, we'll use a simple template-based approach

    const categoryKey = material.category || material.material_type;
    const hasHighCategoryMatch = userPreference.categoryWeights ?
      (userPreference.categoryWeights[categoryKey] || 0) > 0.5 : false;

    if (hasHighCategoryMatch) {
      return `Based on your interest in ${categoryKey}`;
    }

    // Check if material matches explicit preferences
    if (userPreference.explicitPreferences && userPreference.explicitPreferences.length > 0) {
      for (const pref of userPreference.explicitPreferences) {
        if (material.attributes &&
            JSON.stringify(material.attributes).toLowerCase().includes(pref.toLowerCase())) {
          return `Matches your preference for ${pref}`;
        }
      }
    }

    // General explanation based on similarity score
    const similarityScore = material.similarity;
    if (similarityScore > 0.9) {
      return 'Highly aligned with your preferences';
    } else if (similarityScore > 0.8) {
      return 'Strongly matches your interests';
    } else if (similarityScore > 0.7) {
      return 'Matches your interests';
    } else {
      return 'You might be interested in this';
    }
  }

  /**
   * Find matching category between material and user preferences
   *
   * @param material Material data
   * @param userPreference User preference data
   * @returns Matching category or null
   */
  private findMatchingCategory(
    material: any,
    userPreference: UserPreference
  ): string | undefined {
    if (!userPreference.categoryWeights || !material) {
      return undefined;
    }

    // Check direct category match
    const categoryKey = material.category || material.material_type;
    if (userPreference.categoryWeights[categoryKey]) {
      return categoryKey;
    }

    // Check for related categories in attributes
    if (material.attributes && typeof material.attributes === 'object') {
      for (const key in userPreference.categoryWeights) {
        if (JSON.stringify(material.attributes).includes(key)) {
          return key;
        }
      }
    }

    return undefined;
  }

  /**
   * Apply diversity filtering to recommendations
   *
   * @param materials Materials to filter
   * @param diversityFactor Diversity factor (0-1)
   * @param count Number of materials to return
   * @returns Diverse subset of materials
   */
  private applyDiversityFilter(
    materials: any[],
    diversityFactor: number,
    count: number
  ): any[] {
    if (diversityFactor === 0 || materials.length <= count) {
      return materials.slice(0, count);
    }

    // Calculate how many top items to include regardless of diversity
    const topCount = Math.max(1, Math.floor(count * (1 - diversityFactor)));
    const result = materials.slice(0, topCount);

    // Number of slots for diverse items
    const remainingSlots = count - topCount;

    if (remainingSlots === 0) {
      return result;
    }

    // For diverse items, take evenly spaced items from the rest of the list
    const remainingItems = materials.slice(topCount);
    const step = Math.max(1, Math.floor(remainingItems.length / remainingSlots));

    for (let i = 0; i < remainingItems.length && result.length < count; i += step) {
      result.push(remainingItems[i]);
    }

    // If we still have open slots, fill with highest ranked remaining items
    if (result.length < count) {
      const missing = count - result.length;
      // Find items not already in result
      const additionalItems = remainingItems
        .filter(item => !result.some(r => r.material_id === item.material_id))
        .slice(0, missing);

      result.push(...additionalItems);
    }

    return result;
  }

  /**
   * Get popular material recommendations as fallback
   *
   * @param count Number of recommendations to return
   * @param materialTypes Optional material type filter
   * @param excludeMaterialIds Material IDs to exclude
   * @param categoryFilter Optional category filter
   * @returns Array of popular materials
   */
  private async getPopularRecommendations(
    count: number,
    materialTypes: string[] = [],
    excludeMaterialIds: string[] = [],
    categoryFilter?: string
  ): Promise<RecommendationResult[]> {
    try {
      const client = supabaseClient.getClient();

      // Build query
      let query = (client as any)
        .from(this.interactionHistoryTableName)
        .select(`
          material_id,
          count(*) as interaction_count
        `)
        .in('interaction_type', [
          InteractionType.LIKE,
          InteractionType.SAVE,
          InteractionType.DOWNLOAD,
          InteractionType.SHARE
        ])
        .not('material_id', 'in', `(${excludeMaterialIds.join(',')})`)
        .group('material_id')
        .order('interaction_count', { ascending: false })
        .limit(count);

      const { data: popularMaterialIds, error } = await query;

      if (error) {
        throw error;
      }

      if (!popularMaterialIds || popularMaterialIds.length === 0) {
        return [];
      }

      // Get material details
      const materialIds = popularMaterialIds.map((item: any) => item.material_id);

      let materialsQuery = (client as any)
        .from(this.materialFeatureTableName)
        .select('material_id, material_name, material_type, attributes')
        .in('material_id', materialIds);

      if (materialTypes.length > 0) {
        materialsQuery = materialsQuery.in('material_type', materialTypes);
      }

      if (categoryFilter) {
        materialsQuery = materialsQuery.eq('category', categoryFilter);
      }

      const { data: materials } = await materialsQuery;

      if (!materials || materials.length === 0) {
        return [];
      }

      // Build recommendations
      return materials.map((material: any) => ({
        materialId: material.material_id,
        materialName: material.material_name,
        materialType: material.material_type,
        relevanceScore: 0.5, // Default score for popular items
        matchReason: 'Popular with other users',
        attributes: material.attributes
      })).slice(0, count);

    } catch (error) {
      logger.error(`Error getting popular recommendations: ${error}`);
      return [];
    }
  }
}

// Export singleton instance
export const recommendationEngine = RecommendationEngine.getInstance();
export default recommendationEngine;