# PDF Processing Pipeline

This document explains how the Kai Material Recognition system processes PDF catalogs to create a training dataset and knowledge base for material recognition.

## Overview

The PDF processing pipeline automatically extracts images and text from PDF catalogs, associates images with their specifications, and organizes them for training the material recognition models. This eliminates the need for manual dataset creation and organization.

## Pipeline Steps

1. **PDF Upload**: Users upload PDF catalogs through the admin interface.

2. **Image Extraction**: The system extracts images from the PDFs using PyMuPDF.
   ```typescript
   import { extractFromPDF } from '@kai/ml';
   
   const result = await extractFromPDF('path/to/catalog.pdf', 'output/directory');
   ```

3. **Text Extraction**: The system extracts text blocks from the PDFs and associates them with nearby images.

4. **OCR Processing**: For text embedded in images or poorly extracted text, OCR is applied to ensure all specifications are captured.

5. **Specification Parsing**: The system parses the extracted text to identify material specifications such as:
   - Material type (tile, stone, wood, etc.)
   - Dimensions (size)
   - Technical properties (R-value, PEI rating, etc.)
   - Color and finish information

6. **Image Preprocessing**: Extracted images are preprocessed to improve quality:
   - Cropping to remove borders
   - Enhancing contrast and sharpness
   - Normalizing size and format

7. **Dataset Organization**: The system automatically organizes the processed images into a structured dataset:
   ```
   processed_data/
     ├── material_id_1/
     │   ├── image1.jpg
     │   ├── image2.jpg
     │   └── metadata.json
     ├── material_id_2/
     │   ├── image1.jpg
     │   ├── image2.jpg
     │   └── metadata.json
     └── ...
   ```

8. **Feature Extraction**: SIFT features are extracted from all images and stored for feature-based matching.
   ```typescript
   import { generateFeatureDescriptors } from '@kai/ml';
   
   const result = await generateFeatureDescriptors('processed_data', 'models/feature_descriptors.npz');
   ```

9. **Model Training**: Neural network models are trained using the organized dataset.
   ```typescript
   import { trainNeuralNetwork } from '@kai/ml';
   
   const result = await trainNeuralNetwork('processed_data', 'models/neural_network');
   ```

10. **Vector Embedding Generation**: Vector embeddings are generated for all materials to enable similarity search.

11. **Knowledge Base Integration**: All extracted data is stored in the knowledge base, including:
    - Material images
    - Material specifications
    - Feature descriptors
    - Vector embeddings

## Automatic Material Classification

The system automatically classifies materials based on the extracted text and image features:

1. **Text-Based Classification**: Analyzes specification text for material type indicators:
   - Keywords like "tile", "stone", "wood", etc.
   - Material-specific properties (e.g., PEI rating for tiles)

2. **Image-Based Classification**: Uses pre-trained models to classify materials based on visual appearance.

3. **Combined Classification**: Merges text and image classification results for more accurate material type determination.

## Batch Processing

For large catalogs or multiple PDFs, the system uses a queue-based batch processing approach:

1. PDFs are added to a processing queue
2. Processing jobs are distributed across available resources
3. Results are aggregated into the knowledge base as they complete

## Monitoring and Validation

The admin interface provides tools to monitor and validate the PDF processing:

1. **Processing Status**: Track the progress of PDF processing jobs
2. **Extraction Review**: Review extracted images and specifications
3. **Manual Correction**: Correct any errors in the extracted data
4. **Validation Tools**: Validate the quality of extracted data

## Integration with Recognition System

Once processed, the data is immediately available for the material recognition system:

1. **Feature-Based Matching**: Uses extracted SIFT features for direct matching
2. **ML-Based Classification**: Uses trained neural network models for classification
3. **Vector Search**: Uses generated embeddings for similarity search
4. **Hybrid Approach**: Combines all methods for optimal recognition results

## Conclusion

The PDF processing pipeline automates the creation of the training dataset and knowledge base, eliminating the need for manual dataset organization. This approach ensures that the material recognition system can be quickly populated with new materials simply by uploading PDF catalogs.