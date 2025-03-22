# Web Crawling System

The Web Crawling System is a specialized component of Kai that enables automated collection of material data from websites and online catalogs. This document details the system's capabilities, architecture, and implementation.

## Features

### Multi-Provider Crawler Support

The system integrates with multiple specialized crawling services:

1. **Provider Ecosystem**
   - JinaAI: Advanced ML-powered crawler with intelligent content extraction
   - Firecrawl: High-performance crawler optimized for scale and speed
   - Internal: Built-in crawling capabilities for specialized scenarios
   - Custom: Extensible framework for additional providers

2. **Provider Management**
   - Dynamic provider selection based on content type and requirements
   - Credential management for secure API key storage
   - Provider-specific configuration options
   - Automatic fallback mechanisms
   - Performance monitoring across providers

3. **Unified Interface**
   - Common configuration schema across providers
   - Standardized job lifecycle management
   - Consistent result formats for downstream processing
   - Provider-agnostic queuing system
   - Centralized monitoring and reporting

### Intelligent Crawling Capabilities

The system offers advanced crawling functionality:

1. **Crawl Configuration**
   - URL targeting with domain boundary control
   - Crawl depth and breadth customization
   - Rate limiting and politeness settings
   - Content type filtering
   - Regular expression-based URL matching

2. **Content Extraction**
   - Intelligent material identification
   - Structured data extraction from HTML
   - Image and specification association
   - Metadata capture from context
   - Taxonomy mapping and categorization

3. **Selective Harvesting**
   - Material-focused extraction rules
   - Product page identification
   - Catalog structure understanding
   - Relevant content prioritization
   - Noise and decoration filtering

### Queue and Job Management

The system includes comprehensive job management:

1. **Job Lifecycle**
   - Configurable job creation with priorities
   - Status tracking throughout execution
   - Real-time progress updates
   - Error handling and recovery
   - Completion notification

2. **Queue Optimization**
   - Priority-based processing
   - Concurrent job management
   - Resource allocation based on job type
   - Scheduling for off-peak execution
   - Rate limiting to respect target sites

3. **Administrative Controls**
   - Job inspection and monitoring
   - Manual intervention capabilities
   - Retry mechanisms for failed jobs
   - Queue clearing and management
   - Result inspection and validation

### Training Data Integration

The system prepares crawled data for ML training:

1. **Data Transformation**
   - Structured formatting for training pipeline
   - Automatic labeling based on source context
   - Image preprocessing for ML readiness
   - Metadata enrichment for context
   - Quality filtering for training suitability

2. **Dataset Management**
   - Versioned dataset creation
   - Class organization and balancing
   - Metadata preservation for provenance
   - Validation against training requirements
   - Integration with existing datasets

3. **Training Pipeline Integration**
   - Optional automatic training initiation
   - Training parameter inference from content
   - Crawl-to-model automated workflow
   - Performance metrics collection
   - Continuous improvement through crawl-train cycles

## Technical Implementation

### Crawler Service Factory

The system uses a factory pattern for crawler service instantiation:

```typescript
/**
 * Factory for creating crawler services based on configuration
 */
class CrawlerServiceFactory {
  /**
   * Get the list of available crawler providers
   * @returns Array of supported providers
   */
  public getAvailableProviders(): CrawlerProvider[] {
    return ['firecrawl', 'jina', 'internal', 'custom'];
  }

  /**
   * Check if a provider is supported
   * @param provider Provider to check
   * @returns Boolean indicating support status
   */
  public isProviderSupported(provider: string): boolean {
    return this.getAvailableProviders().includes(provider as CrawlerProvider);
  }

  /**
   * Get a crawler service instance for a specific provider
   * @param provider The crawler provider to use
   * @returns Promise resolving to a crawler service
   */
  public async getService(provider: CrawlerProvider): Promise<CrawlerService> {
    // Get credentials for the provider
    const credentials = credentialsManager.getCredentials(provider);
    
    switch (provider) {
      case 'firecrawl':
        return new FirecrawlService(credentials);
      case 'jina':
        return new JinaService(credentials);
      case 'internal':
        return new InternalCrawlerService();
      case 'custom':
        return new CustomCrawlerService(credentials);
      default:
        throw new Error(`Unsupported crawler provider: ${provider}`);
    }
  }

  /**
   * Get a crawler service based on a configuration object
   * @param config Crawler configuration
   * @returns Promise resolving to an appropriate crawler service
   */
  public async getServiceForConfig(config: CrawlerConfig): Promise<CrawlerService> {
    // Validate config first
    validateCrawlerConfig(config);
    
    // Get appropriate service based on provider
    return this.getService(config.provider as CrawlerProvider);
  }
}

// Export singleton instance
export const crawlerServiceFactory = new CrawlerServiceFactory();
```

