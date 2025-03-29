#!/usr/bin/env python3
"""
Additional OCR Engine Adapters

This module provides adapters for additional document understanding engines:
1. PaddleOCR - Baidu's multilingual OCR toolkit
2. pdfdeal - NoEdgeAI's PDF processing solution
3. surya - VikParuchuri's document understanding system
4. mPLUG-DocOwl - X-PLUG's multimodal document understanding model

These adapters integrate with the extensible_engine_manager framework
to expand the neural OCR system's capabilities.
"""

import os
import sys
import json
import logging
import time
from typing import Dict, List, Any, Tuple, Optional, Union
from pathlib import Path
import numpy as np

# Import base components from extensible engine manager
from extensible_engine_manager import (
    OCREngineInterface,
    EngineMetadata,
    EngineResult,
    ModelType,
    EngineAdapter
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class PaddleOCREngine(EngineAdapter):
    """
    Adapter for Baidu's PaddleOCR engine
    
    PaddleOCR provides multilingual, structured text recognition with
    specialized capabilities for tables, forms, and dense text.
    """
    
    def __init__(self):
        """Initialize the PaddleOCR adapter"""
        super().__init__(
            engine_name="paddleocr",
            engine_version="2.6.0",
            model_type=ModelType.OCR
        )
        
        self.paddle_ocr = None
        self.table_engine = None
        self.structure_engine = None
        self.language = "en"
        
    def _initialize_implementation(self) -> bool:
        """
        Initialize the PaddleOCR implementation
        
        Returns:
            True if initialization succeeded, False otherwise
        """
        try:
            # Import PaddleOCR
            from paddleocr import PaddleOCR, PPStructure
            
            # Get configuration
            use_gpu = self.config.get('use_gpu', False)
            self.language = self.config.get('language', 'en')
            enable_table = self.config.get('enable_table', True)
            enable_layout = self.config.get('enable_layout', True)
            
            # Initialize PaddleOCR with detection and recognition
            self.paddle_ocr = PaddleOCR(
                use_gpu=use_gpu,
                lang=self.language,
                show_log=False
            )
            
            # Initialize structure recognition if enabled
            if enable_table or enable_layout:
                self.structure_engine = PPStructure(
                    table=enable_table,
                    ocr=True,
                    layout=enable_layout,
                    use_gpu=use_gpu,
                    show_log=False
                )
            
            logger.info(f"PaddleOCR initialized with language: {self.language}")
            return True
            
        except ImportError:
            logger.error("PaddleOCR not available. Install with 'pip install paddleocr'")
            return False
        except Exception as e:
            logger.error(f"Error initializing PaddleOCR: {e}")
            return False
    
    def _process_document_implementation(self, document_path: str, options: Dict[str, Any]) -> EngineResult:
        """
        Process a document with PaddleOCR
        
        Args:
            document_path: Path to the document
            options: Processing options
            
        Returns:
            EngineResult object
        """
        try:
            # Check if document is an image or PDF
            ext = os.path.splitext(document_path)[1].lower()
            
            if ext == '.pdf':
                return self._process_pdf(document_path, options)
            else:
                # Process as image
                return self._process_image_file(document_path, options)
            
        except Exception as e:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error=str(e)
            )
    
    def _process_pdf(self, pdf_path: str, options: Dict[str, Any]) -> EngineResult:
        """Process a PDF document"""
        try:
            import fitz  # PyMuPDF
            
            # Extract pages as images
            doc = fitz.open(pdf_path)
            pages_results = []
            
            for page_idx in range(len(doc)):
                # Get page
                page = doc.load_page(page_idx)
                
                # Convert to image
                pix = page.get_pixmap(alpha=False)
                img_data = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
                    pix.height, pix.width, pix.n
                )
                
                # Process the page image
                page_result = self._process_image(img_data, options)
                
                if page_result.success:
                    # Add page number metadata
                    page_data = page_result.data
                    page_data['page_num'] = page_idx + 1
                    pages_results.append(page_data)
            
            # Combine results from all pages
            combined_result = {
                'pages': pages_results,
                'document_type': 'pdf',
                'page_count': len(doc),
                'language': self.language
            }
            
            return EngineResult(
                engine_name=self.engine_name,
                success=True,
                result_type="document",
                data=combined_result,
                confidence=0.9  # Aggregate confidence
            )
            
        except ImportError:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error="PyMuPDF (fitz) not available. Install with 'pip install pymupdf'"
            )
            
        except Exception as e:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error=f"Error processing PDF: {str(e)}"
            )
    
    def _process_image_file(self, image_path: str, options: Dict[str, Any]) -> EngineResult:
        """Process an image file"""
        try:
            import cv2
            
            # Read image
            img = cv2.imread(image_path)
            if img is None:
                return EngineResult(
                    engine_name=self.engine_name,
                    success=False,
                    result_type="error",
                    data=None,
                    error=f"Failed to read image: {image_path}"
                )
            
            # Convert BGR to RGB
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            
            # Process image
            return self._process_image(img_rgb, options)
            
        except Exception as e:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error=f"Error processing image: {str(e)}"
            )
    
    def _process_image(self, image: np.ndarray, options: Dict[str, Any]) -> EngineResult:
        """Process an image with PaddleOCR"""
        try:
            # Check if structure analysis is requested
            use_structure = options.get('use_structure', True) and self.structure_engine is not None
            
            if use_structure:
                # Process with structure engine (tables + layout)
                result = self.structure_engine(image)
                
                # Convert to standardized format
                structured_result = self._convert_structure_result(result)
                
                return EngineResult(
                    engine_name=self.engine_name,
                    success=True,
                    result_type="structured",
                    data=structured_result,
                    confidence=0.9
                )
            else:
                # Basic OCR processing
                result = self.paddle_ocr.ocr(image, cls=True)
                
                # Convert to standardized format
                ocr_result = self._convert_ocr_result(result)
                
                return EngineResult(
                    engine_name=self.engine_name,
                    success=True,
                    result_type="text",
                    data=ocr_result,
                    confidence=0.85
                )
                
        except Exception as e:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error=f"Error in PaddleOCR processing: {str(e)}"
            )
    
    def _convert_ocr_result(self, result) -> Dict[str, Any]:
        """Convert PaddleOCR result to standardized format"""
        elements = []
        full_text = ""
        
        # Process each detected text region
        for line in result:
            for detection in line:
                # PaddleOCR format: [[[x1,y1],[x2,y2],[x3,y3],[x4,y4]], (text, confidence)]
                bbox = detection[0]
                text, confidence = detection[1]
                
                # Standardize bbox to (x1, y1, x2, y2) format
                x_coords = [point[0] for point in bbox]
                y_coords = [point[1] for point in bbox]
                std_bbox = (
                    min(x_coords), min(y_coords),
                    max(x_coords), max(y_coords)
                )
                
                # Create element
                element = {
                    'text': text,
                    'confidence': float(confidence),
                    'bbox': std_bbox,
                    'type': 'text'
                }
                
                elements.append(element)
                full_text += text + " "
        
        return {
            'elements': elements,
            'text': full_text.strip(),
            'element_count': len(elements)
        }
    
    def _convert_structure_result(self, result) -> Dict[str, Any]:
        """Convert PPStructure result to standardized format"""
        elements = []
        tables = []
        full_text = ""
        
        # Process each structure element
        for item in result:
            item_type = item.get('type', 'text')
            
            if item_type == 'table':
                # Process table
                table_data = {
                    'bbox': item.get('bbox', (0, 0, 0, 0)),
                    'cells': [],
                    'structure': {
                        'rows': len(item.get('res', {}).get('cells', [])),
                        'columns': len(item.get('res', {}).get('cells', [0])) if item.get('res', {}).get('cells') else 0
                    }
                }
                
                # Process cells
                for row_idx, row in enumerate(item.get('res', {}).get('cells', [])):
                    for col_idx, cell in enumerate(row):
                        cell_data = {
                            'row': row_idx,
                            'col': col_idx,
                            'text': cell.get('text', ''),
                            'bbox': cell.get('bbox', (0, 0, 0, 0)),
                            'merged': False  # Set true for merged cells
                        }
                        table_data['cells'].append(cell_data)
                
                tables.append(table_data)
                elements.append({
                    'type': 'table',
                    'bbox': item.get('bbox', (0, 0, 0, 0)),
                    'confidence': 0.9,
                    'table_id': len(tables) - 1
                })
                
            elif item_type == 'text':
                # Process text block
                text = item.get('text', {}).get('text', '')
                full_text += text + " "
                
                elements.append({
                    'type': 'text',
                    'text': text,
                    'bbox': item.get('bbox', (0, 0, 0, 0)),
                    'confidence': 0.85
                })
        
        return {
            'elements': elements,
            'tables': tables,
            'text': full_text.strip(),
            'element_count': len(elements),
            'table_count': len(tables)
        }
    
    def _process_image_implementation(self, image_data: Any, options: Dict[str, Any]) -> EngineResult:
        """
        Process an image with PaddleOCR
        
        Args:
            image_data: Image data (numpy array, PIL Image, or path)
            options: Processing options
            
        Returns:
            EngineResult object
        """
        try:
            # Convert image data to numpy array if needed
            if isinstance(image_data, str):
                # Path to image file
                import cv2
                img = cv2.imread(image_data)
                img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            elif hasattr(image_data, 'convert'):
                # PIL Image
                img = np.array(image_data)
            else:
                # Assume numpy array
                img = image_data
            
            # Process the image
            return self._process_image(img, options)
            
        except Exception as e:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error=f"Error processing image: {str(e)}"
            )
    
    def _get_description(self) -> str:
        """Get engine description"""
        return "PaddleOCR: Baidu's multilingual OCR toolkit with table and layout recognition"
    
    def _get_author(self) -> str:
        """Get engine author"""
        return "PaddlePaddle Team (Baidu)"
    
    def _get_repository(self) -> str:
        """Get engine repository"""
        return "https://github.com/PaddlePaddle/PaddleOCR"
    
    def _get_license(self) -> str:
        """Get engine license"""
        return "Apache-2.0"
    
    def _get_requirements(self) -> List[str]:
        """Get engine requirements"""
        return ["paddlepaddle>=2.0.0", "paddleocr>=2.6.0", "opencv-python>=4.1.1"]
    
    def _get_supported_formats(self) -> List[str]:
        """Get supported file formats"""
        return ["pdf", "png", "jpg", "jpeg", "tiff", "tif", "bmp"]
    
    def _get_supported_languages(self) -> List[str]:
        """Get supported languages"""
        return [
            "ch", "en", "french", "german", "korean", "japanese",
            "chinese_cht", "arabic", "cyrillic", "devanagari", "latin"
        ]
    
    def _get_tags(self) -> List[str]:
        """Get engine tags"""
        return [
            "ocr", "multilingual", "tables", "layout", "forms",
            "paddlepaddle", "structured"
        ]


