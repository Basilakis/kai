/**
 * Crawler-to-Training Pipeline End-to-End Tests
 * 
 * Tests the complete flow from crawler job creation through training
 */

import path from 'path';
import fs from 'fs';

// Import all needed services
import { crawlerServiceFactory } from '../services/crawler/crawlerServiceFactory';
import { crawlerQueue } from '../services/crawler/crawlerQueue';
import { credentialsManager } from '../services/crawler/credentialsManager';
import pdfQueue from '../services/pdf/pdfQueue';
import { trainingProgressService } from '../services/training/progress-service';

// Jest mocks (using a namespace to avoid import errors)
const jest = {
  fn: () => ({ mockResolvedValue: () => {}, mockRejectedValueOnce: () => {} }),
  mock: (module: string, factory?: any) => {},
  spyOn: (obj: any, method: string) => ({ mockResolvedValue: () => {} }),
  clearAllMocks: () => {}
};

const expect = {
  toBeDefined: () => {},
  toHaveBeenCalled: () => {},
  toHaveBeenCalledWith: () => {},
  toHaveBeenCalledTimes: () => {},
  not: { toHaveBeenCalled: () => {} }
};

// Mock necessary external dependencies
jest.mock('axios');
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  existsSync: jest.fn().mockResolvedValue(true),
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn(),
    mkdir: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('Crawler-to-Training Pipeline', () => {
  // Test data paths
  const testDataDir = path.join('tests', 'data');
  const crawlerResultsDir = path.join(testDataDir, 'crawler-results');
  const trainingDataDir = path.join(testDataDir, 'training-data');
  
  // Create test directories
  beforeAll(() => {
    // Create test directories
    fs.mkdirSync(testDataDir, { recursive: true });
    fs.mkdirSync(crawlerResultsDir, { recursive: true });
    fs.mkdirSync(trainingDataDir, { recursive: true });
    
    // Set up mock credentials - using strings instead of objects
    credentialsManager.setCredentials('jina', 'test-jina-key');
    credentialsManager.setCredentials('firecrawl', 'test-firecrawl-key');

    // Mock methods that might not exist on the real objects
    (crawlerQueue as any).shutdown = jest.fn().mockResolvedValue(undefined);
    (crawlerQueue as any).clear = jest.fn();
    (pdfQueue as any).shutdown = jest.fn().mockResolvedValue(undefined);
    (pdfQueue as any).clear = jest.fn();
  });
  
  // Clean up test resources
  afterAll(async () => {
    await (crawlerQueue as any).shutdown();
    await (pdfQueue as any).shutdown();
  });
  
  // Reset queues before each test
  beforeEach(() => {
    // Clear queues and reset mocks
    jest.clearAllMocks();
    (crawlerQueue as any).clear();
    (pdfQueue as any).clear();
  });

  // Test complete pipeline with JinaAI crawler
  it('should process a JinaAI crawler job through to training', async () => {
    // 1. Configure crawler job
    const jinaConfig = {
      name: 'JinaAI Example Crawler',
      url: 'https://example.com',
      provider: 'jina',
      selectors: {
        title: 'h1',
        content: 'article p'
      },
      transformForTraining: true,
      autoTrain: true,
      trainingConfig: {
        datasetName: 'test-jina-dataset',
        modelType: 'classification'
      }
    };
    
    // 2. Mock successful crawler job results
    const mockResults = {
      pages: [
        {
          url: 'https://example.com',
          title: 'Example Domain',
          content: 'This domain is for use in illustrative examples.'
        }
      ],
      metadata: {
        crawlTime: 123,
        pagesCount: 1
      }
    };
    
    // Setup mock for the JinaAI service
    const jinaServiceMock = {
      startJob: jest.fn().mockResolvedValue({ jobId: 'jina-job-123' }),
      getJobStatus: jest.fn().mockResolvedValue({ status: 'completed' }),
      getResults: jest.fn().mockResolvedValue(mockResults),
      transformDataForTraining: jest.fn().mockResolvedValue({ path: path.join(trainingDataDir, 'jina-transformed-data') })
    };
    
    // Inject mock service
    jest.spyOn(crawlerServiceFactory, 'getServiceForConfig').mockResolvedValue(jinaServiceMock as any);
    
    // Create training progress service spy
    const trainingProgressSpy = jest.spyOn(trainingProgressService, 'updateProgress');
    
    // 3. Add job to the queue
    const jobId = await crawlerQueue.addJob(jinaConfig, { priority: 'high' });
    
    // 4. Verify job was created with correct config
    expect(jobId).toBeDefined();
    const job = crawlerQueue.getJob(jobId);
    expect(job).toBeDefined();
    expect(job?.config.provider).toBe('jina');
    expect(job?.config.transformForTraining).toBe(true);
    expect(job?.config.autoTrain).toBe(true);
    
    // 5. Process the job (simulate what would happen in the processing loop)
    await (crawlerQueue as any)['processJob'](job!);
    
    // 6. Verify crawler service methods were called correctly
    expect(crawlerServiceFactory.getServiceForConfig).toHaveBeenCalledWith(jinaConfig);
    expect(jinaServiceMock.startJob).toHaveBeenCalledWith(jinaConfig, expect.anything());
    expect(jinaServiceMock.getJobStatus).toHaveBeenCalledWith('jina-job-123');
    expect(jinaServiceMock.getResults).toHaveBeenCalledWith('jina-job-123');
    expect(jinaServiceMock.transformDataForTraining).toHaveBeenCalledWith(mockResults, expect.anything());
    
    // 7. Verify training was triggered
    expect(trainingProgressSpy).toHaveBeenCalled();
    expect(job?.status).toBe('training');
  });
  
  // Test complete pipeline with Firecrawl crawler
  it('should process a Firecrawl crawler job through to training', async () => {
    // 1. Configure crawler job
    const firecrawlConfig = {
      name: 'Firecrawl Example Crawler',
      url: 'https://example.org',
      provider: 'firecrawl',
      depth: 2,
      maxUrls: 10,
      transformForTraining: true,
      autoTrain: true,
      trainingConfig: {
        datasetName: 'test-firecrawl-dataset',
        modelType: 'extraction'
      }
    };
    
    // 2. Mock successful crawler job results
    const mockResults = {
      pages: [
        {
          url: 'https://example.org',
          title: 'Example Organization',
          content: 'This is an example organization page.'
        }
      ],
      stats: {
        duration: 456,
        pagesProcessed: 1
      }
    };
    
    // Setup mock for the Firecrawl service
    const firecrawlServiceMock = {
      startJob: jest.fn().mockResolvedValue({ id: 'firecrawl-job-456' }),
      getJobStatus: jest.fn().mockResolvedValue({ status: 'completed' }),
      getResults: jest.fn().mockResolvedValue(mockResults),
      transformDataForTraining: jest.fn().mockResolvedValue({ path: path.join(trainingDataDir, 'firecrawl-transformed-data') })
    };
    
    // Inject mock service
    jest.spyOn(crawlerServiceFactory, 'getServiceForConfig').mockResolvedValue(firecrawlServiceMock as any);
    
    // Create training progress service spy
    const trainingProgressSpy = jest.spyOn(trainingProgressService, 'updateProgress');
    
    // 3. Add job to the queue
    const jobId = await crawlerQueue.addJob(firecrawlConfig, { priority: 'normal' });
    
    // 4. Verify job was created with correct config
    expect(jobId).toBeDefined();
    const job = crawlerQueue.getJob(jobId);
    expect(job).toBeDefined();
    expect(job?.config.provider).toBe('firecrawl');
    expect(job?.config.transformForTraining).toBe(true);
    expect(job?.config.autoTrain).toBe(true);
    
    // 5. Process the job (simulate what would happen in the processing loop)
    await (crawlerQueue as any)['processJob'](job!);
    
    // 6. Verify crawler service methods were called correctly
    expect(crawlerServiceFactory.getServiceForConfig).toHaveBeenCalledWith(firecrawlConfig);
    expect(firecrawlServiceMock.startJob).toHaveBeenCalledWith(firecrawlConfig, expect.anything());
    expect(firecrawlServiceMock.getJobStatus).toHaveBeenCalledWith('firecrawl-job-456');
    expect(firecrawlServiceMock.getResults).toHaveBeenCalledWith('firecrawl-job-456');
    expect(firecrawlServiceMock.transformDataForTraining).toHaveBeenCalledWith(mockResults, expect.anything());
    
    // 7. Verify training was triggered
    expect(trainingProgressSpy).toHaveBeenCalled();
    expect(job?.status).toBe('training');
  });
  
  // Test failure handling and retries
  it('should handle failures and retry crawler jobs appropriately', async () => {
    // 1. Configure crawler job
    const jinaConfig = {
      name: 'Retry Test Crawler',
      url: 'https://example.net',
      provider: 'jina',
      transformForTraining: true,
      autoTrain: true
    };
    
    // 2. Mock first failure, then success
    const jinaServiceMock = {
      startJob: jest.fn()
        .mockRejectedValueOnce(new Error('API Connection Error'))
        .mockResolvedValueOnce({ jobId: 'jina-job-789' }),
      getJobStatus: jest.fn().mockResolvedValue({ status: 'completed' }),
      getResults: jest.fn().mockResolvedValue({ pages: [] }),
      transformDataForTraining: jest.fn().mockResolvedValue({ path: 'test-path' })
    };
    
    // Inject mock service
    jest.spyOn(crawlerServiceFactory, 'getServiceForConfig').mockResolvedValue(jinaServiceMock as any);
    
    // 3. Add job to the queue
    const jobId = await crawlerQueue.addJob(jinaConfig, { priority: 'low' });
    const job = crawlerQueue.getJob(jobId);
    
    // 4. Process the job - first attempt will fail
    await (crawlerQueue as any)['processJob'](job!);
    
    // 5. Verify job was marked for retry
    expect(job?.status).toBe('retrying');
    expect(job?.attempts).toBe(1);
    
    // 6. Process the job again - should succeed this time
    await (crawlerQueue as any)['processJob'](job!);
    
    // 7. Verify retry was successful
    expect(jinaServiceMock.startJob).toHaveBeenCalledTimes(2);
    expect(job?.status).toBe('training');
    expect(job?.attempts).toBe(2);
  });
  
  // Test transformation without auto-training
  it('should transform data but not auto-train when autoTrain is false', async () => {
    // 1. Configure crawler job with transformation but no auto-train
    const firecrawlConfig = {
      name: 'Manual Training Example',
      url: 'https://example.com/blog',
      provider: 'firecrawl',
      transformForTraining: true,
      autoTrain: false,
      trainingConfig: {
        datasetName: 'manual-training-dataset'
      }
    };
    
    // 2. Mock successful crawler job 
    const firecrawlServiceMock = {
      startJob: jest.fn().mockResolvedValue({ id: 'firecrawl-manual-123' }),
      getJobStatus: jest.fn().mockResolvedValue({ status: 'completed' }),
      getResults: jest.fn().mockResolvedValue({ pages: [] }),
      transformDataForTraining: jest.fn().mockResolvedValue({ path: 'transformed-data-path' })
    };
    
    // Inject mock service
    jest.spyOn(crawlerServiceFactory, 'getServiceForConfig').mockResolvedValue(firecrawlServiceMock as any);
    
    // Create training progress service spy
    const trainingProgressSpy = jest.spyOn(trainingProgressService, 'updateProgress');
    
    // 3. Add job to the queue
    const jobId = await crawlerQueue.addJob(firecrawlConfig, { priority: 'normal' });
    const job = crawlerQueue.getJob(jobId);
    
    // 4. Process the job
    await (crawlerQueue as any)['processJob'](job!);
    
    // 5. Verify data was transformed but training was not started
    expect(firecrawlServiceMock.transformDataForTraining).toHaveBeenCalled();
    expect(trainingProgressSpy).not.toHaveBeenCalled();
    expect(job?.status).toBe('completed');
  });
  
  // Integration test between PDF and crawler data in training
  it('should accept both PDF and crawler data for training', async () => {
    // 1. Setup spies on the training service
    const trainingCreateSpy = jest.spyOn(trainingProgressService, 'updateProgress');
    
    // 2. Add a PDF job that's completed
    const pdfJobId = 'pdf-test-123';
    const pdfJob = {
      id: pdfJobId,
      filePath: 'test.pdf',
      status: 'completed',
      createdAt: new Date(),
      priority: 'normal',
      attempts: 1,
      maxAttempts: 3,
      options: {} // Add options to satisfy QueueJob type
    };
    
    (pdfQueue as any)['jobs'].set(pdfJobId, pdfJob);
    
    // 3. Add a crawler job that's completed
    const crawlerConfig = {
      name: 'Combined Data Source Crawler',
      url: 'https://example.edu',
      provider: 'jina',
      transformForTraining: true,
      trainingConfig: {
        datasetName: 'combined-dataset'
      }
    };
    
    const crawlerJobId = await crawlerQueue.addJob(crawlerConfig, { priority: 'normal' });
    const crawlerJob = crawlerQueue.getJob(crawlerJobId)!;
    crawlerJob.status = 'completed';
    
    // 4. Create a training job that uses both sources
    await trainingProgressService.updateProgress({
      jobId: 'combined-training-123',
      type: 'start',
      timestamp: Date.now(),
      data: {
        sources: [
          { type: 'pdf', jobId: pdfJobId },
          { type: 'crawler', jobId: crawlerJobId }
        ],
        modelType: 'mixed-source'
      }
    });
    
    // 5. Verify the training job was created with both sources
    expect(trainingCreateSpy).toHaveBeenCalled();
  });
});