### Crawler Service Interface

The system defines a common interface for all crawler services:

```typescript
/**
 * Interface for crawler services
 */
interface CrawlerService {
  /**
   * Start a crawl job
   * @param config Crawler configuration
   * @param options Job options
   * @returns Promise with job details
   */
  startJob(config: CrawlerConfig, options?: JobOptions): Promise<{ id: string }>;
  
  /**
   * Get status of a crawl job
   * @param jobId External job ID
   * @returns Promise with job status
   */
  getJobStatus(jobId: string): Promise<{ status: CrawlerJobStatus }>;
  
  /**
   * Cancel a crawl job
   * @param jobId External job ID
   * @returns Promise with cancellation status
   */
  cancelJob(jobId: string): Promise<{ success: boolean }>;
  
  /**
   * Get results from a completed crawl job
   * @param jobId External job ID
   * @returns Promise with crawl results
   */
  getResults(jobId: string): Promise<CrawlResult>;
  
  /**
   * Transform crawl results for training
   * @param results Crawl results
   * @param options Transformation options
   * @returns Promise with transformation results
   */
  transformDataForTraining(
    results: CrawlResult, 
    options: TransformOptions
  ): Promise<{ path: string }>;
}
```

### Crawler Queue Implementation

The system provides a queue for managing crawler jobs:

```typescript
/**
 * Manages queue of crawler jobs
 */
class CrawlerQueue {
  private jobs: Map<string, CrawlerJob> = new Map();
  private processing: Set<string> = new Set();
  private config: QueueConfig;
  private adapter: QueueAdapter;
  
  /**
   * Initialize crawler queue
   * @param config Queue configuration
   */
  constructor(config: QueueConfig) {
    this.config = {
      maxConcurrentJobs: 5,
      retryLimit: 3,
      ...config
    };
    
    this.adapter = createCrawlerQueueAdapter();
    this.initMessageHandlers();
  }
  
  /**
   * Add a job to the queue
   * @param config Crawler configuration
   * @param options Job options
   * @returns Promise with job ID
   */
  public async addJob(
    config: CrawlerConfig, 
    options: { priority?: 'high' | 'normal' | 'low' } = {}
  ): Promise<string> {
    // Create a new job with unique ID
    const jobId = uuid();
    const priority = this.getPriorityValue(options.priority || 'normal');
    
    const job: CrawlerJob = {
      id: jobId,
      config,
      provider: config.provider,
      status: 'pending',
      priority,
      createdAt: Date.now(),
      progress: 0
    };
    
    // Store job in queue
    this.jobs.set(jobId, job);
    
    // Notify about new job
    await this.adapter.publishEvent('job_added', { 
      jobId, 
      provider: config.provider,
      priority
    });
    
    // Start processing loop if not already running
    this.startProcessing();
    
    return jobId;
  }
  
  /**
   * Get a job by ID
   * @param jobId Job ID
   * @returns Crawler job or undefined if not found
   */
  public getJob(jobId: string): CrawlerJob | undefined {
    return this.jobs.get(jobId);
  }
  
  /**
   * Get all jobs
   * @returns Array of all crawler jobs
   */
  public getAllJobs(): Map<string, CrawlerJob> {
    return this.jobs;
  }
  
  /**
   * Remove a job from the queue
   * @param jobId Job ID
   * @returns Boolean indicating success
   */
  public async removeJob(jobId: string): Promise<boolean> {
    // Can't remove jobs that are currently processing
    if (this.processing.has(jobId)) {
      return false;
    }
    
    const removed = this.jobs.delete(jobId);
    
    if (removed) {
      await this.adapter.publishEvent('job_removed', { jobId });
    }
    
    return removed;
  }
  
  // Additional implementation details...
}

// Export singleton instance
export const crawlerQueue = new CrawlerQueue({
  maxConcurrentJobs: 5,
  retryLimit: 3
});
```

### Crawler Adapter for Training

The system includes a Python adapter for preparing crawler data for training:

