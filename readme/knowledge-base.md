# Knowledge Base System

The Knowledge Base is the central repository of material information in Kai. It stores comprehensive data about materials, their properties, and relationships, enabling powerful search, organization, and retrieval capabilities.

## Features

### Comprehensive Material Storage

The Knowledge Base provides rich storage for material data:

1. **Material Specifications**
   - Detailed physical properties (dimensions, weight, thickness)
   - Visual attributes (color, pattern, texture)
   - Technical specifications (water absorption, slip resistance, frost resistance)
   - Application contexts (indoor/outdoor, floor/wall, residential/commercial)
   - Manufacturer information
   - Pricing data

2. **Rich Media**
   - High-resolution images from multiple angles
   - Texture maps and normal maps
   - Installation examples
   - Rendered visualizations

3. **Metadata & Classification**
   - Material type and category hierarchies
   - Tags and labels
   - Collection and series groupings
   - Installation requirements
   - Compliance certificates

### Advanced Search Capabilities

The Knowledge Base implements multiple search strategies:

1. **Text-Based Search**
   - Full-text search with relevance scoring
   - Natural language query processing
   - Autocomplete and suggestions
   - Spell correction and term expansion
   - Faceted filtering

2. **Vector-Based Search**
   - Similarity search using embedding vectors
   - Visual "search by example"
   - Nearest neighbor algorithms
   - Customizable similarity thresholds

3. **Metadata Search**
   - Structured queries on material properties
   - Range-based filtering (dimensions, price)
   - Boolean combinations of criteria
   - Aggregation and analytics

4. **Combined/Hybrid Search**
   - Weighted combination of text and vector search
   - Boosting factors for different search aspects
   - Relevance tuning based on user feedback
   - Context-aware search that considers user history

### Collection Management

The system provides comprehensive collection management:

1. **Collection Hierarchy**
   - Parent-child relationships between collections
   - Nested collection structures
   - Inheritance of properties
   - Propagation of updates

2. **Collection Types**
   - Manufacturer collections
   - Series and product lines
   - Application-based collections
   - User-created collections
   - System-generated collections (based on similarity)

3. **Collection Operations**
   - Bulk updates to collection members
   - Collection merging and splitting
   - Collection statistics and analytics
   - Exports and reporting

### Relationship Management

The Knowledge Base manages complex relationships between materials:

1. **Relationship Types**
   - Complementary materials (work well together)
   - Alternative materials (substitutes)
   - Required accessories
   - Installation dependencies
   - Visual similarity

2. **Relationship Properties**
   - Relationship strength (0-1 scale)
   - Bidirectional or directional
   - Context-specific metadata
   - Source attribution
   - Confidence scoring

3. **Relationship Discovery**
   - Automated suggestion of potential relationships
   - Entity linking in text descriptions
   - Visual similarity-based relationships
   - User feedback incorporation

### Versioning System

The Knowledge Base includes a robust versioning system:

1. **Version Tracking**
   - Complete history of changes to materials
   - Temporal queries (state at a specific time)
   - Change attribution (who made changes)
   - Change descriptions and reasons

2. **Versioning Operations**
   - Point-in-time snapshots
   - Rollback to previous versions
   - Differential storage for efficiency
   - Conflict resolution for concurrent edits

3. **Audit Capabilities**
   - Complete audit trails
   - Compliance reporting
   - Change analytics
   - Data lineage tracking

## Technical Implementation

### Data Models

The Knowledge Base uses the following core data models:

1. **Material Model**
   ```typescript
   interface MaterialDocument {
     id: string;
     name: string;
     description: string;
     materialType: string;
     manufacturer: string;
     collectionId?: string;
     seriesId?: string;
     color?: {
       name: string;
       hex: string;
       rgb: [number, number, number];
     };
     dimensions?: {
       length: number;
       width: number;
       height: number;
       unit: 'mm' | 'cm' | 'in';
     };
     weight?: number;
     finish?: string;
     price?: {
       value: number;
       currency: string;
       unit: string;
     };
     technicalProps?: Record<string, any>;
     applications?: string[];
     tags: string[];
     images: {
       url: string;
       type: 'primary' | 'secondary' | 'detail' | 'texture';
       alt?: string;
     }[];
     embeddingVector?: number[];
     versions: {
       versionId: string;
       createdAt: Date;
       createdBy: string;
     }[];
     metadata?: Record<string, any>;
     createdAt: Date;
     updatedAt: Date;
     createdBy: string;
   }
   ```

