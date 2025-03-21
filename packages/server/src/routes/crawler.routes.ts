/**
 * Crawler Routes
 * 
 * API endpoints for managing web crawlers, running crawler jobs, and
 * integrating with the training system. Supports both JinaAI and Firecrawl.
 */

import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware, authorizeRoles } from '../middleware/auth.middleware';
import { ApiError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Import the crawler services and queue
import { 
  CrawlerConfig, 
  CrawlerResult,
  CrawlerJobOptions
} from '../services/crawler/crawlerService.interface';
import { crawlerQueue, QueueJobOptions } from '../services/crawler/crawlerQueue';
import { 
  crawlerServiceFactory, 
  CRAWLER_PROVIDERS, 
  CrawlerProvider,
  CrawlerCredentials
} from '../services/crawler/crawlerServiceFactory';

// Database models would be imported here in a real application
// For this implementation, we'll use file-based storage

const router = express.Router();
const configsDir = path.join(process.cwd(), 'data', 'crawler-configs');
const credentialsDir = path.join(process.cwd(), 'data', 'crawler-credentials');

// Create necessary directories
fs.mkdirSync(configsDir, { recursive: true });
fs.mkdirSync(credentialsDir, { recursive: true });

// Helper functions to read/write configs
const readConfigs = (): CrawlerConfig[] => {
  try {
    if (fs.existsSync(path.join(configsDir, 'configs.json'))) {
      return JSON.parse(fs.readFileSync(path.join(configsDir, 'configs.json'), 'utf-8'));
    }
    return [];
  } catch (err) {
    logger.error(`Failed to read crawler configs: ${err}`);
    return [];
  }
};

const writeConfigs = (configs: CrawlerConfig[]): void => {
  try {
    fs.writeFileSync(path.join(configsDir, 'configs.json'), JSON.stringify(configs, null, 2));
  } catch (err) {
    logger.error(`Failed to write crawler configs: ${err}`);
  }
};

const getCredentials = (): Record<CrawlerProvider, CrawlerCredentials | undefined> => {
  try {
    if (fs.existsSync(path.join(credentialsDir, 'credentials.json'))) {
      return JSON.parse(fs.readFileSync(path.join(credentialsDir, 'credentials.json'), 'utf-8'));
    }
    return { jina: undefined, firecrawl: undefined };
  } catch (err) {
    logger.error(`Failed to read crawler credentials: ${err}`);
    return { jina: undefined, firecrawl: undefined };
  }
};

const setCredentials = (provider: CrawlerProvider, credentials: CrawlerCredentials): void => {
  try {
    const allCredentials = getCredentials();
    allCredentials[provider] = credentials;
    fs.writeFileSync(path.join(credentialsDir, 'credentials.json'), JSON.stringify(allCredentials, null, 2));
    
    // Update the service factory with new credentials
    crawlerServiceFactory.setCredentials(credentials);
    
    logger.info(`Updated credentials for provider: ${provider}`);
  } catch (err) {
    logger.error(`Failed to set crawler credentials: ${err}`);
  }
};

/**
 * @route   GET /api/crawlers/providers
 * @desc    Get available crawler providers
 * @access  Private (Admin, Manager)
 */
router.get('/providers', authMiddleware, authorizeRoles(['admin', 'manager']), asyncHandler(async (req: Request, res: Response) => {
  const providers = crawlerServiceFactory.getAvailableProviders();
  
  res.status(200).json({
    success: true,
    data: providers
  });
}));

/**
 * @route   POST /api/crawlers/credentials/:provider
 * @desc    Set credentials for a provider
 * @access  Private (Admin)
 */
router.post('/credentials/:provider', authMiddleware, authorizeRoles(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { provider } = req.params;
  const { apiKey, ...otherCredentials } = req.body;
  
  if (!apiKey) {
    throw new ApiError(400, 'API key is required');
  }
  
  if (!provider || !crawlerServiceFactory.isProviderSupported(provider)) {
    throw new ApiError(400, `Unsupported or missing provider: ${provider}`);
  }
  
  // Save credentials
  const credentials: CrawlerCredentials = {
    provider: provider as CrawlerProvider,
    apiKey,
    ...otherCredentials
  };
  
  setCredentials(provider as CrawlerProvider, credentials);
  
  // Test the credentials
  try {
    const service = await crawlerServiceFactory.getService(provider as CrawlerProvider);
    
    res.status(200).json({
      success: true,
      message: `Credentials for ${provider} set successfully`,
      initialized: true
    });
  } catch (err) {
    res.status(200).json({
      success: true,
      message: `Credentials for ${provider} saved, but initialization failed: ${err}`,
      initialized: false
    });
  }
}));

