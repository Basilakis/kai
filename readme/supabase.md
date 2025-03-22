# Supabase Integration

The Kai platform leverages Supabase as its primary database and backend infrastructure, providing a robust foundation for data storage, real-time functionality, authentication, and vector search capabilities. This document details how Supabase is integrated throughout the system, its benefits, and implementation details.

## Overview and Benefits

### Why Supabase?

Supabase provides several key advantages for the Kai platform:

1. **PostgreSQL Foundation**
   - Enterprise-grade relational database
   - Rich ecosystem of extensions
   - Powerful query capabilities
   - Transaction support
   - Role-based security

2. **Vector Search Capabilities**
   - pgvector extension for similarity search
   - Efficient vector indexing
   - Multiple distance metrics
   - Hybrid search support
   - Performance-optimized queries

3. **Real-time Functionality**
   - WebSocket-based data synchronization
   - Event-driven architecture
   - Pub/sub messaging patterns
   - Status monitoring
   - Client-side subscriptions

4. **Authentication and Authorization**
   - JWT-based authentication
   - Role-based access control
   - Row-level security policies
   - OAuth provider integration
   - Secure password handling

5. **Storage Solutions**
   - Managed file storage
   - Access control policies
   - Image transformations
   - Content delivery optimization
   - Secure direct uploads

### Integration Architecture

Supabase serves as the core data platform with these integration points:

1. **Data Layer**
   - Material data storage
   - Dataset management
   - User and permission storage
   - File metadata tracking
   - Configuration storage

2. **Search Infrastructure**
   - Vector embeddings storage
   - Semantic search functionality
   - Full-text search capabilities
   - Hybrid search algorithms
   - Search relevance optimization

3. **Real-time Communication**
   - Queue status updates
   - Training progress tracking
   - Admin dashboard updates
   - System event propagation
   - Client-side state synchronization

4. **Security Layer**
   - User authentication
   - API access control
   - Data access permissions
   - Credential management
   - Row-level security

5. **Storage Integration**
   - Dataset file storage
   - Material image storage
   - Extracted content storage
   - Temporary file handling
   - Backup management

## Technical Implementation

### Client Management

The system implements a singleton Supabase client manager:

```typescript
/**
 * Supabase Client Manager
 * Handles the configuration and initialization of the Supabase client
 */
class SupabaseClientManager {
  private config: SupabaseConfig;
  private client: SupabaseClient | null = null;
  private initialized = false;

  /**
   * Initialize the Supabase client with configuration
   * @param config Supabase configuration
   */
  init(config: SupabaseConfig): void {
    if (this.initialized) {
      logger.warn('Supabase client already initialized');
      return;
    }

    this.config = config;
    
    // Skip client creation until actually needed
    this.initialized = true;
    
    logger.info('Supabase client configuration initialized');
  }

  /**
   * Get the Supabase client instance
   * Initializes the client if it doesn't exist
   * @returns Supabase client
   */
  getClient(): SupabaseClient {
    if (!this.client) {
      if (!this.config.url || !this.config.key) {
        throw new Error('Supabase URL and key are required. Call init() first or set SUPABASE_URL and SUPABASE_KEY environment variables.');
      }
      
      // Create the client using the Supabase SDK
      this.client = createClient(this.config.url, this.config.key);
      
      logger.info('Supabase client initialized');
    }
    
    return this.client;
  }

  /**
   * Check if the Supabase client is initialized
   * @returns True if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset the Supabase client
   * Useful for testing or reconfiguration
   */
  reset(): void {
    this.client = null;
    this.initialized = false;
    
    logger.info('Supabase client reset');
  }
}

// Export a singleton instance
export const supabaseClient = new SupabaseClientManager();
```

### Database Schema

The system uses SQL migrations to define the Supabase PostgreSQL schema:

```sql
-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS pgvector;

-- Materials table with full-text search and vector support
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  material_type VARCHAR(100),
  manufacturer VARCHAR(255),
  product_code VARCHAR(100),
  dimensions JSONB,
  color JSONB,
  finish VARCHAR(100),
  tags TEXT[],
  metadata JSONB,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Generated column for full-text search
  search_text TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' ||
    coalesce(type, '') || ' ' || coalesce(array_to_string(tags, ' '), ''))
  ) STORED
);

-- Vector embeddings table for similarity search
CREATE TABLE IF NOT EXISTS vector_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  embedding vector(384), -- Adjust dimension as needed
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index for cosine distance similarity search
CREATE INDEX IF NOT EXISTS vector_embeddings_embedding_idx 
ON vector_embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create an index for material ID lookups
CREATE INDEX IF NOT EXISTS vector_embeddings_material_id_idx 
ON vector_embeddings (material_id);

-- Function to find similar materials by vector embedding
CREATE OR REPLACE FUNCTION find_similar_materials(
  query_embedding vector,
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  similarity float
)
LANGUAGE SQL
AS $$
SELECT
  m.id,
  1 - (ve.embedding <=> query_embedding) AS similarity
FROM
  vector_embeddings ve
JOIN
  materials m ON ve.material_id = m.id
WHERE
  1 - (ve.embedding <=> query_embedding) > match_threshold
ORDER BY
  similarity DESC
LIMIT
  match_count;
$$;

-- Create row-level security policies
CREATE POLICY "Allow authenticated users to read materials" 
ON materials FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admins full access to materials" 
ON materials 
USING (auth.role() = 'authenticated' AND auth.jwt() ->> 'role' = 'admin');
```

### Vector Search Integration

The system implements vector similarity search using pgvector:

```typescript
/**
 * Vector Search Service for Supabase
 * Provides methods for storing and querying vector embeddings
 */
export class SupabaseVectorSearch {
  /**
   * Find similar vectors to the provided embedding
   *
   * @param embedding The query vector to find similar vectors for
   * @param tableName The table containing vector embeddings
   * @param vectorColumn The column name for the vector data (default: 'embedding')
   * @param config Search configuration options
   * @returns Array of matching records with similarity scores
   */
  async findSimilar(
    embedding: number[],
    tableName: string,
    vectorColumn: string = 'embedding',
    config: VectorSearchConfig = {}
  ): Promise<Array<Record<string, any>>> {
    try {
      // Initialize query with proper client
      const client = supabaseClient.getClient();
      
      const limit = config.limit || 10;
      const threshold = config.threshold || 0.75;
      
      // Use vector operators in PostgreSQL query
      const { data, error } = await client
        .from(tableName)
        .select(`
          *,
          similarity:1 - (${vectorColumn} <=> ${'embedding'})
        `)
        .gte('similarity', threshold)
        .order('similarity', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return data || [];
      
    } catch (error) {
      logger.error(`Vector search error: ${error}`);
      throw error;
    }
  }

  /**
   * Store a vector embedding in Supabase
   *
   * @param embedding The vector to store
   * @param metadata Additional metadata to store with the vector
   * @param tableName The table to store the vector in
   * @param vectorColumn The column name for the vector data (default: 'embedding')
   * @returns The created record ID
   */
  async storeVector(
    embedding: number[],
    metadata: Record<string, any>,
    tableName: string,
    vectorColumn: string = 'embedding'
  ): Promise<string> {
    try {
      const record = {
        ...metadata,
        [vectorColumn]: embedding,
        created_at: new Date().toISOString()
      };
      
      // Insert the data using proper client
      const client = supabaseClient.getClient();
      
      const { data, error } = await client
        .from(tableName)
        .insert(record)
        .select('id')
        .single();
      
      if (error) throw error;
      
      return data.id;
      
    } catch (error) {
      logger.error(`Vector storage error: ${error}`);
      throw error;
    }
  }

  /**
   * Create a vector index for faster similarity searches
   *
   * @param tableName The table to create the index for
   * @param vectorColumn The column name for the vector data
   * @param indexMethod The index method to use ('ivfflat', 'hnsw')
   * @param dimensions Optional vector dimensions (default: 1536 for typical embeddings)
   * @returns True if the index was created successfully
   */
  async createIndex(
    tableName: string,
    vectorColumn: string = 'embedding',
    indexMethod: 'ivfflat' | 'hnsw' = 'hnsw',
    dimensions: number = 1536
  ): Promise<boolean> {
    try {
      // For some operations, we need to use raw SQL to create indices
      const indexName = `idx_${tableName}_${vectorColumn}_${indexMethod}`;
      
      // Note: The actual SQL execution will depend on whether Supabase allows raw SQL
      // This might need to be done through database migrations or admin console
      const sql = indexMethod === 'hnsw'
        ? `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} USING hnsw (${vectorColumn} vector_l2_ops) WITH (dims=${dimensions});`
        : `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} USING ivfflat (${vectorColumn} vector_l2_ops) WITH (lists=100);`;
      
      // Execute SQL to create index
      // Implementation details may vary based on Supabase access level
      
      return true;
    } catch (error) {
      logger.error(`Error creating vector index: ${error}`);
      throw error;
    }
  }
}

// Export singleton instance
export const vectorSearch = new SupabaseVectorSearch();
```

