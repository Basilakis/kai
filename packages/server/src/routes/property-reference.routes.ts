/**
 * Property Reference Routes
 * 
 * API routes for managing property reference images
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { propertyReferenceService } from '@kai/shared/src/services/property-reference/propertyReferenceService';
import { authenticate } from '../middleware/auth';
import { uploadToStorage, generateUniqueStorageKey } from '../services/storage/supabaseStorageService';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    // Create user-specific directory to segregate uploads
    const userId = req.user?.id || 'anonymous';
    const uploadDir = path.join(process.cwd(), 'uploads', 'property-references', userId);
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept only image files
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});

/**
 * @route GET /api/property-references
 * @desc Get property reference images
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const { propertyName, propertyValue, materialType, isPrimary } = req.query;
    
    const images = await propertyReferenceService.getPropertyReferenceImages({
      propertyName: propertyName as string,
      propertyValue: propertyValue as string,
      materialType: materialType as string,
      isPrimary: isPrimary === 'true' ? true : isPrimary === 'false' ? false : undefined
    });
    
    res.json(images);
  } catch (error) {
    console.error('Error getting property reference images:', error);
    res.status(500).json({ error: 'Failed to get property reference images' });
  }
});

/**
 * @route POST /api/property-references
 * @desc Create a new property reference image
 * @access Private
 */
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { propertyName, propertyValue, materialType, description, isPrimary } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    if (!propertyName || !propertyValue || !materialType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const imagePath = req.file.path;
    
    // Get user ID for ownership tracking
    const userId = req.user?.id || 'anonymous';
    
    // Upload file to Supabase storage
    const fileName = path.basename(req.file.originalname);
    const storagePath = await generateUniqueStorageKey('property-references', `${materialType}/${propertyName}/${propertyValue}`, fileName);
    
    const uploadResult = await uploadToStorage(imagePath, storagePath, {
      isPublic: true,
      metadata: {
        originalName: req.file.originalname,
        size: req.file.size.toString(),
        mimetype: req.file.mimetype,
        userId: userId
      }
    });
    
    if (!uploadResult.url) {
      return res.status(500).json({ error: 'Failed to upload image' });
    }
    
    // Create property reference image
    const image = await propertyReferenceService.createPropertyReferenceImage({
      propertyName,
      propertyValue,
      materialType,
      file: fs.readFileSync(imagePath),
      description,
      isPrimary: isPrimary === 'true'
    });
    
    // Clean up temporary file
    fs.unlinkSync(imagePath);
    
    res.status(201).json(image);
  } catch (error) {
    console.error('Error creating property reference image:', error);
    res.status(500).json({ error: 'Failed to create property reference image' });
  }
});

/**
 * @route PUT /api/property-references/:id
 * @desc Update a property reference image
 * @access Private
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { description, isPrimary } = req.body;
    
    const image = await propertyReferenceService.updatePropertyReferenceImage({
      id,
      description,
      isPrimary: isPrimary === 'true'
    });
    
    res.json(image);
  } catch (error) {
    console.error('Error updating property reference image:', error);
    res.status(500).json({ error: 'Failed to update property reference image' });
  }
});

/**
 * @route DELETE /api/property-references/:id
 * @desc Delete a property reference image
 * @access Private
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    await propertyReferenceService.deletePropertyReferenceImage(id);
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting property reference image:', error);
    res.status(500).json({ error: 'Failed to delete property reference image' });
  }
});

export default router;