```python
class CrawlerDataAdapter:
    """Class for adapting crawler data for material recognition training"""
    
    def __init__(self, data_dir, output_dir):
        """
        Initialize the crawler data adapter
        
        Args:
            data_dir: Directory containing crawler data
            output_dir: Directory to save adapted data for training
        """
        self.data_dir = data_dir
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def prepare_data(self, manifest_path, min_images_per_class=10):
        """
        Prepare crawler data for training
        
        Args:
            manifest_path: Path to the crawler dataset manifest file
            min_images_per_class: Minimum number of images required per class
            
        Returns:
            Dictionary with preparation results
        """
        if not os.path.exists(manifest_path):
            return {
                "status": "error",
                "message": f"Manifest file not found: {manifest_path}",
                "dataset_path": None
            }
        
        # Create dataset directory
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        dataset_name = f"crawler_dataset_{timestamp}"
        dataset_dir = os.path.join(self.output_dir, dataset_name)
        os.makedirs(dataset_dir, exist_ok=True)
        
        # Load manifest
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
        
        # Process and organize images
        # Implementation details...
        
        # Create metadata file
        metadata = {
            "dataset_name": dataset_name,
            "created_at": datetime.now().isoformat(),
            "source": manifest.get("source", "crawler"),
            "job_id": manifest.get("job_id"),
            "image_count": total_images,
            "class_count": len(class_counts),
            "class_distribution": class_counts,
            "download_errors": download_errors,
            "data_provenance": "crawler",
            "min_images_per_class": min_images_per_class,
            "manifest_path": manifest_path
        }
        
        # Save metadata
        metadata_path = os.path.join(dataset_dir, "metadata.json")
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return {
            "status": "success",
            "message": f"Created dataset with {total_images} images across {len(class_counts)} classes",
            "dataset_path": dataset_dir,
            "metadata": metadata
        }
    
    # Additional methods for validating and processing crawler data...
```

### Credentials Management

The system securely manages crawler provider credentials:

```typescript
/**
 * Manages credentials for crawler services
 */
class CredentialsManager {
  private credentials: Map<string, string> = new Map();
  private encryptionKey: string;
  
  constructor() {
    // Initialize encryption key (in production, use secure methods)
    this.encryptionKey = process.env.CREDENTIALS_ENCRYPTION_KEY || 'default-key';
    this.loadCredentials();
  }
  
  /**
   * Set credentials for a provider
   * @param provider Provider name
   * @param apiKey API key for the provider
   * @returns Success status
   */
  public setCredentials(provider: string, apiKey: string): boolean {
    try {
      // Encrypt the API key before storing
      const encryptedKey = this.encrypt(apiKey);
      
      // Store in memory
      this.credentials.set(provider, encryptedKey);
      
      // Persist to storage
      this.saveCredentials();
      
      return true;
    } catch (error) {
      logger.error(`Failed to set credentials for ${provider}: ${error}`);
      return false;
    }
  }
  
  /**
   * Get credentials for a provider
   * @param provider Provider name
   * @returns Decrypted API key or null if not found
   */
  public getCredentials(provider: string): string | null {
    const encryptedKey = this.credentials.get(provider);
    
    if (!encryptedKey) {
      return null;
    }
    
    try {
      // Decrypt the stored key
      return this.decrypt(encryptedKey);
    } catch (error) {
      logger.error(`Failed to retrieve credentials for ${provider}: ${error}`);
      return null;
    }
  }
  
  /**
   * Check if credentials exist for a provider
   * @param provider Provider name
   * @returns Boolean indicating if credentials exist
   */
  public hasCredentials(provider: string): boolean {
    return this.credentials.has(provider);
  }
  
  /**
   * Remove credentials for a provider
   * @param provider Provider name
   * @returns Success status
   */
  public removeCredentials(provider: string): boolean {
    if (!this.credentials.has(provider)) {
      return false;
    }
    
    this.credentials.delete(provider);
    this.saveCredentials();
    
    return true;
  }
  
  // Private helper methods for loading, saving, encrypting, and decrypting
  // Implementation details...
}

// Export singleton instance
export const credentialsManager = new CredentialsManager();
```

## Integration with Other Systems

### PDF Processing Pipeline

The web crawling system integrates with the PDF processing system:

1. **Automatic PDF Handling**
   - Detection of PDF catalogs during crawling
   - Automatic submission to PDF processing queue
   - Association of crawled context with PDFs
   - Correlation of PDF extraction results with web data
   - Combined knowledge extraction from both sources

2. **Cross-Source Validation**
   - Web data used to validate PDF extraction
   - PDF content used to enhance web data extraction
   - Confidence scoring based on multi-source correlation
   - Conflict resolution for disparate information
   - Complete material profiles from combined sources

