/**
 * Multi-Modal Search Controller
 * 
 * This controller provides API endpoints for multi-modal search functionality,
 * allowing users to search using a combination of text and image inputs.
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/error.middleware';
import { multiModalSearchService } from '../services/search/multi-modal-search-service';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed') as any, false);
    }
  }
});

/**
 * Perform multi-modal search with text and/or image
 * 
 * @route POST /api/search/multi-modal
 */
export const performMultiModalSearch = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    // Get text query from request body
    const { 
      textQuery,
      materialType,
      limit,
      skip,
      threshold,
      textWeight,
      imageWeight,
      includeKnowledge,
      includeRelationships,
      filters
    } = req.body;
    
    // Get image from request (if provided)
    let imageBase64: string | undefined;
    let imagePath: string | undefined;
    
    if (req.file) {
      // Save uploaded file to temp directory
      const tempFilePath = path.join(os.tmpdir(), `${uuidv4()}-${req.file.originalname}`);
      fs.writeFileSync(tempFilePath, req.file.buffer);
      imagePath = tempFilePath;
    } else if (req.body.imageBase64) {
      // Use base64 image data from request body
      imageBase64 = req.body.imageBase64;
    } else if (req.body.imageUrl) {
      // Use image URL from request body
      const imageUrl = req.body.imageUrl;
      
      // Perform search with at least one modality
      const results = await multiModalSearchService.search(
        {
          textQuery,
          imageUrl,
          materialType,
          limit: limit ? parseInt(limit) : undefined,
          skip: skip ? parseInt(skip) : undefined,
          threshold: threshold ? parseFloat(threshold) : undefined,
          textWeight: textWeight ? parseFloat(textWeight) : undefined,
          imageWeight: imageWeight ? parseFloat(imageWeight) : undefined,
          includeKnowledge: includeKnowledge !== 'false',
          includeRelationships: includeRelationships !== 'false',
          filters: filters ? JSON.parse(filters) : undefined
        },
        userId
      );
      
      res.status(200).json({
        success: true,
        data: results.materials,
        knowledgeEntries: results.knowledgeEntries,
        relationships: results.relationships,
        metadata: results.metadata
      });
      
      return;
    }
    
    // Validate that at least one search modality is provided
    if (!textQuery && !imageBase64 && !imagePath && !req.body.imageUrl) {
      throw new ApiError(400, 'At least one search modality (text or image) must be provided');
    }
    
    try {
      // Perform search with provided modalities
      const results = await multiModalSearchService.search(
        {
          textQuery,
          imageBase64,
          imagePath,
          materialType,
          limit: limit ? parseInt(limit) : undefined,
          skip: skip ? parseInt(skip) : undefined,
          threshold: threshold ? parseFloat(threshold) : undefined,
          textWeight: textWeight ? parseFloat(textWeight) : undefined,
          imageWeight: imageWeight ? parseFloat(imageWeight) : undefined,
          includeKnowledge: includeKnowledge !== 'false',
          includeRelationships: includeRelationships !== 'false',
          filters: filters ? JSON.parse(filters) : undefined
        },
        userId
      );
      
      res.status(200).json({
        success: true,
        data: results.materials,
        knowledgeEntries: results.knowledgeEntries,
        relationships: results.relationships,
        metadata: results.metadata
      });
    } finally {
      // Clean up temporary file if created
      if (imagePath && fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
        } catch (error) {
          logger.warn(`Failed to clean up temporary image file: ${error}`);
        }
      }
    }
  } catch (error: any) {
    logger.error(`Error in multi-modal search: ${error}`);
    
    // Handle specific error cases
    if (error.message === 'Insufficient credits') {
      res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message: 'You do not have enough credits to perform this search'
      });
    } else if (error.message === 'MCP server is not available') {
      res.status(503).json({
        success: false,
        error: 'Service unavailable',
        message: 'The search service is currently unavailable'
      });
    } else {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Internal server error',
        message: 'Failed to perform multi-modal search'
      });
    }
  }
};

/**
 * Handle file upload for multi-modal search
 */
export const uploadMiddleware = upload.single('image');

export default {
  performMultiModalSearch,
  uploadMiddleware
};
