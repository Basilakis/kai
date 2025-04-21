# Kai ML Package Documentation

This comprehensive guide covers all aspects of the Machine Learning (ML) components in the Kai platform, including the ML Package, Model Context Protocol (MCP) Server, OCR enhancements, and Training API.

## Table of Contents

- [Overview](#overview)
- [ML Package](#ml-package)
- [Model Context Protocol (MCP) Server](#model-context-protocol-mcp-server)
- [OCR Enhancements](#ocr-enhancements)
- [Training API Improvements](#training-api-improvements)
- [Vector Database Integration](#vector-database-integration)
- [Deployment and Installation](#deployment-and-installation)
- [Usage Examples](#usage-examples)
- [API Reference](#api-reference)
- [Performance Considerations](#performance-considerations)
- [Troubleshooting](#troubleshooting)

## Overview

The Kai ML system provides sophisticated machine learning capabilities for material recognition, document processing, vector embeddings, and model training. Its key components include:

- **ML Package**: Core ML functionality for PDF processing, material recognition, and vector embeddings
- **Model Context Protocol (MCP) Server**: Centralized model management and inference service
- **OCR Enhancements**: Specialized text extraction for material datasheets and technical documents
- **Training API**: Advanced capabilities for model training and optimization

## ML Package

The ML Package provides machine learning functionality for the Kai Material Recognition system.

### Features

- **PDF Processing**: Extract images and text from PDF catalogs
- **Material Recognition**: Identify materials in images using a hybrid approach
- **Vector Embeddings**: Generate vector representations of materials for similarity search
- **Model Training**: Train and evaluate material recognition models

### Dataset Organization

For training the material recognition models, you need to organize your dataset in a specific structure:

```
dataset/
  ├── tile/
  │   ├── image1.jpg
  │   ├── image2.jpg
  │   └── ...
  ├── stone/
  │   ├── image1.jpg
  │   ├── image2.jpg
  │   └── ...
  ├── wood/
  │   ├── image1.jpg
  │   ├── image2.jpg
  │   └── ...
  └── ...
```

Each material type should have its own directory containing images of that material. The directory name will be used as the material ID in the recognition results.

## Model Context Protocol (MCP) Server

The Model Context Protocol (MCP) Server is a centralized service that manages machine learning models, their contexts, and provides optimized inference capabilities for the Kai system.

### What is the MCP Server?

The MCP Server is a dedicated Python service that:

1. **Centralizes Model Management**: Loads and caches ML models in memory for faster inference
2. **Standardizes API Access**: Provides a consistent interface regardless of underlying model framework
3. **Optimizes Performance**: Implements batching, caching, and other optimizations for ML inference
4. **Supports Agent Integration**: Includes APIs designed for interaction with AI agents
5. **Implements the Model Context Protocol**: Follows standardized protocols for model context handling

### Why use an MCP Server?

- **Improved Performance**: Models stay loaded in memory, eliminating load time between requests
- **Resource Efficiency**: Multiple services can use the same model instances
- **Simplified Model Updates**: Models can be updated without restarting the main application
- **Framework Abstraction**: Hides the complexity of different ML frameworks (TensorFlow, PyTorch)
- **Future Agent Integration**: Designed to work seamlessly with AI agents

### Architecture

The MCP implementation uses a hybrid approach with two main components:

#### Python Server (Backend)

The Python-based MCP Server handles the heavy lifting:

- Written in Python using FastAPI
- Loads models directly using TensorFlow/PyTorch/OpenCV
- Manages model contexts and caching
- Exposes REST API endpoints
- Includes agent communication channels
- Designed for Docker deployment

#### TypeScript Client (Frontend)

The TypeScript client SDK integrates with the Node.js application:

- Written in TypeScript
- Provides type-safe interfaces for the MCP Server
- Handles automatic fallback to existing implementation
- Includes connection health monitoring
- Proxies requests to the MCP Server

#### Communication Flow

```
┌────────────────┐     ┌─────────────────┐     ┌────────────────┐
│                │     │                 │     │                │
│  TypeScript    │─────▶ TypeScript MCP  │─────▶ Python MCP     │
│  Application   │◀─────  Client SDK     │◀─────  Server        │
│                │     │                 │     │                │
└────────────────┘     └─────────────────┘     └────────────────┘
                                                       │
                                                       ▼
                                               ┌────────────────┐
                                               │                │
                                               │ ML Models      │
                                               │ (TF/PyTorch)   │
                                               │                │
                                               └────────────────┘
```

### API Endpoints

The MCP Server exposes the following REST API endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Get server information |
| `/health` | GET | Health check endpoint |
| `/api/v1/models` | GET | List available models |
| `/api/v1/models/{model_id}` | GET | Get model information |
| `/api/v1/models/{model_id}/context` | GET | Get model context |
| `/api/v1/models/{model_id}/context` | PUT | Update model context |
| `/api/v1/recognize` | POST | Recognize materials in an image |
| `/api/v1/agent/message` | POST | Send a message to the agent |
| `/api/v1/agent/messages` | GET | Get messages from the agent queue |

### TypeScript Client SDK

The client SDK provides a simple interface for interacting with the MCP Server:

```typescript
import { MCPClient } from '@kai/mcp-client';

// Create client instance
const client = new MCPClient('http://localhost:8000');

// Recognize materials in an image
const result = await client.recognizeMaterial('/path/to/image.jpg', {
  modelType: 'hybrid',
  confidenceThreshold: 0.7,
  maxResults: 5,
  includeFeatures: true
});

// Get available models
const models = await client.listModels();

// Send a message to the agent
await client.sendAgentMessage({
  message_type: 'recognition_completed',
  content: { materialId: 'tile-123', confidence: 0.95 }
});
```

### Agent Integration

The MCP Server is designed to work with AI agents by providing:

1. **Message Queue**: A pub/sub system for agent communication
2. **Context Management**: Storage and retrieval of contextual information
3. **Standardized Protocols**: Following the Model Context Protocol for consistent interactions

#### Sending Messages to Agent

```typescript
// TypeScript
await mcpClient.sendAgentMessage({
  message_type: 'recognition_event',
  content: { materials: ['ceramic-tile', 'porcelain-tile'] }
});
```

```python
# Python
await agent_queue.put({
  "type": "recognition_event",
  "content": {"materials": ["ceramic-tile", "porcelain-tile"]},
  "timestamp": time.time()
})
```

#### Receiving Messages from Agent

```typescript
// TypeScript
const messages = await mcpClient.getAgentMessages(1.0);
for (const message of messages.messages) {
  // Process message
  console.log(`Agent message: ${message.type}`);
}
```

### Performance Optimization

The MCP Server implements several performance optimizations:

1. **Model Caching**: Models are loaded once and kept in memory
2. **Batch Processing**: Requests can be batched for more efficient processing
3. **Async Processing**: Non-blocking I/O for higher throughput
4. **Resource Monitoring**: Monitoring of memory and CPU usage

## OCR Enhancements

The OCR Enhancements system provides specialized text extraction capabilities for material datasheets and technical documents.

### Key Enhancements

#### 1. Specialized OCR for Material Datasheets

We've implemented custom OCR models and preprocessing techniques specifically optimized for technical specifications in material datasheets.

**Key Features:**
- Domain-specific dictionaries for materials (tile, stone, wood, etc.)
- Region-specific OCR optimization for different parts of datasheets
- Enhanced recognition of technical symbols, measurements, and specification formats
- Fine-tuned recognition for product codes, SKUs, and material identifiers

**Implementation:** `specialized_ocr.py`

#### 2. Multi-Language Support

Extended language capabilities now support technical documents in multiple languages beyond English.

**Key Features:**
- Support for 20+ languages including French, German, Spanish, Italian, Chinese, Japanese
- Automatic language detection in mixed-language documents
- Language-specific post-processing rules for technical terms
- Multi-language dictionary support for domain-specific terminology

**Implementation:** Integrated within `specialized_ocr.py`

#### 3. Layout Analysis Improvements

Advanced document structure analysis to better handle complex layouts common in material datasheets.

**Key Features:**
- Table detection and extraction with cell-level content recognition
- Multi-column layout detection and processing
- Diagram and chart identification with text extraction
- Structural separation of headings, specifications, and descriptive content

**Implementation:** `layout_analysis.py`

#### 4. Handwriting Recognition

New capabilities to detect and recognize handwritten annotations commonly found on technical documents.

**Key Features:**
- Detection of handwritten regions on printed documents
- Specialized preprocessing for handwritten text
- Integration with printed text extraction workflow
- Confidence scoring for handwritten content

**Implementation:** `handwriting_recognition.py`

#### 5. PDF Form Field Extraction

Automatic identification and extraction of data from structured forms in PDF documents.

**Key Features:**
- Detection of form fields (text fields, checkboxes, radio buttons)
- Label-to-value mapping for form fields
- Structured data extraction from form-based documents
- Support for flattened forms where original field structure is not preserved

**Implementation:** `form_field_extraction.py`

#### 6. OCR Confidence Scoring

Reliability metrics for extracted text to help identify potential errors and uncertain extractions.

**Key Features:**
- Multi-factor confidence evaluation (character, word, context-based)
- Domain-specific confidence boosting for known terms
- Identification of low-confidence regions requiring manual review
- Aggregate confidence metrics for entire documents and sections

**Implementation:** `ocr_confidence_scoring.py`

#### 7. Post-Processing Rules Engine

Domain-specific correction rules to improve OCR accuracy for technical content.

**Key Features:**
- Technical unit standardization (mm, cm, inches, etc.)
- Specification format normalization
- Automatic correction of common OCR errors in technical terms
- Context-aware text verification and correction

**Implementation:** Integrated within `ocr_confidence_scoring.py`

#### 8. SVBRDF Material Property Extraction

Advanced material appearance property extraction from single images using Spatially Varying Bidirectional Reflectance Distribution Functions (SVBRDFs).

**Key Features:**
- Diffuse color map extraction (albedo)
- Surface normal map generation (microfacet orientation)
- Roughness map extraction (surface microsurface detail)
- Specular reflection and metallic property analysis
- TensorFlow 2.x compatibility with legacy SVBRDF models

**Implementation:** `svbrdf_capture_engine.py` and `material_svbrdf_processor.py`

### System Architecture

The enhanced OCR system integrates with the existing PDF processing pipeline while introducing new specialized components:

```
┌─────────────────────┐
│     PDF Document    │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  PDF Image Extraction│
│  (pdf_extractor.py)  │
└──────────┬──────────┘
           │
┌──────────▼──────────┐    ┌───────────────────────┐
│  Layout Analysis     │◄───┤  Document Structure   │
│ (layout_analysis.py) │    │   Classification      │
└──────────┬──────────┘    └───────────────────────┘
           │
┌──────────▼──────────┐    ┌───────────────────────┐
│  Region Classification│◄──┤   Form Field Detection │
│                      │    │(form_field_extraction)│
└──────────┬──────────┘    └───────────────────────┘
           │
┌──────────▼──────────┐    ┌───────────────────────┐
│  Specialized OCR     │◄───┤   Language Detection  │
│ (specialized_ocr.py) │    │                       │
└──────────┬──────────┘    └───────────────────────┘
           │
┌──────────▼──────────┐    ┌───────────────────────┐
│ Handwriting Detection│◄───┤  Handwriting OCR      │
│(handwriting_recog.py)│    │                       │
└──────────┬──────────┘    └───────────────────────┘
           │
┌──────────▼──────────┐    ┌───────────────────────┐
│   Confidence Scoring │◄───┤  Post-Processing Rules│
│(ocr_confidence_scor.)│    │                       │
└──────────┬──────────┘    └───────────────────────┘
           │
┌──────────▼──────────┐
│  Structured Output   │
│                      │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   Integration with   │
│   Material System    │
└─────────────────────┘
```

### Performance Considerations

The enhanced OCR system introduces additional processing steps that may affect performance:

1. **Processing Time**: Full enhancement pipeline may increase processing time by 2-3x compared to basic OCR.

2. **Memory Usage**: Complex documents with multiple pages may require 1-2GB of memory during processing.

3. **SVBRDF Processing Requirements**:
   - GPU acceleration strongly recommended for SVBRDF property extraction
   - Typical processing time: 2-5 seconds per image on GPU, 30-45 seconds on CPU
   - Memory requirements: ~2GB for 512x512 resolution maps

4. **Optimization Opportunities**:
   - Parallel processing of different pages
   - Selective application of enhancements based on document type
   - GPU acceleration for handwriting recognition and layout analysis
   - Caching of intermediate results for frequently processed document templates

### Usage Examples

#### Basic Usage through Server API

The OCR enhancements can be accessed through the existing PDF processing API routes:

```typescript
// Example integration in pdf.routes.ts
router.post('/enhanced-ocr', async (req, res) => {
  const { filePath, options } = req.body;
  
  try {
    const result = await pdfProcessor.processWithEnhancedOCR(filePath, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### Programmatic Usage

```python
from packages.ml.python.enhanced_ocr import EnhancedOCRProcessor

# Initialize the processor with options
processor = EnhancedOCRProcessor(
    languages=['eng', 'deu'],
    material_type='tile',
    enable_handwriting_detection=True,
    enable_form_extraction=True
)

# Process a document
results = processor.process_document('path/to/document.pdf')

# Access structured data
specifications = results.get_specifications()
tables = results.get_tables()
form_data = results.get_form_fields()
```

#### SVBRDF Material Properties Extraction

```typescript
// Using the SVBRDF MCP adapter
import { svbrdfMcpAdapter } from '@kai/agents/services/adapters/svbrdfMcpAdapter';

// Extract SVBRDF properties from an image
const svbrdfProperties = await svbrdfMcpAdapter.extractSVBRDFProperties({
  imagePath: 'path/to/material/image.jpg',
  resolution: 512, // Output resolution for property maps
  enhanceDetail: true, // Optional enhancement for detail
});

// Access the extracted properties
const { diffuseMap, normalMap, roughnessMap, metallicMap } = svbrdfProperties;

// Apply SVBRDF properties to a material in the database
await svbrdfMcpAdapter.applySVBRDFToMaterial({
  materialId: 'material-123',
  svbrdfProperties,
  metadata: {
    extractionMethod: 'neural-capture',
    confidenceScore: 0.92
  }
});
```

### Dependencies and Requirements

The OCR enhancements rely on several key libraries:

- Tesseract OCR 4.1+ with language packs
- OpenCV for image processing
- PyMuPDF for PDF manipulation
- TensorFlow for handwriting recognition
- Various NLP libraries for text processing
- TensorFlow 2.x with compatibility mode for SVBRDF models

See `requirements-ocr.txt` for a complete list of dependencies.

## Training API Improvements

The Training API provides enhanced capabilities for training Material Recognition models.

### Overview of Improvements

The following improvements have been implemented:

1. **Transfer Learning Capabilities**: Fine-tune existing models with small datasets
2. **Automated Hyperparameter Optimization**: Implement techniques like grid search, random search, and Bayesian optimization
3. **Distributed Training with Supabase**: Replace Redis with Supabase for scaling training jobs
4. **Training Progress Visualization**: Enhanced progress reporting with real-time charts and metrics
5. **Active Learning Integration**: Prioritize samples for manual labeling based on model uncertainty
6. **Automated Model Retraining Triggers**: Automatically retrain when data changes significantly
7. **Vector Database Integration**: Store and retrieve embeddings for efficient similarity search

### Model Storage and Management

Our training system handles models in a sophisticated way:

1. **Base Pre-trained Models**: 
   - Loaded dynamically from ML framework libraries (TensorFlow, PyTorch)
   - Not stored directly in our application repository for efficiency
   - Frameworks automatically download and cache weights as needed

2. **Fine-tuned Models**:
   - Trained models are saved with metadata in the specified output directory
   - Models are versioned and can be retrieved for inference or further training
   - Training results and configurations are persisted alongside the model

3. **Model Storage Location**:
   ```
   /models/
     ├── {model_id}/
     │   ├── model.h5 (or .pt for PyTorch)
     │   ├── metadata.json
     │   ├── training_history.json
     │   └── hyperparameters.json
   ```

This approach provides an optimal balance between leveraging existing pre-trained architectures and maintaining our own specialized fine-tuned versions.

### Architecture

The improved training API consists of several interconnected modules:

- **Transfer Learning Module** (`transfer_learning.py`): Enables fine-tuning of pre-trained models
- **Hyperparameter Optimization Module** (`hyperparameter_optimization.py`): Automatically finds optimal model parameters
- **Distributed Training Module** (`distributed_training.py`): Coordinates distributed training using Supabase
- **Training Visualization Module** (`training_visualization.py`): Provides enhanced visualizations of training metrics
- **Active Learning Module** (`active_learning.py`): Implements uncertainty-based sample selection for labeling
- **Unified Training API** (`training_api.py`): Integrates all improvements into a cohesive system
- **Model Storage Manager** (`model_storage.py`): Handles model persistence and retrieval
- **Vector Database Connector** (`vector_db_connector.py`): Manages embedding storage and retrieval

### Features

#### Transfer Learning

The transfer learning module allows you to leverage pre-trained models and fine-tune them with smaller datasets. This approach dramatically reduces training time and improves performance when training data is limited.

Features:
- Support for TensorFlow and PyTorch frameworks
- Customizable fine-tuning strategies
- Layer freezing options to control what gets retrained
- Data augmentation techniques for small datasets
- Automatic saving of fine-tuned models for later use

#### Hyperparameter Optimization

The hyperparameter optimization module automates the process of finding optimal model parameters, eliminating manual trial and error.

Supported optimization strategies:
- Grid Search: Exhaustively searches through a specified parameter grid
- Random Search: Randomly samples from parameter distributions
- Bayesian Optimization: Uses probabilistic models to guide the search process

Each strategy uses sparse categorical cross-entropy loss for classification tasks and applies early stopping with validation loss monitoring.

#### Distributed Training with Supabase

The distributed training module replaces Redis with Supabase for coordination and parameter sharing, providing:

- Scalable job queue management
- Worker coordination
- Parameter sharing across nodes
- Progress tracking and monitoring
- Fault tolerance and job recovery
- Real-time parameter updates during training

#### Training Progress Visualization

The visualization module enhances progress reporting with detailed charts and metrics:

- Real-time training metrics visualization
- Learning curve analysis
- Confusion matrix visualization
- Model performance comparisons
- Exportable reports in various formats (HTML, JSON, PNG)

#### Active Learning

The active learning module helps prioritize samples for manual labeling:

- Uncertainty-based sample selection
- Diversity sampling strategies
- Batch labeling workflow
- Integration with the feedback system

#### Automated Retraining Triggers

The system can automatically trigger model retraining based on various conditions:

- Feedback count threshold
- Time-based triggers
- Uncertainty threshold triggers
- Distribution shift detection

### Usage

#### Unified API

The unified training API provides a simple interface to access all improvements:

```python
from training_api import EnhancedTrainingAPI, train_with_all_improvements

# Quick start with all improvements
result = train_with_all_improvements(
    dataset_path="path/to/dataset",
    model_type="hybrid",
    use_transfer_learning=True,
    optimize_hyperparams=True,
    distributed=True,
    num_workers=4
)

# Or use the full API for more control
api = EnhancedTrainingAPI(
    base_dir="./training",
    supabase_url="your_supabase_url",
    supabase_key="your_supabase_key",
    use_distributed=True,
    enable_transfer_learning=True,
    enable_hyperparameter_optimization=True,
    enable_active_learning=True,
    visualization_level="detailed",
    num_workers=4
)

# Train a model
training_result = api.train_model(
    dataset_path="path/to/dataset",
    model_type="hybrid",
    pretrained_model_path="path/to/pretrained/model",
    optimize_hyperparams=True
)

# Get samples for labeling
labeling_batch = api.get_samples_for_labeling(count=10)

# Record feedback
feedback_result = api.record_labeling_feedback(
    sample_id="sample_123",
    correct_material_id="material_456",
    batch_id="batch_789"
)

# Retrain from feedback
retrain_result = api.retrain_from_feedback(
    model_type="hybrid",
    feedback_threshold=10
)
```

#### Command Line Interface

You can also use the command line interface:

```bash
# Train a model with all improvements
python training_api.py train \
    --dataset path/to/dataset \
    --model-type hybrid \
    --use-distributed \
    --optimize-hyperparams \
    --use-transfer-learning \
    --num-workers 4

# Active learning operations
python training_api.py active-learning \
    --operation select \
    --data-dir ./data \
    --model-dir ./models \
    --count 10

# Start retraining monitor
python training_api.py monitor \
    --data-dir ./data \
    --model-dir ./models \
    --check-interval 3600

# Distributed training operations
python training_api.py distributed \
    --operation start-workers \
    --data-dir ./data \
    --model-dir ./models \
    --num-workers 4
```

### Integration with Supabase

The Supabase integration replaces Redis for various distributed functions:

1. **Job Queue Management**: Training jobs are stored in Supabase tables
2. **Parameter Sharing**: Model parameters are stored and retrieved from Supabase
3. **Progress Tracking**: Training progress is recorded in Supabase for real-time monitoring
4. **Active Learning Storage**: Samples, batches, and triggers are stored in Supabase

Required Supabase Tables:
- `training_jobs`: Stores training job information
- `training_parameters`: Stores model parameters
- `training_progress`: Stores training progress updates
- `active_learning_candidates`: Stores sample candidates for labeling
- `active_learning_batches`: Stores labeling batches
- `retraining_triggers`: Stores retraining triggers

### Knowledge Base Integration

Our knowledge base is tightly coupled with the ML training system:

1. **Material Metadata Source**:
   - Provides rich context for training data
   - Supplies detailed material specifications and categorization
   - Enables better model training through contextual understanding

2. **Training Enhancement**:
   - Material relationships inform data augmentation strategies
   - Category structures guide model architecture decisions
   - Historical usage patterns influence sample weighting

3. **Feedback Loop**:
   - Recognition results are recorded in the knowledge base
   - User feedback on predictions enrich the training data
   - Automated retraining triggers based on feedback patterns

This bidirectional integration creates a continuously improving system where ML models and knowledge base mutually enhance each other.

## Vector Database Integration

The ML package integrates with vector databases to provide advanced vector embedding storage and similarity search capabilities.

### Core Vector Functionality

The ML package leverages Supabase Vector (using PostgreSQL's pgvector extension) for:

1. **Vector Embedding Storage**
   - Storing feature vectors generated from material images
   - Associating embeddings with material metadata
   - Efficient vector operations via pgvector
   - Automatic vector indexing for high-performance searches

2. **Similarity Search**
   - Semantic similarity between material vectors
   - Filtering by material type, properties, or metadata
   - Configurable similarity thresholds and result limits
   - High-performance vector operations via optimized indices

3. **Database Implementation**
   - Dedicated vector tables in Supabase PostgreSQL
   - Vector columns with appropriate dimensionality
   - Optimized indices using HNSW or IVF-Flat
   - Metadata columns for rich material information

### Local Vector Search (FAISS)

Create a local vector search index and search for similar materials:

```typescript
import { createVectorSearchIndex, searchSimilarMaterials } from '@kai/ml';

async function setupAndSearch() {
  try {
    // Create search index
    await createVectorSearchIndex('path/to/embeddings', 'models/search_index.faiss');
    
    // Search for similar materials
    const result = await searchSimilarMaterials('models/search_index.faiss', 'path/to/query.jpg', {
      numResults: 5,
      threshold: 0.7
    });
    
    console.log('Similar materials:');
    result.results.forEach(match => {
      console.log(`- ${match.materialId} (similarity: ${match.similarity.toFixed(2)})`);
    });
  } catch (error) {
    console.error('Vector search failed:', error);
  }
}
```

### Supabase Vector Integration

Store and search vector embeddings using Supabase Vector:

```typescript
import { storeEmbeddingInSupabase, searchSimilarInSupabase } from '@kai/ml';

async function supabaseVectorSearch() {
  try {
    // Generate and store embedding for a material
    const embeddingId = await storeEmbeddingInSupabase('path/to/image.jpg', {
      materialId: 'marble-001',
      materialName: 'Carrara Marble',
      materialType: 'marble',
      metadata: { 
        color: 'white',
        finish: 'polished'
      }
    });
    
    console.log(`Stored embedding with ID: ${embeddingId}`);
    
    // Search for similar materials with Supabase Vector
    const similarMaterials = await searchSimilarInSupabase('path/to/query.jpg', {
      threshold: 0.7,
      limit: 5,
      materialType: 'marble' // Optional filter
    });
    
    console.log('Similar materials:');
    similarMaterials.forEach(match => {
      console.log(`- ${match.materialName} (similarity: ${match.similarity.toFixed(2)})`);
    });
  } catch (error) {
    console.error('Supabase vector operations failed:', error);
  }
}
```

### Integration with Application Domains

This ML package provides the vector foundations for:

1. **Material Recognition**
   - Visual feature vectors for material classification
   - Similarity-based material identification
   - Flexible confidence thresholds
   - Multiple recognition strategy support

2. **Query Understanding**
   - Natural language query embedding
   - Semantic search enhancement
   - Query expansion based on vector similarity
   - Domain-specific context integration

3. **Recommendation Engine**
   - User preference vector modeling
   - Similarity-based recommendation generation
   - Diversity control in recommendations
   - Feedback loop for preference adaption

4. **Document Processing**
   - Text chunk vectorization
   - Semantic document search
   - Entity extraction and linking
   - Cross-document relationship discovery

## Deployment and Installation

> **Note**: Installation instructions for the ML components have been moved to the [Deployment Guide](./deployment-guide.md).

The Deployment Guide includes detailed instructions for:

- ML Package installation
- MCP Server deployment
- OCR dependencies setup
- Vector database configuration
- Training system deployment

## Usage Examples

### PDF Processing

Extract images and text from a PDF catalog:

```typescript
import { extractFromPDF } from '@kai/ml';

async function processPDF() {
  try {
    const result = await extractFromPDF('path/to/catalog.pdf', 'output/directory');
    console.log(`Extracted ${result.images.length} images and ${result.text.length} text blocks`);
  } catch (error) {
    console.error('PDF extraction failed:', error);
  }
}
```

### Material Recognition

Recognize materials in an image:

```typescript
import { recognizeMaterial } from '@kai/ml';

async function identifyMaterial() {
  try {
    const result = await recognizeMaterial('path/to/image.jpg', {
      modelType: 'hybrid', // 'hybrid', 'feature-based', or 'ml-based'
      confidenceThreshold: 0.6,
      maxResults: 5
    });
    
    console.log('Recognized materials:');
    result.matches.forEach(match => {
      console.log(`- ${match.materialId} (confidence: ${match.confidence.toFixed(2)})`);
    });
  } catch (error) {
    console.error('Material recognition failed:', error);
  }
}
```

### Enhanced Recognition with Confidence Fusion

Use the enhanced recognition with confidence fusion for better results:

```typescript
import { recognizeMaterialEnhanced } from '@kai/ml';

async function identifyMaterialEnhanced() {
  try {
    const result = await recognizeMaterialEnhanced('path/to/image.jpg', {
      useFusion: true,
      fusionMethod: 'adaptive', // 'weighted', 'adaptive', 'max', or 'product'
      fusionAlpha: 0.5,
      confidenceThreshold: 0.6,
      maxResults: 5
    });
    
    console.log('Recognized materials:');
    result.matches.forEach(match => {
      console.log(`- ${match.materialId} (confidence: ${match.confidence.toFixed(2)})`);
    });
  } catch (error) {
    console.error('Material recognition failed:', error);
  }
}
```

### Feature Descriptor Generation

Generate feature descriptors from a dataset of material images:

```typescript
import { generateFeatureDescriptors } from '@kai/ml';

async function generateDescriptors() {
  try {
    const result = await generateFeatureDescriptors('path/to/dataset', 'models/feature_descriptors.npz');
    console.log(`Generated descriptors for ${result.material_count} materials with ${result.total_descriptors} total descriptors`);
  } catch (error) {
    console.error('Feature descriptor generation failed:', error);
  }
}
```

### Neural Network Training

Train a neural network model for material recognition:

```typescript
import { trainNeuralNetwork } from '@kai/ml';

async function trainModel() {
  try {
    const result = await trainNeuralNetwork('path/to/dataset', 'models/neural_network', {
      framework: 'tensorflow', // 'tensorflow' or 'pytorch'
      model: 'mobilenetv2', // 'mobilenetv2', 'resnet18', 'efficientnet'
      epochs: 10,
      batchSize: 32,
      imgSize: 224,
      learningRate: 0.001
    });
    
    console.log(`Model trained with ${result.num_classes} classes`);
    console.log(`Final accuracy: ${result.final_accuracy.toFixed(4)}`);
    console.log(`Final validation accuracy: ${result.final_val_accuracy.toFixed(4)}`);
  } catch (error) {
    console.error('Neural network training failed:', error);
  }
}
```

### Visualize Search Results

Visualize the search results with side-by-side comparison:

```typescript
import { visualizeSearchResults } from '@kai/ml';

async function visualizeResults() {
  try {
    const outputPath = await visualizeSearchResults(
      'models/search_index.faiss',
      'path/to/query.jpg',
      'output/visualization.jpg',
      5 // Number of results to visualize
    );
    
    console.log(`Visualization saved to ${outputPath}`);
  } catch (error) {
    console.error('Visualization failed:', error);
  }
}
```

## API Reference

### PDF Processing

- `extractFromPDF(pdfPath: string, outputDir: string): Promise<PDFExtractionResult>`

### Material Recognition

- `recognizeMaterial(imagePath: string, options?: RecognitionOptions): Promise<RecognitionResult>`
- `recognizeMaterialEnhanced(imagePath: string, options?: EnhancedRecognitionOptions): Promise<RecognitionResult | ConfidenceFusionResult>`

### Feature Descriptors

- `generateFeatureDescriptors(datasetDir: string, outputFile: string): Promise<FeatureDescriptorResult>`

### Neural Network Training

- `trainNeuralNetwork(datasetDir: string, outputDir: string, options?: TrainingOptions): Promise<NeuralNetworkTrainingResult>`

### Vector Search

- `createVectorSearchIndex(embeddingsDir: string, indexPath: string): Promise<IndexCreationResult>`
- `searchSimilarMaterials(indexPath: string, imagePath: string, options?: SearchOptions): Promise<VectorSearchResult>`
- `visualizeSearchResults(indexPath: string, imagePath: string, outputPath: string, numResults?: number): Promise<string>`

### Supabase Vector Operations

- `storeEmbeddingInSupabase(imagePath: string, metadata: MaterialMetadata): Promise<string>`
- `searchSimilarInSupabase(imagePath: string, options?: SupabaseSearchOptions): Promise<SupabaseSearchResult[]>`
- `createVectorIndex(tableName: string, columnName: string, indexMethod?: 'hnsw' | 'ivfflat', dimensions?: number): Promise<boolean>`
- `generateAndStoreEmbedding(material: Material): Promise<string>`

### Confidence Fusion

- `fuseConfidenceScores(featureResults: RecognitionResult, mlResults: RecognitionResult, options?: FusionOptions): Promise<ConfidenceFusionResult>`

### MCP Client

- `MCPClient(url: string, options?: MCPClientOptions)`
- `recognizeMaterial(imagePath: string, options?: RecognitionOptions): Promise<RecognitionResult>`
- `listModels(): Promise<ModelList>`
- `getModelInfo(modelId: string): Promise<ModelInfo>`
- `getModelContext(modelId: string): Promise<ModelContext>`
- `updateModelContext(modelId: string, context: ModelContext): Promise<UpdateResult>`
- `sendAgentMessage(message: AgentMessage): Promise<MessageResult>`
- `getAgentMessages(timeout?: number): Promise<MessageBatch>`

### OCR

- `EnhancedOCRProcessor(options?: OCROptions)`
- `process_document(document_path: string): OCRResult`
- `extract_tables(document_path: string): TableExtractionResult`
- `extract_form_fields(document_path: string): FormFieldExtractionResult`
- `detect_handwriting(document_path: string): HandwritingDetectionResult`
- `calculate_confidence(text: string, domain?: string): ConfidenceResult`

### Training API

- `EnhancedTrainingAPI(options?: TrainingAPIOptions)`
- `train_model(dataset_path: string, model_type: string, options?: TrainingOptions): Promise<TrainingResult>`
- `optimize_hyperparameters(dataset_path: string, model_type: string, hp_space: object): Promise<HyperparameterResult>`
- `get_samples_for_labeling(count?: number): Promise<LabelingBatch>`
- `record_labeling_feedback(sample_id: string, correct_material_id: string): Promise<FeedbackResult>`
- `check_retraining_triggers(): Promise<TriggerResult[]>`
- `retrain_from_feedback(model_type: string): Promise<RetrainingResult>`

## Performance Considerations

### General Performance

- **Memory Management**: The ML package automatically manages memory usage based on available resources and load
- **GPU Acceleration**: GPU is recommended for neural network inference and training
- **Batch Processing**: Implement batch processing for multiple materials or documents
- **Caching**: Use caching strategies for frequent operations

### MCP Server Performance

- **Hardware Requirements**:
  - CPU: 4+ cores recommended
  - RAM: 8GB+ (16GB+ for multiple models)
  - GPU: Optional but strongly recommended for neural networks
  - Disk: 20GB+ for models and temporary storage

- **Optimization Strategies**:
  - Enable model caching
  - Use GPU acceleration when available
  - Implement request batching for multiple items
  - Configure appropriate timeouts for your environment

### OCR Performance

- **Hardware Requirements**:
  - CPU: 4+ cores recommended
  - RAM: 8GB+ (16GB+ for multiple parallel processes)
  - GPU: Recommended for handwriting recognition
  - Disk: 10GB+ for temporary storage

- **Optimization Strategies**:
  - Use selective processing (only enable needed features)
  - Process multiple documents in parallel
  - Batch process pages from large documents
  - Use GPU acceleration for handwriting recognition

### Training API Performance

- **Hardware Requirements**:
  - CPU: 8+ cores recommended
  - RAM: 16GB+ (32GB+ for large datasets)
  - GPU: Strongly recommended for training
  - Disk: 100GB+ for dataset storage and models

- **Optimization Strategies**:
  - Use distributed training for large datasets
  - Implement incremental training
  - Use transfer learning to reduce training time
  - Optimize batch size based on available memory

## Troubleshooting

### Common Issues

#### MCP Server Issues

1. **Connection Errors**
   - Check if the MCP server is running
   - Verify network connectivity and firewall settings
   - Check if the port is correctly exposed

2. **Model Loading Failures**
   - Ensure model files exist in the model directory
   - Check for sufficient memory for loading models
   - Verify GPU availability if using GPU-accelerated models

3. **Slow Performance**
   - Check if GPU is being utilized (if available)
   - Monitor memory usage for potential leaks
   - Consider increasing server resources

#### OCR Issues

1. **Low Recognition Accuracy**
   - Ensure the document has sufficient resolution (300+ DPI)
   - Try specifying the correct language
   - Adjust confidence thresholds
   - Check if the document type is supported

2. **Memory Errors**
   - Process large documents in batches
   - Reduce the number of parallel processes
   - Increase available memory

3. **Slow Processing**
   - Disable unnecessary features
   - Use GPU acceleration if available
   - Process in batches or parallel
   - Check for resource contention

#### Training API Issues

1. **Out of Memory Errors**
   - Reduce batch size
   - Use progressive loading
   - Enable gradient accumulation
   - Check for memory leaks

2. **Slow Training**
   - Use GPU acceleration
   - Implement distributed training
   - Optimize data pipeline
   - Check for I/O bottlenecks

3. **Poor Model Performance**
   - Increase dataset size or augmentation
   - Use transfer learning
   - Optimize hyperparameters
   - Check for data quality issues

### Logging and Debugging

To enable detailed logging for debugging:

```bash
# Enable debug logging for MCP Server
export LOG_LEVEL=DEBUG
python packages/ml/python/mcp_server.py

# Enable debug logging for OCR
export DEBUG=1
python packages/ml/python/enhanced_ocr.py

# Enable debug logging for Training API
export TRAINING_API_LOG_LEVEL=DEBUG
python packages/ml/python/training_api.py
```

Check logs for error messages and debugging information:

```bash
# View MCP Server logs
docker logs kai-mcp-server

# View OCR process logs
tail -f /var/log/kai/ocr.log

# View Training API logs
tail -f /var/log/kai/training.log
```

### Getting Help

If you encounter issues not covered in this documentation:

1. Check the error logs for detailed information
2. Look for similar issues in the project issue tracker
3. Update to the latest version of the ML package
4. Contact the development team with detailed error information

## Future Improvements

Potential areas for further enhancement:

1. **3D Technical Drawing Recognition**: Extract measurements and specifications from technical drawings.

2. **Material Visual Properties Correlation**: Link extracted specifications with visual recognition results.

3. **Multi-document Cross-referencing**: Correlate information across multiple related documents.

4. **Interactive Correction Interface**: Develop a UI for reviewing and correcting low-confidence OCR results.

5. **Real-time OCR Streaming**: Process documents incrementally as they are uploaded or scanned.

6. **SVBRDF Fine-Tuning for Specific Materials**: Train specialized SVBRDF models for specific material types (ceramic, wood, metal, etc.).

7. **Distributed MCP Server Deployment**: Support for multiple MCP servers with load balancing.

8. **Model Version Control**: Advanced management of model versions and rollbacks.

9. **A/B Testing**: Support for comparing performance between model versions.

10. **Enhanced Agent Integration**: Deeper integration with future AI agent capabilities.

11. **Homogeneity Estimation**: Analysis of material homogeneity patterns.

12. **Vector Index Compression**: Reduce memory/storage requirements for vector indices.