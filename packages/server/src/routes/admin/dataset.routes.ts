/**
 * Dataset Routes
 * 
 * API routes for dataset management, including upload, listing, retrieval, and operations.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
// Use temporary type workaround since we can't install @types/node
const os = {
  tmpdir: () => {
    // Default to system temp directory or use a known path
    return process.env.TEMP || '/tmp';
  }
};
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import supabaseDatasetService from '../../services/supabase/supabase-dataset-service';
import { zipExtractorService } from '../../services/datasets/zip-extractor.service';
import { csvParserService } from '../../services/datasets/csv-parser.service';
import { datasetManagementService } from '../../services/datasets/dataset-management.service';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create temporary upload directory
    const uploadDir = path.join(os.tmpdir(), 'kai-uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size
  },
  fileFilter: (req: any, file: Express.Multer.File, cb: any) => {
    // Check file types
    const allowedExtensions = ['.zip', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type. Allowed types: ${allowedExtensions.join(', ')}`), false);
    }
  }
});

/**
 * @route   GET /api/admin/datasets
 * @desc    Get all datasets with pagination
 * @access  Admin
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      query = '', 
      status,
      limit = '10', 
      page = '1',
      sort_field = 'created_at',
      sort_direction = 'desc'
    } = req.query;

    // Convert parameters
    const limitNum = parseInt(limit as string, 10);
    const pageNum = parseInt(page as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Handle status array or single value
    let statusFilter = status;
    if (status && typeof status === 'string' && status.includes(',')) {
      statusFilter = status.split(',');
    }

    // Search datasets
    const result = await supabaseDatasetService.searchDatasets({
      query: query as string,
      status: statusFilter as any, // Cast to any to avoid type errors with specific status enum
      limit: limitNum,
      skip,
      sort: {
        field: sort_field as string,
        direction: sort_direction as 'asc' | 'desc'
      }
    });

    return res.json({
      datasets: result.datasets,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum)
    });
  } catch (err) {
    logger.error(`Error getting datasets: ${err}`);
    return res.status(500).json({ error: 'Failed to get datasets', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @route   GET /api/admin/datasets/stats
 * @desc    Get dataset statistics
 * @access  Admin
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await supabaseDatasetService.getDatasetStats();
    return res.json(stats);
  } catch (err) {
    logger.error(`Error getting dataset stats: ${err}`);
    return res.status(500).json({ error: 'Failed to get dataset statistics', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @route   GET /api/admin/datasets/:id
 * @desc    Get dataset by ID
 * @access  Admin
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dataset = await supabaseDatasetService.getDatasetById(id || '');
    
    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    
    // Get classes for the dataset
    const classes = await supabaseDatasetService.getDatasetClasses(id || '');
    
    return res.json({
      dataset,
      classes
    });
  } catch (err) {
    logger.error(`Error getting dataset: ${err}`);
    return res.status(500).json({ error: 'Failed to get dataset', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @route   GET /api/admin/datasets/:id/classes/:classId/images
 * @desc    Get images for a dataset class
 * @access  Admin
 */
