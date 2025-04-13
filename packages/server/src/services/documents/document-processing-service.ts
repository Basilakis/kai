/**
 * Document Processing Service
 *
 * Leverages Supabase Vector to enable semantic search across document repositories.
 * Extracts text from documents, generates vector embeddings, and provides intelligent
 * search capabilities based on semantic meaning rather than just keywords.
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { supabase } from '../supabase/supabaseClient';
import { handleSupabaseError } from '../../../../shared/src/utils/supabaseErrorHandler';
import { vectorSearch } from '../supabase/vector-search';

/**
 * Document metadata
 */
export interface DocumentMetadata {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  pageCount?: number;
  author?: string;
  createdDate?: Date;
  modifiedDate?: Date;
  uploadedBy?: string;
  tags?: string[];
  categories?: string[];
  customMetadata?: Record<string, any>;
}

/**
 * Document content chunk
 */
export interface DocumentChunk {
  documentId: string;
  chunkIndex: number;
  content: string;
  embedding?: number[];
  pageNumber?: number;
  section?: string;
  headings?: string[];
}

/**
 * Document search options
 */
export interface DocumentSearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  minRelevance?: number;
  fileTypes?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  categories?: string[];
  tags?: string[];
  author?: string;
  uploadedBy?: string;
  includeMetadata?: boolean;
  highlightResults?: boolean;
}

/**
 * Document search result
 */
export interface DocumentSearchResult {
  documentId: string;
  documentTitle: string;
  relevance: number;
  matchedChunks: {
    content: string;
    highlighted?: string;
    pageNumber?: number;
    section?: string;
  }[];
  metadata?: DocumentMetadata;
}

/**
 * Entity recognition result
 */
export interface EntityRecognitionResult {
  entity: string;
  type: string;
  confidence: number;
  mentions: {
    documentId: string;
    documentTitle: string;
    context: string;
    pageNumber?: number;
  }[];
}

/**
 * Document Processing Service
 *
 * Provides document management with vector-based semantic search capabilities
 */
export class DocumentProcessingService {
  private static instance: DocumentProcessingService;
  private documentsTableName = 'documents';
  private documentChunksTableName = 'document_chunks';
  private entitiesTableName = 'document_entities';
  private vectorColumnName = 'embedding';
  private initialized = false;

