# Knowledge Base System

The Knowledge Base is the central repository of material information in Kai. It stores comprehensive data about materials, their properties, and relationships, enabling powerful search, organization, and retrieval capabilities. The system now features real-time synchronization, enhanced cross-referencing, deeper hierarchical categorization, bulk operations, and automated entity linking.

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
   - Deep nested collection structures with unlimited levels
   - Multiple parent categories supported through collection memberships
   - Inheritance of properties
   - Propagation of updates
   - Path tracking for efficient hierarchy traversal

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
   - Series and variant relationships
   - Entity-based references (automatically detected)

2. **Relationship Properties**
   - Relationship strength (0-1 scale)
   - Bidirectional or directional (with automatic inverse creation)
   - Context-specific metadata
   - Source attribution
   - Confidence scoring
   - Relationship creation timestamp and author tracking

3. **Relationship Discovery**
   - Automated suggestion of potential relationships
   - Automatic entity linking in text descriptions
   - Intelligent entity detection with confidence thresholds
   - Visual similarity-based relationships
   - User feedback incorporation
   - Background processing for relationship suggestions

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
### Real-Time Synchronization

The Knowledge Base now features comprehensive real-time updates:

1. **WebSocket-based Notifications**
   - Live updates when material or collection data changes
   - Client subscription management with connection tracking
   - Event categorization by operation type (create, update, delete)
   - Support for relationship and bulk operation events
   - Optimized for low-latency delivery

2. **Pub/Sub Architecture**
   - Supabase real-time messaging infrastructure
   - Prioritized updates for knowledge base changes
   - Scalable message delivery with reconnection handling
   - Configurable event filtering by content type
   - Client-side caching for offline support

3. **Event Types**
   - Material creation, update, and deletion events
   - Collection hierarchy modifications
   - Relationship changes
   - Search index updates
   - Version creation
   - Bulk operation completion notifications

4. **Implementation Benefits**
   - Real-time collaborative editing support
   - Live dashboards with instant updates
   - Immediate notifications for content changes
   - Enhanced user experience with live content
   - Background processing with completion notifications

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
     relationshipType: 'complementary' | 'alternative' | 'accessory' | 'required' | 'similar' | 'series' | 'variant' | 'entity-reference' | 'custom';
     strength: number;
     bidirectional: boolean;
     context?: string;
     metadata?: {
       description?: string;
       entityType?: string;
       mentionedText?: string;
       detectionConfidence?: number;
       detectionMethod?: 'automatic' | 'manual' | 'suggested';
       customType?: string;
       [key: string]: any;
     };
     createdAt: Date;
     updatedAt: Date;
     createdBy: string;
   }
   ```

4. **Collection Membership Model**
   ```typescript
   interface CollectionMembershipDocument {
     id: string;
     materialId: string;
     collectionId: string;
     primaryMembership: boolean;
     inheritParentProperties: boolean;
     position: number;
     path: string[];  // Array representing the path from root to this collection
     nestingLevel: number;  // Depth in the collection hierarchy
     metadata?: Record<string, any>;
     addedAt: Date;
     updatedAt: Date;
     addedBy: string;
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

The Knowledge Base supports efficient bulk operations with real-time notifications:

1. **Import**
   - Bulk import of materials with validation
   - Duplicate detection and resolution
   - Relationship inference
   - Collection assignment
   - Batched processing for large datasets
   - Real-time progress and completion notifications
   - Detailed success/failure reporting

2. **Update**
   - Bulk update of materials matching criteria
   - Field-specific updates
   - Version tracking for bulk changes
   - Cascading updates to relationships
   - Batched processing with error resilience
   - Real-time notifications for updates

3. **Export**
   - Configurable export formats (JSON, CSV)
   - Filtered exports based on criteria
   - Options for including relationships and versions
   - Compression for large exports
   - Background processing for large exports

4. **Delete**
   - Soft delete with retention period
   - Hard delete with relationship cleanup
   - Bulk delete with criteria
   - Deletion audit logging
   - Batched processing with failure tracking
   - Real-time notifications for completion

5. **Relationship Management**
   - Bulk relationship creation with validation
   - Automatic bidirectional relationship handling
   - Batch processing with configurable batch sizes
   - Real-time notification of creation progress
   - Error handling with partial success support

### Entity Linking

The Entity Linking service automatically identifies relationships between materials:

1. **Text Analysis**
   - Natural language processing to identify entity mentions
   - Machine learning-based entity recognition in descriptions
   - Material, collection, and property detection
   - Context-aware linking to existing materials and collections
   - Confidence scoring for potential links
   - Configurable confidence thresholds
   - User verification workflow for uncertain links

2. **Relationship Creation**
   - Automatic creation of relationships based on text analysis
   - Immediate relationship creation upon material creation/update
   - Type inference from context
   - Bidirectionality determination
   - Strength estimation based on context and confidence
   - Background processing for entity linking
   - Detailed metadata for entity-based relationships

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
// Bulk import materials with real-time notifications
const importResults = await realTimeKnowledgeBaseService.bulkImportMaterials(
  materialsArray,
  {
    updateExisting: true,
    detectDuplicates: true,
    validateSchema: true,
    collectionId: 'collection-id',
    userId: 'user-id'
  }
);

// Subscribe to real-time updates
scalableMessageBroker.subscribeWithOptions(
  'system',
  (message) => {
    if (message.type === MessageType.KNOWLEDGE_BASE_EVENT) {
      const { eventType, payload } = message.data;
      
      if (eventType === KnowledgeBaseEventType.BULK_OPERATION_COMPLETED) {
        console.log(`Bulk ${payload.operationType} completed: ${payload.count}/${payload.totalRequested}`);
      }
    }
  },
  {
    useAcknowledgment: true,
    autoAcknowledge: true,
    enableCache: true
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