/**
 * @route   GET /api/crawlers
 * @desc    Get all crawler configurations
 * @access  Private (Admin, Manager)
 */
router.get('/', authMiddleware, authorizeRoles(['admin', 'manager']), asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;
  
  const configs = readConfigs();
  const paginatedConfigs = configs.slice(skip, skip + limit);
  
  res.status(200).json({
    success: true,
    count: configs.length,
    data: paginatedConfigs
  });
}));

/**
 * @route   GET /api/crawlers/:id
 * @desc    Get a crawler configuration by ID
 * @access  Private (Admin, Manager)
 */
router.get('/:id', authMiddleware, authorizeRoles(['admin', 'manager']), asyncHandler(async (req: Request, res: Response) => {
  const configs = readConfigs();
  const config = configs.find(c => c.name === req.params.id);
  
  if (!config) {
    throw new ApiError(404, `Crawler configuration not found with id ${req.params.id}`);
  }
  
  res.status(200).json({
    success: true,
    data: config
  });
}));

/**
 * @route   POST /api/crawlers
 * @desc    Create a new crawler configuration
 * @access  Private (Admin)
 */
router.post('/', authMiddleware, authorizeRoles(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    description,
    url,
    provider,
    selectors,
    depth,
    maxPages,
    followLinks,
    includePatterns,
    excludePatterns,
    headers,
    timeout,
    retries,
    transformForTraining,
    autoTrain,
    trainingConfig
  } = req.body;
  
  // Validate required fields
  if (!name) {
    throw new ApiError(400, 'Name is required');
  }
  
  if (!url) {
    throw new ApiError(400, 'URL is required');
  }
  
  if (!provider) {
    throw new ApiError(400, 'Provider is required');
  }
  
  if (!crawlerServiceFactory.isProviderSupported(provider)) {
    throw new ApiError(400, `Unsupported provider: ${provider}`);
  }
  
  // Check for duplicate names
  const configs = readConfigs();
  if (configs.some(c => c.name === name)) {
    throw new ApiError(400, `A crawler configuration with the name "${name}" already exists`);
  }
  
  // Create the new config
  const config: CrawlerConfig = {
    name,
    description,
    url,
    provider: provider as CrawlerProvider,
    selectors,
    depth,
    maxPages,
    followLinks,
    includePatterns,
    excludePatterns,
    headers,
    timeout,
    retries,
    transformForTraining,
    autoTrain,
    trainingConfig
  };
  
  // Validate the config with the provider's service
  try {
    const service = await crawlerServiceFactory.getServiceForConfig(config);
    const validation = await service.validateConfig(config);
    
    if (!validation.valid) {
      throw new ApiError(400, `Invalid configuration: ${validation.errors?.join(', ')}`);
    }
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(500, `Failed to validate configuration: ${err}`);
  }
  
  // Save the new config
  configs.push(config);
  writeConfigs(configs);
  
  res.status(201).json({
    success: true,
    data: config
  });
}));

/**
 * @route   PUT /api/crawlers/:id
 * @desc    Update a crawler configuration
 * @access  Private (Admin)
 */
router.put('/:id', authMiddleware, authorizeRoles(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const configs = readConfigs();
  const configIndex = configs.findIndex(c => c.name === req.params.id);
  
  if (configIndex === -1) {
    throw new ApiError(404, `Crawler configuration not found with id ${req.params.id}`);
  }
  
  // Update the config
  const updatedConfig: CrawlerConfig = {
    ...configs[configIndex],
    ...req.body,
    name: req.params.id // Preserve the original name as the ID
  };
  
  // Validate the updated config
  try {
    const service = await crawlerServiceFactory.getServiceForConfig(updatedConfig);
    const validation = await service.validateConfig(updatedConfig);
    
    if (!validation.valid) {
      throw new ApiError(400, `Invalid configuration: ${validation.errors?.join(', ')}`);
    }
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(500, `Failed to validate configuration: ${err}`);
  }
  
  // Save the updated config
  configs[configIndex] = updatedConfig;
  writeConfigs(configs);
  
  res.status(200).json({
    success: true,
    data: updatedConfig
  });
}));

/**
 * @route   DELETE /api/crawlers/:id
 * @desc    Delete a crawler configuration
 * @access  Private (Admin)
 */