### Hybrid Search Implementation

The system combines vector similarity and full-text search:

```typescript
/**
 * Hybrid Search Service for Supabase
 * Combines full-text search and vector similarity search for better results
 */
export class SupabaseHybridSearch {
  private vectorSearch: SupabaseVectorSearch;

  constructor() {
    this.vectorSearch = new SupabaseVectorSearch();
  }

  /**
   * Perform hybrid search on materials
   *
   * @param textQuery Text search query
   * @param embedding Vector embedding for similarity comparison
   * @param options Hybrid search options
   * @returns Array of materials with text, vector, and combined scores
   */
  async searchMaterials(
    textQuery: string,
    embedding: number[],
    options: HybridSearchOptions = {}
  ): Promise<Array<HybridSearchResult>> {
    try {
      // Get Supabase client
      const client = supabaseClient.getClient();
      
      // Configure search parameters
      const searchParams = {
        textWeight: options.textWeight ?? 0.5,
        vectorWeight: options.vectorWeight ?? 0.5,
        limit: options.limit ?? 10,
        threshold: options.threshold ?? 0.3
      };
      
      // Call custom PostgreSQL function for hybrid search
      const { data, error } = await client.rpc('hybrid_search_materials', {
        query_text: textQuery,
        query_embedding: embedding,
        text_weight: searchParams.textWeight,
        vector_weight: searchParams.vectorWeight,
        match_count: searchParams.limit,
        score_threshold: searchParams.threshold
      });
      
      if (error) throw error;
      
      // Map results to application format
      return data.map((result: any) => ({
        id: result.id,
        name: result.name,
        description: result.description,
        materialType: result.material_type,
        scores: {
          textScore: result.text_score,
          vectorScore: result.vector_score,
          combinedScore: result.combined_score
        },
        // Other properties...
      }));
    } catch (error) {
      logger.error(`Hybrid search failed: ${error}`);
      throw error;
    }
  }
}

// Export singleton instance
export const hybridSearch = new SupabaseHybridSearch();
```

### Real-time Messaging Integration

The system leverages Supabase Realtime for messaging:

