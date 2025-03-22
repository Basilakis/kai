#!/usr/bin/env python3
"""
PDF Form Field Extraction

This module provides capabilities to automatically identify and extract data from
structured forms in PDF documents, including:
1. Detection of form fields in scanned documents
2. Extraction of filled-in values from form fields
3. Structural analysis and field labeling
4. Extraction of data tables within forms
5. Conversion of extracted data to structured formats

Usage:
    python form_field_extraction.py <input_path> [options]

Arguments:
    input_path    Path to the PDF document
    
Options:
    --output-dir        Directory to save extracted data
    --output-format     Format for extracted data (json, csv, xml)
    --visualize         Generate visualization of detected form fields
    --extract-tables    Extract tables from the form
"""

import os
import sys
import json
import csv
import argparse
import cv2
import numpy as np
import fitz  # PyMuPDF
from typing import Dict, List, Any, Tuple, Optional, Union
import logging
from pathlib import Path
import tempfile
import xml.etree.ElementTree as ET
import pytesseract

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Define constants
DEFAULT_DPI = 300
FORM_FIELD_TYPES = [
    'text', 'checkbox', 'radio', 'dropdown', 'signature', 'date'
]

# Define supported languages with their codes for OCR
SUPPORTED_LANGUAGES = {
    'eng': 'English',
    'fra': 'French',
    'deu': 'German',
    'spa': 'Spanish',
    'ita': 'Italian',
    'por': 'Portuguese',
    'nld': 'Dutch',
    'rus': 'Russian',
    'ara': 'Arabic',
    'hin': 'Hindi',
    'jpn': 'Japanese',
    'kor': 'Korean',
    'chi_sim': 'Chinese (Simplified)',
    'chi_tra': 'Chinese (Traditional)',
    'dan': 'Danish',
    'fin': 'Finnish',
    'ell': 'Greek',
    'heb': 'Hebrew',
    'hun': 'Hungarian',
    'pol': 'Polish',
    'ron': 'Romanian',
    'swe': 'Swedish',
    'tur': 'Turkish',
    'ukr': 'Ukrainian',
    'vie': 'Vietnamese',
    'ces': 'Czech'
}

# Dictionary of domain-specific vocabularies for post-correction
DOMAIN_VOCABULARIES = {
    'material': [
        'ceramic', 'porcelain', 'stoneware', 'terracotta', 'quarry', 'mosaic', 'wood', 'laminate', 
        'vinyl', 'linoleum', 'cork', 'bamboo', 'stone', 'marble', 'granite', 'slate', 'travertine',
        'limestone', 'sandstone', 'quartz', 'hardwood', 'engineered', 'solid', 'hickory', 'oak', 
        'maple', 'cherry', 'walnut', 'birch', 'pine', 'technical', 'glazed', 'unglazed', 'rectified', 
        'polished', 'honed', 'tumbled', 'matte', 'glossy', 'textured'
    ],
    'measurements': [
        'mm', 'cm', 'in', 'ft', 'inch', 'inches', 'foot', 'feet', 'meter', 'meters', 'centimeter',
        'millimeter', 'square', 'sq', 'ft²', 'm²', 'cm²', 'mm²', 'in²', 'sqft', 'sqm'
    ],
    'technical_specs': [
        'thickness', 'width', 'length', 'height', 'depth', 'size', 'dimensions', 'format', 'weight',
        'density', 'porosity', 'absorption', 'moisture', 'slip', 'resistance', 'rating', 'class',
        'grade', 'finish', 'color', 'texture', 'pattern', 'shade', 'tone', 'coefficient', 'friction',
        'installation', 'substrate', 'adhesive', 'grout', 'waterproof', 'frost', 'thermal', 'conductivity',
        'expansion', 'contraction', 'tensile', 'strength', 'compressive', 'flexural', 'impact', 'abrasion'
    ]
}


