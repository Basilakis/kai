#!/usr/bin/env python3
"""
Layout Analysis for Document Processing

This module provides advanced layout analysis capabilities for complex document structures
including:
1. Table extraction and structure analysis
2. Multi-column text detection and handling
3. Diagram identification and region separation
4. Form field detection
5. Hierarchical document structure analysis

Usage:
    python layout_analysis.py <input_path> [options]

Arguments:
    input_path    Path to the document image
    
Options:
    --output-dir        Directory to save analysis results
    --output-format     Format for output (json, xml, images)
    --visualize         Generate visualization of detected layout
"""

import os
import sys
import json
import argparse
import cv2
import numpy as np
from PIL import Image
import matplotlib.pyplot as plt
import tempfile
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional, Union
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Define region types for classification
class RegionType:
    TEXT = "text"
    HEADING = "heading"
    TABLE = "table"
    DIAGRAM = "diagram"
    IMAGE = "image"
    FORM_FIELD = "form_field"
    FOOTER = "footer"
    HEADER = "header"
    COLUMN = "column"
    PAGE_NUMBER = "page_number"
    CAPTION = "caption"
    BULLET_LIST = "bullet_list"
    NUMBERED_LIST = "numbered_list"
    SPECIFICATION = "specification"
    MULTI_COLUMN = "multi_column"
    COMPLEX_TABLE = "complex_table"
    NESTED_TABLE = "nested_table"
    CHART = "chart"
    SIDEBAR = "sidebar"


