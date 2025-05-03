/**
 * Relationship Enhanced Search
 * 
 * This service enhances search functionality using the Property Relationship Graph
 * to improve relevance ranking and query expansion.
 */

import { propertyRelationshipService } from '@kai/shared/src/services/property-relationships/propertyRelationshipService';
import { RelationshipType } from '@kai/shared/src/types/property-relationships';
import { logger } from '../../utils/logger';

/**
 * Relationship Enhanced Search Service
 */
export class RelationshipEnhancedSearch {
  /**
   * Expand a search query using relationship data
   * 
   * @param materialType The type of material
   * @param query The original search query (property filters)
   * @returns Expanded query with related properties
   */
  public async expandQuery(
    materialType: string,
    query: Record<string, string>
  ): Promise<Record<string, string | string[]>> {
    try {
      const expandedQuery: Record<string, string | string[]> = { ...query };
      
      // Get all relationships for this material type
      const relationships = await propertyRelationshipService.getRelationshipsByMaterialType(materialType);
      
      // Process each property in the query
      for (const [property, value] of Object.entries(query)) {
        // Find relationships where this property is the source
        const relevantRelationships = relationships.filter(
          rel => rel.sourceProperty === property && 
                (rel.relationshipType === RelationshipType.CORRELATION || 
                 rel.relationshipType === RelationshipType.COMPATIBILITY)
        );
        
        // Process each relationship
        for (const relationship of relevantRelationships) {
          const { targetProperty, id } = relationship;
          
          // Skip if target property is already in the query
          if (query[targetProperty]) {
            continue;
          }
          
          // Get related values based on relationship type
          if (relationship.relationshipType === RelationshipType.CORRELATION) {
            const correlations = await propertyRelationshipService.getValueCorrelationsBySourceValue(
              id,
              value
            );
            
            // Add strongly correlated values to the expanded query
            const strongCorrelations = correlations.filter(
              corr => corr.correlationStrength > 0.7
            );
            
            if (strongCorrelations.length > 0) {
              expandedQuery[targetProperty] = strongCorrelations.map(corr => corr.targetValue);
            }
          } else if (relationship.relationshipType === RelationshipType.COMPATIBILITY) {
            const rules = await propertyRelationshipService.getCompatibilityRulesBySourceValue(
              id,
              value
            );
            
            // Add recommended values to the expanded query
            const recommendedRules = rules.filter(
              rule => rule.compatibilityType === 'recommended'
            );
            
            if (recommendedRules.length > 0) {
              expandedQuery[targetProperty] = recommendedRules.map(rule => rule.targetValue);
            }
          }
        }
      }
      
      return expandedQuery;
    } catch (error) {
      logger.error('Failed to expand query', { error });
      return query;
    }
  }
  
  /**
   * Calculate a relationship-based relevance score for search results
   * 
   * @param materialType The type of material
   * @param query The search query (property filters)
   * @param result The search result (material properties)
   * @returns Relevance score between 0 and 1
   */
  public async calculateRelevanceScore(
    materialType: string,
    query: Record<string, string>,
    result: Record<string, string>
  ): Promise<number> {
    try {
      let totalScore = 0;
      let totalWeight = 0;
      
      // Get all relationships for this material type
      const relationships = await propertyRelationshipService.getRelationshipsByMaterialType(materialType);
      
      // Process each property in the query
      for (const [queryProperty, queryValue] of Object.entries(query)) {
        // Direct match score
        if (result[queryProperty] === queryValue) {
          totalScore += 1;
          totalWeight += 1;
        }
        
        // Find relationships where this property is the source
        const relevantRelationships = relationships.filter(
          rel => rel.sourceProperty === queryProperty
        );
        
        // Process each relationship
        for (const relationship of relevantRelationships) {
          const { targetProperty, relationshipType, strength, id } = relationship;
          
          // Skip if target property is not in the result
          if (!result[targetProperty]) {
            continue;
          }
          
          const resultValue = result[targetProperty];
          
          // Calculate score based on relationship type
          if (relationshipType === RelationshipType.CORRELATION) {
            const correlations = await propertyRelationshipService.getValueCorrelationsBySourceValue(
              id,
              queryValue
            );
            
            // Find correlation for the result value
            const correlation = correlations.find(corr => corr.targetValue === resultValue);
            
            if (correlation) {
              // Add correlation score
              const correlationScore = (correlation.correlationStrength + 1) / 2; // Convert from [-1,1] to [0,1]
              totalScore += correlationScore * strength;
              totalWeight += strength;
            }
          } else if (relationshipType === RelationshipType.COMPATIBILITY) {
            const rules = await propertyRelationshipService.getCompatibilityRulesBySourceValue(
              id,
              queryValue
            );
            
            // Find rule for the result value
            const rule = rules.find(r => r.targetValue === resultValue);
            
            if (rule) {
              // Calculate score based on compatibility type
              let compatibilityScore = 0;
              switch (rule.compatibilityType) {
                case 'recommended':
                  compatibilityScore = 1.0;
                  break;
                case 'compatible':
                  compatibilityScore = 0.7;
                  break;
                case 'not_recommended':
                  compatibilityScore = 0.3;
                  break;
                case 'incompatible':
                  compatibilityScore = 0;
                  break;
              }
              
              totalScore += compatibilityScore * strength;
              totalWeight += strength;
            }
          }
        }
      }
      
      // Calculate final score
      return totalWeight > 0 ? totalScore / totalWeight : 0;
    } catch (error) {
      logger.error('Failed to calculate relevance score', { error });
      return 0;
    }
  }
  
