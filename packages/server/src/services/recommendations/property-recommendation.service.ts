/**
 * Property-Based Recommendation Service
 *
 * This service provides intelligent recommendations for materials based on
 * property requirements, user preferences, and project context.
 */

import { logger } from '../../utils/logger';
import { prisma } from '../prisma';
import { supabase } from '../supabase/supabaseClient';
import { handleSupabaseError } from '../../../../shared/src/utils/supabaseErrorHandler';
import { vectorSearch } from '../supabase/vector-search';
import { v4 as uuidv4 } from 'uuid';

/**
 * Property-based recommendation options
 */
export interface PropertyRecommendationOptions {
  userId?: string;
  count?: number;
  materialType?: string;
  propertyRequirements?: Record<string, any>;
  projectContext?: ProjectContext;
  excludeMaterialIds?: string[];
  includeExplanations?: boolean;
  minRelevance?: number;
}

/**
 * Project context for recommendations
 */
export interface ProjectContext {
  projectId?: string;
  projectType?: string;
  roomType?: string;
  existingMaterials?: string[];
  style?: string;
  budget?: 'low' | 'medium' | 'high';
  purpose?: string;
}

/**
 * Property-based recommendation result
 */
export interface PropertyRecommendationResult {
  materialId: string;
  materialName: string;
  materialType: string;
  relevanceScore: number;
  matchReason: string;
  propertyMatches?: {
    propertyName: string;
    requestedValue: any;
    actualValue: any;
    matchScore: number;
  }[];
  complementaryWith?: string[];
}

/**
 * Property weight configuration
 */
export interface PropertyWeightConfig {
  materialType: string;
  properties: Record<string, number>;
}

/**
 * Property compatibility rule
 */
export interface PropertyCompatibilityRule {
  id: string;
  materialType: string;
  propertyName: string;
  compatibleWith: {
    materialType: string;
    propertyName: string;
    compatibilityScore: number;
  }[];
}

/**
 * Property-Based Recommendation Service
 */
class PropertyRecommendationService {
  private static instance: PropertyRecommendationService;
  private initialized: boolean = false;

