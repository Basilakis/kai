/**
 * Material Comparison Service
 * 
 * This service provides functionality for comparing materials based on their properties.
 */

import { logger } from '../../utils/logger';
import { prisma } from '../prisma';
import { v4 as uuidv4 } from 'uuid';

/**
 * Comparison Result interface
 */
export interface ComparisonResult {
  id: string;
  materials: string[];
  overallSimilarity: number;
  propertyComparisons: PropertyComparison[];
  createdAt: Date;
}

/**
 * Property Comparison interface
 */
export interface PropertyComparison {
  propertyName: string;
  propertyDisplayName: string;
  values: Record<string, any>;
  similarity: number;
  weight: number;
  importance: 'high' | 'medium' | 'low';
  unit?: string;
  notes?: string;
}

/**
 * Comparison Options interface
 */
export interface ComparisonOptions {
  propertyWeights?: Record<string, number>;
  includeProperties?: string[];
  excludeProperties?: string[];
  normalizeValues?: boolean;
  similarityThreshold?: number;
}

/**
 * Material Comparison Service
 */
export class MaterialComparisonService {
  /**
   * Compare two materials
   * 
   * @param materialId1 First material ID
   * @param materialId2 Second material ID
   * @param options Comparison options
   * @returns Comparison result
   */
  public async compareMaterials(
    materialId1: string,
    materialId2: string,
    options: ComparisonOptions = {}
  ): Promise<ComparisonResult> {
    try {
      logger.info(`Comparing materials: ${materialId1} and ${materialId2}`);
      
      // Get materials
      const material1 = await prisma.material.findUnique({
        where: { id: materialId1 }
      });
      
      const material2 = await prisma.material.findUnique({
        where: { id: materialId2 }
      });
      
      if (!material1) {
        throw new Error(`Material not found: ${materialId1}`);
      }
      
      if (!material2) {
        throw new Error(`Material not found: ${materialId2}`);
      }
      
      // Get property comparisons
      const propertyComparisons = await this.compareProperties(material1, material2, options);
      
      // Calculate overall similarity
      const overallSimilarity = this.calculateOverallSimilarity(propertyComparisons);
      
      // Create comparison result
      const result: ComparisonResult = {
        id: uuidv4(),
        materials: [materialId1, materialId2],
        overallSimilarity,
        propertyComparisons,
        createdAt: new Date()
      };
      
      // Save comparison result
      await this.saveComparisonResult(result);
      
      return result;
    } catch (error) {
      logger.error(`Error comparing materials: ${error}`);
      throw error;
    }
  }
  
  /**
   * Compare multiple materials
   * 
   * @param materialIds Material IDs
   * @param options Comparison options
   * @returns Array of comparison results
   */
  public async compareMultipleMaterials(
    materialIds: string[],
    options: ComparisonOptions = {}
  ): Promise<ComparisonResult[]> {
    try {
      logger.info(`Comparing multiple materials: ${materialIds.join(', ')}`);
      
      if (materialIds.length < 2) {
        throw new Error('At least two materials are required for comparison');
      }
      
      const results: ComparisonResult[] = [];
      
      // Compare each pair of materials
      for (let i = 0; i < materialIds.length; i++) {
        for (let j = i + 1; j < materialIds.length; j++) {
          const result = await this.compareMaterials(materialIds[i], materialIds[j], options);
          results.push(result);
        }
      }
      
      return results;
    } catch (error) {
      logger.error(`Error comparing multiple materials: ${error}`);
      throw error;
    }
  }
  