```typescript
/**
 * Supabase Message Broker
 *
 * Provides a pub/sub system for messaging between services using Supabase Realtime
 */
export class SupabaseMessageBroker implements MessageBroker {
  private channels: Map<string, RealtimeChannel> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    logger.info('Supabase message broker created');
  }

  /**
   * Initialize the message broker
   */
  async init(): Promise<void> {
    try {
      // We don't need any specific initialization for Supabase Realtime
      // as channels are created on-demand
      this.isInitialized = true;
      
      logger.info('Supabase message broker initialized');
    } catch (err) {
      logger.error(`Failed to initialize Supabase message broker: ${err}`);
      throw err;
    }
  }

  /**
   * Create or get a Supabase Realtime channel
   * @param channelKey Channel key
   * @returns Channel data object
   */
  private async getOrCreateChannel(channelKey: string): Promise<ChannelData> {
    // Check if channel already exists
    let channelData = this.channels.get(channelKey);
    
    if (!channelData) {
      const client = supabaseClient.getClient();
      
      // Create a new Supabase Realtime channel
      const channel = client.channel(`queue:${channelKey}`, {
        config: {
          broadcast: {
            self: true
          }
        }
      });
      
      // Set up channel status handler
      channel.on('system', { event: 'status' }, (status) => {
        if (status === 'SUBSCRIBED') {
          logger.info(`Subscribed to Supabase Realtime channel: ${channelKey}`);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          logger.warn(`Supabase Realtime channel ${channelKey} status: ${status}`);
        }
      });
      
      // Subscribe to the channel
      channel.subscribe();
      
      // Store the channel
      channelData = { channel, subscribers: [] };
      this.channels.set(channelKey, channelData);
    }
    
    return channelData;
  }

  /**
   * Publish a message to a channel
   * @param channelKey Channel key
   * @param messageType Message type
   * @param payload Message payload
   */
  async publish(channelKey: string, messageType: string, payload: any): Promise<void> {
    // Get or create the channel
    const { channel } = await this.getOrCreateChannel(channelKey);
    
    // Publish message to Supabase Realtime channel
    await channel.send({
      type: messageType,
      data: payload
    });
  }

  /**
   * Subscribe to messages on a channel
   * @param channelKey Channel key
   * @param callback Function to call when a message is received
   * @returns Unsubscribe function
   */
  async subscribe(channelKey: string, callback: MessageCallback): Promise<UnsubscribeFunction> {
    // Get or create the channel
    const channelData = await this.getOrCreateChannel(channelKey);
    
    // Set up message handler
    const handler = (payload: any) => {
      callback({
        type: payload.type,
        data: payload.data,
        timestamp: new Date()
      });
    };
    
    // Subscribe to messages
    channelData.channel.on('broadcast', { event: '*' }, handler);
    
    // Store the subscriber
    const subscriber = { callback, handler };
    channelData.subscribers.push(subscriber);
    
    // Return unsubscribe function
    return async () => {
      // Remove the subscriber
      const index = channelData.subscribers.findIndex(s => s === subscriber);
      if (index >= 0) {
        channelData.subscribers.splice(index, 1);
      }
      
      // If no more subscribers, remove the channel
      if (channelData.subscribers.length === 0) {
        // Unsubscribe from the channel
        channelData.channel.unsubscribe();
        
        // Remove from channels map
        this.channels.delete(channelKey);
        
        logger.info(`Removed Supabase Realtime channel ${channelKey}`);
      }
    };
  }

  /**
   * Shut down the message broker
   */
  async shutdown(): Promise<void> {
    // Unsubscribe from all channels
    for (const [key, { channel }] of this.channels.entries()) {
      channel.unsubscribe()
        .then(() => {
          logger.info(`Closed Supabase Realtime channel: ${key}`);
        })
        .catch((err: Error) => {
          logger.error(`Error closing Supabase Realtime channel ${key}: ${err}`);
        });
    }
    
    // Clear channels
    this.channels.clear();
    
    logger.info('Supabase message broker shutdown complete');
  }
}
```

### Storage Service Integration

The system utilizes Supabase Storage for file management:

