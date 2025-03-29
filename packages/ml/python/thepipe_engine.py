#!/usr/bin/env python3
"""
ThePipe Engine for Neural OCR

This module provides integration with emcf's thepipe for structured information extraction
from documents. ThePipe is particularly useful for systematically extracting specific data
points from standardized document formats.

ThePipe excels at:
1. Extracting structured information from forms and documents
2. Processing form-based content with defined fields
3. Organizing extracted information into a structured format
4. Handling domain-specific extraction requirements
5. Providing consistent output for downstream systems

The engine integrates with the neural_ocr_orchestrator.py module to provide specialized
processing capabilities for materials datasheets and specification documents.
"""

import os
import sys
import json
import logging
import tempfile
from typing import Dict, List, Any, Tuple, Optional, Union
from pathlib import Path
import time
import io
import base64
import subprocess
import shutil

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import thepipe dependencies with graceful fallback
THEPIPE_AVAILABLE = False
try:
    # Check if thepipe can be imported
    try:
        # Attempt to import thepipe
        import thepipe
        from thepipe.pipeline import Pipeline
        from thepipe.extractors import DocumentExtractor
        
        THEPIPE_AVAILABLE = True
        logger.info("thepipe dependencies loaded successfully")
    except ImportError:
        logger.warning("thepipe package not found. thepipe-specific functionality will be disabled.")
        logger.warning("Install thepipe using: pip install thepipe")
except ImportError as e:
    logger.warning(f"Required dependencies for thepipe not available: {e}")
    logger.warning("thepipe engine will fall back to alternative processing methods")