  /**
   * Find similar materials
   * 
   * @param materialId Material ID
   * @param options Comparison options
   * @returns Array of similar materials with similarity scores
   */
  public async findSimilarMaterials(
    materialId: string,
    options: ComparisonOptions & {
      limit?: number;
      materialType?: string;
    } = {}
  ): Promise<Array<{
    materialId: string;
    similarity: number;
    propertyComparisons: PropertyComparison[];
  }>> {
    try {
      logger.info(`Finding similar materials to: ${materialId}`);
      
      const { limit = 10, materialType } = options;
      
      // Get source material
      const sourceMaterial = await prisma.material.findUnique({
        where: { id: materialId }
      });
      
      if (!sourceMaterial) {
        throw new Error(`Material not found: ${materialId}`);
      }
      
      // Build filter for potential matches
      const filter: any = {};
      
      if (materialType) {
        filter.materialType = materialType;
      } else if (sourceMaterial.materialType) {
        filter.materialType = sourceMaterial.materialType;
      }
      
      // Exclude source material
      filter.id = { not: materialId };
      
      // Get potential matches
      const potentialMatches = await prisma.material.findMany({
        where: filter,
        take: limit * 3 // Get more than needed to filter by similarity
      });
      
      // Compare source material with each potential match
      const comparisons = await Promise.all(
        potentialMatches.map(async (material) => {
          const result = await this.compareMaterials(materialId, material.id, options);
          
          return {
            materialId: material.id,
            similarity: result.overallSimilarity,
            propertyComparisons: result.propertyComparisons
          };
        })
      );
      
      // Sort by similarity (descending) and limit results
      return comparisons
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      logger.error(`Error finding similar materials: ${error}`);
      throw error;
    }
  }
  
  /**
   * Compare properties between two materials
   * 
   * @param material1 First material
   * @param material2 Second material
   * @param options Comparison options
   * @returns Array of property comparisons
   */
  private async compareProperties(
    material1: any,
    material2: any,
    options: ComparisonOptions
  ): Promise<PropertyComparison[]> {
    const {
      propertyWeights = {},
      includeProperties = [],
      excludeProperties = [],
      normalizeValues = true
    } = options;
    
    // Get default property weights
    const defaultWeights = await this.getDefaultPropertyWeights(material1.materialType);
    
    // Combine with custom weights
    const weights = { ...defaultWeights, ...propertyWeights };
    
    // Get all properties to compare
    const properties = this.getPropertiesToCompare(material1, material2, includeProperties, excludeProperties);
    
    // Compare each property
    const comparisons: PropertyComparison[] = [];
    
    for (const property of properties) {
      const value1 = this.getPropertyValue(material1, property);
      const value2 = this.getPropertyValue(material2, property);
      
      // Skip if both values are undefined
      if (value1 === undefined && value2 === undefined) {
        continue;
      }
      
      // Calculate similarity
      const similarity = this.calculatePropertySimilarity(property, value1, value2, normalizeValues);
      
      // Get property weight
      const weight = weights[property] || 1;
      
      // Determine importance
      const importance = this.determinePropertyImportance(property, weight);
      
      // Get property display name and unit
      const { displayName, unit } = this.getPropertyMetadata(property, material1.materialType);
      
      // Add to comparisons
      comparisons.push({
        propertyName: property,
        propertyDisplayName: displayName,
        values: {
          [material1.id]: value1,
          [material2.id]: value2
        },
        similarity,
        weight,
        importance,
        unit
      });
    }
    
    return comparisons;
  }
  