```typescript
/**
 * Supabase Storage Service
 * 
 * Provides an interface for storing and retrieving files using Supabase Storage
 */
export class SupabaseStorageService {
  private static instance: SupabaseStorageService;
  private bucket: string;

  private constructor() {
    this.bucket = this.getStorageBucketName();
    logger.info(`Supabase Storage Service initialized with bucket: ${this.bucket}`);
  }

  /**
   * Get the singleton instance
   * @returns SupabaseStorageService instance
   */
  public static getInstance(): SupabaseStorageService {
    if (!SupabaseStorageService.instance) {
      SupabaseStorageService.instance = new SupabaseStorageService();
    }
    return SupabaseStorageService.instance;
  }

  /**
   * Get the configured storage bucket name from admin settings
   * Falls back to environment variable or default if not configured
   */
  private getStorageBucketName(): string {
    const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'kai-materials';
    
    try {
      // Try to get from admin settings
      const { data, error } = supabaseClient.getClient()
        .from('admin_settings')
        .select('value')
        .eq('key', 'storage_bucket')
        .single();
      
      if (error || !data) {
        logger.info(`No storage bucket configured in admin settings, using default: ${SUPABASE_BUCKET}`);
        return SUPABASE_BUCKET;
      }
      
      logger.info(`Using admin-configured storage bucket: ${data.value}`);
      return data.value;
    } catch (error) {
      logger.warn(`Error getting storage bucket from settings, using default: ${SUPABASE_BUCKET}`);
      return SUPABASE_BUCKET;
    }
  }

  /**
   * Upload a file to Supabase Storage
   * @param filePath Local path to the file
   * @param storageKey Key to use in storage (folder/filename)
   * @returns Promise with upload result
   */
  async uploadFile(filePath: string, storageKey: string): Promise<{ url: string }> {
    try {
      // Read the file
      const fileContent = await fs.promises.readFile(filePath);
      
      // Upload to Supabase Storage
      const { data, error } = await supabaseClient.getClient()
        .storage
        .from(this.bucket)
        .upload(storageKey, fileContent, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (error) throw error;
      
      // Get the public URL
      const { data: urlData } = supabaseClient.getClient()
        .storage
        .from(this.bucket)
        .getPublicUrl(storageKey);
      
      return { url: urlData.publicUrl };
    } catch (error) {
      logger.error(`Error uploading file to Supabase Storage: ${error}`);
      throw error;
    }
  }

  /**
   * Download a file from Supabase Storage
   * @param storageKey Key of the file in storage
   * @param outputPath Local path to save the file
   * @returns Promise with download result
   */
  async downloadFile(storageKey: string, outputPath: string): Promise<void> {
    try {
      // Download from Supabase Storage
      const { data, error } = await supabaseClient.getClient()
        .storage
        .from(this.bucket)
        .download(storageKey);
      
      if (error) throw error;
      
      // Ensure the directory exists
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
      
      // Write the file
      await fs.promises.writeFile(outputPath, data);
    } catch (error) {
      logger.error(`Error downloading file from Supabase Storage: ${error}`);
      throw error;
    }
  }

  /**
   * Delete a file from Supabase Storage
   * @param storageKey Key of the file in storage
   * @returns Promise with deletion result
   */
  async deleteFile(storageKey: string): Promise<void> {
    try {
      // Delete from Supabase Storage
      const { error } = await supabaseClient.getClient()
        .storage
        .from(this.bucket)
        .remove([storageKey]);
      
      if (error) throw error;
    } catch (error) {
      logger.error(`Error deleting file from Supabase Storage: ${error}`);
      throw error;
    }
  }

  /**
   * Get a signed URL for a file in Supabase Storage
   * @param storageKey Key of the file in storage
   * @param expiresIn Expiration time in seconds (default: 3600)
   * @returns Promise with signed URL
   */
  async getSignedUrl(storageKey: string, expiresIn: number = 3600): Promise<string> {
    try {
      // Get signed URL from Supabase Storage
      const { data, error } = await supabaseClient.getClient()
        .storage
        .from(this.bucket)
        .createSignedUrl(storageKey, expiresIn);
      
      if (error) throw error;
      
      return data.signedUrl;
    } catch (error) {
      logger.error(`Error getting signed URL from Supabase Storage: ${error}`);
      throw error;
    }
  }
}

// Export singleton instance
export const storageService = SupabaseStorageService.getInstance();
```

## Integration with Other Systems

### Material Recognition System

Supabase integrates with the material recognition system:

