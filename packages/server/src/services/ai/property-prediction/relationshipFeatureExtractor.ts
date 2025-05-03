/**
 * Relationship Feature Extractor
 * 
 * This service extracts features from the Property Relationship Graph
 * to enhance AI model training for property prediction.
 */

import { propertyRelationshipService } from '@kai/shared/src/services/property-relationships/propertyRelationshipService';
import { RelationshipType, CompatibilityType } from '@kai/shared/src/types/property-relationships';
import { logger } from '../../../utils/logger';

/**
 * Relationship Feature Extractor Service
 */
export class RelationshipFeatureExtractor {
  /**
   * Extract relationship features for a material
   * 
   * @param materialType The type of material
   * @param properties The current property values
   * @param targetProperty The property to predict
   * @returns Extracted features
   */
  public async extractFeatures(
    materialType: string,
    properties: Record<string, string>,
    targetProperty: string
  ): Promise<Record<string, number>> {
    try {
      const features: Record<string, number> = {};
      
      // Get all relationships where target property is the requested property
      const relationships = await propertyRelationshipService.getRelationshipsByTargetProperty(
        targetProperty,
        materialType
      );
      
      // Process each relationship
      for (const relationship of relationships) {
        const { sourceProperty, relationshipType, strength, bidirectional } = relationship;
        
        // Skip if source property is not in the properties
        if (!properties[sourceProperty]) {
          continue;
        }
        
        const sourceValue = properties[sourceProperty];
        
        // Add relationship strength as a feature
        features[`rel_strength_${sourceProperty}_to_${targetProperty}`] = strength;
        
        // Add bidirectional flag as a feature
        features[`rel_bidirectional_${sourceProperty}_to_${targetProperty}`] = bidirectional ? 1 : 0;
        
        // Add relationship type as one-hot encoded features
        Object.values(RelationshipType).forEach(type => {
          features[`rel_type_${sourceProperty}_to_${targetProperty}_${type}`] = 
            relationshipType === type ? 1 : 0;
        });
        
        // Handle different relationship types
        switch (relationshipType) {
          case RelationshipType.CORRELATION: {
            // Get correlations for this relationship and source value
            const correlations = await propertyRelationshipService.getValueCorrelationsBySourceValue(
              relationship.id,
              sourceValue
            );
            
            // Add correlation strengths as features
            for (const correlation of correlations) {
              features[`corr_${sourceProperty}_${sourceValue}_to_${targetProperty}_${correlation.targetValue}`] = 
                correlation.correlationStrength;
              
              // Add sample size as a feature (normalized)
              if (correlation.sampleSize > 0) {
                features[`corr_sample_${sourceProperty}_${sourceValue}_to_${targetProperty}_${correlation.targetValue}`] = 
                  Math.min(correlation.sampleSize / 100, 1.0); // Normalize to [0,1]
              }
            }
            break;
          }
          
          case RelationshipType.COMPATIBILITY:
          case RelationshipType.EXCLUSION: {
            // Get compatibility rules for this relationship and source value
            const rules = await propertyRelationshipService.getCompatibilityRulesBySourceValue(
              relationship.id,
              sourceValue
            );
            
            // Add compatibility types as features
            for (const rule of rules) {
              // One-hot encode compatibility type
              Object.values(CompatibilityType).forEach(type => {
                features[`compat_${sourceProperty}_${sourceValue}_to_${targetProperty}_${rule.targetValue}_${type}`] = 
                  rule.compatibilityType === type ? 1 : 0;
              });
              
              // Add a numeric score based on compatibility type
              let compatScore = 0;
              switch (rule.compatibilityType) {
                case CompatibilityType.RECOMMENDED:
                  compatScore = 1.0;
                  break;
                case CompatibilityType.COMPATIBLE:
                  compatScore = 0.5;
                  break;
                case CompatibilityType.NOT_RECOMMENDED:
                  compatScore = -0.5;
                  break;
                case CompatibilityType.INCOMPATIBLE:
                  compatScore = -1.0;
                  break;
              }
              
              features[`compat_score_${sourceProperty}_${sourceValue}_to_${targetProperty}_${rule.targetValue}`] = 
                compatScore;
            }
            break;
          }
          
          // Handle other relationship types as needed
          default:
            break;
        }
      }
      
      return features;
    } catch (error) {
      logger.error('Failed to extract relationship features', { error });
      return {};
    }
  }
  
