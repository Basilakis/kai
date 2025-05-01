# Datasets and AI Model Integration

This document outlines the system's capabilities for working with datasets and AI models, including importing premade datasets and pre-trained models, and connecting them for training and inference.

## Overview

The Kai platform supports multiple ways to manage datasets and AI models:

1. **Dataset Management**
   - Upload custom datasets (ZIP archives with organized folders or CSV mapping files)
   - Generate vector embeddings from uploaded images for knowledge base and training
   - Import premade datasets from public repositories
   - Data quality assessment and enhancement
   - Dataset versioning and metadata management

2. **Model Management**
   - Upload custom trained models
   - Import pre-trained models from repositories
   - Model versioning and performance tracking
   - Transfer learning and fine-tuning capabilities

3. **Training Pipeline**
   - Connect datasets with models for training
   - Configure training parameters and techniques
   - Monitor progress with real-time metrics
   - Evaluate performance after completion

## Custom Dataset Upload

The system supports uploading custom datasets directly using ZIP files or CSV mapping files.

### ZIP Archive Upload with Vector Embedding Generation

You can upload a ZIP archive containing organized image folders, with each folder representing a dataset class. The system will:

1. Extract images from the ZIP archive
2. Organize them into dataset classes
3. Generate vector embeddings for each image
4. Store both the images and their embeddings in the database
5. Make them available for both the knowledge base and model training

