/**
 * This is a simple test file to verify that TypeScript integration is working correctly.
 * It imports all the necessary components to trigger TypeScript checking.
 */

import { extractFromPDF, PDFExtractionResult, PDFExtractionOptions, PDFExtractedImage } from '@kai/ml';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { processPdfCatalog } from '../services/pdf/pdfProcessor';

// Mock function to test TypeScript integration
async function testIntegration(): Promise<void> {
  // Test path module - using relative path instead of process.cwd()
  const testPath = path.join('./temp', 'test'); // Relative to server root
  
  // Test fs module
  if (!fs.existsSync(testPath)) {
    fs.mkdirSync(testPath, { recursive: true });
  }
  
  // Test uuid module
  const id = uuidv4();
  
  // Test ML integration
  const options: PDFExtractionOptions = {
    outputDir: testPath,
    extractText: true,
    extractImages: true,
    imageFormat: 'jpg',
    imageQuality: 90
  };
  
  try {
    // This won't actually run, just testing TypeScript integration
    const result = await extractFromPDF('test.pdf', options);
    console.log(`Extracted ${result.images.length} images`);
    
    // Test processPdfCatalog function
    await processPdfCatalog('test.pdf', {
      userId: id,
      catalogName: 'Test Catalog'
    });
    
    console.log('Integration test successful!');
  } catch (error) {
    console.error('Integration test failed:', error);
  }
}

// Export the test function
export default testIntegration;