  private constructor() {
    logger.info('Document Processing Service initialized');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DocumentProcessingService {
    if (!DocumentProcessingService.instance) {
      DocumentProcessingService.instance = new DocumentProcessingService();
    }
    return DocumentProcessingService.instance;
  }

  /**
   * Initialize document processing service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.ensureTables();
      this.initialized = true;
      logger.info('Document processing service initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize document processing service: ${error}`);
      throw error;
    }
  }

  /**
   * Ensure necessary tables and indices exist
   */
  private async ensureTables(): Promise<void> {
    try {
      const client = supabase.getClient();

      // Create documents metadata table
      await client.rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS ${this.documentsTableName} (
            id UUID PRIMARY KEY,
            title TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            page_count INTEGER,
            author TEXT,
            created_date TIMESTAMP WITH TIME ZONE,
            modified_date TIMESTAMP WITH TIME ZONE,
            uploaded_by TEXT,
            tags TEXT[],
            categories TEXT[],
            custom_metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_${this.documentsTableName}_file_type
            ON ${this.documentsTableName}(file_type);

          CREATE INDEX IF NOT EXISTS idx_${this.documentsTableName}_tags
            ON ${this.documentsTableName} USING GIN(tags);

          CREATE INDEX IF NOT EXISTS idx_${this.documentsTableName}_categories
            ON ${this.documentsTableName} USING GIN(categories);
        `
      });

      // Create document chunks table with vector support
      await client.rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS ${this.documentChunksTableName} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            document_id UUID NOT NULL REFERENCES ${this.documentsTableName}(id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            ${this.vectorColumnName} vector(384),
            page_number INTEGER,
            section TEXT,
            headings TEXT[],
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_${this.documentChunksTableName}_document_id
            ON ${this.documentChunksTableName}(document_id);

          CREATE INDEX IF NOT EXISTS idx_${this.documentChunksTableName}_content
            ON ${this.documentChunksTableName} USING GIN(to_tsvector('english', content));
        `
      });

      // Create entities table
      await client.rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS ${this.entitiesTableName} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            entity TEXT NOT NULL,
            type TEXT NOT NULL,
            ${this.vectorColumnName} vector(384),
            document_mentions JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_${this.entitiesTableName}_entity
            ON ${this.entitiesTableName}(entity);

          CREATE INDEX IF NOT EXISTS idx_${this.entitiesTableName}_type
            ON ${this.entitiesTableName}(type);
        `
      });

      // Create vector indices
      await vectorSearch.createIndex(
        this.documentChunksTableName,
        this.vectorColumnName,
        'hnsw',
        384
      );

      await vectorSearch.createIndex(
        this.entitiesTableName,
        this.vectorColumnName,
        'hnsw',
        384
      );

      logger.info('Document processing tables and indices are ready');
    } catch (error) {
      logger.error(`Failed to create tables: ${error}`);
      throw error;
    }
  }

  /**
   * Process a document and store it with vector embeddings
   *
   * @param documentContent Document text content
   * @param metadata Document metadata
   * @returns Document ID
   */
  public async processDocument(
    documentContent: string,
    metadata: Omit<DocumentMetadata, 'id'>
  ): Promise<string> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      logger.info(`Processing document: ${metadata.title}`);

      // Generate document ID
      const documentId = uuidv4();

      // Store document metadata
      await this.storeDocumentMetadata({
        id: documentId,
        ...metadata
      });

      // Split document into chunks
      const chunks = this.splitDocumentIntoChunks(documentContent);

      // Process chunks with embeddings
      await this.processDocumentChunks(documentId, chunks);

      // Extract and store entities
      await this.extractAndStoreEntities(documentId, documentContent, metadata.title);

      return documentId;
    } catch (error) {
      logger.error(`Document processing failed: ${error}`);
      throw new Error(`Document processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Store document metadata
   *
   * @param metadata Document metadata
   */
  private async storeDocumentMetadata(
    metadata: DocumentMetadata
  ): Promise<void> {
    try {
      // Prepare data for insertion
      const data = {
        id: metadata.id,
        title: metadata.title,
        file_name: metadata.fileName,
        file_type: metadata.fileType,
        file_size: metadata.fileSize,
        page_count: metadata.pageCount,
        author: metadata.author,
        created_date: metadata.createdDate?.toISOString(),
        modified_date: metadata.modifiedDate?.toISOString(),
        uploaded_by: metadata.uploadedBy,
        tags: metadata.tags,
        categories: metadata.categories,
        custom_metadata: metadata.customMetadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Insert into documents table
      try {
        const { error } = await supabase.getClient()
          .from(this.documentsTableName)
          .insert(data);

        if (error) {
          throw handleSupabaseError(error, 'storeDocumentMetadata', { documentId: metadata.id });
        }
      } catch (err) {
        throw handleSupabaseError(err, 'storeDocumentMetadata', { documentId: metadata.id });
      }

    } catch (error) {
      logger.error(`Failed to store document metadata: ${error}`);
      throw error;
    }
  }

  /**
   * Split document into semantically meaningful chunks
   *
   * @param documentContent Full document content
   * @returns Array of document chunks
   */
  private splitDocumentIntoChunks(
    documentContent: string
  ): Omit<DocumentChunk, 'documentId' | 'embedding'>[] {
    // In a real implementation, this would use more sophisticated chunking
    // strategies based on semantic boundaries, paragraphs, etc.

    // Simple implementation that splits by paragraphs and then chunks
    const paragraphs = documentContent
      .split(/\n\s*\n/)
      .filter(p => p.trim().length > 0);

    const maxChunkSize = 1000; // Target size for each chunk
    const chunks: Omit<DocumentChunk, 'documentId' | 'embedding'>[] = [];

    let currentChunk = '';
    let chunkIndex = 0;

    // Process each paragraph
    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed max size, start a new chunk
      if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push({
          chunkIndex,
          content: currentChunk.trim()
        });

        chunkIndex++;
        currentChunk = '';
      }

      currentChunk += paragraph + '\n\n';
    }

    // Add the last chunk if it has content
    if (currentChunk.trim().length > 0) {
      chunks.push({
        chunkIndex,
        content: currentChunk.trim()
      });
    }

    return chunks;
  }

  /**
   * Process document chunks and store with embeddings
   *
   * @param documentId Document ID
   * @param chunks Document content chunks
   */
  private async processDocumentChunks(
    documentId: string,
    chunks: Omit<DocumentChunk, 'documentId' | 'embedding'>[]
  ): Promise<void> {
    try {
      logger.info(`Processing ${chunks.length} chunks for document ${documentId}`);

      for (const chunk of chunks) {
        // Generate embedding for the chunk
        const embedding = await this.generateTextEmbedding(chunk.content);

        // Store chunk with embedding
        await this.storeDocumentChunk({
          documentId,
          embedding,
          ...chunk
        });
      }

    } catch (error) {
      logger.error(`Chunk processing failed: ${error}`);
      throw error;
    }
  }

  /**
   * Generate text embedding
   *
   * @param text Text to generate embedding for
   * @returns Embedding vector
   */
  private async generateTextEmbedding(text: string): Promise<number[]> {
    try {
      // In a real implementation, this would call an embedding API
      // For example, OpenAI, Cohere, or a local model

      // Mock implementation for testing
      return this.generateMockEmbedding();

    } catch (error) {
      logger.error(`Embedding generation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Generate a mock embedding for testing
   *
   * @returns Mock embedding vector
   */
  private generateMockEmbedding(): number[] {
    const dimensions = 384;
    const embedding = new Array(dimensions);

    // Fill with random values
    for (let i = 0; i < dimensions; i++) {
      embedding[i] = (Math.random() * 2) - 1; // Values between -1 and 1
    }

    // Normalize to unit length
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );

    for (let i = 0; i < dimensions; i++) {
      embedding[i] = embedding[i] / magnitude;
    }

    return embedding;
  }

  /**
   * Store a document chunk with its embedding
   *
   * @param chunk Document chunk with embedding
   */
  private async storeDocumentChunk(
    chunk: DocumentChunk
  ): Promise<void> {
    try {
      // Prepare data for insertion
      const data = {
        document_id: chunk.documentId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        embedding: chunk.embedding,
        page_number: chunk.pageNumber,
        section: chunk.section,
        headings: chunk.headings,
        created_at: new Date().toISOString()
      };

      // Insert into chunks table
      try {
        const { error } = await supabase.getClient()
          .from(this.documentChunksTableName)
          .insert(data);

        if (error) {
          throw handleSupabaseError(error, 'storeDocumentChunk', {
            documentId: chunk.documentId,
            chunkIndex: chunk.chunkIndex
          });
        }
      } catch (err) {
        throw handleSupabaseError(err, 'storeDocumentChunk', {
          documentId: chunk.documentId,
          chunkIndex: chunk.chunkIndex
        });
      }

    } catch (error) {
      logger.error(`Failed to store document chunk: ${error}`);
      throw error;
    }
  }

  /**
   * Extract entities from document and store them
   *
   * @param documentId Document ID
   * @param documentContent Document content
   * @param documentTitle Document title
   */
  private async extractAndStoreEntities(
    documentId: string,
    documentContent: string,
    documentTitle: string
  ): Promise<void> {
    try {
      // In a real implementation, this would use a named entity recognition model
      // For this example, we'll use a simple regex-based approach

      // Extract potential entities (simplified mock implementation)
      const entities = this.mockExtractEntities(documentContent);

      for (const entity of entities) {
        // Check if entity already exists
        let existingEntity;
        try {
          const { data, error } = await supabase.getClient()
            .from(this.entitiesTableName)
            .select('id, document_mentions')
            .eq('entity', entity.entity)
            .eq('type', entity.type)
            .maybeSingle();

          if (error) {
            throw handleSupabaseError(error, 'checkExistingEntity', { entity: entity.entity, type: entity.type });
          }

          existingEntity = data;
        } catch (err) {
          throw handleSupabaseError(err, 'checkExistingEntity', { entity: entity.entity, type: entity.type });
        }

        // Generate entity embedding
        const embedding = await this.generateTextEmbedding(entity.entity);

        // Prepare document mention
        const mention = {
          documentId,
          documentTitle,
          contexts: entity.contexts,
          confidence: entity.confidence
        };

        if (existingEntity) {
          // Update existing entity
          const documentMentions = existingEntity.document_mentions || [];

          // Check if document already mentioned
          const existingMentionIndex = documentMentions.findIndex(
            (m: any) => m.documentId === documentId
          );

          if (existingMentionIndex >= 0) {
            // Update existing mention
            documentMentions[existingMentionIndex] = mention;
          } else {
            // Add new mention
            documentMentions.push(mention);
          }

          // Update entity record
          try {
            const { error } = await supabase.getClient()
              .from(this.entitiesTableName)
              .update({
                document_mentions: documentMentions,
                embedding,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingEntity.id);

            if (error) {
              throw handleSupabaseError(error, 'updateEntity', { entityId: existingEntity.id });
            }
          } catch (err) {
            throw handleSupabaseError(err, 'updateEntity', { entityId: existingEntity.id });
          }

        } else {
          // Create new entity
          try {
            const { error } = await supabase.getClient()
              .from(this.entitiesTableName)
              .insert({
                entity: entity.entity,
                type: entity.type,
                embedding,
                document_mentions: [mention],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });

            if (error) {
              throw handleSupabaseError(error, 'createEntity', { entity: entity.entity, type: entity.type });
            }
          } catch (err) {
            throw handleSupabaseError(err, 'createEntity', { entity: entity.entity, type: entity.type });
          }
        }
      }

    } catch (error) {
      logger.error(`Entity extraction failed: ${error}`);
      // Don't fail the whole document processing
      logger.warn('Continuing document processing without entities');
    }
  }

  /**
   * Mock entity extraction (simplified for demo)
   *
   * @param text Text to extract entities from
   * @returns Extracted entities
   */
  private mockExtractEntities(text: string): Array<{
    entity: string;
    type: string;
    contexts: string[];
    confidence: number;
  }> {
    const entities: Array<{
      entity: string;
      type: string;
      contexts: string[];
      confidence: number;
    }> = [];

    // Very simplified entity extraction
    // In a real implementation, this would use a proper NER model

    // Example entity types to extract
    const entityPatterns = [
      {
        type: 'person',
        regex: /([A-Z][a-z]+ [A-Z][a-z]+)/g,
        confidence: 0.7
      },
      {
        type: 'organization',
        regex: /([A-Z][a-z]* (Inc|Corp|LLC|Ltd|Company|Corporation))/g,
        confidence: 0.8
      },
      {
        type: 'location',
        regex: /(New York|Los Angeles|Chicago|London|Paris|Berlin|Tokyo)/g,
        confidence: 0.9
      },
      {
        type: 'date',
        regex: /\b(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b/g,
        confidence: 0.95
      }
    ];

    // Extract entities
    for (const pattern of entityPatterns) {
      const matches = text.matchAll(pattern.regex);
      const entityMap = new Map<string, string[]>();

      for (const match of matches) {
        const entity = match[0];

        // Get context (20 chars before and after)
        const start = Math.max(0, match.index ? match.index - 20 : 0);
        const end = Math.min(text.length, (match.index || 0) + entity.length + 20);
        const context = text.substring(start, end);

        // Add to entity map
        if (!entityMap.has(entity)) {
          entityMap.set(entity, []);
        }
        entityMap.get(entity)?.push(context);
      }

      // Convert map to array
      for (const [entity, contexts] of entityMap.entries()) {
        entities.push({
          entity,
          type: pattern.type,
          contexts,
          confidence: pattern.confidence
        });
      }
    }

    return entities;
  }

  /**
   * Search documents using semantic search
   *
   * @param options Search options
   * @returns Search results
   */
  public async searchDocuments(
    options: DocumentSearchOptions
  ): Promise<DocumentSearchResult[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const {
        query,
        limit = 10,
        offset = 0,
        minRelevance = 0.6,
        fileTypes,
        dateRange,
        categories,
        tags,
        author,
        uploadedBy,
        includeMetadata = true,
        highlightResults = true
      } = options;

      logger.info(`Searching documents for: "${query}"`);

      // Generate embedding for the query
      const queryEmbedding = await this.generateTextEmbedding(query);

      // Get document IDs that match metadata filters
      const documentIds = await this.getFilteredDocumentIds(
        fileTypes,
        dateRange,
        categories,
        tags,
        author,
        uploadedBy
      );

      // If no documents match the filters, return empty results
      if (documentIds.length === 0 &&
          (fileTypes || dateRange || categories || tags || author || uploadedBy)) {
        return [];
      }

      // Prepare filters for vector search
      const filters: Record<string, any> = {};

      if (documentIds.length > 0) {
        filters.document_id = { $in: documentIds };
      }

      // Find similar chunks
      const similarChunks = await vectorSearch.findSimilar(
        queryEmbedding,
        this.documentChunksTableName,
        this.vectorColumnName,
        {
          threshold: minRelevance,
          limit: limit * 3, // Get more chunks to account for multiple from same doc
          filters
        }
      );

      if (!similarChunks || similarChunks.length === 0) {
        // Fall back to keyword search if vector search returns no results
        return this.fallbackKeywordSearch(
          query,
          limit,
          offset,
          documentIds,
          includeMetadata,
          highlightResults
        );
      }

      // Group chunks by document
      const documentChunks: Record<string, any[]> = {};
      const documentTitles: Record<string, string> = {};

      for (const chunk of similarChunks) {
        const docId = chunk.document_id;

        if (!documentChunks[docId]) {
          documentChunks[docId] = [];
        }

        documentChunks[docId].push(chunk);

        // We'll get the document title later if needed
      }

      // Get document titles and metadata if needed
      let documentMetadata: Record<string, DocumentMetadata> = {};

      if (includeMetadata) {
        documentMetadata = await this.getDocumentsMetadata(Object.keys(documentChunks));

        // Extract titles for later use
        for (const [docId, metadata] of Object.entries(documentMetadata)) {
          documentTitles[docId] = metadata.title;
        }
      } else {
        // Just get titles
        const titles = await this.getDocumentTitles(Object.keys(documentChunks));
        Object.assign(documentTitles, titles);
      }

      // Prepare results (best chunk relevance becomes document relevance)
      const results: DocumentSearchResult[] = [];

      for (const [docId, chunks] of Object.entries(documentChunks)) {
        // Sort chunks by relevance
        chunks.sort((a, b) => b.similarity - a.similarity);

        // Prepare matched chunks
        const matchedChunks = chunks.slice(0, 3).map(chunk => {
          const content = chunk.content;

          return {
            content,
            highlighted: highlightResults ? this.highlightQueryTerms(content, query) : undefined,
            pageNumber: chunk.page_number,
            section: chunk.section
          };
        });

        // Add result
        results.push({
          documentId: docId,
          documentTitle: documentTitles[docId] || 'Unknown Document',
          relevance: chunks[0].similarity, // Best chunk relevance
          matchedChunks,
          metadata: includeMetadata ? documentMetadata[docId] : undefined
        });
      }

      // Sort results by relevance and apply limit/offset
      results.sort((a, b) => b.relevance - a.relevance);

      return results.slice(offset, offset + limit);

    } catch (error) {
      logger.error(`Document search failed: ${error}`);
      throw new Error(`Document search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get filtered document IDs based on metadata criteria
   *
   * @param fileTypes File type filter
   * @param dateRange Date range filter
   * @param categories Categories filter
   * @param tags Tags filter
   * @param author Author filter
   * @param uploadedBy Uploaded by filter
   * @returns Array of document IDs
   */
  private async getFilteredDocumentIds(
    fileTypes?: string[],
    dateRange?: { start?: Date; end?: Date },
    categories?: string[],
    tags?: string[],
    author?: string,
    uploadedBy?: string
  ): Promise<string[]> {
    try {
      // Start building query
      let query = supabase.getClient()
        .from(this.documentsTableName)
        .select('id');

      // Apply filters
      if (fileTypes && fileTypes.length > 0) {
        query = query.in('file_type', fileTypes);
      }

      if (dateRange) {
        if (dateRange.start) {
          query = query.gte('created_date', dateRange.start.toISOString());
        }

        if (dateRange.end) {
          query = query.lte('created_date', dateRange.end.toISOString());
        }
      }

      if (categories && categories.length > 0) {
        // For array columns, use overlap operator
        query = query.contains('categories', categories);
      }

      if (tags && tags.length > 0) {
        // For array columns, use overlap operator
        query = query.contains('tags', tags);
      }

      if (author) {
        query = query.eq('author', author);
      }

      if (uploadedBy) {
        query = query.eq('uploaded_by', uploadedBy);
      }

      // Execute query
      try {
        const { data, error } = await query;

        if (error) {
          throw handleSupabaseError(error, 'getFilteredDocumentIds', {
            fileTypes,
            dateRange,
            categories,
            tags
          });
        }

        return data ? data.map((doc: any) => doc.id) : [];
      } catch (err) {
        throw handleSupabaseError(err, 'getFilteredDocumentIds', {
          fileTypes,
          dateRange,
          categories,
          tags
        });
      }

    } catch (error) {
      logger.error(`Error getting filtered document IDs: ${error}`);
      return [];
    }
  }

  /**
   * Get document titles by IDs
   *
   * @param documentIds Document IDs
   * @returns Map of document ID to title
   */
  private async getDocumentTitles(
    documentIds: string[]
  ): Promise<Record<string, string>> {
    try {
      if (documentIds.length === 0) {
        return {};
      }

      // Get titles for documents
      try {
        const { data, error } = await supabase.getClient()
          .from(this.documentsTableName)
          .select('id, title')
          .in('id', documentIds);

        if (error) {
          throw handleSupabaseError(error, 'getDocumentTitles', { documentCount: documentIds.length });
        }

        if (!data) {
          return {};
        }

        return data.reduce((acc: Record<string, string>, doc: any) => {
          acc[doc.id] = doc.title;
          return acc;
        }, {});
      } catch (err) {
        throw handleSupabaseError(err, 'getDocumentTitles', { documentCount: documentIds.length });
      }

    } catch (error) {
      logger.error(`Error getting document titles: ${error}`);
      return {};
    }
  }

  /**
   * Get document metadata by IDs
   *
   * @param documentIds Document IDs
   * @returns Map of document ID to metadata
   */
  private async getDocumentsMetadata(
    documentIds: string[]
  ): Promise<Record<string, DocumentMetadata>> {
    try {
      if (documentIds.length === 0) {
        return {};
      }

      // Get full metadata for documents
      let data;
      try {
        const { data: responseData, error } = await supabase.getClient()
          .from(this.documentsTableName)
          .select('*')
          .in('id', documentIds);

        if (error) {
          throw handleSupabaseError(error, 'getDocumentsMetadata', { documentCount: documentIds.length });
        }

        data = responseData;
      } catch (err) {
        throw handleSupabaseError(err, 'getDocumentsMetadata', { documentCount: documentIds.length });
      }

      // Build metadata map
      const metadata: Record<string, DocumentMetadata> = {};

      if (data) {
        for (const doc of data) {
          metadata[doc.id] = {
            id: doc.id,
            title: doc.title,
            fileName: doc.file_name,
            fileType: doc.file_type,
            fileSize: doc.file_size,
            pageCount: doc.page_count,
            author: doc.author,
            createdDate: doc.created_date ? new Date(doc.created_date) : undefined,
            modifiedDate: doc.modified_date ? new Date(doc.modified_date) : undefined,
            uploadedBy: doc.uploaded_by,
            tags: doc.tags,
            categories: doc.categories,
            customMetadata: doc.custom_metadata
          };
        }
      }

      return metadata;

    } catch (error) {
      logger.error(`Error getting document metadata: ${error}`);
      return {};
    }
  }

  /**
   * Highlight query terms in content
   *
   * @param content Content to highlight
   * @param query Query to highlight
   * @returns Highlighted content
   */
  private highlightQueryTerms(
    content: string,
    query: string
  ): string {
    // Simple highlighting - in a real implementation this would be more sophisticated
    const terms = query.split(/\s+/)
      .filter(term => term.length > 2)
      .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); // Escape regex special chars

    if (terms.length === 0) {
      return content;
    }

    // Create regex for all terms
    const regex = new RegExp(`(${terms.join('|')})`, 'gi');

    // Replace matches with highlighted version
    return content.replace(regex, '<em>$1</em>');
  }

  /**
   * Fallback keyword search when vector search returns no results
   *
   * @param query Search query
   * @param limit Result limit
   * @param offset Result offset
   * @param documentIds Optional document IDs to filter by
   * @param includeMetadata Whether to include document metadata
   * @param highlightResults Whether to highlight matched terms
   * @returns Search results
   */
  private async fallbackKeywordSearch(
    query: string,
    limit: number,
    offset: number,
    documentIds: string[] = [],
    includeMetadata: boolean = true,
    highlightResults: boolean = true
  ): Promise<DocumentSearchResult[]> {
    try {
      logger.info(`Falling back to keyword search for: "${query}"`);

      // Build base query
      let chunksQuery = supabase.getClient()
        .from(this.documentChunksTableName)
        .select(`
          document_id,
          content,
          page_number,
          section
        `)
        .textSearch('content', query)
        .order('document_id');

      // Apply document ID filter if provided
      if (documentIds.length > 0) {
        chunksQuery = chunksQuery.in('document_id', documentIds);
      }

      // Apply limit with buffer for multiple chunks per document
      chunksQuery = chunksQuery.limit(limit * 3);

      let chunks;
      try {
        const { data, error } = await chunksQuery;

        if (error) {
          throw handleSupabaseError(error, 'fallbackKeywordSearch', { query });
        }

        chunks = data;
      } catch (err) {
        throw handleSupabaseError(err, 'fallbackKeywordSearch', { query });
      }

      if (!chunks || chunks.length === 0) {
        return [];
      }

      // Group chunks by document
      const documentChunks: Record<string, any[]> = {};

      for (const chunk of chunks) {
        const docId = chunk.document_id;

        if (!documentChunks[docId]) {
          documentChunks[docId] = [];
        }

        documentChunks[docId].push(chunk);
      }

      // Get document metadata
      let documentMetadata: Record<string, DocumentMetadata> = {};
      let documentTitles: Record<string, string> = {};

      if (includeMetadata) {
        documentMetadata = await this.getDocumentsMetadata(Object.keys(documentChunks));

        // Extract titles
        for (const [docId, metadata] of Object.entries(documentMetadata)) {
          documentTitles[docId] = metadata.title;
        }
      } else {
        // Just get titles
        documentTitles = await this.getDocumentTitles(Object.keys(documentChunks));
      }

      // Build results
      const results: DocumentSearchResult[] = [];

      for (const [docId, chunks] of Object.entries(documentChunks)) {
        // Prepare matched chunks
        const matchedChunks = chunks.slice(0, 3).map(chunk => {
          return {
            content: chunk.content,
            highlighted: highlightResults ? this.highlightQueryTerms(chunk.content, query) : undefined,
            pageNumber: chunk.page_number,
            section: chunk.section
          };
        });

        // Add result (use fixed relevance for keyword search)
        results.push({
          documentId: docId,
          documentTitle: documentTitles[docId] || 'Unknown Document',
          relevance: 0.5, // Default relevance for keyword search
          matchedChunks,
          metadata: includeMetadata ? documentMetadata[docId] : undefined
        });
      }

      // Apply offset and limit
      return results.slice(offset, offset + limit);

    } catch (error) {
      logger.error(`Keyword search failed: ${error}`);
      return [];
    }
  }

  /**
   * Get document by ID
   *
   * @param documentId Document ID
   * @param includeChunks Whether to include content chunks
   * @returns Document metadata and optionally content
   */
  public async getDocumentById(
    documentId: string,
    includeChunks: boolean = false
  ): Promise<{
    metadata: DocumentMetadata;
    chunks?: DocumentChunk[];
  } | null> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Get document metadata
      const metadataMap = await this.getDocumentsMetadata([documentId]);

      if (!metadataMap[documentId]) {
        return null;
      }

      const result: {
        metadata: DocumentMetadata;
        chunks?: DocumentChunk[];
      } = {
        metadata: metadataMap[documentId]
      };

      // Get chunks if requested
      if (includeChunks) {
        const client = supabaseClient.getClient();

        const { data, error } = await (client as any)
          .from(this.documentChunksTableName)
          .select('chunk_index, content, page_number, section, headings')
          .eq('document_id', documentId)
          .order('chunk_index');

        if (error) {
          throw error;
        }

        if (data) {
          result.chunks = data.map((chunk: any) => ({
            documentId,
            chunkIndex: chunk.chunk_index,
            content: chunk.content,
            pageNumber: chunk.page_number,
            section: chunk.section,
            headings: chunk.headings
          }));
        }
      }

      return result;

    } catch (error) {
      logger.error(`Error getting document: ${error}`);
      return null;
    }
  }

  /**
   * Find entities in documents
   *
   * @param options Entity search options
   * @returns Entity recognition results
   */
  public async findEntities(
    options: {
      entityType?: string;
      query?: string;
      limit?: number;
      minConfidence?: number;
    }
  ): Promise<EntityRecognitionResult[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const {
        entityType,
        query,
        limit = 10,
        minConfidence = 0.7
      } = options;

      const client = supabaseClient.getClient();

      // Start building query
      let entitiesQuery = (client as any)
        .from(this.entitiesTableName)
        .select('*');

      // Apply type filter if provided
      if (entityType) {
        entitiesQuery = entitiesQuery.eq('type', entityType);
      }

      // Apply text search if query provided
      if (query) {
        // If query is provided, we need to do a vector similarity search
        const queryEmbedding = await this.generateTextEmbedding(query);

        // Get entities by vector similarity
        const similarEntities = await vectorSearch.findSimilar(
          queryEmbedding,
          this.entitiesTableName,
          this.vectorColumnName,
          {
            threshold: minConfidence,
            limit
          }
        );

        if (!similarEntities || similarEntities.length === 0) {
          return [];
        }

        // Process entities
        return this.processEntityResults(similarEntities);

      } else {
        // No query, just get by type or all entities
        entitiesQuery = entitiesQuery.limit(limit);

        const { data, error } = await entitiesQuery;

        if (error) {
          throw error;
        }

        if (!data || data.length === 0) {
          return [];
        }

        // Process entities
        return this.processEntityResults(data);
      }

    } catch (error) {
      logger.error(`Entity search failed: ${error}`);
      throw new Error(`Entity search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process entity results into the standard format
   *
   * @param entities Entity data from database
   * @returns Formatted entity recognition results
   */
  private processEntityResults(
    entities: any[]
  ): EntityRecognitionResult[] {
    const results: EntityRecognitionResult[] = [];

    for (const entity of entities) {
      // Get confidence (use similarity if available, otherwise entity confidence)
      const confidence = entity.similarity || 0.8;

      // Format mentions
      const mentions = (entity.document_mentions || []).map((mention: any) => ({
        documentId: mention.documentId,
        documentTitle: mention.documentTitle,
        context: mention.contexts && mention.contexts.length > 0
          ? mention.contexts[0]
          : undefined,
        pageNumber: mention.pageNumber
      }));

      // Add result
      results.push({
        entity: entity.entity,
        type: entity.type,
        confidence,
        mentions
      });
    }

    return results;
  }

  /**
   * Delete a document and all associated data
   *
   * @param documentId Document ID
   * @returns Success indicator
   */
  public async deleteDocument(
    documentId: string
  ): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const client = supabaseClient.getClient();

      // Delete document - chunks will be deleted by CASCADE constraint
      const { error } = await (client as any)
        .from(this.documentsTableName)
        .delete()
        .eq('id', documentId);

      if (error) {
        throw error;
      }

      // Update entity mentions for this document
      await this.removeDocumentFromEntities(documentId);

      return true;

    } catch (error) {
      logger.error(`Error deleting document: ${error}`);
      return false;
    }
  }

  /**
   * Remove document from entity mentions
   *
   * @param documentId Document ID
   */
  private async removeDocumentFromEntities(
    documentId: string
  ): Promise<void> {
    try {
      const client = supabaseClient.getClient();

      // Get entities that mention this document
      const { data, error } = await (client as any)
        .from(this.entitiesTableName)
        .select('id, document_mentions')
        .filter('document_mentions', 'cs', JSON.stringify({ documentId }));

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return;
      }

      // Update each entity
      for (const entity of data) {
        // Remove this document from mentions
        const updatedMentions = (entity.document_mentions || [])
          .filter((mention: any) => mention.documentId !== documentId);

        // Update entity
        await (client as any)
          .from(this.entitiesTableName)
          .update({
            document_mentions: updatedMentions,
            updated_at: new Date().toISOString()
          })
          .eq('id', entity.id);
      }

    } catch (error) {
      logger.error(`Error removing document from entities: ${error}`);
      // Non-critical operation, so just log the error
    }
  }
}

// Export singleton instance
export const documentProcessingService = DocumentProcessingService.getInstance();
export default documentProcessingService;