import sharp from 'sharp';

/**
 * Get image dimensions
 * 
 * @param filePath Path to the image file
 * @returns Object with width and height
 */
export async function getImageDimensions(filePath: string): Promise<{ width: number; height: number }> {
  try {
    const metadata = await sharp(filePath).metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Could not determine image dimensions');
    }
    
    return {
      width: metadata.width,
      height: metadata.height
    };
  } catch (error) {
    throw new Error(`Failed to get image dimensions: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Resize an image
 * 
 * @param filePath Path to the image file
 * @param outputPath Path to save the resized image
 * @param width Target width
 * @param height Target height
 * @returns Path to the resized image
 */
export async function resizeImage(
  filePath: string,
  outputPath: string,
  width: number,
  height: number
): Promise<string> {
  try {
    await sharp(filePath)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFile(outputPath);
    
    return outputPath;
  } catch (error) {
    throw new Error(`Failed to resize image: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create a thumbnail from an image
 * 
 * @param filePath Path to the image file
 * @param outputPath Path to save the thumbnail
 * @param size Thumbnail size (width and height)
 * @returns Path to the thumbnail
 */
export async function createThumbnail(
  filePath: string,
  outputPath: string,
  size: number = 200
): Promise<string> {
  try {
    await sharp(filePath)
      .resize(size, size, {
        fit: 'cover',
        position: 'centre'
      })
      .toFile(outputPath);
    
    return outputPath;
  } catch (error) {
    throw new Error(`Failed to create thumbnail: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Optimize an image for web
 * 
 * @param filePath Path to the image file
 * @param outputPath Path to save the optimized image
 * @param quality JPEG/WebP quality (1-100)
 * @returns Path to the optimized image
 */
export async function optimizeImage(
  filePath: string,
  outputPath: string,
  quality: number = 80
): Promise<string> {
  try {
    await sharp(filePath)
      .jpeg({ quality })
      .toFile(outputPath);
    
    return outputPath;
  } catch (error) {
    throw new Error(`Failed to optimize image: ${error instanceof Error ? error.message : String(error)}`);
  }
}
