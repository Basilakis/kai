# OCR Enhancements for Material Datasheets

This directory contains enhanced OCR (Optical Character Recognition) capabilities specifically designed for processing material datasheets and technical documents. The system provides specialized features for extracting and processing text from various document types with improved accuracy and reliability.

## Features

Our enhanced OCR system includes the following key improvements:

### 1. Specialized OCR for Material Datasheets

- Custom OCR processing optimized for technical specifications
- Domain-specific dictionaries for materials (tile, stone, wood)
- Optimized preprocessing tailored for material datasheets
- Improved text extraction from tables and structured content

### 2. Multi-Language Support

- Extended language capabilities beyond English
- Support for 20+ languages including French, German, Spanish, Italian, Chinese, Japanese
- Automatic language detection in mixed-language documents
- Language-specific post-processing rules

### 3. Layout Analysis Improvements

- Advanced parsing of complex document structures
- Table detection and extraction with cell-level content recognition
- Multi-column layout detection and processing
- Identification of headings, specifications, and other structured content

### 4. Handwriting Recognition

- Detection of handwritten annotations on technical documents
- Specialized preprocessing for handwritten text
- Confidence metrics for handwriting recognition
- Integration with printed text extraction

### 5. PDF Form Field Extraction

- Automatic identification of form fields in structured documents
- Extraction of field values and labels
- Support for various field types (text, checkboxes, radio buttons)
- Table extraction from form documents

### 6. OCR Confidence Scoring

- Detailed confidence metrics for extracted text
- Multi-factor confidence evaluation (character, word, context)
- Domain-specific confidence boosting
- Identification of low-confidence regions

### 7. Post-Processing Rules Engine

- Domain-specific correction rules for technical content
- Automatic formatting of measurements, specifications, and technical values
- Customizable rule sets for different material types
- Continuous improvement through feedback integration

## Components

The OCR enhancements are implemented through the following Python modules:

- **specialized_ocr.py**: Core OCR functionality optimized for material datasheets
- **layout_analysis.py**: Advanced document layout analysis capabilities
- **handwriting_recognition.py**: Specialized handwriting detection and recognition
- **form_field_extraction.py**: Extraction of structured data from forms
- **ocr_confidence_scoring.py**: Confidence metrics and post-processing rules
- **enhanced_ocr.py**: Integration module that combines all components

## Usage

### Basic Usage

The enhanced OCR system can be used through the `enhanced_ocr.py` integration module:

```bash
python enhanced_ocr.py <input_path> [options]
```

This will process the document at `<input_path>` using all available enhancements and save the results to an output directory.

### Options

```
--output-dir           Directory to save results
--language             OCR language(s) (comma-separated, default: eng)
--material-type        Type of material (tile, stone, wood, etc.)
--extract-forms        Enable form field extraction
--extract-tables       Enable table extraction
--detect-handwriting   Enable handwriting detection
--confidence-threshold Minimum confidence threshold (0-100, default: 60)
--visualization        Generate visualizations
--batch-mode           Process multiple documents from a directory
--no-post-processing   Disable post-processing rules
```

### Example Usage

**Process a single PDF with all enhancements:**

```bash
python enhanced_ocr.py sample_datasheet.pdf --output-dir ./results --material-type tile --visualize
```

**Process a directory of images with specific options:**

```bash
python enhanced_ocr.py ./datasheets/ --batch-mode --material-type stone --language eng,deu --extract-tables --detect-handwriting
```

**Process a form document focusing on form field extraction:**

```bash
python enhanced_ocr.py form_document.pdf --extract-forms --confidence-threshold 70
```

## Individual Component Usage

Each component can also be used independently for specific tasks:

### Specialized OCR for Material Datasheets

```bash
python specialized_ocr.py <input_path> --output-dir <output_dir> --language eng --datasheet-type tile
```

### Layout Analysis

```bash
python layout_analysis.py <input_path> --output-dir <output_dir> --visualize
```

### Handwriting Recognition

```bash
python handwriting_recognition.py <input_path> --output-dir <output_dir> --language eng --visualize
```

### Form Field Extraction

```bash
python form_field_extraction.py <input_path> --output-dir <output_dir> --output-format json --extract-tables
```

### OCR Confidence Scoring and Post-Processing

```bash
python ocr_confidence_scoring.py <input_file> --output-file <output_file> --domain tile --min-confidence 0.6
```

## Requirements

- Python 3.7+
- OpenCV (cv2)
- PyTesseract with Tesseract OCR 4.1+
- PyMuPDF (fitz)
- NumPy
- PyEnchant (optional, for enhanced spell checking)
- scikit-image (for advanced layout analysis)

## Output Format

The enhanced OCR system produces structured output in JSON format, containing:

- Extracted text with confidence scores
- Detected document structure (tables, columns, fields)
- Handwritten text regions (if detected)
- Form fields with values (if applicable)
- Enhanced text after post-processing
- Confidence metrics and statistics

For visualization, the system can also generate annotated images showing the detected regions, tables, and form fields.

## Integration

The enhanced OCR system can be integrated with the existing material recognition pipeline:

1. Use enhanced OCR for processing material datasheets
2. Extract technical specifications automatically
3. Feed extracted data into the material database
4. Connect with the web application for viewing and editing results

## Performance Considerations

- For best results with handwriting recognition, set a minimum DPI of 300
- Processing time increases with additional enabled features
- Memory usage may be significant for large documents with many pages
- Consider batch processing for large numbers of documents
- For multi-language documents, specify all expected languages for best results

## Feedback and Improvement

The system includes a feedback loop mechanism that can be used to continuously improve OCR results:

1. Review OCR results in the output JSON files
2. Provide feedback on incorrect recognitions
3. Add domain-specific terms to dictionaries
4. Create custom post-processing rules for specific document types

---

For more details on specific components, refer to the docstrings in each Python file.