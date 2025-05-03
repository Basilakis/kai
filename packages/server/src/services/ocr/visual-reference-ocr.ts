/**
 * Visual Reference OCR Enhancement Service
 * 
 * This service enhances OCR extraction by using the Visual Reference Library
 * to provide context and validation for extracted properties.
 */

import { propertyReferenceService } from '@kai/shared/src/services/property-reference/propertyReferenceService';
import { logger } from '../../utils/logger';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createCanvas, loadImage } from 'canvas';
import { tileFieldDescriptions } from '@kai/shared/src/docs/tile-field-descriptions';

/**
 * Result of OCR extraction with visual reference enhancement
 */
interface EnhancedExtractionResult {
  propertyName: string;
  extractedValue: string;
  confidence: number;
  visuallyVerified: boolean;
  alternativeSuggestions?: Array<{
    value: string;
    confidence: number;
  }>;
  visualReferences?: Array<{
    id: string;
    url: string;
    similarity: number;
  }>;
}

/**
 * Visual Reference OCR Enhancement Service
 */
export class VisualReferenceOcrService {
  /**
   * Enhance OCR extraction with visual reference verification
   * 
   * @param propertyName The name of the property being extracted
   * @param extractedValue The value extracted from OCR
   * @param imageUrl URL of the image being processed
   * @param materialType The type of material
   * @returns Enhanced extraction result with visual verification
   */
  public async enhanceExtraction(
    propertyName: string,
    extractedValue: string,
    imageUrl: string,
    materialType: string
  ): Promise<EnhancedExtractionResult> {
    try {
      logger.info(`Enhancing OCR extraction for ${propertyName}: ${extractedValue}`);
      
      // Get visual references for the extracted value
      const visualReferences = await propertyReferenceService.getPropertyReferenceImages({
        propertyName,
        propertyValue: extractedValue,
        materialType
      });
      
      // If no references found, try to find alternatives
      if (visualReferences.length === 0) {
        logger.info(`No visual references found for ${propertyName}: ${extractedValue}, looking for alternatives`);
        return await this.findAlternatives(propertyName, extractedValue, imageUrl, materialType);
      }
      
      // Download the image being processed
      const imagePath = await this.downloadImage(imageUrl);
      
      // Compare the image with visual references
      const comparisonResults = await this.compareWithReferences(imagePath, visualReferences);
      
      // Clean up the downloaded image
      fs.unlinkSync(imagePath);
      
      // Calculate overall confidence based on visual similarity
      const averageSimilarity = comparisonResults.reduce((sum, result) => sum + result.similarity, 0) / comparisonResults.length;
      
      // Determine if the extraction is visually verified
      const visuallyVerified = averageSimilarity > 0.7; // Threshold for visual verification
      
      // Adjust confidence based on visual verification
      const confidence = visuallyVerified ? 
        0.5 + (averageSimilarity * 0.5) : // Scale from 0.5 to 1.0 if verified
        averageSimilarity * 0.7; // Scale from 0 to 0.7 if not verified
      
      return {
        propertyName,
        extractedValue,
        confidence,
        visuallyVerified,
        visualReferences: comparisonResults.map(result => ({
          id: result.referenceId,
          url: result.referenceUrl,
          similarity: result.similarity
        }))
      };
    } catch (error) {
      logger.error('Failed to enhance OCR extraction', { error });
      
      // Return basic result without enhancement
      return {
        propertyName,
        extractedValue,
        confidence: 0.5, // Default confidence without visual verification
        visuallyVerified: false
      };
    }
  }
  