class PdfDealEngine(EngineAdapter):
    """
    Adapter for NoEdgeAI's pdfdeal engine
    
    pdfdeal provides PDF-native processing without image conversion,
    preserving document structure and formatting.
    """
    
    def __init__(self):
        """Initialize the pdfdeal adapter"""
        super().__init__(
            engine_name="pdfdeal",
            engine_version="0.2.0",
            model_type=ModelType.DOCUMENT_UNDERSTANDING
        )
        
        self.pdfdeal = None
        self.processor = None
    
    def _initialize_implementation(self) -> bool:
        """
        Initialize the pdfdeal implementation
        
        Returns:
            True if initialization succeeded, False otherwise
        """
        try:
            # Import pdfdeal
            import pdfdeal
            from pdfdeal import PdfProcessor
            
            # Get configuration
            model_type = self.config.get('model_type', 'base')
            
            # Initialize processor
            self.processor = PdfProcessor(model_type=model_type)
            self.pdfdeal = pdfdeal
            
            logger.info(f"pdfdeal initialized with model: {model_type}")
            return True
            
        except ImportError:
            logger.error("pdfdeal not available. Install from https://github.com/NoEdgeAI/pdfdeal")
            return False
        except Exception as e:
            logger.error(f"Error initializing pdfdeal: {e}")
            return False
    
    def _process_document_implementation(self, document_path: str, options: Dict[str, Any]) -> EngineResult:
        """
        Process a document with pdfdeal
        
        Args:
            document_path: Path to the document
            options: Processing options
            
        Returns:
            EngineResult object
        """
        try:
            # Check if document is a PDF
            ext = os.path.splitext(document_path)[1].lower()
            
            if ext != '.pdf':
                return EngineResult(
                    engine_name=self.engine_name,
                    success=False,
                    result_type="error",
                    data=None,
                    error=f"pdfdeal only supports PDF files, got: {ext}"
                )
            
            # Process PDF document
            extract_tables = options.get('extract_tables', True)
            extract_figures = options.get('extract_figures', True)
            output_format = options.get('output_format', 'structured')
            
            # Process the PDF
            result = self.processor.process(
                document_path,
                extract_tables=extract_tables,
                extract_figures=extract_figures
            )
            
            # Convert to standardized format
            if output_format == 'structured':
                structured_data = self._convert_to_structured(result)
                
                return EngineResult(
                    engine_name=self.engine_name,
                    success=True,
                    result_type="structured",
                    data=structured_data,
                    confidence=0.95
                )
            else:
                # Return raw text
                text = self._extract_text(result)
                
                return EngineResult(
                    engine_name=self.engine_name,
                    success=True,
                    result_type="text",
                    data=text,
                    confidence=0.9
                )
            
        except Exception as e:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error=f"Error processing PDF with pdfdeal: {str(e)}"
            )
    
    def _convert_to_structured(self, result) -> Dict[str, Any]:
        """Convert pdfdeal result to standardized structured format"""
        pages = []
        
        for page_idx, page in enumerate(result.pages):
            elements = []
            tables = []
            figures = []
            
            # Process text blocks
            for block in page.blocks:
                elements.append({
                    'type': 'text',
                    'text': block.text,
                    'bbox': block.bbox,
                    'confidence': 0.95,
                    'font': block.font_info
                })
            
            # Process tables
            for table_idx, table in enumerate(page.tables):
                table_data = {
                    'id': table_idx,
                    'bbox': table.bbox,
                    'rows': len(table.cells),
                    'columns': len(table.cells[0]) if table.cells else 0,
                    'cells': []
                }
                
                # Process cells
                for row_idx, row in enumerate(table.cells):
                    for col_idx, cell in enumerate(row):
                        cell_data = {
                            'row': row_idx,
                            'col': col_idx,
                            'text': cell.text,
                            'bbox': cell.bbox,
                            'rowspan': cell.rowspan,
                            'colspan': cell.colspan
                        }
                        table_data['cells'].append(cell_data)
                
                tables.append(table_data)
                elements.append({
                    'type': 'table',
                    'bbox': table.bbox,
                    'confidence': 0.9,
                    'table_id': table_idx
                })
            
            # Process figures
            for fig_idx, figure in enumerate(page.figures):
                figure_data = {
                    'id': fig_idx,
                    'bbox': figure.bbox,
                    'caption': figure.caption,
                    'image_data': figure.image_data
                }
                
                figures.append(figure_data)
                elements.append({
                    'type': 'figure',
                    'bbox': figure.bbox,
                    'confidence': 0.9,
                    'figure_id': fig_idx
                })
            
            # Create page data
            page_data = {
                'page_num': page_idx + 1,
                'elements': elements,
                'tables': tables,
                'figures': figures,
                'text': page.text,
                'width': page.width,
                'height': page.height
            }
            
            pages.append(page_data)
        
        return {
            'pages': pages,
            'document_type': 'pdf',
            'page_count': len(pages)
        }
    
    def _extract_text(self, result) -> str:
        """Extract plain text from pdfdeal result"""
        text = ""
        
        for page in result.pages:
            text += page.text + "\n\n"
        
        return text.strip()
    
    def _process_image_implementation(self, image_data: Any, options: Dict[str, Any]) -> EngineResult:
        """
        Process an image - not supported by pdfdeal
        
        Args:
            image_data: Image data
            options: Processing options
            
        Returns:
            EngineResult object with error
        """
        return EngineResult(
            engine_name=self.engine_name,
            success=False,
            result_type="error",
            data=None,
            error="pdfdeal only supports PDF files, not images"
        )
    
    def _get_description(self) -> str:
        """Get engine description"""
        return "pdfdeal: PDF-native document processing with structure preservation"
    
    def _get_author(self) -> str:
        """Get engine author"""
        return "NoEdgeAI"
    
    def _get_repository(self) -> str:
        """Get engine repository"""
        return "https://github.com/NoEdgeAI/pdfdeal"
    
    def _get_license(self) -> str:
        """Get engine license"""
        return "Apache-2.0"
    
    def _get_requirements(self) -> List[str]:
        """Get engine requirements"""
        return ["pdfdeal"]
    
    def _get_supported_formats(self) -> List[str]:
        """Get supported file formats"""
        return ["pdf"]
    
    def _get_tags(self) -> List[str]:
        """Get engine tags"""
        return ["pdf", "native", "structure", "tables", "forms", "vector"]