2. **Collection Model**
   ```typescript
   interface CollectionDocument {
     id: string;
     name: string;
     description: string;
     manufacturer: string;
     parentId?: string;
     properties?: Record<string, any>;
     tags: string[];
     images: {
       url: string;
       type: string;
       alt?: string;
     }[];
     metadata?: Record<string, any>;
     createdAt: Date;
     updatedAt: Date;
     createdBy: string;
   }
   ```

3. **Relationship Model**
   ```typescript
   interface MaterialRelationshipDocument {
     id: string;
     sourceMaterialId: string;
     targetMaterialId: string;
     relationshipType: 'complementary' | 'alternative' | 'accessory' | 'required' | 'similar';
     strength: number;
     bidirectional: boolean;
     context?: string;
     metadata?: Record<string, any>;
     createdAt: Date;
     updatedAt: Date;
     createdBy: string;
   }
   ```

4. **Version Model**
   ```typescript
   interface VersionDocument {
     id: string;
     entityId: string;
     entityType: 'material' | 'collection';
     previousData: Record<string, any>;
     changeDescription: string;
     metadata?: Record<string, any>;
     createdAt: Date;
     createdBy: string;
   }
   ```

5. **Search Index Model**
   ```typescript
   interface SearchIndexDocument {
     id: string;
     name: string;
     description: string;
     entityType: string;
     indexType: 'text' | 'vector' | 'hybrid';
     status: 'building' | 'ready' | 'updating' | 'error';
     documentCount: number;
     lastBuildTime?: Date;
     lastUpdateTime?: Date;
     errorMessage?: string;
     configuration: Record<string, any>;
     createdAt: Date;
     updatedAt: Date;
     createdBy: string;
   }
   ```

### Search Implementation

The Knowledge Base implements search through several mechanisms:

1. **Text Search**
   - MongoDB text indexes for basic search
   - Custom tokenization and stemming
   - Boosting of key fields (name, description, tags)
   - Scoring function customization

2. **Vector Search**
   - FAISS for efficient similarity search
   - Custom embedding generation from images and text
   - Hybrid retrieval combining vector and text search
   - Quantization for efficient storage and retrieval

3. **Search Optimization**
   - Caching of frequent queries
   - Specialized indexes for common query patterns
   - Query rewriting for performance
   - Aggregation pipeline optimization

### Bulk Operations

The Knowledge Base supports efficient bulk operations:

1. **Import**
   - Bulk import of materials with validation
   - Duplicate detection and resolution
   - Relationship inference
   - Collection assignment

2. **Update**
   - Bulk update of materials matching criteria
   - Field-specific updates
   - Version tracking for bulk changes
   - Cascading updates to relationships

3. **Export**
   - Configurable export formats (JSON, CSV)
   - Filtered exports based on criteria
   - Options for including relationships and versions
   - Compression for large exports

4. **Delete**
   - Soft delete with retention period
   - Hard delete with relationship cleanup
   - Bulk delete with criteria
   - Deletion audit logging

### Entity Linking

The Entity Linking service automatically identifies relationships between materials:

1. **Text Analysis**
   - Natural language processing to identify entity mentions
   - Context-aware linking to existing materials and collections
   - Confidence scoring for potential links
   - User verification workflow for uncertain links

2. **Relationship Creation**
   - Automatic creation of relationships based on text analysis
   - Type inference from context
   - Bidirectionality determination
   - Strength estimation based on context

## API Usage

### Material Search

