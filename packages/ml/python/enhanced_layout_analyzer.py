#!/usr/bin/env python3
"""
Enhanced Layout Analyzer

This module provides advanced document layout analysis capabilities,
optimized for processing complex material datasheets, catalogs, and technical documents.

Key features:
1. Multi-column layout detection and processing
2. Table structure recognition with merged cells
3. Figure and diagram identification
4. Form field detection
5. Hierarchical section analysis
6. Reading order determination for non-linear layouts
"""

import os
import sys
import json
import logging
import numpy as np
import cv2
from typing import Dict, List, Any, Tuple, Optional, Union
from dataclasses import dataclass, field

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Try to import optional dependencies
try:
    import layoutparser as lp
    LAYOUTPARSER_AVAILABLE = True
    logger.info("LayoutParser dependency loaded successfully")
except ImportError:
    LAYOUTPARSER_AVAILABLE = False
    logger.warning("LayoutParser not available, using built-in layout analysis")

try:
    import pdf2image
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False
    logger.warning("pdf2image not available, PDF support limited")


@dataclass
class LayoutElement:
    """Represents a detected element in the document layout"""
    element_id: str
    element_type: str  # 'text', 'table', 'figure', 'form', 'header', 'footer', etc.
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2
    confidence: float = 0.0
    attributes: Dict[str, Any] = field(default_factory=dict)
    parent_id: Optional[str] = None
    children: List[str] = field(default_factory=list)
    page_num: int = 0
    reading_order: int = -1
    content: Any = None
    ocr_engine: str = "auto"