![ZIP Upload Process](https://storage.googleapis.com/kai-docs-assets/zip-upload-embedding-workflow.png)

#### How to Upload a ZIP Dataset with Embeddings

1. Navigate to **Admin Panel → Datasets → Upload Dataset**
2. Select the **ZIP Upload** tab
3. Choose your ZIP file containing organized image folders
4. Enable the **Generate Vector Embeddings** option
5. Configure additional options if needed
6. Click **Upload and Process**

```javascript
// Client-side code example for uploading a ZIP dataset with embeddings
async function uploadZipDatasetWithEmbeddings(zipFile, options) {
  try {
    const formData = new FormData();
    formData.append('file', zipFile);
    formData.append('name', options.name);
    formData.append('description', options.description);
    formData.append('generateEmbeddings', 'true'); // Enable embedding generation

    const response = await fetch('/api/admin/datasets/upload/zip', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload dataset');
    }

    const result = await response.json();
    console.log(`Successfully processed ${result.imageCount} images across ${result.classCount} classes`);
    console.log(`Generated ${result.embeddingsGenerated} vector embeddings`);

    return result;
  } catch (error) {
    console.error('Error uploading ZIP dataset:', error);
    throw error;
  }
}
```

#### ZIP Dataset Structure

For best results, organize your ZIP file with the following structure:

```
dataset.zip
├── class1/
│   ├── image1.jpg
│   ├── image2.png
│   └── ...
├── class2/
│   ├── image1.jpg
│   ├── image2.png
│   └── ...
└── ...
```

Each top-level folder becomes a dataset class. Supported image formats include JPG, JPEG, PNG, WEBP, and GIF.

#### Generated Embeddings

The vector embeddings generated from your uploaded images are:

- Stored in the vector database for similarity search
- Available for both knowledge base integration and model training
- Accessible through the API for custom applications
- Used to improve material recognition accuracy

#### Vector Embedding Options

When uploading a ZIP file with embedding generation enabled, you can configure:

- **Embedding Dimension**: Control the vector size (default: 256)
- **Embedding Method**: Choose between hybrid, feature-based, or ML-based approaches
- **Quality Threshold**: Set minimum quality requirements for generated embeddings

## Premade Datasets Integration

The system provides a streamlined workflow for integrating public, premade datasets into your recognition pipeline.

![Premade Dataset Integration](https://storage.googleapis.com/kai-docs-assets/premade-dataset-workflow.png)

### Supported Dataset Repositories

The system integrates with popular dataset repositories:

| Repository | Description | Dataset Types |
|------------|-------------|---------------|
| Kaggle Datasets | Public datasets with various licensing | General, materials, textures |
| TensorFlow Datasets | Ready-to-use datasets from TensorFlow | Classification, recognition |
| Hugging Face Datasets | Public ML datasets | Classification, multi-modal |
| ImageNet | Standard computer vision dataset | Object recognition |

### Importing a Premade Dataset

To import a premade dataset:

1. Navigate to **Admin Panel → Datasets → Upload Dataset**
2. Select the **Premade Dataset** tab
3. Browse available datasets or search by name/category
4. Select the dataset and configure import options
5. Click **Import Dataset**

```javascript
// Client-side code example for importing a premade dataset
async function importPremadeDataset(datasetId, options) {
  try {
    const response = await fetch('/api/admin/datasets/import/premade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceDatasetId: datasetId,
        includeMetadata: options.includeMetadata,
        selectedClasses: options.selectedClasses,
        name: options.name,
        description: options.description
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to import dataset');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error importing premade dataset:', error);
    throw error;
  }
}
```

### Dataset Import Options

When importing a premade dataset, you can configure:

- **Dataset Name**: Custom name for the imported dataset (defaults to original name)
- **Description**: Optional description for reference
- **Include Metadata**: Import annotations, labels, and other metadata
- **Class Selection**: Choose specific classes to import (subset of the dataset)
- **Sample Limitation**: Limit the number of samples per class

### Dataset Quality Verification

After importing a premade dataset, the system automatically analyzes its quality:

```typescript
// Server-side code for dataset quality analysis
import { datasetManagementService } from '@kai/server/services/datasets/dataset-management.service';

async function verifyImportedDataset(datasetId: string) {
  // Analyze dataset quality
  const qualityMetrics = await datasetManagementService.analyzeDatasetQuality(datasetId);

  // If quality issues are detected, provide recommendations
  if (qualityMetrics.overallQualityScore < 70) {
    return {
      needsImprovement: true,
      recommendations: qualityMetrics.recommendations,
      metrics: qualityMetrics
    };
  }

  return {
    needsImprovement: false,
    metrics: qualityMetrics
  };
}
```

## AI Models Integration

The KAI platform integrates a comprehensive suite of AI models for various tasks, from material recognition to 3D visualization. This section details the models used and their specific purposes.

![Model Integration](https://storage.googleapis.com/kai-docs-assets/model-integration-flow.png)

### AI Model Registry

The platform includes a sophisticated model registry that manages model selection, performance tracking, and evaluation across different providers (OpenAI, Anthropic, HuggingFace, and local models). The system automatically selects the best model for each task based on performance metrics including accuracy, latency, and cost.

### Text and Language Models

#### OpenAI Models
- **GPT-4** (`gpt-4`)
  * **Purpose**: Primary text generation model
  * **Used for**: General text generation, complex reasoning, and high-quality responses
  * **Default for**: Text generation tasks

- **GPT-4 Turbo** (`gpt-4-turbo`)
  * **Purpose**: Faster version of GPT-4
  * **Used for**: Agent-based interactions requiring quick responses
  * **Default for**: Chat completions in agent system

- **GPT-4 Vision** (`gpt-4-vision`)
  * **Purpose**: Multimodal model that can process both text and images
  * **Used for**: Material recognition from images
  * **Default for**: Material recognition tasks

- **GPT-3.5 Turbo** (`gpt-3.5-turbo`)
  * **Purpose**: Faster, more cost-effective model for simpler tasks
  * **Used for**: Classification, summarization, and translation tasks
  * **Default for**: Classification, summarization, and translation

#### Anthropic Models
- **Claude 2** (`claude-2`)
  * **Purpose**: Alternative text generation model
  * **Used for**: Text generation, classification, summarization, and translation
  * **Default for**: Anthropic text tasks

- **Claude 3 Opus** (`claude-3-opus-20240229`)
  * **Purpose**: High-quality text generation with multimodal capabilities
  * **Used for**: 3D designer agent

#### Hugging Face Text Models
- **Google/Flan-T5-XXL** (`google/flan-t5-xxl`)
  * **Purpose**: Text generation alternative to GPT models
  * **Used for**: Text generation when OpenAI is unavailable

- **Facebook/BART-Large-MNLI** (`facebook/bart-large-mnli`)
  * **Purpose**: Zero-shot text classification
  * **Used for**: Classifying text without specific training

- **Facebook/BART-Large-CNN** (`facebook/bart-large-cnn`)
  * **Purpose**: Text summarization
  * **Used for**: Creating concise summaries of longer text

- **Facebook/MBART-Large-50-Many-to-Many-MMT** (`facebook/mbart-large-50-many-to-many-mmt`)
  * **Purpose**: Multilingual translation
  * **Used for**: Translating text between languages

### Embedding Models

- **Text Embedding Ada 002** (`text-embedding-ada-002`)
  * **Purpose**: Generate text embeddings for vector search
  * **Used for**: Creating searchable vector representations of text
  * **Default for**: Embedding generation in OpenAI

- **Text Embedding 3 Small** (`text-embedding-3-small`)
  * **Purpose**: Newer, more efficient embedding model
  * **Used for**: Default embedding model in agent system

- **Sentence-Transformers/All-MiniLM-L6-v2** (`sentence-transformers/all-MiniLM-L6-v2`)
  * **Purpose**: Generate text embeddings
  * **Used for**: Creating vector representations for similarity search
  * **Default for**: Hugging Face embedding tasks

### Computer Vision Models

#### Material Recognition
- **Google/ViT-Base-Patch16-224** (`google/vit-base-patch16-224`)
  * **Purpose**: Vision Transformer for image analysis
  * **Used for**: Material recognition from images

- **EfficientNet** (B0-B5 variants)
  * **Purpose**: Image classification
  * **Used for**: Material classification

- **ResNet** (18, 34, 50, 101, 152 variants)
  * **Purpose**: Image classification with residual connections
  * **Used for**: Material classification

- **MobileNet** (V2, V3Small, V3Large variants)
  * **Purpose**: Lightweight image classification
  * **Used for**: Mobile/edge device material classification

#### Object Detection and Segmentation
- **YOLO v8** (`yolov8`)
  * **Purpose**: Object detection
  * **Used for**: Detecting objects in images
  * **Default for**: Local object detection

- **Segment Anything Model (SAM)**
  * **Purpose**: Image segmentation
  * **Used for**: Segmenting images into regions

- **MiDaS**
  * **Purpose**: Depth estimation
  * **Used for**: Estimating depth from single images

- **CLIP**
  * **Purpose**: Connecting text and images
  * **Used for**: Cross-modal understanding and validation

### 3D Reconstruction and Visualization Models

#### NeRF-based Reconstruction
- **NeRF Studio**
  * **Format**: Custom NeRF format
  * **Purpose**: Neural Radiance Field implementation
  * **Used for**: 3D reconstruction from images
  * **Integration**: Via Python API

- **Instant-NGP**
  * **Format**: .ngp
  * **Purpose**: Fast Neural Graphics Primitives
  * **Used for**: Accelerated 3D reconstruction
  * **Integration**: CUDA-accelerated backend

- **COLMAP**
  * **Purpose**: Structure-from-Motion
  * **Used for**: Camera pose estimation and 3D reconstruction

#### Text-to-3D Generation
- **Shap-E**
  * **Format**: PyTorch (.pth)
  * **Purpose**: Text-to-3D base structure generation
  * **Used for**: Creating basic 3D shapes from text descriptions
  * **Integration**: REST API

- **GET3D**
  * **Format**: PyTorch (.pth)
  * **Purpose**: Text-to-3D detailed scene generation
  * **Used for**: Creating detailed 3D scenes from text
  * **Integration**: Python API

- **Hunyuan3D**
  * **Format**: Custom (.h3d)
  * **Purpose**: Alternative text-to-3D model
  * **Used for**: Creating 3D models from text descriptions
  * **Integration**: REST API

### Material and Style Models

- **ControlNet**
  * **Purpose**: Controlled image generation
  * **Used for**: House outline generation

- **Text2Material**
  * **Purpose**: Generate material textures from text
  * **Used for**: Creating material textures based on descriptions

- **HDRNet**
  * **Purpose**: Lighting estimation and HDR environment maps
  * **Used for**: Creating realistic lighting for 3D scenes

### Interior Design Models

- **SpaceFormer**
  * **Purpose**: Room layout and furniture placement
  * **Used for**: Automated interior design

- **Architectural Recognition**
  * **Purpose**: Process architectural drawings
  * **Used for**: Understanding floor plans and architectural designs

- **Room Layout Generator**
  * **Purpose**: Generate room layouts
  * **Used for**: Creating new room designs

### Local Models

- **Llama-2-13B-Chat** (`llama-2-13b-chat`)
  * **Purpose**: Local text generation
  * **Used for**: Text generation when cloud services are unavailable

- **DistilBART-MNLI** (`distilbart-mnli`)
  * **Purpose**: Lightweight text classification
  * **Used for**: Local text classification

- **DistilBART-CNN** (`distilbart-cnn`)
  * **Purpose**: Lightweight text summarization
  * **Used for**: Local text summarization

### Model Configuration

Example configuration for model endpoints:

```typescript
interface ModelEndpoints {
  // Image-based reconstruction
  nerfStudio: string;
  instantNgp: string;
  blenderProc: string;

  // Text-based generation
  shapE: string;
  get3d: string;
  hunyuan3d: string;

  // Scene understanding
  yolo: string;  // Object detection
  sam: string;   // Segmentation
  midas: string; // Depth estimation

  // Architectural
  architecturalRecognition: string;
  roomLayoutGenerator: string;

  // Material and style
  controlNet: string;
  text2material: string;
  clip: string;
  hdrnet: string;   // For lighting estimation and HDR environment maps

  // Camera pose estimation and multi-view consistency
  colmap: string;   // For Structure-from-Motion processing

  // Interior design automation
  spaceFormer: string; // For room layout and furniture placement
}

const modelConfig: ModelEndpoints = {
  nerfStudio: process.env.NERF_STUDIO_ENDPOINT,
  instantNgp: process.env.INSTANT_NGP_ENDPOINT,
  shapE: process.env.SHAPE_E_ENDPOINT,
  get3d: process.env.GET3D_ENDPOINT,
  hunyuan3d: process.env.HUNYUAN3D_ENDPOINT,
  blenderProc: process.env.BLENDER_PROC_ENDPOINT,
  // ... additional endpoints
};
```

### Supported Model Repositories

Models can be imported from popular repositories:

| Repository | Description | Access Method |
|------------|-------------|---------------|
| HuggingFace Hub | Collection of community models | Direct import via model ID |
| TensorFlow Hub | Reusable ML modules | URL-based import |
| PyTorch Hub | Pretrained PyTorch models | Model name reference |
| ONNX Model Zoo | Collection of ONNX models | GitHub reference |

### Importing a Pre-trained Model

To import a pre-trained model:

1. Navigate to **Admin Panel → Models → Import Model**
2. Choose the import method:
   - **File Upload**: Upload a model file from your computer
   - **Repository**: Import from a model repository using ID/path
   - **URL**: Provide a direct URL to the model file
3. Configure model details and import

```javascript
// Client-side code for model import
async function importModelFromRepository(repository, modelId, options) {
  try {
    const formData = new FormData();
    formData.append('repository', repository);
    formData.append('modelId', modelId);
    formData.append('name', options.name);
    formData.append('description', options.description);
    formData.append('framework', options.framework);

    const response = await fetch('/api/admin/models/import/repository', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to import model');
    }

    return await response.json();
  } catch (error) {
    console.error('Error importing model:', error);
    throw error;
  }
}
```

### Model Import Options

When importing a model, you can configure:

- **Model Name**: Custom name for reference
- **Description**: Optional description for documentation
- **Framework**: Specification of the model's framework if not auto-detected
- **Advanced Options**: Framework-specific configurations

## Connecting Datasets with Models

The system provides a training connector to link datasets with models for training or fine-tuning.

### Dataset Splitting

Before training, you can split your dataset into training, validation, and test sets:

1. **Split Ratio Configuration**: Specify the percentage for each set
2. **Stratified Splitting**: Maintain class distribution across sets
3. **API-driven Splitting**: Use the dataset splitting API endpoint

```javascript
// Client-side code for splitting a dataset
async function splitDataset(datasetId, splitConfig) {
  try {
    const response = await fetch(`/api/admin/datasets/${datasetId}/split`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trainRatio: splitConfig.trainRatio, // e.g., 70
        validationRatio: splitConfig.validationRatio, // e.g., 20
        testRatio: splitConfig.testRatio, // e.g., 10
        stratified: splitConfig.stratified // Maintain class distribution if true
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to split dataset: ${await response.text()}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error splitting dataset:', error);
    throw error;
  }
}
```

### Training Configuration

The training connector supports:

1. **Dataset Selection**: Choose from available datasets
2. **Model Selection**: Select a model for training/fine-tuning
3. **Training Parameters**:
   - Learning rate
   - Epochs
   - Batch size
   - Validation split
4. **Advanced Options**:
   - Transfer learning toggle
   - Freezing base model layers
   - Trainable layers count
   - Data augmentation
   - Early stopping
   - Hyperparameter tuning

### Starting a Training Job

To train a model with a dataset:

1. Navigate to **Admin Panel → Datasets → Dataset Details → Training Configuration**
2. Configure model selection, split ratios, and data augmentation options
3. Click "Start Training" to begin the process
4. Monitor progress in real-time through the integrated visualization

The system now supports two methods for starting a training job:

#### Method 1: From Models Panel
```javascript
// Client-side code for starting a training job from Models panel
async function startModelTraining(config) {
  try {
    const response = await fetch('/api/admin/training/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        modelId: config.modelId,
        datasetId: config.datasetId,
        learningRate: config.learningRate,
        epochs: config.epochs,
        batchSize: config.batchSize,
        useTranferLearning: config.useTranferLearning,
        freezeBaseModel: config.freezeBaseModel,
        trainableLayersCount: config.trainableLayersCount,
        enableEarlyStopping: config.enableEarlyStopping,
        enableDataAugmentation: config.enableDataAugmentation,
        validationSplit: config.validationSplit,
        enableHyperparameterTuning: config.enableHyperparameterTuning
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to start training');
    }

    return await response.json();
  } catch (error) {
    console.error('Error starting training:', error);
    throw error;
  }
}
```

#### Method 2: From Dataset Details Panel
```javascript
// Client-side code for starting a training job directly from a dataset
async function startDatasetTraining(datasetId, trainingConfig) {
  try {
    const response = await fetch(`/api/admin/datasets/${datasetId}/train`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: {
          modelArchitecture: trainingConfig.modelArchitecture,
          pretrainedWeights: trainingConfig.pretrainedWeights,
          splitRatios: trainingConfig.splitRatios,
          stratifiedSplit: trainingConfig.stratifiedSplit,
          hyperparameters: trainingConfig.hyperparameters,
          augmentation: trainingConfig.augmentation
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error starting dataset training:', error);
    throw error;
  }
}
```

### Monitoring Training Progress

The system provides real-time training metrics visualization through WebSocket connections:

```javascript
// Client-side code for monitoring training
function subscribeToTrainingProgress(datasetId, callbacks) {
  // Create WebSocket connection to the training progress server
  const WS_URL = process.env.REACT_APP_WS_URL || window.location.origin.replace(/^http/, 'ws');
  const socket = new WebSocket(`${WS_URL}/ws/training-progress`);

  socket.onopen = () => {
    // Subscribe to updates for the specific dataset
    socket.send(JSON.stringify({
      type: 'subscribe',
      datasetId: datasetId
    }));

    if (callbacks.onConnected) {
      callbacks.onConnected();
    }
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case 'progress':
        callbacks.onProgress(data.progress, data.currentEpoch, data.totalEpochs);
        break;
      case 'metrics':
        callbacks.onMetrics(data.metrics);
        break;
      case 'completed':
        callbacks.onCompleted(data.results);
        break;
      case 'error':
        callbacks.onError(data.error);
        break;
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    if (callbacks.onError) {
      callbacks.onError('WebSocket connection error');
    }
  };

  socket.onclose = () => {
    if (callbacks.onDisconnected) {
      callbacks.onDisconnected();
    }
  };

  // Return a cleanup function
  return () => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.close();
    }
  };
}
```

### Stopping a Training Job

The system allows stopping a training job that is in progress:

```javascript
// Client-side code for stopping a training job
async function stopTrainingJob(jobId) {
  try {
    const API_URL = process.env.REACT_APP_API_URL || window.location.origin;

    const response = await fetch(`${API_URL}/api/admin/training/${jobId}/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add authorization headers if required
        ...(localStorage.getItem('auth_token')
          ? { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
          : {})
      }
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to stop training job:', error);
    throw error;
  }
}
```

## Transfer Learning

The system supports transfer learning to leverage pre-trained models for new tasks with limited data.

### Transfer Learning Workflow

1. **Base Model Selection**: Choose a pre-trained model as the starting point
2. **Layer Configuration**: Determine which layers to freeze/unfreeze
3. **Fine-tuning**: Train the model on a new dataset (often smaller than original training data)
4. **Evaluation**: Assess performance on validation data

### Transfer Learning Options

The system provides several configuration options:

- **Layer Freezing**: Control which layers remain fixed during training
- **Learning Rate Scheduling**: Adjust learning rates for different layers
- **Progressive Unfreezing**: Gradually unfreeze layers during training
- **Feature Extraction**: Use the model only for feature extraction without fine-tuning

```python
# Python code example for transfer learning configuration
def configure_transfer_learning(base_model, num_classes, freeze_layers=True, trainable_layers=3):
    """Configure a model for transfer learning

    Args:
        base_model: The pre-trained model to use as a base
        num_classes: Number of classes in the new dataset
        freeze_layers: Whether to freeze base model layers
        trainable_layers: Number of top layers to make trainable if freezing

    Returns:
        Configured model ready for training
    """
    # Create a model with the pre-trained base and new classification head
    model = create_transfer_model(base_model, num_classes)

    if freeze_layers:
        # Freeze all base model layers
        for layer in base_model.layers:
            layer.trainable = False

        # Make the last few layers trainable if specified
        if trainable_layers > 0:
            for layer in base_model.layers[-trainable_layers:]:
                layer.trainable = True

    # Compile with appropriate parameters for fine-tuning
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.0001),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )

    return model
