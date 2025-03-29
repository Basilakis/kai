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

3. Evaluate results:
   - The system will display accuracy per material category
   - Review performance metrics to identify areas for improvement
   - Test with sample images to verify recognition quality

## Implementation Notes

- The dataset importer supports automatic detection of dataset structure
- Field mapping can be customized for specific material types
- Metadata extracted from datasets is stored for future reference
- Training parameters are automatically optimized based on dataset characteristics

For more advanced training techniques, see the [ML Training Documentation](ml-training-api-improvements.md).