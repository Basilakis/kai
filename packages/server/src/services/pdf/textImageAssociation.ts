/**
 * Text-Image Association Analyzer
 * 
 * This module provides specialized functions for analyzing and associating text blocks with
 * nearby images in PDF catalogs, improving the accuracy of extracting specifications
 * that are adjacent to product images.
 */

import { logger } from '../../utils/logger';
import { TextBlock, TextBlockType } from './regionBasedOCR';
import * as path from 'path';

/**
 * Position and size of an image within a document
 */
export interface ImagePosition {
  /** ID of the image */
  imageId: string;
  /** Path to the image file */
  imagePath: string;
  /** Page number (0-based) */
  page: number;
  /** Left position (in points) */
  x: number;
  /** Top position (in points) */
  y: number;
  /** Width of the image (in points) */
  width: number;
  /** Height of the image (in points) */
  height: number;
}

/**
 * Position and content of a text block within a document
 */
export interface TextPosition {
  /** Content of the text block */
  text: string;
  /** Page number (0-based) */
  page: number;
  /** Left position (in points) */
  x: number;
  /** Top position (in points) */
  y: number;
  /** Width of the text block (in points) */
  width: number;
  /** Height of the text block (in points) */
  height: number;
  /** Type of text (heading, paragraph, specification, etc.) */
  blockType: TextBlockType;
}

/**
 * Association between an image and related text blocks
 */
export interface ImageTextAssociation {
  /** The image information */
  image: ImagePosition;
  /** Text blocks associated with this image */
  relatedTexts: TextPosition[];
  /** Specification key-value pairs extracted from the text */
  specifications: Record<string, string>;
  /** Confidence level of the association (0-100) */
  confidence: number;
}

/**
 * Associate text blocks with nearby images based on spatial relationships
 * 
 * This algorithm analyzes the spatial relationships between images and text blocks
 * to determine which text blocks are likely associated with each image. The association
 * is based on proximity, layout analysis, and typical catalog patterns.
 * 
 * @param images Array of image positions
 * @param textBlocks Array of text block positions
 * @returns Associations between images and related text blocks
 */