```

## Examples and Use Cases

### Example 1: Material Dataset with Vector Embeddings

```typescript
// Upload a ZIP archive of material images and generate embeddings
async function createMaterialDatasetWithEmbeddings() {
  // Upload ZIP file with vector embedding generation
  const zipFile = document.getElementById('dataset-file').files[0];

  const uploadResult = await uploadZipDatasetWithEmbeddings(zipFile, {
    name: 'Material Surfaces Dataset',
    description: 'Dataset of various material surfaces with vector embeddings',
  });

  console.log(`Created dataset with ${uploadResult.imageCount} images`);
  console.log(`Generated ${uploadResult.embeddingsGenerated} vector embeddings`);

  // Now the dataset is ready for both knowledge base and training use

  // Optional: Start training a model using this dataset
  const trainingJob = await startModelTraining({
    datasetId: uploadResult.dataset.id,
    modelId: 'pretrained-material-classifier',
    // Other training parameters...
  });

  return {
    datasetId: uploadResult.dataset.id,
    trainingJobId: trainingJob.id
  };
}
```

### Example 2: Ceramic Tile Classification

```typescript
// Import ImageNet pretrained model and fine-tune on ceramic tiles dataset
async function setupCeramicTileClassifier() {
  // Import pre-trained MobileNetV2 from TensorFlow Hub
  const model = await importModelFromRepository(
    'tfhub',
    'mobilenetv2_1.00_224',
    {
      name: 'Ceramic Tile Classifier Base',
      description: 'Base model for ceramic tile classification',
      framework: 'tensorflow'
    }
  );

  // Import Ceramic Tile dataset from Kaggle
  const dataset = await importPremadeDataset(
    'materials-dataset',
    {
      name: 'Ceramic Tiles Dataset',
      includeMetadata: true,
      selectedClasses: ['ceramic-tile', 'porcelain-tile', 'natural-stone-tile']
    }
  );

  // Start training with transfer learning
  const trainingJob = await startModelTraining({
    modelId: model.id,
    datasetId: dataset.id,
    learningRate: 0.0001,
    epochs: 10,
    batchSize: 32,
    useTranferLearning: true,
    freezeBaseModel: true,
    trainableLayersCount: 5,
    enableEarlyStopping: true,
    enableDataAugmentation: true,
    validationSplit: 0.2
  });

  return trainingJob;
}
```

### Example 3: Multi-Model Ensemble

```typescript
// Create an ensemble model using multiple pretrained models and datasets
async function createMaterialEnsemble() {
  // Import models from different repositories
  const textureModel = await importModelFromRepository('pytorch_hub', 'resnet18');
  const colorModel = await importModelFromRepository('huggingface', 'microsoft/resnet-50');
  const patternModel = await importModelFromRepository('tfhub', 'efficientnet/b0');

  // Import and prepare the combined dataset
  const materialDataset = await importPremadeDataset('dtd', {
    name: 'Material Textures Combined',
    includeMetadata: true
  });

  // Train each model on the dataset with different focuses
  const textureTraining = await startModelTraining({
    modelId: textureModel.id,
    datasetId: materialDataset.id,
    useTranferLearning: true,
    // Additional parameters for texture focus
  });

  const colorTraining = await startModelTraining({
    modelId: colorModel.id,
    datasetId: materialDataset.id,
    useTranferLearning: true,
    // Additional parameters for color focus
  });

  const patternTraining = await startModelTraining({
    modelId: patternModel.id,
    datasetId: materialDataset.id,
    useTranferLearning: true,
    // Additional parameters for pattern focus
  });

  // Create ensemble configuration after all training jobs complete
  // ...
}
```

## Best Practices

### Dataset Selection

1. **Quality over Quantity**: Choose datasets with high-quality images rather than larger datasets with poor quality
2. **Class Balance**: Ensure classes are balanced or use techniques to address imbalance
3. **Diversity**: Select datasets with diverse examples covering the variance in your target domain
4. **Metadata Richness**: Prefer datasets with comprehensive metadata when available
5. **Vector Embedding Generation**: Enable vector embedding generation for ZIP uploads to leverage similarity search and improve recognition capabilities
6. **Embedding Quality**: For optimal embedding results, use clear, well-lit images with good contrast and minimal background noise

### Model Selection

1. **Task Alignment**: Choose models pre-trained on tasks similar to your target application
2. **Resource Consideration**: Balance model complexity with available computation resources
3. **Framework Compatibility**: Select models from frameworks your team is familiar with
4. **Inference Speed**: Consider deployment requirements when selecting models

### Training Configuration

1. **Start Conservative**: Begin with conservative learning rates and increase if needed
2. **Validation Strategy**: Use appropriate validation split or cross-validation
3. **Augmentation Tuning**: Adjust augmentation to match domain characteristics
4. **Early Experimentation**: Run short training cycles to validate approach before full training

## Troubleshooting

### Common Dataset Issues

1. **Import Failures**:
   - Verify network connection to the repository
   - Check if the dataset ID is correct
   - Ensure sufficient storage space

2. **Quality Problems**:
   - Use the dataset quality analysis tools to identify issues
   - Apply preprocessing using the dataset management service

### Common Model Issues

1. **Import Failures**:
   - Verify framework compatibility
   - Check model file integrity
   - Ensure correct model ID or URL

2. **Training Issues**:
   - Verify dataset format compatibility
   - Check for class imbalance issues
   - Monitor for overfitting or underfitting

## API Reference

For detailed API documentation, refer to the [API Reference](./api-reference.md) document.

## Related Documentation

- [Quality of Data and Metrics](./quality-of-data-and-metrics.md)
- [Material Recognition](./material-recognition.md)
- [Admin Panel](./admin-panel.md)
- [Database and Vector DB](./database-vector-db.md)