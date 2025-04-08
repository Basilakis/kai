/**
 * AI Routes
 * 
 * This module defines the API routes for AI services including text generation,
 * embedding generation, and image analysis. It connects the AI controller
 * endpoints to HTTP routes with appropriate middleware.
 */

// Import with require to match project structure
// @ts-ignore
const express = require('express');
// @ts-ignore
const multer = require('multer');
import * as aiController from '../controllers/ai.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { Request, Response, NextFunction } from '../types/middleware';

// Create router instance matching project convention
const router = express.Router();

// Configure multer for memory storage matching project convention
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * Type-safe route handler function
 */
type RouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

/**
 * Helper to wrap controller methods with proper typing
 */
const createHandler = (handler: RouteHandler): RouteHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    return handler(req, res, next);
  };
};

/**
 * @route   POST /api/ai/text/generate
 * @desc    Generate text using the optimal AI model
 * @access  Private
 */
router.post(
  '/text/generate',
  authMiddleware,
  createHandler((req: Request, res: Response) => aiController.generateText(req, res))
);

/**
 * @route   POST /api/ai/embedding/generate
 * @desc    Generate embeddings using the optimal AI model
 * @access  Private
 */
router.post(
  '/embedding/generate',
  authMiddleware,
  createHandler((req: Request, res: Response) => aiController.generateEmbedding(req, res))
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
  createHandler((req: Request, res: Response) => aiController.analyzeImage(req, res))
);

/**
 * @route   GET /api/ai/models/metrics
 * @desc    Get performance metrics for AI models
 * @access  Private (Admin)
 */
router.get(
  '/models/metrics',
  authMiddleware,
  createHandler((req: Request, res: Response) => aiController.getModelMetrics(req, res))
);

/**
 * @route   POST /api/ai/evaluation/set
 * @desc    Set evaluation mode for a specific number of tasks
 * @access  Private (Admin)
 */
router.post(
  '/evaluation/set',
  authMiddleware,
  createHandler((req: Request, res: Response) => aiController.setEvaluationMode(req, res))
);

export default router;