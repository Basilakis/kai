# Database Management and Vector DB

The Kai platform leverages advanced database management and vector database capabilities to provide powerful search, storage, and retrieval functionality. This document details the system's approach to database management, with a focus on vector-based similarity search and hybrid search implementations.

## Features

### Supabase Database Integration

The system uses Supabase as its primary database platform:

1. **Unified Database Management**
   - PostgreSQL-based database engine
   - Secure API access through Supabase SDK
   - Row-level security policies
   - Real-time subscription capabilities
   - Managed authentication and authorization

2. **Relational Data Storage**
   - Structured tables for materials, collections, categories
   - Normalized schema for efficient data storage
   - Foreign key relationships for data integrity
   - Indexing for performant queries
   - JSON/JSONB support for flexible metadata

3. **Database Extensions**
   - pgvector extension for vector similarity search
   - Full-text search capabilities
   - GIN and GIST indexing for complex data types
   - Trigger functions for automated actions
   - Custom PostgreSQL functions for specialized operations

### Vector Similarity Search

The system implements advanced vector similarity search:

1. **Vector Embedding Storage**
   - Dedicated tables for vector embeddings
   - Support for high-dimensional vectors (384+ dimensions)
   - Efficient storage using PostgreSQL's vector type
   - Associated metadata storage for context
   - Linking to source entities (materials, images)

2. **Similarity Search Algorithms**
   - Cosine similarity for semantic matching
   - Euclidean distance for feature-based matching
   - Approximate nearest neighbor search using HNSW
   - IVF-Flat indexing for larger vector collections
   - Configurable similarity thresholds

3. **Vector Index Optimization**
   - HNSW indexing for near real-time queries
   - IVF-Flat for batch processing
   - Index parameterization based on data characteristics
   - Automated index rebuilding
   - Performance monitoring and optimization

### Hybrid Search Capabilities

The system combines multiple search strategies:

1. **Multi-Modal Search**
   - Text-based search using full-text indexing
   - Vector similarity search for semantic understanding
   - Metadata filtering for structured attributes
   - Combined scoring with configurable weights
   - Unified ranking algorithm

2. **Search Customization**
   - Adjustable text/vector weight balancing
   - Domain-specific tokenization and preprocessing
   - Query expansion and enhancement
   - Fallback strategies when vectors are unavailable
   - Confidence scoring for result relevance

3. **Search Optimization**
   - Materialized search indexes
   - Request-time parameter tuning
   - Cached vector computations
   - Progressive loading of results
   - Performance analytics for search quality

### Dataset Management

The system provides comprehensive dataset management:

1. **Dataset Organization**
   - Hierarchical structure with datasets and classes
   - Image storage and classification
   - Metadata and annotation storage
   - Version control for datasets
   - Audit trail for data modifications

2. **Data Operations**
   - Bulk import and export
   - Dataset splitting and merging
   - Data augmentation and preprocessing
   - Quality assessment and cleanup
   - Incremental updates

3. **Integration with ML Pipeline**
   - Training/test/validation splitting
   - Feature extraction for ML models
   - Dataset statistics and analytics
   - Model-dataset relationship tracking
   - Performance metrics based on datasets

## Technical Implementation

### Supabase Client Management

The system implements a Supabase client manager:

```typescript
/**
 * Supabase Client Manager
 * Manages connections to Supabase and provides access to the client instance.
 */
class SupabaseClientManager {
  private client: SupabaseClient | null = null;
  private config: {
    url: string;
    key: string;
    options?: any;
  } | null = null;

  /**
   * Initialize the Supabase client with configuration
   * @param config Supabase configuration
   */
  public init(config: { url: string; key: string; options?: any }): void {
    this.config = config;
    this.client = createClient(config.url, config.key, config.options);
    logger.info('Supabase client initialized');
  }

  /**
   * Get the Supabase client instance
   * @returns SupabaseClient instance
   */
  public getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }
    return this.client;
  }
}

// Export a singleton instance
export const supabaseClient = new SupabaseClientManager();
```

### Vector Search Implementation

The system provides a dedicated vector search service:

```typescript
/**
 * Vector Search Service for Supabase
 * Provides methods for storing and querying vector embeddings
 */
class SupabaseVectorSearch {
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
      // Get the Supabase client
      const client = supabaseClient.getClient();
      
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
      
    } catch (error) {
      logger.error(`Index creation error: ${error}`);
      throw error;
    }
  }
}

// Export singleton instance
export const vectorSearch = new SupabaseVectorSearch();
```

### Hybrid Search Integration

The system implements hybrid search combining text and vector similarity:

