# Training with Existing Materials

This guide explains how to train the system with existing materials, focusing on dataset import capabilities and model training.

## Dataset Import Options

Our system supports multiple methods for importing existing material data:

### 1. Hugging Face Datasets

The system can import datasets directly from Hugging Face:

```
// Example dataset: Material in Context (MINC-2500)
// https://huggingface.co/datasets/mcimpoi/minc-2500_split_1
```

**Import Process:**

1. Navigate to the Admin Panel → Datasets section
2. Select "Import External Dataset"
3. Enter the Hugging Face dataset ID: `mcimpoi/minc-2500_split_1`
4. Configure import options:
   - Map dataset categories to system material types
   - Set maximum images per class (recommended: 250-500)
   - Enable/disable metadata import
   - Select specific classes to import (optional)
5. Start the import process

The system will:
- Download dataset samples from Hugging Face
- Extract category and image information
- Map external dataset fields to internal metadata fields
- Create properly categorized material samples

### 2. CSV/Structured Dataset Import

For CSV or structured datasets with mapped fields:

1. Prepare a CSV with columns mapping to system fields
2. Include material type, properties, and image file paths
3. Upload through the Admin Panel → Datasets → Import CSV

### 3. Local Directory Import

For datasets stored in local directories:

1. Organize materials by category in subdirectories
2. Specify the root directory path during import
3. The system will analyze the structure and suggest mappings

## Field Mapping System

The system includes a flexible field mapping capability:

- Maps external dataset fields to internal metadata fields
- Provides predefined mappings for common material datasets
- Allows custom mapping configuration
- Handles automatic property extraction

## Training Models with Imported Materials

After importing materials, you can train recognition models:

1. Navigate to Admin Panel → Models → Training
2. Select the imported dataset from available datasets
3. Configure training parameters:
   - Base model (ResNet, MobileNet, etc.)
   - Batch size and learning rate
   - Number of epochs
   - Transfer learning settings
4. Start training
5. Monitor progress in real-time
6. Evaluate model performance with validation metrics

### Detailed Training Process

The training process involves several sophisticated steps:

1. **Model Initialization**
   - Base models are loaded dynamically from ML framework libraries (not stored in our repo)
   - TensorFlow or PyTorch pre-trained architectures (MobileNetV2, ResNet, EfficientNet)
   - Classification layers are replaced with custom layers for material recognition

2. **Transfer Learning Optimization**
   - Initial layers of base models are frozen to preserve general features
   - Only the top classification layers are trained initially
   - Sparse categorical cross-entropy loss is used for classification tasks
   - Adam optimizer with carefully tuned learning rate (typically 0.0001)
   - Later training phases gradually unfreeze more layers for fine-tuning

3. **Training Enhancement Techniques**
   - Early stopping with validation loss monitoring
   - Learning rate reduction on plateau
   - Data augmentation specific to material properties
   - Regularization to prevent overfitting (dropout, L2)

4. **Model Storage and Versioning**
   - Trained models are saved with metadata in the output directory structure:
   ```
   /models/
     ├── {model_id}/
     │   ├── model.h5 (or .pt for PyTorch)
     │   ├── metadata.json
     │   ├── training_history.json
     │   └── hyperparameters.json
   ```
   - Complete training history is preserved for analysis
   - Models are versioned for tracking improvements

5. **Vector Database Integration**
   - The trained models generate embeddings for all materials
   - These embeddings (not the models themselves) are stored in the vector database
   - FAISS indexing enables efficient similarity search
   - Each material's embedding links to knowledge base entries through material IDs

## Example: Training with MINC-2500

For the MINC-2500 dataset, which contains material images across 10 categories:

1. Import the dataset using the Hugging Face importer:
   - Use ID: `mcimpoi/minc-2500_split_1`
   - The system will automatically map categories like 'wood', 'metal', 'fabric', etc.
   - System will assign appropriate material types based on content

2. Train a material recognition model:
   - Use transfer learning on a pre-trained image model
   - Configure 10-20 epochs for good results
   - Enable data augmentation for improved generalization
   - Set learning rate to ~0.0001 for stable training
   - Apply sparse categorical cross-entropy loss for classification

3. Evaluate results:
   - The system will display accuracy per material category
   - Review performance metrics to identify areas for improvement
   - Test with sample images to verify recognition quality
   - Analyze confusion matrix to understand misclassifications
   - Review embedding quality metrics for similarity search applications

4. Model Deployment:
   - The trained model is automatically versioned and stored
   - Embeddings are generated for all materials in the dataset
   - Vector database is updated with new embeddings
   - Recognition system starts using the new model immediately

## Implementation Notes

- The dataset importer supports automatic detection of dataset structure
- Field mapping can be customized for specific material types
- Metadata extracted from datasets is stored for future reference
- Training parameters are automatically optimized based on dataset characteristics

For more advanced training techniques, see the [ML Training Documentation](ml-training-api-improvements.md).