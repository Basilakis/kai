import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware, authorizeRoles } from '../middleware/auth.middleware';
import { ApiError } from '../middleware/error.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { 
  getCatalogById, 
  getAllCatalogs, 
  updateCatalog, 
  deleteCatalog 
} from '../models/catalog.model';
import { processPdfCatalog } from '../services/pdf/pdfProcessor';

const router = express.Router();

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'catalogs');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for PDFs
  },
  fileFilter: (req, file, cb) => {
    // Accept only PDF files
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  }
});

/**
 * @route   GET /api/catalogs
 * @desc    Get all catalogs with pagination
 * @access  Private
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;
  
  const { catalogs, total } = await getAllCatalogs({
    limit,
    skip,
    sort: { updatedAt: -1 }
  });
  
  res.status(200).json({
    success: true,
    count: catalogs.length,
    total,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      limit
    },
    data: catalogs
  });
}));

/**
 * @route   GET /api/catalogs/:id
 * @desc    Get a catalog by ID
 * @access  Private
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const catalog = await getCatalogById(req.params.id);
  
  if (!catalog) {
    throw new ApiError(404, `Catalog not found with id ${req.params.id}`);
  }
  
  res.status(200).json({
    success: true,
    data: catalog
  });
}));

/**
 * @route   POST /api/catalogs/upload
 * @desc    Upload a PDF catalog
 * @access  Private (Admin, Manager)
 */
router.post(
  '/upload',
  authMiddleware,
  authorizeRoles(['admin', 'manager']),
  upload.single('catalog'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ApiError(400, 'No PDF file uploaded');
    }
    
    const catalogName = req.body.name || path.basename(req.file.originalname, path.extname(req.file.originalname));
    const manufacturer = req.body.manufacturer || 'Unknown';
    
    // Create a job to process the catalog asynchronously
    res.status(202).json({
      success: true,
      message: 'Catalog uploaded successfully. Processing started.',
      data: {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        path: req.file.path,
        catalogName,
        manufacturer
      }
    });
    
    // Process the catalog asynchronously
    processPdfCatalog(req.file.path, {
      userId: req.user?.id || 'system',
      catalogName,
      manufacturer,
      extractImages: true,
      extractText: true,
      associateTextWithImages: true,
      deleteOriginalAfterProcessing: true
    }).catch(err => {
      logger.error(`Error processing catalog ${catalogName}: ${err}`);
    });
  })
);

/**
 * @route   POST /api/catalogs/process
 * @desc    Process an existing PDF catalog
 * @access  Private (Admin, Manager)
 */
router.post(
  '/process',
  authMiddleware,
  authorizeRoles(['admin', 'manager']),
  asyncHandler(async (req: Request, res: Response) => {
    const { filePath, catalogName, manufacturer } = req.body;
    
    if (!filePath) {
      throw new ApiError(400, 'File path is required');
    }
    
    if (!fs.existsSync(filePath)) {
      throw new ApiError(404, `File not found at ${filePath}`);
    }
    
    // Create a job to process the catalog asynchronously
    res.status(202).json({
      success: true,
      message: 'Catalog processing started.',
      data: {
        filePath,
        catalogName,
        manufacturer
      }
    });
    
    // Process the catalog asynchronously
    processPdfCatalog(filePath, {
      userId: req.user?.id || 'system',
      catalogName: catalogName || path.basename(filePath, path.extname(filePath)),
      manufacturer: manufacturer || 'Unknown',
      extractImages: true,
      extractText: true,
      associateTextWithImages: true,
      deleteOriginalAfterProcessing: false
    }).catch(err => {
      logger.error(`Error processing catalog ${catalogName}: ${err}`);
    });
  })
);

/**
 * @route   POST /api/catalogs/batch
 * @desc    Process multiple PDF catalogs in batch
 * @access  Private (Admin)
 */
router.post(
  '/batch',
  authMiddleware,
  authorizeRoles(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { catalogs } = req.body;
    
    if (!catalogs || !Array.isArray(catalogs) || catalogs.length === 0) {
      throw new ApiError(400, 'No catalogs provided for batch processing');
    }
    
    // Validate each catalog entry
    for (const catalog of catalogs) {
      if (!catalog.filePath) {
        throw new ApiError(400, 'File path is required for each catalog');
      }
      
      if (!fs.existsSync(catalog.filePath)) {
        throw new ApiError(404, `File not found at ${catalog.filePath}`);
      }
    }
    
    // Create a job to process the catalogs asynchronously
    res.status(202).json({
      success: true,
      message: 'Batch processing started.',
      data: {
        totalCatalogs: catalogs.length,
        catalogs
      }
    });
    
    // Process each catalog asynchronously
    for (const catalog of catalogs) {
      processPdfCatalog(catalog.filePath, {
        userId: req.user?.id || 'system',
        catalogName: catalog.name || path.basename(catalog.filePath, path.extname(catalog.filePath)),
        manufacturer: catalog.manufacturer || 'Unknown',
        extractImages: true,
        extractText: true,
        associateTextWithImages: true,
        deleteOriginalAfterProcessing: catalog.deleteOriginal || false
      }).catch(err => {
        logger.error(`Error processing catalog ${catalog.name}: ${err}`);
      });
    }
  })
);

/**
 * @route   PUT /api/catalogs/:id
 * @desc    Update a catalog
 * @access  Private (Admin, Manager)
 */
router.put(
  '/:id',
  authMiddleware,
  authorizeRoles(['admin', 'manager']),
  asyncHandler(async (req: Request, res: Response) => {
    const catalog = await getCatalogById(req.params.id);
    
    if (!catalog) {
      throw new ApiError(404, `Catalog not found with id ${req.params.id}`);
    }
    
    const updatedCatalog = await updateCatalog(req.params.id, {
      ...req.body,
      updatedAt: new Date()
    });
    
    res.status(200).json({
      success: true,
      data: updatedCatalog
    });
  })
);

/**
 * @route   DELETE /api/catalogs/:id
 * @desc    Delete a catalog
 * @access  Private (Admin)
 */
router.delete(
  '/:id',
  authMiddleware,
  authorizeRoles(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const catalog = await getCatalogById(req.params.id);
    
    if (!catalog) {
      throw new ApiError(404, `Catalog not found with id ${req.params.id}`);
    }
    
    await deleteCatalog(req.params.id);
    
    res.status(200).json({
      success: true,
      message: `Catalog ${req.params.id} deleted successfully`
    });
  })
);

export default router;