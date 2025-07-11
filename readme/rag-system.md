# RAG System: Architecture, Enhancements, and Integration Guide

## Overview

The Retrieval-Augmented Generation (RAG) system enhances the platform's ability to provide accurate, contextually relevant information about materials by combining vector search with knowledge base integration and generative AI. This document provides a comprehensive guide to the system architecture, enhancements, customization options, and integration steps.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Core Component Details](#core-component-details)
3. [Key Enhancements](#key-enhancements)
4. [Setup and Installation](#setup-and-installation)
5. [Deployment](#deployment)
6. [Integration Steps](#integration-steps)
7. [API Endpoints and Admin Panel](#api-endpoints-and-admin-panel)
8. [Customization Options](#customization-options)
9. [Prompt Engineering](#prompt-engineering)
10. [Fine-tuning Models](#fine-tuning-models)
11. [Parameter Optimization](#parameter-optimization)
12. [Performance Considerations](#performance-considerations)
13. [Troubleshooting](#troubleshooting)
14. [Integration with Existing Systems](#integration-with-existing-systems)
15. [Extending the System](#extending-the-system)
16. [MCP Server Integration](#mcp-server-integration)
17. [Kubernetes Deployment](#kubernetes-deployment)
18. [CI/CD Integration](#cicd-integration)
19. [Implementation Checklist](#implementation-checklist)

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

## Core Component Details

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
- Dynamic embedding generation with model selection
- Auto-normalization and dimension handling
- Custom tokenization for domain-specific terms
- Multi-lingual support with language detection

**Customization Points:**
- Embedding models can be configured in `enhanced_text_embeddings.py`
- Index parameters can be adjusted in the migration file
- Storage settings controlled via the config object in the service
- Custom tokenization rules for domain-specific terminology

### 2. Hybrid Retrieval System

**Files:**
- `packages/ml/python/hybrid_retriever.py` - Multi-stage retrieval implementation
- `packages/server/src/types/enhancedVector.types.ts` - TypeScript type definitions
- `packages/server/src/controllers/enhancedVector.controller.ts` - API endpoints
- `packages/server/src/services/supabase/enhanced-vector-service.ts` - Service implementation
- `packages/server/src/utils/enhancedVectorValidation.ts` - Input validation

**Key Features:**
- Advanced multi-stage retrieval combining five approaches:
  1. Dense vector embedding search (semantic similarity)
  2. Sparse vector search (keyword/feature matching)
  3. Metadata filtering (structured property matching)
  4. Ensemble approach for result blending with adaptive weighting
  5. Contextualized re-ranking with performance monitoring
- Knowledge base integration with bidirectional linking
- Distributive retrieval for heterogeneous data sources
- Performance optimization with query profiling and auto-tuning
- Streaming support for large responses
- Comprehensive API with query, batch, and streaming interfaces
- Material relationship mapping with transitive discovery
- Advanced filtering with nested property support
- Semantic indexing with automated classification

**Customization Points:**
- Retrieval strategies can be configured via the `strategy` parameter (`hybrid`, `vector_first`, `knowledge_first`, `balanced`, `adaptive`)
- Ensemble weights adjustable in `_combine_results` method with dense, sparse, and metadata weights
- Re-ranking parameters in `_rerank_results` method including property matching boost
- Filtering logic in `_apply_filters` method with support for advanced operators
- Knowledge base integration via the `use_knowledge_base` parameter
- Performance profiles for different use cases (`speed`, `quality`, `balanced`)

### 3. Context Assembly System

**Files:**
- `packages/ml/python/context_assembler.py` - Context organization
- `packages/ml/python/hybrid_retriever.py` - Contains `ContextAssembler` class

**Key Features:**
- Structured property extraction from knowledge base
- Relationship context incorporation
- Vector-knowledge integration
- Optimized formatting for downstream LLM use
- Knowledge graph context extraction
- Material relationship mapping
- Bidirectional linking between materials and knowledge
- Cross-reference validation for data consistency
- Hierarchical context organization with priority levels

**Customization Points:**
- Knowledge sources prioritization in `_gather_knowledge` method
- Relationship mapping parameters in `_get_relationships` method
- Context structure in `_format_context` method
- Knowledge graph context in `_get_knowledge_graph_context` method
- Maximum context sizes in the configuration via `max_context_items` parameter
- Priority weighting for different context types

### 4. Generative Enhancement Layer

**Files:**
- `packages/ml/python/generative_enhancer.py` - LLM integration
- `packages/ml/python/hybrid_retriever.py` - Contains `GenerativeEnhancer` class

**Key Features:**
- LLM integration for content enhancement
- Factual grounding with knowledge base
- Citation system for transparency
- Multiple enhancement types (explanations, comparisons, applications)
- Source extraction for proper attribution
- Template-based prompt generation
- Adaptive response formatting based on query type
- Confidence scoring for generated content
- Structured output options for machine consumption

**Customization Points:**
- LLM model selection in the configuration
- Customizable prompt templates:
  - `explanation_template` for material explanations
  - `comparison_template` for similarity comparisons
  - `application_template` for application recommendations
- Response processing in `_process_*` methods
- Property formatting in `_format_properties` method
- Context formatting in `_format_context` method
- Confidence threshold settings

### 5. Unified RAG Service

**Files:**
- `packages/ml/python/material_rag_service.py` - Orchestration service
- `packages/ml/python/rag_bridge_handler.py` - Bridge to TypeScript
- `packages/ml/src/rag-bridge.ts` - TypeScript integration
- `packages/ml/python/hybrid_retriever.py` - Contains `MaterialRAGService` class
- `packages/server/src/controllers/enhancedVector.controller.ts` - API endpoints

**Key Features:**
- Pipeline orchestration across all components
- Caching for performance optimization with TTL settings
- Streaming support for progressive delivery
- Comprehensive API with query, batch, and streaming interfaces
- Image-based search capabilities
- Material comparison features
- MCP (Material Computing Platform) integration
- Performance monitoring and telemetry
- Dynamic configuration management
- Cross-platform operation via bridge handlers

**Customization Points:**
- Service configuration in the constructor
- Caching parameters: `cache_results` and `cache_ttl_seconds`
- Result enhancement options in `_enhance_results` method
- Image search parameters in `search_by_image` method
- Material comparison in `compare_materials` method
- API integration with vector search configurations
- Performance monitoring settings

## Key Enhancements

The enhanced RAG system builds upon the core architecture with several significant improvements:

### Material-Specific Models

The system now uses specialized prompt templates and models optimized for different material types (wood, tile, stone, etc.), resulting in more accurate and domain-specific responses.

**Key Features:**
- Material-specific system prompts with domain expertise
- Specialized instruction sets for different material types
- Material-specific evaluation criteria
- Custom citation formats for different material domains

**Implementation:**
- `material_specific_prompts.py`: Defines specialized prompt templates for different material types
- Integration with the generative enhancer to use material-specific prompts for explanations, similarities, and applications

**Benefits:**
- More accurate and relevant responses for specific material types
- Better understanding of domain-specific terminology and concepts
- Improved user experience with material-specific expertise

### Continuous Learning Pipeline

The system now includes a continuous learning pipeline that automatically fine-tunes models based on user feedback and performance metrics.

**Key Features:**
- Automated fine-tuning triggers based on feedback metrics
- A/B testing framework for model comparison
- Performance tracking and analysis
- Feedback-based training data generation

**Implementation:**
- `continuous_learning_pipeline.py`: Implements the continuous learning pipeline
- `model_registry.py`: Manages models and A/B tests

**Benefits:**
- Continuously improving model performance
- Data-driven model selection
- Systematic evaluation of model performance
- Adaptation to changing user needs and preferences

### Advanced Retrieval Techniques

The system now uses advanced retrieval techniques to handle complex queries more effectively.

**Key Features:**
- Query decomposition for complex queries
- Hierarchical retrieval for multi-faceted queries
- Result reranking based on query relevance
- Support for both dense and sparse retrieval methods

**Implementation:**
- `hierarchical_retriever.py`: Implements hierarchical retrieval for complex queries

**Benefits:**
- Better handling of complex, multi-faceted queries
- More comprehensive retrieval results
- Improved relevance ranking
- Better support for comparative queries

### Enhanced Visual Recognition Integration

The system now integrates visual information more effectively with textual queries.

**Key Features:**
- Visual context enrichment for text queries
- Cross-modal attention for better integration of visual and textual information
- Multi-modal embedding generation
- Visual feature extraction and integration

**Implementation:**
- `cross_modal_attention.py`: Implements cross-modal attention mechanisms

**Benefits:**
- Better understanding of visual material characteristics
- More accurate responses to queries with images
- Enhanced ability to describe and compare materials visually
- Improved multi-modal search capabilities

### Performance Optimization

The system now includes performance optimizations for large-scale deployments.

**Key Features:**
- Distributed retrieval across multiple vector stores
- Caching strategies for frequently accessed materials
- Load balancing for retrieval operations
- Batched operations for improved throughput

**Implementation:**
- `distributed_retrieval.py`: Implements distributed retrieval and caching

**Benefits:**
- Improved scalability for large vector databases
- Reduced latency for frequent queries
- Better resource utilization
- Higher throughput for concurrent requests

## Setup and Installation

### Prerequisites

Before installing the Enhanced RAG system, ensure you have the following:

1. **Python 3.8+** - The enhanced RAG system requires Python 3.8 or higher.
2. **Node.js 16+** - Required for the TypeScript bridge components.
3. **Docker** - Required for containerized deployment.
4. **Kubernetes** - Required for production deployment.
5. **Supabase Account** - Required for vector storage.
6. **OpenAI API Key** - Or another LLM provider API key.

### Installation Steps

#### 1. Clone the Repository

```bash
git clone https://github.com/your-org/kai-platform.git
cd kai-platform
```

#### 2. Install Python Dependencies

```bash
cd packages/ml
pip install -r requirements.txt
pip install -e .
```

#### 3. Install Node.js Dependencies

```bash
cd ../..
npm install
cd packages/ml
npm install
```

#### 4. Configure Environment

Create a `.env` file in the `packages/ml` directory with the following variables:

```
# LLM Configuration
OPENAI_API_KEY=your_openai_api_key
LLM_PROVIDER=openai
LLM_MODEL=gpt-4

# Vector DB Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Storage Paths
RAG_DATA_DIR=/path/to/data
MODEL_REGISTRY_DIR=/path/to/model-registry
MODELS_DIR=/path/to/models

# Performance Configuration
ENABLE_CACHE=true
CACHE_TTL=3600
MAX_CONCURRENT_REQUESTS=10
```

#### 5. Create Necessary Directories

```bash
mkdir -p data/model-registry data/models data/state data/temp
```

#### 6. Initialize the Vector Database

```bash
cd packages/ml/python
python initialize_vector_db.py
```

#### 7. Set Up Dependencies

Set up the necessary dependencies for the enhanced RAG system:

```bash
# Set up dependencies
python packages/ml/python/setup_dependencies.py --config path/to/config.json
```

This will create the required directories and initialize the vector stores.

#### 8. Verify Installation

Verify the installation by running the test script:

```bash
python test_integration.py --config path/to/config.json --setup
```

### Configuration

The enhanced RAG system is configured using a JSON file. The default configuration is in `helm/charts/kai/charts/ml-services/templates/continuous-learning-deployment.yaml` under the `enhanced-rag-config` ConfigMap.

You can customize the configuration by editing this file before deployment.

Key configuration sections:

- `model_registry_config`: Configuration for the model registry
- `learning_pipeline_config`: Configuration for the continuous learning pipeline
- `distributed_retrieval_config`: Configuration for distributed retrieval
- `hierarchical_retriever_config`: Configuration for hierarchical retrieval
- `cross_modal_attention_config`: Configuration for cross-modal attention

### Docker Installation

For containerized deployment, you can use the provided Dockerfile:

```bash
# Build the Docker image
docker build -t enhanced-rag -f Dockerfile.rag .

# Run the Docker container
docker run -p 8000:8000 \
  -e OPENAI_API_KEY=your_openai_api_key \
  -e SUPABASE_URL=your_supabase_url \
  -e SUPABASE_KEY=your_supabase_key \
  -v /path/to/data:/data \
  enhanced-rag
```

The enhanced RAG system is designed to integrate automatically with your existing MCP server and admin panel. No manual integration steps are required.

## Deployment

The enhanced RAG system includes automated deployment scripts that handle building, pushing, deploying, verifying, and monitoring the system.

### Automated Deployment

To deploy the enhanced RAG system using the automated pipeline:

```bash
# Make the script executable
chmod +x rag-deployment-pipeline.sh

# Run the deployment pipeline
./rag-deployment-pipeline.sh
```

This script will:
1. Build and push Docker images
2. Deploy to Kubernetes
3. Verify the deployment
4. Monitor system performance
5. Monitor API performance

### Manual Deployment

If you prefer to deploy manually, you can use the individual scripts:

1. Build and push Docker images:

```bash
# Set Docker registry and tag (optional)
export DOCKER_REGISTRY=your-registry
export TAG=latest

# Build and push images
./build-push-rag.sh
```

2. Deploy to Kubernetes:

```bash
# Deploy
./deploy-rag.sh
```

3. Verify the deployment:

```bash
# Verify
./verify-rag-deployment.sh
```

4. Monitor system performance:

```bash
# Set monitoring duration (optional)
export DURATION=10m

# Monitor system performance
./monitor-rag-performance.sh
```

5. Monitor API performance:

```bash
# Set API URL (optional)
export API_URL=http://your-api-url/api/rag

# Monitor API performance
./monitor-rag-api.sh
```

## Integration Steps

### 1. Initialize the Enhanced RAG System

Once dependencies are set up, initialize the enhanced RAG system:

```python
from packages.ml.python.initialize_enhanced_rag import initialize_enhanced_rag

# Create existing components dictionary
existing_components = {
    "base_retriever": your_base_retriever,
    "embedding_model": your_embedding_model,
    "vision_model": your_vision_model,
    "text_model": your_text_model,
    "llm_client": your_llm_client,
    "feedback_db": your_feedback_db,
    "vector_stores": your_vector_stores
}

# Initialize enhanced RAG
enhanced_rag = await initialize_enhanced_rag(
    config_path="path/to/config.json",
    existing_components=existing_components
)
```

### 2. Use the Enhanced RAG System

Once initialized, you can use the enhanced RAG system:

```python
# Process a text query
result = await enhanced_rag.process_query(
    text_query="What are the best hardwood flooring options for high-traffic areas?",
    options={"detail_level": "detailed"}
)

# Process an image query
result = await enhanced_rag.process_query(
    image_data=image_bytes,
    options={"detail_level": "medium"}
)

# Process a multi-modal query
result = await enhanced_rag.process_query(
    text_query="What type of wood is this and how durable is it?",
    image_data=image_bytes,
    options={"detail_level": "detailed"}
)

# Submit feedback
await enhanced_rag.submit_feedback(
    query="What are the best hardwood flooring options for high-traffic areas?",
    response=result,
    feedback={
        "rating": 4,
        "feedback_text": "Good information but could include more about maintenance requirements."
    }
)

# Get system stats
stats = await enhanced_rag.get_system_stats()
```

## API Endpoints and Admin Panel

### API Endpoints

The enhanced RAG system adds the following API endpoints:

#### EnhancedVector TypeScript Integration

**Files:**
- `packages/server/src/types/enhancedVector.types.ts` - Type definitions
- `packages/server/src/controllers/enhancedVector.controller.ts` - API controllers
- `packages/server/src/routes/enhancedVector.routes.ts` - API routes
- `packages/server/src/services/supabase/enhanced-vector-service.ts` - Service implementation
- `packages/server/src/utils/enhancedVectorValidation.ts` - Input validation

**Key Features:**
- Strongly typed interfaces for all vector operations
- Support for both dense and sparse vector embeddings with hybrid search
- API endpoints for vector search and knowledge integration
- Performance monitoring and configuration management
- Advanced filtering with nested property support
- Bidirectional linking between materials and knowledge
- Extensible adapter pattern for multiple vector storage backends
- Comprehensive error handling and validation
- Detailed query profiling and optimization suggestions
- Result pagination and cursor-based navigation

**Vector API Endpoints:**
- `POST /api/vector/enhanced/embeddings` - Generate embeddings for text
- `GET /api/vector/enhanced/search` - Search materials using text query
- `GET /api/vector/enhanced/materials/:id/similar` - Find similar materials
- `GET /api/vector/enhanced/knowledge/search` - Search with knowledge base integration
- `GET /api/vector/enhanced/knowledge/materials/:id/similar` - Find similar materials with knowledge
- `POST /api/vector/enhanced/knowledge/route` - Route a query between vector search and knowledge base
- `POST /api/vector/enhanced/knowledge/context` - Assemble context from materials and knowledge
- `GET /api/vector/enhanced/performance` - Get vector search performance statistics
- `GET /api/vector/enhanced/configs` - Get vector search configurations
- `POST /api/vector/enhanced/filter` - Advanced filtering with nested properties
- `GET /api/vector/enhanced/profile` - Profile a search query for optimization
- `POST /api/vector/enhanced/bulk` - Batch processing for multiple queries

**RAG API Endpoints:**
- `POST /api/rag/query` - Process a query with the enhanced RAG system
- `POST /api/rag/feedback` - Submit feedback for a RAG response
- `GET /api/rag/stats` - Get statistics for the enhanced RAG system
- `POST /api/rag/admin/fine-tune` - Trigger fine-tuning for the enhanced RAG system
- `GET /api/rag/admin/models` - Get models from the model registry
- `GET /api/rag/admin/ab-tests` - Get A/B tests from the model registry

### Admin Panel

The enhanced RAG system adds a new page to the admin panel:

- **Enhanced RAG**: View system stats, model registry, and A/B tests
  - System performance metrics
  - Fine-tuning status and history
  - A/B test results and comparisons
  - Feedback analysis dashboard
  - Model registry management
  - Configuration editor

## Customization Options

### Configuration System

The RAG system uses a hierarchical configuration system that can be customized at multiple levels:

1. **Default Configuration**: Base settings in each component
2. **Global Configuration**: System-wide settings in the RAG service
3. **Query-specific Configuration**: Parameters for individual queries
4. **Vector Search Configurations**: Persistent configurations stored in the database
5. **Performance Profiles**: Pre-configured settings for different use cases

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

### Sample Configuration JSON

The enhanced RAG system can be configured through a JSON file. Here's an example configuration:

```json
{
  "model_registry_config": {
    "registry_dir": "/path/to/model-registry",
    "models_dir": "/path/to/models"
  },
  "learning_pipeline_config": {
    "min_feedback_samples": 100,
    "feedback_threshold": 0.7,
    "fine_tuning_interval_days": 7,
    "test_size": 0.2,
    "ab_test_duration_days": 3,
    "models_to_compare": 2,
    "state_dir": "/path/to/state",
    "temp_dir": "/path/to/temp"
  },
  "distributed_retrieval_config": {
    "cache_enabled": true,
    "cache_ttl_seconds": 3600,
    "batch_size": 100,
    "timeout_seconds": 10,
    "max_concurrent_requests": 5
  },
  "hierarchical_retriever_config": {
    "max_sub_queries": 3,
    "min_query_length": 15,
    "reranking_enabled": true,
    "combine_strategy": "weighted",
    "query_decomposition_model": "gpt-3.5-turbo"
  },
  "cross_modal_attention_config": {
    "visual_feature_dim": 512,
    "text_feature_dim": 768,
    "joint_feature_dim": 1024,
    "attention_heads": 8,
    "vision_model_name": "clip",
    "text_model_name": "bert"
  }
}
```

You can also use environment variables to configure the system:

```bash
# Set environment variables
export RAG_DATA_DIR="/path/to/data"
export LLM_PROVIDER="openai"
export LLM_MODEL="gpt-4"
export OPENAI_API_KEY="your-api-key"
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
    limit: int = a10
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

The RAG system uses several prompts for different aspects of the generative enhancement. These prompts can now be managed through the admin panel's prompt management system.

### Prompt Management System

The prompt management system provides a centralized way to manage all AI prompts used in the RAG system, including:

- Material-specific prompts
- Explanation prompts
- Similarity prompts
- Application prompts

For detailed information on using the prompt management system, see the [Prompt Management System documentation](./prompt-management.md).

### Prompt Locations

Prompts are stored in the database and managed through the admin panel. The original prompt templates can be found in:

- `packages/ml/python/generative_enhancer.py` - For generative enhancement prompts
- `packages/ml/python/material_specific_prompts.py` - For material-specific prompts

The system now uses `packages/ml/python/material_specific_prompts_db.py` to fetch prompts from the database.

### Prompt Structure

Each prompt has two parts:

1. **System Prompt**: Instructions for the LLM about its role and task
2. **User Prompt**: The specific query with context data

### Customizing Prompts

To customize a prompt, use the prompt management system in the admin panel:

1. Navigate to "System Prompts" in the admin sidebar
2. Find the prompt you want to customize
3. Click the Edit button
4. Make your changes
5. Click Save

You can also still modify the prompts directly in the code:

1. Edit `packages/ml/python/generative_enhancer.py`
2. Modify the relevant `_build_*_prompt` method
3. Update both system and user prompts as needed

However, using the admin panel is recommended as it allows for changes without code deployment.

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

### Performance Profiles

The system includes pre-configured performance profiles:

```python
PERFORMANCE_PROFILES = {
    "speed": {
        "retrieval": {
            "max_results": 5,
            "strategy": "vector_first",
            "reranking_enabled": False,
            "threshold": 0.7
        },
        "generation": {
            "model": "gpt-3.5-turbo",
            "detail_level": "brief"
        },
        "enable_cache": True,
        "cache_ttl": 86400  # 24 hours
    },
    "quality": {
        "retrieval": {
            "max_results": 15,
            "strategy": "hybrid",
            "reranking_enabled": True,
            "threshold": 0.6,
            "dense_weight": 0.6,
            "sparse_weight": 0.4
        },
        "generation": {
            "model": "gpt-4",
            "detail_level": "detailed"
        },
        "enable_cache": True,
        "cache_ttl": 3600  # 1 hour
    },
    "balanced": {
        "retrieval": {
            "max_results": 10,
            "strategy": "hybrid",
            "reranking_enabled": True,
            "threshold": 0.65
        },
        "generation": {
            "model": "gpt-4",
            "detail_level": "medium"
        },
        "enable_cache": True,
        "cache_ttl": 7200  # 2 hours
    }
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

If you encounter issues with the enhanced RAG system, check the following:

### Diagnostic Steps

1. **Logs**: Check the logs for the MCP server and continuous learning service:

```bash
kubectl logs deployment/mcp-server
kubectl logs deployment/continuous-learning
```

2. **Deployment Verification**: Run the verification script to check for common issues:

```bash
./verify-rag-deployment.sh
```

3. **System Performance**: Monitor system performance to identify resource issues:

```bash
./monitor-rag-performance.sh
```

4. **API Performance**: Test the API endpoints to ensure they're working correctly:

```bash
./monitor-rag-api.sh
```

5. **Configuration**: Make sure the configuration is correct and all required directories exist.

6. **Permissions**: Make sure the system has permission to access the required directories and files.

7. **Dependencies**: Make sure all required dependencies are installed.

8. **Memory**: Make sure the system has enough memory to load the models.

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

#### Pod Crashes

**Symptoms:**
- Pods are crashing or restarting frequently
- System is unstable

**Potential Causes and Solutions:**
1. **Resource limits**
   - Check if pods have enough resources (CPU/memory)
   - Increase resource limits if necessary
   - Check for memory leaks

2. **Configuration issues**
   - Ensure ConfigMap is correctly configured
   - Verify all required environment variables are set
   - Check if volume mounts are correct

To investigate pod crashes:
```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name> --previous
```

#### API Timeouts

**Symptoms:**
- API requests time out
- System is unresponsive

**Potential Causes and Solutions:**
1. **Resource issues**
   - Check if there are enough resources
   - Increase timeouts if necessary
   - Check for bottlenecks in the system

2. **Network issues**
   - Check if the network is stable
   - Verify firewall settings
   - Check if the service is accessible

### Diagnostic Utilities

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

4. **Deployment Verification**:
   ```bash
   ./verify-rag-deployment.sh
   ```

5. **Performance Monitoring**:
   ```bash
   ./monitor-rag-performance.sh
   ```

## Integration with Existing Systems

The RAG system integrates with and enhances several platform's existing capabilities:

### RAG and Visual Recognition Integration

The RAG system significantly enhances the platform's visual recognition capabilities:

1. **Context-Enriched Recognition**: After visual recognition identifies a material (like a tile, wood, or stone), the RAG system automatically retrieves related knowledge, specifications, and similar materials from your database.

2. **Multi-modal Understanding**: By connecting visual features with textual knowledge, the system provides a comprehensive understanding of materials. For example, if visual recognition identifies "white marble," the RAG system immediately provides information about its composition, durability, price range, and appropriate applications.

3. **Improved Accuracy through Knowledge**: The RAG system can improve recognition accuracy by using domain knowledge to validate and refine visual recognition results.

4. **Relationship Mapping**: Once a material is recognized, the RAG system maps it to your knowledge graph, exposing relationships with complementary materials, alternative options, and typical applications.

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

## MCP Server Integration

To integrate the enhanced RAG system with your MCP server, you can use the provided MCP RAG bridge:

```python
from packages.ml.python.mcp_rag_bridge import create_mcp_rag_bridge

# Create MCP RAG bridge
mcp_bridge = create_mcp_rag_bridge(config_path="path/to/config.json")

# Initialize MCP RAG bridge
await mcp_bridge.initialize(existing_components=existing_components)

# Handle requests
query_response = await mcp_bridge.handle_request("query", query_request)
feedback_response = await mcp_bridge.handle_request("feedback", feedback_request)
stats_response = await mcp_bridge.handle_request("stats", stats_request)
```

You can then add endpoints to your MCP server to handle these requests:

```typescript
// Add endpoints to your MCP server
app.post('/rag/enhanced-query', async (req, res) => {
  const response = await mcpBridge.handleRequest('query', req.body);
  res.json(response);
});

app.post('/rag/feedback', async (req, res) => {
  const response = await mcpBridge.handleRequest('feedback', req.body);
  res.json(response);
});

app.get('/rag/stats', async (req, res) => {
  const response = await mcpBridge.handleRequest('stats', {});
  res.json(response);
});
```

## Kubernetes Deployment

To deploy the enhanced RAG system on Kubernetes, you'll need to:

1. Create a ConfigMap for the configuration:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: enhanced-rag-config
data:
  config.json: |
    {
      "model_registry_config": {
        "registry_dir": "/data/model-registry",
        "models_dir": "/data/models"
      },
      "learning_pipeline_config": {
        "min_feedback_samples": 100,
        "feedback_threshold": 0.7,
        "fine_tuning_interval_days": 7,
        "test_size": 0.2,
        "ab_test_duration_days": 3,
        "models_to_compare": 2,
        "state_dir": "/data/state",
        "temp_dir": "/data/temp"
      },
      "distributed_retrieval_config": {
        "cache_enabled": true,
        "cache_ttl_seconds": 3600,
        "batch_size": 100,
        "timeout_seconds": 10,
        "max_concurrent_requests": 5
      }
    }
```

2. Create PersistentVolumeClaims for the data:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: model-registry-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: models-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
```

3. Update your Deployment to use the enhanced RAG system:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mcp-server
  template:
    metadata:
      labels:
        app: mcp-server
    spec:
      containers:
        - name: mcp-server
          image: your-registry/mcp-server:latest
          env:
            - name: RAG_DATA_DIR
              value: "/data"
            - name: LLM_PROVIDER
              value: "openai"
            - name: LLM_MODEL
              value: "gpt-4"
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: openai-secret
                  key: api-key
          volumeMounts:
            - name: model-registry
              mountPath: /data/model-registry
            - name: models
              mountPath: /data/models
            - name: enhanced-rag-config
              mountPath: /app/config/enhanced-rag-config.json
              subPath: config.json
      volumes:
        - name: model-registry
          persistentVolumeClaim:
            claimName: model-registry-pvc
        - name: models
          persistentVolumeClaim:
            claimName: models-pvc
        - name: enhanced-rag-config
          configMap:
            name: enhanced-rag-config
```

4. Create a separate Deployment for the continuous learning pipeline:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: continuous-learning
spec:
  replicas: 1
  selector:
    matchLabels:
      app: continuous-learning
  template:
    metadata:
      labels:
        app: continuous-learning
    spec:
      containers:
        - name: continuous-learning
          image: your-registry/continuous-learning:latest
          env:
            - name: RAG_DATA_DIR
              value: "/data"
            - name: LLM_PROVIDER
              value: "openai"
            - name: LLM_MODEL
              value: "gpt-4"
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: openai-secret
                  key: api-key
          volumeMounts:
            - name: model-registry
              mountPath: /data/model-registry
            - name: models
              mountPath: /data/models
            - name: enhanced-rag-config
              mountPath: /app/config/enhanced-rag-config.json
              subPath: config.json
      volumes:
        - name: model-registry
          persistentVolumeClaim:
            claimName: model-registry-pvc
        - name: models
          persistentVolumeClaim:
            claimName: models-pvc
        - name: enhanced-rag-config
          configMap:
            name: enhanced-rag-config
```

## CI/CD Integration

To integrate the enhanced RAG system with your CI/CD pipeline, you'll need to:

1. Add tests for the enhanced RAG system:

```yaml
# In your CI pipeline configuration
steps:
  - name: Test Enhanced RAG
    run: |
      cd packages/ml/python
      python test_integration.py --config path/to/config.json
```

2. Add a step to sync the model registry:

```yaml
# In your CI pipeline configuration
steps:
  - name: Sync Model Registry
    run: |
      # Script to sync model registry with persistent storage
      python scripts/sync_model_registry.py
```

3. Add a step to build and push the Docker images:

```yaml
# In your CI pipeline configuration
steps:
  - name: Build and Push Docker Images
    run: |
      docker build -t your-registry/mcp-server:latest -f Dockerfile.mcp-server .
      docker build -t your-registry/continuous-learning:latest -f Dockerfile.continuous-learning .
      docker push your-registry/mcp-server:latest
      docker push your-registry/continuous-learning:latest
```

## Testing

You can test the enhanced RAG system using the provided test script:

```bash
# Test the enhanced RAG system
python packages/ml/python/test_integration.py --config path/to/config.json --setup
```

This will set up the dependencies and run tests for both direct integration and MCP bridge integration.

## Implementation Checklist

Use this checklist to track the implementation of the enhanced RAG system:

### Core Implementation

- [x] Create material-specific prompts module
- [x] Create continuous learning pipeline module
- [x] Create model registry module
- [x] Create hierarchical retriever module
- [x] Create cross-modal attention module
- [x] Create distributed retrieval module
- [x] Create enhanced RAG system module
- [x] Create RAG integration module
- [x] Create MCP RAG bridge module
- [x] Create configuration module

### Integration with MCP Server

- [x] Create enhanced RAG service
- [x] Create enhanced RAG controller
- [x] Create enhanced RAG module
- [x] Create script to update app module
- [x] Create script to update MCP Dockerfile

### Admin Panel Integration

- [x] Create enhanced RAG stats component
- [x] Create model registry component
- [x] Create enhanced RAG page
- [x] Create script to update admin routes
- [x] Create script to update admin sidebar

### Continuous Learning Service

- [x] Create continuous learning service script
- [x] Create Dockerfile for continuous learning service
- [x] Create Kubernetes deployment for continuous learning service

### CI/CD Integration

- [x] Create GitHub workflow for enhanced RAG system
- [x] Create script to build and push Docker images
- [x] Create script to deploy to Kubernetes

### Documentation

- [x] Create enhanced RAG system documentation
- [x] Create enhanced RAG setup guide
- [x] Create enhanced RAG checklist

### Testing

- [ ] Test material-specific prompts
- [ ] Test continuous learning pipeline
- [ ] Test model registry
- [ ] Test hierarchical retriever
- [ ] Test cross-modal attention
- [ ] Test distributed retrieval
- [ ] Test enhanced RAG system
- [ ] Test RAG integration
- [ ] Test MCP RAG bridge
- [ ] Test admin panel integration

### Deployment

- [ ] Build and push Docker images
- [ ] Deploy to Kubernetes
- [ ] Verify deployment
- [ ] Monitor system performance

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