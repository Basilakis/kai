/**
 * Enhanced Vector Types
 *
 * This file defines types for the enhanced vector search functionality,
 * providing strong typing for controller methods, service methods, and
 * request/response objects.
 */

// Service interface
export interface EnhancedVectorService {
  setKnowledgeBaseService(service: any): void;
  generateEmbedding(text: string, options?: EmbeddingGenerationOptions): Promise<EmbeddingResult>;
  storeEmbedding(materialId: string, embeddingResult: EmbeddingResult, text: string): Promise<boolean>;
  searchMaterials(options: SearchOptions): Promise<SearchResult[]>;
  findSimilarMaterials(materialId: string, options?: SimilarMaterialsOptions): Promise<SearchResult[]>;
  searchMaterialsWithKnowledge(
    query: string,
    materialType?: string,
    filters?: Record<string, any>,
    limit?: number,
    includeKnowledge?: boolean,
    includeRelationships?: boolean
  ): Promise<SearchWithKnowledgeResult>;
  findSimilarMaterialsWithKnowledge(
    materialId: string,
    materialType?: string,
    limit?: number,
    includeKnowledge?: boolean
  ): Promise<SearchWithKnowledgeResult>;
  routeQuery(options: QueryRoutingOptions): Promise<SearchWithKnowledgeResult>;
  getMaterialKnowledge(
    materialId: string,
    query?: string,
    limit?: number
  ): Promise<MaterialKnowledgeResult>;
  assembleContext(
    materials: any[],
    query: string,
    userContext?: Record<string, any>
  ): Promise<ContextAssemblyResult>;
  createSemanticKnowledgeOrganization(
    knowledgeEntries: KnowledgeEntry[],
    query: string
  ): Promise<SemanticKnowledgeOrganization>;
  compareSimilarity(text1: string, text2: string): Promise<number>;
  refreshVectorViews(): Promise<boolean>;
  getPerformanceStats(): Promise<PerformanceStats[]>;
  getSearchConfigs(): Promise<VectorSearchConfig[]>;
  updateSearchConfig(config: Partial<VectorSearchConfig> & { name: string }): Promise<VectorSearchConfig>;
  deleteSearchConfig(name: string): Promise<boolean>;
}

// Dense embedding representation
export interface DenseEmbedding {
  vector: number[];
  dimensions: number;
}

// Sparse embedding representation
export interface SparseEmbedding {
  indices: number[];
  values: number[];
  dimensions: number;
}

// Metadata for embeddings
export interface EmbeddingMetadata {
  text_length: number;
  method: 'dense' | 'sparse' | 'hybrid';
  material_category?: string;
  processing_time: number;
  timestamp: number;
}

// Result of embedding generation
export interface EmbeddingResult {
  dense_vector?: number[];
  sparse_indices?: number[];
  sparse_values?: number[];
  dense_dimensions?: number;
  sparse_dimensions?: number;
  material_category?: string;
  processing_time?: number;
  error?: string;
}

// Options for generating embeddings
export interface EmbeddingGenerationOptions {
  method?: 'dense' | 'sparse' | 'hybrid';
  denseModel?: string;
  denseDimensions?: number;
  sparseMethod?: 'tfidf' | 'bm25' | 'count';
  sparseFeatures?: number;
  materialCategory?: string;
}

// Options for searching materials
export interface SearchOptions {
  query: string;
  materialType?: string;
  filters?: Record<string, any>;
  limit?: number;
  threshold?: number;
  denseWeight?: number;
  useSpecializedIndex?: boolean;
}

// Result of a search operation
export interface SearchResult {
  id: string;
  name: string;
  materialType: string;
  similarity: number;
  matchedBy: 'text' | 'vector' | 'hybrid';
}

// Options for finding similar materials
export interface SimilarMaterialsOptions {
  limit?: number;
  threshold?: number;
  sameMaterialType?: boolean;
  denseWeight?: number;
}

// Knowledge entry
export interface KnowledgeEntry {
  id: string;
  materialId: string;
  content: string;
  source?: string;
  confidence: number;
  relevance: number;
  category?: string;
  semanticTags?: string[];
  linkedMaterials?: MaterialRelationship[];
}

// Material relationship
export interface MaterialRelationship {
  id: string;
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  type: string;
  strength: number;
  description?: string;
}

// Result of a search with knowledge integration
export interface SearchWithKnowledgeResult {
  materials: SearchResult[];
  knowledgeEntries: KnowledgeEntry[];
  relationships: MaterialRelationship[];
  metadata?: Record<string, any>;
}

// Options for query routing
export interface QueryRoutingOptions {
  query: string;
  materialType?: string;
  filters?: Record<string, any>;
  strategy?: 'hybrid' | 'vector_first' | 'knowledge_first' | 'balanced';
  limit?: number; // Added limit property
}

// Semantic knowledge organization
export interface SemanticKnowledgeOrganization {
  queryTheme: string;
  primaryCategories: string[];
  categoryDistribution: Record<string, any>;
  categoryContents: Record<string, string[]>;
}

// Vector search configuration
export interface VectorSearchConfig {
  id: string;
  name: string;
  description?: string;
  denseWeight: number;
  indexType: string;
  indexParameters: Record<string, any>;
  materialType?: string;
  modelPath?: string;
}

// Standard API response format
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  metadata?: Record<string, any>;
}

// Context assembly response
export interface ContextAssemblyResult {
  assembledContext: string;
  contextSections: {
    title: string;
    content: string;
  }[];
  metadata: {
    materialCount: number;
    entriesCount: number;
    queryType?: string;
  };
}

// Material knowledge result
export interface MaterialKnowledgeResult {
  entries: KnowledgeEntry[];
  relationships: MaterialRelationship[];
  metadata: Record<string, any>;
}

// Performance statistics
export interface PerformanceStats {
  configId: string;
  configName: string;
  queriesCount: number;
  averageQueryTimeMs: number;
  lastUpdatedAt: string;
  indexSize?: number;
  indexType: string;
}