```sql
-- Function to perform hybrid search
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding VECTOR,
  table_name TEXT,
  text_columns TEXT[] DEFAULT ARRAY['name', 'description'],
  vector_column TEXT DEFAULT 'embedding',
  text_weight FLOAT DEFAULT 0.5,
  vector_weight FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10,
  score_threshold FLOAT DEFAULT 0.5
) RETURNS TABLE (
  id UUID,
  text_score FLOAT,
  vector_score FLOAT,
  combined_score FLOAT
) AS $$
DECLARE
  text_query TEXT;
  vector_query TEXT;
  final_query TEXT;
BEGIN
  -- Construct the text search portion
  text_query := FORMAT('
    WITH text_search AS (
      SELECT
        id,
        CASE WHEN %L = '''' THEN 0
        ELSE ts_rank(to_tsvector(''english'', %s), websearch_to_tsquery(''english'', %L))
        END AS text_score
      FROM %I
      WHERE true
      ' || CASE WHEN length(query_text) > 0 THEN '
      AND to_tsvector(''english'', %s) @@ websearch_to_tsquery(''english'', %L)
      ' ELSE '' END || '
    ),
    vector_search AS (
      SELECT
        id,
        CASE WHEN %I IS NULL THEN 0
        ELSE 1 - (%I <=> %L::vector)
        END AS vector_score
      FROM %I
    ),
    hybrid_results AS (
      SELECT
        COALESCE(t.id, v.id) AS id,
        COALESCE(t.text_score, 0) AS text_score,
        COALESCE(v.vector_score, 0) AS vector_score,
        (COALESCE(t.text_score, 0) * %L) + (COALESCE(v.vector_score, 0) * %L) AS combined_score
      FROM text_search t
      FULL OUTER JOIN vector_search v ON t.id = v.id
      WHERE (t.id IS NOT NULL OR v.id IS NOT NULL)
        AND ((COALESCE(t.text_score, 0) * %L) + (COALESCE(v.vector_score, 0) * %L)) >= %L
      ORDER BY combined_score DESC
      LIMIT %L
    )
    SELECT
      id,
      text_score,
      vector_score,
      combined_score
    FROM hybrid_results;',
    query_text,
    array_to_string(text_columns, ' || '' '' || '),
    query_text,
    table_name,
    array_to_string(text_columns, ' || '' '' || '),
    query_text,
    vector_column,
    vector_column,
    query_embedding,
    table_name,
    text_weight,
    vector_weight,
    text_weight,
    vector_weight,
    score_threshold,
    match_count
  );

  RETURN QUERY EXECUTE text_query;
END;
$$ LANGUAGE plpgsql;
```

### Database Schema Design

The system implements a comprehensive database schema:

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
CREATE INDEX IF NOT EXISTS vector_embeddings_embedding_idx ON vector_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create an index for material ID lookups
CREATE INDEX IF NOT EXISTS vector_embeddings_material_id_idx ON vector_embeddings (material_id);

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
```

### Dataset Management Service

The system provides a comprehensive dataset management service:

```typescript
/**
 * Dataset Management Service
 * Provides methods for dataset creation, manipulation, and analysis
 */
export class DatasetManagementService {
  /**
   * Analyze a dataset to identify quality issues
   * 
   * @param datasetId The ID of the dataset to analyze
   * @returns Dataset analysis results
   */
  public async analyzeDataset(datasetId: string): Promise<DatasetAnalysisResult> {
    try {
      const result: DatasetAnalysisResult = {
        datasetId,
        totalImages: 0,
        issuesDetected: {
          lowResolutionImages: { count: 0, details: [] },
          poorQualityImages: { count: 0, details: [] },
          duplicateImages: { count: 0, details: [] },
          classImbalance: { totalClasses: 0, details: [] }
        },
        recommendations: []
      };

      // Get the dataset
      const dataset = await supabaseDatasetService.getDatasetById(datasetId);
      if (!dataset) {
        throw new Error(`Dataset not found: ${datasetId}`);
      }

      // Get classes for the dataset
      const classes = await supabaseDatasetService.getDatasetClasses(datasetId);
      result.issuesDetected.classImbalance.totalClasses = classes.length;

      // Analysis logic implementation...

      return result;
    } catch (error) {
      logger.error(`Dataset analysis error: ${error}`);
      throw error;
    }
  }

