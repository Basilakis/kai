/**
 * Text-Image Association Tests
 * 
 * This module provides testing utilities for verifying the accuracy of 
 * text-image associations in extracted PDF content.
 */

import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test result for a text-image association
 */
export interface AssociationTestResult {
  /** Status of the test */
  status: 'passed' | 'failed' | 'warning';
  /** Score from 0-100 representing confidence */
  score: number;
  /** Description of the test result */
  description: string;
  /** Any specific issue found */
  issue?: string;
  /** Suggested improvement */
  suggestion?: string;
}

/**
 * Test parameters for association testing
 */
export interface AssociationTestParams {
  /** Whether to verify dimensions match between text and image */
  verifyDimensions?: boolean;
  /** Whether to verify color information */
  verifyColors?: boolean;
  /** Whether to check for specification keywords */
  verifySpecKeywords?: boolean;
  /** Minimum acceptable confidence score (0-100) */
  minimumScore?: number;
  /** Whether to generate visualizations */
  generateVisualizations?: boolean;
  /** Output directory for visualizations */
  visualizationDir?: string;
}

/**
 * Extract tile specification from text
 * 
 * @param text Text content associated with an image
 * @returns Parsed specification data
 */
function extractSpecification(text: string): Record<string, string | number | boolean> {
  const specs: Record<string, string | number | boolean> = {};
  
  // Look for dimensions (e.g., "60x60cm", "24x24", "600x600mm")
  const dimensionMatch = text.match(/(\d+)\s*[xX]\s*(\d+)\s*(cm|mm|in)?/);
  if (dimensionMatch) {
    specs.width = parseInt(dimensionMatch[1], 10);
    specs.height = parseInt(dimensionMatch[2], 10);
    specs.unit = dimensionMatch[3] || 'mm';
  }
  
  // Look for colors
  const colorMatches = text.match(/colou?r\s*:\s*([a-zA-Z\s]+)/i) || 
                     text.match(/([a-zA-Z]+)\s+colou?r/i);
  if (colorMatches && colorMatches[1]) {
    specs.color = colorMatches[1].trim();
  }
  
  // Look for material type
  const materialMatches = text.match(/material\s*:\s*([a-zA-Z\s]+)/i) ||
                         text.match(/(porcelain|ceramic|natural stone|marble|granite|slate|limestone|travertine|mosaic|glass|metal|wood)/i);
  if (materialMatches && materialMatches[1]) {
    specs.material = materialMatches[1].trim();
  }
  
  // Look for finish type
  const finishMatches = text.match(/finish\s*:\s*([a-zA-Z\s]+)/i) ||
                       text.match(/(matt|matte|polished|glossy|semi-polished|textured|structured|rough|smooth|lappato|satin)/i);
  if (finishMatches && finishMatches[1]) {
    specs.finish = finishMatches[1].trim();
  }
  
  // Look for technical properties
  if (text.match(/(?:R|PEI)\s*(?:9|IV|4)/i)) {
    specs.slipResistance = true;
  }
  
  if (text.match(/frost\s*resistant/i)) {
    specs.frostResistant = true;
  }
  
  if (text.match(/water\s*(?:absorption|resistant)/i)) {
    specs.waterResistant = true;
  }
  
  // Look for collections/series
  const collectionMatches = text.match(/collection\s*:\s*([a-zA-Z0-9\s]+)/i) ||
                           text.match(/series\s*:\s*([a-zA-Z0-9\s]+)/i);
  if (collectionMatches && collectionMatches[1]) {
    specs.collection = collectionMatches[1].trim();
  }
  
  return specs;
}

/**
 * Calculate confidence score for an association
 * 
 * @param specs Extracted specifications
 * @param imageMetadata Image metadata
 * @returns Confidence score from 0-100
 */