  /**
   * Find alternative property values when the extracted value has no visual references
   */
  private async findAlternatives(
    propertyName: string,
    extractedValue: string,
    imageUrl: string,
    materialType: string
  ): Promise<EnhancedExtractionResult> {
    try {
      // Get all references for this property
      const allReferences = await propertyReferenceService.getPropertyReferenceImages({
        propertyName,
        materialType
      });
      
      if (allReferences.length === 0) {
        // No references at all for this property
        return {
          propertyName,
          extractedValue,
          confidence: 0.5, // Default confidence
          visuallyVerified: false
        };
      }
      
      // Group references by property value
      const referencesByValue: Record<string, any[]> = {};
      for (const ref of allReferences) {
        if (!referencesByValue[ref.propertyValue]) {
          referencesByValue[ref.propertyValue] = [];
        }
        referencesByValue[ref.propertyValue].push(ref);
      }
      
      // Download the image being processed
      const imagePath = await this.downloadImage(imageUrl);
      
      // Compare with one reference from each property value
      const comparisonPromises = Object.entries(referencesByValue).map(async ([value, refs]) => {
        // Use the primary reference if available, otherwise use the first one
        const reference = refs.find(ref => ref.isPrimary) || refs[0];
        
        // Compare images
        const similarity = await this.compareImages(imagePath, reference.url);
        
        return {
          value,
          similarity,
          referenceId: reference.id,
          referenceUrl: reference.url
        };
      });
      
      const comparisonResults = await Promise.all(comparisonPromises);
      
      // Clean up the downloaded image
      fs.unlinkSync(imagePath);
      
      // Sort by similarity (highest first)
      comparisonResults.sort((a, b) => b.similarity - a.similarity);
      
      // Check if any alternatives have good similarity
      const bestMatch = comparisonResults[0];
      const visuallyVerified = bestMatch.similarity > 0.7;
      
      // If we have a good match, use it as the extracted value
      const finalValue = visuallyVerified ? bestMatch.value : extractedValue;
      
      // Calculate confidence
      const confidence = visuallyVerified ? 
        0.5 + (bestMatch.similarity * 0.5) : // Scale from 0.5 to 1.0 if verified
        0.5; // Default confidence if not verified
      
      return {
        propertyName,
        extractedValue: finalValue,
        confidence,
        visuallyVerified,
        alternativeSuggestions: comparisonResults.slice(0, 3).map(result => ({
          value: result.value,
          confidence: result.similarity
        })),
        visualReferences: comparisonResults.slice(0, 3).map(result => ({
          id: result.referenceId,
          url: result.referenceUrl,
          similarity: result.similarity
        }))
      };
    } catch (error) {
      logger.error('Failed to find alternatives', { error });
      
      // Return basic result without enhancement
      return {
        propertyName,
        extractedValue,
        confidence: 0.5,
        visuallyVerified: false
      };
    }
  }
  
  /**
   * Compare an image with visual references
   */
  private async compareWithReferences(imagePath: string, references: any[]): Promise<any[]> {
    try {
      // Compare with each reference
      const comparisonPromises = references.map(async (reference) => {
        const similarity = await this.compareImages(imagePath, reference.url);
        
        return {
          referenceId: reference.id,
          referenceUrl: reference.url,
          similarity
        };
      });
      
      return await Promise.all(comparisonPromises);
    } catch (error) {
      logger.error('Failed to compare with references', { error });
      throw error;
    }
  }
  
  /**
   * Compare two images and return a similarity score
   * 
   * This is a simplified implementation. In a production system,
   * you would use more sophisticated image comparison techniques.
   */
  private async compareImages(imagePath1: string, imageUrl2: string): Promise<number> {
    try {
      // Download the second image
      const imagePath2 = await this.downloadImage(imageUrl2);
      
      // Load images
      const image1 = await loadImage(imagePath1);
      const image2 = await loadImage(imagePath2);
      
      // Create canvases for both images (resized to the same dimensions)
      const size = 224; // Common size for comparison
      const canvas1 = createCanvas(size, size);
      const ctx1 = canvas1.getContext('2d');
      ctx1.drawImage(image1, 0, 0, size, size);
      
      const canvas2 = createCanvas(size, size);
      const ctx2 = canvas2.getContext('2d');
      ctx2.drawImage(image2, 0, 0, size, size);
      
      // Get image data
      const imageData1 = ctx1.getImageData(0, 0, size, size);
      const imageData2 = ctx2.getImageData(0, 0, size, size);
      
      // Compare pixel data (simplified approach)
      let difference = 0;
      const pixelCount = imageData1.data.length;
      
      for (let i = 0; i < pixelCount; i += 4) {
        // Compare RGB values (skip alpha)
        const rDiff = Math.abs(imageData1.data[i] - imageData2.data[i]);
        const gDiff = Math.abs(imageData1.data[i + 1] - imageData2.data[i + 1]);
        const bDiff = Math.abs(imageData1.data[i + 2] - imageData2.data[i + 2]);
        
        // Average difference for this pixel
        difference += (rDiff + gDiff + bDiff) / (3 * 255);
      }
      
      // Calculate average difference and convert to similarity
      const avgDifference = difference / (pixelCount / 4);
      const similarity = 1 - avgDifference;
      
      // Clean up the downloaded image
      fs.unlinkSync(imagePath2);
      
      return similarity;
    } catch (error) {
      logger.error('Failed to compare images', { error });
      return 0; // Return zero similarity on error
    }
  }
  
  /**
   * Download an image from a URL to a temporary file
   */
  private async downloadImage(url: string): Promise<string> {
    try {
      const response = await axios({
        method: 'GET',
        url,
        responseType: 'stream'
      });
      
      const tempDir = path.join(process.cwd(), 'temp');
      fs.mkdirSync(tempDir, { recursive: true });
      
      const imagePath = path.join(tempDir, `${uuidv4()}.jpg`);
      const writer = fs.createWriteStream(imagePath);
      
      return new Promise<string>((resolve, reject) => {
        response.data.pipe(writer);
        writer.on('finish', () => resolve(imagePath));
        writer.on('error', reject);
      });
    } catch (error) {
      logger.error('Failed to download image', { error, url });
      throw error;
    }
  }
  