  /**
   * Calculate overall similarity from property comparisons
   * 
   * @param propertyComparisons Property comparisons
   * @returns Overall similarity score
   */
  private calculateOverallSimilarity(propertyComparisons: PropertyComparison[]): number {
    if (propertyComparisons.length === 0) {
      return 0;
    }
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (const comparison of propertyComparisons) {
      weightedSum += comparison.similarity * comparison.weight;
      totalWeight += comparison.weight;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  
  /**
   * Get default property weights for a material type
   * 
   * @param materialType Material type
   * @returns Default property weights
   */
  private async getDefaultPropertyWeights(materialType: string): Promise<Record<string, number>> {
    // Default weights for common properties
    const commonWeights: Record<string, number> = {
      'dimensions.width': 0.7,
      'dimensions.height': 0.7,
      'dimensions.depth': 0.7,
      'color.name': 0.8,
      'color.hex': 0.6,
      'finish': 0.9,
      'pattern': 0.8,
      'texture': 0.8
    };
    
    // Material-specific weights
    const specificWeights: Record<string, Record<string, number>> = {
      'tile': {
        'technicalSpecs.waterAbsorption': 0.9,
        'technicalSpecs.slipResistance': 0.9,
        'technicalSpecs.frostResistance': 0.8
      },
      'wood': {
        'technicalSpecs.hardness': 0.9,
        'technicalSpecs.stability': 0.8,
        'technicalSpecs.grainPattern': 0.7
      },
      'stone': {
        'technicalSpecs.density': 0.8,
        'technicalSpecs.porosity': 0.9,
        'technicalSpecs.acidResistance': 0.7
      }
    };
    
    // Combine common weights with material-specific weights
    return {
      ...commonWeights,
      ...(specificWeights[materialType] || {})
    };
  }
  
  /**
   * Get properties to compare between two materials
   * 
   * @param material1 First material
   * @param material2 Second material
   * @param includeProperties Properties to include
   * @param excludeProperties Properties to exclude
   * @returns Array of property names
   */
  private getPropertiesToCompare(
    material1: any,
    material2: any,
    includeProperties: string[],
    excludeProperties: string[]
  ): string[] {
    // Get all properties from both materials
    const properties = new Set<string>();
    
    // Add properties from material1
    this.addPropertiesFromObject(properties, material1, '');
    
    // Add properties from material2
    this.addPropertiesFromObject(properties, material2, '');
    
    // Filter properties
    let result = Array.from(properties);
    
    // Include specific properties if provided
    if (includeProperties.length > 0) {
      result = result.filter(prop => includeProperties.some(include => prop.startsWith(include)));
    }
    
    // Exclude specific properties
    if (excludeProperties.length > 0) {
      result = result.filter(prop => !excludeProperties.some(exclude => prop.startsWith(exclude)));
    }
    
    return result;
  }
  
  /**
   * Add properties from an object to a set
   * 
   * @param properties Set of properties
   * @param obj Object to extract properties from
   * @param prefix Property prefix
   */
  private addPropertiesFromObject(properties: Set<string>, obj: any, prefix: string): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }
    
    for (const key in obj) {
      const value = obj[key];
      const propName = prefix ? `${prefix}.${key}` : key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively add properties from nested objects
        this.addPropertiesFromObject(properties, value, propName);
      } else {
        // Add leaf property
        properties.add(propName);
      }
    }
  }
  
  /**
   * Get property value from a material
   * 
   * @param material Material object
   * @param property Property name
   * @returns Property value
   */
  private getPropertyValue(material: any, property: string): any {
    const parts = property.split('.');
    let value = material;
    
    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      
      value = value[part];
    }
    
    return value;
  }
  
  /**
   * Calculate similarity between two property values
   * 
   * @param property Property name
   * @param value1 First value
   * @param value2 Second value
   * @param normalize Whether to normalize values
   * @returns Similarity score
   */
  private calculatePropertySimilarity(
    property: string,
    value1: any,
    value2: any,
    normalize: boolean
  ): number {
    // Handle undefined values
    if (value1 === undefined || value2 === undefined) {
      return 0;
    }
    
    // Handle identical values
    if (value1 === value2) {
      return 1;
    }
    
    // Handle different types of values
    if (typeof value1 === 'number' && typeof value2 === 'number') {
      return this.calculateNumericSimilarity(value1, value2, property, normalize);
    } else if (typeof value1 === 'string' && typeof value2 === 'string') {
      return this.calculateStringSimilarity(value1, value2);
    } else if (Array.isArray(value1) && Array.isArray(value2)) {
      return this.calculateArraySimilarity(value1, value2);
    } else if (typeof value1 === 'boolean' && typeof value2 === 'boolean') {
      return value1 === value2 ? 1 : 0;
    } else {
      // Different types or unsupported types
      return 0;
    }
  }
  
  /**
   * Calculate similarity between two numeric values
   * 
   * @param value1 First value
   * @param value2 Second value
   * @param property Property name
   * @param normalize Whether to normalize values
   * @returns Similarity score
   */
  private calculateNumericSimilarity(
    value1: number,
    value2: number,
    property: string,
    normalize: boolean
  ): number {
    // Get property range for normalization
    const range = normalize ? this.getPropertyRange(property) : null;
    
    if (range) {
      // Normalize values to [0, 1] range
      const normalizedValue1 = (value1 - range.min) / (range.max - range.min);
      const normalizedValue2 = (value2 - range.min) / (range.max - range.min);
      
      // Calculate similarity as 1 - normalized difference
      return 1 - Math.abs(normalizedValue1 - normalizedValue2);
    } else {
      // Calculate similarity based on relative difference
      const maxValue = Math.max(Math.abs(value1), Math.abs(value2));
      
      if (maxValue === 0) {
        return 1; // Both values are 0
      }
      
      const relativeDifference = Math.abs(value1 - value2) / maxValue;
      return Math.max(0, 1 - relativeDifference);
    }
  }
  
  /**
   * Calculate similarity between two string values
   * 
   * @param value1 First value
   * @param value2 Second value
   * @returns Similarity score
   */
  private calculateStringSimilarity(value1: string, value2: string): number {
    // Normalize strings
    const normalized1 = value1.toLowerCase().trim();
    const normalized2 = value2.toLowerCase().trim();
    
    // Check for exact match
    if (normalized1 === normalized2) {
      return 1;
    }
    
    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    
    // Convert distance to similarity
    return maxLength > 0 ? 1 - distance / maxLength : 1;
  }
  
  /**
   * Calculate similarity between two arrays
   * 
   * @param array1 First array
   * @param array2 Second array
   * @returns Similarity score
   */
  private calculateArraySimilarity(array1: any[], array2: any[]): number {
    if (array1.length === 0 && array2.length === 0) {
      return 1; // Both arrays are empty
    }
    
    if (array1.length === 0 || array2.length === 0) {
      return 0; // One array is empty
    }
    
    // Calculate Jaccard similarity
    const set1 = new Set(array1);
    const set2 = new Set(array2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
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
   * Get property range for normalization
   * 
   * @param property Property name
   * @returns Property range
   */
  private getPropertyRange(property: string): { min: number; max: number } | null {
    // Define ranges for common numeric properties
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
    
    return ranges[property] || null;
  }
  
  /**
   * Determine property importance based on weight
   * 
   * @param property Property name
   * @param weight Property weight
   * @returns Property importance
   */
  private determinePropertyImportance(property: string, weight: number): 'high' | 'medium' | 'low' {
    if (weight >= 0.8) {
      return 'high';
    } else if (weight >= 0.5) {
      return 'medium';
    } else {
      return 'low';
    }
  }
  
  /**
   * Get property metadata
   * 
   * @param property Property name
   * @param materialType Material type
   * @returns Property metadata
   */
  private getPropertyMetadata(property: string, materialType: string): { displayName: string; unit?: string } {
    // Define display names and units for common properties
    const metadata: Record<string, { displayName: string; unit?: string }> = {
      'dimensions.width': { displayName: 'Width', unit: 'mm' },
      'dimensions.height': { displayName: 'Height', unit: 'mm' },
      'dimensions.depth': { displayName: 'Depth', unit: 'mm' },
      'color.name': { displayName: 'Color' },
      'color.hex': { displayName: 'Color (Hex)' },
      'finish': { displayName: 'Finish' },
      'pattern': { displayName: 'Pattern' },
      'texture': { displayName: 'Texture' },
      'technicalSpecs.waterAbsorption': { displayName: 'Water Absorption', unit: '%' },
      'technicalSpecs.hardness': { displayName: 'Hardness', unit: 'Mohs' },
      'technicalSpecs.density': { displayName: 'Density', unit: 'g/cm³' },
      'technicalSpecs.porosity': { displayName: 'Porosity', unit: '%' },
      'technicalSpecs.slipResistance': { displayName: 'Slip Resistance', unit: 'R-value' },
      'technicalSpecs.thermalConductivity': { displayName: 'Thermal Conductivity', unit: 'W/(m·K)' }
    };
    
    // Get metadata for the property
    const propertyMetadata = metadata[property];
    
    if (propertyMetadata) {
      return propertyMetadata;
    }
    
    // Generate display name from property name
    const parts = property.split('.');
    const lastPart = parts[parts.length - 1];
    const displayName = lastPart
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/^./, str => str.toUpperCase()); // Capitalize first letter
    
    return { displayName };
  }
  
  /**
   * Save comparison result
   * 
   * @param result Comparison result
   */
  private async saveComparisonResult(result: ComparisonResult): Promise<void> {
    try {
      await prisma.materialComparison.create({
        data: {
          id: result.id,
          materialIds: result.materials,
          overallSimilarity: result.overallSimilarity,
          propertyComparisons: result.propertyComparisons,
          createdAt: result.createdAt
        }
      });
    } catch (error) {
      logger.error(`Error saving comparison result: ${error}`);
      // Don't throw error, just log it
    }
  }
}

// Create a singleton instance
export const materialComparisonService = new MaterialComparisonService();