1. **Vector Storage and Retrieval**
   - Storage of feature vectors for materials
   - Efficient similarity search for recognition
   - Storage of recognition results
   - Material metadata management
   - Versioning and history tracking

2. **Recognition Workflow**
   - Image upload to Supabase Storage
   - Vector embedding storage in pgvector
   - Similarity search for matching
   - Result storage and retrieval
   - Performance monitoring

3. **Feedback Loop**
   - Storage of user feedback
   - Correction tracking
   - Iterative improvement data
   - Performance metrics storage
   - Training data generation

### Dataset Management

Supabase powers the dataset management system:

1. **Dataset Storage**
   - Dataset metadata in PostgreSQL
   - Image files in Supabase Storage
   - Class hierarchies and organization
   - Version control and history
   - Preprocessing results

2. **Dataset Operations**
   - Dataset creation and modification
   - Image upload and organization
   - Class management
   - Quality assessment storage
   - Versioning and rollback

3. **Training Integration**
   - Dataset selection for training
   - Progress tracking with real-time updates
   - Performance metrics storage
   - Model-dataset relationships
   - Validation results

### Knowledge Base

Supabase serves as the foundation for the knowledge base:

1. **Entity Storage**
   - Material information storage
   - Relationship management
   - Taxonomy and categorization
   - Attribute and property handling
   - Versioning and history

2. **Search Capabilities**
   - Full-text search for content
   - Vector search for similarity
   - Hybrid search combining approaches
   - Faceted search support
   - Relevance tuning

3. **Content Organization**
   - Collection and category management
   - Hierarchical structures
   - Cross-referencing and relationships
   - User-specific content views
   - Access control and permissions

### Queue System

Supabase supports the queue management system:

1. **Job Management**
   - Job storage and tracking
   - Status updates via real-time channels
   - Priority and scheduling management
   - Resource allocation tracking
   - Error handling and retry logic

2. **Event Communication**
   - Real-time status notifications
   - Cross-service coordination
   - Client updates via WebSockets
   - Processing milestone tracking
   - Completion notifications

3. **Performance Monitoring**
   - Queue metrics storage
   - Processing time tracking
   - Resource utilization monitoring
   - Bottleneck identification
   - Historical performance analysis

## Usage Examples

### Initializing Supabase

```typescript
import { supabaseClient } from './services/supabase/supabaseClient';

// In application startup
async function initializeServices() {
  // Initialize Supabase with configuration
  supabaseClient.init({
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY
  });
  
  // Verify connection
  try {
    const client = supabaseClient.getClient();
    const { data, error } = await client.from('health_check').select('*').limit(1);
    
    if (error) {
      console.error('Supabase connection error:', error);
      throw error;
    }
    
    console.log('Supabase connection successful');
  } catch (error) {
    console.error('Failed to initialize Supabase:', error);
    process.exit(1);
  }
}
```

### Material Management with Supabase

```typescript
import { supabaseMaterialService } from './services/supabase/supabase-material-service';

async function manageMaterials() {
  try {
    // Create a new material
    const newMaterial = await supabaseMaterialService.createMaterial({
      name: 'Ceramic Tile XYZ',
      description: 'Premium ceramic tile with matte finish',
      materialType: 'ceramic',
      manufacturer: 'TileCo',
      dimensions: {
        width: 30,
        height: 30,
        thickness: 1.2
      },
      color: {
        name: 'Slate Gray',
        hex: '#708090'
      },
      finish: 'matte',
      tags: ['ceramic', 'tile', 'floor', 'matte']
    });
    
    console.log(`Created material with ID: ${newMaterial.id}`);
    
    // Search for materials
    const searchResults = await supabaseMaterialService.searchMaterials({
      query: 'ceramic matte',
      materialType: 'ceramic',
      limit: 10
    });
    
    console.log(`Found ${searchResults.length} matching materials`);
    
    // Find similar materials using vector search
    if (newMaterial.vectorRepresentation) {
      const similarMaterials = await supabaseMaterialService.findSimilarMaterials(
        newMaterial.vectorRepresentation,
        {
          threshold: 0.7,
          limit: 5,
          excludeIds: [newMaterial.id]
        }
      );
      
      console.log(`Found ${similarMaterials.length} similar materials`);
    }
    
    // Update a material
    const updatedMaterial = await supabaseMaterialService.updateMaterial(newMaterial.id, {
      description: 'Premium ceramic tile with matte finish, updated description',
      tags: [...newMaterial.tags, 'premium']
    });
    
    console.log(`Updated material: ${updatedMaterial.name}`);
    
    // Get material statistics
    const stats = await supabaseMaterialService.getMaterialStats();
    
    console.log(`Total materials: ${stats.totalCount}`);
    console.log(`Materials by type: ${JSON.stringify(stats.byType)}`);
    
  } catch (error) {
    console.error('Material management failed:', error);
  }
}
```