  /**
   * Enhance OCR extraction for multiple properties
   * 
   * @param extractedProperties Record of property names to extracted values
   * @param imageUrl URL of the image being processed
   * @param materialType The type of material
   * @returns Enhanced extraction results for each property
   */
  public async enhanceMultipleExtractions(
    extractedProperties: Record<string, string>,
    imageUrl: string,
    materialType: string
  ): Promise<Record<string, EnhancedExtractionResult>> {
    try {
      logger.info(`Enhancing multiple OCR extractions for ${Object.keys(extractedProperties).length} properties`);
      
      const results: Record<string, EnhancedExtractionResult> = {};
      
      // Process each property
      for (const [propertyName, extractedValue] of Object.entries(extractedProperties)) {
        if (!extractedValue) continue;
        
        results[propertyName] = await this.enhanceExtraction(
          propertyName,
          extractedValue,
          imageUrl,
          materialType
        );
      }
      
      return results;
    } catch (error) {
      logger.error('Failed to enhance multiple extractions', { error });
      
      // Return basic results without enhancement
      const results: Record<string, EnhancedExtractionResult> = {};
      
      for (const [propertyName, extractedValue] of Object.entries(extractedProperties)) {
        results[propertyName] = {
          propertyName,
          extractedValue,
          confidence: 0.5,
          visuallyVerified: false
        };
      }
      
      return results;
    }
  }
  
  /**
   * Get extraction patterns for a property based on visual references
   * 
   * @param propertyName The name of the property
   * @param materialType The type of material
   * @returns Extraction patterns and examples
   */
  public async getExtractionPatterns(
    propertyName: string,
    materialType: string
  ): Promise<any> {
    try {
      // Get all references for this property
      const references = await propertyReferenceService.getPropertyReferenceImages({
        propertyName,
        materialType
      });
      
      // Get unique property values
      const propertyValues = [...new Set(references.map(ref => ref.propertyValue))];
      
      // Get field description if available
      const description = propertyName in tileFieldDescriptions 
        ? tileFieldDescriptions[propertyName as keyof typeof tileFieldDescriptions]
        : `${propertyName} property for ${materialType}`;
      
      // Generate regex patterns based on property values
      const patterns = this.generatePatternsForValues(propertyValues, propertyName);
      
      return {
        propertyName,
        materialType,
        description,
        values: propertyValues,
        patterns,
        examples: propertyValues.map(value => ({
          value,
          references: references
            .filter(ref => ref.propertyValue === value)
            .map(ref => ({
              id: ref.id,
              url: ref.url,
              isPrimary: ref.isPrimary
            }))
        }))
      };
    } catch (error) {
      logger.error('Failed to get extraction patterns', { error });
      throw error;
    }
  }
  
  /**
   * Generate regex patterns for property values
   */
  private generatePatternsForValues(values: string[], propertyName: string): string[] {
    const patterns: string[] = [];
    
    // Basic pattern matching the exact values
    patterns.push(`(${values.map(v => this.escapeRegExp(v)).join('|')})`);
    
    // Pattern with property name prefix
    patterns.push(`${this.escapeRegExp(propertyName)}\\s*[:=]?\\s*(${values.map(v => this.escapeRegExp(v)).join('|')})`);
    
    // Pattern with common label variations
    const labelVariations = this.generateLabelVariations(propertyName);
    if (labelVariations.length > 0) {
      patterns.push(`(${labelVariations.join('|')})\\s*[:=]?\\s*(${values.map(v => this.escapeRegExp(v)).join('|')})`);
    }
    
    return patterns;
  }
  
  /**
   * Generate variations of property name labels
   */
  private generateLabelVariations(propertyName: string): string[] {
    const variations: string[] = [];
    
    // Convert camelCase to space-separated
    if (/[a-z][A-Z]/.test(propertyName)) {
      variations.push(propertyName.replace(/([a-z])([A-Z])/g, '$1 $2'));
    }
    
    // Convert snake_case to space-separated
    if (propertyName.includes('_')) {
      variations.push(propertyName.replace(/_/g, ' '));
    }
    
    // Special cases for common properties
    switch (propertyName) {
      case 'rRating':
        variations.push('R Rating', 'R-Rating', 'Slip Resistance', 'Slip Rating');
        break;
      case 'vRating':
        variations.push('V Rating', 'V-Rating', 'Shade Variation', 'Color Variation');
        break;
      case 'peiRating':
        variations.push('PEI Rating', 'PEI', 'Wear Rating', 'Abrasion Resistance');
        break;
      case 'waterAbsorption':
        variations.push('Water Absorption', 'Absorption', 'Porosity');
        break;
      case 'moh':
        variations.push('Mohs', 'Mohs Hardness', 'Hardness', 'Scratch Resistance');
        break;
    }
    
    return variations.map(v => this.escapeRegExp(v));
  }
  
  /**
   * Escape special characters in a string for use in a regex
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Export a singleton instance
export const visualReferenceOcrService = new VisualReferenceOcrService();
