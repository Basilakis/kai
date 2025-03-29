#!/usr/bin/env python3
"""
Nougat Engine for Neural OCR

This module provides integration with Meta's Nougat model for advanced document understanding,
specialized for scientific and technical content with complex layouts.

Nougat (Neural Optical Understanding for Academic Documents) excels at:
1. Understanding complex scientific and technical layouts
2. Processing mathematical formulas and equations
3. Preserving document structure and hierarchy
4. Handling tables with merged cells and complex structure
5. Processing technical diagrams with labels

The engine integrates with the neural_ocr_orchestrator.py module to provide specialized
processing capabilities for technical material datasheets.
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

# Import Nougat dependencies with graceful fallback
NOUGAT_AVAILABLE = False
try:
    import torch
    from PIL import Image
    
    # Check if Nougat is installed
    try:
        import nougat
        from nougat.utils.checkpoint import get_checkpoint
        from nougat.utils.device import parse_args, get_device
        from nougat.dataset.rasterize import rasterize_paper
        from nougat.postprocessing import markdown_compatible, close_envs
        from nougat.model import load_model
        
        NOUGAT_AVAILABLE = True
        logger.info("Nougat dependencies loaded successfully")
    except ImportError:
        logger.warning("Nougat package not found. Nougat-specific functionality will be disabled.")
        logger.warning("Install Nougat using: pip install nougat-ocr")
except ImportError as e:
    logger.warning(f"Required dependencies for Nougat not available: {e}")
    logger.warning("Nougat engine will fall back to alternative processing methods")


class NougatEngine:
    """
    Engine for processing documents with Meta's Nougat model
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the Nougat engine
        
        Args:
            config: Configuration dictionary with settings
        """
        self.config = {
            'model_path': None,  # Path to custom Nougat model
            'model_type': 'nougat-base',  # or 'nougat-small'
            'batch_size': 1,
            'half_precision': True,  # Use half precision for faster inference
            'max_image_size': (1280, 1280),  # Max input image dimensions
            'force_cpu': False,  # Force CPU even if GPU is available
            'fallback_to_tesseract': True,  # Fallback to Tesseract if Nougat fails
            'postprocessing': True,  # Apply Nougat postprocessing
            'output_format': 'markdown',  # Output in markdown format
            'confidence_threshold': 0.5  # Min confidence threshold for acceptance
        }
        
        if config:
            self.config.update(config)
        
        # Check if Nougat is available
        self.nougat_available = NOUGAT_AVAILABLE
        
        # Only initialize if Nougat is available
        if NOUGAT_AVAILABLE:
            self._init_nougat_model()
        else:
            logger.warning("Initializing Nougat engine with limited functionality")
            self._init_fallback_methods()
    
    def _init_nougat_model(self):
        """Initialize the Nougat model"""
        try:
            # Set up device configuration
            if self.config['force_cpu']:
                device = torch.device('cpu')
                logger.info("Forcing CPU for Nougat model")
            else:
                if torch.cuda.is_available():
                    device = torch.device('cuda')
                    logger.info("Using CUDA for Nougat model")
                else:
                    device = torch.device('cpu')
                    logger.info("CUDA not available, using CPU for Nougat model")
            
            # Determine model path
            if self.config['model_path']:
                model_path = self.config['model_path']
            else:
                # Use default model from Nougat
                model_path = self.config['model_type']
            
            # Load model
            logger.info(f"Loading Nougat model: {model_path}")
            
            ckpt = get_checkpoint(model_path)
            self.model, self.processor = load_model(
                ckpt, 
                device=device, 
                dtype=torch.float16 if self.config['half_precision'] else torch.float32
            )
            
            # Set model to evaluation mode
            self.model.eval()
            logger.info("Nougat model loaded successfully")
            
            # Set model parameters
            self.device = device
            
        except Exception as e:
            logger.error(f"Failed to initialize Nougat model: {e}")
            self.nougat_available = False
            self._init_fallback_methods()
    
    def _init_fallback_methods(self):
        """Initialize fallback methods if Nougat is not available"""
        # In a real implementation, this would import and set up alternative
        # OCR methods, such as Tesseract or other available options
        
        # For now, we'll just log a warning
        logger.warning("Initializing fallback OCR methods for Nougat engine")
        
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
        Process an image with Nougat
        
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
        if self.nougat_available:
            result = self._process_with_nougat(image_path, output_dir)
        else:
            result = self._process_with_fallback(image_path, output_dir)
        
        # Add processing time
        processing_time = time.time() - start_time
        result['processing_time'] = processing_time
        
        # Add metadata
        result['engine'] = 'nougat' if self.nougat_available else 'fallback'
        result['image_path'] = image_path
        
        # Save result if output directory is specified
        if output_dir:
            basename = os.path.basename(image_path)
            result_path = os.path.join(output_dir, f"{Path(basename).stem}_nougat.json")
            with open(result_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
        
        return result
    
    def _process_with_nougat(self, image_path: str, output_dir: str = None) -> Dict[str, Any]:
        """
        Process an image with Nougat model
        
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
            
            # Process with Nougat
            logger.info(f"Processing {image_path} with Nougat")
            
            # Prepare input tensors
            inputs = self.processor(image, return_tensors="pt").to(self.device)
            
            # Generate output
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_length=self.model.config.max_length,
                )
            
            # Decode the generated text
            decoded_text = self.processor.batch_decode(outputs, skip_special_tokens=True)[0]
            
            # Apply post-processing if configured
            if self.config['postprocessing']:
                if self.config['output_format'] == 'markdown':
                    decoded_text = markdown_compatible(decoded_text)
                decoded_text = close_envs(decoded_text)
            
            # Extract structured content
            structured_content = self._extract_structured_content(decoded_text)
            
            # Calculate confidence (in Nougat this is a placeholder since it doesn't provide confidence)
            # In a real implementation, this would use model-specific metrics
            confidence = 0.85  # Default high confidence for Nougat on technical docs
            
            # Create result
            result = {
                'text': decoded_text,
                'structured_content': structured_content,
                'confidence': confidence
            }
            
            # Save output if directory is specified
            if output_dir:
                # Save the processed text
                text_path = os.path.join(output_dir, f"{Path(image_path).stem}_nougat.md")
                with open(text_path, 'w', encoding='utf-8') as f:
                    f.write(decoded_text)
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing image with Nougat: {e}")
            
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
        Extract structured content from Nougat output
        
        Args:
            text: Text generated by Nougat
            
        Returns:
            Dictionary with structured content extraction
        """
        # In a real implementation, this would parse Nougat output to extract:
        # - Tables
        # - Equations
        # - Section headers
        # - Technical specifications
        # - Etc.
        
        # Simple extraction based on markdown syntax
        structured_content = {
            'headings': [],
            'tables': [],
            'equations': [],
            'code_blocks': []
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
        
        # Extract tables (markdown tables)
        table_pattern = r'(\|.+\|\n\|[-:| ]+\|\n(\|.+\|\n)+)'
        for match in re.finditer(table_pattern, text, re.MULTILINE):
            table_text = match.group(1)
            structured_content['tables'].append({
                'text': table_text,
                'data': self._parse_markdown_table(table_text)
            })
        
        # Extract equations ($ ... $ or $$ ... $$)
        equation_pattern = r'\$\$(.*?)\$\$|\$(.*?)\$'
        for match in re.finditer(equation_pattern, text, re.DOTALL):
            eq_text = match.group(1) or match.group(2)
            structured_content['equations'].append({
                'text': eq_text,
                'inline': match.group(2) is not None  # True if $ ... $, False if $$ ... $$
            })
        
        # Extract code blocks (```...```)
        code_pattern = r'```(\w*)\n(.*?)```'
        for match in re.finditer(code_pattern, text, re.DOTALL):
            language = match.group(1)
            code = match.group(2)
            structured_content['code_blocks'].append({
                'language': language,
                'code': code
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
        """Check if Nougat is available"""
        return NOUGAT_AVAILABLE


def main():
    """Main function for standalone usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Nougat Engine for Neural OCR")
    parser.add_argument("image_path", help="Path to the image file")
    parser.add_argument("--output-dir", help="Output directory for results")
    parser.add_argument("--model", default=None, help="Path to custom Nougat model")
    parser.add_argument("--model-type", default="nougat-base", 
                       choices=["nougat-base", "nougat-small"],
                       help="Type of Nougat model to use")
    parser.add_argument("--force-cpu", action="store_true", 
                       help="Force CPU even if GPU is available")
    parser.add_argument("--no-half-precision", action="store_true", 
                       help="Disable half precision (slower but may be more accurate)")
    parser.add_argument("--fallback", action="store_true", 
                       help="Enable fallback to Tesseract if Nougat fails")
    
    args = parser.parse_args()
    
    # Create configuration
    config = {
        'model_path': args.model,
        'model_type': args.model_type,
        'force_cpu': args.force_cpu,
        'half_precision': not args.no_half_precision,
        'fallback_to_tesseract': args.fallback
    }
    
    # Create engine
    engine = NougatEngine(config)
    
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