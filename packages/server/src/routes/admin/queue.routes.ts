/**
 * Admin Queue Routes
 * 
 * API routes for unified queue management across PDF and crawler systems
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware, authorizeRoles } from '../../middleware/auth.middleware';
import { ApiError } from '../../middleware/error.middleware';
import { 
  getAllQueueJobs, 
  getQueueJob, 
  getQueueStats, 
  retryQueueJob,
  cancelQueueJob,
  clearQueue
} from '../../controllers/queue.controller';

const router = Router();

// All routes in this file require admin authentication
router.use(authMiddleware, authorizeRoles(['admin']));

/**
 * @route   GET /api/admin/queue
 * @desc    Get all jobs from both queue systems with filtering
 * @access  Private (Admin)
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const queueSystem = req.query.system as 'pdf' | 'crawler' | 'all' | undefined;
  const status = req.query.status as string | undefined;
  const source = req.query.source as string | undefined;
  
  const jobs = await getAllQueueJobs({
    queueSystem,
    status,
    source
  });
  
  res.status(200).json({
    success: true,
    count: jobs.length,
    data: jobs
  });
}));

/**
 * @route   GET /api/admin/queue/stats
 * @desc    Get statistics for both queue systems
 * @access  Private (Admin)
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const stats = await getQueueStats();
  
  res.status(200).json({
    success: true,
    data: stats
  });
}));

/**
 * @route   GET /api/admin/queue/:id
 * @desc    Get details for a specific job
 * @access  Private (Admin)
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const queueSystem = req.query.system as 'pdf' | 'crawler' | undefined;
  
  const job = await getQueueJob(id, queueSystem);
  
  if (!job) {
    throw new ApiError(404, `Job not found with id ${id}`);
  }
  
  res.status(200).json({
    success: true,
    data: job
  });
}));

/**
 * @route   POST /api/admin/queue/:id/retry
 * @desc    Retry a failed job
 * @access  Private (Admin)
 */
router.post('/:id/retry', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { system } = req.body as { system: 'pdf' | 'crawler' };
  
  if (!system) {
    throw new ApiError(400, 'Queue system (pdf or crawler) is required');
  }
  
  const result = await retryQueueJob(id, system);
  
  if (!result.success) {
    throw new ApiError(400, result.message);
  }
  
  res.status(200).json({
    success: true,
    message: result.message
  });
}));

/**
 * @route   POST /api/admin/queue/:id/cancel
 * @desc    Cancel a running or pending job
 * @access  Private (Admin)
 */
router.post('/:id/cancel', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { system } = req.body as { system: 'pdf' | 'crawler' };
  
  if (!system) {
    throw new ApiError(400, 'Queue system (pdf or crawler) is required');
  }
  
  const result = await cancelQueueJob(id, system);
  
  if (!result.success) {
    throw new ApiError(400, result.message);
  }
  
  res.status(200).json({
    success: true,
    message: result.message
  });
}));

/**
 * @route   POST /api/admin/queue/clear
 * @desc    Clear all jobs from a queue system
 * @access  Private (Admin)
 */
router.post('/clear', asyncHandler(async (req: Request, res: Response) => {
  const { system } = req.body as { system: 'pdf' | 'crawler' };
  
  if (!system) {
    throw new ApiError(400, 'Queue system (pdf or crawler) is required');
  }
  
  const result = await clearQueue(system);
  
  if (!result.success) {
    throw new ApiError(400, result.message);
  }
  
  res.status(200).json({
    success: true,
    message: result.message,
    count: result.count
  });
}));

/**
 * @route   GET /api/admin/queue/source-filters
 * @desc    Get available source filters for jobs (providers, manufacturers)
 * @access  Private (Admin)
 */
router.get('/source-filters', asyncHandler(async (req: Request, res: Response) => {
  // Get all jobs to extract source information
  const jobs = await getAllQueueJobs();
  
  // Extract unique sources
  const sources = Array.from(new Set(jobs.map(job => job.source))).filter(Boolean);
  
  // Group sources by queue system
  const pdfSources = jobs
    .filter(job => job.queueSystem === 'pdf')
    .map(job => job.source)
    .filter((source, index, self) => self.indexOf(source) === index);
    
  const crawlerSources = jobs
    .filter(job => job.queueSystem === 'crawler')
    .map(job => job.source)
    .filter((source, index, self) => self.indexOf(source) === index);
  
  res.status(200).json({
    success: true,
    data: {
      all: sources,
      pdf: pdfSources,
      crawler: crawlerSources
    }
  });
}));

export default router;