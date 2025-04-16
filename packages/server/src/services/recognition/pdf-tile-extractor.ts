/**
 * PDF Tile Pattern Extractor - Specializes in extracting high-quality tile pattern images from PDFs
 * Handles various PDF quality issues and optimizes extraction for tile patterns.
 * Uses simulated library calls via ExternalLibraryManager.
 */

import { ExternalLibraryManager, libraryManager } from './external-library-integration';
import ImageQualityEvaluator, { QualityScores } from './image-quality-evaluator'; // Import evaluator

// Interfaces remain the same
export interface PDFExtractionOptions {
  targetDPI: number;
  enhanceResolution: boolean;
  detectRegions: boolean;
  maxPageLimit?: number;
  pageRanges?: number[]; // Specify specific pages or ranges, e.g., [1, 3, 5-7]
}

export interface PDFExtractionResult {
  images: Buffer[];
  metadata: PDFTileMetadata[];
  processingStats: {
    pagesProcessed: number;
    imagesExtracted: number;
    averageImageQuality: number; // Overall quality score average
    processingTimeMs: number;
  };
}

export interface PDFTileMetadata {
  pageNumber: number;
  regionId: string; // Unique ID for the region within the page
  rect: { x: number, y: number, width: number, height: number }; // Coordinates in PDF points
  dimensions?: { width: number; height: number; unit: string };
  specifications?: Record<string, string>;
  manufacturer?: string;
  productCode?: string;
  description?: string;
  extractedText?: string; // Text found near the region
}

// Define type for the simulated PDF structure
interface SimulatedPDFPage {
    pageNum: number;
    text: string;
    structures: Array<{ type: string, text: string, rect: any }>;
}
interface SimulatedPDFStructure {
    pageCount: number;
    pages: SimulatedPDFPage[];
}

// Define type for identified regions
interface IdentifiedRegion {
    pageNumber: number;
    regionId: string;
    rect: { x: number, y: number, width: number, height: number }; // PDF coordinates
    confidence: number; // Confidence score for being a tile pattern
}

export class PDFTileExtractor {
  private libraryManager: ExternalLibraryManager;
  private qualityEvaluator: ImageQualityEvaluator;

  constructor() {
    this.libraryManager = libraryManager;
    this.qualityEvaluator = new ImageQualityEvaluator(); // Use the separated evaluator
  }

  public async extractTilePatterns(
    pdfData: Buffer,
    options: Partial<PDFExtractionOptions> = {}
  ): Promise<PDFExtractionResult> {
    const startTime = Date.now();
    await this.libraryManager.initializeAll(); // Ensure libraries are ready

    const extractionOptions: PDFExtractionOptions = {
      targetDPI: options.targetDPI || 300,
      enhanceResolution: options.enhanceResolution !== false,
      detectRegions: options.detectRegions !== false,
      maxPageLimit: options.maxPageLimit || 50, // Limit pages for performance
      pageRanges: options.pageRanges // Allow specifying pages
    };

    let pagesProcessed = 0;
    const allExtractedImages: Buffer[] = [];
    const allMetadata: PDFTileMetadata[] = [];

    try {
      const pdfStructure = await this.parsePDFStructure(pdfData, extractionOptions);
      pagesProcessed = pdfStructure.pages.length;
      console.log(`[PDF Extractor] Parsed ${pagesProcessed} pages.`);

      if (pagesProcessed === 0) {
          throw new Error("No pages could be processed from the PDF.");
      }

      const tileRegions = await this.identifyTileRegions(pdfStructure, extractionOptions);
      console.log(`[PDF Extractor] Identified ${tileRegions.length} potential tile regions.`);

      if (tileRegions.length === 0 && extractionOptions.detectRegions) {
          console.warn("[PDF Extractor] No specific tile regions detected. Extraction might be less accurate.");
      }
      
      const { images, metadata } = await this.extractAndProcessRegions(
          pdfData, 
          pdfStructure, 
          tileRegions, 
          extractionOptions
      );
      allExtractedImages.push(...images);
      allMetadata.push(...metadata);

      const averageQuality = await this.calculateAverageQuality(allExtractedImages);

      const processingTimeMs = Date.now() - startTime;
      console.log(`[PDF Extractor] Extraction complete. Time: ${processingTimeMs}ms`);

      return {
        images: allExtractedImages,
        metadata: allMetadata,
        processingStats: {
          pagesProcessed,
          imagesExtracted: allExtractedImages.length,
          averageImageQuality: averageQuality,
          processingTimeMs
        }
      };
    } catch (error) {
      console.error('Error extracting tile patterns from PDF (Simulated):', error);
      return {
        images: [], metadata: [],
        processingStats: { pagesProcessed, imagesExtracted: 0, averageImageQuality: 0, processingTimeMs: Date.now() - startTime }
      };
    }
  }