function calculateConfidenceScore(
  specs: Record<string, string | number | boolean>,
  imageMetadata: {
    width?: number;
    height?: number;
    colorPalette?: string[];
    filename: string;
  }
): number {
  let score = 0;
  let possiblePoints = 0;
  
  // Check dimensions if available in both specs and metadata
  if (specs.width && specs.height && imageMetadata.width && imageMetadata.height) {
    possiblePoints += 30;
    
    // Convert dimensions to same unit if necessary
    const unit = specs.unit as string || 'mm';
    let imageAspectRatio = imageMetadata.width / imageMetadata.height;
    let specAspectRatio = specs.width as number / (specs.height as number);
    
    // Calculate similarity between aspect ratios (1.0 = identical)
    const aspectRatioSimilarity = Math.min(imageAspectRatio, specAspectRatio) / 
                                 Math.max(imageAspectRatio, specAspectRatio);
    
    // Award points based on similarity
    score += Math.round(30 * aspectRatioSimilarity);
  }
  
  // Check for color information
  if (specs.color && imageMetadata.colorPalette && imageMetadata.colorPalette.length > 0) {
    possiblePoints += 20;
    
    const color = specs.color as string;
    const colorWords = color.toLowerCase().split(/\s+/);
    
    // Check if any color words match the palette
    let colorMatch = false;
    for (const word of colorWords) {
      if (imageMetadata.colorPalette.some(c => c.toLowerCase().includes(word))) {
        colorMatch = true;
        break;
      }
    }
    
    if (colorMatch) {
      score += 20;
    }
  }
  
  // Check if filename contains material or collection information
  if (specs.material || specs.collection) {
    possiblePoints += 25;
    
    const filename = imageMetadata.filename.toLowerCase();
    let materialMatch = false;
    
    if (specs.material && filename.includes((specs.material as string).toLowerCase())) {
      materialMatch = true;
    }
    
    if (specs.collection && filename.includes((specs.collection as string).toLowerCase())) {
      materialMatch = true;
    }
    
    if (materialMatch) {
      score += 25;
    }
  }
  
  // Check if material has technical specifications
  if (specs.slipResistance || specs.frostResistant || specs.waterResistant) {
    possiblePoints += 25;
    score += 25; // Technical specs don't usually appear in images, so high confidence if found in text
  }
  
  // If we have no possible points, default to 50% confidence
  if (possiblePoints === 0) {
    return 50;
  }
  
  // Convert to score out of 100
  return Math.round((score / possiblePoints) * 100);
}

/**
 * Test text-image associations
 * 
 * @param catalogId Catalog ID
 * @param extractionData Extracted data from PDF
 * @param params Test parameters
 * @returns Test results
 */
