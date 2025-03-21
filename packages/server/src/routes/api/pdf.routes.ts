/**
 * PDF Routes
 * 
 * This file contains routes for PDF operations like uploading and processing PDFs,
 * checking processing status, and retrieving extraction results.
 */

import express, { Request, Response } from 'express';
import multer, { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { 
  queuePdfForProcessing, 
  batchProcessPdfCatalogs, 
  getPdfProcessingStatus, 
  getAllPdfProcessingJobs 
} from '../../services/pdf/pdfProcessor';
import { ApiError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';

const router = express.Router();

// Configure multer for file uploads
const storage = diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join('.', 'uploads', 'pdf');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const fileExt = path.extname(file.originalname);
    const fileName = `${path.basename(file.originalname, fileExt)}-${uniqueSuffix}${fileExt}`;
    
    cb(null, fileName);
  }
});

// File filter function to allow only PDFs
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB file size limit
  }
});

/**
 * @route   POST /api/pdf/upload
 * @desc    Upload and process a single PDF
 * @access  Private
 */
router.post('/upload', 
  authMiddleware,
  upload.single('pdf'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ApiError(400, 'No PDF file uploaded');
    }

    const { 
      catalogName = req.file.originalname, 
      manufacturer = '', 
      priority = 'normal',
      extractImages = true,
      extractText = true,
      associateTextWithImages = true
    } = req.body;

    // Queue PDF for processing
    const jobId = await queuePdfForProcessing(req.file.path, {
      userId: req.user!.id,
      catalogName,
      manufacturer,
      priority: priority as 'low' | 'normal' | 'high',
      extractImages: extractImages === 'true' || extractImages === true,
      extractText: extractText === 'true' || extractText === true,
      associateTextWithImages: associateTextWithImages === 'true' || associateTextWithImages === true
    });

    res.status(202).json({
      success: true,
      message: 'PDF queued for processing',
      jobId,
      status: 'pending'
    });
  })
);

/**
 * @route   POST /api/pdf/batch-upload
 * @desc    Upload and process multiple PDFs
 * @access  Private
 */
router.post('/batch-upload',
  authMiddleware,
  upload.array('pdfs', 10), // Allow up to 10 PDFs at once
  asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      throw new ApiError(400, 'No PDF files uploaded');
    }

    const { 
      manufacturer = '',
      priority = 'normal',
      extractImages = true,
      extractText = true,
      associateTextWithImages = true
    } = req.body;

    // Create batch processing jobs
    const batch = files.map(file => ({
      filePath: file.path,
      options: {
        userId: req.user!.id,
        catalogName: req.body[`name_${file.originalname}`] || file.originalname,
        manufacturer,
        priority: priority as 'low' | 'normal' | 'high',
        extractImages: extractImages === 'true' || extractImages === true,
        extractText: extractText === 'true' || extractText === true,
        associateTextWithImages: associateTextWithImages === 'true' || associateTextWithImages === true
      }
    }));

    // Queue batch for processing
    const jobIds = await batchProcessPdfCatalogs(batch);

    res.status(202).json({
      success: true,
      message: `${jobIds.length} PDFs queued for processing`,
      jobIds,
      status: 'pending'
    });
  })
);

/**
 * @route   GET /api/pdf/status/:jobId
 * @desc    Get PDF processing status
 * @access  Private
 */
router.get('/status/:jobId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;

    // Ensure jobId is defined
    if (!jobId) {
      throw new ApiError(400, 'Job ID is required');
    }

    // Get job status
    const job = await getPdfProcessingStatus(jobId);

    if (!job) {
      throw new ApiError(404, 'Job not found');
    }

    res.status(200).json({
      success: true,
      job
    });
  })
);

/**
 * @route   GET /api/pdf/jobs
 * @desc    Get all PDF processing jobs
 * @access  Private
 */
router.get('/jobs',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.query;

    // Get all jobs
    const jobs = await getAllPdfProcessingJobs(status as string);

    res.status(200).json({
      success: true,
      jobs
    });
  })
);

export default router;