  // Table names
  private readonly propertyWeightTableName: string = 'property_weights';
  private readonly propertyCompatibilityTableName: string = 'property_compatibility_rules';
  private readonly userPropertyPreferenceTableName: string = 'user_property_preferences';
  private readonly projectContextTableName: string = 'project_contexts';

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): PropertyRecommendationService {
    if (!PropertyRecommendationService.instance) {
      PropertyRecommendationService.instance = new PropertyRecommendationService();
    }
    return PropertyRecommendationService.instance;
  }

  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Property-Based Recommendation Service');

      // Ensure necessary tables exist
      await this.ensureTables();

      // Initialize default property weights if none exist
      await this.initializeDefaultPropertyWeights();

      // Initialize default compatibility rules if none exist
      await this.initializeDefaultCompatibilityRules();

      this.initialized = true;
      logger.info('Property-Based Recommendation Service initialized');
    } catch (error) {
      logger.error(`Error initializing Property-Based Recommendation Service: ${error}`);
      throw error;
    }
  }

  /**
   * Ensure necessary tables exist
   */
  private async ensureTables(): Promise<void> {
    try {
      // Create property weights table if it doesn't exist
      await supabase.getClient().rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS ${this.propertyWeightTableName} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            material_type TEXT NOT NULL,
            properties JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_${this.propertyWeightTableName}_material_type
            ON ${this.propertyWeightTableName}(material_type);
        `
      });

      // Create property compatibility rules table if it doesn't exist
      await supabase.getClient().rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS ${this.propertyCompatibilityTableName} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            material_type TEXT NOT NULL,
            property_name TEXT NOT NULL,
            compatible_with JSONB NOT NULL DEFAULT '[]',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_${this.propertyCompatibilityTableName}_material_type
            ON ${this.propertyCompatibilityTableName}(material_type);

          CREATE INDEX IF NOT EXISTS idx_${this.propertyCompatibilityTableName}_property_name
            ON ${this.propertyCompatibilityTableName}(property_name);
        `
      });

      // Create user property preferences table if it doesn't exist
      await supabase.getClient().rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS ${this.userPropertyPreferenceTableName} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT NOT NULL,
            material_type TEXT NOT NULL,
            property_preferences JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(user_id, material_type)
          );

          CREATE INDEX IF NOT EXISTS idx_${this.userPropertyPreferenceTableName}_user_id
            ON ${this.userPropertyPreferenceTableName}(user_id);
        `
      });

      // Create project contexts table if it doesn't exist
      await supabase.getClient().rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS ${this.projectContextTableName} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id TEXT NOT NULL UNIQUE,
            project_type TEXT,
            room_type TEXT,
            existing_materials TEXT[],
            style TEXT,
            budget TEXT,
            purpose TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_${this.projectContextTableName}_project_id
            ON ${this.projectContextTableName}(project_id);
        `
      });

      logger.info('Property recommendation tables created or verified');
    } catch (error) {
      logger.error(`Error creating property recommendation tables: ${error}`);
      throw error;
    }
  }

  /**
   * Initialize default property weights
   */
  private async initializeDefaultPropertyWeights(): Promise<void> {
    try {
      // Check if any property weights exist
      const { data, error } = await supabase.getClient()
        .from(this.propertyWeightTableName)
        .select('id')
        .limit(1);

      if (error) {
        throw handleSupabaseError(error, 'checkPropertyWeights');
      }

      // If weights already exist, skip initialization
      if (data && data.length > 0) {
        return;
      }

      logger.info('Initializing default property weights');

      // Define default property weights for different material types
      const defaultWeights: PropertyWeightConfig[] = [
        {
          materialType: 'tile',
          properties: {
            'dimensions.width': 0.7,
            'dimensions.height': 0.7,
            'color.name': 0.8,
            'finish': 0.9,
            'pattern': 0.8,
            'texture': 0.8,
            'technicalSpecs.waterAbsorption': 0.9,
            'technicalSpecs.slipResistance': 0.9,
            'technicalSpecs.frostResistance': 0.8
          }
        },
        {
          materialType: 'wood',
          properties: {
            'dimensions.width': 0.7,
            'dimensions.height': 0.7,
            'color.name': 0.8,
            'finish': 0.9,
            'pattern': 0.7,
            'texture': 0.8,
            'technicalSpecs.hardness': 0.9,
            'technicalSpecs.stability': 0.8,
            'technicalSpecs.grainPattern': 0.7
          }
        },
        {
          materialType: 'stone',
          properties: {
            'dimensions.width': 0.6,
            'dimensions.height': 0.6,
            'color.name': 0.8,
            'finish': 0.9,
            'pattern': 0.8,
            'texture': 0.8,
            'technicalSpecs.density': 0.8,
            'technicalSpecs.porosity': 0.9,
            'technicalSpecs.acidResistance': 0.7
          }
        }
      ];

      // Insert default weights
      for (const config of defaultWeights) {
        const { error } = await supabase.getClient()
          .from(this.propertyWeightTableName)
          .insert({
            material_type: config.materialType,
            properties: config.properties
          });

        if (error) {
          throw handleSupabaseError(error, 'insertDefaultPropertyWeights', { materialType: config.materialType });
        }
      }

      logger.info('Default property weights initialized');
    } catch (error) {
      logger.error(`Error initializing default property weights: ${error}`);
      throw error;
    }
  }

  /**
   * Initialize default compatibility rules
   */
  private async initializeDefaultCompatibilityRules(): Promise<void> {
    try {
      // Check if any compatibility rules exist
      const { data, error } = await supabase.getClient()
        .from(this.propertyCompatibilityTableName)
        .select('id')
        .limit(1);

      if (error) {
        throw handleSupabaseError(error, 'checkCompatibilityRules');
      }

      // If rules already exist, skip initialization
      if (data && data.length > 0) {
        return;
      }

      logger.info('Initializing default compatibility rules');

      // Define default compatibility rules
      const defaultRules: PropertyCompatibilityRule[] = [
        {
          id: uuidv4(),
          materialType: 'tile',
          propertyName: 'color.name',
          compatibleWith: [
            {
              materialType: 'wood',
              propertyName: 'color.name',
              compatibilityScore: 0.8
            },
            {
              materialType: 'stone',
              propertyName: 'color.name',
              compatibilityScore: 0.9
            }
          ]
        },
        {
          id: uuidv4(),
          materialType: 'tile',
          propertyName: 'finish',
          compatibleWith: [
            {
              materialType: 'wood',
              propertyName: 'finish',
              compatibilityScore: 0.7
            }
          ]
        }
      ];

      // Insert default rules
      for (const rule of defaultRules) {
        const { error } = await supabase.getClient()
          .from(this.propertyCompatibilityTableName)
          .insert({
            id: rule.id,
            material_type: rule.materialType,
            property_name: rule.propertyName,
            compatible_with: rule.compatibleWith
          });

        if (error) {
          throw handleSupabaseError(error, 'insertDefaultCompatibilityRules', {
            materialType: rule.materialType,
            propertyName: rule.propertyName
          });
        }
      }

      logger.info('Default compatibility rules initialized');
    } catch (error) {
      logger.error(`Error initializing default compatibility rules: ${error}`);
      throw error;
    }
  }
}

  /**
   * Find materials by property requirements
   *
   * @param propertyRequirements Property requirements
   * @param materialType Optional material type filter
   * @param excludeMaterialIds Material IDs to exclude
   * @param limit Maximum number of materials to return
   * @returns Array of materials matching the requirements
   */
  private async findMaterialsByProperties(
    propertyRequirements: Record<string, any>,
    materialType?: string,
    excludeMaterialIds: string[] = [],
    limit: number = 20
  ): Promise<any[]> {
    try {
      // Build query
      let query = prisma.material.findMany({
        where: {
          ...(materialType ? { materialType } : {}),
          id: {
            notIn: excludeMaterialIds
          }
        },
        take: limit
      });

      // Execute query
      const materials = await query;

      // Filter materials by property requirements
      return materials.filter(material => {
        // Check each property requirement
        for (const [propertyPath, requiredValue] of Object.entries(propertyRequirements)) {
          const actualValue = this.getPropertyValue(material, propertyPath);

          // Skip if property doesn't exist
          if (actualValue === undefined) {
            continue;
          }

          // Check if property matches requirement
          const matches = this.propertyMatches(actualValue, requiredValue, propertyPath);
          if (!matches) {
            return false;
          }
        }

        return true;
      });
    } catch (error) {
      logger.error(`Error finding materials by properties: ${error}`);
      return [];
    }
  }

  /**
   * Calculate relevance scores for materials based on property matches
   *
   * @param materials Materials to score
   * @param propertyRequirements Property requirements
   * @param userId Optional user ID for personalization
   * @param materialType Optional material type
   * @returns Scored materials
   */
  private async calculateRelevanceScores(
    materials: any[],
    propertyRequirements: Record<string, any>,
    userId?: string,
    materialType?: string
  ): Promise<PropertyRecommendationResult[]> {
    try {
      // Get property weights
      const weights = await this.getPropertyWeights(materialType);

      // Get user preferences if available
      const userPreferences = userId ?
        await this.getUserPropertyPreferences(userId, materialType) :
        {};

      // Calculate scores for each material
      return materials.map(material => {
        // Initialize result
        const result: PropertyRecommendationResult = {
          materialId: material.id,
          materialName: material.name,
          materialType: material.materialType,
          relevanceScore: 0,
          matchReason: '',
          propertyMatches: []
        };

        // Calculate property match scores
        let totalScore = 0;
        let totalWeight = 0;

        for (const [propertyPath, requiredValue] of Object.entries(propertyRequirements)) {
          const actualValue = this.getPropertyValue(material, propertyPath);

          // Skip if property doesn't exist
          if (actualValue === undefined) {
            continue;
          }

          // Get property weight
          const weight = weights[propertyPath] || 0.5;

          // Calculate match score
          const matchScore = this.calculatePropertyMatchScore(
            actualValue,
            requiredValue,
            propertyPath
          );

          // Apply user preference boost if available
          const userPreference = userPreferences[propertyPath];
          const preferenceBoost = userPreference ? 0.2 : 0;

          // Add to total score
          totalScore += matchScore * weight * (1 + preferenceBoost);
          totalWeight += weight * (1 + preferenceBoost);

          // Add to property matches
          result.propertyMatches!.push({
            propertyName: propertyPath,
            requestedValue: requiredValue,
            actualValue,
            matchScore
          });
        }

        // Calculate overall relevance score
        result.relevanceScore = totalWeight > 0 ? totalScore / totalWeight : 0;

        return result;
      });
    } catch (error) {
      logger.error(`Error calculating relevance scores: ${error}`);
      return [];
    }
  }

  /**
   * Apply project context to recommendations
   *
   * @param materials Scored materials
   * @param projectContext Project context
   * @returns Contextualized materials
   */
  /**
   * Get property value from a material
   *
   * @param material Material object
   * @param propertyPath Property path (e.g., 'dimensions.width')
   * @returns Property value or undefined if not found
   */
  private getPropertyValue(material: any, propertyPath: string): any {
    try {
      const parts = propertyPath.split('.');
      let value = material;

      for (const part of parts) {
        if (value === null || value === undefined) {
          return undefined;
        }

        value = value[part];
      }

      return value;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Check if a property matches a required value
   *
   * @param actualValue Actual property value
   * @param requiredValue Required property value
   * @param propertyPath Property path
   * @returns True if property matches requirement
   */
  private propertyMatches(
    actualValue: any,
    requiredValue: any,
    propertyPath: string
  ): boolean {
    // Handle different types of values
    if (typeof actualValue === 'number' && typeof requiredValue === 'number') {
      // For numeric values, check if within range
      const tolerance = this.getNumericTolerance(propertyPath);
      return Math.abs(actualValue - requiredValue) <= tolerance;
    } else if (typeof actualValue === 'string' && typeof requiredValue === 'string') {
      // For string values, check if equal (case-insensitive)
      return actualValue.toLowerCase() === requiredValue.toLowerCase();
    } else if (Array.isArray(actualValue) && Array.isArray(requiredValue)) {
      // For arrays, check if any value matches
      return requiredValue.some(val => actualValue.includes(val));
    } else if (typeof actualValue === 'boolean' && typeof requiredValue === 'boolean') {
      // For boolean values, check if equal
      return actualValue === requiredValue;
    } else if (typeof requiredValue === 'object' && requiredValue !== null) {
      // For objects, check if it's a range specification
      if ('min' in requiredValue && 'max' in requiredValue) {
        return actualValue >= requiredValue.min && actualValue <= requiredValue.max;
      } else if ('includes' in requiredValue && Array.isArray(requiredValue.includes)) {
        return requiredValue.includes.includes(actualValue);
      } else if ('excludes' in requiredValue && Array.isArray(requiredValue.excludes)) {
        return !requiredValue.excludes.includes(actualValue);
      }
    }

    // Default comparison
    return actualValue === requiredValue;
  }

  /**
   * Calculate match score for a property
   *
   * @param actualValue Actual property value
   * @param requiredValue Required property value
   * @param propertyPath Property path
   * @returns Match score (0-1)
   */
  private calculatePropertyMatchScore(
    actualValue: any,
    requiredValue: any,
    propertyPath: string
  ): number {
    // Handle different types of values
    if (typeof actualValue === 'number' && typeof requiredValue === 'number') {
      // For numeric values, calculate normalized difference
      const range = this.getPropertyRange(propertyPath);
      const normalizedDiff = range ?
        Math.abs(actualValue - requiredValue) / (range.max - range.min) :
        Math.abs(actualValue - requiredValue) / Math.max(Math.abs(actualValue), Math.abs(requiredValue));

      return Math.max(0, 1 - normalizedDiff);
    } else if (typeof actualValue === 'string' && typeof requiredValue === 'string') {
      // For string values, exact match = 1, partial match based on similarity
      if (actualValue.toLowerCase() === requiredValue.toLowerCase()) {
        return 1;
      } else {
        // Calculate string similarity
        return this.calculateStringSimilarity(actualValue, requiredValue);
      }
    } else if (Array.isArray(actualValue) && Array.isArray(requiredValue)) {
      // For arrays, calculate Jaccard similarity
      const intersection = actualValue.filter(val => requiredValue.includes(val));
      const union = [...new Set([...actualValue, ...requiredValue])];

      return intersection.length / union.length;
    } else if (typeof actualValue === 'boolean' && typeof requiredValue === 'boolean') {
      // For boolean values, exact match = 1, otherwise 0
      return actualValue === requiredValue ? 1 : 0;
    } else if (typeof requiredValue === 'object' && requiredValue !== null) {
      // For objects, check if it's a range specification
      if ('min' in requiredValue && 'max' in requiredValue) {
        if (actualValue < requiredValue.min) {
          return Math.max(0, 1 - (requiredValue.min - actualValue) / requiredValue.min);
        } else if (actualValue > requiredValue.max) {
          return Math.max(0, 1 - (actualValue - requiredValue.max) / requiredValue.max);
        } else {
          return 1; // Within range
        }
      }
    }

    // Default comparison
    return actualValue === requiredValue ? 1 : 0;
  }

  /**
   * Calculate string similarity
   *
   * @param str1 First string
   * @param str2 Second string
   * @returns Similarity score (0-1)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    // Check for exact match
    if (s1 === s2) {
      return 1;
    }

    // Check if one is a substring of the other
    if (s1.includes(s2) || s2.includes(s1)) {
      return 0.8;
    }

    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);

    return Math.max(0, 1 - distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   *
   * @param s1 First string
   * @param s2 Second string
   * @returns Levenshtein distance
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;

    // Create distance matrix
    const d: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= m; i++) {
      d[i][0] = i;
    }

    for (let j = 0; j <= n; j++) {
      d[0][j] = j;
    }

    // Fill the matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1, // deletion
          d[i][j - 1] + 1, // insertion
          d[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return d[m][n];
  }

  /**
   * Get property weights for a material type
   *
   * @param materialType Material type
   * @returns Property weights
   */
  private async getPropertyWeights(materialType?: string): Promise<Record<string, number>> {
    try {
      if (!materialType) {
        return {};
      }

      // Get weights from database
      const { data, error } = await supabase.getClient()
        .from(this.propertyWeightTableName)
        .select('properties')
        .eq('material_type', materialType)
        .maybeSingle();

      if (error) {
        throw handleSupabaseError(error, 'getPropertyWeights', { materialType });
      }

      return data?.properties || {};
    } catch (error) {
      logger.error(`Error getting property weights: ${error}`);
      return {};
    }
  }

  /**
   * Get user property preferences
   *
   * @param userId User ID
   * @param materialType Material type
   * @returns User property preferences
   */
  private async getUserPropertyPreferences(
    userId: string,
    materialType?: string
  ): Promise<Record<string, any>> {
    try {
      if (!materialType) {
        return {};
      }

      // Get preferences from database
      const { data, error } = await supabase.getClient()
        .from(this.userPropertyPreferenceTableName)
        .select('property_preferences')
        .eq('user_id', userId)
        .eq('material_type', materialType)
        .maybeSingle();

      if (error) {
        throw handleSupabaseError(error, 'getUserPropertyPreferences', { userId, materialType });
      }

      return data?.property_preferences || {};
    } catch (error) {
      logger.error(`Error getting user property preferences: ${error}`);
      return {};
    }
  }

  /**
   * Get numeric tolerance for a property
   *
   * @param propertyPath Property path
   * @returns Numeric tolerance
   */
  private getNumericTolerance(propertyPath: string): number {
    // Define tolerances for different properties
    const tolerances: Record<string, number> = {
      'dimensions.width': 5, // 5mm tolerance
      'dimensions.height': 5, // 5mm tolerance
      'dimensions.depth': 2, // 2mm tolerance
      'technicalSpecs.waterAbsorption': 0.5, // 0.5% tolerance
      'technicalSpecs.density': 0.1, // 0.1 g/cm³ tolerance
      'technicalSpecs.hardness': 0.5 // 0.5 Mohs tolerance
    };

    return tolerances[propertyPath] || 0.1; // Default tolerance
  }

  /**
   * Get property range for normalization
   *
   * @param propertyPath Property path
   * @returns Property range or null if not defined
   */
  private getPropertyRange(propertyPath: string): { min: number; max: number } | null {
    // Define ranges for different properties
    const ranges: Record<string, { min: number; max: number }> = {
      'dimensions.width': { min: 0, max: 3000 }, // mm
      'dimensions.height': { min: 0, max: 3000 }, // mm
      'dimensions.depth': { min: 0, max: 100 }, // mm
      'technicalSpecs.waterAbsorption': { min: 0, max: 20 }, // %
      'technicalSpecs.hardness': { min: 0, max: 10 }, // Mohs scale
      'technicalSpecs.density': { min: 0, max: 5 }, // g/cm³
      'technicalSpecs.porosity': { min: 0, max: 100 }, // %
      'technicalSpecs.slipResistance': { min: 0, max: 100 }, // R-value
      'technicalSpecs.thermalConductivity': { min: 0, max: 5 } // W/(m·K)
    };

    return ranges[propertyPath] || null;
  }

  /**
   * Calculate compatibility score between materials
   *
   * @param materialId Material ID
   * @param materialType Material type
   * @param existingMaterialIds Existing material IDs
   * @returns Compatibility score (0-1)
   */
  private calculateCompatibilityScore(
    materialId: string,
    materialType: string,
    existingMaterialIds: string[]
  ): number {
    try {
      // In a real implementation, this would use the compatibility rules
      // For this example, we'll use a simple heuristic
      return 0.7; // Default compatibility score
    } catch (error) {
      logger.error(`Error calculating compatibility score: ${error}`);
      return 0.5; // Default score
    }
  }

  /**
   * Get room type boost factor
   *
   * @param materialType Material type
   * @param roomType Room type
   * @returns Boost factor (0-2)
   */
  private getRoomTypeBoost(materialType: string, roomType: string): number {
    // Define room type boosts for different material types
    const boosts: Record<string, Record<string, number>> = {
      'tile': {
        'bathroom': 1.5,
        'kitchen': 1.3,
        'entryway': 1.2,
        'living_room': 1.0,
        'bedroom': 0.8
      },
      'wood': {
        'living_room': 1.5,
        'bedroom': 1.3,
        'dining_room': 1.2,
        'kitchen': 0.9,
        'bathroom': 0.7
      },
      'stone': {
        'kitchen': 1.4,
        'bathroom': 1.3,
        'entryway': 1.2,
        'living_room': 1.1,
        'bedroom': 0.8
      }
    };

    return boosts[materialType]?.[roomType] || 1.0; // Default boost
  }

  /**
   * Get budget factor
   *
   * @param material Material
   * @param budget Budget level
   * @returns Budget factor (0-1)
   */
  private getBudgetFactor(material: any, budget: 'low' | 'medium' | 'high'): number {
    // In a real implementation, this would use the material price
    // For this example, we'll use a simple heuristic
    switch (budget) {
      case 'low':
        return material.price?.value > 50 ? 0.7 : 1.2;
      case 'medium':
        return material.price?.value > 100 ? 0.8 : 1.1;
      case 'high':
        return material.price?.value > 200 ? 1.2 : 0.9;
      default:
        return 1.0;
    }
  }

  /**
   * Generate explanation for a recommendation
   *
   * @param material Recommended material
   * @param propertyRequirements Property requirements
   * @param projectContext Project context
   * @returns Explanation string
   */
  private generateExplanation(
    material: PropertyRecommendationResult,
    propertyRequirements: Record<string, any>,
    projectContext?: ProjectContext
  ): string {
    try {
      // Find the best matching properties
      const bestMatches = material.propertyMatches
        ?.filter(match => match.matchScore > 0.8)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 2);

      // Find properties with high importance
      const highImportanceMatches = material.propertyMatches
        ?.filter(match => {
          const propertyPath = match.propertyName;
          const weight = this.getPropertyWeights(material.materialType)[propertyPath] || 0.5;
          return weight >= 0.8;
        })
        .slice(0, 2);

      // Build explanation
      let explanation = '';

      // Add overall match quality
      if (material.relevanceScore >= 0.9) {
        explanation += 'Excellent match for your requirements. ';
      } else if (material.relevanceScore >= 0.7) {
        explanation += 'Good match for your requirements. ';
      } else {
        explanation += 'Partial match for your requirements. ';
      }

      // Add best matching properties
      if (bestMatches && bestMatches.length > 0) {
        explanation += 'Matches your requirements for ';
        explanation += bestMatches.map(match => {
          const propertyName = match.propertyName.split('.').pop() || match.propertyName;
          return propertyName;
        }).join(' and ');
        explanation += '. ';
      }

      // Add project context if available
      if (projectContext) {
        if (projectContext.roomType) {
          explanation += `Well-suited for ${projectContext.roomType.replace('_', ' ')}. `;
        }

        if (projectContext.existingMaterials && projectContext.existingMaterials.length > 0) {
          explanation += 'Compatible with your existing materials. ';
        }

        if (projectContext.style) {
          explanation += `Aligns with ${projectContext.style} style. `;
        }
      }

      return explanation.trim();
    } catch (error) {
      logger.error(`Error generating explanation: ${error}`);
      return 'Recommended based on your requirements.';
    }
  }

  /**
   * Apply project context to recommendations
   *
   * @param materials Scored materials
   * @param projectContext Project context
   * @returns Contextualized materials
   */
  private async applyProjectContext(
    materials: PropertyRecommendationResult[],
    projectContext: ProjectContext
  ): Promise<PropertyRecommendationResult[]> {
    try {
      // Apply context-based adjustments
      return materials.map(material => {
        let contextScore = material.relevanceScore;

        // Adjust score based on existing materials
        if (projectContext.existingMaterials && projectContext.existingMaterials.length > 0) {
          const compatibilityScore = this.calculateCompatibilityScore(
            material.materialId,
            material.materialType,
            projectContext.existingMaterials
          );

          // Blend original score with compatibility score
          contextScore = contextScore * 0.7 + compatibilityScore * 0.3;

          // Add complementary materials
          material.complementaryWith = projectContext.existingMaterials;
        }

        // Adjust score based on room type
        if (projectContext.roomType) {
          const roomTypeBoost = this.getRoomTypeBoost(
            material.materialType,
            projectContext.roomType
          );

          contextScore *= roomTypeBoost;
        }

        // Adjust score based on budget
        if (projectContext.budget) {
          const budgetFactor = this.getBudgetFactor(
            material,
            projectContext.budget
          );

          contextScore *= budgetFactor;
        }

        return {
          ...material,
          relevanceScore: contextScore
        };
      });
    } catch (error) {
      logger.error(`Error applying project context: ${error}`);
      return materials;
    }
  }

  /**
   * Get recommendations based on property requirements
   *
   * @param options Recommendation options
   * @returns Array of recommended materials
   */
  public async getRecommendations(
    options: PropertyRecommendationOptions
  ): Promise<PropertyRecommendationResult[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const {
        userId,
        count = 10,
        materialType,
        propertyRequirements = {},
        projectContext,
        excludeMaterialIds = [],
        includeExplanations = true,
        minRelevance = 0.6
      } = options;

      logger.info(`Getting property-based recommendations for ${userId ? `user ${userId}` : 'anonymous user'}`);

      // Get materials matching the property requirements
      const materials = await this.findMaterialsByProperties(
        propertyRequirements,
        materialType,
        excludeMaterialIds,
        count * 2 // Get more than needed for filtering
      );

      if (!materials || materials.length === 0) {
        logger.info('No materials found matching property requirements');
        return [];
      }

      // Calculate relevance scores based on property matches
      const scoredMaterials = await this.calculateRelevanceScores(
        materials,
        propertyRequirements,
        userId,
        materialType
      );

      // Apply project context if available
      let contextualizedMaterials = scoredMaterials;
      if (projectContext) {
        contextualizedMaterials = await this.applyProjectContext(
          scoredMaterials,
          projectContext
        );
      }

      // Sort by relevance score and limit to requested count
      const recommendations = contextualizedMaterials
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .filter(material => material.relevanceScore >= minRelevance)
        .slice(0, count);

      // Generate explanations if requested
      if (includeExplanations) {
        return recommendations.map(material => ({
          ...material,
          matchReason: this.generateExplanation(material, propertyRequirements, projectContext)
        }));
      } else {
        return recommendations.map(material => ({
          ...material,
          matchReason: ''
        }));
      }
    } catch (error) {
      logger.error(`Error getting property-based recommendations: ${error}`);
      throw error;
    }
  }

  /**
   * Save user property preferences
   *
   * @param userId User ID
   * @param materialType Material type
   * @param propertyPreferences Property preferences
   */
  public async saveUserPropertyPreferences(
    userId: string,
    materialType: string,
    propertyPreferences: Record<string, any>
  ): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      logger.info(`Saving property preferences for user ${userId}`);

      // Check if preferences already exist
      const { data, error } = await supabase.getClient()
        .from(this.userPropertyPreferenceTableName)
        .select('id')
        .eq('user_id', userId)
        .eq('material_type', materialType)
        .maybeSingle();

      if (error) {
        throw handleSupabaseError(error, 'checkUserPropertyPreferences', { userId, materialType });
      }

      if (data) {
        // Update existing preferences
        const { error } = await supabase.getClient()
          .from(this.userPropertyPreferenceTableName)
          .update({
            property_preferences: propertyPreferences,
            updated_at: new Date()
          })
          .eq('id', data.id);

        if (error) {
          throw handleSupabaseError(error, 'updateUserPropertyPreferences', { userId, materialType });
        }
      } else {
        // Insert new preferences
        const { error } = await supabase.getClient()
          .from(this.userPropertyPreferenceTableName)
          .insert({
            user_id: userId,
            material_type: materialType,
            property_preferences: propertyPreferences
          });

        if (error) {
          throw handleSupabaseError(error, 'insertUserPropertyPreferences', { userId, materialType });
        }
      }

      logger.info(`Property preferences saved for user ${userId}`);
    } catch (error) {
      logger.error(`Error saving user property preferences: ${error}`);
      throw error;
    }
  }

  /**
   * Save project context
   *
   * @param context Project context
   */
  public async saveProjectContext(context: ProjectContext): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!context.projectId) {
        throw new Error('Project ID is required');
      }

      logger.info(`Saving project context for project ${context.projectId}`);

      // Check if context already exists
      const { data, error } = await supabase.getClient()
        .from(this.projectContextTableName)
        .select('id')
        .eq('project_id', context.projectId)
        .maybeSingle();

      if (error) {
        throw handleSupabaseError(error, 'checkProjectContext', { projectId: context.projectId });
      }

      if (data) {
        // Update existing context
        const { error } = await supabase.getClient()
          .from(this.projectContextTableName)
          .update({
            project_type: context.projectType,
            room_type: context.roomType,
            existing_materials: context.existingMaterials,
            style: context.style,
            budget: context.budget,
            purpose: context.purpose,
            updated_at: new Date()
          })
          .eq('id', data.id);

        if (error) {
          throw handleSupabaseError(error, 'updateProjectContext', { projectId: context.projectId });
        }
      } else {
        // Insert new context
        const { error } = await supabase.getClient()
          .from(this.projectContextTableName)
          .insert({
            project_id: context.projectId,
            project_type: context.projectType,
            room_type: context.roomType,
            existing_materials: context.existingMaterials,
            style: context.style,
            budget: context.budget,
            purpose: context.purpose
          });

        if (error) {
          throw handleSupabaseError(error, 'insertProjectContext', { projectId: context.projectId });
        }
      }

      logger.info(`Project context saved for project ${context.projectId}`);
    } catch (error) {
      logger.error(`Error saving project context: ${error}`);
      throw error;
    }
  }

  /**
   * Get project context
   *
   * @param projectId Project ID
   * @returns Project context
   */
  public async getProjectContext(projectId: string): Promise<ProjectContext | null> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      logger.info(`Getting project context for project ${projectId}`);

      // Get context from database
      const { data, error } = await supabase.getClient()
        .from(this.projectContextTableName)
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (error) {
        throw handleSupabaseError(error, 'getProjectContext', { projectId });
      }

      if (!data) {
        return null;
      }

      // Convert to ProjectContext
      return {
        projectId: data.project_id,
        projectType: data.project_type,
        roomType: data.room_type,
        existingMaterials: data.existing_materials,
        style: data.style,
        budget: data.budget,
        purpose: data.purpose
      };
    } catch (error) {
      logger.error(`Error getting project context: ${error}`);
      return null;
    }
  }

// Export singleton instance
export const propertyRecommendationService = PropertyRecommendationService.getInstance();
export default propertyRecommendationService;
