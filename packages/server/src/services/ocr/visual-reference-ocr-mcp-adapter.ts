/**
 * Visual Reference OCR MCP Adapter
 *
 * This adapter provides MCP integration for the Visual Reference OCR service.
 * It handles image comparison and OCR enhancement through the MCP server.
 */

import { logger } from '../../utils/logger';
import mcpClientService, { MCPServiceKey } from '../mcp/mcpClientService';
import creditService from '../credit/creditService';

/**
 * Check if MCP is available for visual reference OCR
 * @returns Promise that resolves to true if MCP is available
 */
export async function isMCPAvailable(): Promise<boolean> {
  return mcpClientService.isMCPAvailable();
}

/**
 * Compare an image with visual references using MCP
 *
 * @param userId User ID for credit tracking
 * @param imagePath Path to the image being processed
 * @param referenceUrls URLs of the reference images to compare with
 * @returns Comparison results with similarity scores
 */
export async function compareImagesWithMCP(
  userId: string,
  imagePath: string,
  referenceUrls: string[]
): Promise<Array<{
  referenceUrl: string;
  similarity: number;
}>> {
  try {
    // Check if MCP is available
    const mcpAvailable = await isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.IMAGE_ANALYSIS,
      1 // 1 credit per comparison batch
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    logger.info(`Using MCP for image comparison: ${imagePath} with ${referenceUrls.length} references`);

    // Call MCP for image comparison
    const result = await mcpClientService.compareImages(
      userId,
      imagePath,
      referenceUrls
    );

    // Track credit usage
    await creditService.useServiceCredits(
      userId,
      MCPServiceKey.IMAGE_ANALYSIS,
      1,
      `${MCPServiceKey.IMAGE_ANALYSIS} API usage for visual reference comparison`,
      {
        endpoint: 'image/compare',
        imagePath,
        referenceCount: referenceUrls.length
      }
    );

    return result.comparisons;
  } catch (error) {
    logger.error('Error comparing images with MCP', { error });
    throw error;
  }
}

/**
 * Find similar visual references using MCP
 *
 * @param userId User ID for credit tracking
 * @param imagePath Path to the image being processed
 * @param propertyName Property name to search for
 * @param materialType Material type to search for
 * @returns Similar visual references with similarity scores
 */
export async function findSimilarReferencesWithMCP(
  userId: string,
  imagePath: string,
  propertyName: string,
  materialType: string
): Promise<Array<{
  propertyValue: string;
  referenceUrl: string;
  similarity: number;
}>> {
  try {
    // Check if MCP is available
    const mcpAvailable = await isMCPAvailable();
    if (!mcpAvailable) {
      throw new Error('MCP server is not available');
    }

    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.IMAGE_ANALYSIS,
      2 // 2 credits for similarity search
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    logger.info(`Using MCP for finding similar references: ${imagePath} for ${propertyName} (${materialType})`);

    // Call MCP for similarity search
    const result = await mcpClientService.findSimilarReferences(
      userId,
      imagePath,
      propertyName,
      materialType
    );

    // Track credit usage
    await creditService.useServiceCredits(
      userId,
      MCPServiceKey.IMAGE_ANALYSIS,
      2,
      `${MCPServiceKey.IMAGE_ANALYSIS} API usage for visual reference similarity search`,
      {
        endpoint: 'image/similar-references',
        imagePath,
        propertyName,
        materialType
      }
    );

    return result.similarReferences;
  } catch (error) {
    logger.error('Error finding similar references with MCP', { error });
    throw error;
  }
}