  private async parsePDFStructure(pdfData: Buffer, options: PDFExtractionOptions): Promise<SimulatedPDFStructure> {
    console.log("[PDF Extractor] Parsing PDF structure (Simulated)...");
    const pdfIntegration = this.libraryManager.getPDF();
    const pageRangeOption = options.pageRanges ? [options.pageRanges[0], options.pageRanges[options.pageRanges.length - 1]] : undefined;
    const textResults = await pdfIntegration.extractText(pdfData, { pageRange: pageRangeOption as [number, number] | undefined });
    const limitedPages = options.maxPageLimit ? textResults.slice(0, options.maxPageLimit) : textResults;
    return {
        pageCount: textResults.length, 
        pages: limitedPages
    };
  }

  private async identifyTileRegions(pdfStructure: SimulatedPDFStructure, options: PDFExtractionOptions): Promise<IdentifiedRegion[]> {
    if (!options.detectRegions) {
        console.log("[PDF Extractor] Region detection skipped by options.");
        return []; 
    }

    console.log("[PDF Extractor] Identifying tile regions (Simulated CV/ML)...");
    const allRegions: IdentifiedRegion[] = [];
    const imageProc = this.libraryManager.getImageProcessing(); 

    for (const page of pdfStructure.pages) {
        console.log(` -> Analyzing page ${page.pageNum} for regions...`);
        let regionCount = 0;
        for (const structure of page.structures) {
            const isPotentialTile = structure.type === 'image' || 
                                   (structure.type === 'paragraph' && structure.text.toLowerCase().includes('tile'));
            
            if (isPotentialTile && structure.rect) {
                regionCount++;
                const regionId = `r${regionCount}p${page.pageNum}`;
                allRegions.push({
                    pageNumber: page.pageNum,
                    regionId: regionId,
                    rect: { 
                        x: structure.rect.x, y: structure.rect.y, 
                        width: structure.rect.width, height: structure.rect.height 
                    }, 
                    confidence: 0.7 + Math.random() * 0.2 
                });
                console.log(`    Found potential region ${regionId} at [${structure.rect.x}, ${structure.rect.y}]`);
            }
        }
    }
    return allRegions;
  }

  private async extractAndProcessRegions(
      pdfData: Buffer,
      pdfStructure: SimulatedPDFStructure,
      regions: IdentifiedRegion[],
      options: PDFExtractionOptions
  ): Promise<{ images: Buffer[], metadata: PDFTileMetadata[] }> {
      console.log("[PDF Extractor] Extracting and processing images from regions (Simulated)...");
      const pdfIntegration = this.libraryManager.getPDF();
      const imageProc = this.libraryManager.getImageProcessing();
      const extractedImages: Buffer[] = [];
      const associatedMetadata: PDFTileMetadata[] = [];

      const pagesToProcess = regions.length > 0 
          ? [...new Set(regions.map(r => r.pageNumber))] 
          : pdfStructure.pages.map(p => p.pageNum); 

      for (const pageNum of pagesToProcess) {
          const pageRegions = regions.filter(r => r.pageNumber === pageNum);
          
          const pageImagesData = await pdfIntegration.extractImages(pdfData, { 
              dpi: options.targetDPI, 
              pageRange: [pageNum, pageNum], 
              extractText: true 
          });

          for (const imgData of pageImagesData) {
              let currentImageBuffer = imgData.image;
              // Determine the region this image corresponds to (simplified logic)
              const regionMatch = pageRegions.length > 0 ? pageRegions[0] : undefined; 

              if (options.enhanceResolution) {
                  const estimatedQuality = await this.qualityEvaluator.evaluate(currentImageBuffer);
                  if (estimatedQuality.resolution < 0.7) { 
                      console.log(` -> Applying Super Resolution to image from page ${pageNum} (Region: ${regionMatch?.regionId ?? 'N/A'})`);
                      currentImageBuffer = await imageProc.applySuperResolution(currentImageBuffer);
                  }
              }
              
              console.log(` -> Applying Contrast Enhancement to image from page ${pageNum} (Region: ${regionMatch?.regionId ?? 'N/A'})`);
              currentImageBuffer = await imageProc.applyAdaptiveContrastEnhancement(currentImageBuffer);

              extractedImages.push(currentImageBuffer);
              
              // Correctly associate metadata
              if (regionMatch) {
                  // Pass the confirmed IdentifiedRegion
                  const metadata = await this.extractMetadataForRegion(pdfStructure, regionMatch, imgData.text);
                  associatedMetadata.push(metadata); 
              } else {
                   // Create metadata for the full page if no specific region matched
                   const fullPageMetadata: PDFTileMetadata = { 
                       pageNumber: pageNum, 
                       regionId: `page${pageNum}_full`, 
                       rect: { x:0, y:0, width: imgData.width, height: imgData.height },
                       extractedText: imgData.text?.substring(0, 200) + '...'
                   };
                   associatedMetadata.push(fullPageMetadata); 
              }
              // Removed the incorrect push outside the if/else
          }
      }

      return { images: extractedImages, metadata: associatedMetadata };
  }