class FormFieldExtractor:
    """Class for extracting form fields from PDF documents"""
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the form field extractor
        
        Args:
            config: Configuration dictionary with settings
        """
        self.config = {
            'dpi': DEFAULT_DPI,
            'field_detection_confidence': 0.7,
            'enable_ocr': True,
            'ocr_language': 'eng',  # Default language is English
            'ocr_language_detection': True,  # Auto-detect language
            'extract_tables': True,
            'table_extraction_mode': 'advanced',
            'output_format': 'json',
            'label_matching_threshold': 0.8,
            'visualization_enabled': True,
            'checkmark_detection_sensitivity': 0.7,
            'field_text_recognition_mode': 'enhanced',
            'post_processing': True,  # Apply post-processing corrections
            'confidence_scoring': True,  # Provide confidence scores for extracted text
            'form_structure_analysis': True,  # Analyze overall form structure
            'multi_language_support': True,  # Enable multi-language support
            'domain_specific_correction': True  # Apply domain-specific corrections
        }
        
        if config:
            self.config.update(config)
        
        # Verify required libraries
        self._verify_dependencies()
        
        # Initialize language detector if multi-language support is enabled
        if self.config['multi_language_support'] and self.config['ocr_language_detection']:
            try:
                import langdetect
                self.language_detector = langdetect
            except ImportError:
                logger.warning("langdetect not installed, falling back to default language")
                self.config['ocr_language_detection'] = False
    
    def _verify_dependencies(self):
        """Verify required libraries are installed"""
        try:
            # Check PyMuPDF
            fitz_version = fitz.version
        except Exception as e:
            logger.error(f"PyMuPDF (fitz) is not properly installed: {e}")
            raise RuntimeError("PyMuPDF is required but not properly installed.")
        
        if self.config['enable_ocr']:
            try:
                # Check Tesseract if OCR is enabled
                pytesseract.get_tesseract_version()
            except Exception as e:
                logger.error(f"Tesseract OCR is not properly installed: {e}")
                raise RuntimeError("Tesseract OCR is required but not properly installed.")
    
    def process_document(self, pdf_path: str, output_dir: str = None) -> Dict[str, Any]:
        """
        Process a PDF document to extract form fields
        
        Args:
            pdf_path: Path to the PDF document
            output_dir: Directory to save extracted data
            
        Returns:
            Dictionary with extraction results
        """
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")
        
        # Create output directory if specified
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        
        # Process based on PDF type
        try:
            # Open the PDF document
            pdf_document = fitz.open(pdf_path)
            
            # Check if the PDF has form fields
            has_form_fields = len(pdf_document.get_page_labels()) > 0 and pdf_document[0].first_widget
            
            if has_form_fields:
                # Extract from interactive PDF form
                logger.info("Processing interactive PDF form")
                result = self._extract_interactive_form_fields(pdf_document)
            else:
                # Extract from scanned/non-interactive PDF
                logger.info("Processing scanned/non-interactive PDF")
                result = self._extract_scanned_form_fields(pdf_document)
            
            # Add document metadata
            result['document_info'] = {
                'filename': os.path.basename(pdf_path),
                'path': pdf_path,
                'page_count': len(pdf_document),
                'is_interactive_form': has_form_fields,
                'processing_config': self.config
            }
            
            # Save extracted data if output_dir is specified
            if output_dir:
                self._save_extracted_data(result, output_dir)
                
                # Generate visualization if enabled
                if self.config['visualization_enabled']:
                    visualization_path = os.path.join(output_dir, f"{Path(pdf_path).stem}_form_fields.png")
                    self._generate_visualization(pdf_document, result, visualization_path)
                    result['visualization_path'] = visualization_path
            
            # Close the PDF document
            pdf_document.close()
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing PDF: {str(e)}")
            raise
    
    def _extract_interactive_form_fields(self, pdf_document: fitz.Document) -> Dict[str, Any]:
        """
        Extract form fields from an interactive PDF form
        
        Args:
            pdf_document: PyMuPDF document
            
        Returns:
            Dictionary with extraction results
        """
        form_fields = []
        
        # Process each page
        for page_idx, page in enumerate(pdf_document):
            # Get form fields on this page
            widgets = page.widgets()
            
            for widget in widgets:
                field_type = widget.field_type
                field_name = widget.field_name
                field_label = self._infer_field_label(page, widget)
                
                # Get field value based on type
                if field_type == fitz.PDF_WIDGET_TYPE_TEXT:
                    field_value = widget.text
                    field_type_name = 'text'
                elif field_type == fitz.PDF_WIDGET_TYPE_CHECKBOX:
                    field_value = widget.field_value
                    field_type_name = 'checkbox'
                elif field_type == fitz.PDF_WIDGET_TYPE_RADIOBUTTON:
                    field_value = widget.field_value
                    field_type_name = 'radio'
                elif field_type == fitz.PDF_WIDGET_TYPE_LISTBOX:
                    field_value = widget.field_value
                    field_type_name = 'dropdown'
                elif field_type == fitz.PDF_WIDGET_TYPE_SIGNATURE:
                    # Signature fields don't have a simple text value
                    field_value = "Signature present" if widget.field_value else "No signature"
                    field_type_name = 'signature'
                else:
                    field_value = str(widget.field_value)
                    field_type_name = 'other'
                
                # Get field position
                rect = widget.rect
                
                form_fields.append({
                    'name': field_name,
                    'label': field_label,
                    'type': field_type_name,
                    'value': field_value,
                    'page': page_idx + 1,
                    'bbox': (rect.x0, rect.y0, rect.width, rect.height),
                    'is_filled': self._is_field_filled(field_type, field_value)
                })
        
        # Extract tables if enabled
        tables = []
        if self.config['extract_tables']:
            tables = self._extract_tables(pdf_document)
        
        # Organize fields by page and type
        fields_by_page = self._organize_fields_by_page(form_fields, len(pdf_document))
        fields_by_type = self._organize_fields_by_type(form_fields)
        
        return {
            'form_fields': form_fields,
            'fields_by_page': fields_by_page,
            'fields_by_type': fields_by_type,
            'tables': tables,
            'total_fields': len(form_fields),
            'filled_fields': sum(1 for field in form_fields if field['is_filled'])
        }
    
    def _extract_scanned_form_fields(self, pdf_document: fitz.Document) -> Dict[str, Any]:
        """
        Extract form fields from a scanned PDF document
        
        Args:
            pdf_document: PyMuPDF document
            
        Returns:
            Dictionary with extraction results
        """
        form_fields = []
        
        # Process each page
        for page_idx, page in enumerate(pdf_document):
            # Convert page to image
            pix = page.get_pixmap(dpi=self.config['dpi'])
            
            # Create a temporary file for the page image
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                pix_path = temp_file.name
                pix.save(pix_path)
            
            try:
                # Detect form fields in the page image
                detected_fields = self._detect_form_fields_in_image(pix_path, page)
                
                # Process each detected field
                for field in detected_fields:
                    # Convert coordinates from image space to PDF space
                    x, y, w, h = field['bbox']
                    pdf_rect = page.rect
                    scale_x = pdf_rect.width / pix.width
                    scale_y = pdf_rect.height / pix.height
                    
                    pdf_bbox = (
                        x * scale_x,
                        y * scale_y,
                        w * scale_x,
                        h * scale_y
                    )
                    
                    # Add page information
                    field['page'] = page_idx + 1
                    field['bbox'] = pdf_bbox
                    form_fields.append(field)
                
            finally:
                # Clean up temporary file
                os.unlink(pix_path)
        
        # Extract tables if enabled
        tables = []
        if self.config['extract_tables']:
            tables = self._extract_tables(pdf_document)
        
        # Organize fields by page and type
        fields_by_page = self._organize_fields_by_page(form_fields, len(pdf_document))
        fields_by_type = self._organize_fields_by_type(form_fields)
        
        return {
            'form_fields': form_fields,
            'fields_by_page': fields_by_page,
            'fields_by_type': fields_by_type,
            'tables': tables,
            'total_fields': len(form_fields),
            'filled_fields': sum(1 for field in form_fields if field['is_filled'])
        }
    
    def _detect_form_fields_in_image(self, image_path: str, page: fitz.Page) -> List[Dict[str, Any]]:
        """
        Detect form fields in an image with enhanced detection
        
        Args:
            image_path: Path to the page image
            page: PyMuPDF page object
            
        Returns:
            List of detected form fields
        """
        # Load the image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Failed to load image: {image_path}")
        
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Apply adaptive thresholding
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY_INV, 11, 2
        )
        
        # Analyze form structure if enabled
        form_regions = None
        if self.config['form_structure_analysis']:
            form_regions = self._analyze_form_structure(image, thresh)
        
        # Detect different types of form fields
        detected_fields = []
        
        # 1. Detect checkboxes and radio buttons
        checkbox_fields = self._detect_checkbox_fields(thresh, image)
        detected_fields.extend(checkbox_fields)
        
        # 2. Detect text fields using enhanced multi-scale detection
        if self.config['field_text_recognition_mode'] == 'enhanced':
            text_fields = self._detect_text_fields_enhanced(thresh, image)
        else:
            text_fields = self._detect_text_fields(thresh, image)
        detected_fields.extend(text_fields)
        
        # 3. Extract field labels and values using OCR
        if self.config['enable_ocr']:
            for field in detected_fields:
                # Extract field region
                x, y, w, h = field['bbox']
                field_region = image[y:y+h, x:x+w]
                
                # For checkboxes, detect if checked
                if field['type'] in ['checkbox', 'radio']:
                    field['is_filled'] = self._is_checkbox_checked(field_region)
                    continue
                
                # For text fields, extract value using OCR
                value_region = field_region.copy()
                
                # Create temporary file for OCR
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                    region_path = temp_file.name
                    cv2.imwrite(region_path, value_region)
                
                try:
                    # Perform OCR on the field region
                    text = pytesseract.image_to_string(
                        value_region,
                        lang=self.config['ocr_language'],
                        config='--psm 6'
                    ).strip()
                    
                    # If text is found, mark as filled
                    field['value'] = text
                    field['is_filled'] = bool(text)
                    
                finally:
                    # Clean up temporary file
                    os.unlink(region_path)
                
                # Try to find field label nearby
                field['label'] = self._find_field_label(image, field['bbox'])
        
        return detected_fields
    
    def _detect_checkbox_fields(self, thresh: np.ndarray, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect checkbox and radio button fields in an image
        
        Args:
            thresh: Thresholded image
            image: Original image
            
        Returns:
            List of detected checkbox fields
        """
        # Find contours
        contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        
        # Filter contours to find checkboxes
        checkboxes = []
        
        for contour in contours:
            # Calculate area
            area = cv2.contourArea(contour)
            
            # Filter by area
            if area < 100 or area > 10000:
                continue
            
            # Get bounding rectangle
            x, y, w, h = cv2.boundingRect(contour)
            
            # Calculate aspect ratio
            aspect_ratio = w / h if h > 0 else 0
            
            # Checkboxes and radio buttons should have aspect ratio close to 1
            if 0.7 <= aspect_ratio <= 1.3:
                # Try to determine if it's a checkbox or radio button
                # Calculate roundness (4π*area/perimeter²)
                perimeter = cv2.arcLength(contour, True)
                circularity = 4 * np.pi * area / (perimeter * perimeter) if perimeter > 0 else 0
                
                # More circular = radio button, more square = checkbox
                field_type = 'radio' if circularity > 0.8 else 'checkbox'
                
                checkboxes.append({
                    'type': field_type,
                    'bbox': (x, y, w, h),
                    'is_filled': False,  # Will be determined later
                    'value': None,
                    'name': f"{field_type}_{len(checkboxes) + 1}",
                    'label': None  # Will be determined later
                })
        
        return checkboxes
    
    def _analyze_form_structure(self, image: np.ndarray, thresh: np.ndarray) -> Dict[str, Any]:
        """
        Analyze the overall structure of a form document to identify sections and field groups
        
        Args:
            image: Original color image
            thresh: Thresholded binary image
            
        Returns:
            Dictionary with form structure information including sections and regions
        """
        height, width = image.shape[:2]
        
        # Detect lines using adaptive multi-scale kernels
        # For different types of forms and document structures
        horizontal_lines = []
        vertical_lines = []
        
        # Use multiple scales to detect lines of different lengths
        for scale in [int(width * 0.1), int(width * 0.2), 40]:
            h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (scale, 1))
            h_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, h_kernel, iterations=2)
            horizontal_lines.append(h_lines)
        
        for scale in [int(height * 0.1), int(height * 0.2), 40]:
            v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, scale))
            v_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, v_kernel, iterations=2)
            vertical_lines.append(v_lines)
        
        # Combine multi-scale lines
        combined_h_lines = horizontal_lines[0].copy()
        combined_v_lines = vertical_lines[0].copy()
        
        for i in range(1, len(horizontal_lines)):
            combined_h_lines = cv2.add(combined_h_lines, horizontal_lines[i])
            combined_v_lines = cv2.add(combined_v_lines, vertical_lines[i])
        
        # Find form sections (areas bordered by lines)
        combined_lines = cv2.add(combined_h_lines, combined_v_lines)
        
        # Dilate lines to connect nearby segments
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        dilated_lines = cv2.dilate(combined_lines, kernel, iterations=1)
        
        # Find contours to identify form sections
        contours, hierarchy = cv2.findContours(
            dilated_lines, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE
        )
        
        # Extract form sections and regions
        form_sections = []
        
        for i, contour in enumerate(contours):
            # Only process "holes" which are likely form sections
            if hierarchy is not None and hierarchy[0][i][3] >= 0:  # Has parent (is a hole)
                area = cv2.contourArea(contour)
                
                # Skip very small areas
                if area < 1000:
                    continue
                
                # Get bounding rectangle
                x, y, w, h = cv2.boundingRect(contour)
                
                # Skip if too narrow or covering the whole page
                if w < 50 or h < 30 or (w > width * 0.9 and h > height * 0.9):
                    continue
                
                # Add as a form section
                form_sections.append({
                    'bbox': (x, y, w, h),
                    'type': 'section',
                    'area': area
                })
        
        # Identify text blocks in the form
        # Apply different threshold for text detection
        _, text_thresh = cv2.threshold(
            cv2.GaussianBlur(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY), (5, 5), 0),
            0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )
        
        # Find text blocks using MSER or connected components
        # MSER works well for text detection
        mser = cv2.MSER_create()
        regions, _ = mser.detectRegions(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY))
        
        # Group nearby regions to form text blocks
        text_blocks = []
        if regions:
            # Convert regions to bounding boxes
            boxes = [cv2.boundingRect(p) for p in regions]
            
            # Filter out very small boxes (noise)
            boxes = [b for b in boxes if b[2] > 5 and b[3] > 5]
            
            # Group nearby boxes
            groups = []
            current_group = [boxes[0]]
            
            for i in range(1, len(boxes)):
                x1, y1, w1, h1 = boxes[i]
                prev_x, prev_y, prev_w, prev_h = current_group[-1]
                
                # Check if current box is close to previous box
                if abs(y1 - prev_y) < 20 and abs(x1 - (prev_x + prev_w)) < 50:
                    current_group.append(boxes[i])
                else:
                    # Start a new group
                    if len(current_group) > 0:
                        groups.append(current_group)
                    current_group = [boxes[i]]
            
            # Add the last group
            if current_group:
                groups.append(current_group)
            
            # Convert groups to bounding boxes
            for group in groups:
                if not group:
                    continue
                
                # Find min/max coordinates
                min_x = min(box[0] for box in group)
                min_y = min(box[1] for box in group)
                max_x = max(box[0] + box[2] for box in group)
                max_y = max(box[1] + box[3] for box in group)
                
                width = max_x - min_x
                height = max_y - min_y
                
                # Skip very small blocks
                if width < 20 or height < 10:
                    continue
                
                text_blocks.append({
                    'bbox': (min_x, min_y, width, height),
                    'type': 'text_block'
                })
        
        return {
            'sections': form_sections,
            'text_blocks': text_blocks,
            'horizontal_lines': combined_h_lines,
            'vertical_lines': combined_v_lines
        }
    
    def _detect_text_fields_enhanced(self, thresh: np.ndarray, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Enhanced detection of text fields in complex document structures
        
        Args:
            thresh: Thresholded image
            image: Original image
            
        Returns:
            List of detected text fields with improved accuracy
        """
        # Get form structure to inform text field detection
        form_structure = self._analyze_form_structure(image, thresh)
        
        # Start with basic text field detection
        text_fields = self._detect_text_fields(thresh, image)
        
        # Enhance detection with multi-scale analysis
        # Detect horizontal lines using multi-scale kernels for different form styles
        horizontal_kernels = [
            cv2.getStructuringElement(cv2.MORPH_RECT, (20, 1)),  # Short lines
            cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1)),  # Medium lines
            cv2.getStructuringElement(cv2.MORPH_RECT, (80, 1))   # Long lines
        ]
        
        # Apply kernels at different scales
        for kernel in horizontal_kernels:
            h_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)
            
            # Find contours of horizontal lines
            contours, _ = cv2.findContours(h_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # Minimum width for a text field depends on the kernel size
            min_width = kernel.shape[0] * 1.2
        
            for contour in contours:
                # Get bounding rectangle
                x, y, w, h = cv2.boundingRect(contour)
                
                # Filter by size and aspect ratio
                if w < min_width or h > 20:
                    continue
                
                # Create text field with some padding above the line
                padding = 30  # Adjust based on form design
                field_x = x
                field_y = max(0, y - padding)
                field_w = w
                field_h = padding
                
                # Check if this field overlaps with existing fields
                overlapping = False
                for field in text_fields:
                    fx, fy, fw, fh = field['bbox']
                    # Check for significant overlap
                    if (
                        field_x < fx + fw and field_x + field_w > fx and
                        field_y < fy + fh and field_y + field_h > fy and
                        (min(field_x + field_w, fx + fw) - max(field_x, fx)) > 0.5 * min(field_w, fw)
                    ):
                        overlapping = True
                        break
                
                if not overlapping:
                    text_fields.append({
                        'type': 'text',
                        'bbox': (field_x, field_y, field_w, field_h),
                        'is_filled': False,  # Will be determined later
                        'value': None,
                        'name': f"text_{len(text_fields) + 1}",
                        'label': None,  # Will be determined later
                        'confidence': 0.7  # Default confidence for line-based detection
                    })
        
        # Detect form fields based on rectangular contours (hollow rectangles)
        # These are often pre-printed form fields in technical datasheets
        # Find contours in the thresholded image with different parameters
        # for better rectangle detection
        rect_thresh = cv2.adaptiveThreshold(
            cv2.GaussianBlur(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY), (5, 5), 0),
            255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
        )
        
        # Filter out text to focus on form elements
        rect_mask = cv2.morphologyEx(
            rect_thresh, 
            cv2.MORPH_CLOSE, 
            cv2.getStructuringElement(cv2.MORPH_RECT, (5, 1)), 
            iterations=1
        )
        
        contours, _ = cv2.findContours(rect_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            # Get bounding rectangle
            x, y, w, h = cv2.boundingRect(contour)
            
            # Filter by size and aspect ratio for form fields
            if w < 30 or h < 15 or w > image.shape[1] * 0.9 or h > image.shape[0] * 0.3:
                continue
            
            # Calculate aspect ratio
            aspect_ratio = w / h if h > 0 else 0
            
            # Different aspect ratio criteria for different field types
            if aspect_ratio > 1.2:  # More likely a text field
                # Check if this is a hollow rectangle (potential text field)
                mask = np.zeros(rect_thresh.shape, dtype=np.uint8)
                cv2.drawContours(mask, [contour], 0, 255, -1)
                mask = cv2.erode(mask, None, iterations=2)
                
                # Count non-zero pixels in the mask
                pixel_count = cv2.countNonZero(mask)
                
                # Calculate fill ratio
                fill_ratio = pixel_count / (w * h) if w * h > 0 else 0
                
                # Calculate perimeter-to-area ratio (high for rectangular fields)
                perimeter = cv2.arcLength(contour, True)
                perimeter_area_ratio = perimeter * perimeter / (4 * np.pi * pixel_count) if pixel_count > 0 else 0
                
                # Rectangle check: approximated polygon should have 4 points if it's a rectangle
                epsilon = 0.04 * perimeter
                approx = cv2.approxPolyDP(contour, epsilon, True)
                is_rectangle = len(approx) == 4
                
                # Combine multiple factors to determine if it's a text field
                # Higher confidence for clean rectangles with low fill ratio
                confidence = 0.0
                
                if is_rectangle and fill_ratio < 0.2:
                    confidence = 0.9 - fill_ratio * 2  # Higher confidence for emptier rectangles
                    
                    # Check if the rectangle has a clear border (common in form fields)
                    border_check = cv2.dilate(mask, None, iterations=3) - cv2.dilate(mask, None, iterations=1)
                    border_ratio = cv2.countNonZero(border_check) / perimeter if perimeter > 0 else 0
                    
                    if border_ratio > 0.5:
                        confidence += 0.1
                    
                    # Only add if confidence is reasonable and doesn't overlap existing fields
                    if confidence > 0.6:
                        overlapping = False
                        for field in text_fields:
                            fx, fy, fw, fh = field['bbox']
                            # Check for significant overlap
                            if (
                                x < fx + fw and x + w > fx and
                                y < fy + fh and y + h > fy and
                                (min(x + w, fx + fw) - max(x, fx)) > 0.5 * min(w, fw)
                            ):
                                overlapping = True
                                # Take the one with higher confidence
                                if confidence > field.get('confidence', 0.5):
                                    text_fields.remove(field)
                                    overlapping = False
                                break
                        
                        if not overlapping:
                            text_fields.append({
                                'type': 'text',
                                'bbox': (x, y, w, h),
                                'is_filled': False,  # Will be determined later
                                'value': None,
                                'name': f"text_{len(text_fields) + 1}",
                                'label': None,  # Will be determined later
                                'confidence': confidence,
                                'detection_method': 'rectangle_contour'
                            })
        
        # Check form sections for potential fields
        for section in form_structure.get('sections', []):
            section_x, section_y, section_w, section_h = section['bbox']
            
            # Skip very small sections
            if section_w < 100 or section_h < 50:
                continue
            
            # Extract section image
            section_img = image[section_y:section_y+section_h, section_x:section_x+section_w]
            
            if section_img.size == 0:
                continue
            
            # Check if this section has empty rectangular regions that might be form fields
            section_gray = cv2.cvtColor(section_img, cv2.COLOR_BGR2GRAY) if len(section_img.shape) == 3 else section_img
            _, section_thresh = cv2.threshold(section_gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            
            # Check for horizontal lines that might indicate form fields
            h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (int(section_w * 0.3), 1))
            h_lines = cv2.morphologyEx(section_thresh, cv2.MORPH_OPEN, h_kernel, iterations=1)
            
            h_contours, _ = cv2.findContours(h_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for contour in h_contours:
                # Get bounding rectangle
                x, y, w, h = cv2.boundingRect(contour)
                
                # Check if there's sufficient space above this line for a form field
                if y < 15:  # Not enough space above
                    continue
                    
                # Create field region above the line
                field_y = max(0, y - 25)
                field_h = y - field_y
                
                # Skip very short lines
                if w < 30 or field_h < 5:
                    continue
                
                # Calculate global coordinates
                global_x = section_x + x
                global_y = section_y + field_y
                
                # Check for overlap with existing fields
                overlapping = False
                for field in text_fields:
                    fx, fy, fw, fh = field['bbox']
                    if (
                        global_x < fx + fw and global_x + w > fx and
                        global_y < fy + fh and global_y + field_h > fy
                    ):
                        overlapping = True
                        break
                
                if not overlapping:
                    text_fields.append({
                        'type': 'text',
                        'bbox': (global_x, global_y, w, field_h),
                        'is_filled': False,  # Will be determined later
                        'value': None,
                        'name': f"text_{len(text_fields) + 1}",
                        'label': None,  # Will be determined later
                        'confidence': 0.7,
                        'detection_method': 'section_line'
                    })
        
        # Filter out fields with poor confidence if we have many fields
        if len(text_fields) > 50:  # Arbitrary threshold to prevent too many false positives
            text_fields = [field for field in text_fields if field.get('confidence', 0.0) > 0.65]
        
        # Sort by position (top to bottom, left to right)
        text_fields.sort(key=lambda f: (f['bbox'][1], f['bbox'][0]))
        
        # Remove duplicates (fields with very similar bounding boxes)
        i = 0
        while i < len(text_fields) - 1:
            current = text_fields[i]
            cx, cy, cw, ch = current['bbox']
            
            # Check against all remaining fields
            j = i + 1
            while j < len(text_fields):
                next_field = text_fields[j]
                nx, ny, nw, nh = next_field['bbox']
                
                # Calculate overlap
                x_overlap = max(0, min(cx + cw, nx + nw) - max(cx, nx))
                y_overlap = max(0, min(cy + ch, ny + nh) - max(cy, ny))
                overlap_area = x_overlap * y_overlap
                min_area = min(cw * ch, nw * nh)
                
                # If significant overlap, keep the one with higher confidence
                if min_area > 0 and overlap_area / min_area > 0.7:
                    if next_field.get('confidence', 0.0) > current.get('confidence', 0.0):
                        text_fields[i] = next_field
                        text_fields.pop(j)
                    else:
                        text_fields.pop(j)
                else:
                    j += 1
                    
            i += 1
        
        return text_fields
    
    def _is_checkbox_checked(self, checkbox_image: np.ndarray) -> Union[bool, Tuple[bool, float]]:
        """
        Determine if a checkbox is checked with confidence score
        
        Args:
            checkbox_image: Image of the checkbox
            
        Returns:
            True if the checkbox is checked, False otherwise
            Or tuple of (is_checked, confidence) if confidence_scoring is enabled
        """
        # Convert to grayscale if needed
        if len(checkbox_image.shape) == 3:
            gray = cv2.cvtColor(checkbox_image, cv2.COLOR_BGR2GRAY)
        else:
            gray = checkbox_image
        
        # Apply thresholding
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        # Calculate the fill ratio
        total_pixels = thresh.shape[0] * thresh.shape[1]
        filled_pixels = cv2.countNonZero(thresh)
        fill_ratio = filled_pixels / total_pixels if total_pixels > 0 else 0
        
        # Apply morphological operations to detect checkmarks more accurately
        kernel = np.ones((2, 2), np.uint8)
        morphed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        
        # Find contours in the checkbox
        contours, _ = cv2.findContours(morphed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Analyze contour properties (checkmarks have specific patterns)
        checkmark_confidence = 0.0
        
        if contours:
            # Get largest contour
            largest_contour = max(contours, key=cv2.contourArea)
            area = cv2.contourArea(largest_contour)
            perimeter = cv2.arcLength(largest_contour, True)
            
            # Calculate shape complexity (high for checkmarks, low for filled boxes)
            complexity = perimeter * perimeter / (4 * np.pi * area) if area > 0 else 0
            
            # X pattern is common in checkmarks
            x_pattern_score = 0
            if complexity > 2:  # Non-circular shape
                # Check for diagonal lines (X pattern)
                lines = cv2.HoughLinesP(morphed, 1, np.pi/180, 15, minLineLength=10, maxLineGap=5)
                if lines is not None:
                    slopes = []
                    for line in lines:
                        x1, y1, x2, y2 = line[0]
                        if x2 != x1:  # Avoid division by zero
                            slope = abs((y2 - y1) / (x2 - x1))
                            slopes.append(slope)
                    
                    # Look for diagonal lines in both directions
                    diag1 = sum(1 for s in slopes if 0.5 < s < 2.0)
                    diag2 = sum(1 for s in slopes if s > 2.0 or s < 0.5)
                    x_pattern_score = min(diag1, diag2) / max(1, max(diag1, diag2))
            
            # Combine factors
            content_score = min(1.0, fill_ratio / 0.3)  # Normalize fill ratio
            shape_score = min(1.0, complexity / 5.0)  # Normalize complexity
            
            # Calculate final confidence
            checkmark_confidence = 0.4 * content_score + 0.3 * shape_score + 0.3 * x_pattern_score
        
        # Determine if checked based on sensitivity and confidence
        sensitivity = self.config['checkmark_detection_sensitivity']
        threshold = sensitivity * 0.2  # Adjust baseline threshold
        is_checked = fill_ratio > threshold or checkmark_confidence > 0.6
        
        # Calculate confidence in the result
        if is_checked:
            confidence = max(min(1.0, fill_ratio / 0.3), checkmark_confidence)
        else:
            confidence = max(min(1.0, 1.0 - (fill_ratio / 0.3)), 1.0 - checkmark_confidence)
        
        # Return result based on configuration
        if self.config['confidence_scoring']:
            return is_checked, confidence
        else:
            return is_checked
    
    def _find_field_label(self, image: np.ndarray, field_bbox: Tuple[int, int, int, int]) -> Union[str, Dict[str, Any]]:
        """
        Find the label for a form field with enhanced detection
        
        Args:
            image: Original image
            field_bbox: Bounding box of the field
            
        Returns:
            Field label text or dictionary with label text and confidence
        """
        # Extract coordinates
        x, y, w, h = field_bbox
        
        # Expand search regions to improve label detection
        search_regions = [
            # Left of the field (primary location for labels)
            (max(0, x - 250), max(0, y - 5), 250, h + 10),
            # Above the field
            (max(0, x - 10), max(0, y - 70), w + 20, 70),
            # Right of the field (for right-to-left languages or alternative layouts)
            (min(x + w, image.shape[1] - 10), max(0, y - 5), 250, h + 10),
            # Below the field (rare but possible location)
            (max(0, x - 10), min(y + h, image.shape[0] - 10), w + 20, 50)
        ]
        
        best_label = ""
        best_confidence = 0.0
        label_language = self.config['ocr_language']
        
        # Process each search region
        for region_idx, (search_x, search_y, search_w, search_h) in enumerate(search_regions):
            # Ensure region is within image bounds
            if (search_x >= 0 and search_y >= 0 and 
                search_x + search_w <= image.shape[1] and 
                search_y + search_h <= image.shape[0]):
                
                region = image[search_y:search_y+search_h, search_x:search_x+search_w]
                
                # Skip empty or nearly empty regions
                if region.size == 0 or (len(region.shape) == 3 and np.mean(region) > 240):  # Mostly white
                    continue
                
                # Apply preprocessing to enhance text
                gray_region = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY) if len(region.shape) == 3 else region
                _, thresh_region = cv2.threshold(gray_region, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
                
                # Detect language if enabled
                if self.config['multi_language_support'] and self.config['ocr_language_detection']:
                    # First try with default language
                    text = pytesseract.image_to_string(
                        region,
                        lang=self.config['ocr_language'],
                        config='--psm 7'  # Single line mode
                    ).strip()
                    
                    # If text found, attempt to detect its language
                    if text and len(text) > 3:
                        try:
                            detected_lang = self.language_detector.detect(text)
                            # Map detected language to Tesseract language code
                            for lang_code in SUPPORTED_LANGUAGES:
                                if detected_lang.startswith(lang_code[:2]):
                                    label_language = lang_code
                                    break
                        except:
                            # If language detection fails, use default
                            pass
                
                # Perform OCR with detected or configured language
                text = pytesseract.image_to_string(
                    region,
                    lang=label_language,
                    config='--psm 7'  # Single line mode
                ).strip()
                
                # Get confidence data for the text
                ocr_data = pytesseract.image_to_data(
                    region, 
                    lang=label_language,
                    config='--psm 7',
                    output_type=pytesseract.Output.DICT
                )
                
                # Calculate average confidence for the text
                confidences = [float(conf) for conf in ocr_data['conf'] if conf != '-1']
                avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
                
                # Apply post-processing to improve label quality
                if text:
                    # Remove common trailing characters like ":"
                    text = text.rstrip(':')
                    
                    # Apply domain-specific corrections for technical fields
                    if self.config['domain_specific_correction']:
                        text = self._apply_domain_corrections(text, 'technical_specs')
                    
                    # Update best label if this one has higher confidence
                    if avg_confidence > best_confidence or (avg_confidence > 0 and len(text) > len(best_label)):
                        best_label = text
                        best_confidence = avg_confidence
        
        # Return result based on configuration
        if self.config['confidence_scoring']:
            return {
                'text': best_label,
                'confidence': best_confidence / 100.0 if best_confidence > 0 else 0.0,
                'language': label_language
            }
        else:
            return best_label
    
    def _apply_domain_corrections(self, text: str, domain_type: str = None) -> str:
        """
        Apply domain-specific corrections to extracted text
        
        Args:
            text: Text to correct
            domain_type: Type of domain for vocabulary lookup
            
        Returns:
            Corrected text
        """
        if not text or not self.config['domain_specific_correction']:
            return text
        
        # Split text into words
        words = text.split()
        corrected_words = []
        
        for word in words:
            # Skip short words or numbers
            if len(word) <= 1 or word.isdigit():
                corrected_words.append(word)
                continue
            
            # Check if word is close to any domain-specific term
            best_match = None
            best_ratio = 0.0
            
            # If domain type specified, only check that vocabulary
            vocabularies = [domain_type] if domain_type and domain_type in DOMAIN_VOCABULARIES else DOMAIN_VOCABULARIES.keys()
            
            for vocab_name in vocabularies:
                for term in DOMAIN_VOCABULARIES[vocab_name]:
                    # Skip terms too different in length
                    if abs(len(word) - len(term)) > min(3, len(term) // 2):
                        continue
                    
                    # Calculate string similarity
                    ratio = self._string_similarity(word.lower(), term.lower())
                    
                    # Update best match if better than current
                    if ratio > 0.8 and ratio > best_ratio:
                        best_match = term
                        best_ratio = ratio
            
            # Use the closest match if good enough, otherwise keep original
            corrected_words.append(best_match if best_match else word)
        
        return ' '.join(corrected_words)
    
    def _string_similarity(self, s1: str, s2: str) -> float:
        """
        Calculate string similarity using Levenshtein distance
        
        Args:
            s1: First string
            s2: Second string
            
        Returns:
            Similarity ratio (0.0 to 1.0)
        """
        # Simple implementation of Levenshtein distance
        if s1 == s2:
            return 1.0
        
        if len(s1) == 0 or len(s2) == 0:
            return 0.0
        
        if len(s1) < len(s2):
            s1, s2 = s2, s1
            
        distances = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            distances_ = [i + 1]
            for j, c2 in enumerate(s2):
                if c1 == c2:
                    distances_.append(distances[j])
                else:
                    distances_.append(1 + min((distances[j], distances[j + 1], distances_[-1])))
            distances = distances_
            
        # Convert to similarity ratio
        max_len = max(len(s1), len(s2))
        return 1.0 - (distances[-1] / max_len)
    
    def _extract_tables(self, pdf_document: fitz.Document) -> List[Dict[str, Any]]:
        """
        Extract tables from the document
        
        Args:
            pdf_document: PyMuPDF document
            
        Returns:
            List of extracted tables
        """
        tables = []
        
        # Process each page
        for page_idx, page in enumerate(pdf_document):
            # Convert page to image
            pix = page.get_pixmap(dpi=self.config['dpi'])
            
            # Create a temporary file for the page image
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                pix_path = temp_file.name
                pix.save(pix_path)
            
            try:
                # Load the image
                image = cv2.imread(pix_path)
                if image is None:
                    logger.warning(f"Failed to load image for page {page_idx + 1}")
                    continue
                
                # Detect tables in the image
                page_tables = self._detect_tables_in_image(image)
                
                # Convert coordinates from image space to PDF space
                pdf_rect = page.rect
                scale_x = pdf_rect.width / pix.width
                scale_y = pdf_rect.height / pix.height
                
                for table in page_tables:
                    # Scale table bbox
                    x, y, w, h = table['bbox']
                    pdf_bbox = (
                        x * scale_x,
                        y * scale_y,
                        w * scale_x,
                        h * scale_y
                    )
                    
                    # Scale cell coordinates
                    scaled_cells = []
                    for cell in table['cells']:
                        cell_x, cell_y, cell_w, cell_h = cell['bbox']
                        pdf_cell_bbox = (
                            cell_x * scale_x,
                            cell_y * scale_y,
                            cell_w * scale_x,
                            cell_h * scale_y
                        )
                        scaled_cells.append({
                            **cell,
                            'bbox': pdf_cell_bbox
                        })
                    
                    tables.append({
                        'page': page_idx + 1,
                        'bbox': pdf_bbox,
                        'rows': table['rows'],
                        'columns': table['columns'],
                        'cells': scaled_cells,
                        'data': table['data']
                    })
                
            finally:
                # Clean up temporary file
                os.unlink(pix_path)
        
        return tables
    
    def _detect_tables_in_image(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect tables in an image
        
        Args:
            image: Image to analyze
            
        Returns:
            List of detected tables
        """
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Apply adaptive thresholding
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY_INV, 11, 2
        )
        
        # Detect lines
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
        vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
        
        horizontal_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horizontal_kernel, iterations=2)
        vertical_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, vertical_kernel, iterations=2)
        
        # Combine horizontal and vertical lines
        table_mask = cv2.add(horizontal_lines, vertical_lines)
        
        # Find contours
        contours, _ = cv2.findContours(table_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Filter contours to find tables
        tables = []
        
        for contour in contours:
            # Calculate area
            area = cv2.contourArea(contour)
            
            # Filter by area
            if area < 5000:
                continue
            
            # Get bounding rectangle
            x, y, w, h = cv2.boundingRect(contour)
            
            # Extract table region
            table_region = thresh[y:y+h, x:x+w]
            
            # Analyze table structure
            table_structure = self._analyze_table_structure(table_region, gray[y:y+h, x:x+w])
            
            # Only include if it has enough rows and columns
            if table_structure['rows'] >= 2 and table_structure['columns'] >= 2:
                tables.append({
                    'bbox': (x, y, w, h),
                    'rows': table_structure['rows'],
                    'columns': table_structure['columns'],
                    'cells': table_structure['cells'],
                    'data': table_structure['data']
                })
        
        return tables
    
    def _analyze_table_structure(self, table_image: np.ndarray, original_region: np.ndarray) -> Dict[str, Any]:
        """
        Analyze the structure of a table
        
        Args:
            table_image: Binary image of the table
            original_region: Grayscale image of the table region
            
        Returns:
            Dictionary with table structure information
        """
        height, width = table_image.shape[:2]
        
        # Detect horizontal and vertical lines
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (width // 10, 1))
        vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, height // 10))
        
        horizontal_lines = cv2.morphologyEx(table_image, cv2.MORPH_OPEN, horizontal_kernel, iterations=2)
        vertical_lines = cv2.morphologyEx(table_image, cv2.MORPH_OPEN, vertical_kernel, iterations=2)
        
        # Find row positions (horizontal lines)
        h_projection = np.sum(horizontal_lines, axis=1) // 255
        row_positions = [i for i, val in enumerate(h_projection) if val > width * 0.3]
        
        # Group adjacent positions to find row boundaries
        row_boundaries = []
        if row_positions:
            row_start = row_positions[0]
            for i in range(1, len(row_positions)):
                if row_positions[i] > row_positions[i-1] + 2:  # Gap in projection
                    row_boundaries.append((row_start, row_positions[i-1]))
                    row_start = row_positions[i]
            row_boundaries.append((row_start, row_positions[-1]))
        
        # Find column positions (vertical lines)
        v_projection = np.sum(vertical_lines, axis=0) // 255
        col_positions = [i for i, val in enumerate(v_projection) if val > height * 0.3]
        
        # Group adjacent positions to find column boundaries
        col_boundaries = []
        if col_positions:
            col_start = col_positions[0]
            for i in range(1, len(col_positions)):
                if col_positions[i] > col_positions[i-1] + 2:  # Gap in projection
                    col_boundaries.append((col_start, col_positions[i-1]))
                    col_start = col_positions[i]
            col_boundaries.append((col_start, col_positions[-1]))
        
        # Create row and column edges
        if not row_boundaries:
            row_boundaries = [(0, 0), (height, height)]
        else:
            # Add top and bottom edges if not already present
            if row_boundaries[0][0] > 10:
                row_boundaries.insert(0, (0, 0))
            if row_boundaries[-1][1] < height - 10:
                row_boundaries.append((height, height))
        
        if not col_boundaries:
            col_boundaries = [(0, 0), (width, width)]
        else:
            # Add left and right edges if not already present
            if col_boundaries[0][0] > 10:
                col_boundaries.insert(0, (0, 0))
            if col_boundaries[-1][1] < width - 10:
                col_boundaries.append((width, width))
        
        # Create cell coordinates
        cells = []
        table_data = []
        
        # Initialize empty table data
        rows = len(row_boundaries) - 1
        cols = len(col_boundaries) - 1
        table_data = [["" for _ in range(cols)] for _ in range(rows)]
        
        for i in range(len(row_boundaries) - 1):
            row_data = []
            for j in range(len(col_boundaries) - 1):
                # Get cell coordinates
                cell_x = col_boundaries[j][1]
                cell_y = row_boundaries[i][1]
                cell_width = col_boundaries[j+1][0] - cell_x
                cell_height = row_boundaries[i+1][0] - cell_y
                
                # Skip cells that are too small
                if cell_width < 5 or cell_height < 5:
                    continue
                
                # Extract cell image
                cell_image = original_region[cell_y:cell_y+cell_height, cell_x:cell_x+cell_width]
                
                # Perform OCR on the cell
                cell_text = ""
                if cell_image.size > 0:
                    cell_text = pytesseract.image_to_string(
                        cell_image,
                        lang=self.config['ocr_language'],
                        config='--psm 6'
                    ).strip()
                
                cells.append({
                    'row': i,
                    'column': j,
                    'bbox': (cell_x, cell_y, cell_width, cell_height),
                    'text': cell_text
                })
                
                # Add to table data
                table_data[i][j] = cell_text
        
        return {
            'rows': len(row_boundaries) - 1,
            'columns': len(col_boundaries) - 1,
            'cells': cells,
            'data': table_data
        }
    
    def _infer_field_label(self, page: fitz.Page, widget: fitz.Widget) -> str:
        """
        Infer the label for a form field from nearby text
        
        Args:
            page: PyMuPDF page
            widget: PyMuPDF widget
            
        Returns:
            Inferred label for the field
        """
        # Get field rectangle
        rect = widget.rect
        
        # Define search area (to the left and above the field)
        search_rect = fitz.Rect(
            rect.x0 - 200,  # Look 200 points to the left
            rect.y0 - 20,   # Look 20 points above
            rect.x0,        # Up to the left edge of the field
            rect.y0 + 5     # Slightly below the top of the field
        )
        
        # Get text in the search area
        label_text = page.get_text("text", clip=search_rect)
        
        # Clean up the label
        label_text = label_text.strip().rstrip(':')
        
        # If no text found to the left, try above
        if not label_text:
            search_rect = fitz.Rect(
                rect.x0,            # Left edge of the field
                rect.y0 - 20,       # Look 20 points above
                rect.x0 + rect.width,  # Right edge of the field
                rect.y0             # Up to the top of the field
            )
            label_text = page.get_text("text", clip=search_rect).strip().rstrip(':')
        
        return label_text
    
    def _organize_fields_by_page(self, form_fields: List[Dict[str, Any]], page_count: int) -> List[List[Dict[str, Any]]]:
        """
        Organize form fields by page
        
        Args:
            form_fields: List of form fields
            page_count: Number of pages in the document
            
        Returns:
            List of form fields organized by page
        """
        fields_by_page = [[] for _ in range(page_count)]
        
        for field in form_fields:
            page_idx = field['page'] - 1  # Convert to 0-based index
            if 0 <= page_idx < page_count:
                fields_by_page[page_idx].append(field)
        
        return fields_by_page
    
    def _organize_fields_by_type(self, form_fields: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """
        Organize form fields by type
        
        Args:
            form_fields: List of form fields
            
        Returns:
            Dictionary of form fields organized by type
        """
        fields_by_type = {}
        
        for field in form_fields:
            field_type = field['type']
            if field_type not in fields_by_type:
                fields_by_type[field_type] = []
            fields_by_type[field_type].append(field)
        
        return fields_by_type
    
    def _is_field_filled(self, field_type: int, field_value: Any) -> bool:
        """
        Determine if a form field is filled
        
        Args:
            field_type: PyMuPDF field type
            field_value: Field value
            
        Returns:
            True if the field is filled, False otherwise
        """
        if field_type == fitz.PDF_WIDGET_TYPE_TEXT:
            return bool(field_value)
        elif field_type == fitz.PDF_WIDGET_TYPE_CHECKBOX:
            return field_value == "Yes"
        elif field_type == fitz.PDF_WIDGET_TYPE_RADIOBUTTON:
            return bool(field_value)
        elif field_type == fitz.PDF_WIDGET_TYPE_LISTBOX:
            return bool(field_value)
        elif field_type == fitz.PDF_WIDGET_TYPE_SIGNATURE:
            return bool(field_value)
        else:
            return bool(field_value)
    
    def _save_extracted_data(self, result: Dict[str, Any], output_dir: str):
        """
        Save extracted data to output files
        
        Args:
            result: Extraction results
            output_dir: Output directory
        """
        # Get base filename
        filename = Path(result['document_info']['filename']).stem
        
        # Save data based on output format
        output_format = self.config['output_format']
        
        if output_format == 'json' or output_format == 'all':
            # Save as JSON
            json_path = os.path.join(output_dir, f"{filename}_form_data.json")
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
        
        if output_format == 'csv' or output_format == 'all':
            # Save form fields as CSV
            csv_path = os.path.join(output_dir, f"{filename}_fields.csv")
            with open(csv_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(['Page', 'Type', 'Name', 'Label', 'Value', 'Filled'])
                
                for field in result['form_fields']:
                    writer.writerow([
                        field['page'],
                        field['type'],
                        field['name'],
                        field['label'],
                        field['value'],
                        'Yes' if field['is_filled'] else 'No'
                    ])
            
            # Save tables as separate CSV files
            for i, table in enumerate(result['tables']):
                table_csv_path = os.path.join(output_dir, f"{filename}_table_{i+1}.csv")
                with open(table_csv_path, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    for row in table['data']:
                        writer.writerow(row)
        
        if output_format == 'xml' or output_format == 'all':
            # Save as XML
            xml_path = os.path.join(output_dir, f"{filename}_form_data.xml")
            
            root = ET.Element("FormData")
            
            # Add document info
            doc_info = ET.SubElement(root, "DocumentInfo")
            ET.SubElement(doc_info, "Filename").text = result['document_info']['filename']
            ET.SubElement(doc_info, "PageCount").text = str(result['document_info']['page_count'])
            ET.SubElement(doc_info, "IsInteractiveForm").text = str(result['document_info']['is_interactive_form'])
            
            # Add form fields
            fields_elem = ET.SubElement(root, "FormFields")
            
            for field in result['form_fields']:
                field_elem = ET.SubElement(fields_elem, "Field")
                ET.SubElement(field_elem, "Page").text = str(field['page'])
                ET.SubElement(field_elem, "Type").text = field['type']
                ET.SubElement(field_elem, "Name").text = field['name']
                ET.SubElement(field_elem, "Label").text = field['label']
                ET.SubElement(field_elem, "Value").text = str(field['value'])
                ET.SubElement(field_elem, "Filled").text = 'true' if field['is_filled'] else 'false'
            
            # Add tables
            tables_elem = ET.SubElement(root, "Tables")
            
            for i, table in enumerate(result['tables']):
                table_elem = ET.SubElement(tables_elem, "Table")
                ET.SubElement(table_elem, "Index").text = str(i + 1)
                ET.SubElement(table_elem, "Page").text = str(table['page'])
                ET.SubElement(table_elem, "Rows").text = str(table['rows'])
                ET.SubElement(table_elem, "Columns").text = str(table['columns'])
                
                data_elem = ET.SubElement(table_elem, "Data")
                
                for row_idx, row in enumerate(table['data']):
                    row_elem = ET.SubElement(data_elem, "Row")
                    row_elem.attrib["index"] = str(row_idx + 1)
                    
                    for col_idx, cell in enumerate(row):
                        cell_elem = ET.SubElement(row_elem, "Cell")
                        cell_elem.attrib["index"] = str(col_idx + 1)
                        cell_elem.text = cell
            
            # Save XML file
            tree = ET.ElementTree(root)
            with open(xml_path, 'wb') as f:
                tree.write(f, encoding='utf-8', xml_declaration=True)
    
    def _generate_visualization(
        self, 
        pdf_document: fitz.Document, 
        result: Dict[str, Any], 
        output_path: str
    ):
        """
        Generate visualization of detected form fields
        
        Args:
            pdf_document: PyMuPDF document
            result: Extraction results
            output_path: Path to save visualization
        """
        # Create a PDF with annotations
        output_doc = fitz.open()
        
        # Process each page
        for page_idx in range(len(pdf_document)):
            # Get form fields on this page
            fields = [field for field in result['form_fields'] if field['page'] - 1 == page_idx]
            
            # Get tables on this page
            tables = [table for table in result['tables'] if table['page'] - 1 == page_idx]
            
            # Skip if no fields or tables
            if not fields and not tables:
                continue
            
            # Insert page
            output_doc.insert_pdf(pdf_document, from_page=page_idx, to_page=page_idx)
            output_page = output_doc[-1]
            
            # Add field annotations
            for field in fields:
                x, y, w, h = field['bbox']
                rect = fitz.Rect(x, y, x + w, y + h)
                
                # Choose color based on field type and fill status
                if field['type'] == 'text':
                    color = (0, 0, 1)  # Red
                elif field['type'] in ['checkbox', 'radio']:
                    color = (0, 0.5, 0)  # Green
                else:
                    color = (0, 0, 0)  # Black
                
                # Add opacity if filled
                opacity = 0.3 if field['is_filled'] else 0.1
                
                # Add annotation
                output_page.add_rect_annot(rect, color=color, fill=color, opacity=opacity)
                
                # Add text annotation
                if field['label'] or field['value']:
                    label = field['label'] or "No Label"
                    value = field['value'] or "Empty"
                    text = f"{label}: {value}"
                    
                    annot = output_page.add_text_annot(
                        rect.top_right + (20, 0),  # Position next to the field
                        text,
                        icon="Note"
                    )
                    annot.set_opacity(0.7)
            
            # Add table annotations
            for table in tables:
                x, y, w, h = table['bbox']
                rect = fitz.Rect(x, y, x + w, y + h)
                
                # Add table border
                output_page.add_rect_annot(rect, color=(0.7, 0, 0.7), width=2)
                
                # Add table label
                annot = output_page.add_text_annot(
                    rect.top_left + (-20, 0),  # Position before the table
                    f"Table: {table['rows']}x{table['columns']}",
                    icon="Table"
                )
                annot.set_opacity(0.7)
        
        # Save the visualization
        output_doc.save(output_path)
        output_doc.close()


def main():
    """Main function to parse arguments and run form field extraction"""
    parser = argparse.ArgumentParser(description="PDF form field extraction")
    parser.add_argument("input_path", help="Path to the PDF document")
    parser.add_argument("--output-dir", help="Directory to save extracted data")
    parser.add_argument("--output-format", choices=["json", "csv", "xml", "all"], 
                        default="json", help="Format for extracted data")
    parser.add_argument("--visualize", action="store_true", 
                        help="Generate visualization")
    parser.add_argument("--extract-tables", action="store_true", 
                        help="Extract tables from the form")
    parser.add_argument("--disable-ocr", action="store_true", 
                        help="Disable OCR for field value extraction")
    
    args = parser.parse_args()
    
    try:
        # Configure form field extractor
        config = {
            'output_format': args.output_format,
            'extract_tables': args.extract_tables,
            'enable_ocr': not args.disable_ocr,
            'visualization_enabled': args.visualize
        }
        
        # Create extractor
        extractor = FormFieldExtractor(config)
        
        # Process document
        output_dir = args.output_dir or os.path.join(os.path.dirname(args.input_path), "form_data")
        result = extractor.process_document(args.input_path, output_dir)
        
        # Print summary
        print(json.dumps({
            "filename": result['document_info']['filename'],
            "total_fields": result['total_fields'],
            "filled_fields": result['filled_fields'],
            "tables": len(result['tables']),
            "output_dir": output_dir
        }, indent=2))
        
        return 0
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())