class SuryaEngine(EngineAdapter):
    """
    Adapter for VikParuchuri's surya engine
    
    Surya specializes in academic and scientific document understanding,
    with superior handling of complex formulas and equations.
    """
    
    def __init__(self):
        """Initialize the surya adapter"""
        super().__init__(
            engine_name="surya",
            engine_version="0.2.0",
            model_type=ModelType.DOCUMENT_UNDERSTANDING
        )
        
        self.processor = None
    
    def _initialize_implementation(self) -> bool:
        """
        Initialize the surya implementation
        
        Returns:
            True if initialization succeeded, False otherwise
        """
        try:
            # Import surya
            from surya import Surya
            
            # Get configuration
            model_type = self.config.get('model_type', 'default')
            precision = self.config.get('precision', 'float16')
            
            # Initialize processor
            self.processor = Surya(model=model_type, precision=precision)
            
            logger.info(f"surya initialized with model: {model_type}")
            return True
            
        except ImportError:
            logger.error("surya not available. Install with 'pip install surya'")
            return False
        except Exception as e:
            logger.error(f"Error initializing surya: {e}")
            return False
    
    def _process_document_implementation(self, document_path: str, options: Dict[str, Any]) -> EngineResult:
        """
        Process a document with surya
        
        Args:
            document_path: Path to the document
            options: Processing options
            
        Returns:
            EngineResult object
        """
        try:
            # Check document format
            ext = os.path.splitext(document_path)[1].lower()
            
            if ext == '.pdf':
                return self._process_pdf(document_path, options)
            else:
                # Process as image
                return self._process_image_file(document_path, options)
            
        except Exception as e:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error=f"Error in surya: {str(e)}"
            )
    
    def _process_pdf(self, pdf_path: str, options: Dict[str, Any]) -> EngineResult:
        """Process a PDF document with surya"""
        try:
            # Process with surya
            output_format = options.get('output_format', 'markdown')
            preserve_math = options.get('preserve_math', True)
            
            # Process the PDF
            result = self.processor.read_pdf(
                pdf_path,
                output_format=output_format,
                preserve_math=preserve_math
            )
            
            # Convert to structured format
            if output_format == 'markdown':
                return EngineResult(
                    engine_name=self.engine_name,
                    success=True,
                    result_type="markdown",
                    data=result,
                    confidence=0.9
                )
            else:
                # Parse structured data
                structured_data = self._parse_structured_data(result)
                
                return EngineResult(
                    engine_name=self.engine_name,
                    success=True,
                    result_type="structured",
                    data=structured_data,
                    confidence=0.92
                )
            
        except Exception as e:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error=f"Error processing PDF with surya: {str(e)}"
            )
    
    def _process_image_file(self, image_path: str, options: Dict[str, Any]) -> EngineResult:
        """Process an image with surya"""
        try:
            # Process with surya
            output_format = options.get('output_format', 'markdown')
            preserve_math = options.get('preserve_math', True)
            
            # Process the image
            result = self.processor.read_image(
                image_path,
                output_format=output_format,
                preserve_math=preserve_math
            )
            
            if output_format == 'markdown':
                return EngineResult(
                    engine_name=self.engine_name,
                    success=True,
                    result_type="markdown",
                    data=result,
                    confidence=0.9
                )
            else:
                # Parse structured data
                structured_data = self._parse_structured_data(result)
                
                return EngineResult(
                    engine_name=self.engine_name,
                    success=True,
                    result_type="structured",
                    data=structured_data,
                    confidence=0.92
                )
            
        except Exception as e:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error=f"Error processing image with surya: {str(e)}"
            )
    
    def _parse_structured_data(self, result) -> Dict[str, Any]:
        """Parse structured data from surya result"""
        # This is a placeholder - actual implementation would depend on surya's output format
        structured_data = {
            'text': result.get('text', ''),
            'elements': []
        }
        
        # Process elements (equations, tables, figures, etc.)
        for element in result.get('elements', []):
            element_type = element.get('type')
            
            if element_type == 'equation':
                structured_data['elements'].append({
                    'type': 'equation',
                    'content': element.get('content'),
                    'latex': element.get('latex'),
                    'position': element.get('position')
                })
            elif element_type == 'table':
                structured_data['elements'].append({
                    'type': 'table',
                    'content': element.get('content'),
                    'rows': element.get('rows'),
                    'columns': element.get('columns')
                })
            elif element_type == 'figure':
                structured_data['elements'].append({
                    'type': 'figure',
                    'caption': element.get('caption'),
                    'reference': element.get('reference')
                })
        
        return structured_data
    
    def _process_image_implementation(self, image_data: Any, options: Dict[str, Any]) -> EngineResult:
        """
        Process an image with surya
        
        Args:
            image_data: Image data (PIL Image or bytes)
            options: Processing options
            
        Returns:
            EngineResult object
        """
        try:
            # Save image to temporary file
            import tempfile
            from PIL import Image
            
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                temp_path = tmp.name
                
                if hasattr(image_data, 'save'):
                    # PIL Image
                    image_data.save(temp_path)
                elif isinstance(image_data, bytes):
                    # Bytes
                    tmp.write(image_data)
                elif isinstance(image_data, np.ndarray):
                    # Numpy array
                    Image.fromarray(image_data).save(temp_path)
                else:
                    raise ValueError(f"Unsupported image data type: {type(image_data)}")
            
            # Process the image
            result = self._process_image_file(temp_path, options)
            
            # Remove temporary file
            try:
                os.unlink(temp_path)
            except:
                pass
            
            return result
            
        except Exception as e:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error=f"Error processing image with surya: {str(e)}"
            )
    
    def _get_description(self) -> str:
        """Get engine description"""
        return "surya: Advanced scientific document understanding with formula recognition"
    
    def _get_author(self) -> str:
        """Get engine author"""
        return "VikParuchuri"
    
    def _get_repository(self) -> str:
        """Get engine repository"""
        return "https://github.com/VikParuchuri/surya"
    
    def _get_license(self) -> str:
        """Get engine license"""
        return "AGPL-3.0"
    
    def _get_requirements(self) -> List[str]:
        """Get engine requirements"""
        return ["surya", "torch>=2.0.0", "transformers>=4.28.0"]
    
    def _get_supported_formats(self) -> List[str]:
        """Get supported file formats"""
        return ["pdf", "png", "jpg", "jpeg"]
    
    def _get_tags(self) -> List[str]:
        """Get engine tags"""
        return ["scientific", "academic", "formulas", "equations", "math", "markdown"]


