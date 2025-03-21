# Kai Material Recognition AI System

This document provides comprehensive documentation on the AI models and machine learning capabilities integrated into the Kai Material Recognition system.

## Overview

The Kai system combines multiple AI technologies to provide powerful material recognition, classification, and information extraction capabilities:

1. **OCR System** - Extracts text from images and documents
2. **Computer Vision Models** - Recognizes and classifies materials based on visual features
3. **Vector Embedding System** - Creates searchable vector representations for similarity matching
4. **Metadata Extraction System** - Extracts structured information using pattern recognition and hints

## AI Models and Components

### OCR System

The OCR (Optical Character Recognition) system is built around Tesseract OCR with custom enhancements:

#### Components:
- **Tesseract OCR Engine** - Core text recognition capabilities
- **Region-Based OCR** - Specialized extraction from specific image regions
- **Enhanced Preprocessing Pipeline** - Custom image preprocessing to improve OCR accuracy
- **Error Recovery System** - Fallback strategies for handling OCR failures

#### Key Features:
- Multiple OCR engines with automatic selection based on content type
- Specialized preprocessing techniques for catalog materials
- Region detection to focus OCR on relevant areas
- Confidence scoring for extracted text

#### Integration Points:
- `ocrService.ts` - Core OCR functionality
- `regionBasedOCR.ts` - Targeted extraction from specific regions
- `enhancedPreprocessing.ts` - Image quality improvements for OCR

### Computer Vision Models

The system uses a hybrid approach for material recognition, combining traditional feature-based methods with deep learning:

#### Models:

1. **Feature-based Recognition**:
   - **Algorithm**: Scale-Invariant Feature Transform (SIFT)
   - **Implementation**: OpenCV through Python bindings
   - **Strengths**: Works well with limited training data, effective for material textures
   - **Location**: `material_recognizer.py` (feature-based mode)

2. **Neural Network Models**:
   - **TensorFlow Model**: MobileNetV2 (optimized for mobile/edge devices)
   - **PyTorch Model**: ResNet18 (residual network with 18 layers)
   - **Strengths**: Better at understanding higher-level visual concepts
   - **Location**: `material_recognizer.py` (ml-based mode)

3. **Hybrid Approach**:
   - Combines confidence scores from both feature-based and neural network approaches
   - Adaptive weighting based on detection confidence
   - **Location**: `material_recognizer.py` (hybrid mode)

#### Key Features:
- Multiple recognition strategies (feature-based, ML-based, hybrid)
- Confidence thresholds for reliable recognition
- Customizable fusion algorithms for combining results
- Fall-back mechanisms when one approach fails

### Vector Embedding System

The vector embedding system transforms materials into mathematical vectors for similarity search:

#### Models:
- **Feature-based Embedding**: Extracts and compresses SIFT features
- **Neural Network Embedding**: Uses the same neural networks as recognition but removes classification layers
- **Hybrid Embedding**: Combines both approaches for more robust representations

#### Implementation:
- Located in `embedding_generator.py`
- Generates fixed-size embeddings (default: 128 dimensions)
- Supports different frameworks (TensorFlow, PyTorch)
- Includes dimensionality reduction techniques

#### Search Capabilities:
- Cosine similarity calculation
- Fast nearest-neighbor search
- Material filtering by type and attributes
- Result ranking by similarity score

## AI Enhancement through Administrative Functionality

Our recently implemented administrative functionality enhances these AI capabilities through better metadata management:

### 1. Category Management System

The Category system provides context for AI models:

- **Implementation**: `category.model.ts` 
- **Key Features**:
  - Hierarchical category structure
  - Parent/child relationships between categories
  - Category-specific extraction rules

**AI Enhancement**: By organizing materials into categories, the system can apply specialized extraction rules, improving recognition accuracy by narrowing the domain.

### 2. Metadata Field System

The MetadataField system defines structured fields with AI extraction guidance:

- **Implementation**: `metadataField.model.ts`
- **Field Types**:
  - Text/TextArea - For descriptions, names
  - Number - For dimensions, weights
  - Dropdown - For standardized attributes (R9, R10, R11 ratings)
- **AI Guidance**:
  - Each field includes a "hint" property that guides AI extraction
  - Hints explain context, patterns, or locations to find information

**AI Enhancement**: Metadata fields provide structured guidance to the OCR and ML systems, significantly improving extraction accuracy.

### 3. Metadata Extraction with Hints

The core extraction functionality now uses hints to guide the process:

- **Implementation**: Enhanced `extractMaterialInfoFromTexts` and `extractFieldValueUsingHint` functions in `material.model.ts`
- **Extraction Strategies**:
  - Pattern-based extraction using regular expressions derived from hints
  - Context-based extraction (finding text near specific keywords)
  - Type-specific extraction strategies for numbers, dropdowns, etc.
- **Confidence Tracking**:
  - Each extracted field includes a confidence score
  - Administrators can use these scores to improve hint quality

## AI Processing Pipeline

The complete AI pipeline for processing materials works as follows:

1. **Document Processing**:
   - PDF processor extracts images from catalogs
   - Images are processed for quality improvement

2. **OCR Processing**:
   - Tesseract OCR extracts text from images
   - Region-based OCR targets specific areas for detailed extraction
   - Text is processed and normalized

3. **Material Recognition**:
   - Images go through feature extraction (SIFT)
   - Neural networks classify the material
   - Results are combined in hybrid mode for better accuracy

4. **Metadata Extraction**:
   - Extracted text is processed using metadata field hints
   - Type-specific extraction strategies are applied
   - Confidence scores are calculated for each extracted field

5. **Vector Generation**:
   - Material images are converted to vector embeddings
   - These vectors enable similarity search
   - Multiple embedding strategies ensure robust matching

6. **Storage and Indexing**:
   - Materials with metadata and vectors are stored in the database
   - Vector indexes enable fast similarity search
   - Categories and metadata provide structured filtering

## System Requirements and Dependencies

The AI system relies on the following components:

- **Python 3.8+** - For ML components
- **Node.js 16+** - For server integration
- **TensorFlow 2.12+** / **PyTorch 2.0+** - ML frameworks
- **OpenCV 4.5+** - Computer vision functionality
- **Tesseract OCR** - Text extraction
- **NumPy, SciPy, Scikit-learn** - Scientific computing

## Extending the AI System

The system is designed for extensibility:

1. **Adding New Models**:
   - Place new TensorFlow models in `models/material_classifier_tf/`
   - Place new PyTorch models in `models/material_classifier_torch.pt`
   - Update the model loader in `material_recognizer.py`

2. **Improving Extraction**:
   - Add new metadata fields with hints through the admin interface
   - Refine existing hints based on confidence scores
   - Extend the pattern library in `extractFieldValueUsingHint`

3. **Training New Models**:
   - Use the training scripts in `ml/scripts/`
   - Organize training data by material category
   - Configure training parameters through the API

By leveraging the administrative functionality for metadata management, the system becomes more accurate over time without requiring new AI models. Instead, administrators provide better guidance to the existing models through carefully defined metadata fields and extraction hints.