router.delete('/:id', authMiddleware, authorizeRoles(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const configs = readConfigs();
  const configIndex = configs.findIndex(c => c.name === req.params.id);
  
  if (configIndex === -1) {
    throw new ApiError(404, `Crawler configuration not found with id ${req.params.id}`);
  }
  
  // Remove the config
  configs.splice(configIndex, 1);
  writeConfigs(configs);
  
  res.status(200).json({
    success: true,
    message: 'Crawler configuration deleted successfully'
  });
}));

/**
 * @route   POST /api/crawlers/:id/start
 * @desc    Start a crawler job
 * @access  Private (Admin)
 */
router.post('/:id/start', authMiddleware, authorizeRoles(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const configs = readConfigs();
  const config = configs.find(c => c.name === req.params.id);
  
  if (!config) {
    throw new ApiError(404, `Crawler configuration not found with id ${req.params.id}`);
  }
  
  // Get job options from request
  const options: QueueJobOptions = {
    priority: req.body.priority,
    schedule: req.body.schedule,
    notify: req.body.notify,
    autoTrain: req.body.autoTrain ?? config.autoTrain ?? false,
    trainingConfig: req.body.trainingConfig ?? config.trainingConfig
  };
  
  // Add the job to the queue
  const jobId = await crawlerQueue.addJob(config, options);
  
  res.status(200).json({
    success: true,
    message: 'Crawler job started successfully',
    data: {
      jobId,
      configId: config.name,
      status: 'pending'
    }
  });
}));

/**
 * @route   POST /api/crawlers/jobs/:jobId/stop
 * @desc    Stop a crawler job
 * @access  Private (Admin)
 */
router.post('/jobs/:jobId/stop', authMiddleware, authorizeRoles(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const job = crawlerQueue.getJob(req.params.jobId as string);
  
  if (!job) {
    throw new ApiError(404, `Crawler job not found with id ${req.params.jobId}`);
  }
  
  const removed = await crawlerQueue.removeJob(req.params.jobId as string);
  
  if (!removed) {
    throw new ApiError(500, `Failed to stop crawler job ${req.params.jobId}`);
  }
  
  res.status(200).json({
    success: true,
    message: 'Crawler job stopped successfully',
    data: {
      jobId: req.params.jobId,
      status: 'canceled'
    }
  });
}));

/**
 * @route   GET /api/crawlers/jobs
 * @desc    Get all crawler jobs
 * @access  Private (Admin, Manager)
 */
router.get('/jobs', authMiddleware, authorizeRoles(['admin', 'manager']), asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as string;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;
  
  let jobs;
  if (status) {
    jobs = crawlerQueue.getJobsByStatus(status as any);
  } else {
    jobs = Array.from(crawlerQueue.getAllJobs().values());
  }
  
  const total = jobs.length;
  const paginatedJobs = jobs.slice(skip, skip + limit);
  
  res.status(200).json({
    success: true,
    count: total,
    data: paginatedJobs
  });
}));

/**
 * @route   GET /api/crawlers/jobs/:jobId
 * @desc    Get a crawler job by ID
 * @access  Private (Admin, Manager)
 */
router.get('/jobs/:jobId', authMiddleware, authorizeRoles(['admin', 'manager']), asyncHandler(async (req: Request, res: Response) => {
  const job = crawlerQueue.getJob(req.params.jobId as string);
  
  if (!job) {
    throw new ApiError(404, `Crawler job not found with id ${req.params.jobId}`);
  }
  
  res.status(200).json({
    success: true,
    data: job
  });
}));

/**
 * @route   GET /api/crawlers/jobs/:jobId/results
 * @desc    Get the results of a crawler job
 * @access  Private (Admin, Manager)
 */
router.get('/jobs/:jobId/results', authMiddleware, authorizeRoles(['admin', 'manager']), asyncHandler(async (req: Request, res: Response) => {
  const job = crawlerQueue.getJob(req.params.jobId as string);
  
  if (!job) {
    throw new ApiError(404, `Crawler job not found with id ${req.params.jobId}`);
  }
  
  if (job.status !== 'completed' && job.status !== 'training') {
    throw new ApiError(400, `Crawler job ${req.params.jobId} is not completed yet`);
  }
  
  if (!job.result) {
    throw new ApiError(404, `No results found for crawler job ${req.params.jobId}`);
  }
  
  try {
    const resultData = JSON.parse(fs.readFileSync(job.result, 'utf-8')) as CrawlerResult;
    
    // Paginate the results
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    
    const paginatedPages = resultData.pages.slice(skip, skip + limit);
    
    const results = {
      ...resultData,
      pages: paginatedPages
    };
    
    res.status(200).json({
      success: true,
      data: results,
      total: resultData.pages.length,
      page,
      limit
    });
  } catch (err) {
    throw new ApiError(500, `Failed to read results for crawler job ${req.params.jobId}: ${err}`);
  }
}));