  private async extractMetadataForRegion(
      pdfStructure: SimulatedPDFStructure, 
      region: IdentifiedRegion, // Parameter is now guaranteed to be IdentifiedRegion
      nearbyText?: string 
  ): Promise<PDFTileMetadata> {
      console.log(` -> Extracting metadata for region ${region.regionId} on page ${region.pageNumber} (Simulated Text Analysis)...`);
      
      const pageData = pdfStructure.pages.find(p => p.pageNum === region.pageNumber);
      const fullPageText = pageData ? pageData.text : (nearbyText || '');

      const metadata: PDFTileMetadata = {
          pageNumber: region.pageNumber,
          regionId: region.regionId,
          rect: region.rect,
          extractedText: fullPageText.substring(0, 200) + '...' 
      };

      const dimMatch = fullPageText.match(/(\d+(\.\d+)?)\s?x\s?(\d+(\.\d+)?)\s?(cm|mm|inch|"|')/i);
      // Add checks for capture groups before parsing
      if (dimMatch && dimMatch[1] && dimMatch[3]) { 
          metadata.dimensions = { 
              width: parseFloat(dimMatch[1]), 
              height: parseFloat(dimMatch[3]), 
              unit: dimMatch[5] || 'unknown' 
          };
          console.log(`    Found dimensions: ${metadata.dimensions.width}x${metadata.dimensions.height} ${metadata.dimensions.unit}`);
      }

      metadata.specifications = {};
      if (fullPageText.toLowerCase().includes('ceramic')) metadata.specifications['Material'] = 'Ceramic';
      if (fullPageText.toLowerCase().includes('porcelain')) metadata.specifications['Material'] = 'Porcelain';
      if (fullPageText.toLowerCase().includes('matte')) metadata.specifications['Finish'] = 'Matte';
      if (fullPageText.toLowerCase().includes('glossy')) metadata.specifications['Finish'] = 'Glossy';
      if (Object.keys(metadata.specifications).length > 0) {
          console.log(`    Found specifications:`, metadata.specifications);
      }
      
      const codeMatch = fullPageText.match(/Code:\s*([A-Z0-9-]+)/i);
      if (codeMatch && codeMatch[1]) { // Check capture group
          metadata.productCode = codeMatch[1];
          metadata.manufacturer = "SimulatedCorp"; 
          console.log(`    Found Product Code: ${metadata.productCode}`);
      }

      return metadata;
  }

  private async calculateAverageQuality(images: Buffer[]): Promise<number> {
    if (images.length === 0) return 0;
    let totalQuality = 0;
    let evaluatedCount = 0;
    const sampleSize = Math.min(images.length, 10); 
    const step = Math.max(1, Math.floor(images.length / sampleSize));

    for (let i = 0; i < images.length; i += step) {
        const currentImage = images[i]; 
        if (currentImage) { // Check buffer exists
            const qualityScores = await this.qualityEvaluator.evaluate(currentImage);
            totalQuality += qualityScores.overall;
            evaluatedCount++;
        }
    }
    return evaluatedCount > 0 ? parseFloat((totalQuality / evaluatedCount).toFixed(2)) : 0;
  }
}

export default PDFTileExtractor;