  /**
   * Clean a dataset based on analysis results
   * 
   * @param datasetId The ID of the dataset to clean
   * @param cleaningOptions Options for dataset cleaning
   * @returns Cleaning operation results
   */
  public async cleanDataset(
    datasetId: string,
    cleaningOptions: DatasetCleaningOptions
  ): Promise<DatasetCleaningResult> {
    try {
      // Implementation details...
      
      // Create target dataset if creating a new version
      let targetDatasetId = datasetId;
      let targetDataset = null;
      
      if (createNewVersion) {
        // Create a new dataset as a copy
        targetDataset = await supabaseDatasetService.createDataset({
          name: `${dataset.name} (Cleaned)`,
          description: `Cleaned version of ${dataset.name}`,
          sourceDatasetId: datasetId,
          status: 'processing'
        });
        
        targetDatasetId = targetDataset.id;
      }
      
      // Copy and clean data
      // Implementation details...
      
      // Set the cleaned dataset status to ready
      if (createNewVersion && targetDataset) {
        await supabaseDatasetService.updateDataset(targetDatasetId, {
          status: 'ready'
        });
      }
      
      return result;
    } catch (error) {
      logger.error(`Dataset cleaning error: ${error}`);
      throw error;
    }
  }

  // Additional methods for dataset management...
}
```

## Integration with Other Systems

### Material Recognition Pipeline

The Database Management and Vector DB components integrate with the material recognition system:

1. **Vector Generation**
   - Material images converted to vector embeddings
   - Storage in vector database tables
   - Indexing for efficient similarity search
   - Association with material metadata
   - Vector quality monitoring

2. **Search Integration**
   - Recognition results matched against vector database
   - Multi-stage search process for candidate identification
   - Combined scoring for result ranking
   - Confidence thresholds for result filtering
   - Performance metrics for search quality

3. **Result Processing**
   - Vector search results enhanced with material details
   - Similarity scores included with search results
   - Fallback to text search when needed
   - Multi-modal result presentation
   - Continuous improvement through feedback loop

### Knowledge Base System

The Database Management and Vector DB components support the knowledge base:

1. **Knowledge Representation**
   - Structured storage of domain knowledge
   - Vector embeddings for semantic understanding
   - Entity relationships for knowledge graph
   - Attribute indexing for faceted search
   - History tracking for knowledge evolution

2. **Query Processing**
   - Natural language query embedding
   - Vector similarity for semantic matching
   - Hybrid search for comprehensive results
   - Contextual relevance ranking
   - Explainable search results

3. **Knowledge Update**
   - Automatic vector embedding updates
   - Cascading updates for related entities
   - Transaction safety for knowledge consistency
   - Versioning for knowledge snapshots
   - Audit trail for knowledge modifications

### Admin Panel

The Database Management and Vector DB components are exposed through the admin panel:

1. **Database Management**
   - Dataset creation and management interface
   - Import/export tools for data migration
   - Schema visualization and management
   - Query builder for advanced operations
   - Performance monitoring dashboard

2. **Vector Operations**
   - Vector index management tools
   - Embedding visualization and analysis
   - Similarity search testing interface
   - Vector quality assessment
   - Performance optimization controls

3. **System Monitoring**
   - Database health and performance metrics
   - Query performance analytics
   - Storage utilization tracking
   - Index efficiency monitoring
   - Scheduled maintenance management

## API Usage Examples

### Basic Vector Search

```typescript
import { vectorSearch } from '@kai/server/services/supabase/vector-search';

async function findSimilarMaterials(embeddingVector: number[]) {
  try {
    // Configure search parameters
    const searchConfig = {
      limit: 10,            // Number of results to return
      threshold: 0.75,      // Minimum similarity threshold (0-1)
      includeMetadata: true // Include associated metadata
    };
    
    // Perform vector search
    const results = await vectorSearch.findSimilar(
      embeddingVector,
      'vector_embeddings',
      'embedding',
      searchConfig
    );
    
    console.log(`Found ${results.length} similar materials`);
    
    // Process search results
    results.forEach(result => {
      console.log(`Material ID: ${result.material_id}`);
      console.log(`Similarity: ${result.similarity.toFixed(4)}`);
      console.log(`Metadata: ${JSON.stringify(result.metadata)}`);
    });
    
    return results;
  } catch (error) {
    console.error('Vector search failed:', error);
    throw error;
  }
}
```

### Hybrid Search Implementation

```typescript
import { supabaseClient } from '@kai/server/services/supabase/supabaseClient';

interface HybridSearchOptions {
  textWeight?: number;
  vectorWeight?: number;
  limit?: number;
  threshold?: number;
}