  /**
   * Rerank search results based on relationship relevance
   * 
   * @param materialType The type of material
   * @param query The search query (property filters)
   * @param results The search results
   * @returns Reranked results with relevance scores
   */
  public async rerankResults(
    materialType: string,
    query: Record<string, string>,
    results: Array<{
      id: string;
      properties: Record<string, string>;
      score?: number;
    }>
  ): Promise<Array<{
    id: string;
    properties: Record<string, string>;
    score: number;
    relationshipScore: number;
    finalScore: number;
  }>> {
    try {
      // Calculate relationship scores for each result
      const scoredResults = await Promise.all(
        results.map(async result => {
          const relationshipScore = await this.calculateRelevanceScore(
            materialType,
            query,
            result.properties
          );
          
          // Combine original score and relationship score
          // If original score is not provided, use 1.0 as default
          const originalScore = result.score !== undefined ? result.score : 1.0;
          
          // Calculate final score (70% original, 30% relationship)
          const finalScore = (originalScore * 0.7) + (relationshipScore * 0.3);
          
          return {
            ...result,
            score: originalScore,
            relationshipScore,
            finalScore
          };
        })
      );
      
      // Sort by final score (highest first)
      scoredResults.sort((a, b) => b.finalScore - a.finalScore);
      
      return scoredResults;
    } catch (error) {
      logger.error('Failed to rerank results', { error });
      
      // Return original results with default scores
      return results.map(result => ({
        ...result,
        score: result.score !== undefined ? result.score : 1.0,
        relationshipScore: 0,
        finalScore: result.score !== undefined ? result.score : 1.0
      }));
    }
  }
  
  /**
   * Generate related search suggestions based on the current query
   * 
   * @param materialType The type of material
   * @param query The current search query (property filters)
   * @returns Related search suggestions
   */
  public async generateRelatedSearches(
    materialType: string,
    query: Record<string, string>
  ): Promise<Array<{
    property: string;
    value: string;
    confidence: number;
  }>> {
    try {
      const suggestions: Array<{
        property: string;
        value: string;
        confidence: number;
      }> = [];
      
      // Get all relationships for this material type
      const relationships = await propertyRelationshipService.getRelationshipsByMaterialType(materialType);
      
      // Process each property in the query
      for (const [property, value] of Object.entries(query)) {
        // Find relationships where this property is the source
        const relevantRelationships = relationships.filter(
          rel => rel.sourceProperty === property
        );
        
        // Process each relationship
        for (const relationship of relevantRelationships) {
          const { targetProperty, id } = relationship;
          
          // Skip if target property is already in the query
          if (query[targetProperty]) {
            continue;
          }
          
          // Get recommendations based on relationship type
          if (relationship.relationshipType === RelationshipType.CORRELATION) {
            const correlations = await propertyRelationshipService.getValueCorrelationsBySourceValue(
              id,
              value
            );
            
            // Add top correlations as suggestions
            for (const correlation of correlations) {
              if (correlation.correlationStrength > 0.5) {
                suggestions.push({
                  property: targetProperty,
                  value: correlation.targetValue,
                  confidence: correlation.correlationStrength
                });
              }
            }
          } else if (relationship.relationshipType === RelationshipType.COMPATIBILITY) {
            const rules = await propertyRelationshipService.getCompatibilityRulesBySourceValue(
              id,
              value
            );
            
            // Add recommended values as suggestions
            for (const rule of rules) {
              if (rule.compatibilityType === 'recommended') {
                suggestions.push({
                  property: targetProperty,
                  value: rule.targetValue,
                  confidence: 0.9
                });
              } else if (rule.compatibilityType === 'compatible') {
                suggestions.push({
                  property: targetProperty,
                  value: rule.targetValue,
                  confidence: 0.7
                });
              }
            }
          }
        }
      }
      
      // Sort by confidence (highest first)
      suggestions.sort((a, b) => b.confidence - a.confidence);
      
      // Remove duplicates
      const uniqueSuggestions: Array<{
        property: string;
        value: string;
        confidence: number;
      }> = [];
      
      const seen = new Set<string>();
      
      for (const suggestion of suggestions) {
        const key = `${suggestion.property}:${suggestion.value}`;
        
        if (!seen.has(key)) {
          seen.add(key);
          uniqueSuggestions.push(suggestion);
        }
      }
      
      // Return top suggestions
      return uniqueSuggestions.slice(0, 10);
    } catch (error) {
      logger.error('Failed to generate related searches', { error });
      return [];
    }
  }
}

// Export a singleton instance
export const relationshipEnhancedSearch = new RelationshipEnhancedSearch();
