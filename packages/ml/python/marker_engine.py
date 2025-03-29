#!/usr/bin/env python3
"""
Marker Engine for Neural OCR

This module provides integration with VikParuchuri's Marker for layout-preserving
document understanding and text extraction.

Marker excels at:
1. Preserving complex document layouts
2. Handling multi-column content
3. Processing documents with mixed text and images
4. Maintaining text flow and relationships
5. Working with real-world documents that have irregular formatting

The engine integrates with the neural_ocr_orchestrator.py module to provide
specialized processing capabilities for material datasheets with complex layouts.
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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import Marker dependencies with graceful fallback
MARKER_AVAILABLE = False
try:
    import torch
    from PIL import Image
    
    # Check if Marker is installed
    try:
        import marker
        from marker import document_to_markdown
        from marker.models import DocumentAnalysisModel
        
        MARKER_AVAILABLE = True
        logger.info("Marker dependencies loaded successfully")
    except ImportError:
        logger.warning("Marker package not found. Marker-specific functionality will be disabled.")
        logger.warning("Install Marker using: pip install marker-ocr")
except ImportError as e:
    logger.warning(f"Required dependencies for Marker not available: {e}")
    logger.warning("Marker engine will fall back to alternative processing methods")


class MarkerEngine:
    """
    Engine for processing documents with Marker for layout-preserving OCR
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the Marker engine
        
        Args:
            config: Configuration dictionary with settings
        """
        self.config = {
            'model_path': None,  # Path to custom Marker model
            'model_type': 'standard',  # or 'fast', 'accurate'
            'preserve_layout': True,  # Preserve document layout
            'multi_column_detection': True,  # Detect multiple columns
            'max_image_size': (1280, 1280),  # Max input image dimensions
            'force_cpu': False,  # Force CPU even if GPU is available
            'fallback_to_tesseract': True,  # Fallback to Tesseract if Marker fails
            'confidence_threshold': 0.5,  # Min confidence threshold
            'output_format': 'markdown',  # Output format (markdown or text)
            'device': None  # Auto-detect device
        }
        
        if config:
            self.config.update(config)
        
        # Check if Marker is available
        self.marker_available = MARKER_AVAILABLE
        
        # Only initialize if Marker is available
        if MARKER_AVAILABLE:
            self._init_marker_model()
        else:
            logger.warning("Initializing Marker engine with limited functionality")
            self._init_fallback_methods()
    
    def _init_marker_model(self):
        """Initialize the Marker model"""
        try:
            # Set up device configuration
            if self.config['device']:
                device = self.config['device']
            elif self.config['force_cpu']:
                device = torch.device('cpu')
                logger.info("Forcing CPU for Marker model")
            else:
                if torch.cuda.is_available():
                    device = torch.device('cuda')
                    logger.info("Using CUDA for Marker model")
                else:
                    device = torch.device('cpu')
                    logger.info("CUDA not available, using CPU for Marker model")
            
            # Determine model type
            model_type = self.config['model_type']
            
            # Load model
            logger.info(f"Loading Marker model: {model_type}")
            self.model = DocumentAnalysisModel.from_pretrained(
                model_type,
                device=device
            )
            
            logger.info("Marker model loaded successfully")
            
            # Set model parameters
            self.device = device
            
        except Exception as e:
            logger.error(f"Failed to initialize Marker model: {e}")
            self.marker_available = False
            self._init_fallback_methods()
    
    def _init_fallback_methods(self):
        """Initialize fallback methods if Marker is not available"""
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
        Process an image with Marker
        
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
        if self.marker_available:
            result = self._process_with_marker(image_path, output_dir)
        else:
            result = self._process_with_fallback(image_path, output_dir)
        
        # Add processing time
        processing_time = time.time() - start_time
        result['processing_time'] = processing_time
        
        # Add metadata
        result['engine'] = 'marker' if self.marker_available else 'fallback'
        result['image_path'] = image_path
        
        # Save result if output directory is specified
        if output_dir:
            basename = os.path.basename(image_path)
            result_path = os.path.join(output_dir, f"{Path(basename).stem}_marker.json")
            with open(result_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
        
        return result
    
    def _process_with_marker(self, image_path: str, output_dir: str = None) -> Dict[str, Any]:
        """
        Process an image with Marker model
        
        Args:
            image_path: Path to the image file
            output_dir: Optional output directory for results
            
        Returns:
            Dictionary with processing results
        """
        try:
            # Load and prepare the image
            image = Image.open(image_path).convert('RGB')
            
            # Resize if needed
            max_w, max_h = self.config['max_image_size']
            if image.width > max_w or image.height > max_h:
                # Maintain aspect ratio
                ratio = min(max_w / image.width, max_h / image.height)
                new_size = (int(image.width * ratio), int(image.height * ratio))
                image = image.resize(new_size, Image.LANCZOS)
            
            # Process with Marker
            logger.info(f"Processing {image_path} with Marker")
            
            # Convert to layout-preserved markdown
            markdown = document_to_markdown(
                document=image,
                model=self.model,
                multi_column=self.config['multi_column_detection'],
                preserve_layout=self.config['preserve_layout']
            )
            
            # Extract structured content
            structured_content = self._extract_structured_content(markdown)
            
            # Calculate confidence (in Marker this is a placeholder since it doesn't provide confidence)
            # In a real implementation, this would use model-specific metrics
            confidence = 0.85  # Default confidence for Marker
            
            # Create result
            result = {
                'text': markdown,
                'structured_content': structured_content,
                'confidence': confidence
            }
            
            # Save output if directory is specified
            if output_dir:
                # Save the processed text
                text_path = os.path.join(output_dir, f"{Path(image_path).stem}_marker.md")
                with open(text_path, 'w', encoding='utf-8') as f:
                    f.write(markdown)
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing image with Marker: {e}")
            
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
    
    def _extract_structured_content(self, text: str) -> Dict[str, Any]:
        """
        Extract structured content from Marker output
        
        Args:
            text: Text generated by Marker
            
        Returns:
            Dictionary with structured content extraction
        """
        # Extract structured content from the markdown output
        structured_content = {
            'headings': [],
            'paragraphs': [],
            'tables': [],
            'lists': []
        }
        
        # Extract headings (# Heading)
        import re
        heading_pattern = r'^(#{1,6})\s+(.+?)$'
        for match in re.finditer(heading_pattern, text, re.MULTILINE):
            level = len(match.group(1))
            heading_text = match.group(2).strip()
            structured_content['headings'].append({
                'level': level,
                'text': heading_text
            })
        
        # Extract paragraphs (text blocks not matching other patterns)
        paragraph_pattern = r'(?:^|\n\n)([^#\n\-\*\|][^\n]+(?:\n[^\n#\-\*\|][^\n]+)*)(?:\n\n|$)'
        for match in re.finditer(paragraph_pattern, text, re.DOTALL):
            paragraph_text = match.group(1).strip()
            if paragraph_text:
                structured_content['paragraphs'].append({
                    'text': paragraph_text
                })
        
        # Extract tables (markdown tables)
        table_pattern = r'(\|.+\|\n\|[-:| ]+\|\n(\|.+\|\n)+)'
        for match in re.finditer(table_pattern, text, re.MULTILINE):
            table_text = match.group(1)
            structured_content['tables'].append({
                'text': table_text,
                'data': self._parse_markdown_table(table_text)
            })
        
        # Extract lists (bullet and numbered)
        list_pattern = r'((?:^[*\-+]\s+.+\n)+|(?:^\d+\.\s+.+\n)+)'
        for match in re.finditer(list_pattern, text, re.MULTILINE):
            list_text = match.group(1)
            is_numbered = bool(re.match(r'^\d+\.', list_text))
            
            # Split into items
            if is_numbered:
                items = re.findall(r'^\d+\.\s+(.+)$', list_text, re.MULTILINE)
            else:
                items = re.findall(r'^[*\-+]\s+(.+)$', list_text, re.MULTILINE)
            
            structured_content['lists'].append({
                'type': 'numbered' if is_numbered else 'bullet',
                'items': items
            })
        
        return structured_content
    
    def _parse_markdown_table(self, table_text: str) -> List[List[str]]:
        """
        Parse a markdown table into a 2D array
        
        Args:
            table_text: Markdown table text
            
        Returns:
            2D array of table cells
        """
        lines = table_text.strip().split('\n')
        
        # At least 3 lines needed for a valid table (header, separator, content)
        if len(lines) < 3:
            return []
        
        # Skip the separator line
        data_lines = [lines[0]] + lines[2:]
        
        # Parse each line into cells
        table_data = []
        for line in data_lines:
            # Strip outer pipes and split by pipe
            cells = line.strip('|').split('|')
            # Clean up each cell
            cells = [cell.strip() for cell in cells]
            table_data.append(cells)
        
        return table_data
    
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
                
                # Create result
                result = {
                    'text': text,
                    'structured_content': {},  # No structured content with basic Tesseract
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
    
    @staticmethod
    def is_available() -> bool:
        """Check if Marker is available"""
        return MARKER_AVAILABLE


def main():
    """Main function for standalone usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Marker Engine for Layout-Preserving OCR")
    parser.add_argument("image_path", help="Path to the image file")
    parser.add_argument("--output-dir", help="Output directory for results")
    parser.add_argument("--model-type", default="standard", 
                       choices=["standard", "fast", "accurate"],
                       help="Type of Marker model to use")
    parser.add_argument("--force-cpu", action="store_true", 
                       help="Force CPU even if GPU is available")
    parser.add_argument("--no-layout", action="store_true", 
                       help="Disable layout preservation")
    parser.add_argument("--no-multicolumn", action="store_true", 
                       help="Disable multi-column detection")
    parser.add_argument("--fallback", action="store_true", 
                       help="Enable fallback to Tesseract if Marker fails")
    
    args = parser.parse_args()
    
    # Create configuration
    config = {
        'model_type': args.model_type,
        'force_cpu': args.force_cpu,
        'preserve_layout': not args.no_layout,
        'multi_column_detection': not args.no_multicolumn,
        'fallback_to_tesseract': args.fallback
    }
    
    # Create engine
    engine = MarkerEngine(config)
    
    # Process image
    result = engine.process_image(args.image_path, args.output_dir)
    
    # Print result summary
    print(json.dumps({
        'image': os.path.basename(args.image_path),
        'engine': result.get('engine', 'unknown'),
        'confidence': result.get('confidence', 0.0),
        'processing_time': result.get('processing_time', 0.0),
        'text_length': len(result.get('text', '')),
        'has_error': 'error' in result
    }, indent=2))


if __name__ == "__main__":
    main()