3. **Workflow Orchestration**
   - Sequential processing from web to PDF
   - Parallel extraction for efficiency
   - Coordinated job prioritization
   - Status monitoring across both systems
   - Unified result presentation

### Training Pipeline

The web crawling system feeds the training pipeline:

1. **Dataset Creation**
   - Automatic dataset generation from crawler results
   - Class organization based on material categories
   - Image processing for training readiness
   - Metadata annotation for context
   - Quality filtering for training suitability

2. **Training Integration**
   - Optional automatic training initiation
   - Configurable training parameters
   - Progress monitoring and reporting
   - Model versioning tied to crawler sources
   - Performance evaluation against source quality

3. **Continuous Improvement**
   - Feedback loop from model performance to crawling
   - Targeted recrawling for underperforming categories
   - Quality metrics influencing crawler configurations
   - Incremental dataset updates
   - Validation against existing material data

### Knowledge Base

The web crawling system enriches the knowledge base:

1. **Knowledge Extraction**
   - Structured data extraction from web sources
   - Entity recognition and classification
   - Relationship identification between materials
   - Attribute extraction for material properties
   - Hierarchical categorization

2. **Knowledge Integration**
   - Merging with existing knowledge entities
   - Conflict resolution for contradictory information
   - Confidence scoring for source reliability
   - Provenance tracking for attribution
   - Version control for knowledge evolution

3. **Search Enhancement**
   - Web-sourced data improving search relevance
   - Extracted terminology enhancing query understanding
   - Additional context for disambiguation
   - Rich metadata for filtering
   - Comprehensive material profiles for accurate matching

## API Usage Examples

### Basic Crawler Configuration

```typescript
import { validateCrawlerConfig } from '@kai/shared/utils/validation';
import { crawlerQueue } from '@kai/server/services/crawler/crawlerQueue';

async function configureCrawler() {
  try {
    // Create a crawler configuration for JinaAI
    const jinaConfig = {
      id: generateUUID(),
      name: 'Tile Manufacturer Catalog Crawler',
      url: 'https://example-tile-company.com/products',
      provider: 'jina',
      depth: 3,
      extractionRules: [
        {
          selector: '.product-item',
          fields: [
            { name: 'name', selector: '.product-title', attribute: 'text' },
            { name: 'code', selector: '.product-code', attribute: 'text' },
            { name: 'dimensions', selector: '.dimensions', attribute: 'text' },
            { name: 'material', selector: '.material-type', attribute: 'text' },
            { name: 'image', selector: '.product-image img', attribute: 'src' }
          ]
        }
      ],
      schedule: {
        frequency: 'weekly',
        day: 'monday',
        time: '01:00'
      },
      status: 'scheduled'
    };
    
    // Validate the configuration
    validateCrawlerConfig(jinaConfig);
    
    // Add the job to the queue with high priority
    const jobId = await crawlerQueue.addJob(jinaConfig, { priority: 'high' });
    
    console.log(`Crawler job created with ID: ${jobId}`);
    
    return jobId;
  } catch (error) {
    console.error('Crawler configuration failed:', error);
    throw error;
  }
}
```

### Monitoring Crawler Jobs

```typescript
import { crawlerQueue } from '@kai/server/services/crawler/crawlerQueue';
import { messageBroker } from '@kai/server/services/messaging/messageBroker';

async function monitorCrawlerJobs() {
  try {
    // Get all active crawler jobs
    const jobs = Array.from(crawlerQueue.getAllJobs().values());
    const activeJobs = jobs.filter(job => 
      job.status === 'pending' || job.status === 'processing'
    );
    
    console.log(`Monitoring ${activeJobs.length} active crawler jobs`);
    
    // Subscribe to crawler job events
    const unsubscribe = await messageBroker.subscribe('crawler', (event) => {
      const { type, data } = event;
      
      switch (type) {
        case 'job_started':
          console.log(`Job ${data.jobId} started at ${new Date().toISOString()}`);
          break;
        case 'job_progress':
          console.log(`Job ${data.jobId} progress: ${data.progress}%`);
          break;
        case 'job_completed':
          console.log(`Job ${data.jobId} completed at ${new Date().toISOString()}`);
          console.log(`Results: ${data.resultCount} items extracted`);
          break;
        case 'job_failed':
          console.error(`Job ${data.jobId} failed: ${data.error}`);
          break;
      }
    });
    
    // In a real application, you'd keep the subscription active
    // For this example, we'll unsubscribe after a short delay
    setTimeout(() => {
      unsubscribe();
      console.log('Stopped monitoring crawler jobs');
    }, 3600000); // 1 hour
    
    return activeJobs;
  } catch (error) {
    console.error('Job monitoring failed:', error);
    throw error;
  }
}
```