class EnhancedLayoutAnalyzer:
    """Advanced layout analysis for complex documents"""
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the layout analyzer
        
        Args:
            config: Configuration dictionary
        """
        self.config = {
            'layout_mode': 'deep',  # 'basic', 'deep', 'custom'
            'enable_multi_column': True,
            'enable_table_detection': True,
            'enable_figure_detection': True,
            'enable_form_detection': True,
            'min_confidence': 0.6,
            'table_detection_model': 'faster_rcnn',  # 'faster_rcnn', 'mask_rcnn', etc.
            'text_detection_model': 'db_resnet50',
            'form_field_model': 'form_detector_v1',
            'material_specific_templates': True,
            'custom_layout_rules': None,
            'reading_order_analysis': True,
            'dpi': 300,
            'padding': 5,
            'material_regions': {
                'title': True,
                'specs': True,
                'dimensions': True,
                'codes': True,
                'technical_properties': True
            }
        }
        
        if config:
            self.config.update(config)
        
        # Initialize layout analysis models
        self.models = {}
        self.initialize_models()
    
    def initialize_models(self):
        """Initialize layout analysis models based on configuration"""
        
        if LAYOUTPARSER_AVAILABLE and self.config['layout_mode'] == 'deep':
            try:
                # Initialize text detection model
                if self.config['enable_multi_column']:
                    self.models['text'] = lp.Detectron2LayoutModel(
                        config_path='lp://PubLayNet/mask_rcnn_X_101_32x8d_FPN_3x/config',
                        label_map={0: "Text", 1: "Title", 2: "List", 3: "Table", 4: "Figure"},
                        extra_config=["MODEL.ROI_HEADS.SCORE_THRESH_TEST", 0.7]
                    )
                    logger.info("Initialized deep text detection model")
                
                # Initialize table detection model
                if self.config['enable_table_detection']:
                    if self.config['table_detection_model'] == 'faster_rcnn':
                        self.models['table'] = lp.Detectron2LayoutModel(
                            config_path='lp://TableBank/faster_rcnn_R_101_FPN_3x/config',
                            label_map={0: "Table"}
                        )
                        logger.info("Initialized table detection model")
                
                # Initialize form field detection
                if self.config['enable_form_detection']:
                    # Use specialized form field detector
                    self.models['form'] = self._get_form_detector()
                    logger.info("Initialized form field detection model")
                
            except Exception as e:
                logger.error(f"Error initializing layout models: {e}")
                # Fall back to basic mode
                self.config['layout_mode'] = 'basic'
        
        # Initialize material-specific template recognizers
        if self.config['material_specific_templates']:
            self._init_material_templates()
    
    def _get_form_detector(self):
        """Get the form field detector model"""
        # This is a placeholder for actual form detector initialization
        # In a real implementation, we'd load a pre-trained model
        
        class FormDetector:
            def detect(self, image):
                """Detect form fields in an image"""
                # Placeholder for actual detection logic
                return []
        
        return FormDetector()
    
    def _init_material_templates(self):
        """Initialize material-specific templates for common formats"""
        # Material data sheet templates
        self.material_templates = {
            'tile_datasheet': {
                'regions': [
                    {'name': 'header', 'position': 'top', 'height_ratio': 0.15},
                    {'name': 'product_image', 'position': 'top_left', 'width_ratio': 0.3, 'height_ratio': 0.3},
                    {'name': 'specs_table', 'position': 'middle_right', 'width_ratio': 0.65},
                    {'name': 'dimensions', 'position': 'middle_left', 'width_ratio': 0.3},
                    {'name': 'installation', 'position': 'bottom', 'height_ratio': 0.2}
                ]
            },
            'stone_datasheet': {
                'regions': [
                    {'name': 'header', 'position': 'top', 'height_ratio': 0.12},
                    {'name': 'product_image', 'position': 'top_right', 'width_ratio': 0.4, 'height_ratio': 0.3},
                    {'name': 'specs_table', 'position': 'middle', 'width_ratio': 0.9},
                    {'name': 'technical_properties', 'position': 'bottom_left', 'width_ratio': 0.45},
                    {'name': 'applications', 'position': 'bottom_right', 'width_ratio': 0.45}
                ]
            },
            'catalog_page': {
                'regions': [
                    {'name': 'header', 'position': 'top', 'height_ratio': 0.1},
                    {'name': 'product_grid', 'position': 'middle', 'columns': 3, 'rows': 2},
                    {'name': 'footer', 'position': 'bottom', 'height_ratio': 0.08}
                ]
            }
        }
        
        logger.info(f"Initialized {len(self.material_templates)} material-specific templates")
    
    def analyze_document(self, document_path: str) -> Dict[str, Any]:
        """
        Analyze document layout
        
        Args:
            document_path: Path to the document
            
        Returns:
            Dictionary with layout analysis results
        """
        # Check if file exists
        if not os.path.exists(document_path):
            return {'error': f"Document not found: {document_path}"}
        
        # Determine document type
        doc_type = self._get_document_type(document_path)
        
        # Process based on document type
        if doc_type == 'pdf' and PDF2IMAGE_AVAILABLE:
            return self._analyze_pdf(document_path)
        elif doc_type in ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'bmp']:
            return self._analyze_image(document_path)
        else:
            return {'error': f"Unsupported document type: {doc_type}"}
    
    def _get_document_type(self, document_path: str) -> str:
        """Get document type based on file extension"""
        ext = os.path.splitext(document_path)[1].lower()
        if ext == '.pdf':
            return 'pdf'
        elif ext in ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp']:
            return ext[1:]
        else:
            return 'unknown'
    
    def _analyze_pdf(self, pdf_path: str) -> Dict[str, Any]:
        """
        Analyze PDF document
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Dictionary with layout analysis results
        """
        try:
            # Convert PDF to images
            images = pdf2image.convert_from_path(
                pdf_path, 
                dpi=self.config['dpi']
            )
            
            # Process each page
            pages = []
            for i, img in enumerate(images):
                # Convert PIL image to numpy array
                img_np = np.array(img)
                
                # Analyze page
                page_result = self._analyze_image_array(
                    img_np, 
                    page_num=i+1
                )
                
                pages.append(page_result)
            
            # Analyze document-level structure
            document_structure = self._analyze_document_structure(pages)
            
            return {
                'document_type': 'pdf',
                'pages': pages,
                'page_count': len(pages),
                'structure': document_structure
            }
            
        except Exception as e:
            logger.error(f"Error analyzing PDF {pdf_path}: {e}")
            return {'error': str(e)}
    
    def _analyze_image(self, image_path: str) -> Dict[str, Any]:
        """
        Analyze image document
        
        Args:
            image_path: Path to image file
            
        Returns:
            Dictionary with layout analysis results
        """
        try:
            # Read image
            img = cv2.imread(image_path)
            if img is None:
                return {'error': f"Failed to read image: {image_path}"}
            
            # Convert BGR to RGB
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            
            # Analyze image
            result = self._analyze_image_array(img_rgb)
            
            # Add document metadata
            result['document_type'] = 'image'
            result['path'] = image_path
            
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing image {image_path}: {e}")
            return {'error': str(e)}
    
    def _analyze_image_array(self, image: np.ndarray, page_num: int = 1) -> Dict[str, Any]:
        """
        Analyze image array
        
        Args:
            image: Numpy image array (RGB)
            page_num: Page number for multi-page documents
            
        Returns:
            Dictionary with layout analysis results
        """
        height, width = image.shape[:2]
        
        # Initialize results
        elements = []
        
        # Determine layout analysis approach
        if self.config['layout_mode'] == 'deep' and LAYOUTPARSER_AVAILABLE:
            elements = self._deep_layout_analysis(image)
        elif self.config['layout_mode'] == 'custom' and self.config['custom_layout_rules']:
            elements = self._custom_layout_analysis(image)
        else:
            elements = self._basic_layout_analysis(image)
        
        # Add material-specific region detection if enabled
        if self.config['material_specific_templates']:
            material_elements = self._detect_material_specific_regions(image)
            # Merge with existing elements
            for elem in material_elements:
                # Check if this element overlaps significantly with existing ones
                if not self._has_significant_overlap(elem, elements):
                    elements.append(elem)
        
        # Assign page number to elements
        for elem in elements:
            elem.page_num = page_num
        
        # Determine reading order if enabled
        if self.config['reading_order_analysis']:
            elements = self._determine_reading_order(elements)
        
        # Convert to dictionary format
        element_dicts = [self._element_to_dict(elem) for elem in elements]
        
        return {
            'page_num': page_num,
            'width': width,
            'height': height,
            'elements': element_dicts,
            'element_count': len(element_dicts)
        }
    
    def _deep_layout_analysis(self, image: np.ndarray) -> List[LayoutElement]:
        """
        Perform deep layout analysis using LayoutParser
        
        Args:
            image: Numpy image array
            
        Returns:
            List of LayoutElement objects
        """
        elements = []
        
        try:
            # Text block detection
            if 'text' in self.models:
                layout = self.models['text'].detect(image)
                for i, block in enumerate(layout):
                    if block.score >= self.config['min_confidence']:
                        elem = LayoutElement(
                            element_id=f"text_{i}",
                            element_type=block.type.lower(),
                            bbox=(int(block.coordinates[0]), int(block.coordinates[1]), 
                                  int(block.coordinates[2]), int(block.coordinates[3])),
                            confidence=float(block.score)
                        )
                        elements.append(elem)
            
            # Table detection
            if 'table' in self.models:
                tables = self.models['table'].detect(image)
                for i, table in enumerate(tables):
                    if table.score >= self.config['min_confidence']:
                        elem = LayoutElement(
                            element_id=f"table_{i}",
                            element_type="table",
                            bbox=(int(table.coordinates[0]), int(table.coordinates[1]), 
                                  int(table.coordinates[2]), int(table.coordinates[3])),
                            confidence=float(table.score)
                        )
                        
                        # Analyze table structure
                        table_structure = self._analyze_table_structure(
                            image[elem.bbox[1]:elem.bbox[3], elem.bbox[0]:elem.bbox[2]]
                        )
                        elem.attributes['structure'] = table_structure
                        
                        elements.append(elem)
            
            # Form field detection
            if 'form' in self.models and self.config['enable_form_detection']:
                form_fields = self.models['form'].detect(image)
                for i, field in enumerate(form_fields):
                    elem = LayoutElement(
                        element_id=f"form_{i}",
                        element_type="form_field",
                        bbox=(int(field['bbox'][0]), int(field['bbox'][1]), 
                              int(field['bbox'][2]), int(field['bbox'][3])),
                        confidence=float(field.get('score', 0.9))
                    )
                    
                    # Add field attributes
                    if 'field_type' in field:
                        elem.attributes['field_type'] = field['field_type']
                    
                    elements.append(elem)
            
            return elements
            
        except Exception as e:
            logger.error(f"Error in deep layout analysis: {e}")
            # Fall back to basic analysis
            return self._basic_layout_analysis(image)
    
    def _basic_layout_analysis(self, image: np.ndarray) -> List[LayoutElement]:
        """
        Perform basic layout analysis using OpenCV
        
        Args:
            image: Numpy image array
            
        Returns:
            List of LayoutElement objects
        """
        elements = []
        
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            
            # Binarize
            _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            
            # Find contours
            contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # Filter and process contours
            for i, contour in enumerate(contours):
                x, y, w, h = cv2.boundingRect(contour)
                
                # Filter out small regions
                if w < 20 or h < 20:
                    continue
                
                # Determine element type based on shape
                element_type = "text"  # Default
                
                # Check if it might be a table (usually has grid lines)
                roi = binary[y:y+h, x:x+w]
                horizontal_lines = self._detect_horizontal_lines(roi)
                vertical_lines = self._detect_vertical_lines(roi)
                
                if len(horizontal_lines) > 2 and len(vertical_lines) > 2:
                    element_type = "table"
                
                # Check if it might be a figure (usually has different texture)
                if element_type == "text":
                    # Check texture variance - figures usually have higher variance
                    roi_gray = gray[y:y+h, x:x+w]
                    variance = np.var(roi_gray)
                    
                    if variance > 2000:  # Threshold determined empirically
                        element_type = "figure"
                
                elem = LayoutElement(
                    element_id=f"elem_{i}",
                    element_type=element_type,
                    bbox=(x, y, x+w, y+h),
                    confidence=0.8  # Default confidence for basic analysis
                )
                
                # If it's a table, analyze structure
                if element_type == "table":
                    table_structure = {
                        'rows': len(horizontal_lines) - 1,
                        'columns': len(vertical_lines) - 1,
                        'cells': []
                    }
                    elem.attributes['structure'] = table_structure
                
                elements.append(elem)
            
            return elements
            
        except Exception as e:
            logger.error(f"Error in basic layout analysis: {e}")
            return []
    
    def _custom_layout_analysis(self, image: np.ndarray) -> List[LayoutElement]:
        """
        Perform custom layout analysis using provided rules
        
        Args:
            image: Numpy image array
            
        Returns:
            List of LayoutElement objects
        """
        # This is just a placeholder for custom layout rules
        # In a real implementation, this would use the custom rules specified in config
        
        # Fall back to basic analysis for now
        return self._basic_layout_analysis(image)
    
    def _detect_horizontal_lines(self, binary_image: np.ndarray) -> List:
        """Detect horizontal lines in binary image"""
        # Create structure element for extracting horizontal lines
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 1))
        detected_lines = cv2.morphologyEx(binary_image, cv2.MORPH_OPEN, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(detected_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Extract line positions
        lines = []
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            if w > 20:  # Minimum line width
                lines.append((y, x, x + w))
        
        return sorted(lines)
    
    def _detect_vertical_lines(self, binary_image: np.ndarray) -> List:
        """Detect vertical lines in binary image"""
        # Create structure element for extracting vertical lines
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 20))
        detected_lines = cv2.morphologyEx(binary_image, cv2.MORPH_OPEN, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(detected_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Extract line positions
        lines = []
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            if h > 20:  # Minimum line height
                lines.append((x, y, y + h))
        
        return sorted(lines)
    
    def _analyze_table_structure(self, table_image: np.ndarray) -> Dict[str, Any]:
        """
        Analyze table structure
        
        Args:
            table_image: Cropped image of the table
            
        Returns:
            Dictionary with table structure information
        """
        # Convert to grayscale
        gray = cv2.cvtColor(table_image, cv2.COLOR_RGB2GRAY)
        
        # Binarize
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        # Detect horizontal and vertical lines
        horizontal_lines = self._detect_horizontal_lines(binary)
        vertical_lines = self._detect_vertical_lines(binary)
        
        # Create grid structure
        rows = len(horizontal_lines) + 1
        cols = len(vertical_lines) + 1
        
        # Check for merged cells (complex layout)
        # This is a simplified approach - real implementation would be more complex
        cells = []
        
        # Add cell regions
        for i in range(rows - 1):
            for j in range(cols - 1):
                # Define cell boundaries
                if i < len(horizontal_lines) and j < len(vertical_lines):
                    top = horizontal_lines[i][0] if i == 0 else horizontal_lines[i-1][0]
                    bottom = horizontal_lines[i][0]
                    left = vertical_lines[j][0] if j == 0 else vertical_lines[j-1][0]
                    right = vertical_lines[j][0]
                    
                    cell = {
                        'row': i,
                        'col': j,
                        'bbox': (left, top, right, bottom),
                        'merged': False  # Default, would need more analysis for merged cells
                    }
                    cells.append(cell)
        
        return {
            'rows': rows,
            'columns': cols,
            'cells': cells,
            'has_header': rows > 1,  # Assume first row is header if multiple rows
            'confidence': 0.8
        }
    
    def _detect_material_specific_regions(self, image: np.ndarray) -> List[LayoutElement]:
        """
        Detect material-specific regions based on templates
        
        Args:
            image: Numpy image array
            
        Returns:
            List of LayoutElement objects
        """
        elements = []
        height, width = image.shape[:2]
        
        # Try to determine document type
        template_type = self._detect_template_type(image)
        
        if template_type and template_type in self.material_templates:
            template = self.material_templates[template_type]
            
            # Apply template regions
            for i, region in enumerate(template['regions']):
                region_elem = self._region_to_element(region, width, height, i)
                if region_elem:
                    elements.append(region_elem)
        
        # Additional detection for specific material regions if enabled
        if self.config['material_regions']['dimensions']:
            dimension_regions = self._detect_dimension_regions(image)
            elements.extend(dimension_regions)
        
        if self.config['material_regions']['technical_properties']:
            property_regions = self._detect_technical_property_regions(image)
            elements.extend(property_regions)
        
        return elements
    
    def _detect_template_type(self, image: np.ndarray) -> Optional[str]:
        """
        Detect which template type matches the document
        
        Args:
            image: Document image
            
        Returns:
            Template type name or None if no match
        """
        # This is a simplified placeholder implementation
        # Real implementation would use image features and ML classification
        
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        
        # Simple heuristics for demo purposes
        height, width = gray.shape
        
        # Check if image has product grid (catalog)
        if self._has_product_grid(gray):
            return 'catalog_page'
        
        # Check if image has large product image in corner (datasheet)
        has_corner_image = self._has_corner_image(gray)
        
        # Check if image has specs table
        has_specs_table = self._has_specs_table(gray)
        
        if has_corner_image and has_specs_table:
            # Determine if tile or stone based on other features
            # This would be more sophisticated in a real implementation
            return 'tile_datasheet'
        
        # Default to None if no confident match
        return None
    
    def _has_product_grid(self, gray_image: np.ndarray) -> bool:
        """Check if image has a product grid layout"""
        # Simplified placeholder implementation
        # Would use more sophisticated algorithms in real implementation
        return False
    
    def _has_corner_image(self, gray_image: np.ndarray) -> bool:
        """Check if image has a large product image in corner"""
        # Simplified placeholder implementation
        return False
    
    def _has_specs_table(self, gray_image: np.ndarray) -> bool:
        """Check if image has a specifications table"""
        # Simplified placeholder implementation
        return False
    
    def _region_to_element(self, region: Dict[str, Any], width: int, height: int, index: int) -> Optional[LayoutElement]:
        """Convert template region to layout element"""
        try:
            # Calculate region bounding box based on relative positions
            if 'position' in region:
                position = region['position']
                
                # Default values
                x1, y1, x2, y2 = 0, 0, width, height
                
                # Apply width/height ratios if specified
                w = width * region.get('width_ratio', 1.0)
                h = height * region.get('height_ratio', 1.0)
                
                # Adjust position based on named position
                if position == 'top':
                    x1, y1, x2, y2 = 0, 0, width, h
                elif position == 'bottom':
                    x1, y1, x2, y2 = 0, height - h, width, height
                elif position == 'left':
                    x1, y1, x2, y2 = 0, 0, w, height
                elif position == 'right':
                    x1, y1, x2, y2 = width - w, 0, width, height
                elif position == 'top_left':
                    x1, y1, x2, y2 = 0, 0, w, h
                elif position == 'top_right':
                    x1, y1, x2, y2 = width - w, 0, width, h
                elif position == 'bottom_left':
                    x1, y1, x2, y2 = 0, height - h, w, height
                elif position == 'bottom_right':
                    x1, y1, x2, y2 = width - w, height - h, width, height
                elif position == 'middle':
                    # Center region
                    x_center, y_center = width / 2, height / 2
                    x1 = max(0, x_center - w / 2)
                    y1 = max(0, y_center - h / 2)
                    x2 = min(width, x_center + w / 2)
                    y2 = min(height, y_center + h / 2)
                elif position == 'middle_left':
                    x1, y1 = 0, (height - h) / 2
                    x2, y2 = w, y1 + h
                elif position == 'middle_right':
                    x1, y1 = width - w, (height - h) / 2
                    x2, y2 = width, y1 + h
                
                # Create element with computed bbox
                elem = LayoutElement(
                    element_id=f"material_{region['name']}_{index}",
                    element_type=f"material_{region['name']}",
                    bbox=(int(x1), int(y1), int(x2), int(y2)),
                    confidence=0.75,  # Template-based confidence
                    attributes={'template_region': region['name']}
                )
                
                return elem
            
            return None
            
        except Exception as e:
            logger.error(f"Error converting region to element: {e}")
            return None
    
    def _detect_dimension_regions(self, image: np.ndarray) -> List[LayoutElement]:
        """
        Detect regions containing dimension information
        
        Args:
            image: Document image
            
        Returns:
            List of dimension-related layout elements
        """
        # This would use specialized detection for dimension information
        # Common patterns: NxN values, dimension diagrams, etc.
        
        # Placeholder implementation
        return []
    
    def _detect_technical_property_regions(self, image: np.ndarray) -> List[LayoutElement]:
        """
        Detect regions containing technical property information
        
        Args:
            image: Document image
            
        Returns:
            List of technical property layout elements
        """
        # This would detect regions with technical specifications
        # Look for patterns like "R-value: X", "PEI Rating: Y", etc.
        
        # Placeholder implementation
        return []
    
    def _has_significant_overlap(self, element: LayoutElement, elements: List[LayoutElement]) -> bool:
        """
        Check if an element has significant overlap with existing elements
        
        Args:
            element: Element to check
            elements: List of existing elements
            
        Returns:
            True if significant overlap exists
        """
        x1, y1, x2, y2 = element.bbox
        area1 = (x2 - x1) * (y2 - y1)
        
        for existing in elements:
            ex1, ey1, ex2, ey2 = existing.bbox
            
            # Calculate intersection
            ix1 = max(x1, ex1)
            iy1 = max(y1, ey1)
            ix2 = min(x2, ex2)
            iy2 = min(y2, ey2)
            
            if ix1 < ix2 and iy1 < iy2:
                intersection = (ix2 - ix1) * (iy2 - iy1)
                overlap_ratio = intersection / area1
                
                if overlap_ratio > 0.7:  # 70% overlap threshold
                    return True
        
        return False
    
    def _determine_reading_order(self, elements: List[LayoutElement]) -> List[LayoutElement]:
        """
        Determine reading order for layout elements
        
        Args:
            elements: List of layout elements
            
        Returns:
            Elements with reading order assigned
        """
        # Simple top-to-bottom, left-to-right ordering
        # This is a simplified approach - real implementation would be more sophisticated
        
        # Sort elements by y-coordinate (top to bottom)
        elements_by_row = {}
        
        for elem in elements:
            y_center = (elem.bbox[1] + elem.bbox[3]) / 2
            
            # Group elements into rows with some tolerance
            row_found = False
            for row_y in elements_by_row.keys():
                if abs(row_y - y_center) < 20:  # 20px tolerance for same row
                    elements_by_row[row_y].append(elem)
                    row_found = True
                    break
            
            if not row_found:
                elements_by_row[y_center] = [elem]
        
        # Sort rows by y-coordinate
        sorted_rows = sorted(elements_by_row.keys())
        
        # Sort elements within each row by x-coordinate
        reading_order = 0
        ordered_elements = []
        
        for row_y in sorted_rows:
            # Sort elements in this row by their x-coordinate
            row_elements = sorted(elements_by_row[row_y], key=lambda e: e.bbox[0])
            
            for elem in row_elements:
                elem.reading_order = reading_order
                reading_order += 1
                ordered_elements.append(elem)
        
        return ordered_elements
    
    def _analyze_document_structure(self, pages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze document-level structure across pages
        
        Args:
            pages: List of page analysis results
            
        Returns:
            Document structure information
        """
        # This would analyze relationships between elements across pages
        # and identify document structure like TOC, sections, etc.
        
        # Simplified implementation for now
        structure = {
            'has_toc': False,
            'has_sections': False,
            'title': None,
            'sections': []
        }
        
        # Check first page for title
        if pages and 'elements' in pages[0]:
            for elem in pages[0]['elements']:
                if elem['element_type'] in ['title', 'header'] and elem['bbox'][1] < 100:
                    structure['title'] = elem['element_id']
                    break
        
        # Check for repeated headers/footers
        headers = []
        footers = []
        
        for page in pages:
            if 'elements' in page:
                for elem in page['elements']:
                    # Headers are typically at the top of the page
                    if elem['bbox'][1] < 100 and elem['element_type'] in ['text', 'header']:
                        headers.append(elem)
                    
                    # Footers are typically at the bottom
                    page_height = page['height']
                    if elem['bbox'][3] > page_height - 100 and elem['element_type'] in ['text', 'footer']:
                        footers.append(elem)
        
        # Check for sections based on titles/headers
        sections = []
        current_section = None
        
        for page_idx, page in enumerate(pages):
            if 'elements' in page:
                for elem in page['elements']:
                    if elem['element_type'] in ['title', 'heading'] and elem['bbox'][1] < page['height'] / 2:
                        # This could be a section title
                        if current_section:
                            sections.append(current_section)
                        
                        current_section = {
                            'title_element': elem['element_id'],
                            'start_page': page_idx,
                            'end_page': page_idx
                        }
                    
                    if current_section:
                        current_section['end_page'] = page_idx
        
        # Add final section if exists
        if current_section:
            sections.append(current_section)
        
        structure['has_sections'] = len(sections) > 0
        structure['sections'] = sections
        
        return structure
    
    def _element_to_dict(self, element: LayoutElement) -> Dict[str, Any]:
        """Convert LayoutElement to dictionary representation"""
        return {
            'element_id': element.element_id,
            'element_type': element.element_type,
            'bbox': element.bbox,
            'confidence': element.confidence,
            'attributes': element.attributes,
            'parent_id': element.parent_id,
            'children': element.children,
            'page_num': element.page_num,
            'reading_order': element.reading_order,
            'ocr_engine': element.ocr_engine
        }
    
    def visualize_layout(self, document_path: str, output_path: str = None) -> str:
        """
        Create visualization of document layout analysis
        
        Args:
            document_path: Path to the document
            output_path: Path to save visualization (optional)
            
        Returns:
            Path to the visualization image
        """
        try:
            # Analyze document layout
            layout = self.analyze_document(document_path)
            
            if 'error' in layout:
                return {'error': layout['error']}
            
            # For PDFs, we visualize all pages
            if layout.get('document_type') == 'pdf':
                # Use the first page for now
                if layout['pages']:
                    page_layout = layout['pages'][0]
                    return self._visualize_page(document_path, page_layout, output_path)
                
                return {'error': 'No pages found in PDF'}
            
            # For single images, visualize directly
            return self._visualize_page(document_path, layout, output_path)
            
        except Exception as e:
            logger.error(f"Error visualizing layout: {e}")
            return {'error': str(e)}
    
    def _visualize_page(self, document_path: str, layout: Dict[str, Any], output_path: str = None) -> str:
        """
        Create visualization for a single page
        
        Args:
            document_path: Path to the document
            layout: Layout analysis for the page
            output_path: Path to save visualization
            
        Returns:
            Path to the visualization image
        """
        try:
            # Load image from document
            if layout.get('document_type') == 'pdf' and PDF2IMAGE_AVAILABLE:
                # Convert specific page to image
                page_num = layout.get('page_num', 1)
                images = pdf2image.convert_from_path(
                    document_path,
                    first_page=page_num,
                    last_page=page_num,
                    dpi=self.config['dpi']
                )
                
                if not images:
                    return {'error': f"Failed to convert PDF page {page_num} to image"}
                
                # Convert PIL image to numpy array
                image = np.array(images[0])
                
            else:
                # Read image file
                image = cv2.imread(document_path)
                if image is None:
                    return {'error': f"Failed to read image: {document_path}"}
                
                # Convert BGR to RGB
                image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Draw bounding boxes for detected elements
            vis_image = image.copy()
            
            if 'elements' in layout:
                for elem in layout['elements']:
                    bbox = elem['bbox']
                    element_type = elem['element_type']
                    
                    # Choose color based on element type
                    color = (0, 0, 255)  # Default: red
                    
                    if element_type == 'text':
                        color = (0, 255, 0)  # Green
                    elif element_type == 'title':
                        color = (255, 0, 0)  # Blue
                    elif element_type == 'table':
                        color = (255, 255, 0)  # Yellow
                    elif element_type == 'figure':
                        color = (255, 0, 255)  # Magenta
                    elif element_type == 'form_field':
                        color = (0, 255, 255)  # Cyan
                    elif element_type.startswith('material_'):
                        color = (128, 0, 128)  # Purple
                    
                    # Draw rectangle
                    cv2.rectangle(vis_image, (bbox[0], bbox[1]), (bbox[2], bbox[3]), color, 2)
                    
                    # Add label
                    label = f"{element_type} ({elem.get('reading_order', '')})"
                    cv2.putText(vis_image, label, (bbox[0], bbox[1] - 5), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
            
            # Save or return visualization
            if output_path:
                # Ensure output directory exists
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                
                # Convert RGB to BGR for OpenCV
                vis_image_bgr = cv2.cvtColor(vis_image, cv2.COLOR_RGB2BGR)
                
                # Save image
                cv2.imwrite(output_path, vis_image_bgr)
                return output_path
            else:
                # Generate temporary output path
                base_name = os.path.splitext(os.path.basename(document_path))[0]
                temp_dir = os.path.join(os.getcwd(), 'temp')
                os.makedirs(temp_dir, exist_ok=True)
                
                temp_path = os.path.join(temp_dir, f"{base_name}_layout.png")
                
                # Convert RGB to BGR for OpenCV
                vis_image_bgr = cv2.cvtColor(vis_image, cv2.COLOR_RGB2BGR)
                
                # Save image
                cv2.imwrite(temp_path, vis_image_bgr)
                return temp_path
            
        except Exception as e:
            logger.error(f"Error visualizing page: {e}")
            return {'error': str(e)}


def main():
    """Main entry point for command-line usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Enhanced Layout Analyzer")
    parser.add_argument('document', help='Path to the document to analyze')
    parser.add_argument('--output', '-o', help='Path to save the output JSON')
    parser.add_argument('--visualize', '-v', action='store_true', help='Visualize the layout analysis')
    parser.add_argument('--vis-output', help='Path to save the visualization')
    parser.add_argument('--mode', choices=['basic', 'deep', 'custom'], default='deep',
                       help='Layout analysis mode')
    
    args = parser.parse_args()
    
    # Configure layout analyzer
    config = {
        'layout_mode': args.mode
    }
    
    analyzer = EnhancedLayoutAnalyzer(config)
    
    # Analyze document
    result = analyzer.analyze_document(args.document)
    
    # Save result to JSON if output specified
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        print(f"Analysis saved to {args.output}")
    else:
        # Print summary
        if 'error' in result:
            print(f"Error: {result['error']}")
        elif result.get('document_type') == 'pdf':
            print(f"PDF document with {result.get('page_count')} pages")
            for i, page in enumerate(result.get('pages', [])):
                print(f"Page {i+1}: {len(page.get('elements', []))} elements")
        else:
            print(f"Document analysis: {len(result.get('elements', []))} elements")
    
    # Visualize layout if requested
    if args.visualize:
        vis_path = analyzer.visualize_layout(args.document, args.vis_output)
        if isinstance(vis_path, dict) and 'error' in vis_path:
            print(f"Visualization error: {vis_path['error']}")
        else:
            print(f"Visualization saved to {vis_path}")


if __name__ == "__main__":
    main()