class LayoutAnalyzer:
    """Class for analyzing document layout and structure"""
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the layout analyzer
        
        Args:
            config: Configuration dictionary with settings
        """
        self.config = {
            'min_table_rows': 2,
            'min_table_cols': 2,
            'min_line_length': 100,
            'table_line_thickness_range': (1, 10),
            'column_gap_min_width': 30,
            'enable_diagram_detection': True,
            'enable_form_field_detection': True,
            'visualization_dpi': 150,
            'multi_column_detection': True,
            'table_detection_mode': 'advanced',
            'line_detection_sensitivity': 0.7,
            'export_images': True
        }
        
        if config:
            self.config.update(config)
    
    def analyze_document(self, image_path: str, output_dir: str = None) -> Dict[str, Any]:
        """
        Analyze the layout of a document image
        
        Args:
            image_path: Path to the document image
            output_dir: Directory to save analysis outputs
            
        Returns:
            Dictionary with analysis results
        """
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")
        
        # Create output directory if specified
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        
        # Load the image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Failed to load image: {image_path}")
        
        # Get image properties
        height, width = image.shape[:2]
        
        # Preprocess the image for analysis
        preprocessed = self._preprocess_image(image)
        
        # Detect document orientation and correct if needed
        rotated, angle = self._correct_orientation(preprocessed)
        if abs(angle) > 1.0:
            logger.info(f"Corrected document orientation by {angle:.2f} degrees")
            preprocessed = rotated
        
        # Detect columns
        columns = []
        if self.config['multi_column_detection']:
            columns = self._detect_columns(preprocessed)
            logger.info(f"Detected {len(columns)} columns")
        
        # Detect tables
        tables = self._detect_tables(preprocessed)
        logger.info(f"Detected {len(tables)} tables")
        
        # Detect diagrams if enabled
        diagrams = []
        if self.config['enable_diagram_detection']:
            diagrams = self._detect_diagrams(preprocessed)
            logger.info(f"Detected {len(diagrams)} diagrams")
        
        # Detect form fields if enabled
        form_fields = []
        if self.config['enable_form_field_detection']:
            form_fields = self._detect_form_fields(preprocessed)
            logger.info(f"Detected {len(form_fields)} form fields")
        
        # Detect general text blocks
        text_blocks = self._detect_text_blocks(preprocessed, [
            *tables, *diagrams, *form_fields
        ])
        logger.info(f"Detected {len(text_blocks)} text blocks")
        
        # Classify text blocks (headings, body text, etc.)
        for block in text_blocks:
            block['type'] = self._classify_text_block(
                preprocessed, block['bbox'], width, height
            )
        
        # Group regions by type
        regions_by_type = {}
        for region_type in RegionType.__dict__.values():
            if isinstance(region_type, str) and not region_type.startswith('_'):
                regions_by_type[region_type] = []
        
        for table in tables:
            regions_by_type[RegionType.TABLE].append(table)
        
        for diagram in diagrams:
            regions_by_type[RegionType.DIAGRAM].append(diagram)
        
        for field in form_fields:
            regions_by_type[RegionType.FORM_FIELD].append(field)
        
        for block in text_blocks:
            if block['type'] in regions_by_type:
                regions_by_type[block['type']].append(block)
        
        # Create the document structure
        document_structure = {
            'width': width,
            'height': height,
            'orientation_angle': angle,
            'columns': columns,
            'regions': {
                region_type: regions for region_type, regions in regions_by_type.items() if regions
            },
            'element_count': {
                'tables': len(tables),
                'diagrams': len(diagrams),
                'form_fields': len(form_fields),
                'text_blocks': len(text_blocks),
                'columns': len(columns)
            }
        }
        
        # Generate visualization if output_dir is specified
        if output_dir:
            output_path = os.path.join(output_dir, f"{Path(image_path).stem}_analysis.png")
            self._generate_visualization(image, document_structure, output_path)
            document_structure['visualization_path'] = output_path
            
            # Save document structure as JSON
            json_path = os.path.join(output_dir, f"{Path(image_path).stem}_structure.json")
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(document_structure, f, indent=2, ensure_ascii=False)
            
            # Export region images if enabled
            if self.config['export_images']:
                regions_dir = os.path.join(output_dir, 'regions')
                os.makedirs(regions_dir, exist_ok=True)
                
                self._export_region_images(image, tables, os.path.join(regions_dir, 'tables'))
                self._export_region_images(image, diagrams, os.path.join(regions_dir, 'diagrams'))
                self._export_region_images(image, form_fields, os.path.join(regions_dir, 'form_fields'))
                self._export_region_images(image, text_blocks, os.path.join(regions_dir, 'text_blocks'))
        
        return document_structure
    
    def _preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocess the image for layout analysis
        
        Args:
            image: Input image as NumPy array
            
        Returns:
            Preprocessed image
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
        
        # Apply morphological operations to clean up the image
        kernel = np.ones((2, 2), np.uint8)
        morph = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        
        return morph
    
    def _correct_orientation(self, image: np.ndarray) -> Tuple[np.ndarray, float]:
        """
        Detect and correct document orientation
        
        Args:
            image: Input image as NumPy array
            
        Returns:
            Tuple of (rotated image, rotation angle)
        """
        # Find contours in the image
        contours, _ = cv2.findContours(image, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        
        # Find text lines using contours
        min_line_length = self.config['min_line_length']
        lines = []
        
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            if w > min_line_length and h < w * 0.2:  # Likely a text line
                lines.append(contour)
        
        # If not enough lines found, return original image and 0 angle
        if len(lines) < 5:
            return image, 0.0
        
        # Compute angles of lines
        angles = []
        for line in lines:
            rect = cv2.minAreaRect(line)
            angle = rect[2]
            
            # Normalize angle to -45 to 45 degrees
            if angle < -45:
                angle = 90 + angle
            
            angles.append(angle)
        
        # Filter out outliers and compute average angle
        angles.sort()
        filtered_angles = angles[len(angles)//4:3*len(angles)//4]  # Middle 50%
        avg_angle = sum(filtered_angles) / len(filtered_angles) if filtered_angles else 0.0
        
        # Rotate image if angle is significant
        if abs(avg_angle) > 0.5:
            height, width = image.shape[:2]
            center = (width // 2, height // 2)
            rotation_matrix = cv2.getRotationMatrix2D(center, avg_angle, 1.0)
            rotated = cv2.warpAffine(
                image, rotation_matrix, (width, height),
                flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
            )
            return rotated, avg_angle
        
        return image, 0.0
    
    def _detect_columns(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect columns in a document
        
        Args:
            image: Preprocessed image
            
        Returns:
            List of column regions
        """
        height, width = image.shape[:2]
        
        # Sum pixels along the vertical axis
        vertical_projection = np.sum(image, axis=0) // 255
        
        # Smooth the projection
        kernel_size = max(3, width // 100)
        kernel = np.ones(kernel_size) / kernel_size
        smoothed = np.convolve(vertical_projection, kernel, mode='same')
        
        # Find column gaps (vertical white space)
        min_gap_width = self.config['column_gap_min_width']
        threshold = np.mean(smoothed) * 0.1  # Low sum means white space
        
        gaps = []
        in_gap = False
        gap_start = 0
        
        for i, value in enumerate(smoothed):
            if value < threshold and not in_gap:
                in_gap = True
                gap_start = i
            elif value >= threshold and in_gap:
                in_gap = False
                gap_end = i
                if gap_end - gap_start >= min_gap_width:
                    gaps.append((gap_start, gap_end))
        
        # Handle case where the document ends with a gap
        if in_gap and width - gap_start >= min_gap_width:
            gaps.append((gap_start, width))
        
        # If no gaps found, assume single column
        if not gaps:
            return [{
                'type': RegionType.COLUMN,
                'bbox': (0, 0, width, height),
                'column_number': 1
            }]
        
        # Compute column boundaries from gaps
        columns = []
        
        # First column (from left edge to first gap)
        first_gap_start = gaps[0][0]
        if first_gap_start > 0:
            columns.append({
                'type': RegionType.COLUMN,
                'bbox': (0, 0, first_gap_start, height),
                'column_number': 1
            })
        
        # Middle columns (between gaps)
        for i in range(len(gaps) - 1):
            col_start = gaps[i][1]
            col_end = gaps[i+1][0]
            columns.append({
                'type': RegionType.COLUMN,
                'bbox': (col_start, 0, col_end - col_start, height),
                'column_number': i + 2
            })
        
        # Last column (from last gap to right edge)
        last_gap_end = gaps[-1][1]
        if last_gap_end < width:
            columns.append({
                'type': RegionType.COLUMN,
                'bbox': (last_gap_end, 0, width - last_gap_end, height),
                'column_number': len(columns) + 1
            })
        
        return columns
    
    def _detect_tables(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect tables in a document
        
        Args:
            image: Preprocessed image
            
        Returns:
            List of table regions
        """
        height, width = image.shape[:2]
        
        # Detect horizontal and vertical lines with different kernels to capture various table styles
        # Standard kernel for regular tables
        horizontal_kernel_std = cv2.getStructuringElement(cv2.MORPH_RECT, (min(width // 10, 100), 1))
        vertical_kernel_std = cv2.getStructuringElement(cv2.MORPH_RECT, (1, min(height // 10, 100)))
        
        # Smaller kernel for detecting finer lines in complex tables
        horizontal_kernel_fine = cv2.getStructuringElement(cv2.MORPH_RECT, (min(width // 20, 50), 1))
        vertical_kernel_fine = cv2.getStructuringElement(cv2.MORPH_RECT, (1, min(height // 20, 50)))
        
        # Larger kernel for detecting table boundaries in complex layouts
        horizontal_kernel_large = cv2.getStructuringElement(cv2.MORPH_RECT, (min(width // 5, 200), 1))
        vertical_kernel_large = cv2.getStructuringElement(cv2.MORPH_RECT, (1, min(height // 5, 200)))
        
        # Detect lines with each kernel
        horizontal_lines_std = cv2.morphologyEx(image, cv2.MORPH_OPEN, horizontal_kernel_std, iterations=2)
        vertical_lines_std = cv2.morphologyEx(image, cv2.MORPH_OPEN, vertical_kernel_std, iterations=2)
        
        horizontal_lines_fine = cv2.morphologyEx(image, cv2.MORPH_OPEN, horizontal_kernel_fine, iterations=2)
        vertical_lines_fine = cv2.morphologyEx(image, cv2.MORPH_OPEN, vertical_kernel_fine, iterations=2)
        
        horizontal_lines_large = cv2.morphologyEx(image, cv2.MORPH_OPEN, horizontal_kernel_large, iterations=2)
        vertical_lines_large = cv2.morphologyEx(image, cv2.MORPH_OPEN, vertical_kernel_large, iterations=2)
        
        # Combine all horizontal and vertical lines
        horizontal_lines = cv2.bitwise_or(horizontal_lines_std, 
                            cv2.bitwise_or(horizontal_lines_fine, horizontal_lines_large))
        vertical_lines = cv2.bitwise_or(vertical_lines_std, 
                          cv2.bitwise_or(vertical_lines_fine, vertical_lines_large))
        
        # Combine horizontal and vertical lines for table detection
        table_lines = cv2.add(horizontal_lines, vertical_lines)
        
        # Find contours of the lines
        contours, _ = cv2.findContours(table_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Group nearby contours to identify table regions
        min_distance = min(width, height) // 20
        grouped_contours = []
        
        # Sort contours by position (top to bottom, left to right)
        contours = sorted(contours, key=lambda c: (cv2.boundingRect(c)[1], cv2.boundingRect(c)[0]))
        
        # Group contours that are likely part of the same table
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            
            # Check if this contour should be grouped with existing groups
            grouped = False
            
            for group in grouped_contours:
                gx, gy, gw, gh = cv2.boundingRect(np.vstack(group))
                
                # Check if contour is near this group
                if (abs(x - (gx + gw)) < min_distance or 
                    abs((x + w) - gx) < min_distance or
                    abs(y - (gy + gh)) < min_distance or
                    abs((y + h) - gy) < min_distance or
                    (x >= gx and x + w <= gx + gw and y >= gy and y + h <= gy + gh) or
                    (gx >= x and gx + gw <= x + w and gy >= y and gy + gh <= y + h)):
                    # Add to this group
                    group.append(contour)
                    grouped = True
                    break
            
            if not grouped:
                # Create a new group
                grouped_contours.append([contour])
        
        # Extract table regions from grouped contours
        tables = []
        
        for group in grouped_contours:
            # Combine all contours in the group
            combined_contour = np.vstack(group)
            x, y, w, h = cv2.boundingRect(combined_contour)
            
            # Filter out small regions and lines
            if w < width * 0.05 or h < height * 0.02:
                continue
            
            # Check for nested tables or complex table structures
            table_region = image[y:y+h, x:x+w]
            is_complex = self._is_complex_table(table_region)
            
            # Analyze table structure to identify rows and columns
            table_structure = self._analyze_table_structure(table_region, is_complex)
            
            # Only include if it has enough rows and columns
            min_rows = self.config['min_table_rows']
            min_cols = self.config['min_table_cols']
            
            if table_structure['rows'] >= min_rows and table_structure['columns'] >= min_cols:
                # Determine table type based on complexity
                table_type = RegionType.TABLE
                if is_complex:
                    if table_structure.get('has_nested_tables', False):
                        table_type = RegionType.NESTED_TABLE
                    else:
                        table_type = RegionType.COMPLEX_TABLE
                
                tables.append({
                    'type': table_type,
                    'bbox': (x, y, w, h),
                    'structure': table_structure,
                    'is_complex': is_complex
                })
        
        return tables
    
    def _is_complex_table(self, table_image: np.ndarray) -> bool:
        """
        Determine if a table has complex structure
        
        Args:
            table_image: Image of the table region
            
        Returns:
            True if the table has complex structure, False otherwise
        """
        height, width = table_image.shape[:2]
        
        # Detect horizontal and vertical lines
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (width // 5, 1))
        vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, height // 5))
        
        horizontal_lines = cv2.morphologyEx(table_image, cv2.MORPH_OPEN, horizontal_kernel, iterations=2)
        vertical_lines = cv2.morphologyEx(table_image, cv2.MORPH_OPEN, vertical_kernel, iterations=2)
        
        # Analyze line patterns for complex structures
        # 1. Check for irregular or broken lines
        h_projection = np.sum(horizontal_lines, axis=1) // 255
        v_projection = np.sum(vertical_lines, axis=0) // 255
        
        # Calculate line regularity - standard deviation of distances between lines
        h_indices = [i for i, val in enumerate(h_projection) if val > width * 0.2]
        v_indices = [i for i, val in enumerate(v_projection) if val > height * 0.2]
        
        # Calculate distances between consecutive lines
        h_distances = [h_indices[i+1] - h_indices[i] for i in range(len(h_indices)-1)] if len(h_indices) > 1 else [0]
        v_distances = [v_indices[i+1] - v_indices[i] for i in range(len(v_indices)-1)] if len(v_indices) > 1 else [0]
        
        # Compute standard deviation of distances
        h_std = np.std(h_distances) if h_distances else 0
        v_std = np.std(v_distances) if v_distances else 0
        
        # 2. Check for varying cell sizes
        h_density = np.sum(h_projection > 0) / len(h_projection) if len(h_projection) > 0 else 0
        v_density = np.sum(v_projection > 0) / len(v_projection) if len(v_projection) > 0 else 0
        
        # 3. Detect complex structure based on computed metrics
        is_complex = (
            (h_std > 10 or v_std > 10) or  # Irregular line spacing
            (h_density < 0.1 or v_density < 0.1) or  # Sparse lines
            (len(h_indices) > 15 or len(v_indices) > 15)  # Many lines (likely complex)
        )
        
        return is_complex
    
    def _analyze_table_structure(self, table_image: np.ndarray, is_complex: bool = False) -> Dict[str, Any]:
        """
        Analyze the structure of a table
        
        Args:
            table_image: Image of the table region
            is_complex: Flag indicating if this is a complex table
            
        Returns:
            Dictionary with table structure information
        """
        height, width = table_image.shape[:2]
        
        # Use different kernel sizes for complex tables
        if is_complex:
            # Multiple kernel sizes to capture both fine and coarse structures
            h_kernels = [
                cv2.getStructuringElement(cv2.MORPH_RECT, (width // 20, 1)),  # Fine
                cv2.getStructuringElement(cv2.MORPH_RECT, (width // 10, 1)),  # Medium
                cv2.getStructuringElement(cv2.MORPH_RECT, (width // 5, 1)),   # Coarse
            ]
            v_kernels = [
                cv2.getStructuringElement(cv2.MORPH_RECT, (1, height // 20)), # Fine
                cv2.getStructuringElement(cv2.MORPH_RECT, (1, height // 10)), # Medium
                cv2.getStructuringElement(cv2.MORPH_RECT, (1, height // 5)),  # Coarse
            ]
            
            # Apply each kernel and combine results
            horizontal_lines = None
            vertical_lines = None
            
            for kernel in h_kernels:
                h_lines = cv2.morphologyEx(table_image, cv2.MORPH_OPEN, kernel, iterations=2)
                if horizontal_lines is None:
                    horizontal_lines = h_lines
                else:
                    horizontal_lines = cv2.bitwise_or(horizontal_lines, h_lines)
            
            for kernel in v_kernels:
                v_lines = cv2.morphologyEx(table_image, cv2.MORPH_OPEN, kernel, iterations=2)
                if vertical_lines is None:
                    vertical_lines = v_lines
                else:
                    vertical_lines = cv2.bitwise_or(vertical_lines, v_lines)
        else:
            # Standard kernels for regular tables
            horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (width // 5, 1))
            vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, height // 5))
            
            horizontal_lines = cv2.morphologyEx(table_image, cv2.MORPH_OPEN, horizontal_kernel, iterations=2)
            vertical_lines = cv2.morphologyEx(table_image, cv2.MORPH_OPEN, vertical_kernel, iterations=2)
        
        # Find row boundaries from horizontal lines
        h_projection = np.sum(horizontal_lines, axis=1) // 255
        row_positions = [i for i, val in enumerate(h_projection) if val > width * 0.2]
        
        # Group adjacent positions to find row boundaries
        rows = []
        if row_positions:
            row_start = row_positions[0]
            for i in range(1, len(row_positions)):
                if row_positions[i] > row_positions[i-1] + 2:  # Gap in projection
                    rows.append((row_start, row_positions[i-1]))
                    row_start = row_positions[i]
            rows.append((row_start, row_positions[-1]))
        
        # Find column boundaries from vertical lines
        v_projection = np.sum(vertical_lines, axis=0) // 255
        col_positions = [i for i, val in enumerate(v_projection) if val > height * 0.2]
        
        # Group adjacent positions to find column boundaries
        columns = []
        if col_positions:
            col_start = col_positions[0]
            for i in range(1, len(col_positions)):
                if col_positions[i] > col_positions[i-1] + 2:  # Gap in projection
                    columns.append((col_start, col_positions[i-1]))
                    col_start = col_positions[i]
            columns.append((col_start, col_positions[-1]))
        
        # If rows or columns not found, use heuristic
        if not rows:
            # Divide height into equal parts based on complexity
            row_count = 6 if is_complex else 4
            row_height = height // row_count
            rows = [(i * row_height, (i + 1) * row_height) for i in range(row_count)]
        
        if not columns:
            # Divide width into equal parts based on complexity
            col_count = 5 if is_complex else 3
            col_width = width // col_count
            columns = [(i * col_width, (i + 1) * col_width) for i in range(col_count)]
        
        # For complex tables, detect merged cells
        merged_cells = []
        if is_complex:
            merged_cells = self._detect_merged_cells(table_image, rows, columns)
        
        # Check for nested tables
        has_nested_tables = False
        nested_tables = []
        if is_complex:
            nested_tables, has_nested_tables = self._detect_nested_tables(table_image, rows, columns)
        
        # Create cell definitions from row and column boundaries
        cells = []
        # Track already included cells from merged areas
        included_cells = set()
        
        # First add merged cells
        for merged_cell in merged_cells:
            min_row, max_row, min_col, max_col = merged_cell
            
            # Mark all cells in this merged area as included
            for r in range(min_row, max_row + 1):
                for c in range(min_col, max_col + 1):
                    included_cells.add((r, c))
            
            # Add the merged cell definition
            row_start = rows[min_row][0]
            row_end = rows[max_row][1]
            col_start = columns[min_col][0]
            col_end = columns[max_col][1]
            
            cells.append({
                'row_span': max_row - min_row + 1,
                'col_span': max_col - min_col + 1,
                'min_row': min_row + 1,
                'max_row': max_row + 1,
                'min_col': min_col + 1,
                'max_col': max_col + 1,
                'bbox': (col_start, row_start, col_end - col_start, row_end - row_start),
                'is_merged': True
            })
        
        # Then add regular cells
        for i, (row_start, row_end) in enumerate(rows):
            for j, (col_start, col_end) in enumerate(columns):
                # Skip if this cell is part of a merged cell
                if (i, j) in included_cells:
                    continue
                
                # Check if this cell contains a nested table
                is_nested_table = False
                nested_table_idx = -1
                
                for idx, nested_table in enumerate(nested_tables):
                    nt_row, nt_col = nested_table['position']
                    if nt_row == i and nt_col == j:
                        is_nested_table = True
                        nested_table_idx = idx
                        break
                
                cells.append({
                    'row': i + 1,
                    'column': j + 1,
                    'bbox': (col_start, row_start, col_end - col_start, row_end - row_start),
                    'is_merged': False,
                    'contains_nested_table': is_nested_table,
                    'nested_table_idx': nested_table_idx if is_nested_table else -1
                })
        
        return {
            'rows': len(rows),
            'columns': len(columns),
            'cells': cells,
            'merged_cells': merged_cells,
            'has_merged_cells': len(merged_cells) > 0,
            'nested_tables': nested_tables,
            'has_nested_tables': has_nested_tables
        }
    
    def _detect_merged_cells(
        self, 
        table_image: np.ndarray, 
        rows: List[Tuple[int, int]], 
        columns: List[Tuple[int, int]]
    ) -> List[Tuple[int, int, int, int]]:
        """
        Detect merged cells in complex tables
        
        Args:
            table_image: Image of the table region
            rows: List of row boundaries
            columns: List of column boundaries
            
        Returns:
            List of merged cell definitions as (min_row, max_row, min_col, max_col)
        """
        height, width = table_image.shape[:2]
        merged_cells = []
        
        # Create a grid representation of the table
        grid = np.zeros((len(rows), len(columns)), dtype=np.uint8)
        
        # Detect horizontal and vertical lines
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (width // 5, 1))
        vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, height // 5))
        
        horizontal_lines = cv2.morphologyEx(table_image, cv2.MORPH_OPEN, horizontal_kernel, iterations=2)
        vertical_lines = cv2.morphologyEx(table_image, cv2.MORPH_OPEN, vertical_kernel, iterations=2)
        
        # For each cell, check if there are lines dividing it
        for i in range(len(rows) - 1):
            for j in range(len(columns) - 1):
                row_start, row_end = rows[i][0], rows[i][1]
                col_start, col_end = columns[j][0], columns[j][1]
                
                # Check for horizontal line at bottom of cell
                h_line_region = horizontal_lines[row_end-2:row_end+2, col_start:col_end]
                h_line_present = np.sum(h_line_region) > (col_end - col_start) * 255 * 0.2
                
                # Check for vertical line at right of cell
                v_line_region = vertical_lines[row_start:row_end, col_end-2:col_end+2]
                v_line_present = np.sum(v_line_region) > (row_end - row_start) * 255 * 0.2
                
                # Mark grid cell as part of potential merged cell
                if not h_line_present or not v_line_present:
                    grid[i, j] = 1
        
        # Identify connected components in the grid (merged cells)
        num_labels, labels = cv2.connectedComponents(grid)
        
        # Process each connected component
        for label in range(1, num_labels):
            label_mask = (labels == label)
            rows_with_label, cols_with_label = np.where(label_mask)
            
            if len(rows_with_label) > 0 and len(cols_with_label) > 0:
                min_row = np.min(rows_with_label)
                max_row = np.max(rows_with_label)
                min_col = np.min(cols_with_label)
                max_col = np.max(cols_with_label)
                
                # Only add if it spans multiple cells
                if min_row != max_row or min_col != max_col:
                    merged_cells.append((min_row, max_row, min_col, max_col))
        
        return merged_cells
    
    def _detect_nested_tables(
        self, 
        table_image: np.ndarray, 
        rows: List[Tuple[int, int]], 
        columns: List[Tuple[int, int]]
    ) -> Tuple[List[Dict[str, Any]], bool]:
        """
        Detect nested tables within a complex table
        
        Args:
            table_image: Image of the table region
            rows: List of row boundaries
            columns: List of column boundaries
            
        Returns:
            Tuple of (list of nested table definitions, boolean indicating if nested tables exist)
        """
        nested_tables = []
        
        # For each cell in the table
        for i, (row_start, row_end) in enumerate(rows):
            for j, (col_start, col_end) in enumerate(columns):
                # Extract the cell image
                cell_image = table_image[row_start:row_end, col_start:col_end]
                cell_height, cell_width = cell_image.shape[:2]
                
                # Skip small cells
                if cell_height < 50 or cell_width < 50:
                    continue
                
                # Check if cell contains a table structure
                h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (cell_width // 5, 1))
                v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, cell_height // 5))
                
                h_lines = cv2.morphologyEx(cell_image, cv2.MORPH_OPEN, h_kernel, iterations=2)
                v_lines = cv2.morphologyEx(cell_image, cv2.MORPH_OPEN, v_kernel, iterations=2)
                
                # Count horizontal and vertical lines
                h_projection = np.sum(h_lines, axis=1) // 255
                v_projection = np.sum(v_lines, axis=0) // 255
                
                h_lines_count = np.sum(h_projection > cell_width * 0.2)
                v_lines_count = np.sum(v_projection > cell_height * 0.2)
                
                # If multiple lines in both directions, likely a nested table
                if h_lines_count >= 2 and v_lines_count >= 2:
                    # Simple structure analysis
                    nested_structure = {
                        'estimated_rows': int(h_lines_count) + 1,
                        'estimated_columns': int(v_lines_count) + 1,
                        'position': (i, j),
                        'bbox': (col_start, row_start, cell_width, cell_height)
                    }
                    nested_tables.append(nested_structure)
        
        return nested_tables, len(nested_tables) > 0
    
    def _detect_diagrams(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect diagrams and figures in a document
        
        Args:
            image: Preprocessed image
            
        Returns:
            List of diagram regions
        """
        height, width = image.shape[:2]
        
        # Invert the image (diagrams typically have more white space)
        inverted = cv2.bitwise_not(image)
        
        # Apply morphological operations to isolate diagram regions
        kernel = np.ones((15, 15), np.uint8)
        dilated = cv2.dilate(inverted, kernel, iterations=1)
        eroded = cv2.erode(dilated, kernel, iterations=1)
        
        # Find contours of potential diagram regions
        contours, _ = cv2.findContours(eroded, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Filter contours to find diagram regions
        diagrams = []
        min_area = width * height * 0.01  # Minimum 1% of page area
        
        for contour in contours:
            area = cv2.contourArea(contour)
            
            if area < min_area:
                continue
            
            x, y, w, h = cv2.boundingRect(contour)
            
            # Calculate region density and complexity
            region = image[y:y+h, x:x+w]
            pixel_count = np.sum(region > 0)
            density = pixel_count / (w * h)
            
            # Diagrams typically have lower density and higher complexity
            if density < 0.2:
                # Check for higher complexity (variation in pixel distribution)
                std_dev = np.std(region)
                
                if std_dev > 50:
                    diagrams.append({
                        'type': RegionType.DIAGRAM,
                        'bbox': (x, y, w, h),
                        'features': {
                            'density': float(density),
                            'complexity': float(std_dev)
                        }
                    })
        
        return diagrams
    
    def _detect_form_fields(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect form fields in a document
        
        Args:
            image: Preprocessed image
            
        Returns:
            List of form field regions
        """
        height, width = image.shape[:2]
        
        # Apply morphological operations to isolate form field regions
        kernel = np.ones((3, 3), np.uint8)
        dilated = cv2.dilate(image, kernel, iterations=1)
        
        # Find contours of potential form fields
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Filter contours to find form fields
        form_fields = []
        
        for contour in contours:
            # Approximate the contour to find rectangles
            perimeter = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
            
            # Check if it's approximately a rectangle
            if len(approx) == 4:
                x, y, w, h = cv2.boundingRect(contour)
                
                # Calculate aspect ratio
                aspect_ratio = w / h if h > 0 else 0
                
                # Form fields typically have specific aspect ratios
                if 1 < aspect_ratio < 10 and w > 20 and h > 10:
                    # Check if it's empty inside (form fields are usually empty)
                    mask = np.zeros(image.shape, dtype=np.uint8)
                    cv2.drawContours(mask, [contour], 0, 255, -1)
                    mask = cv2.erode(mask, kernel, iterations=1)
                    
                    # Count non-zero pixels inside the contour
                    inside_pixels = cv2.countNonZero(cv2.bitwise_and(image, mask))
                    total_pixels = cv2.countNonZero(mask)
                    
                    if total_pixels > 0 and inside_pixels / total_pixels < 0.1:
                        # Determine field type based on shape
                        field_type = "text_field"
                        if aspect_ratio < 1.5 and w < 30:
                            field_type = "checkbox"
                        elif aspect_ratio > 5:
                            field_type = "text_field"
                        
                        form_fields.append({
                            'type': RegionType.FORM_FIELD,
                            'field_type': field_type,
                            'bbox': (x, y, w, h)
                        })
        
        return form_fields
    
    def _detect_text_blocks(
        self, 
        image: np.ndarray, 
        existing_regions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Detect text blocks in a document
        
        Args:
            image: Preprocessed image
            existing_regions: List of already detected regions to exclude
            
        Returns:
            List of text block regions
        """
        height, width = image.shape[:2]
        
        # Create a mask for existing regions
        mask = np.zeros(image.shape, dtype=np.uint8)
        
        for region in existing_regions:
            x, y, w, h = region['bbox']
            cv2.rectangle(mask, (x, y), (x + w, y + h), 255, -1)
        
        # Remove existing regions from the image
        masked_image = cv2.bitwise_and(image, image, mask=cv2.bitwise_not(mask))
        
        # Clean up the image to merge text lines into blocks
        kernel = np.ones((5, 20), np.uint8)
        cleaned = cv2.morphologyEx(masked_image, cv2.MORPH_CLOSE, kernel)
        
        # Find contours of potential text blocks
        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Filter contours to find text blocks
        text_blocks = []
        min_area = 100  # Minimum area for a text block
        
        for contour in contours:
            area = cv2.contourArea(contour)
            
            if area < min_area:
                continue
            
            x, y, w, h = cv2.boundingRect(contour)
            
            # Calculate region density
            region = masked_image[y:y+h, x:x+w]
            pixel_count = np.sum(region > 0)
            density = pixel_count / (w * h)
            
            # Text blocks typically have medium density
            if 0.05 < density < 0.5:
                text_blocks.append({
                    'type': RegionType.TEXT,  # Default type, will be classified later
                    'bbox': (x, y, w, h),
                    'features': {
                        'density': float(density),
                        'area': float(area)
                    }
                })
        
        return text_blocks
    
    def _classify_text_block(
        self, 
        image: np.ndarray, 
        bbox: Tuple[int, int, int, int],
        image_width: int,
        image_height: int
    ) -> str:
        """
        Classify a text block by type
        
        Args:
            image: Preprocessed image
            bbox: Bounding box of the text block
            image_width: Width of the full image
            image_height: Height of the full image
            
        Returns:
            Region type classification
        """
        x, y, w, h = bbox
        region = image[y:y+h, x:x+w]
        
        # Extract features for classification
        relative_y = y / image_height
        relative_x = x / image_width
        relative_width = w / image_width
        relative_height = h / image_height
        aspect_ratio = w / h if h > 0 else 0
        
        # Calculate region density and line patterns
        pixel_count = np.sum(region > 0)
        density = pixel_count / (w * h) if w * h > 0 else 0
        
        # Project along y-axis to find text lines
        y_projection = np.sum(region, axis=1) // 255
        lines = []
        in_line = False
        line_start = 0
        
        for i, val in enumerate(y_projection):
            if val > 0 and not in_line:
                in_line = True
                line_start = i
            elif val == 0 and in_line:
                in_line = False
                line_height = i - line_start
                lines.append(line_height)
        
        if in_line:
            line_height = len(y_projection) - line_start
            lines.append(line_height)
        
        avg_line_height = sum(lines) / len(lines) if lines else 0
        line_count = len(lines)
        
        # Calculate features derived from lines
        line_spacing_consistency = np.std(lines) / avg_line_height if avg_line_height > 0 else 0
        
        # Classification based on features
        
        # Check for heading
        if (relative_y < 0.2 or line_count <= 2) and aspect_ratio > 2:
            return RegionType.HEADING
        
        # Check for footer
        if relative_y > 0.8 and relative_height < 0.1:
            return RegionType.FOOTER
        
        # Check for header
        if relative_y < 0.1 and relative_height < 0.1:
            return RegionType.HEADER
        
        # Check for page number
        if (relative_y > 0.9 or relative_y < 0.1) and relative_width < 0.1:
            return RegionType.PAGE_NUMBER
        
        # Check for bullet list
        left_margin = np.sum(region[:, :5], axis=0)
        if line_count > 2 and left_margin.std() > 10 and aspect_ratio > 2:
            return RegionType.BULLET_LIST
        
        # Check for specification block
        if aspect_ratio > 3 and line_count > 1 and density > 0.2:
            # Check for patterns like "Key: Value" in specifications
            # This is a simplified heuristic
            col_variance = np.var(np.sum(region, axis=0))
            if col_variance > 1000:  # High variance suggests structured layout
                return RegionType.SPECIFICATION
        
        # Check for caption
        if line_count <= 2 and (relative_y < 0.3 or relative_y > 0.7):
            return RegionType.CAPTION
        
        # Default is body text
        return RegionType.TEXT
    
    def _generate_visualization(
        self, 
        image: np.ndarray, 
        document_structure: Dict[str, Any],
        output_path: str
    ):
        """
        Generate visualization of document layout analysis
        
        Args:
            image: Original image
            document_structure: Document structure from analysis
            output_path: Path to save visualization
        """
        # Create a copy of the image for visualization
        viz_image = image.copy()
        
        # Define colors for different region types
        colors = {
            RegionType.TABLE: (0, 0, 255),       # Red
            RegionType.HEADING: (0, 255, 0),     # Green
            RegionType.TEXT: (255, 0, 0),        # Blue
            RegionType.DIAGRAM: (255, 255, 0),   # Cyan
            RegionType.FORM_FIELD: (255, 0, 255),# Magenta
            RegionType.FOOTER: (0, 255, 255),    # Yellow
            RegionType.HEADER: (128, 0, 0),      # Dark blue
            RegionType.COLUMN: (0, 128, 0),      # Dark green
            RegionType.PAGE_NUMBER: (0, 0, 128), # Dark red
            RegionType.CAPTION: (128, 128, 0),   # Dark cyan
            RegionType.BULLET_LIST: (128, 0, 128),# Dark magenta
            RegionType.SPECIFICATION: (0, 128, 128),# Dark yellow
            RegionType.IMAGE: (192, 192, 192),   # Light gray
            RegionType.NUMBERED_LIST: (128, 128, 128) # Gray
        }
        
        # Draw columns with transparent overlay
        for column in document_structure.get('columns', []):
            x, y, w, h = column['bbox']
            overlay = viz_image.copy()
            cv2.rectangle(overlay, (x, y), (x + w, y + h), (0, 255, 0), -1)
            cv2.addWeighted(overlay, 0.2, viz_image, 0.8, 0, viz_image)
            cv2.rectangle(viz_image, (x, y), (x + w, y + h), (0, 255, 0), 2)
            cv2.putText(viz_image, f"Column {column['column_number']}", (x, y-5),
                      cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        
        # Draw regions by type
        for region_type, regions in document_structure.get('regions', {}).items():
            if region_type in colors:
                for i, region in enumerate(regions):
                    x, y, w, h = region['bbox']
                    cv2.rectangle(viz_image, (x, y), (x + w, y + h), colors[region_type], 2)
                    cv2.putText(viz_image, region_type, (x, y-5),
                              cv2.FONT_HERSHEY_SIMPLEX, 0.5, colors[region_type], 1)
        
        # Save the visualization
        cv2.imwrite(output_path, viz_image)
    
    def _export_region_images(
        self, 
        image: np.ndarray, 
        regions: List[Dict[str, Any]],
        output_dir: str
    ):
        """
        Export individual images for each region
        
        Args:
            image: Original image
            regions: List of regions
            output_dir: Directory to save region images
        """
        os.makedirs(output_dir, exist_ok=True)
        
        for i, region in enumerate(regions):
            x, y, w, h = region['bbox']
            region_image = image[y:y+h, x:x+w]
            
            # Create filename based on region type and index
            region_type = region.get('type', 'unknown')
            output_path = os.path.join(output_dir, f"{region_type}_{i+1}.png")
            
            cv2.imwrite(output_path, region_image)
            
            # Add path to region data
            region['image_path'] = output_path
    

def main():
    """Main function to parse arguments and run the analysis"""
    parser = argparse.ArgumentParser(description="Document layout analysis")
    parser.add_argument("input_path", help="Path to the document image")
    parser.add_argument("--output-dir", help="Directory to save analysis results")
    parser.add_argument("--output-format", choices=["json", "xml", "images"], 
                      default="json", help="Format for output")
    parser.add_argument("--visualize", action="store_true", help="Generate visualization")
    parser.add_argument("--disable-diagrams", action="store_true", help="Disable diagram detection")
    parser.add_argument("--disable-forms", action="store_true", help="Disable form field detection")
    parser.add_argument("--disable-columns", action="store_true", help="Disable column detection")
    
    args = parser.parse_args()
    
    try:
        # Create layout analyzer instance with configuration
        analyzer = LayoutAnalyzer({
            'enable_diagram_detection': not args.disable_diagrams,
            'enable_form_field_detection': not args.disable_forms,
            'multi_column_detection': not args.disable_columns,
            'export_images': args.output_format == "images" or args.visualize
        })
        
        # Analyze document
        result = analyzer.analyze_document(args.input_path, args.output_dir)
        
        # Print summary
        print(json.dumps({
            "input_file": args.input_path,
            "output_dir": args.output_dir,
            "result_summary": {
                "tables": result['element_count']['tables'],
                "diagrams": result['element_count']['diagrams'],
                "form_fields": result['element_count']['form_fields'],
                "text_blocks": result['element_count']['text_blocks'],
                "columns": result['element_count']['columns']
            }
        }, indent=2))
        
        return 0
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())