/**
 * Check Unregistered Endpoints Script
 * 
 * This script scans the codebase for API endpoints and checks if they are
 * registered in the network access control system.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { supabase } from '../config/supabase';

// Directories to scan for route files
const ROUTES_DIRS = [
  path.join(__dirname, '../../src/routes'),
  path.join(__dirname, '../../src/routes/admin'),
  path.join(__dirname, '../../src/routes/analytics'),
  path.join(__dirname, '../../src/routes/api'),
  path.join(__dirname, '../../src/routes/auth'),
  path.join(__dirname, '../../src/routes/user'),
  path.join(__dirname, '../../src/controllers'),
  path.join(__dirname, '../../src/services'),
  path.join(__dirname, '../../src/middleware')
];

// Patterns to identify route definitions
const ROUTE_PATTERNS = [
  /router\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g,
  /app\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g,
  /\@route\s+([A-Z]+)\s+([^\s]+)/g,
  /express\.Router\(\)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g,
  /router\s*\.\s*(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g,
  /app\s*\.\s*(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g,
  /\s*(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g
];

/**
 * Extract API endpoints from route files
 */
async function extractApiEndpoints() {
  logger.info('Extracting API endpoints from route files...');
  
  const endpoints = new Set<string>();
  
  // Scan route files
  for (const dir of ROUTES_DIRS) {
    if (!fs.existsSync(dir)) {
      logger.warn(`Directory does not exist: ${dir}`);
      continue;
    }
    
    const files = await scanDirectory(dir);
    
    for (const file of files) {
      if (!file.endsWith('.ts') && !file.endsWith('.js')) {
        continue;
      }
      
      const content = fs.readFileSync(file, 'utf8');
      
      // Extract endpoints using patterns
      for (const pattern of ROUTE_PATTERNS) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          if (match.length >= 3) {
            const method = match[1].toUpperCase();
            const path = match[2];
            endpoints.add(`${method}:${path}`);
          } else if (match.length >= 2) {
            // For JSDoc @route pattern
            if (pattern.toString().includes('@route')) {
              const method = match[1].toUpperCase();
              const path = match[2];
              endpoints.add(`${method}:${path}`);
            } else {
              const routeInfo = match[1].split(' ');
              if (routeInfo.length >= 2) {
                const method = routeInfo[0].toUpperCase();
                const path = routeInfo[1];
                endpoints.add(`${method}:${path}`);
              }
            }
          }
        }
      }
      
      // Look for controller methods that might be routes
      if (file.includes('controller') || file.includes('routes')) {
        // Look for methods that might be route handlers
        const methodPatterns = [
          /async\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*{/g,
          /function\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*{/g,
          /const\s+([a-zA-Z0-9_]+)\s*=\s*async\s*\([^)]*\)\s*=>\s*{/g,
          /const\s+([a-zA-Z0-9_]+)\s*=\s*\([^)]*\)\s*=>\s*{/g
        ];
        
        for (const pattern of methodPatterns) {
          const matches = content.matchAll(pattern);
          for (const match of matches) {
            if (match.length >= 2) {
              const methodName = match[1];
              
              // Look for route comments above the method
              const methodIndex = content.indexOf(match[0]);
              const beforeMethod = content.substring(Math.max(0, methodIndex - 500), methodIndex);
              
              const routeCommentPattern = /\*\s*@route\s+([A-Z]+)\s+([^\s\*]+)/g;
              const routeMatches = beforeMethod.matchAll(routeCommentPattern);
              
              for (const routeMatch of routeMatches) {
                if (routeMatch.length >= 3) {
                  const method = routeMatch[1].toUpperCase();
                  const path = routeMatch[2];
                  endpoints.add(`${method}:${path}`);
                }
              }
            }
          }
        }
      }
    }
  }
  
  logger.info(`Found ${endpoints.size} API endpoints in route files`);
  return Array.from(endpoints);
}

/**
 * Scan directory recursively for files
 */
async function scanDirectory(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      const subFiles = await scanDirectory(fullPath);
      files.push(...subFiles);
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Get registered endpoints from the database
 */
async function getRegisteredEndpoints() {
  logger.info('Getting registered endpoints from the database...');
  
  const { data, error } = await supabase
    .from('network_access_endpoints')
    .select('method, path');
  
  if (error) {
    logger.error('Error fetching registered endpoints:', error);
    throw error;
  }
  
  const endpoints = new Set<string>();
  
  for (const endpoint of data || []) {
    endpoints.add(`${endpoint.method}:${endpoint.path}`);
  }
  
  logger.info(`Found ${endpoints.size} registered endpoints in the database`);
  return endpoints;
}

/**
 * Check for unregistered endpoints
 */
async function checkUnregisteredEndpoints() {
  try {
    // Extract API endpoints from route files
    const extractedEndpoints = await extractApiEndpoints();
    
    // Get registered endpoints from the database
    const registeredEndpoints = await getRegisteredEndpoints();
    
    // Find unregistered endpoints
    const unregisteredEndpoints = extractedEndpoints.filter(endpoint => !registeredEndpoints.has(endpoint));
    
    if (unregisteredEndpoints.length > 0) {
      logger.warn(`Found ${unregisteredEndpoints.length} unregistered API endpoints:`);
      
      // Format the unregistered endpoints for display
      const formattedEndpoints = [];
      
      for (const endpoint of unregisteredEndpoints) {
        const [method, path] = endpoint.split(':');
        const formattedEndpoint = `${method} ${path}`;
        formattedEndpoints.push(formattedEndpoint);
        logger.warn(`  ${formattedEndpoint}`);
      }
      
      logger.info('To register these endpoints, add them to the network access control system.');
      
      return formattedEndpoints;
    } else {
      logger.info('All API endpoints are properly registered in the network access control system.');
      return [];
    }
  } catch (error) {
    logger.error('Error checking unregistered endpoints:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await checkUnregisteredEndpoints();
  } catch (error) {
    logger.error('Unhandled error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}

export default checkUnregisteredEndpoints;
