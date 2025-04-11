# RAG System: Architecture and Customization Guide

## Overview

The Retrieval-Augmented Generation (RAG) system enhances the platform's ability to provide accurate, contextually relevant information about materials by combining vector search with knowledge base integration and generative AI. This document provides a comprehensive guide to the system architecture, customization options, and optimization strategies.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Component Details](#component-details)
3. [Customization Options](#customization-options)
4. [Prompt Engineering](#prompt-engineering)
5. [Fine-tuning Models](#fine-tuning-models)
6. [Parameter Optimization](#parameter-optimization)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting](#troubleshooting)
9. [Integration with Existing Systems](#integration-with-existing-systems)
10. [Extending the System](#extending-the-system)

## System Architecture

The RAG system consists of five major components that work together in a pipeline:

```mermaid
graph TD
    subgraph Frontend
        UserQuery[User Query] --> TypeScriptBridge[TypeScript Bridge]
        TypeScriptBridge --> PythonBridge[Python Bridge Handler]
        Response[Response to User] <-- Results --- TypeScriptBridge
    end
    
    subgraph RAGSystem[RAG System Core]
        PythonBridge --> |Query| UnifiedService[Unified RAG Service]
        
        UnifiedService --> Embedding[Enhanced Text Embeddings]
        Embedding -->|Vector| Retrieval[Hybrid Retrieval System]
        
        Retrieval --> |Materials & Knowledge| ContextAssembly[Context Assembly System]
        
        ContextAssembly --> |Structured Context| GenerativeEnhancer[Generative Enhancement Layer]
        
        GenerativeEnhancer --> |Enhanced Response| UnifiedService
        
        UnifiedService -.->|Cache Results| Cache[(Cache)]
        UnifiedService <-.->|Check Cache| Cache
    end
    
    subgraph Storage
        Retrieval <--> |Vector Search| SupabaseVectors[(Supabase pgvector)]
        Retrieval <--> |Knowledge Lookup| KnowledgeBase[(Knowledge Base)]
        ContextAssembly <--> |Relationships| KnowledgeGraph[(Knowledge Graph)]
    end
    
    classDef system fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef storage fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef frontend fill:#fff3e0,stroke:#e65100,stroke-width:2px;
    classDef component fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px;
    
    class UnifiedService,Cache system;
    class SupabaseVectors,KnowledgeBase,KnowledgeGraph storage;
    class UserQuery,TypeScriptBridge,PythonBridge,Response frontend;
    class Embedding,Retrieval,ContextAssembly,GenerativeEnhancer component;
```

*Note: If this diagram doesn't render correctly in your markdown viewer, you can find the source file at [docs/diagrams/rag-system-architecture.mmd](../docs/diagrams/rag-system-architecture.mmd).*

### Component Flow

1. **User Query Processing**: The system receives a user query about materials.
2. **Embedding Generation**: The query is converted to embeddings (dense and/or sparse).
3. **Hybrid Retrieval**: Multiple retrieval methods find relevant materials and knowledge.
4. **Context Assembly**: Retrieved information is organized into a structured context.
5. **Generative Enhancement**: An LLM enhances the results with explanations, citations, and recommendations.
6. **Response Delivery**: Results are returned to the user, with optional streaming for large responses.

## Component Details

### 1. Enhanced Vector Storage System

**Files:**
- `packages/ml/python/enhanced_text_embeddings.py` - Text embedding generator
- `packages/server/src/services/supabase/migrations/006_enhanced_vector_storage.sql` - Database schema
- `packages/server/src/services/supabase/enhanced-vector-service.ts` - TypeScript service

**Key Features:**
- Dense embeddings using transformer models
- Sparse embeddings using BM25 and TF-IDF
- HNSW indexing for fast approximate nearest neighbor search
- Specialized indexes per material category

**Customization Points:**
- Embedding models can be configured in `enhanced_text_embeddings.py`
- Index parameters can be adjusted in the migration file
- Storage settings controlled via the config object in the service

### 2. Hybrid Retrieval System

**Files:**
- `packages/ml/python/hybrid_retriever.py` - Multi-stage retrieval implementation

**Key Features:**
- Multi-stage retrieval (dense, sparse, metadata)
- Ensemble approaches with configurable strategies
- Contextualized re-ranking of results
- Flexible filtering and query refinement

**Customization Points:**
- Retrieval strategies can be configured via the `strategy` parameter
- Ensemble weights adjustable in `_blend_results` method
- Re-ranking parameters in `_rerank_results` method
- Filtering logic in `_apply_filters` method

### 3. Context Assembly System

**Files:**
- `packages/ml/python/context_assembler.py` - Context organization

**Key Features:**
- Structured property extraction from knowledge base
- Relationship context incorporation
- Vector-knowledge integration
- Optimized formatting for downstream LLM use

**Customization Points:**
- Knowledge sources prioritization in `_gather_knowledge` method
- Relationship mapping parameters in `_process_relationships` method
- Context structure in `_format_context` method
- Maximum context sizes in the configuration

### 4. Generative Enhancement Layer

**Files:**
- `packages/ml/python/generative_enhancer.py` - LLM integration

**Key Features:**
- LLM integration for content enhancement
- Factual grounding with knowledge base
- Citation system for transparency
- Multiple enhancement types (explanations, similarities, applications)

**Customization Points:**
- LLM model selection in the configuration
- Prompt templates in `_build_*_prompt` methods
- Response processing in `_process_*` methods
- Enhancement types in the configuration

### 5. Unified RAG Service

**Files:**
- `packages/ml/python/material_rag_service.py` - Orchestration service
- `packages/ml/python/rag_bridge_handler.py` - Bridge to TypeScript
- `packages/ml/src/rag-bridge.ts` - TypeScript integration

**Key Features:**
- Pipeline orchestration across all components
- Caching for performance optimization
- Streaming support for progressive delivery
- Comprehensive API with query, batch, and streaming interfaces

**Customization Points:**
- Service configuration in the constructor
- Caching parameters in the configuration
- Stream chunk size and format in streaming methods
- Error handling strategies

## Customization Options

### Configuration System

The RAG system uses a hierarchical configuration system that can be customized at multiple levels:

1. **Default Configuration**: Base settings in each component
2. **Global Configuration**: System-wide settings in the RAG service
3. **Query-specific Configuration**: Parameters for individual queries

Example of customizing the global configuration:

```typescript
// In TypeScript
import { ragBridge } from 'packages/ml/src/rag-bridge';

await ragBridge.updateConfig({
  enableCache: true,
  cacheTtl: 7200, // 2 hours
  retrieval: {
    maxResults: 15,
    strategy: 'hybrid',
    threshold: 0.7
  },
  generation: {
    model: 'gpt-4',
    temperature: 0.5,
    enhancementTypes: ['explanation', 'similarity', 'application']
  }
});
```

Example of query-specific configuration:

```typescript
// In TypeScript
const response = await ragBridge.query(
  "What are the best wood options for modern flooring?",
  { material_type: "wood" },
  {
    enhancementTypes: ['explanation', 'application'],
    includeRelationships: true,
    limit: 5
  }
);
```

### Adding New Embedding Models

To add a new embedding model:

1. Edit `packages/ml/python/enhanced_text_embeddings.py`
2. Add your model to the `AVAILABLE_MODELS` dictionary:

```python
AVAILABLE_MODELS = {
    # Existing models...
    "my-custom-model": {
        "path": "path/to/model",
        "dimension": 768,
        "normalize": True
    }
}
```

3. For more complex models, extend the `_generate_embeddings_with_model` method

### Creating Custom Retrieval Strategies

To add a new retrieval strategy:

1. Edit `packages/ml/python/hybrid_retriever.py`
2. Add a new method following this pattern:

```python
def _retrieve_with_custom_strategy(
    self,
    query_text: str,
    query_embedding: Dict[str, Any],
    filters: Optional[Dict[str, Any]] = None,
    limit: int = 10
) -> List[Dict[str, Any]]:
    # Your custom retrieval logic here
    # ...
    return results
```

3. Register it in the `retrieve` method's strategy selection

### Customizing Result Formatting

To customize how results are formatted:

1. Edit `packages/ml/python/context_assembler.py`
2. Modify the `_format_context` method:

```python
def _format_context(self, materials, knowledge_items, relationships):
    # Your custom formatting logic
    context = {
        "materials": materials,
        "knowledge": self._process_knowledge(knowledge_items),
        "relationships": self._process_relationships(relationships),
        "custom_section": self._generate_custom_section(materials)
    }
    return context
```

## Prompt Engineering

The RAG system uses several prompts for different aspects of the generative enhancement. Each can be customized to change the system's behavior.

### Prompt Locations

All prompts are located in `packages/ml/python/generative_enhancer.py` within the following methods:

- `_build_explanation_prompt` - For material explanations
- `_build_similarity_prompt` - For similarity comparisons
- `_build_application_prompt` - For application recommendations

### Prompt Structure

Each prompt has two parts:

1. **System Prompt**: Instructions for the LLM about its role and task
2. **User Prompt**: The specific query with context data

### Customizing Prompts

To customize a prompt:

1. Edit `packages/ml/python/generative_enhancer.py`
2. Modify the relevant `_build_*_prompt` method
3. Update both system and user prompts as needed

Example of customizing the explanation prompt:

```python
def _build_explanation_prompt(self, context: ContextData, query: str) -> Dict[str, str]:
    # Format materials data...
    
    # Customize system prompt
    system_prompt = f"""
    You are an expert materials scientist. Use only the provided context to explain
    materials in relation to the query. Focus on practical applications, durability,
    and cost-effectiveness. When information is not available, acknowledge the limitations.
    Always cite sources for specific facts using [Source: Name] format.
    """
    
    # Customize user prompt
    user_prompt = f"""
    Based on the provided information, explain each material's properties and suitability for: {query}
    
    Focus specifically on these aspects:
    1. Durability and long-term performance
    2. Installation complexity and requirements
    3. Cost considerations (initial and lifetime)
    4. Environmental impact and sustainability
    
    {context_text}
    """
    
    return {
        "system": system_prompt,
        "user": user_prompt
    }
```

### Testing Prompt Changes

After modifying prompts, test the changes using:

1. The verification script: `python packages/ml/python/verify_rag_modules.py`
2. Sample queries through the TypeScript bridge
3. Direct Python testing with the RAG service

## Fine-tuning Models

The RAG system supports fine-tuning of both embedding models and generative models to improve performance on specific material domains.

### Fine-tuning Embedding Models

To fine-tune an embedding model:

1. Prepare a dataset of material texts and their relationships
2. Use the following script pattern:

```python
from enhanced_text_embeddings import TextEmbeddingGenerator

# Initialize generator with base model
generator = TextEmbeddingGenerator(config={
    "default_model": "sentence-transformers/all-MiniLM-L6-v2"
})

# Prepare training data
train_data = [
    {"text": "Material description 1", "label": "category_1"},
    {"text": "Material description 2", "label": "category_1"},
    {"text": "Material description 3", "label": "category_2"},
    # ...
]

# Fine-tune model
generator.fine_tune_model(
    training_data=train_data,
    output_path="./custom_embeddings",
    epochs=10,
    batch_size=16,
    learning_rate=2e-5
)

# Update configuration to use fine-tuned model
generator.update_config({
    "default_model": "./custom_embeddings"
})
```

### Fine-tuning Generative Models

For generative models, use domain-specific instruction tuning:

1. Create a dataset of material-specific QA pairs
2. Use your preferred model provider's fine-tuning API
3. Update the generative enhancer configuration to use the fine-tuned model:

```python
from generative_enhancer import GenerativeEnhancer

enhancer = GenerativeEnhancer(config={
    "model": "your-fine-tuned-model-id",
    "temperature": 0.7
})
```

### Updating Fine-tuned Models

After fine-tuning, update the system configuration:

1. For one-time updates, use the `updateConfig` method
2. For permanent changes, modify the default configuration in the initialization file
3. For staging changes, implement an A/B testing framework by adding a version parameter to queries

## Parameter Optimization

### HNSW Index Parameters

HNSW (Hierarchical Navigable Small World) indexing parameters can be optimized for better performance:

1. Edit `packages/server/src/services/supabase/migrations/006_enhanced_vector_storage.sql`
2. Adjust these key parameters:

```sql
CREATE INDEX ON materials_embedding USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 200);
```

Parameter guidelines:
- `m`: Number of connections per node (8-64, higher = better quality but more memory)
- `ef_construction`: Size of the dynamic list for nearest neighbors (100-500, higher = better quality but slower indexing)
- `ef_search`: Size of the dynamic list for searching (not set in index, set at query time)

### Retrieval Parameters

Optimize the retrieval parameters based on your use case:

1. Edit the configuration in `packages/ml/python/material_rag_service.py`:

```python
self.config = {
    # ...
    "retrieval": {
        "max_results": 10,         # Number of results to retrieve
        "strategy": "hybrid",      # dense, sparse, hybrid, or metadata
        "threshold": 0.65,         # Minimum similarity score
        "dense_weight": 0.7,       # Weight of dense embeddings in hybrid
        "sparse_weight": 0.3,      # Weight of sparse embeddings in hybrid
        "reranking_enabled": True, # Whether to re-rank results
        "reranking_model": "cross-encoder/ms-marco-MiniLM-L-6-v2"
    },
    # ...
}
```

### Generative Parameters

Optimize the generative parameters for your quality-performance tradeoff:

```python
self.config = {
    # ...
    "generation": {
        "model": "gpt-4",             # LLM model to use
        "temperature": 0.7,           # Creativity vs determinism (0.0-1.0)
        "max_tokens": 1000,           # Maximum tokens in response
        "streaming_enabled": True,    # Whether to stream responses
        "enhancement_types": [
            "explanation",            # Include explanations
            "similarity",             # Include similarity comparisons
            "application"             # Include application recommendations
        ],
        "detail_level": "medium",     # brief, medium, or detailed
    },
    # ...
}
```

### Caching Parameters

Optimize caching based on your traffic patterns:

```python
self.config = {
    "enable_cache": True,      # Enable/disable caching
    "cache_ttl": 3600,         # Time-to-live in seconds
    "max_cache_size": 1000,    # Maximum cache entries
    # ...
}
```

## Performance Considerations

### Scaling the RAG System

The RAG system is designed to scale horizontally and vertically:

1. **Vertical Scaling**: Increase the resources allocated to the system
   - Recommended for small to medium deployments
   - Configure according to estimated workload:
     - Low volume (<100 queries/minute): 2 vCPUs, 8GB RAM
     - Medium volume (100-500 queries/minute): 4 vCPUs, 16GB RAM
     - High volume (500+ queries/minute): 8+ vCPUs, 32+GB RAM

2. **Horizontal Scaling**: Deploy multiple instances with load balancing
   - Recommended for high-volume deployments
   - Distribute load across multiple nodes
   - Use shared Redis cache for consistent caching
   - Configure centralized logging and metrics

### Memory Management

1. **Embedding Models**: Consider the memory footprint
   - Full-size models (768+ dimensions): 500MB+ RAM per instance
   - Quantized models: 150-300MB RAM per instance
   - Distilled models: 50-150MB RAM per instance

2. **LLM Integration**: Use efficient integration methods
   - Local models: Consider quantization and model size
   - API-based models: Optimize request batching
   - Use streaming for large responses to reduce memory pressure

3. **Batch Processing**: Configure for efficient resource use
   - `max_concurrent_requests`: Control parallelism (default: 10)
   - `batch_size`: Control batch size for embedding generation (default: 32)

### Monitoring

Monitor these key metrics for performance optimization:

1. **Latency**: End-to-end response time
   - Query processing time
   - Embedding generation time
   - Retrieval time
   - Context assembly time
   - Generation time

2. **Cache Performance**:
   - Cache hit rate (target: >50%)
   - Cache size
   - Average cache entry TTL

3. **Quality Metrics**:
   - Retrieval relevance (measured through feedback)
   - Generation accuracy (measured through feedback)
   - User satisfaction scores

## Troubleshooting

### Common Issues and Solutions

#### Slow Query Performance

**Symptoms:**
- High latency in query responses
- Timeouts on complex queries

**Potential Causes and Solutions:**
1. **Index issues**
   - Check index creation in Supabase
   - Ensure HNSW index is properly configured
   - Consider increasing `m` parameter in HNSW index

2. **Large result sets**
   - Decrease `max_results` parameter
   - Adjust filters to narrow search scope
   - Implement pagination for large result sets

3. **Complex generative tasks**
   - Reduce `enhancement_types` to essential ones
   - Set `detail_level` to "brief"
   - Use a faster LLM model for high-traffic scenarios

#### Low Relevance Results

**Symptoms:**
- Irrelevant materials returned in results
- Missing obviously relevant materials

**Potential Causes and Solutions:**
1. **Embedding mismatch**
   - Try different embedding models
   - Adjust strategy weights in hybrid retrieval
   - Consider fine-tuning embeddings on domain data

2. **Threshold issues**
   - Lower the similarity threshold to include more results
   - Tune the re-ranking model weights
   - Adjust `dense_weight` and `sparse_weight` in hybrid strategy

3. **Filter issues**
   - Check if filters are too restrictive
   - Verify metadata field mappings
   - Ensure material categorization is correct

#### Memory Issues

**Symptoms:**
- Out of memory errors
- System crashes under load

**Potential Causes and Solutions:**
1. **Embedding models too large**
   - Use smaller/quantized embedding models
   - Reduce `batch_size` for embedding generation
   - Implement incremental processing for large datasets

2. **Cache size issues**
   - Reduce `max_cache_size`
   - Implement LRU cache eviction policy
   - Consider distributed caching with Redis

3. **Large contexts for LLM**
   - Reduce `max_knowledge_items` in context assembly
   - Implement chunking for large contexts
   - Use more efficient context compression techniques

### Diagnostics

The system provides several diagnostic utilities:

1. **Verification Script**:
   ```bash
   python packages/ml/python/verify_rag_modules.py --json
   ```

2. **Health Check Endpoint**:
   ```typescript
   const health = await ragBridge.getHealthStatus();
   console.log(health);
   ```

3. **Usage Statistics**:
   ```typescript
   const stats = await ragBridge.getUsageStatistics();
   console.log(stats);
   ```

## Extending the System

### Adding New Enhancement Types

To add a new enhancement type:

1. Edit `packages/ml/python/generative_enhancer.py`
2. Add a new prompt building method:
   ```python
   def _build_new_enhancement_prompt(self, context, query):
       # Prompt building logic
       return {"system": system_prompt, "user": user_prompt}
   ```

3. Add a new processing method:
   ```python
   def _process_new_enhancement(self, response_text, context_data):
       # Process the raw LLM response
       return processed_data
   ```

4. Add a new method for generating the enhancement:
   ```python
   async def _generate_new_enhancement(self, context, query):
       prompt = self._build_new_enhancement_prompt(context, query)
       response, _ = await self._get_llm_response(prompt)
       return self._process_new_enhancement(response, context)
   ```

5. Add the new enhancement type to the configuration options
6. Update the `enhance` method to include the new enhancement type

### Integration with External Systems

The RAG system can be integrated with external systems:

1. **Document Management Systems**:
   - Implement a document processor in the Context Assembly System
   - Add document fetching logic to the Retrieval System
   - Use document metadata as filters in queries

2. **CRM Systems**:
   - Map user profiles to query preferences
   - Personalize RAG responses based on user history
   - Track user feedback for continuous improvement

3. **E-commerce Platforms**:
   - Connect product catalogs to the material database
   - Add pricing and availability information to RAG responses
   - Implement recommendation features that leverage RAG results

### Continuous Improvement

Implement a feedback loop for continuous improvement:

1. **Capture Feedback**:
   - Add feedback collection to the TypeScript bridge
   - Track which results were helpful/unhelpful
   - Collect specific feedback on enhancement types

2. **Analyze Patterns**:
   - Identify common failure modes
   - Detect bias in responses
   - Find opportunities for model fine-tuning

3. **Implement Improvements**:
   - Update prompts based on feedback
   - Fine-tune models with new examples
   - Adjust retrieval parameters for better relevance

4. **Measure Impact**:
   - Track before/after metrics
   - Conduct A/B tests with changes
   - Calculate ROI of improvements

This cycle ensures the RAG system continuously adapts to user needs and improves over time.

## Integration with Existing Systems

This section explains how the RAG system integrates with and enhances the platform's existing capabilities, particularly visual recognition, PDF processing, and material database operations.

### RAG and Visual Recognition Integration

The RAG system significantly enhances the platform's visual recognition capabilities:

1. **Context-Enriched Recognition**: After visual recognition identifies a material (like a tile, wood, or stone), the RAG system automatically retrieves related knowledge, specifications, and similar materials from your database.

2. **Multi-modal Understanding**: By connecting visual features with textual knowledge, the system provides a comprehensive understanding of materials. For example, if visual recognition identifies "white marble," the RAG system immediately provides information about its composition, durability, price range, and appropriate applications.

3. **Improved Accuracy through Knowledge**: The RAG system can improve recognition accuracy by using domain knowledge to validate and refine visual recognition results. For instance, if the visual system identifies a material with 70% confidence, but certain visual properties contradict known facts about that material, the RAG system can suggest alternatives.

4. **Relationship Mapping**: Once a material is recognized, the RAG system maps it to your knowledge graph, exposing relationships with complementary materials, alternative options, and typical applications.

**Implementation Details:**
- The visual recognition system communicates with the RAG system through the TypeScript bridge
- Material identifications are passed as queries to the RAG system
- Vector embeddings from images can be combined with text embeddings for multi-modal search
- Configuration options in the RAG service allow for adjusting the balance between visual and textual features

### PDF Processing for Materials Training

When processing PDFs with tile information to train the system:

1. **Intelligent Extraction**: The RAG system works with your existing PDF processing to extract structured information about materials - specifications, properties, applications, and visual characteristics.

2. **Automatic Knowledge Integration**: Extracted information is connected to the existing knowledge base:
   - New material information is linked with existing knowledge
   - Conflicts or updates needed in existing data are identified
   - Embeddings are automatically generated for semantic search
   - Material categorizations are suggested based on properties

3. **Training Enhancement**: The extracted data improves system training:
   - Embedding models can be fine-tuned with domain-specific data
   - The recognition vocabulary for visual systems is expanded
   - Training pairs for similarity and relationship models are created

4. **Quality Assurance**: The RAG system provides verification by cross-referencing new material data against existing knowledge, flagging potential errors or inconsistencies in imported specifications.

**Implementation Details:**
- PDF processing connects with the RAG system through the `context_assembler.py` module
- Extracted text is processed through the enhanced text embeddings component
- The RAG system can be configured to align with specific PDF structures through custom extractors
- Configuration options in `material_rag_service.py` control how PDF content is processed and stored

### Database Integration and Material Imports

When importing materials to the database, the RAG system enhances the process:

1. **Enriched Indexing**: New materials are automatically:
   - Embedded using both dense (transformer-based) and sparse (BM25/TF-IDF) vectors
   - Indexed using HNSW for extremely fast retrieval at scale
   - Categorized with specialized indexes based on material type

2. **Knowledge Graph Integration**: Each new material is:
   - Connected to related materials (similar appearance, properties, applications)
   - Linked to appropriate knowledge base entries
   - Positioned within the overall materials hierarchy

3. **Enhanced Search and Discovery**: The RAG system transforms how users find materials:
   - Multi-stage retrieval combines vector, text, and metadata search
   - Contextualized re-ranking improves result relevance
   - Ensemble approaches blend multiple search strategies

4. **Generative Enhancements**: For discovered materials, the system automatically generates:
   - Detailed explanations tailored to user queries
   - Comparative analyses with similar materials
   - Application recommendations with reasoning
   - Citations to knowledge sources for verification

**Implementation Details:**
- Database operations interact with the RAG system through the enhanced vector service
- The migration file (`006_enhanced_vector_storage.sql`) defines the database structure
- New materials trigger automatic embedding generation through configured hooks
- The TypeScript bridge exposes methods for manual and automatic indexing

### Practical Use Case Example

Here's how these integrations come together in a real-world scenario:

1. A designer uploads a photo of a tile they saw in a showroom
2. The visual recognition system identifies it as "travertine limestone"
3. The RAG system immediately:
   - Retrieves detailed specifications from the database
   - Finds visually similar materials that might be alternatives
   - Provides typical applications for this material type
   - Suggests complementary materials for design harmony
   - Generates an explanation of its properties and maintenance needs

4. If the designer then uploads a PDF catalog with more travertine options:
   - The system extracts and structures all material information
   - New variants are automatically indexed and related to existing ones
   - The knowledge base expands with new specifications
   - All content becomes immediately searchable and retrievable

5. When clients search later, whether by text ("durable kitchen flooring") or by uploading similar images, the system provides comprehensive, knowledge-grounded responses that combine visual, factual, and relational information.

**Configuration for This Scenario:**

```typescript
// Configure the RAG system for optimal visual-textual integration
await ragBridge.updateConfig({
  integration: {
    visualRecognition: {
      enabled: true,
      confidenceThreshold: 0.65,
      enhanceResults: true,
      multiModalSearch: true
    },
    pdfProcessing: {
      extractionDetail: "high",
      autoIndex: true,
      validateAgainstKnowledge: true
    },
    materialImport: {
      generateEmbeddingsOnImport: true,
      buildRelationships: true,
      indexStrategy: "hybrid_hnsw"
    }
  }
});
```

---

## Appendix

### Complete Configuration Options

For reference, here's the complete configuration schema with default values:

```python
DEFAULT_CONFIG = {
    # Service configuration
    "service_name": "material_rag_service",
    "version": "1.0.0",
    "enable_cache": True,
    "cache_ttl": 3600,  # 1 hour
    "max_cache_size": 1000,
    "timeout": 30,  # seconds
    "max_concurrent_requests": 10,
    
    # Embedding configuration
    "embedding": {
        "default_model": "sentence-transformers/all-MiniLM-L6-v2",
        "dense_dimension": 384,
        "sparse_enabled": True,
        "sparse_method": "bm25",  # or "tfidf"
        "normalize_embeddings": True,
        "pooling_method": "mean",  # or "max", "cls"
        "batch_size": 32
    },
    
    # Retrieval configuration
    "retrieval": {
        "max_results": 10,
        "strategy": "hybrid",  # dense, sparse, hybrid, metadata
        "threshold": 0.65,
        "dense_weight": 0.7,
        "sparse_weight": 0.3,
        "reranking_enabled": True,
        "reranking_model": "cross-encoder/ms-marco-MiniLM-L-6-v2",
        "top_k_stage1": 50,  # initial retrieval before re-ranking
        "diversify_results": True,
    },
    
    # Context assembly configuration
    "assembly": {
        "include_relationships": True,
        "max_knowledge_items": 20,
        "include_properties": True,
        "max_context_tokens": 3000,
        "relationship_depth": 1,
        "prioritize_recency": True,
        "include_sources": True
    },
    
    # Generation configuration
    "generation": {
        "model": "gpt-4",
        "temperature": 0.7,
        "max_tokens": 1000,
        "streaming_enabled": True,
        "enhancement_types": ["explanation", "similarity", "application"],
        "citation_style": "inline",  # inline, footnote, endnote
        "detail_level": "medium",    # brief, medium, detailed
        "include_source_properties": True,
        "include_confidence_scores": True,
        "structured_response": True
    },
    
    # Tracking configuration
    "tracking_enabled": True,
    "log_level": "info",
    "metrics_enabled": True,
    "feedback_collection": True
}
```

### API Reference

For a complete API reference, see the code documentation in each module or refer to:

- TypeScript API: `packages/ml/src/rag-bridge.ts`
- Python API: `packages/ml/python/material_rag_service.py`