```typescript
// Search for materials
const searchResults = await knowledgeBaseService.searchMaterials({
  query: 'ceramic tile',
  materialType: 'tile',
  tags: ['porcelain', 'outdoor'],
  limit: 10,
  skip: 0,
  useVectorSearch: false,
  searchStrategy: 'combined'
});

// Results structure
interface SearchResults {
  materials: MaterialDocument[];
  total: number;
  facets?: {
    materialTypes: Array<{ _id: string, count: number }>;
    manufacturers: Array<{ _id: string, count: number }>;
    colors: Array<{ _id: string, count: number }>;
    finishes: Array<{ _id: string, count: number }>;
    tags: Array<{ _id: string, count: number }>;
  };
}
```

### Collection Management

```typescript
// Get collections with material counts
const collections = await knowledgeBaseService.getCollections({
  parentId: 'parent-collection-id',
  includeEmpty: false,
  limit: 20
});

// Results structure
interface CollectionResults {
  collections: Array<CollectionDocument & { materialCount: number }>;
  total: number;
}
```

### Material Versioning

```typescript
// Create a material revision
const updatedMaterial = await knowledgeBaseService.createMaterialRevision(
  'material-id',
  { name: 'Updated Name', description: 'New description' },
  'user-id'
);

// Revert to a previous version
const revertedMaterial = await knowledgeBaseService.revertMaterialVersion(
  'material-id',
  'version-id',
  'user-id'
);

// Get version history
const versions = await knowledgeBaseService.getMaterialVersionHistory('material-id');
```

### Bulk Operations

```typescript
// Bulk import materials
const importResults = await knowledgeBaseService.bulkImportMaterials(
  materialsArray,
  'user-id',
  {
    updateExisting: true,
    detectDuplicates: true,
    validateSchema: true,
    collectionId: 'collection-id'
  }
);

// Bulk update materials
const updateResults = await knowledgeBaseService.bulkUpdateMaterials(
  { tags: ['updated', 'batch-processed'] },
  { materialType: 'tile' },
  'user-id'
);

// Bulk export materials
const exportResults = await knowledgeBaseService.bulkExportMaterials(
  { materialType: 'tile' },
  {
    format: 'json',
    includeRelationships: true,
    includeVersions: false
  }
);
```

### Relationship Management

```typescript
// Create material relationships
const relationshipResults = await knowledgeBaseService.bulkCreateRelationships(
  [
    {
      sourceMaterialId: 'material-1',
      targetMaterialId: 'material-2',
      relationshipType: 'complementary',
      strength: 0.85,
      bidirectional: true
    },
    {
      sourceMaterialId: 'material-1',
      targetMaterialId: 'material-3',
      relationshipType: 'alternative',
      strength: 0.75,
      bidirectional: false
    }
  ],
  'user-id'
);
```

### System Statistics

```typescript
// Get knowledge base statistics
const stats = await knowledgeBaseService.getKnowledgeBaseStats();

// Stats structure
interface KnowledgeBaseStats {
  materialCount: number;
  collectionCount: number;
  materialsByType: Record<string, number>;
  materialsByCollection: Array<{ collection: string; count: number }>;
  recentUpdates: number;
  indexingStatus: Record<string, number>;
}
```

## Performance Considerations

1. **Query Optimization**
   - Indexing strategy for common query patterns
   - Query caching for repeat searches
   - Pagination and limiting for large result sets
   - Query rewriting for performance

2. **Scaling Considerations**
   - Horizontal scaling for read-heavy workloads
   - Database sharding for large material collections
   - Indexing optimizations for different query patterns
   - Caching layers for frequently accessed data

3. **Resource Requirements**
   - Storage: Scales with number of materials and their media assets
   - Memory: Depends on indexing strategy and caching
   - CPU: Primarily for search and bulk operations
   - Network: Important for media delivery and distributed search

4. **Optimization Techniques**
   - Lazy loading of large media assets
   - Progressive loading of search results
   - Asynchronous processing of bulk operations
   - Background indexing and reindexing