class MplugDocOwlEngine(EngineAdapter):
    """
    Adapter for X-PLUG's mPLUG-DocOwl engine
    
    mPLUG-DocOwl provides multimodal document understanding with
    vision-language capabilities for complex visual-textual relationships.
    """
    
    def __init__(self):
        """Initialize the mPLUG-DocOwl adapter"""
        super().__init__(
            engine_name="mplug_docowl",
            engine_version="1.0.0",
            model_type=ModelType.DOCUMENT_UNDERSTANDING
        )
        
        self.processor = None
        self.model = None
        self.device = "cpu"
    
    def _initialize_implementation(self) -> bool:
        """
        Initialize the mPLUG-DocOwl implementation
        
        Returns:
            True if initialization succeeded, False otherwise
        """
        try:
            # Import required libraries
            import torch
            from transformers import MplugDocOwlProcessor, MplugDocOwlForConditionalGeneration
            
            # Get configuration
            model_name = self.config.get('model_name', 'X-PLUG/mPLUG-DocOwl')
            use_gpu = self.config.get('use_gpu', torch.cuda.is_available())
            
            # Set device
            self.device = "cuda" if use_gpu and torch.cuda.is_available() else "cpu"
            
            # Initialize model and processor
            self.processor = MplugDocOwlProcessor.from_pretrained(model_name)
            self.model = MplugDocOwlForConditionalGeneration.from_pretrained(model_name).to(self.device)
            
            logger.info(f"mPLUG-DocOwl initialized with model: {model_name} on {self.device}")
            return True
            
        except ImportError:
            logger.error("mPLUG-DocOwl dependencies not available. Install with 'pip install transformers torch pillow'")
            return False
        except Exception as e:
            logger.error(f"Error initializing mPLUG-DocOwl: {e}")
            return False
    
    def _process_document_implementation(self, document_path: str, options: Dict[str, Any]) -> EngineResult:
        """
        Process a document with mPLUG-DocOwl
        
        Args:
            document_path: Path to the document
            options: Processing options
            
        Returns:
            EngineResult object
        """
        try:
            # Check document format
            ext = os.path.splitext(document_path)[1].lower()
            
            if ext == '.pdf':
                return self._process_pdf(document_path, options)
            else:
                # Process as image
                return self._process_image_file(document_path, options)
            
        except Exception as e:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error=f"Error in mPLUG-DocOwl: {str(e)}"
            )
    
    def _process_pdf(self, pdf_path: str, options: Dict[str, Any]) -> EngineResult:
        """Process a PDF document"""
        try:
            import fitz  # PyMuPDF
            
            # Extract pages as images
            doc = fitz.open(pdf_path)
            pages_results = []
            
            # Get queries for document understanding
            queries = options.get('queries', self._get_default_queries())
            
            for page_idx in range(len(doc)):
                # Get page
                page = doc.load_page(page_idx)
                
                # Convert to image
                pix = page.get_pixmap(alpha=False)
                
                # Save as temporary image
                import tempfile
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                    temp_path = tmp.name
                    pix.save(temp_path)
                
                # Process the page image
                page_result = self._process_image_file(temp_path, {
                    'queries': queries,
                    'page_num': page_idx + 1
                })
                
                # Remove temporary file
                try:
                    os.unlink(temp_path)
                except:
                    pass
                
                if page_result.success:
                    pages_results.append(page_result.data)
            
            # Combine results from all pages
            combined_result = {
                'pages': pages_results,
                'document_type': 'pdf',
                'page_count': len(doc)
            }
            
            return EngineResult(
                engine_name=self.engine_name,
                success=True,
                result_type="document_qa",
                data=combined_result,
                confidence=0.9
            )
            
        except ImportError:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error="PyMuPDF (fitz) not available. Install with 'pip install pymupdf'"
            )
            
        except Exception as e:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error=f"Error processing PDF: {str(e)}"
            )
    
    def _process_image_file(self, image_path: str, options: Dict[str, Any]) -> EngineResult:
        """Process an image with mPLUG-DocOwl"""
        try:
            # Import required libraries
            import torch
            from PIL import Image
            
            # Load image
            image = Image.open(image_path).convert('RGB')
            
            # Get queries for document understanding
            queries = options.get('queries', self._get_default_queries())
            page_num = options.get('page_num', 1)
            
            # Process each query
            responses = {}
            
            for query_name, query_text in queries.items():
                # Prepare inputs
                inputs = self.processor(
                    text=query_text,
                    images=image,
                    return_tensors="pt"
                ).to(self.device)
                
                # Generate response
                with torch.no_grad():
                    generated_ids = self.model.generate(
                        **inputs,
                        max_length=512,
                        num_beams=5
                    )
                    
                    generated_text = self.processor.batch_decode(
                        generated_ids, 
                        skip_special_tokens=True
                    )[0].strip()
                
                # Store response
                responses[query_name] = generated_text
            
            # Structure the result
            result = {
                'page_num': page_num,
                'responses': responses,
                'queries': queries
            }
            
            return EngineResult(
                engine_name=self.engine_name,
                success=True,
                result_type="document_qa",
                data=result,
                confidence=0.85
            )
            
        except Exception as e:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error=f"Error processing image with mPLUG-DocOwl: {str(e)}"
            )
    
    def _get_default_queries(self) -> Dict[str, str]:
        """Get default queries for document understanding"""
        return {
            'extract_text': "Extract all the text content from this document.",
            'document_title': "What is the title of this document?",
            'key_points': "What are the key points or main information in this document?",
            'table_content': "Extract the content of any tables in this document.",
            'document_type': "What type of document is this?",
            'material_properties': "Extract any material properties or specifications mentioned in this document."
        }
    
    def _process_image_implementation(self, image_data: Any, options: Dict[str, Any]) -> EngineResult:
        """
        Process an image with mPLUG-DocOwl
        
        Args:
            image_data: Image data
            options: Processing options
            
        Returns:
            EngineResult object
        """
        try:
            # Save image to temporary file
            import tempfile
            from PIL import Image
            import numpy as np
            
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                temp_path = tmp.name
                
                if hasattr(image_data, 'save'):
                    # PIL Image
                    image_data.save(temp_path)
                elif isinstance(image_data, bytes):
                    # Bytes
                    tmp.write(image_data)
                elif isinstance(image_data, np.ndarray):
                    # Numpy array
                    Image.fromarray(image_data).save(temp_path)
                else:
                    raise ValueError(f"Unsupported image data type: {type(image_data)}")
            
            # Process the image
            result = self._process_image_file(temp_path, options)
            
            # Remove temporary file
            try:
                os.unlink(temp_path)
            except:
                pass
            
            return result
            
        except Exception as e:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error=f"Error processing image with mPLUG-DocOwl: {str(e)}"
            )
    
    def _get_description(self) -> str:
        """Get engine description"""
        return "mPLUG-DocOwl: Multimodal document understanding with vision-language capabilities"
    
    def _get_author(self) -> str:
        """Get engine author"""
        return "X-PLUG Team"
    
    def _get_repository(self) -> str:
        """Get engine repository"""
        return "https://github.com/X-PLUG/mPLUG-DocOwl"
    
    def _get_license(self) -> str:
        """Get engine license"""
        return "Apache-2.0"
    
    def _get_requirements(self) -> List[str]:
        """Get engine requirements"""
        return ["transformers>=4.28.0", "torch>=1.13.0", "pillow>=9.0.0"]
    
    def _get_supported_formats(self) -> List[str]:
        """Get supported file formats"""
        return ["pdf", "png", "jpg", "jpeg"]
    
    def _get_tags(self) -> List[str]:
        """Get engine tags"""
        return ["multimodal", "vision-language", "document-qa", "zero-shot"]