  /**
   * Generate training data with relationship features
   * 
   * @param materialType The type of material
   * @param targetProperty The property to predict
   * @param sampleSize Number of samples to generate
   * @returns Generated training data
   */
  public async generateTrainingData(
    materialType: string,
    targetProperty: string,
    sampleSize: number = 1000
  ): Promise<Array<{
    features: Record<string, number | string>;
    label: string;
  }>> {
    try {
      const trainingData: Array<{
        features: Record<string, number | string>;
        label: string;
      }> = [];
      
      // Get all relationships where target property is the requested property
      const relationships = await propertyRelationshipService.getRelationshipsByTargetProperty(
        targetProperty,
        materialType
      );
      
      // Get all possible values for the target property
      const targetValues = new Set<string>();
      
      // Collect all source properties
      const sourceProperties = new Set<string>();
      
      // Collect possible values for each source property
      const sourcePropertyValues: Record<string, Set<string>> = {};
      
      // Process each relationship to collect possible values
      for (const relationship of relationships) {
        const { sourceProperty, id } = relationship;
        sourceProperties.add(sourceProperty);
        
        if (!sourcePropertyValues[sourceProperty]) {
          sourcePropertyValues[sourceProperty] = new Set<string>();
        }
        
        // Get correlations or compatibility rules to find possible values
        if (relationship.relationshipType === RelationshipType.CORRELATION) {
          const correlations = await propertyRelationshipService.getValueCorrelationsByRelationshipId(id);
          
          for (const correlation of correlations) {
            sourcePropertyValues[sourceProperty].add(correlation.sourceValue);
            targetValues.add(correlation.targetValue);
          }
        } else if (
          relationship.relationshipType === RelationshipType.COMPATIBILITY ||
          relationship.relationshipType === RelationshipType.EXCLUSION
        ) {
          const rules = await propertyRelationshipService.getCompatibilityRulesByRelationshipId(id);
          
          for (const rule of rules) {
            sourcePropertyValues[sourceProperty].add(rule.sourceValue);
            targetValues.add(rule.targetValue);
          }
        }
      }
      
      // If we don't have enough data from relationships, add some default values
      if (targetValues.size === 0) {
        // Add some default values based on the property name
        if (targetProperty === 'finish') {
          targetValues.add('matte');
          targetValues.add('glossy');
          targetValues.add('polished');
        } else if (targetProperty === 'rRating') {
          targetValues.add('R9');
          targetValues.add('R10');
          targetValues.add('R11');
        } else {
          targetValues.add('value1');
          targetValues.add('value2');
        }
      }
      
      // Generate training samples
      for (let i = 0; i < sampleSize; i++) {
        // Generate random property values
        const properties: Record<string, string> = {};
        
        for (const sourceProperty of sourceProperties) {
          const possibleValues = Array.from(sourcePropertyValues[sourceProperty]);
          
          if (possibleValues.length > 0) {
            const randomIndex = Math.floor(Math.random() * possibleValues.length);
            properties[sourceProperty] = possibleValues[randomIndex];
          }
        }
        
        // Skip if we don't have enough properties
        if (Object.keys(properties).length === 0) {
          continue;
        }
        
        // Get recommendations for the target property
        const recommendations = await propertyRelationshipService.getPropertyRecommendations({
          materialType,
          properties,
          targetProperty
        });
        
        // Choose a target value based on recommendations
        let targetValue: string;
        
        if (recommendations.recommendations.length > 0) {
          // Use weighted random selection based on confidence
          const totalConfidence = recommendations.recommendations.reduce(
            (sum, rec) => sum + rec.confidence,
            0
          );
          
          let random = Math.random() * totalConfidence;
          let index = 0;
          
          while (random > 0 && index < recommendations.recommendations.length) {
            random -= recommendations.recommendations[index].confidence;
            index++;
          }
          
          targetValue = recommendations.recommendations[Math.max(0, index - 1)].value;
        } else {
          // Choose a random target value
          const possibleValues = Array.from(targetValues);
          const randomIndex = Math.floor(Math.random() * possibleValues.length);
          targetValue = possibleValues[randomIndex];
        }
        
        // Extract relationship features
        const relationshipFeatures = await this.extractFeatures(
          materialType,
          properties,
          targetProperty
        );
        
        // Combine base properties and relationship features
        const features = {
          ...properties,
          ...relationshipFeatures
        };
        
        // Add to training data
        trainingData.push({
          features,
          label: targetValue
        });
      }
      
      return trainingData;
    } catch (error) {
      logger.error('Failed to generate training data', { error });
      return [];
    }
  }
  
  /**
   * Enhance model prediction with relationship data
   * 
   * @param materialType The type of material
   * @param properties The current property values
   * @param targetProperty The property to predict
   * @param predictions The model's raw predictions
   * @returns Enhanced predictions
   */
  public async enhancePredictions(
    materialType: string,
    properties: Record<string, string>,
    targetProperty: string,
    predictions: Array<{
      value: string;
      probability: number;
    }>
  ): Promise<Array<{
    value: string;
    probability: number;
    confidence: number;
  }>> {
    try {
      // Get recommendations from the relationship graph
      const recommendations = await propertyRelationshipService.getPropertyRecommendations({
        materialType,
        properties,
        targetProperty
      });
      
      // Create a map of recommendation confidences
      const recommendationConfidences: Record<string, number> = {};
      
      for (const rec of recommendations.recommendations) {
        recommendationConfidences[rec.value] = rec.confidence;
      }
      
      // Enhance predictions with relationship confidences
      const enhancedPredictions = predictions.map(prediction => {
        const relationshipConfidence = recommendationConfidences[prediction.value] || 0;
        
        // Combine model probability and relationship confidence
        // Using a weighted average (70% model, 30% relationships)
        const combinedConfidence = 
          (prediction.probability * 0.7) + (relationshipConfidence * 0.3);
        
        return {
          value: prediction.value,
          probability: prediction.probability,
          confidence: combinedConfidence
        };
      });
      
      // Sort by combined confidence
      enhancedPredictions.sort((a, b) => b.confidence - a.confidence);
      
      return enhancedPredictions;
    } catch (error) {
      logger.error('Failed to enhance predictions', { error });
      
      // Return the original predictions with the same probability as confidence
      return predictions.map(prediction => ({
        value: prediction.value,
        probability: prediction.probability,
        confidence: prediction.probability
      }));
    }
  }
}

// Export a singleton instance
export const relationshipFeatureExtractor = new RelationshipFeatureExtractor();
