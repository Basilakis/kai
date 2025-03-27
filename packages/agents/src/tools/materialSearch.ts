/**
 * Material Search Tool
 * 
 * Provides agents with the ability to search for materials in the KAI database
 * using text queries, filtering, and metadata.
 */

import { Tool } from 'crewai';
import { createLogger } from '../utils/logger';
import { getMaterialService } from '../services/serviceFactory';
import { ApiError } from '../services/baseService';

// Logger instance
const logger = createLogger('MaterialSearchTool');

/**
 * Create a tool for searching materials in the KAI database
 */
export async function createMaterialSearchTool(): Promise<Tool> {
  logger.info('Creating material search tool');
  
  // Get the material service instance
  const materialService = getMaterialService();
  
  return new Tool({
    name: 'search_materials',
    description: `
      Search for materials in the KAI database using text queries and filters.
      This tool allows you to find materials based on names, descriptions, properties, 
      and other metadata.
      
      parameters:
      - query (string): The search query text
      - filters (object, optional): JSON object with filter criteria by field
        - material_type (string, optional): Type of material (e.g., "tile", "stone", "wood")
        - color (string, optional): Primary color
        - finish (string, optional): Surface finish
        - size (string, optional): Dimensions
      - limit (number, optional): Maximum number of results to return
    `,
    func: async ({ query, filters, limit }) => {
      logger.info(`Executing material search with query: "${query}"`);
      
      try {
        // Parse the input parameters
        const parsedFilters = typeof filters === 'string' ? JSON.parse(filters) : filters;
        const parsedLimit = limit ? parseInt(limit as string, 10) : 10;
        
        // Set up search options
        const searchParams = {
          query,
          filters: parsedFilters || {},
          limit: parsedLimit,
          includeMetadata: true,
        };
        
        // Execute the search using the real service
        const results = await materialService.searchMaterials(searchParams);
        
        // Format the results as a JSON string
        const formattedResults = JSON.stringify(results, null, 2);
        logger.debug(`Search returned ${results.results.length} results out of ${results.totalCount} total`);
        
        return formattedResults;
      } catch (error) {
        // Log and format errors appropriately
        if (error instanceof ApiError) {
          logger.error(`API error in material search tool: ${error.message} (${error.statusCode})`);
          return JSON.stringify({
            error: `Material search failed with status ${error.statusCode}`,
            message: error.message,
            details: error.data,
          });
        } else {
          logger.error(`Error in material search tool: ${error}`);
          return JSON.stringify({
            error: 'Failed to search materials',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    },
  });
}

export default createMaterialSearchTool;