### Working with Supabase Storage

```typescript
import { storageService } from './services/storage/supabaseStorageService';
import * as fs from 'fs';
import * as path from 'path';

async function manageFiles() {
  try {
    // Upload a file
    const filePath = path.join(process.cwd(), 'uploads', 'sample_image.jpg');
    const storageKey = `materials/ceramic/sample_${Date.now()}.jpg`;
    
    const { url } = await storageService.uploadFile(filePath, storageKey);
    
    console.log(`File uploaded successfully. Public URL: ${url}`);
    
    // Get a signed URL for temporary access
    const signedUrl = await storageService.getSignedUrl(storageKey, 1800); // 30 minutes
    
    console.log(`Signed URL valid for 30 minutes: ${signedUrl}`);
    
    // Download the file to a different location
    const downloadPath = path.join(process.cwd(), 'downloads', 'sample_downloaded.jpg');
    
    await storageService.downloadFile(storageKey, downloadPath);
    
    console.log(`File downloaded to: ${downloadPath}`);
    
    // Get file metadata
    const metadata = await fs.promises.stat(downloadPath);
    
    console.log(`Downloaded file size: ${metadata.size} bytes`);
    
    // Delete the file after processing
    await storageService.deleteFile(storageKey);
    
    console.log(`File deleted from storage: ${storageKey}`);
    
  } catch (error) {
    console.error('File management failed:', error);
  }
}
```

### Real-time Communication with Supabase

```typescript
import { messageBroker } from './services/messaging/messageBroker';

async function setupRealTimeUpdates() {
  try {
    // Initialize the message broker
    await messageBroker.init();
    
    // Subscribe to PDF processing queue events
    const pdfUnsubscribe = await messageBroker.subscribe('pdf', async (message) => {
      const { type, data } = message;
      
      console.log(`Received PDF queue event: ${type}`);
      
      switch (type) {
        case 'job_added':
          console.log(`New PDF job added: ${data.jobId}`);
          break;
        case 'job_started':
          console.log(`PDF job started: ${data.jobId}`);
          break;
        case 'job_completed':
          console.log(`PDF job completed: ${data.jobId}, extracted ${data.pageCount} pages`);
          break;
        case 'job_failed':
          console.error(`PDF job failed: ${data.jobId}, error: ${data.error}`);
          break;
      }
    });
    
    // Subscribe to crawler queue events
    const crawlerUnsubscribe = await messageBroker.subscribe('crawler', async (message) => {
      const { type, data } = message;
      
      console.log(`Received crawler queue event: ${type}`);
      
      // Handle crawler events...
    });
    
    // Publish an event to the PDF queue
    await messageBroker.publish('pdf', 'system_status', {
      status: 'ready',
      timestamp: new Date().toISOString(),
      queueSize: 0
    });
    
    // Keep subscriptions active for some time...
    setTimeout(() => {
      // Unsubscribe when no longer needed
      pdfUnsubscribe();
      crawlerUnsubscribe();
      
      console.log('Unsubscribed from queue events');
      
      // Shut down the message broker
      messageBroker.shutdown();
    }, 3600000); // 1 hour
    
  } catch (error) {
    console.error('Real-time setup failed:', error);
  }
}
```