class ThePipeEngine:
    """
    Engine for processing documents with thepipe for structured information extraction
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the thepipe engine
        
        Args:
            config: Configuration dictionary with settings
        """
        self.config = {
            'pipeline_path': None,  # Path to custom pipeline configuration
            'pipeline_type': 'material_specs',  # Default pipeline type
            'extract_form_fields': True,  # Extract form fields
            'extract_tables': True,  # Extract tables
            'extract_specifications': True,  # Extract specifications
            'confidence_threshold': 0.6,  # Minimum confidence threshold
            'fallback_to_tesseract': True,  # Fallback to Tesseract if thepipe fails
            'output_format': 'json',  # Output format (json or xml)
            'cache_dir': None,  # Cache directory for temporary files
            'field_extractors': [  # Default field extractors
                'dimension',
                'material_type',
                'product_code',
                'technical_properties'
            ]
        }
        
        if config:
            self.config.update(config)
        
        # Create cache directory if none specified
        if not self.config['cache_dir']:
            self.config['cache_dir'] = tempfile.mkdtemp(prefix="thepipe_cache_")
        else:
            os.makedirs(self.config['cache_dir'], exist_ok=True)
        
        # Check if thepipe is available
        self.thepipe_available = THEPIPE_AVAILABLE
        
        # Only initialize if thepipe is available
        if THEPIPE_AVAILABLE:
            self._init_thepipe_pipeline()
        else:
            logger.warning("Initializing thepipe engine with limited functionality")
            self._init_fallback_methods()
    
    def _init_thepipe_pipeline(self):
        """Initialize the thepipe pipeline"""
        try:
            # Load pipeline configuration
            if self.config['pipeline_path']:
                # Load from custom configuration file
                pipeline_config_path = self.config['pipeline_path']
                logger.info(f"Loading pipeline from custom configuration: {pipeline_config_path}")
                
                # Load the pipeline
                self.pipeline = Pipeline.from_config(pipeline_config_path)
            else:
                # Use default pipeline based on type
                pipeline_type = self.config['pipeline_type']
                logger.info(f"Creating default pipeline for type: {pipeline_type}")
                
                # Create pipeline with default configuration
                self.pipeline = self._create_default_pipeline(pipeline_type)
            
            logger.info("thepipe pipeline initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize thepipe pipeline: {e}")
            self.thepipe_available = False
            self._init_fallback_methods()
    
    def _create_default_pipeline(self, pipeline_type: str) -> 'Pipeline':
        """
        Create a default pipeline based on the specified type
        
        Args:
            pipeline_type: Type of pipeline to create
            
        Returns:
            Configured Pipeline instance
        """
        # Create a pipeline configuration based on the type
        if pipeline_type == 'material_specs':
            # Pipeline for material specification documents
            extractors = [
                DocumentExtractor('dimensions', 
                                 patterns=[r'\d+\s*[xX×]\s*\d+\s*(mm|cm|m)',
                                          r'dimensions?:?\s*\d+\s*[xX×]\s*\d+',
                                          r'size:?\s*\d+\s*[xX×]\s*\d+']),
                
                DocumentExtractor('material_type',
                                 patterns=[r'material:?\s*([a-zA-Z]+)',
                                          r'type:?\s*([a-zA-Z]+)',
                                          r'(ceramic|porcelain|natural stone|marble|granite|slate)']),
                
                DocumentExtractor('product_code',
                                 patterns=[r'product\s*code:?\s*([A-Z0-9\-]+)',
                                          r'item\s*number:?\s*([A-Z0-9\-]+)',
                                          r'SKU:?\s*([A-Z0-9\-]+)']),
                
                DocumentExtractor('technical_properties',
                                 patterns=[r'PEI:?\s*([IVX\d]+)',
                                          r'R-rating:?\s*(R\d+)',
                                          r'slip resistance:?\s*([A-Z0-9]+)'])
            ]
            
            # Create pipeline with extractors
            pipeline = Pipeline(extractors=extractors)
            
        elif pipeline_type == 'form':
            # Pipeline for form documents
            extractors = [
                DocumentExtractor('form_fields',
                                 patterns=[r'([a-zA-Z\s]+):\s*(.+?)(?=\n|$)',
                                          r'([a-zA-Z\s]+)\s*=\s*(.+?)(?=\n|$)']),
                
                DocumentExtractor('checkboxes',
                                 patterns=[r'\[X\]\s*(.+?)(?=\n|$)',
                                          r'☑\s*(.+?)(?=\n|$)',
                                          r'☒\s*(.+?)(?=\n|$)'])
            ]
            
            # Create pipeline with extractors
            pipeline = Pipeline(extractors=extractors)
            
        else:
            # Generic pipeline
            extractors = [
                DocumentExtractor('generic',
                                 patterns=[r'([a-zA-Z\s]+):\s*(.+?)(?=\n|$)'])
            ]
            
            # Create pipeline with extractors
            pipeline = Pipeline(extractors=extractors)
        
        return pipeline
    
    def _init_fallback_methods(self):
        """Initialize fallback methods if thepipe is not available"""
        # Try to import Tesseract as a fallback
        try:
            import pytesseract
            self.fallback_engine = "tesseract"
            logger.info("Using Tesseract as fallback engine")
        except ImportError:
            self.fallback_engine = None
            logger.warning("No fallback OCR engine available")
    
    def process_image(self, image_path: str, output_dir: str = None) -> Dict[str, Any]:
        """
        Process an image with thepipe
        
        Args:
            image_path: Path to the image file
            output_dir: Optional output directory for results
            
        Returns:
            Dictionary with processing results
        """
        start_time = time.time()
        
        # Check if image file exists
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")
        
        # Create output directory if specified
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        
        # Process the image based on availability
        if self.thepipe_available:
            result = self._process_with_thepipe(image_path, output_dir)
        else:
            result = self._process_with_fallback(image_path, output_dir)
        
        # Add processing time
        processing_time = time.time() - start_time
        result['processing_time'] = processing_time
        
        # Add metadata
        result['engine'] = 'thepipe' if self.thepipe_available else 'fallback'
        result['image_path'] = image_path
        
        # Save result if output directory is specified
        if output_dir:
            basename = os.path.basename(image_path)
            result_path = os.path.join(output_dir, f"{Path(basename).stem}_thepipe.json")
            with open(result_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
        
        return result
    
    def _process_with_thepipe(self, image_path: str, output_dir: str = None) -> Dict[str, Any]:
        """
        Process an image with thepipe
        
        Args:
            image_path: Path to the image file
            output_dir: Optional output directory for results
            
        Returns:
            Dictionary with processing results
        """
        try:
            # Process the image with OCR first if needed
            # thepipe often works with text already extracted from the document
            ocr_text = self._extract_text_from_image(image_path)
            
            # Create temporary file for OCR text
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as temp_file:
                temp_file.write(ocr_text)
                text_path = temp_file.name
            
            try:
                # Process the text with thepipe
                logger.info(f"Processing {image_path} with thepipe")
                
                # Run the pipeline
                extraction_results = self.pipeline.process(text_path)
                
                # Extract structured content
                structured_content = self._format_extraction_results(extraction_results)
                
                # Estimate confidence from extraction results
                confidence = self._estimate_confidence(extraction_results)
                
                # Create result
                result = {
                    'text': ocr_text,
                    'structured_content': structured_content,
                    'confidence': confidence,
                    'extraction_results': extraction_results
                }
                
                # Save output if directory is specified
                if output_dir:
                    # Save the processed text
                    text_path = os.path.join(output_dir, f"{Path(image_path).stem}_text.txt")
                    with open(text_path, 'w', encoding='utf-8') as f:
                        f.write(ocr_text)
                    
                    # Save structured content
                    struct_path = os.path.join(output_dir, f"{Path(image_path).stem}_structured.json")
                    with open(struct_path, 'w', encoding='utf-8') as f:
                        json.dump(structured_content, f, indent=2, ensure_ascii=False)
                
                return result
                
            finally:
                # Clean up temporary file
                if os.path.exists(text_path):
                    os.unlink(text_path)
            
        except Exception as e:
            logger.error(f"Error processing image with thepipe: {e}")
            
            # Fall back to alternative method if configured
            if self.config['fallback_to_tesseract']:
                logger.info("Falling back to alternative OCR method")
                return self._process_with_fallback(image_path, output_dir)
            
            # Return error if no fallback
            return {
                'text': '',
                'structured_content': {},
                'confidence': 0.0,
                'error': str(e)
            }
    
    def _extract_text_from_image(self, image_path: str) -> str:
        """
        Extract text from an image using OCR
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Extracted text
        """
        # Use Tesseract to extract text from image
        try:
            import pytesseract
            from PIL import Image
            
            # Open the image
            image = Image.open(image_path)
            
            # Run OCR
            text = pytesseract.image_to_string(image)
            
            return text
        except ImportError:
            logger.warning("pytesseract not available, using alternate method")
            
            # Alternative method: Use system Tesseract command
            try:
                # Create temporary output file
                with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as temp_file:
                    output_path = temp_file.name
                
                # Run Tesseract
                result = subprocess.run(
                    ['tesseract', image_path, output_path.replace('.txt', '')],
                    capture_output=True,
                    text=True
                )
                
                # Check for errors
                if result.returncode != 0:
                    raise RuntimeError(f"Tesseract failed: {result.stderr}")
                
                # Read the output file
                with open(output_path, 'r') as f:
                    text = f.read()
                
                # Clean up
                os.unlink(output_path)
                
                return text
            except Exception as e:
                logger.error(f"Failed to extract text with system Tesseract: {e}")
                return ""
    
    def _format_extraction_results(self, extraction_results: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format extraction results into structured content
        
        Args:
            extraction_results: Raw extraction results from thepipe
            
        Returns:
            Formatted structured content
        """
        # In a real implementation, this would convert thepipe's output format
        # to a standardized structure. For now, we'll use a simple transformation.
        
        structured_content = {
            'fields': {},
            'dimensions': [],
            'material_properties': [],
            'product_info': {}
        }
        
        # Process extraction results
        for extractor_name, results in extraction_results.items():
            if extractor_name == 'dimensions':
                structured_content['dimensions'] = results
            
            elif extractor_name == 'material_type':
                if results:
                    structured_content['product_info']['material_type'] = results[0]
            
            elif extractor_name == 'product_code':
                if results:
                    structured_content['product_info']['product_code'] = results[0]
            
            elif extractor_name == 'technical_properties':
                structured_content['material_properties'] = results
            
            elif extractor_name == 'form_fields':
                # Convert key-value pairs to a dictionary
                for field in results:
                    if isinstance(field, tuple) and len(field) == 2:
                        key, value = field
                        structured_content['fields'][key] = value
            
            else:
                # Generic field
                structured_content[extractor_name] = results
        
        return structured_content
    
    def _estimate_confidence(self, extraction_results: Dict[str, Any]) -> float:
        """
        Estimate confidence from extraction results
        
        Args:
            extraction_results: Raw extraction results from thepipe
            
        Returns:
            Confidence score (0-1)
        """
        # Count number of extractors with non-empty results
        non_empty_extractors = sum(1 for results in extraction_results.values() if results)
        
        # Total number of extractors
        total_extractors = len(extraction_results)
        
        # Calculate confidence based on extraction success rate
        if total_extractors > 0:
            return non_empty_extractors / total_extractors
        else:
            return 0.0
    
    def _process_with_fallback(self, image_path: str, output_dir: str = None) -> Dict[str, Any]:
        """
        Process an image with fallback method (e.g., Tesseract)
        
        Args:
            image_path: Path to the image file
            output_dir: Optional output directory for results
            
        Returns:
            Dictionary with processing results
        """
        # Check if we have a fallback engine
        if self.fallback_engine == "tesseract":
            try:
                import pytesseract
                from PIL import Image
                
                # Process with Tesseract
                logger.info(f"Processing {image_path} with Tesseract")
                
                # Load the image
                image = Image.open(image_path)
                
                # Run OCR
                text = pytesseract.image_to_string(image)
                
                # Get confidence (based on OCR data)
                ocr_data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
                confidences = [float(conf) for conf in ocr_data['conf'] if conf != '-1']
                avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
                confidence = avg_confidence / 100.0  # Convert to 0-1 range
                
                # Perform basic field extraction to simulate thepipe functionality
                structured_content = self._extract_basic_fields(text)
                
                # Create result
                result = {
                    'text': text,
                    'structured_content': structured_content,
                    'confidence': confidence
                }
                
                # Save output if directory is specified
                if output_dir:
                    # Save the processed text
                    text_path = os.path.join(output_dir, f"{Path(image_path).stem}_fallback.txt")
                    with open(text_path, 'w', encoding='utf-8') as f:
                        f.write(text)
                
                return result
                
            except Exception as e:
                logger.error(f"Error in fallback processing: {e}")
        
        # No fallback or fallback failed
        return {
            'text': '',
            'structured_content': {},
            'confidence': 0.0,
            'error': "No suitable OCR method available"
        }
    
    def _extract_basic_fields(self, text: str) -> Dict[str, Any]:
        """
        Extract basic fields from text using regex patterns
        
        Args:
            text: Text to extract fields from
            
        Returns:
            Dictionary with extracted fields
        """
        import re
        
        structured_content = {
            'fields': {},
            'dimensions': [],
            'material_properties': [],
            'product_info': {}
        }
        
        # Extract dimensions
        dimension_patterns = [
            r'(\d+)\s*[xX×]\s*(\d+)\s*(mm|cm|m)?',
            r'dimensions?:?\s*(\d+)\s*[xX×]\s*(\d+)',
            r'size:?\s*(\d+)\s*[xX×]\s*(\d+)'
        ]
        
        for pattern in dimension_patterns:
            for match in re.finditer(pattern, text):
                structured_content['dimensions'].append(match.group(0))
        
        # Extract material type
        material_patterns = [
            r'material:?\s*([a-zA-Z]+)',
            r'type:?\s*([a-zA-Z]+)',
            r'(ceramic|porcelain|natural stone|marble|granite|slate)'
        ]
        
        for pattern in material_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                material_type = match.group(1) if len(match.groups()) > 0 else match.group(0)
                structured_content['product_info']['material_type'] = material_type
                break
        
        # Extract product code
        code_patterns = [
            r'product\s*code:?\s*([A-Z0-9\-]+)',
            r'item\s*number:?\s*([A-Z0-9\-]+)',
            r'SKU:?\s*([A-Z0-9\-]+)'
        ]
        
        for pattern in code_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                structured_content['product_info']['product_code'] = match.group(1)
                break
        
        # Extract technical properties
        property_patterns = [
            r'PEI:?\s*([IVX\d]+)',
            r'R-rating:?\s*(R\d+)',
            r'slip resistance:?\s*([A-Z0-9]+)'
        ]
        
        for pattern in property_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                property_value = match.group(0)
                structured_content['material_properties'].append(property_value)
        
        # Extract key-value pairs
        kv_pattern = r'([a-zA-Z\s]+):\s*(.+?)(?=\n|$)'
        for match in re.finditer(kv_pattern, text):
            key = match.group(1).strip()
            value = match.group(2).strip()
            structured_content['fields'][key] = value
        
        return structured_content
    
    def __del__(self):
        """Clean up resources on deletion"""
        # Clean up temporary directory if we created one
        if self.config['cache_dir'] and 'thepipe_cache_' in self.config['cache_dir']:
            try:
                shutil.rmtree(self.config['cache_dir'], ignore_errors=True)
            except Exception as e:
                pass
    
    @staticmethod
    def is_available() -> bool:
        """Check if thepipe is available"""
        return THEPIPE_AVAILABLE


def main():
    """Main function for standalone usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description="thepipe Engine for Structured Information Extraction")
    parser.add_argument("image_path", help="Path to the image file")
    parser.add_argument("--output-dir", help="Output directory for results")
    parser.add_argument("--pipeline-type", default="material_specs", 
                       choices=["material_specs", "form", "generic"],
                       help="Type of pipeline to use")
    parser.add_argument("--fallback", action="store_true", 
                       help="Enable fallback to Tesseract if thepipe fails")
    
    args = parser.parse_args()
    
    # Create configuration
    config = {
        'pipeline_type': args.pipeline_type,
        'fallback_to_tesseract': args.fallback
    }
    
    # Create engine
    engine = ThePipeEngine(config)
    
    # Process image
    result = engine.process_image(args.image_path, args.output_dir)
    
    # Print result summary
    print(json.dumps({
        'image': os.path.basename(args.image_path),
        'engine': result.get('engine', 'unknown'),
        'confidence': result.get('confidence', 0.0),
        'processing_time': result.get('processing_time', 0.0),
        'text_length': len(result.get('text', '')),
        'field_count': len(result.get('structured_content', {}).get('fields', {})),
        'has_error': 'error' in result
    }, indent=2))


if __name__ == "__main__":
    main()