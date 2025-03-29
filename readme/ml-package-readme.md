# Kai Material Recognition ML Package

This package provides machine learning functionality for the Kai Material Recognition system. It includes tools for PDF processing, material recognition, vector embedding generation, and model training.

## Features

- **PDF Processing**: Extract images and text from PDF catalogs
- **Material Recognition**: Identify materials in images using a hybrid approach
- **Vector Embeddings**: Generate vector representations of materials for similarity search
- **Model Training**: Train and evaluate material recognition models

## Installation

> **Note**: Installation instructions for the ML package have been moved to the [Deployment Guide](./deployment-guide.md#ml-package-installation).

## Dataset Organization

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

## Usage

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

### Vector Search

The ML package supports two vector search implementations:

#### 1. Local Vector Search (FAISS)

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

#### 2. Supabase Vector Integration

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

## Supabase Vector Integration

The ML package integrates with Supabase Vector to provide advanced vector embedding storage and similarity search capabilities across multiple application domains:

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

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details