### Processing Crawler Results for Training

```typescript
import { prepareCrawlerDataForTraining } from '@kai/ml';

async function prepareTrainingDataFromCrawler(jobId: string) {
  try {
    // Configure options for data preparation
    const options = {
      jobId: jobId,
      inputDir: `./data/crawler-results/${jobId}`,
      outputDir: './data/training-datasets',
      minImagesPerClass: 20,
      imageSize: {
        width: 512,
        height: 512
      },
      augmentData: true,
      validationSplit: 0.2
    };
    
    // Prepare the crawler data for training
    const result = await prepareCrawlerDataForTraining(options);
    
    console.log(`Crawler data preparation completed`);
    console.log(`Dataset path: ${result.datasetPath}`);
    console.log(`Class count: ${result.classCount}`);
    console.log(`Total images: ${result.imageCount}`);
    
    // Automatically start training if preparation was successful
    if (result.status === 'success' && result.datasetPath) {
      console.log('Starting training process with prepared data...');
      
      // Code to initiate training would go here
      // For example:
      // const trainingJobId = await startTraining({
      //   datasetPath: result.datasetPath,
      //   modelType: 'materialRecognition',
      //   epochs: 50
      // });
    }
    
    return result;
  } catch (error) {
    console.error('Crawler data preparation failed:', error);
    throw error;
  }
}
```

### Managing Crawler Credentials

```typescript
import { credentialsManager } from '@kai/server/services/crawler/credentialsManager';

async function manageCrawlerCredentials() {
  try {
    // Check for existing credentials
    const hasJinaCredentials = credentialsManager.hasCredentials('jina');
    const hasFirecrawlCredentials = credentialsManager.hasCredentials('firecrawl');
    
    console.log(`JinaAI credentials: ${hasJinaCredentials ? 'Configured' : 'Not configured'}`);
    console.log(`Firecrawl credentials: ${hasFirecrawlCredentials ? 'Configured' : 'Not configured'}`);
    
    // Set new credentials (typically from a secure environment or user input)
    const jinaApiKey = process.env.JINA_API_KEY || 'secure-api-key-from-user-input';
    
    if (jinaApiKey && jinaApiKey !== 'secure-api-key-from-user-input') {
      const success = credentialsManager.setCredentials('jina', jinaApiKey);
      
      if (success) {
        console.log('JinaAI credentials updated successfully');
      } else {
        console.error('Failed to update JinaAI credentials');
      }
    }
    
    // Validate credentials by testing the connection
    if (credentialsManager.hasCredentials('jina')) {
      // Code to test connection would go here
      console.log('JinaAI connection successful');
    }
    
    return {
      jina: credentialsManager.hasCredentials('jina'),
      firecrawl: credentialsManager.hasCredentials('firecrawl')
    };
  } catch (error) {
    console.error('Credential management failed:', error);
    throw error;
  }
}
```

## Performance Considerations

1. **Crawling Efficiency**
   - Configurable concurrency levels for parallel crawling
   - Intelligent rate limiting to respect target servers
   - Caching mechanisms to avoid duplicate requests
   - Incremental crawling for regular updates
   - Resource-aware scheduling for optimal performance

2. **Resource Requirements**
   - CPU: Varies by provider; JinaAI more CPU-intensive for ML extraction
   - Memory: 4GB+ recommended, scales with concurrent jobs
   - Storage: Temporary space for crawl results (varies by scope)
   - Network: Reliable internet connection with adequate bandwidth
   - API Quota: Provider-specific limits on request volume

3. **Scaling Considerations**
   - Horizontal scaling for multiple concurrent crawls
   - Queue-based architecture for job distribution
   - Provider load balancing for optimal throughput
   - Asynchronous processing to maximize throughput
   - Rate limiting to respect external service constraints

4. **Storage Optimization**
   - Temporary storage for raw crawl results
   - Processed data persisted to permanent storage
   - Automatic cleanup of temporary files
   - Configurable retention policies
   - Storage efficiency through selective data extraction

5. **Integration Efficiency**
   - Pipeline architecture minimizing handoff overhead
   - Batch processing for downstream systems
   - Asynchronous event-based coordination
   - Prioritization based on business value
   - Caching of common data across subsystems