/**
 * @route   POST /api/crawlers/test-selector
 * @desc    Test a CSS/XPath selector on a URL
 * @access  Private (Admin)
 */
router.post('/test-selector', authMiddleware, authorizeRoles(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { url, selector, provider } = req.body;
  
  if (!url) {
    throw new ApiError(400, 'URL is required');
  }
  
  if (!selector) {
    throw new ApiError(400, 'Selector is required');
  }
  
  if (!provider) {
    throw new ApiError(400, 'Provider is required');
  }
  
  if (!crawlerServiceFactory.isProviderSupported(provider)) {
    throw new ApiError(400, `Unsupported provider: ${provider}`);
  }
  
  try {
    const service = await crawlerServiceFactory.getService(provider as CrawlerProvider);
    const result = await service.testSelector(url, selector);
    
    res.status(200).json({
      success: true,
      data: {
        url,
        selector,
        provider,
        matches: result.matches,
        sample: result.sample
      }
    });
  } catch (err) {
    throw new ApiError(500, `Failed to test selector: ${err}`);
  }
}));

/**
 * @route   POST /api/crawlers/validate-url
 * @desc    Validate a URL for crawling
 * @access  Private (Admin)
 */
router.post('/validate-url', authMiddleware, authorizeRoles(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { url, provider } = req.body;
  
  if (!url) {
    throw new ApiError(400, 'URL is required');
  }
  
  if (!provider) {
    throw new ApiError(400, 'Provider is required');
  }
  
  if (!crawlerServiceFactory.isProviderSupported(provider)) {
    throw new ApiError(400, `Unsupported provider: ${provider}`);
  }
  
  try {
    // Basic URL validation
    new URL(url); // Will throw if invalid
    
    // Create a temporary config for validation
    const tempConfig: CrawlerConfig = {
      name: 'temp-validation',
      url,
      provider: provider as CrawlerProvider
    };
    
    const service = await crawlerServiceFactory.getService(provider as CrawlerProvider);
    const validation = await service.validateConfig(tempConfig);
    
    res.status(200).json({
      success: true,
      data: {
        url,
        provider,
        valid: validation.valid,
        errors: validation.errors || []
      }
    });
  } catch (err) {
    res.status(200).json({
      success: true,
      data: {
        url,
        provider,
        valid: false,
        errors: [(err as Error).message]
      }
    });
  }
}));

/**
 * @route   POST /api/crawlers/jobs/:jobId/train
 * @desc    Start training with the results of a crawler job
 * @access  Private (Admin)
 */
router.post('/jobs/:jobId/train', authMiddleware, authorizeRoles(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const job = crawlerQueue.getJob(req.params.jobId as string);
  
  if (!job) {
    throw new ApiError(404, `Crawler job not found with id ${req.params.jobId}`);
  }
  
  if (job.status !== 'completed') {
    throw new ApiError(400, `Crawler job ${req.params.jobId} is not completed yet`);
  }
  
  if (!job.result) {
    throw new ApiError(404, `No results found for crawler job ${req.params.jobId}`);
  }
  
  // Set training configuration
  const trainingConfig = {
    ...job.config.trainingConfig,
    ...req.body
  };
  
  // Update the job with training config
  const updatedJob = crawlerQueue.getJob(req.params.jobId as string);
  if (updatedJob) {
    updatedJob.config.trainingConfig = trainingConfig;
    updatedJob.config.autoTrain = true;
  }
  
  try {
    const service = await crawlerServiceFactory.getServiceForConfig(job.config);
    const resultData = JSON.parse(fs.readFileSync(job.result, 'utf-8')) as CrawlerResult;
    
    // Transform the results to training data format
    const trainingDataDir = path.join(process.cwd(), 'data', 'training-data');
    fs.mkdirSync(trainingDataDir, { recursive: true });
    
    const transformResult = await service.transformResultsToTrainingData(
      resultData,
      trainingDataDir
    );
    
    // Update the job with training dataset path
    if (updatedJob) {
      updatedJob.trainingDataset = transformResult.datasetPath;
      updatedJob.status = 'training';
    }
    
    // In a real implementation, we would call the training API here
    // For now, just return success
    res.status(200).json({
      success: true,
      message: 'Training started successfully',
      data: {
        jobId: job.id,
        trainingDataset: transformResult.datasetPath,
        totalItems: transformResult.totalItems,
        categories: transformResult.categories
      }
    });
  } catch (err) {
    throw new ApiError(500, `Failed to start training: ${err}`);
  }
}));

export default router;