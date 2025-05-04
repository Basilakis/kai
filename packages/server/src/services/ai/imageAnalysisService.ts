/**
 * Image Analysis Service
 * 
 * This service provides image analysis capabilities for the Visual Reference Library.
 */

import { logger } from '../../utils/logger';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { mcpClientService, MCPServiceKey } from '../mcp/mcpClientService';
import { createCanvas, loadImage } from 'canvas';

/**
 * Image Analysis Result
 */
export interface ImageAnalysisResult {
  // Basic image information
  width: number;
  height: number;
  format: string;
  
  // Color information
  dominantColor: string;
  colorPalette: string[];
  
  // Texture information
  textureType?: string;
  textureDescription?: string;
  
  // Surface information
  surfaceFinish?: string;
  reflectivity?: number;
  
  // Pattern information
  patternType?: string;
  patternDescription?: string;
  
  // Material information
  materialType?: string;
  materialDescription?: string;
  
  // Additional information
  tags: string[];
  confidence: number;
}

/**
 * Image Analysis Service
 */
export class ImageAnalysisService {
  /**
   * Analyze an image
   * 
   * @param imagePath Path to the image file
   * @returns Analysis result
   */
  public async analyzeImage(imagePath: string): Promise<ImageAnalysisResult> {
    try {
      logger.info(`Analyzing image: ${imagePath}`);
      
      // Check if MCP is available
      const mcpAvailable = await mcpClientService.isAvailable();
      
      if (mcpAvailable) {
        // Use MCP for image analysis
        return this.analyzeImageWithMCP(imagePath);
      } else {
        // Fallback to local analysis
        return this.analyzeImageLocally(imagePath);
      }
    } catch (error) {
      logger.error(`Error analyzing image: ${error}`);
      throw error;
    }
  }
  
  /**
   * Analyze an image using MCP
   * 
   * @param imagePath Path to the image file
   * @returns Analysis result
   */
  private async analyzeImageWithMCP(imagePath: string): Promise<ImageAnalysisResult> {
    try {
      // Read the image file
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      // Call MCP for image analysis
      const response = await mcpClientService.callService({
        serviceKey: MCPServiceKey.IMAGE_ANALYSIS,
        data: {
          image: base64Image,
          analysisTypes: [
            'color',
            'texture',
            'pattern',
            'material',
            'surface'
          ]
        }
      });
      
      // Transform the response to our format
      return {
        width: response.width,
        height: response.height,
        format: response.format,
        dominantColor: response.colors.dominant,
        colorPalette: response.colors.palette,
        textureType: response.texture?.type,
        textureDescription: response.texture?.description,
        surfaceFinish: response.surface?.finish,
        reflectivity: response.surface?.reflectivity,
        patternType: response.pattern?.type,
        patternDescription: response.pattern?.description,
        materialType: response.material?.type,
        materialDescription: response.material?.description,
        tags: response.tags || [],
        confidence: response.confidence || 0.8
      };
    } catch (error) {
      logger.error(`Error analyzing image with MCP: ${error}`);
      
      // Fallback to local analysis
      return this.analyzeImageLocally(imagePath);
    }
  }
  
  /**
   * Analyze an image locally
   * 
   * @param imagePath Path to the image file
   * @returns Analysis result
   */
  private async analyzeImageLocally(imagePath: string): Promise<ImageAnalysisResult> {
    try {
      // Load the image
      const image = await loadImage(imagePath);
      
      // Create a canvas to analyze the image
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Analyze colors
      const colorCounts: Record<string, number> = {};
      const colorSamples = 1000;
      const sampleStep = Math.max(1, Math.floor(data.length / 4 / colorSamples));
      
      for (let i = 0; i < data.length; i += 4 * sampleStep) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Convert to hex
        const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        
        // Count occurrences
        colorCounts[hex] = (colorCounts[hex] || 0) + 1;
      }
      
      // Sort colors by count
      const sortedColors = Object.entries(colorCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([color]) => color);
      
      // Get dominant color and palette
      const dominantColor = sortedColors[0];
      const colorPalette = sortedColors.slice(0, 5);
      
      // Determine texture type based on color variance
      const colorVariance = Object.keys(colorCounts).length / colorSamples;
      let textureType = 'smooth';
      let textureDescription = 'Smooth texture with minimal variation';
      
      if (colorVariance > 0.5) {
        textureType = 'highly_textured';
        textureDescription = 'Highly textured surface with significant variation';
      } else if (colorVariance > 0.2) {
        textureType = 'textured';
        textureDescription = 'Textured surface with moderate variation';
      } else if (colorVariance > 0.1) {
        textureType = 'slightly_textured';
        textureDescription = 'Slightly textured surface with some variation';
      }
      
      // Determine surface finish based on color distribution
      const brightColors = Object.entries(colorCounts)
        .filter(([color]) => {
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          return (r + g + b) / 3 > 200;
        })
        .reduce((sum, [_, count]) => sum + count, 0);
      
      const brightRatio = brightColors / colorSamples;
      let surfaceFinish = 'matte';
      let reflectivity = 0.2;
      
      if (brightRatio > 0.4) {
        surfaceFinish = 'glossy';
        reflectivity = 0.8;
      } else if (brightRatio > 0.2) {
        surfaceFinish = 'semi_glossy';
        reflectivity = 0.5;
      }
      
      // Determine pattern type based on color distribution
      let patternType = 'solid';
      let patternDescription = 'Solid color with minimal pattern';
      
      if (Object.keys(colorCounts).length > 100) {
        patternType = 'complex';
        patternDescription = 'Complex pattern with many colors';
      } else if (Object.keys(colorCounts).length > 50) {
        patternType = 'patterned';
        patternDescription = 'Distinct pattern with multiple colors';
      } else if (Object.keys(colorCounts).length > 20) {
        patternType = 'simple_pattern';
        patternDescription = 'Simple pattern with a few colors';
      }
      
      // Get file extension
      const format = path.extname(imagePath).slice(1).toLowerCase();
      
      return {
        width: image.width,
        height: image.height,
        format,
        dominantColor,
        colorPalette,
        textureType,
        textureDescription,
        surfaceFinish,
        reflectivity,
        patternType,
        patternDescription,
        materialType: 'unknown',
        materialDescription: 'Material type could not be determined',
        tags: [textureType, surfaceFinish, patternType],
        confidence: 0.6
      };
    } catch (error) {
      logger.error(`Error analyzing image locally: ${error}`);
      
      // Return a default result
      return {
        width: 0,
        height: 0,
        format: path.extname(imagePath).slice(1).toLowerCase(),
        dominantColor: '#000000',
        colorPalette: ['#000000'],
        textureType: 'unknown',
        textureDescription: 'Unknown texture',
        surfaceFinish: 'unknown',
        reflectivity: 0,
        patternType: 'unknown',
        patternDescription: 'Unknown pattern',
        materialType: 'unknown',
        materialDescription: 'Unknown material',
        tags: ['unknown'],
        confidence: 0
      };
    }
  }
}

// Create a singleton instance
export const imageAnalysisService = new ImageAnalysisService();
