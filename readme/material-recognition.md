# Material Recognition System

The Material Recognition System is a core component of Kai that enables identification and matching of materials from images. This document provides a detailed overview of how this system works, its features, and implementation details.

## Features

### Multi-Strategy Recognition

The system uses multiple recognition strategies that can be used individually or in combination:

1. **Feature-Based Recognition**
   - Uses computer vision algorithms to extract distinctive visual features
   - Identifies materials based on texture, pattern, and color characteristics
   - Performs well even with partial images or different lighting conditions
   - Implementation based on enhanced SIFT/SURF feature extraction with custom descriptors

2. **Neural Network Recognition**
   - Uses deep learning models trained on material datasets
   - Excellent at category classification and general material identification
   - Leverages transfer learning from pre-trained models optimized for material recognition
   - Supports multiple model architectures (MobileNetV2, ResNet18, EfficientNet)

3. **Hybrid Approach**
   - Combines the strengths of both feature-based and neural network methods
   - Uses confidence fusion to produce more reliable results
   - Dynamically adjusts weight based on confidence levels
   - Superior performance for specialized material types

### Confidence Fusion

The confidence fusion system merges results from multiple recognition methods to improve accuracy:

#### Fusion Methods

1. **Weighted Average**
   - Combines scores using configurable weights for each method
   - Formula: `fusion_score = (w1 * score1 + w2 * score2) / (w1 + w2)`
   - Weights can be adjusted based on historical performance for specific material types

2. **Adaptive Fusion**
   - Automatically adjusts weights based on confidence of each method
   - Gives more influence to methods with higher confidence
   - Formula: `weight_i = confidence_i^alpha / sum(confidence_j^alpha)`
   - Parameter `alpha` controls the adaptivity (higher values favor higher confidence methods)

3. **Maximum Score**
   - Uses the highest confidence score from any method
   - Useful when one method is significantly more confident than others
   - Formula: `fusion_score = max(score1, score2, ...)`

4. **Product Fusion**
   - Multiplies confidence scores together
   - Particularly effective when methods are complementary
   - Formula: `fusion_score = (score1 * score2)^(1/n)`
   - Ensures that all methods must have reasonable confidence for a high fusion score

#### Implementation

The confidence fusion is implemented in the `confidence_fusion.py` module with a TypeScript interface in the ML package:

```typescript
interface FusionOptions {
  fusionMethod: 'weighted' | 'adaptive' | 'max' | 'product';
  fusionAlpha?: number;  // For adaptive fusion
  weights?: number[];    // For weighted fusion
}

interface RecognitionResult {
  matches: Array<{
    materialId: string;
    confidence: number;
    features?: Record<string, number>;
  }>;
  metadata: Record<string, any>;
}

interface ConfidenceFusionResult extends RecognitionResult {
  sourceResults: RecognitionResult[];
  fusionMethod: string;
  fusionParameters: Record<string, any>;
}
```

### Vector Similarity Search

Vector similarity search enables finding visually similar materials using embedding vectors:

#### Features

1. **Embedding Generation**
   - Creates vector representations (embeddings) of material images
   - Uses neural networks to generate high-dimensional feature vectors
   - Embeddings capture visual characteristics in a format optimized for similarity search
   - Supports multiple embedding models (ResNet, EfficientNet, CLIP)

2. **Similarity Search**
   - Fast nearest neighbor search using optimized indexes
   - FAISS library provides efficient similarity computation
   - Supports filtering by material type and other metadata
   - Configurable threshold for minimum similarity

3. **Results Enhancement**
   - Re-ranking of initial results using additional criteria
   - Consideration of material metadata for improved relevance
   - Optional hybrid scoring that combines visual and metadata similarity

#### Implementation

```typescript
interface SearchOptions {
  numResults?: number;      // Maximum number of results to return
  threshold?: number;       // Minimum similarity threshold (0-1)
  materialType?: string | string[];  // Filter by material type
  filter?: Record<string, any>;     // Additional filters
}

interface VectorSearchResult {
  results: Array<{
    materialId: string;
    similarity: number;
    material: MaterialDocument;
  }>;
  query: {
    vector: number[];
    filters: Record<string, any>;
  };
  timingMs: number;
}
```

### Results Visualization

The system includes visualization capabilities to help users understand and validate recognition results:

1. **Side-by-Side Comparison**
   - Displays query image alongside top matches
   - Highlights key feature matches between images
   - Provides zoom and pan functionality for detailed inspection

2. **Confidence Visualization**
   - Color-coded confidence indicators
   - Graphical representation of confidence scores
   - Comparison of confidence across different methods

3. **Similarity Explanation**
   - Highlights regions contributing to the match
   - Explains which features were most important for the match
   - Shows similar material properties from the knowledge base

## Technical Implementation

### Recognition Pipeline

The material recognition pipeline consists of several stages:

1. **Image Preprocessing**
   - Resizing and normalization
   - Background removal (optional)
   - Color correction
   - Enhancement for feature extraction

2. **Feature Extraction**
   - Feature-based descriptors generation
   - Neural network embedding creation
   - Color histogram analysis
   - Texture pattern extraction

3. **Matching**
   - Database lookup of similar feature vectors
   - Neural network classification
   - Hybrid matching combining multiple methods
   - Filtering and threshold application

4. **Post-processing**
   - Results fusion from multiple methods
   - Confidence calculation
   - Metadata enrichment from knowledge base
   - Results formatting and sorting

### Model Training

The recognition models are trained on a diverse dataset of material images:

1. **Training Dataset Organization**
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

2. **Training Process**
   - Data augmentation (rotation, scaling, color shifts)
   - Transfer learning from pre-trained models
   - Fine-tuning on material-specific datasets
   - Hyperparameter optimization
   - Validation on test dataset

3. **Performance Metrics**
   - Top-1 and Top-5 accuracy
   - Precision and recall
   - Confusion matrix
   - Mean Average Precision (mAP)
   - Inference time

### Integration with Knowledge Base

The recognition system is tightly integrated with the knowledge base:

1. **Material Lookup**
   - Recognition results include full material information
   - Enrichment with specifications from knowledge base
   - Relationship data for similar or complementary materials

2. **Feedback Loop**
   - User feedback on recognition results improves system over time
   - Incorrect matches are analyzed to improve training
   - Confidence scoring is adjusted based on feedback

3. **Continuous Improvement**
   - New materials added to the knowledge base are incorporated into training
   - Recognition models are periodically retrained with enhanced datasets
   - Feature extractors are fine-tuned based on performance analysis

## API Usage

### Basic Recognition

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

### Vector Search

```typescript
import { createVectorSearchIndex, searchSimilarMaterials } from '@kai/ml';

async function setupAndSearch() {
  try {
    // Create search index (one-time setup)
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

### Results Visualization

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

## Performance Considerations

1. **Inference Optimization**
   - Batch processing for multiple images
   - GPU acceleration for neural network inference
   - Caching of intermediate results
   - Model quantization for faster processing

2. **Scaling Considerations**
   - Horizontal scaling for high-volume processing
   - Prioritization queue for real-time vs. batch recognition
   - Result caching for frequently requested images
   - Auto-scaling based on load

3. **Resource Requirements**
   - Memory: 4GB+ for optimal performance
   - GPU: Recommended for production deployment
   - Storage: ~500MB for models and feature descriptors
   - CPU: 4+ cores recommended for parallel processing