export async function testAssociations(
  catalogId: string,
  extractionData: {
    images: Array<{
      id: string;
      filename: string;
      path: string;
      width?: number;
      height?: number;
      colorPalette?: string[];
      pageNumber: number;
      coordinates?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      associatedTextBlocks?: Array<{
        id: string;
        text: string;
        coordinates: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      }>;
    }>;
  },
  params: AssociationTestParams = {}
): Promise<Record<string, AssociationTestResult>> {
  const results: Record<string, AssociationTestResult> = {};
  const defaultParams: AssociationTestParams = {
    verifyDimensions: true,
    verifyColors: true,
    verifySpecKeywords: true,
    minimumScore: 60,
    generateVisualizations: false
  };
  
  // Merge with default parameters
  const testParams = { ...defaultParams, ...params };
  
  logger.info(`Testing text-image associations for catalog ${catalogId} (${extractionData.images.length} images)`);
  
  // Process each image in the extraction data
  for (const image of extractionData.images) {
    try {
      // Skip images without associated text blocks
      if (!image.associatedTextBlocks || image.associatedTextBlocks.length === 0) {
        results[image.id] = {
          status: 'warning',
          score: 0,
          description: 'No associated text blocks found',
          issue: 'Missing text association',
          suggestion: 'Check PDF layout for text near this image'
        };
        continue;
      }
      
      // Combine all associated text blocks
      const combinedText = image.associatedTextBlocks
        .map(block => block.text)
        .join(' ');
      
      // Extract specifications from text
      const specs = extractSpecification(combinedText);
      
      // Check if we have at least some specs
      const hasMinimalSpecs = Object.keys(specs).length > 0;
      
      if (!hasMinimalSpecs) {
        results[image.id] = {
          status: 'warning',
          score: 20,
          description: 'Associated text contains no recognizable specifications',
          issue: 'Text does not contain material specifications',
          suggestion: 'Check OCR quality or if the image is actually a material/tile'
        };
        continue;
      }
      
      // Calculate confidence score
      const score = calculateConfidenceScore(specs, {
        width: image.width,
        height: image.height,
        colorPalette: image.colorPalette,
        filename: image.filename
      });
      
      // Determine status based on score (default to 60 if not specified)
      const minimumScore = testParams.minimumScore !== undefined ? testParams.minimumScore : 60;
      const status = score >= minimumScore ? 'passed' : 'failed';
      
      // Generate result
      results[image.id] = {
        status,
        score,
        description: `Association ${status} with confidence score ${score}%`,
        issue: status === 'failed' ? 'Low confidence in text-image association' : undefined,
        suggestion: status === 'failed' ? 'Manually verify the association or improve OCR quality' : undefined
      };
      
      // Generate visualization if requested
      if (testParams.generateVisualizations && testParams.visualizationDir) {
        await generateVisualization(
          image,
          combinedText,
          specs,
          score,
          testParams.visualizationDir
        );
      }
    } catch (error) {
      logger.error(`Error testing association for image ${image.id}: ${error}`);
      results[image.id] = {
        status: 'failed',
        score: 0,
        description: `Error during association testing: ${error}`,
        issue: 'Technical error during testing',
        suggestion: 'Check logs for details'
      };
    }
  }
  
  // Calculate overall stats
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r.status === 'passed').length;
  const warningTests = Object.values(results).filter(r => r.status === 'warning').length;
  const failedTests = Object.values(results).filter(r => r.status === 'failed').length;
  
  logger.info(`Association testing complete for catalog ${catalogId}:`);
  logger.info(`- Total: ${totalTests}`);
  logger.info(`- Passed: ${passedTests}`);
  logger.info(`- Warnings: ${warningTests}`);
  logger.info(`- Failed: ${failedTests}`);
  
  return results;
}

/**
 * Generate a visualization of the text-image association
 * (Implementation would create an image showing the association)
 */
async function generateVisualization(
  image: any,
  text: string,
  specs: Record<string, string | number | boolean>,
  score: number,
  outputDir: string
): Promise<void> {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Generate visualization filename
  const visualizationPath = path.join(outputDir, `${image.id}_association.jpg`);
  
  logger.info(`Generating visualization for image ${image.id} at ${visualizationPath}`);
  
  // In a real implementation, this would:
  // 1. Load the image
  // 2. Draw text boxes showing the associated text
  // 3. Highlight extracted specifications
  // 4. Show confidence score
  // 5. Save as new image for review
  
  // For this example, we'll just create a text file with the information
  const visualizationText = [
    `Image ID: ${image.id}`,
    `Filename: ${image.filename}`,
    `Confidence Score: ${score}%`,
    ``,
    `Associated Text:`,
    text,
    ``,
    `Extracted Specifications:`,
    ...Object.entries(specs).map(([key, value]) => `${key}: ${value}`)
  ].join('\n');
  
  fs.writeFileSync(visualizationPath.replace('.jpg', '.txt'), visualizationText);
}

/**
 * Generate test report
 * 
 * @param catalogId Catalog ID
 * @param results Test results
 * @param outputPath Output file path
 */
export function generateTestReport(
  catalogId: string,
  results: Record<string, AssociationTestResult>,
  outputPath: string
): void {
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Calculate overall stats
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r.status === 'passed').length;
  const warningTests = Object.values(results).filter(r => r.status === 'warning').length;
  const failedTests = Object.values(results).filter(r => r.status === 'failed').length;
  const averageScore = Object.values(results).reduce((sum, r) => sum + r.score, 0) / totalTests;
  
  // Generate report content
  const report = {
    catalogId,
    testDate: new Date(),
    summary: {
      totalImages: totalTests,
      passedAssociations: passedTests,
      warningAssociations: warningTests,
      failedAssociations: failedTests,
      passRate: Math.round((passedTests / totalTests) * 100),
      averageConfidence: Math.round(averageScore)
    },
    details: results
  };
  
  // Write report to file
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  
  logger.info(`Test report generated at ${outputPath}`);
}