async function performHybridSearch(
  textQuery: string,
  embeddingVector: number[],
  options: HybridSearchOptions = {}
) {
  try {
    // Configure search parameters
    const searchParams = {
      textWeight: options.textWeight ?? 0.5,
      vectorWeight: options.vectorWeight ?? 0.5,
      limit: options.limit ?? 10,
      threshold: options.threshold ?? 0.5
    };
    
    // Get Supabase client
    const client = supabaseClient.getClient();
    
    // Call hybrid search function
    const { data, error } = await client.rpc('hybrid_search_materials', {
      query_text: textQuery,
      query_embedding: embeddingVector,
      text_weight: searchParams.textWeight,
      vector_weight: searchParams.vectorWeight,
      match_count: searchParams.limit,
      score_threshold: searchParams.threshold
    });
    
    if (error) throw error;
    
    console.log(`Hybrid search found ${data.length} results`);
    
    // Process search results
    const enhancedResults = data.map(result => ({
      id: result.id,
      name: result.name,
      description: result.description,
      scores: {
        textScore: result.text_score,
        vectorScore: result.vector_score,
        combinedScore: result.combined_score
      }
    }));
    
    return enhancedResults;
  } catch (error) {
    console.error('Hybrid search failed:', error);
    throw error;
  }
}
```

### Dataset Management

```typescript
import { DatasetManagementService } from '@kai/server/services/datasets/dataset-management.service';
import supabaseDatasetService from '@kai/server/services/supabase/supabase-dataset-service';

async function createAndManageDataset() {
  try {
    // Create a new dataset
    const dataset = await supabaseDatasetService.createDataset({
      name: 'Ceramic Tiles Training Set',
      description: 'Training dataset for ceramic tile recognition',
      status: 'processing'
    });
    
    console.log(`Created dataset with ID: ${dataset.id}`);
    
    // Create dataset classes
    const classes = [
      { name: 'Porcelain', description: 'Porcelain ceramic tiles' },
      { name: 'Terracotta', description: 'Terracotta clay tiles' },
      { name: 'Marble', description: 'Marble effect ceramic tiles' }
    ];
    
    for (const cls of classes) {
      const datasetClass = await supabaseDatasetService.createDatasetClass({
        datasetId: dataset.id,
        name: cls.name,
        description: cls.description
      });
      
      console.log(`Created class: ${datasetClass.name} (${datasetClass.id})`);
    }
    
    // Update dataset status
    await supabaseDatasetService.updateDataset(dataset.id, {
      status: 'ready'
    });
    
    // Initialize dataset management service
    const datasetManager = new DatasetManagementService();
    
    // Analyze dataset quality
    const analysisResult = await datasetManager.analyzeDataset(dataset.id);
    
    console.log('Dataset analysis results:');
    console.log(`- Total images: ${analysisResult.totalImages}`);
    console.log(`- Low resolution images: ${analysisResult.issuesDetected.lowResolutionImages.count}`);
    console.log(`- Class imbalance issues: ${analysisResult.issuesDetected.classImbalance.details.length}`);
    
    // Clean dataset based on analysis
    if (analysisResult.recommendations.length > 0) {
      const cleaningResult = await datasetManager.cleanDataset(dataset.id, {
        createNewVersion: true,
        removeDuplicates: true,
        balanceClasses: true,
        removeCorruptedImages: true
      });
      
      console.log(`Dataset cleaned: ${cleaningResult.cleanedDatasetId}`);
      console.log(`- Removed images: ${cleaningResult.removedImages}`);
      console.log(`- Balanced classes: ${cleaningResult.balancedClasses}`);
    }
    
    return dataset.id;
  } catch (error) {
    console.error('Dataset management failed:', error);
    throw error;
  }
}
```

## Performance Considerations

1. **Database Scaling**
   - Vertical scaling for higher memory/CPU needs
   - Connection pooling for concurrent access
   - Read replicas for query distribution
   - Supabase tier selection based on data volume
   - Automated cleanup of temporary data

2. **Vector Optimization**
   - Dimensionality reduction for large vector spaces
   - Index parameter tuning for search performance
   - Batched vector operations for bulk processing
   - Vector storage compression
   - Cached vector computations for frequent queries

3. **Search Performance**
   - Query optimization for complex searches
   - Result caching for common queries
   - Pagination for large result sets
   - Background indexing for vector updates
   - Asynchronous search for UI responsiveness

4. **Resource Requirements**
   - CPU: Multi-core recommended for vector operations
   - Memory: 8GB+ for larger vector indices
   - Storage: Scales with dataset size (approx. 5-10x raw data)
   - Network: Standard database bandwidth requirements
   - Backup: Regular point-in-time snapshots

5. **Monitoring and Maintenance**
   - Index rebuilding on significant data changes
   - Regular VACUUM operations for PostgreSQL
   - Performance tracking for query execution times
   - Storage utilization monitoring
   - Connection usage tracking