export function associateTextWithImages(
  images: ImagePosition[],
  textBlocks: TextPosition[]
): ImageTextAssociation[] {
  const associations: ImageTextAssociation[] = [];
  
  // Process each image to find associated text blocks
  for (const image of images) {
    // Get text blocks on the same page
    const samePageTexts = textBlocks.filter(text => text.page === image.page);
    if (samePageTexts.length === 0) {
      continue;
    }
    
    // Identify text blocks nearby the image using multiple methods
    const relatedTexts = findRelatedTextBlocks(image, samePageTexts);
    
    // Extract specifications from the related text blocks
    const specifications = extractSpecifications(relatedTexts);
    
    // Calculate confidence based on proximity and content
    const confidence = calculateAssociationConfidence(image, relatedTexts);
    
    associations.push({
      image,
      relatedTexts,
      specifications,
      confidence
    });
  }
  
  // Sort associations by confidence (highest first)
  return associations.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Find text blocks related to an image using multiple heuristics
 * 
 * @param image The image to analyze
 * @param textBlocks Available text blocks on the same page
 * @returns Array of text blocks likely associated with the image
 */
function findRelatedTextBlocks(
  image: ImagePosition,
  textBlocks: TextPosition[]
): TextPosition[] {
  // Combine several approaches for better accuracy
  const relatedTexts: TextPosition[] = [];
  
  // METHOD 1: PROXIMITY - Find text blocks close to the image
  const proximityCandidates = findTextByProximity(image, textBlocks);
  relatedTexts.push(...proximityCandidates);
  
  // METHOD 2: LAYOUT - Find text blocks in typical catalog layout positions
  const layoutCandidates = findTextByLayout(image, textBlocks);
  
  // Add layout candidates that aren't already in the proximity candidates
  for (const candidate of layoutCandidates) {
    if (!relatedTexts.some(text => text.text === candidate.text)) {
      relatedTexts.push(candidate);
    }
  }
  
  // METHOD 3: CONTENT - Find specification-like text anywhere on the page
  const specificationBlocks = textBlocks.filter(
    text => text.blockType === TextBlockType.SPECIFICATION &&
    !relatedTexts.some(related => related.text === text.text)
  );
  
  // For specifications, only include those most likely related to this image
  const imageBasename = path.basename(image.imagePath, path.extname(image.imagePath));
  const relatedSpecs = specificationBlocks.filter(spec => {
    // If the specification mentions the image name, it's likely related
    if (spec.text.toLowerCase().includes(imageBasename.toLowerCase())) {
      return true;
    }
    
    // Check if the specification is within a reasonable distance
    const distance = calculateDistance(image, spec);
    return distance < 300; // Within 300 points (adjust as needed)
  });
  
  relatedTexts.push(...relatedSpecs);
  
  return relatedTexts;
}

/**
 * Find text blocks close to an image based on proximity
 * 
 * @param image The image to analyze
 * @param textBlocks Available text blocks
 * @returns Array of nearby text blocks
 */
function findTextByProximity(
  image: ImagePosition,
  textBlocks: TextPosition[]
): TextPosition[] {
  // Calculate distances from the image to each text block
  const textWithDistances = textBlocks.map(text => ({
    text,
    distance: calculateDistance(image, text)
  }));
  
  // Sort by distance (closest first)
  textWithDistances.sort((a, b) => a.distance - b.distance);
  
  // Take the closest text blocks (up to a certain distance threshold)
  const MAX_DISTANCE = 200; // Maximum distance in points
  const candidates = textWithDistances
    .filter(item => item.distance <= MAX_DISTANCE)
    .map(item => item.text);
  
  return candidates;
}

/**
 * Find text blocks based on typical catalog layout patterns
 * 
 * @param image The image to analyze
 * @param textBlocks Available text blocks
 * @returns Array of text blocks in typical layout positions
 */
function findTextByLayout(
  image: ImagePosition,
  textBlocks: TextPosition[]
): TextPosition[] {
  const candidates: TextPosition[] = [];
  
  // PATTERN 1: Text below the image (common for specifications)
  const textsBelow = textBlocks.filter(text => 
    text.y > image.y + image.height && // Below the image
    text.x < image.x + image.width && // Horizontally overlapping
    text.x + text.width > image.x &&
    text.y - (image.y + image.height) < 100 // Within 100 points below
  );
  
  candidates.push(...textsBelow);
  
  // PATTERN 2: Text above the image (common for titles/headings)
  const textsAbove = textBlocks.filter(text => 
    text.y + text.height < image.y && // Above the image
    text.x < image.x + image.width && // Horizontally overlapping
    text.x + text.width > image.x &&
    image.y - (text.y + text.height) < 50 && // Within 50 points above
    (text.blockType === TextBlockType.HEADING || // Must be heading or specification
     text.blockType === TextBlockType.SPECIFICATION)
  );
  
  candidates.push(...textsAbove);
  
  // PATTERN 3: Text to the right of the image (common in some catalogs)
  const textsRight = textBlocks.filter(text => 
    text.x > image.x + image.width && // To the right
    text.y < image.y + image.height && // Vertically overlapping
    text.y + text.height > image.y &&
    text.x - (image.x + image.width) < 100 // Within 100 points to the right
  );
  
  candidates.push(...textsRight);
  
  // PATTERN 4: Text to the left of the image (less common but possible)
  const textsLeft = textBlocks.filter(text => 
    text.x + text.width < image.x && // To the left
    text.y < image.y + image.height && // Vertically overlapping
    text.y + text.height > image.y &&
    image.x - (text.x + text.width) < 100 // Within 100 points to the left
  );
  
  candidates.push(...textsLeft);
  
  return candidates;
}

/**
 * Calculate distance between an image and a text block
 * 
 * @param image The image
 * @param text The text block
 * @returns Distance in points
 */
function calculateDistance(
  image: ImagePosition,
  text: TextPosition
): number {
  // Calculate the center points
  const imageCenter = {
    x: image.x + image.width / 2,
    y: image.y + image.height / 2
  };
  
  const textCenter = {
    x: text.x + text.width / 2,
    y: text.y + text.height / 2
  };
  
  // Calculate Euclidean distance between centers
  const dx = imageCenter.x - textCenter.x;
  const dy = imageCenter.y - textCenter.y;
  
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Extract specifications from text blocks
 * 
 * @param textBlocks Text blocks to analyze
 * @returns Extracted specifications as key-value pairs
 */
function extractSpecifications(
  textBlocks: TextPosition[]
): Record<string, string> {
  const specifications: Record<string, string> = {};
  
  // Sort blocks by Y position (top to bottom)
  const sortedBlocks = [...textBlocks].sort((a, b) => a.y - b.y);
  
  // First, look for heading blocks (likely product name/title)
  const headingBlocks = sortedBlocks.filter(
    block => block.blockType === TextBlockType.HEADING
  );
  
  if (headingBlocks.length > 0) {
    // TypeScript doesn't recognize that this check ensures headingBlocks[0] exists
    specifications['name'] = headingBlocks[0]?.text.trim() || '';
  }
  
  // Process each text block for specifications
  for (const block of sortedBlocks) {
    // Skip if already used as name
    if (headingBlocks.length > 0 && block === headingBlocks[0]) {
      continue;
    }
    
    // Try to extract key-value pairs from specification blocks
    if (block.blockType === TextBlockType.SPECIFICATION) {
      // Pattern 1: "Key: Value" format
      const keyValueMatch = block.text.match(/^([^:]+):(.+)$/);
      if (keyValueMatch && keyValueMatch[1] && keyValueMatch[2]) {
        const key = keyValueMatch[1].trim().toLowerCase();
        const value = keyValueMatch[2].trim();
        specifications[key] = value;
        continue;
      }
      
      // Pattern 2: Dimension format (e.g., "60x60cm")
      const dimensionsMatch = block.text.match(/^([0-9]+\.?[0-9]*)\s*[xX]\s*([0-9]+\.?[0-9]*)\s*(mm|cm|m|in|ft)/);
      if (dimensionsMatch) {
        specifications['dimensions'] = block.text.trim();
        continue;
      }
      
      // Pattern 3: Technical specifications
      if (/^r[0-9]+\b/i.test(block.text)) { // R-values (R9, R10, etc.)
        specifications['slip resistance'] = block.text.trim();
      } else if (/^pei\s+[i-v]+/i.test(block.text)) { // PEI ratings
        specifications['abrasion resistance'] = block.text.trim();
      } else if (/^(matte|glossy|polished|honed|brushed|textured|natural|rustic)/i.test(block.text)) {
        specifications['finish'] = block.text.trim();
      } else if (/^(porcelain|ceramic|natural stone|marble|granite|limestone|travertine|slate|quartzite|onyx)/i.test(block.text)) {
        specifications['material'] = block.text.trim();
      } else if (/\b(wall|floor|outdoor|indoor|bathroom|kitchen|living room|commercial)\b/i.test(block.text)) {
        specifications['usage'] = block.text.trim();
      }
    }
  }
  
  return specifications;
}

/**
 * Calculate confidence level for an image-text association
 * 
 * @param image The image
 * @param relatedTexts Related text blocks
 * @returns Confidence score (0-100)
 */
function calculateAssociationConfidence(
  image: ImagePosition,
  relatedTexts: TextPosition[]
): number {
  if (relatedTexts.length === 0) {
    return 0;
  }
  
  let totalScore = 0;
  
  // FACTOR 1: Proximity score (40%)
  const distances = relatedTexts.map(text => calculateDistance(image, text));
  const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
  const maxReasonableDistance = 300; // points
  const proximityScore = Math.max(0, 40 * (1 - avgDistance / maxReasonableDistance));
  
  totalScore += proximityScore;
  
  // FACTOR 2: Content relevance score (30%)
  const imageBasename = path.basename(image.imagePath, path.extname(image.imagePath));
  const specCount = relatedTexts.filter(text => text.blockType === TextBlockType.SPECIFICATION).length;
  const specScore = Math.min(30, specCount * 5); // 5 points per specification, max 30
  
  totalScore += specScore;
  
  // FACTOR 3: Layout pattern score (30%)
  const hasTextBelow = relatedTexts.some(text => text.y > image.y + image.height);
  const hasTextAbove = relatedTexts.some(text => text.y + text.height < image.y);
  const hasHeading = relatedTexts.some(text => text.blockType === TextBlockType.HEADING);
  
  let layoutScore = 0;
  if (hasTextBelow) layoutScore += 15; // Text below is very common
  if (hasTextAbove && hasHeading) layoutScore += 10; // Heading above is common
  if (hasHeading) layoutScore += 5; // Having any heading is good
  
  totalScore += layoutScore;
  
  return Math.min(100, totalScore);
}

/**
 * Process a catalog page to associate images with their specifications
 * 
 * @param imagePaths Array of image file paths
 * @param imagePositions Array of image positions on the page
 * @param ocrResults OCR results containing text blocks
 * @returns Associations between images and specifications
 */
export async function processCatalogPage(
  imagePaths: string[],
  imagePositions: { x: number; y: number; width: number; height: number; page: number }[],
  ocrResults: TextBlock[]
): Promise<ImageTextAssociation[]> {
  logger.info(`Processing catalog page with ${imagePaths.length} images and ${ocrResults.length} text blocks`);
  
  // Convert data to required format
  const images: ImagePosition[] = imagePaths.map((path, index) => {
    // Ensure imagePositions exists at this index
    if (index >= imagePositions.length) {
      logger.warn(`Missing position data for image at index ${index}, using defaults`);
      return {
        imageId: `img_${index}`,
        imagePath: path,
        page: 0,
        x: 0,
        y: 0,
        width: 100,
        height: 100
      };
    }
    
    return {
      imageId: `img_${index}`,
      imagePath: path,
      // Use non-null assertion since we've verified index is within bounds above
      page: imagePositions[index]!.page,
      x: imagePositions[index]!.x,
      y: imagePositions[index]!.y,
      width: imagePositions[index]!.width,
      height: imagePositions[index]!.height
    };
  });
  
  const textBlocks: TextPosition[] = ocrResults.map(block => ({
    text: block.text,
    page: 0, // Assume all on the same page for simplicity
    x: block.coordinates.left,
    y: block.coordinates.top,
    width: block.coordinates.width,
    height: block.coordinates.height,
    blockType: block.blockType
  }));
  
  // Associate text with images
  const associations = associateTextWithImages(images, textBlocks);
  
  // Filter out low-confidence associations
  const MIN_CONFIDENCE = 40;
  const validAssociations = associations.filter(assoc => assoc.confidence >= MIN_CONFIDENCE);
  
  logger.info(`Found ${validAssociations.length} valid image-specification associations`);
  
  return validAssociations;
}

/**
 * Determine if text is likely a heading for an image
 * 
 * @param text The text block
 * @param image The image
 * @returns True if the text is likely a heading for the image
 */
export function isLikelyHeadingFor(text: TextPosition, image: ImagePosition): boolean {
  // Headings are usually above the image and horizontally aligned
  const isAbove = text.y + text.height < image.y;
  const isAligned = text.x < image.x + image.width && text.x + text.width > image.x;
  const isClose = image.y - (text.y + text.height) < 50; // Within 50 points
  
  return isAbove && isAligned && isClose && text.blockType === TextBlockType.HEADING;
}

/**
 * Determine if text is likely a specification for an image
 * 
 * @param text The text block
 * @param image The image
 * @returns True if the text is likely a specification for the image
 */
export function isLikelySpecificationFor(text: TextPosition, image: ImagePosition): boolean {
  // Specifications are usually below the image or to the right
  const isBelow = text.y > image.y + image.height && 
                 text.x < image.x + image.width && 
                 text.x + text.width > image.x;
                 
  const isRight = text.x > image.x + image.width && 
                 text.y < image.y + image.height && 
                 text.y + text.height > image.y;
                 
  const isClose = (isBelow && text.y - (image.y + image.height) < 100) || 
                 (isRight && text.x - (image.x + image.width) < 100);
  
  return (isBelow || isRight) && isClose && text.blockType === TextBlockType.SPECIFICATION;
}