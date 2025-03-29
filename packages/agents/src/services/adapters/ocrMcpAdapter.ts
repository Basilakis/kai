/**
 * OCR MCP Adapter
 * 
 * This adapter provides integration with the MCP server for OCR operations.
 * It allows OCR processing to be offloaded to the MCP server for improved
 * performance and resource efficiency.
 * 
 * Note: This adapter only provides MCP integration and does not include
 * local implementation fallbacks. The actual OCR service is located in
 * packages/server/src/services/pdf/ocrService.ts and would need to be
 * adapted separately for complete integration.
 */

import { createLogger } from '../../utils/logger';
import { 
  isMCPEnabledForComponent, 
  callMCPEndpoint
} from '../../utils/mcpIntegration';

// Create a logger for the adapter
const logger = createLogger('OCRMcpAdapter');

/**
 * OCR parameters interface
 */
export interface OCRParams {
  documentPath: string;
  languages?: string[];
  enhancedMode?: boolean;
  detectHandwriting?: boolean;
  extractForms?: boolean;
  regionBasedProcessing?: boolean;
}

/**
 * OCR result interface
 */
export interface OCRResult {
  text: string;
  pages: OCRPage[];
  confidence: number;
  language: string;
  processingTime: number;
}

/**
 * OCR page interface
 */
export interface OCRPage {
  pageNumber: number;
  text: string;
  tables: OCRTable[];
  formFields: OCRFormField[];
  handwrittenRegions?: OCRHandwrittenRegion[];
}

/**
 * OCR table interface
 */
export interface OCRTable {
  rows: string[][];
  confidence: number;
}

/**
 * OCR form field interface
 */
export interface OCRFormField {
  name: string;
  value: string;
  confidence: number;
}

/**
 * OCR handwritten region interface
 */
export interface OCRHandwrittenRegion {
  text: string;
  confidence: number;
}

/**
 * Process a document with OCR using MCP server
 * 
 * @param params OCR processing parameters
 * @returns OCR processing result
 * @throws Error if MCP is not enabled or available
 */
export async function processDocument(params: OCRParams): Promise<OCRResult> {
  if (!isMcpEnabledForOCR()) {
    throw new Error('OCR MCP is not enabled');
  }
  
  logger.debug('Processing document with OCR via MCP');
  return callMCPEndpoint<OCRResult>('ocr', 'processDocument', params);
}

/**
 * Extract text from a specific region of a document using MCP server
 * 
 * @param documentPath Path to the document
 * @param region Region coordinates [x, y, width, height]
 * @param page Page number (optional, defaults to 1)
 * @returns Extracted text and confidence
 * @throws Error if MCP is not enabled or available
 */
export async function extractTextFromRegion(
  documentPath: string,
  region: [number, number, number, number],
  page: number = 1
): Promise<{ text: string; confidence: number }> {
  if (!isMcpEnabledForOCR()) {
    throw new Error('OCR MCP is not enabled');
  }
  
  logger.debug(`Extracting text from region on page ${page} via MCP`);
  return callMCPEndpoint<{ text: string; confidence: number }>('ocr', 'extractTextFromRegion', {
    documentPath,
    region,
    page
  });
}

/**
 * Detect and extract tables from a document using MCP server
 * 
 * @param documentPath Path to the document
 * @param pages Page numbers to process (optional, processes all pages if not provided)
 * @returns Extracted tables by page
 * @throws Error if MCP is not enabled or available
 */
export async function extractTables(
  documentPath: string,
  pages?: number[]
): Promise<Record<number, OCRTable[]>> {
  if (!isMcpEnabledForOCR()) {
    throw new Error('OCR MCP is not enabled');
  }
  
  logger.debug('Extracting tables via MCP');
  return callMCPEndpoint<Record<number, OCRTable[]>>('ocr', 'extractTables', {
    documentPath,
    pages
  });
}

/**
 * Detect and extract form fields from a document using MCP server
 * 
 * @param documentPath Path to the document
 * @param pages Page numbers to process (optional, processes all pages if not provided)
 * @returns Extracted form fields by page
 * @throws Error if MCP is not enabled or available
 */
export async function extractFormFields(
  documentPath: string,
  pages?: number[]
): Promise<Record<number, OCRFormField[]>> {
  if (!isMcpEnabledForOCR()) {
    throw new Error('OCR MCP is not enabled');
  }
  
  logger.debug('Extracting form fields via MCP');
  return callMCPEndpoint<Record<number, OCRFormField[]>>('ocr', 'extractFormFields', {
    documentPath,
    pages
  });
}

/**
 * Detect and recognize handwritten text in a document using MCP server
 * 
 * @param documentPath Path to the document
 * @param pages Page numbers to process (optional, processes all pages if not provided)
 * @returns Recognized handwritten text by page
 * @throws Error if MCP is not enabled or available
 */
export async function recognizeHandwriting(
  documentPath: string,
  pages?: number[]
): Promise<Record<number, OCRHandwrittenRegion[]>> {
  if (!isMcpEnabledForOCR()) {
    throw new Error('OCR MCP is not enabled');
  }
  
  logger.debug('Recognizing handwriting via MCP');
  return callMCPEndpoint<Record<number, OCRHandwrittenRegion[]>>('ocr', 'recognizeHandwriting', {
    documentPath,
    pages
  });
}

/**
 * Check if MCP is enabled for OCR
 * 
 * @returns True if MCP is enabled for OCR
 */
export function isMcpEnabledForOCR(): boolean {
  return isMCPEnabledForComponent('ocr');
}

/**
 * Initialize the OCR MCP adapter
 * This can be called at startup to prepare the adapter
 * 
 * @returns Promise that resolves when initialization is complete
 */
export async function initializeOcrMcpAdapter(): Promise<boolean> {
  if (isMcpEnabledForOCR()) {
    logger.info('Initializing OCR MCP adapter');
    
    try {
      // We'll perform a simple test to see if the MCP server can handle OCR requests
      // by getting the OCR capabilities
      const testResult = await callMCPEndpoint<{ available: boolean; capabilities: string[] }>('ocr', 'getCapabilities', {})
        .catch(error => {
          logger.warn(`OCR MCP test failed: ${error}`);
          return null;
        });
      
      if (testResult && testResult.available) {
        logger.info('OCR MCP adapter initialized successfully');
        logger.info(`Available OCR capabilities through MCP: ${testResult.capabilities.join(', ')}`);
        return true;
      } else {
        logger.warn('OCR MCP adapter initialization failed');
        return false;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error initializing OCR MCP adapter: ${errorMessage}`);
      return false;
    }
  } else {
    logger.info('OCR MCP adapter is disabled');
    return false;
  }
}

/**
 * Integration note:
 * 
 * To fully integrate with the existing OCR service (packages/server/src/services/pdf/ocrService.ts),
 * a bridge component would need to be created that:
 * 
 * 1. Imports the actual OCR service
 * 2. Wraps its functionality with MCP fallback logic
 * 3. Exposes a unified interface that works with both MCP and local implementation
 * 
 * This adapter currently only provides the MCP integration side, focusing on
 * demonstrating how OCR processing can be moved to an MCP server.
 */

export default {
  processDocument,
  extractTextFromRegion,
  extractTables,
  extractFormFields,
  recognizeHandwriting,
  isMcpEnabledForOCR,
  initializeOcrMcpAdapter
};