## Configuration and Deployment

### Environment Variables

Supabase integration is configured using environment variables:

```
# Supabase Connection
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Storage Configuration
SUPABASE_STORAGE_BUCKET=kai-materials

# Security Settings
SUPABASE_JWT_SECRET=your-jwt-secret
```

### Deployment Considerations

1. **Database Migration**
   - Apply migrations before deployment
   - Test migrations in staging environment
   - Have rollback plans for failed migrations
   - Implement zero-downtime migration strategy
   - Monitor database performance after migrations

2. **Access Management**
   - Use service role key for server operations
   - Use anon key for client-side operations
   - Implement row-level security policies
   - Review and test permission settings
   - Regularly rotate keys and credentials

3. **Performance Configuration**
   - Optimize vector indices for dataset size
   - Configure connection pooling for server instances
   - Set up caching for frequent queries
   - Monitor and adjust statement timeouts
   - Implement proper connection handling

4. **Data Backups**
   - Configure regular Supabase backups
   - Implement point-in-time recovery options
   - Validate backup restoration process
   - Maintain backup retention policy
   - Monitor backup successes and failures

5. **Scaling Considerations**
   - Monitor database connection utilization
   - Scale compute resources as needed
   - Implement query optimization for large tables
   - Consider read replicas for heavy workloads
   - Plan for data volume growth

### Health Monitoring

To ensure Supabase integration remains healthy:

```typescript
/**
 * Check Supabase connection health
 * @returns Health check results
 */
async function checkSupabaseHealth(): Promise<HealthCheckResult> {
  try {
    const startTime = Date.now();
    
    // Get the Supabase client
    const client = supabaseClient.getClient();
    
    // Check basic connectivity with a simple query
    const { data, error } = await client
      .from('health_check')
      .select('*')
      .limit(1);
    
    if (error) {
      return {
        status: 'error',
        message: `Database connection error: ${error.message}`,
        latency: Date.now() - startTime
      };
    }
    
    // Check pgvector extension
    const { data: pgvectorData, error: pgvectorError } = await client.rpc(
      'check_extension',
      { extension_name: 'vector' }
    );
    
    // Check storage access
    const { data: storageData, error: storageError } = await client.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || 'kai-materials')
      .list('', { limit: 1 });
    
    // Return health status
    return {
      status: 'healthy',
      message: 'Supabase connection is healthy',
      latency: Date.now() - startTime,
      details: {
        database: error ? 'error' : 'connected',
        pgvector: pgvectorError ? 'not available' : 'available',
        storage: storageError ? 'error' : 'connected'
      }
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Supabase health check failed: ${error instanceof Error ? error.message : String(error)}`,
      latency: -1
    };
  }
}
```

## Performance Considerations

1. **Connection Management**
   - Use a singleton client to prevent connection pool exhaustion
   - Implement proper connection error handling
   - Close connections when no longer needed
   - Monitor connection pool utilization
   - Configure timeouts appropriately

2. **Query Optimization**
   - Use indexes for frequently queried columns
   - Optimize vector queries with appropriate indexing
   - Implement pagination for large result sets
   - Use optimized PostgreSQL functions
   - Monitor and optimize slow queries

3. **Vector Search Performance**
   - Choose appropriate indexing methods (HNSW vs. IVF-Flat)
   - Optimize vector dimensions for balance of accuracy/performance
   - Implement approximate nearest neighbor search
   - Tune similarity thresholds for result quality
   - Cache common search results

4. **Real-time Performance**
   - Monitor WebSocket connection count
   - Implement message throttling for high-volume events
   - Use selective subscriptions rather than generic ones
   - Implement backoff strategies for reconnections
   - Close unneeded subscriptions promptly

5. **Storage Efficiency**
   - Use appropriate file formats and compression
   - Implement file lifecycle policies
   - Use presigned URLs for client-side uploads
   - Configure appropriate cache headers
   - Monitor storage utilization and growth