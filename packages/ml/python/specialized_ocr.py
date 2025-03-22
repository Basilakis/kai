#!/usr/bin/env python3
"""
Specialized OCR for Material Datasheets

This module provides enhanced OCR capabilities specifically tailored for material 
datasheets and technical specifications, with features including:
1. Specialized preprocessing optimized for technical documents
2. Layout analysis focused on datasheet structures (tables, specifications, etc.)
3. Domain-specific language models and dictionaries
4. Post-processing optimized for technical values and measurements
5. Multi-language support
6. Confidence scoring with detailed metadata

Usage:
    python specialized_ocr.py <input_path> [options]

Arguments:
    input_path    Path to the image or PDF file
    
Options:
    --output-dir     Directory to save extracted text and metadata
    --language       OCR language (default: eng, can use multiple with +)
    --datasheet-type Type of datasheet (tile, stone, wood, etc.)
    --confidence     Minimum confidence threshold (0-100)
"""

import os
import sys
import json
import argparse
import cv2
import numpy as np
import pytesseract
from PIL import Image
import fitz  # PyMuPDF
from typing import Dict, List, Any, Tuple, Optional, Union
import re
import logging
from pathlib import Path
import tempfile

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Define supported languages with their Tesseract codes
SUPPORTED_LANGUAGES = {
    'eng': 'English',
    'fra': 'French',
    'spa': 'Spanish',
    'deu': 'German',
    'ita': 'Italian',
    'por': 'Portuguese',
    'rus': 'Russian',
    'ara': 'Arabic',
    'chi_sim': 'Chinese (Simplified)',
    'chi_tra': 'Chinese (Traditional)',
    'jpn': 'Japanese',
    'kor': 'Korean',
    'nld': 'Dutch',
    'pol': 'Polish',
    'swe': 'Swedish',
    'tur': 'Turkish',
    'ces': 'Czech',
    'ell': 'Greek',
    'hun': 'Hungarian',
    'ron': 'Romanian',
    'ukr': 'Ukrainian'
}

# Domain-specific dictionaries for different material types
MATERIAL_DICTIONARIES = {
    'tile': [
        # Dimensions and measurements
        'mm', 'cm', 'in', 'inches', 'x', 'by', 'thickness',
        # Material types
        'porcelain', 'ceramic', 'glass', 'mosaic', 'marble', 'granite', 'limestone', 'travertine', 'slate',
        # Technical properties
        'PEI', 'DCOF', 'COF', 'R9', 'R10', 'R11', 'R12', 'R13', 'A', 'B', 'C',
        'abrasion', 'resistance', 'frost', 'resistant', 'slip', 'water', 'absorption',
        'breaking', 'strength', 'staining', 'chemical', 'thermal', 'shock', 'expansion',
        # Finishes
        'matte', 'matt', 'polished', 'glossy', 'textured', 'structured', 'lappato', 'satin',
        'honed', 'brushed', 'hammered', 'tumbled', 'natural', 'unpolished',
        # Common colors
        'beige', 'white', 'black', 'grey', 'gray', 'brown', 'cream', 'ivory',
        'taupe', 'charcoal', 'anthracite', 'silver', 'gold'
    ],
    'wood': [
        # Dimensions and measurements
        'mm', 'cm', 'in', 'inches', 'thickness', 'width', 'length',
        # Wood types
        'oak', 'maple', 'walnut', 'cherry', 'pine', 'birch', 'mahogany', 'teak',
        'bamboo', 'ash', 'hickory', 'beech', 'cedar', 'cypress', 'fir', 'alder',
        # Technical properties
        'hardness', 'janka', 'moisture', 'content', 'tongue', 'groove', 'solid',
        'engineered', 'laminate', 'veneer', 'plank', 'parquet',
        # Finishes
        'unfinished', 'prefinished', 'oiled', 'waxed', 'stained', 'brushed',
        'hand-scraped', 'distressed', 'wire-brushed', 'natural',
        # Installation
        'floating', 'glue-down', 'nail-down', 'click', 'lock'
    ],
    'stone': [
        # Dimensions and measurements
        'mm', 'cm', 'in', 'inches', 'thickness',
        # Stone types
        'marble', 'granite', 'limestone', 'travertine', 'slate', 'quartzite',
        'onyx', 'soapstone', 'sandstone', 'basalt', 'quartz', 'terrazzo',
        # Technical properties
        'density', 'absorption', 'porosity', 'compression', 'flexural',
        'hardness', 'mohs', 'abrasion', 'resistance', 'frost', 'thermal',
        # Finishes
        'polished', 'honed', 'flamed', 'brushed', 'tumbled', 'split-face',
        'leathered', 'antiqued', 'bush-hammered', 'sandblasted', 'natural'
    ]
}


