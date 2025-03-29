/**
 * AI Routes
 * 
 * This module defines the API routes for AI services including text generation,
 * embedding generation, and image analysis. It connects the AI controller
 * endpoints to HTTP routes with appropriate middleware.
 */

// Using require instead of import for Express to avoid TypeScript issues
// @ts-ignore
const express = require('express');
const router = express.Router();
import multer from 'multer';
import * as aiController from '../controllers/ai.controller';
import { authMiddleware } from '../middleware/auth.middleware';

// Import types for type annotations only
type Request = any;
type Response = any;

// Configure multer for memory storage (for file uploads)
// @ts-ignore - Ignore TypeScript errors with multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * @route   POST /api/ai/text/generate
 * @desc    Generate text using the optimal AI model
 * @access  Private
 */
router.post(
  '/text/generate',
  authMiddleware,
  (req: Request, res: Response) => aiController.generateText(req, res)
);

/**
 * @route   POST /api/ai/embedding/generate
 * @desc    Generate embeddings using the optimal AI model
 * @access  Private
 */
router.post(
  '/embedding/generate',
  authMiddleware,
  (req: Request, res: Response) => aiController.generateEmbedding(req, res)
);

/**
 * @route   POST /api/ai/image/analyze
 * @desc    Analyze an image using the optimal AI model
 * @access  Private
 */
router.post(
  '/image/analyze',
  authMiddleware,
  upload.single('image'),
  (req: Request, res: Response) => aiController.analyzeImage(req, res)
);

/**
 * @route   GET /api/ai/models/metrics
 * @desc    Get performance metrics for AI models
 * @access  Private (Admin)
 */
router.get(
  '/models/metrics',
  authMiddleware,
  (req: Request, res: Response) => aiController.getModelMetrics(req, res)
);

/**
 * @route   POST /api/ai/evaluation/set
 * @desc    Set evaluation mode for a specific number of tasks
 * @access  Private (Admin)
 */
router.post(
  '/evaluation/set',
  authMiddleware,
  (req: Request, res: Response) => aiController.setEvaluationMode(req, res)
);

export default router;