def register_additional_engines(engine_manager):
    """
    Register additional OCR engines with the engine manager
    
    Args:
        engine_manager: EngineManager instance
    """
    # Register PaddleOCR
    try:
        engine_manager.register_engine_class("paddleocr", PaddleOCREngine)
        logger.info("Registered PaddleOCR engine")
    except Exception as e:
        logger.error(f"Failed to register PaddleOCR engine: {e}")
    
    # Register pdfdeal
    try:
        engine_manager.register_engine_class("pdfdeal", PdfDealEngine)
        logger.info("Registered pdfdeal engine")
    except Exception as e:
        logger.error(f"Failed to register pdfdeal engine: {e}")
    
    # Register surya
    try:
        engine_manager.register_engine_class("surya", SuryaEngine)
        logger.info("Registered surya engine")
    except Exception as e:
        logger.error(f"Failed to register surya engine: {e}")
    
    # Register mPLUG-DocOwl
    try:
        engine_manager.register_engine_class("mplug_docowl", MplugDocOwlEngine)
        logger.info("Registered mPLUG-DocOwl engine")
    except Exception as e:
        logger.error(f"Failed to register mPLUG-DocOwl engine: {e}")


if __name__ == "__main__":
    # Test code for individual engines
    from extensible_engine_manager import EngineManager
    
    # Create engine manager
    manager = EngineManager()
    
    # Register additional engines
    register_additional_engines(manager)
    
    # List available engines
    print("Available engines:")
    for name, metadata in manager.get_available_engines().items():
        print(f"  {name} (v{metadata.version}): {metadata.description}")