class SpecializedOCR:
    """Class for OCR processing optimized for material datasheets"""
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the specialized OCR processor
        
        Args:
            config: Configuration dictionary with settings
        """
        self.config = {
            'languages': ['eng'],
            'datasheet_type': 'tile',
            'min_confidence': 60,
            'enable_handwriting': True,
            'dpi': 300,
            'preprocess_level': 'advanced',
            'extraction_mode': 'structured',
            'table_detection': True,
            'form_field_detection': True,
            'dictionary_boost': True
        }
        
        if config:
            self.config.update(config)
        
        # Verify Tesseract is installed and languages are available
        self._verify_tesseract_setup()
    
    def _verify_tesseract_setup(self):
        """Verify Tesseract is properly installed and configured"""
        try:
            # Check if Tesseract is installed
            pytesseract.get_tesseract_version()
        except Exception as e:
            logger.error(f"Tesseract OCR is not properly installed: {e}")
            raise RuntimeError("Tesseract OCR is required but not properly installed.")
        
        # Check if requested languages are available
        available_langs = pytesseract.get_languages()
        for lang in self.config['languages']:
            if lang not in available_langs:
                logger.warning(f"Language '{lang}' is not available in Tesseract. OCR for this language may fail.")
    
    def process_file(self, file_path: str, output_dir: str = None) -> Dict[str, Any]:
        """
        Process a file (image or PDF) with specialized OCR
        
        Args:
            file_path: Path to the image or PDF file
            output_dir: Directory to save extracted text and images
            
        Returns:
            Dictionary with OCR results and metadata
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Create output directory if specified
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        
        # Determine file type
        file_ext = os.path.splitext(file_path)[1].lower()
        
        if file_ext in ['.pdf']:
            # Process PDF file
            return self.process_pdf(file_path, output_dir)
        elif file_ext in ['.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff']:
            # Process image file
            return self.process_image(file_path, output_dir)
        else:
            raise ValueError(f"Unsupported file type: {file_ext}")
    
    def process_pdf(self, pdf_path: str, output_dir: str = None) -> Dict[str, Any]:
        """
        Process a PDF file with specialized OCR
        
        Args:
            pdf_path: Path to the PDF file
            output_dir: Directory to save extracted text and images
            
        Returns:
            Dictionary with OCR results and metadata
        """
        logger.info(f"Processing PDF: {pdf_path}")
        
        # Open the PDF
        doc = fitz.open(pdf_path)
        
        # Create temporary directory for extracted images
        with tempfile.TemporaryDirectory() as temp_dir:
            # Process each page
            results = []
            form_fields = []
            
            for page_num, page in enumerate(doc):
                page_result = {
                    'page_number': page_num + 1,
                    'width': page.rect.width,
                    'height': page.rect.height,
                    'text_blocks': [],
                    'tables': [],
                    'images': []
                }
                
                # Check if PDF has form fields
                if self.config['form_field_detection']:
                    fields = page.widgets()
                    page_form_fields = []
                    
                    for field in fields:
                        field_info = {
                            'name': field.field_name,
                            'type': field.field_type_string,
                            'value': field.field_value,
                            'rect': list(field.rect),
                            'page': page_num + 1
                        }
                        page_form_fields.append(field_info)
                    
                    form_fields.extend(page_form_fields)
                    page_result['form_fields'] = page_form_fields
                
                # Extract images from the page
                image_list = page.get_images(full=True)
                
                for img_idx, img_info in enumerate(image_list):
                    xref = img_info[0]
                    base_img = doc.extract_image(xref)
                    
                    if not base_img:
                        continue
                    
                    image_bytes = base_img["image"]
                    image_ext = base_img["ext"]
                    image_filename = f"page_{page_num+1}_img_{img_idx+1}.{image_ext}"
                    image_path = os.path.join(temp_dir, image_filename)
                    
                    # Save the image
                    with open(image_path, "wb") as img_file:
                        img_file.write(image_bytes)
                    
                    # Process the image with OCR
                    try:
                        image_result = self.process_image(image_path)
                        
                        # Get image position on the page
                        rect = page.get_image_bbox(xref)
                        
                        if rect:
                            image_result['coordinates'] = {
                                'x': rect[0],
                                'y': rect[1],
                                'width': rect[2] - rect[0],
                                'height': rect[3] - rect[1]
                            }
                        
                        page_result['images'].append(image_result)
                        
                        # Save processed image if output_dir is specified
                        if output_dir:
                            output_image_path = os.path.join(output_dir, image_filename)
                            with open(output_image_path, "wb") as img_file:
                                img_file.write(image_bytes)
                    except Exception as e:
                        logger.error(f"Error processing image {image_path}: {e}")
                
                # Extract text directly from the PDF
                page_text = page.get_text("dict")
                
                # Process text blocks
                if 'blocks' in page_text:
                    for block in page_text['blocks']:
                        # Process only text blocks
                        if 'lines' in block:
                            block_text = []
                            block_bbox = block['bbox']
                            
                            for line in block['lines']:
                                if 'spans' in line:
                                    line_text = []
                                    
                                    for span in line['spans']:
                                        if span['text'].strip():
                                            line_text.append(span['text'])
                                    
                                    if line_text:
                                        block_text.append(' '.join(line_text))
                            
                            if block_text:
                                # Determine block type based on content and position
                                block_type = self._classify_text_block(' '.join(block_text), block_bbox)
                                
                                text_block = {
                                    'text': ' '.join(block_text),
                                    'type': block_type,
                                    'bbox': block_bbox,
                                    'confidence': 0.95  # Directly extracted text usually has high confidence
                                }
                                
                                page_result['text_blocks'].append(text_block)
                
                # Apply specialized OCR to detect tables and complex layouts
                if self.config['table_detection']:
                    # Convert page to image for table detection
                    pix = page.get_pixmap(dpi=300)
                    page_image_path = os.path.join(temp_dir, f"page_{page_num+1}.png")
                    pix.save(page_image_path)
                    
                    # Detect tables in the page image
                    tables = self._detect_tables(page_image_path)
                    
                    for table_idx, table in enumerate(tables):
                        # Extract table region
                        table_image_path = os.path.join(temp_dir, f"page_{page_num+1}_table_{table_idx+1}.png")
                        self._extract_region(page_image_path, table_image_path, table['bbox'])
                        
                        # Process table with OCR
                        table_result = self._process_table(table_image_path)
                        table_result['bbox'] = table['bbox']
                        
                        page_result['tables'].append(table_result)
                
                results.append(page_result)
            
            # Compile final results
            final_result = {
                'filename': os.path.basename(pdf_path),
                'path': pdf_path,
                'page_count': len(doc),
                'pages': results,
                'form_fields': form_fields,
                'metadata': {
                    'title': doc.metadata.get('title', ''),
                    'author': doc.metadata.get('author', ''),
                    'subject': doc.metadata.get('subject', ''),
                    'keywords': doc.metadata.get('keywords', ''),
                    'producer': doc.metadata.get('producer', '')
                },
                'languages_detected': self._detect_languages([r['text_blocks'] for r in results]),
                'processing_config': self.config
            }
            
            # Save results to JSON file if output_dir is specified
            if output_dir:
                output_json = os.path.join(output_dir, f"{os.path.splitext(os.path.basename(pdf_path))[0]}_ocr.json")
                with open(output_json, 'w', encoding='utf-8') as f:
                    json.dump(final_result, f, indent=2, ensure_ascii=False)
            
            return final_result
    
    def process_image(self, image_path: str, output_dir: str = None) -> Dict[str, Any]:
        """
        Process an image file with specialized OCR
        
        Args:
            image_path: Path to the image file
            output_dir: Directory to save results
            
        Returns:
            Dictionary with OCR results and metadata
        """
        logger.info(f"Processing image: {image_path}")
        
        # Preprocess the image
        preprocessed_path = self._preprocess_image(image_path, output_dir)
        
        # Load the preprocessed image
        image = cv2.imread(preprocessed_path)
        if image is None:
            raise ValueError(f"Failed to load image: {preprocessed_path}")
        
        height, width = image.shape[:2]
        
        # Detect layout and regions
        regions = self._detect_regions(preprocessed_path)
        
        # Process each region
        processed_regions = []
        
        for region in regions:
            region_type = region['type']
            region_bbox = region['bbox']
            
            # Extract region image
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                region_image_path = temp_file.name
            
            self._extract_region(preprocessed_path, region_image_path, region_bbox)
            
            # Process region based on its type
            if region_type == 'table':
                # Process as table
                table_result = self._process_table(region_image_path)
                table_result['bbox'] = region_bbox
                processed_regions.append({
                    'type': 'table',
                    'data': table_result,
                    'bbox': region_bbox
                })
            else:
                # Process text with appropriate settings for the region type
                ocr_result = self._perform_ocr(
                    region_image_path,
                    self.config['languages'],
                    region_type
                )
                
                processed_regions.append({
                    'type': region_type,
                    'text': ocr_result['text'],
                    'confidence': ocr_result['confidence'],
                    'bbox': region_bbox
                })
            
            # Clean up temporary file
            os.unlink(region_image_path)
        
        # Check for handwriting if enabled
        handwriting_regions = []
        if self.config['enable_handwriting']:
            handwriting_regions = self._detect_handwriting(preprocessed_path)
            
            for hw_region in handwriting_regions:
                # Extract handwriting region
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                    hw_image_path = temp_file.name
                
                self._extract_region(preprocessed_path, hw_image_path, hw_region['bbox'])
                
                # Process handwriting with specialized settings
                hw_result = self._perform_ocr(
                    hw_image_path,
                    self.config['languages'],
                    'handwriting'
                )
                
                processed_regions.append({
                    'type': 'handwriting',
                    'text': hw_result['text'],
                    'confidence': hw_result['confidence'],
                    'bbox': hw_region['bbox']
                })
                
                # Clean up temporary file
                os.unlink(hw_image_path)
        
        # Detect form fields if enabled
        form_fields = []
        if self.config['form_field_detection']:
            form_fields = self._detect_form_fields(preprocessed_path)
            
            for field in form_fields:
                # Extract field region
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                    field_image_path = temp_file.name
                
                self._extract_region(preprocessed_path, field_image_path, field['bbox'])
                
                # Process field with OCR
                field_result = self._perform_ocr(
                    field_image_path,
                    self.config['languages'],
                    'form_field'
                )
                
                field['value'] = field_result['text']
                field['confidence'] = field_result['confidence']
                
                # Clean up temporary file
                os.unlink(field_image_path)
        
        # Process the entire image as fallback and for comparison
        full_ocr_result = self._perform_ocr(
            preprocessed_path,
            self.config['languages'],
            'full_page'
        )
        
        # Detect languages in the text
        detected_languages = self._detect_languages([full_ocr_result['text']])
        
        # Compile results
        result = {
            'filename': os.path.basename(image_path),
            'path': image_path,
            'width': width,
            'height': height,
            'regions': processed_regions,
            'full_text': full_ocr_result['text'],
            'full_text_confidence': full_ocr_result['confidence'],
            'handwriting_detected': len(handwriting_regions) > 0,
            'form_fields': form_fields,
            'languages_detected': detected_languages,
            'processing_config': self.config
        }
        
        # Save results to JSON file if output_dir is specified
        if output_dir:
            output_json = os.path.join(output_dir, f"{os.path.splitext(os.path.basename(image_path))[0]}_ocr.json")
            with open(output_json, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            
            # Save preprocessed image if output_dir is specified
            if preprocessed_path != image_path:
                output_image = os.path.join(output_dir, f"{os.path.splitext(os.path.basename(image_path))[0]}_preprocessed.png")
                cv2.imwrite(output_image, cv2.imread(preprocessed_path))
        
        return result
    
    def _preprocess_image(self, image_path: str, output_dir: str = None) -> str:
        """
        Preprocess an image for optimal OCR
        
        Args:
            image_path: Path to the image
            output_dir: Output directory for saving the preprocessed image
            
        Returns:
            Path to the preprocessed image
        """
        # Define output path
        if output_dir:
            output_path = os.path.join(output_dir, f"{os.path.splitext(os.path.basename(image_path))[0]}_preprocessed.png")
        else:
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                output_path = temp_file.name
        
        # Read the image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Failed to load image: {image_path}")
        
        # Get preprocessing level
        level = self.config['preprocess_level']
        
        if level == 'none':
            # No preprocessing, just return the original image
            return image_path
        
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        if level == 'basic':
            # Basic preprocessing
            # Apply Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            
            # Apply adaptive thresholding
            thresh = cv2.adaptiveThreshold(
                blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY, 11, 2
            )
            
            # Save the preprocessed image
            cv2.imwrite(output_path, thresh)
            
        elif level == 'advanced':
            # Advanced preprocessing
            # Apply bilateral filter for edge-preserving noise reduction
            bilateral = cv2.bilateralFilter(gray, 9, 75, 75)
            
            # Apply adaptive thresholding
            thresh = cv2.adaptiveThreshold(
                bilateral, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY, 11, 2
            )
            
            # Apply morphological operations to clean up the image
            kernel = np.ones((2, 2), np.uint8)
            morph = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
            
            # Deskew the image if necessary
            coords = np.column_stack(np.where(morph > 0))
            if len(coords) > 0:  # Check if there are white pixels
                angle = cv2.minAreaRect(coords)[-1]
                
                if angle < -45:
                    angle = -(90 + angle)
                else:
                    angle = -angle
                
                # Only deskew if the angle is significant
                if abs(angle) > 0.5:
                    (h, w) = morph.shape[:2]
                    center = (w // 2, h // 2)
                    M = cv2.getRotationMatrix2D(center, angle, 1.0)
                    deskewed = cv2.warpAffine(
                        morph, M, (w, h), 
                        flags=cv2.INTER_CUBIC, 
                        borderMode=cv2.BORDER_REPLICATE
                    )
                else:
                    deskewed = morph
            else:
                deskewed = morph
            
            # Save the preprocessed image
            cv2.imwrite(output_path, deskewed)
        
        return output_path
    
    def _detect_regions(self, image_path: str) -> List[Dict[str, Any]]:
        """
        Detect regions in an image (text blocks, tables, etc.)
        
        Args:
            image_path: Path to the image
            
        Returns:
            List of detected regions with coordinates and types
        """
        # Load the image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Failed to load image: {image_path}")
        
        height, width = image.shape[:2]
        
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply adaptive thresholding
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY_INV, 11, 2
        )
        
        # Detect horizontal and vertical lines for table detection
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
        vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
        
        horizontal_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horizontal_kernel, iterations=2)
        vertical_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, vertical_kernel, iterations=2)
        
        # Combine horizontal and vertical lines to detect tables
        table_mask = cv2.add(horizontal_lines, vertical_lines)
        
        # Find contours in the table mask
        contours, _ = cv2.findContours(table_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Define regions
        regions = []
        
        # Add table regions
        for contour in contours:
            area = cv2.contourArea(contour)
            
            # Filter out small noise
            if area < 5000:
                continue
            
            x, y, w, h = cv2.boundingRect(contour)
            
            # Add table region
            regions.append({
                'type': 'table',
                'bbox': (x, y, w, h)
            })
        
        # Apply connected components to find text blocks
        _, labels, stats, _ = cv2.connectedComponentsWithStats(thresh, connectivity=8)
        
        # Skip the first component (background)
        for i in range(1, len(stats)):
            x, y, w, h, area = stats[i]
            
            # Filter out small components and those that overlap with table regions
            if area < 200:
                continue
            
            # Check if this component overlaps with any table region
            overlaps = False
            for region in regions:
                if region['type'] == 'table':
                    tx, ty, tw, th = region['bbox']
                    
                    # Check for overlap
                    if (x < tx + tw and x + w > tx and y < ty + th and y + h > ty):
                        overlaps = True
                        break
            
            if not overlaps:
                # Determine region type
                aspect_ratio = w / h if h > 0 else 0
                
                if aspect_ratio > 5:
                    # Long horizontal line, likely a heading
                    region_type = 'heading'
                elif aspect_ratio < 0.2:
                    # Tall narrow column, likely specifications
                    region_type = 'specifications'
                else:
                    # General text block
                    region_type = 'text'
                
                regions.append({
                    'type': region_type,
                    'bbox': (x, y, w, h)
                })
        
        # If no regions detected, use the entire image
        if not regions:
            regions.append({
                'type': 'text',
                'bbox': (0, 0, width, height)
            })
        
        return regions
    
    def _detect_tables(self, image_path: str) -> List[Dict[str, Any]]:
        """
        Detect tables in an image
        
        Args:
            image_path: Path to the image
            
        Returns:
            List of detected tables with coordinates
        """
        # Load the image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Failed to load image: {image_path}")
        
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply adaptive thresholding
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY_INV, 11, 2
        )
        
        # Detect horizontal and vertical lines
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
        vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
        
        horizontal_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horizontal_kernel, iterations=2)
        vertical_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, vertical_kernel, iterations=2)
        
        # Combine horizontal and vertical lines
        table_mask = cv2.add(horizontal_lines, vertical_lines)
        
        # Find contours in the table mask
        contours, _ = cv2.findContours(table_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Extract table regions
        tables = []
        
        for contour in contours:
            area = cv2.contourArea(contour)
            
            # Filter out small noise
            if area < 5000:
                continue
            
            x, y, w, h = cv2.boundingRect(contour)
            
            tables.append({
                'bbox': (x, y, w, h)
            })
        
        return tables
    
    def _extract_region(self, image_path: str, output_path: str, bbox: Tuple[int, int, int, int]):
        """
        Extract a region from an image
        
        Args:
            image_path: Path to the image
            output_path: Path to save the extracted region
            bbox: Bounding box of the region (x, y, width, height)
        """
        # Load the image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Failed to load image: {image_path}")
        
        # Extract region
        x, y, w, h = bbox
        region = image[y:y+h, x:x+w]
        
        # Save the region
        cv2.imwrite(output_path, region)
    
    def _process_table(self, table_image_path: str) -> Dict[str, Any]:
        """
        Process a table image with OCR
        
        Args:
            table_image_path: Path to the table image
            
        Returns:
            Dictionary with table data
        """
        # Load the image
        image = cv2.imread(table_image_path)
        if image is None:
            raise ValueError(f"Failed to load image: {table_image_path}")
        
        height, width = image.shape[:2]
        
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply adaptive thresholding
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY_INV, 11, 2
        )
        
        # Detect horizontal and vertical lines
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (width // 10, 1))
        vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, height // 10))
        
        horizontal_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horizontal_kernel, iterations=2)
        vertical_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, vertical_kernel, iterations=2)
        
        # Combine horizontal and vertical lines
        lines = cv2.add(horizontal_lines, vertical_lines)
        
        # Find contours in the lines
        contours, _ = cv2.findContours(lines, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        
        # Find intersection points (potential cell corners)
        intersections = []
        
        for i, contour1 in enumerate(contours):
            for j, contour2 in enumerate(contours):
                if i >= j:
                    continue
                
                # Check if contours are perpendicular (one horizontal, one vertical)
                rect1 = cv2.minAreaRect(contour1)
                rect2 = cv2.minAreaRect(contour2)
                
                # Get angles of the rectangles
                angle1 = rect1[2]
                angle2 = rect2[2]
                
                # Normalize angles to 0-90 degrees
                angle1 = angle1 % 90
                angle2 = angle2 % 90
                
                # Check if one is horizontal and one is vertical
                is_perpendicular = (
                    (angle1 < 10 and angle2 > 80) or
                    (angle1 > 80 and angle2 < 10)
                )
                
                if is_perpendicular:
                    # Find intersection point
                    # This is a simplified approach; in a real implementation, 
                    # we would use line equations to find the exact intersection
                    for pt1 in contour1:
                        for pt2 in contour2:
                            dist = np.linalg.norm(pt1 - pt2)
                            if dist < 10:  # If points are close, they might be an intersection
                                intersection = (
                                    (pt1[0][0] + pt2[0][0]) // 2,
                                    (pt1[0][1] + pt2[0][1]) // 2
                                )
                                intersections.append(intersection)
        
        # If we couldn't determine the table structure, try a simpler approach
        if len(intersections) < 4:
            # Divide the table into a grid of cells
            cell_width = width // 3
            cell_height = height // 3
            
            cells = []
            
            for i in range(3):
                for j in range(3):
                    x = j * cell_width
                    y = i * cell_height
                    w = cell_width
                    h = cell_height
                    
                    cells.append({
                        'row': i,
                        'col': j,
                        'bbox': (x, y, w, h)
                    })
        else:
            # Sort intersections by y, then by x
            intersections.sort(key=lambda p: (p[1], p[0]))
            
            # Determine the grid structure
            x_coords = sorted(set(p[0] for p in intersections))
            y_coords = sorted(set(p[1] for p in intersections))
            
            # Create cells from the grid
            cells = []
            
            for i in range(len(y_coords) - 1):
                for j in range(len(x_coords) - 1):
                    x = x_coords[j]
                    y = y_coords[i]
                    w = x_coords[j + 1] - x
                    h = y_coords[i + 1] - y
                    
                    cells.append({
                        'row': i,
                        'col': j,
                        'bbox': (x, y, w, h)
                    })
        
        # Process each cell with OCR
        for cell in cells:
            # Extract cell region
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                cell_image_path = temp_file.name
            
            x, y, w, h = cell['bbox']
            cell_region = image[y:y+h, x:x+w]
            cv2.imwrite(cell_image_path, cell_region)
            
            # Process cell with OCR
            ocr_result = self._perform_ocr(
                cell_image_path,
                self.config['languages'],
                'table_cell'
            )
            
            cell['text'] = ocr_result['text']
            cell['confidence'] = ocr_result['confidence']
            
            # Clean up temporary file
            os.unlink(cell_image_path)
        
        # Combine cells into table data
        # Group cells by row
        rows = {}
        for cell in cells:
            row_idx = cell['row']
            if row_idx not in rows:
                rows[row_idx] = []
            rows[row_idx].append(cell)
        
        # Sort rows by index
        sorted_rows = [rows[idx] for idx in sorted(rows.keys())]
        
        # Sort cells within each row by column index
        for row in sorted_rows:
            row.sort(key=lambda c: c['col'])
        
        # Extract text for each row
        table_data = []
        for row in sorted_rows:
            row_data = [cell['text'] for cell in row]
            table_data.append(row_data)
        
        return {
            'data': table_data,
            'cells': cells,
            'rows': len(sorted_rows),
            'columns': max(len(row) for row in sorted_rows) if sorted_rows else 0
        }
    
    def _detect_handwriting(self, image_path: str) -> List[Dict[str, Any]]:
        """
        Detect regions containing handwriting
        
        Args:
            image_path: Path to the image
            
        Returns:
            List of regions containing handwriting
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
        
        # Find contours
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Filter contours to find potential handwriting
        handwriting_regions = []
        
        for contour in contours:
            area = cv2.contourArea(contour)
            
            # Filter out small contours
            if area < 500:
                continue
            
            # Get bounding rectangle
            x, y, w, h = cv2.boundingRect(contour)
            
            # Calculate aspect ratio and density
            aspect_ratio = w / h if h > 0 else 0
            density = area / (w * h) if w * h > 0 else 0
            
            # Characteristics of handwriting:
            # - Medium aspect ratio (not too wide, not too tall)
            # - Lower density compared to printed text
            # - Irregular contour
            if 0.2 < aspect_ratio < 5 and 0.1 < density < 0.5:
                # Calculate contour irregularity
                perimeter = cv2.arcLength(contour, True)
                circularity = 4 * np.pi * area / (perimeter * perimeter) if perimeter > 0 else 0
                
                # Handwriting tends to have lower circularity
                if circularity < 0.5:
                    handwriting_regions.append({
                        'bbox': (x, y, w, h),
                        'confidence': 0.7  # Confidence in handwriting detection
                    })
        
        return handwriting_regions
    
    def _detect_form_fields(self, image_path: str) -> List[Dict[str, Any]]:
        """
        Detect form fields in an image
        
        Args:
            image_path: Path to the image
            
        Returns:
            List of detected form fields
        """
        # Load the image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Failed to load image: {image_path}")
        
        height, width = image.shape[:2]
        
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Apply Canny edge detection
        edges = cv2.Canny(blurred, 50, 150)
        
        # Dilate the edges to connect nearby edges
        kernel = np.ones((5, 5), np.uint8)
        dilated = cv2.dilate(edges, kernel, iterations=1)
        
        # Find contours
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Filter contours to find form fields
        form_fields = []
        
        for contour in contours:
            # Get bounding rectangle
            x, y, w, h = cv2.boundingRect(contour)
            
            # Calculate aspect ratio and area
            aspect_ratio = w / h if h > 0 else 0
            area = w * h
            
            # Characteristics of form fields:
            # - Rectangular shape
            # - Reasonable aspect ratio
            # - Not too small, not too large
            if 1 < aspect_ratio < 10 and 1000 < area < width * height * 0.2:
                # Check if it's a rectangle (approximately)
                perimeter = cv2.arcLength(contour, True)
                approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
                
                if len(approx) == 4:
                    # It's likely a form field (checkbox, text box, etc.)
                    
                    # Determine field type based on size and aspect ratio
                    field_type = 'text_field'
                    if aspect_ratio > 5:
                        field_type = 'text_field'
                    elif aspect_ratio < 2 and w < 50:
                        field_type = 'checkbox'
                    
                    form_fields.append({
                        'type': field_type,
                        'bbox': (x, y, w, h)
                    })
        
        return form_fields
    
    def _perform_ocr(self, image_path: str, languages: List[str], region_type: str) -> Dict[str, Any]:
        """
        Perform OCR on an image with specified settings
        
        Args:
            image_path: Path to the image
            languages: List of language codes to use
            region_type: Type of region being processed
            
        Returns:
            Dictionary with OCR results
        """
        # Get optimal OCR settings for the region type
        psm, config = self._get_optimal_ocr_settings(region_type)
        
        # Get custom dictionary for the region type if available
        custom_dict = None
        if self.config['dictionary_boost'] and self.config['datasheet_type'] in MATERIAL_DICTIONARIES:
            custom_dict = MATERIAL_DICTIONARIES[self.config['datasheet_type']]
        
        # Prepare tesseract configuration
        custom_config = f'--psm {psm} {config}'
        
        # Add custom dictionary if available
        if custom_dict and region_type in ['specifications', 'heading', 'text']:
            # Create temporary file for user patterns
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as temp_file:
                temp_file.write('\n'.join(custom_dict))
                dict_path = temp_file.name
            
            custom_config += f' --user-patterns {dict_path}'
        else:
            dict_path = None
        
        try:
            # Specify DPI if configured
            if self.config['dpi'] > 0:
                custom_config += f' --dpi {self.config["dpi"]}'
            
            # Perform OCR with the specified languages and configuration
            ocr_result = pytesseract.image_to_data(
                cv2.imread(image_path),
                lang='+'.join(languages),
                config=custom_config,
                output_type=pytesseract.Output.DICT
            )
            
            # Extract text and confidence
            text_parts = []
            total_confidence = 0
            word_count = 0
            
            for i, conf in enumerate(ocr_result['conf']):
                if conf > -1:  # Valid confidence value
                    word = ocr_result['text'][i].strip()
                    if word:
                        text_parts.append(word)
                        total_confidence += conf
                        word_count += 1
            
            text = ' '.join(text_parts)
            
            # Calculate average confidence
            avg_confidence = total_confidence / word_count if word_count > 0 else 0
            
            # Normalize confidence to 0-1 range
            confidence = avg_confidence / 100.0
            
            # Apply post-processing based on region type
            text = self._post_process_text(text, region_type)
            
            return {
                'text': text,
                'confidence': confidence
            }
            
        finally:
            # Clean up temporary file if it was created
            if dict_path and os.path.exists(dict_path):
                os.unlink(dict_path)
    
    def _get_optimal_ocr_settings(self, region_type: str) -> Tuple[int, str]:
        """
        Get optimal OCR settings for a specific region type
        
        Args:
            region_type: Type of region being processed
            
        Returns:
            Tuple of (PSM mode, additional config)
        """
        # Default configuration
        additional_config = ''
        
        if region_type == 'heading':
            # Single line of text, usually larger font
            psm = 7  # Single line
            additional_config = '--oem 3'  # LSTM only
        elif region_type == 'specifications':
            # Usually structured text with measurements
            psm = 6  # Single uniform block
            additional_config = '--oem 3'
        elif region_type == 'table_cell':
            # Single block of text in a table cell
            psm = 6  # Single uniform block
            additional_config = '--oem 3'
        elif region_type == 'handwriting':
            # Handwritten text
            psm = 13  # Raw line
            additional_config = '--oem 3'
        elif region_type == 'form_field':
            # Form field
            psm = 7  # Single line
            additional_config = '--oem 3'
        elif region_type == 'full_page':
            # Full page with multiple blocks
            psm = 3  # Fully automatic page segmentation
            additional_config = '--oem 3'
        else:
            # Default
            psm = 6  # Single uniform block
            additional_config = '--oem 3'
        
        return psm, additional_config
    
    def _post_process_text(self, text: str, region_type: str) -> str:
        """
        Post-process OCR text based on region type
        
        Args:
            text: OCR text
            region_type: Type of region
            
        Returns:
            Processed text
        """
        if not text:
            return ""
        
        # Remove excessive whitespace
        processed = re.sub(r'\s+', ' ', text).strip()
        
        if region_type == 'specifications':
            # Normalize dimensions
            processed = re.sub(r'(\d+)\s*[xX×]\s*(\d+)(\s*mm|\s*cm)?', r'\1×\2\3', processed)
            
            # Correct common OCR errors in specifications
            processed = re.sub(r'([RB])\s*(\d+)', r'\1\2', processed)  # Remove space between R/B and numbers
            processed = re.sub(r'PE\s*[l1Il|]\s*[l1Il|]', r'PEI I', processed)  # Fix PEI I
            processed = re.sub(r'PE\s*[l1Il|]\s*[l1Il|]\s*[l1Il|]', r'PEI III', processed)  # Fix PEI III
            
            # Fix common slip resistance ratings
            processed = re.sub(r'[B8]\s*[l1Il|][O0]?', r'R10', processed)
            processed = re.sub(r'[B8]\s*[l1Il|][l1Il|]', r'R11', processed)
            processed = re.sub(r'[B8]\s*9', r'R9', processed)
            
            # Normalize units
            processed = re.sub(r'(\d+)(\s*)mm', r'\1\2mm', processed)
            processed = re.sub(r'(\d+)(\s*)cm', r'\1\2cm', processed)
            
        elif region_type == 'heading':
            # Capitalize headings
            processed = re.sub(r'\b\w', lambda m: m.group(0).upper(), processed)
            
        elif region_type == 'handwriting':
            # Special processing for handwriting
            # Remove non-alphanumeric characters that might be noise
            processed = re.sub(r'[^\w\s.,\-:;"]', '', processed)
            
        return processed
    
    def _classify_text_block(self, text: str, bbox: Tuple[float, float, float, float]) -> str:
        """
        Classify a text block based on content and position
        
        Args:
            text: Text content
            bbox: Bounding box coordinates
            
        Returns:
            Classification of the text block
        """
        # Check for heading characteristics
        if len(text) < 50 and text.upper() == text:
            return 'heading'
        
        # Check for specifications based on content
        if re.search(r'\d+\s*[xX×]\s*\d+|[Rr]\d+|PEI|mm|cm', text):
            return 'specifications'
        
        # Check for product code patterns
        if re.match(r'^[A-Z0-9\-]{5,15}$', text.strip()):
            return 'product_code'
        
        # Default to general text
        return 'text'
    
    def _detect_languages(self, text_blocks: List[Any]) -> List[str]:
        """
        Detect languages in text blocks
        
        Args:
            text_blocks: List of text blocks or strings
            
        Returns:
            List of detected language codes
        """
        # This is a simplified language detection implementation
        # In a real implementation, we would use a more sophisticated language detection library
        
        # Extract text from text blocks
        all_text = ""
        
        for block in text_blocks:
            if isinstance(block, str):
                all_text += block + " "
            elif isinstance(block, list):
                for item in block:
                    if isinstance(item, dict) and 'text' in item:
                        all_text += item['text'] + " "
            elif isinstance(block, dict) and 'text' in block:
                all_text += block['text'] + " "
        
        # Count occurrences of language-specific characters
        language_scores = {}
        
        # English/Latin (default)
        latin_chars = len(re.findall(r'[a-zA-Z]', all_text))
        language_scores['eng'] = latin_chars
        
        # French - look for accented characters
        french_chars = len(re.findall(r'[éèêëàâæçüùûïîôœ]', all_text, re.IGNORECASE))
        if french_chars > 5:
            language_scores['fra'] = french_chars
        
        # German - look for umlauts and ß
        german_chars = len(re.findall(r'[äöüß]', all_text, re.IGNORECASE))
        if german_chars > 5:
            language_scores['deu'] = german_chars
        
        # Spanish - look for ñ and accented characters
        spanish_chars = len(re.findall(r'[ñáéíóúü¿¡]', all_text, re.IGNORECASE))
        if spanish_chars > 5:
            language_scores['spa'] = spanish_chars
        
        # Simplified Chinese - look for Chinese characters
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', all_text))
        if chinese_chars > 5:
            language_scores['chi_sim'] = chinese_chars
        
        # Japanese - look for Hiragana, Katakana, and Kanji
        japanese_chars = len(re.findall(r'[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]', all_text))
        if japanese_chars > 5 and chinese_chars < japanese_chars * 0.8:
            language_scores['jpn'] = japanese_chars
        
        # Russian - look for Cyrillic characters
        russian_chars = len(re.findall(r'[\u0400-\u04FF]', all_text))
        if russian_chars > 5:
            language_scores['rus'] = russian_chars
        
        # Arabic - look for Arabic characters
        arabic_chars = len(re.findall(r'[\u0600-\u06FF]', all_text))
        if arabic_chars > 5:
            language_scores['ara'] = arabic_chars
        
        # Select languages with significant scores
        detected_languages = []
        total_chars = sum(language_scores.values())
        
        if total_chars > 0:
            for lang, score in language_scores.items():
                if score > total_chars * 0.1:  # At least 10% of the text
                    detected_languages.append(lang)
        
        # If no languages detected, default to English
        if not detected_languages:
            detected_languages = ['eng']
        
        return detected_languages


def main():
    """Main function to parse arguments and run the OCR"""
    parser = argparse.ArgumentParser(description="Specialized OCR for material datasheets")
    parser.add_argument("input_path", help="Path to the image or PDF file")
    parser.add_argument("--output-dir", help="Directory to save extracted text and metadata")
    parser.add_argument("--language", default="eng", help="OCR language (default: eng, can use multiple with +)")
    parser.add_argument("--datasheet-type", default="tile", choices=["tile", "stone", "wood"], help="Type of datasheet")
    parser.add_argument("--confidence", type=int, default=60, help="Minimum confidence threshold (0-100)")
    parser.add_argument("--disable-handwriting", action="store_true", help="Disable handwriting recognition")
    parser.add_argument("--dpi", type=int, default=300, help="DPI for OCR processing")
    parser.add_argument("--preprocess", default="advanced", choices=["none", "basic", "advanced"], help="Preprocessing level")
    parser.add_argument("--disable-tables", action="store_true", help="Disable table detection")
    parser.add_argument("--disable-forms", action="store_true", help="Disable form field detection")
    
    args = parser.parse_args()
    
    try:
        # Parse languages
        languages = args.language.split('+')
        
        # Create OCR instance with configuration
        ocr = SpecializedOCR({
            'languages': languages,
            'datasheet_type': args.datasheet_type,
            'min_confidence': args.confidence,
            'enable_handwriting': not args.disable_handwriting,
            'dpi': args.dpi,
            'preprocess_level': args.preprocess,
            'table_detection': not args.disable_tables,
            'form_field_detection': not args.disable_forms
        })
        
        # Process the file
        result = ocr.process_file(args.input_path, args.output_dir)
        
        # Print a summary of the results
        print(json.dumps({
            "input_file": args.input_path,
            "output_dir": args.output_dir,
            "languages_detected": result.get('languages_detected', []),
            "text_extracted": bool(result.get('full_text', '')),
            "confidence": result.get('full_text_confidence', 0) * 100,
            "handwriting_detected": result.get('handwriting_detected', False),
            "tables_found": len(result.get('tables', [])) if 'tables' in result else sum(1 for r in result.get('regions', []) if r.get('type') == 'table'),
            "form_fields_found": len(result.get('form_fields', [])),
            "regions_found": len(result.get('regions', []))
        }, indent=2))
        
        return 0
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())