router.get('/:id/classes/:classId/images', async (req: Request, res: Response) => {
  try {
    const { classId } = req.params;
    const { limit = '100', page = '1' } = req.query;
    
    // Convert parameters
    const limitNum = parseInt(limit as string, 10);
    const pageNum = parseInt(page as string, 10);
    const offset = (pageNum - 1) * limitNum;
    
    // Get images
    const images = await supabaseDatasetService.getDatasetClassImages(classId || '', limitNum, offset);
    
    // Get signed URLs for each image
    const imagesWithUrls = await Promise.all(
      images.map(async (image) => {
        try {
          const url = await supabaseDatasetService.getSignedImageUrl(image.storagePath);
          return { ...image, url };
        } catch (err) {
          logger.warn(`Failed to get URL for image ${image.id}: ${err}`);
          return { ...image, url: null };
        }
      })
    );
    
    return res.json(imagesWithUrls);
  } catch (err) {
    logger.error(`Error getting class images: ${err}`);
    return res.status(500).json({ error: 'Failed to get class images', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @route   POST /api/admin/datasets/upload/zip
 * @desc    Upload and process a ZIP dataset
 * @access  Admin
 */
router.post('/upload/zip', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { name, description } = req.body;
    const userId = req.user?.id;
    
    // Process ZIP file
    const result = await zipExtractorService.processZipFile(
      req.file.path,
      name || path.basename(req.file.originalname, '.zip'),
      description,
      userId
    );
    
    // Clean up temporary file
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupErr) {
      logger.warn(`Failed to clean up temporary file: ${cleanupErr}`);
    }
    
    if (!result.success) {
      return res.status(400).json({
        error: 'Failed to process ZIP dataset',
        details: result.errors
      });
    }
    
    return res.json({
      success: true,
      dataset: result.dataset,
      classCount: result.classCount,
      imageCount: result.imageCount,
      warnings: result.errors.length > 0 ? result.errors : undefined
    });
  } catch (err) {
    logger.error(`Error processing ZIP dataset: ${err}`);
    
    // Clean up temporary file if it exists
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        logger.warn(`Failed to clean up temporary file: ${cleanupErr}`);
      }
    }
    
    return res.status(500).json({ error: 'Failed to process ZIP dataset', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @route   POST /api/admin/datasets/upload/csv
 * @desc    Upload and process a CSV dataset
 * @access  Admin
 */
router.post('/upload/csv', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { name, description, mapping } = req.body;
    const userId = req.user?.id;
    
    // Parse mapping JSON if provided
    let mappingConfig;
    if (mapping) {
      try {
        mappingConfig = JSON.parse(mapping);
      } catch (parseErr) {
        return res.status(400).json({ error: 'Invalid mapping JSON' });
      }
    }
    
    // Process CSV file
    const result = await csvParserService.processCsvFile(
      req.file.path,
      name || path.basename(req.file.originalname, '.csv'),
      description,
      mappingConfig,
      userId
    );
    
    // Clean up temporary file
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupErr) {
      logger.warn(`Failed to clean up temporary file: ${cleanupErr}`);
    }
    
    if (!result.success) {
      return res.status(400).json({
        error: 'Failed to process CSV dataset',
        details: result.errors
      });
    }
    
    return res.json({
      success: true,
      dataset: result.dataset,
      classCount: result.classCount,
      imageCount: result.imageCount,
      warnings: result.warnings.length > 0 ? result.warnings : undefined
    });
  } catch (err) {
    logger.error(`Error processing CSV dataset: ${err}`);
    
    // Clean up temporary file if it exists
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        logger.warn(`Failed to clean up temporary file: ${cleanupErr}`);
      }
    }
    
    return res.status(500).json({ error: 'Failed to process CSV dataset', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @route   GET /api/admin/datasets/templates/csv
 * @desc    Get CSV template
 * @access  Admin
 */
router.get('/templates/csv', (req: Request, res: Response) => {
  try {
    const template = csvParserService.generateCsvTemplate();
    
    // Set headers for file download
    (res as any).setHeader('Content-Type', 'text/csv');
    (res as any).setHeader('Content-Disposition', 'attachment; filename="dataset-template.csv"');
    
    return res.status(200).send(template as any);
  } catch (err) {
    logger.error(`Error generating CSV template: ${err}`);
    return res.status(500).json({ error: 'Failed to generate CSV template', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @route   POST /api/admin/datasets/:id/clean
 * @desc    Clean a dataset by detecting and fixing issues
 * @access  Admin
 */
router.post('/:id/clean', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      createNewVersion = true,
      detectDuplicates = true,
      removeDuplicates = true,
      detectCorrupted = true,
      removeCorrupted = true,
      detectOutliers = false,
      removeOutliers = false,
      balanceClasses = false,
      fixLabels = false,
      checkResolution
    } = req.body;

    const options = {
      detectDuplicates,
      removeDuplicates,
      detectCorrupted,
      removeCorrupted,
      detectOutliers,
      removeOutliers,
      balanceClasses,
      fixLabels,
      checkResolution: checkResolution || {
        enabled: true,
        minWidth: 224,
        minHeight: 224
      }
    };

    const result = await datasetManagementService.cleanDataset(id || '', options, createNewVersion);
    
    return res.json(result);
  } catch (err) {
    logger.error(`Error cleaning dataset: ${err}`);
    return res.status(500).json({ error: 'Failed to clean dataset', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @route   POST /api/admin/datasets/:id/augment
 * @desc    Augment a dataset with additional transformations
 * @access  Admin
 */
router.post('/:id/augment', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      createNewVersion = true,
      targetSamplesPerClass,
      maxAugmentationPerImage,
      transformations = {
        rotation: { enabled: true, maxDegrees: 30 },
        flip: { enabled: true, horizontal: true, vertical: false },
        crop: { enabled: false },
        zoom: { enabled: false },
        brightness: { enabled: true, range: [-0.2, 0.2] },
        contrast: { enabled: true, range: [-0.2, 0.2] },
        noise: { enabled: false },
        blur: { enabled: false },
        colorJitter: { enabled: false },
        perspective: { enabled: false }
      }
    } = req.body;

    const options = {
      enabled: true,
      targetSamplesPerClass,
      maxAugmentationPerImage,
      transformations
    };

    const result = await datasetManagementService.augmentDataset(id || '', options, createNewVersion);
    
    return res.json(result);
  } catch (err) {
    logger.error(`Error augmenting dataset: ${err}`);
    return res.status(500).json({ error: 'Failed to augment dataset', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @route   POST /api/admin/datasets/:id/versions
 * @desc    Create a new version of a dataset
 * @access  Admin
 */
router.post('/:id/versions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, changeLog } = req.body;
    const userId = req.user?.id;
    
    const version = await datasetManagementService.createDatasetVersion(
      id || '',
      name || `Version ${new Date().toISOString()}`,
      description,
      changeLog,
      userId
    );
    
    return res.json(version);
  } catch (err) {
    logger.error(`Error creating dataset version: ${err}`);
    return res.status(500).json({ error: 'Failed to create dataset version', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @route   GET /api/admin/datasets/:id/versions
 * @desc    Get all versions of a dataset
 * @access  Admin
 */
router.get('/:id/versions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const versions = await datasetManagementService.getDatasetVersions(id || '');
    
    return res.json(versions);
  } catch (err) {
    logger.error(`Error getting dataset versions: ${err}`);
    return res.status(500).json({ error: 'Failed to get dataset versions', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @route   GET /api/admin/datasets/:id/quality
 * @desc    Analyze dataset quality and generate metrics
 * @access  Admin
 */
router.get('/:id/quality', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const metrics = await datasetManagementService.analyzeDatasetQuality(id || '');
    
    return res.json(metrics);
  } catch (err) {
    logger.error(`Error analyzing dataset quality: ${err}`);
    return res.status(500).json({ error: 'Failed to analyze dataset quality', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @route   POST /api/admin/datasets/:id/synthetic
 * @desc    Generate synthetic data to balance or augment a class
 * @access  Admin
 */
router.post('/:id/synthetic', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      targetClass,
      targetCount,
      generationMethod = 'random',
      generationParams = {}
    } = req.body;

    if (!targetClass) {
      return res.status(400).json({ error: 'Target class is required' });
    }

    if (!targetCount || targetCount <= 0) {
      return res.status(400).json({ error: 'Valid target count is required' });
    }

    const options = {
      targetClass,
      targetCount,
      generationMethod,
      generationParams
    };

    const result = await datasetManagementService.generateSyntheticData(id || '', options);
    
    return res.json(result);
  } catch (err) {
    logger.error(`Error generating synthetic data: ${err}`);
    return res.status(500).json({ error: 'Failed to generate synthetic data', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @route   POST /api/admin/datasets/incremental
 * @desc    Set up an incremental learning dataset
 * @access  Admin
 */
router.post('/incremental', async (req: Request, res: Response) => {
  try {
    const { 
      baseDatasetId,
      newClasses,
      newImagesPerClass,
      preserveOldClasses = true,
      rebalance = false
    } = req.body;

    if (!baseDatasetId) {
      return res.status(400).json({ error: 'Base dataset ID is required' });
    }

    if (!newClasses || !Array.isArray(newClasses) || newClasses.length === 0) {
      return res.status(400).json({ error: 'At least one new class is required' });
    }

    const options = {
      baseDatasetId,
      newClasses,
      newImagesPerClass,
      preserveOldClasses,
      rebalance
    };

    const result = await datasetManagementService.setupIncrementalLearningDataset(options);
    
    return res.json(result);
  } catch (err) {
    logger.error(`Error setting up incremental learning dataset: ${err}`);
    return res.status(500).json({ error: 'Failed to set up incremental learning dataset', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @route   DELETE /api/admin/datasets/:id
 * @desc    Delete dataset
 * @access  Admin
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deletedDataset = await supabaseDatasetService.deleteDataset(id || '');
    
    if (!deletedDataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    
    return res.json({ success: true, dataset: deletedDataset });
  } catch (err) {
    logger.error(`Error deleting dataset: ${err}`);
    return res.status(500).json({ error: 'Failed to delete dataset', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @route   PUT /api/admin/datasets/:id
 * @desc    Update dataset
 * @access  Admin
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;
    
    // Check if dataset exists
    const existingDataset = await supabaseDatasetService.getDatasetById(id || '');
    if (!existingDataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    
    // Update dataset
    const updatedDataset = await supabaseDatasetService.updateDataset(id || '', {
      name,
      description,
      status
    });
    
    return res.json({ success: true, dataset: updatedDataset });
  } catch (err) {
    logger.error(`Error updating dataset: ${err}`);
    return res.status(500).json({ error: 'Failed to update dataset', details: err instanceof Error ? err.message : String(err) });
  }
});

export default router;