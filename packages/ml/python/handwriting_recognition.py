#!/usr/bin/env python3
"""
Handwriting Recognition for Document Processing

This module provides specialized capabilities for detecting and recognizing handwritten
text in documents, including:
1. Handwriting detection in mixed documents
2. Preprocessing optimized for handwritten text
3. Recognition using models trained for handwriting
4. Confidence scoring for handwritten text
5. Support for cursive and printed handwriting styles

Usage:
    python handwriting_recognition.py <input_path> [options]

Arguments:
    input_path    Path to the document image
    
Options:
    --output-dir      Directory to save results
    --language        Language code for recognition (default: eng)
    --min-confidence  Minimum confidence threshold (0-100)
    --visualize       Generate visualization of detected handwriting
"""

import os
import sys
import json
import argparse
import cv2
import numpy as np
from PIL import Image
import pytesseract
import tempfile
from typing import Dict, List, Any, Tuple, Optional, Union
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Define constants
DEFAULT_DPI = 300
HANDWRITING_CONFIDENCE_THRESHOLD = 0.5
SUPPORTED_LANGUAGES = {
    'eng': 'English',
    'fra': 'French',
    'deu': 'German',
    'ita': 'Italian',
    'spa': 'Spanish',
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
    'ukr': 'Ukrainian',
    'por': 'Portuguese'
}


class HandwritingDetector:
    """Class for detecting and recognizing handwritten text in documents"""
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the handwriting detector
        
        Args:
            config: Configuration dictionary with settings
        """
        self.config = {
            'language': 'eng',
            'min_confidence': 50,
            'dpi': DEFAULT_DPI,
            'detection_sensitivity': 0.7,
            'preprocessing_level': 'advanced',
            'segmentation_mode': 'adaptive',
            'recognition_mode': 'tesseract',
            'enable_post_processing': True,
            'visualization_enabled': True
        }
        
        if config:
            self.config.update(config)
        
        # Verify Tesseract is installed
        self._verify_tesseract_setup()
    
    def _verify_tesseract_setup(self):
        """Verify Tesseract is properly installed and configured"""
        try:
            # Check if Tesseract is installed
            pytesseract.get_tesseract_version()
        except Exception as e:
            logger.error(f"Tesseract OCR is not properly installed: {e}")
            raise RuntimeError("Tesseract OCR is required but not properly installed.")
        
        # Check if requested language is available
        available_langs = pytesseract.get_languages()
        if self.config['language'] not in available_langs:
            logger.warning(f"Language '{self.config['language']}' is not available in Tesseract")
    
    def process_document(self, image_path: str, output_dir: str = None) -> Dict[str, Any]:
        """
        Process a document image to detect and recognize handwritten text
        
        Args:
            image_path: Path to the document image
            output_dir: Directory to save results
            
        Returns:
            Dictionary with detection and recognition results
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
        
        # Detect handwritten regions
        handwritten_regions = self._detect_handwritten_regions(image)
        logger.info(f"Detected {len(handwritten_regions)} handwritten regions")
        
        # Process each handwritten region
        processed_regions = []
        
        for i, region in enumerate(handwritten_regions):
            region_result = self._process_handwritten_region(image, region)
            processed_regions.append(region_result)
            
            # Save region image if output_dir is specified
            if output_dir:
                x, y, w, h = region['bbox']
                region_image = image[y:y+h, x:x+w]
                region_path = os.path.join(output_dir, f"handwriting_{i+1}.png")
                cv2.imwrite(region_path, region_image)
                region_result['image_path'] = region_path
        
        # Filter out low-confidence regions
        min_confidence = self.config['min_confidence'] / 100.0
        confident_regions = [
            r for r in processed_regions 
            if r['confidence'] >= min_confidence
        ]
        
        # Compile results
        result = {
            'filename': os.path.basename(image_path),
            'path': image_path,
            'width': width,
            'height': height,
            'handwriting_detected': len(handwritten_regions) > 0,
            'regions_detected': len(handwritten_regions),
            'regions_confident': len(confident_regions),
            'regions': processed_regions,
            'combined_text': '\n'.join([r['text'] for r in confident_regions if r['text']]),
            'average_confidence': sum([r['confidence'] for r in processed_regions]) / len(processed_regions) if processed_regions else 0,
            'processing_config': self.config
        }
        
        # Generate visualization if enabled
        if self.config['visualization_enabled'] and output_dir:
            viz_path = os.path.join(output_dir, f"{Path(image_path).stem}_handwriting.png")
            self._generate_visualization(image, handwritten_regions, processed_regions, viz_path)
            result['visualization_path'] = viz_path
        
        # Save results to JSON if output_dir is specified
        if output_dir:
            json_path = os.path.join(output_dir, f"{Path(image_path).stem}_handwriting.json")
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
        
        return result
    
    def _detect_handwritten_regions(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect regions containing handwritten text
        
        Args:
            image: Input image as NumPy array
            
        Returns:
            List of detected handwritten regions
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
        
        # Detect unique characteristics of handwriting
        
        # 1. Stroke width variation - handwriting typically has more variation
        kernel = np.ones((3, 3), np.uint8)
        dilated = cv2.dilate(thresh, kernel, iterations=1)
        eroded = cv2.erode(thresh, kernel, iterations=1)
        stroke_var = cv2.absdiff(dilated, eroded)
        
        # 2. Connected components analysis
        # Set minimum area for a handwriting component
        min_area = 100
        max_area = gray.shape[0] * gray.shape[1] * 0.2  # Max 20% of image
        
        # Find contours
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Candidate regions for handwriting
        candidate_regions = []
        
        for contour in contours:
            area = cv2.contourArea(contour)
            
            # Filter by area
            if area < min_area or area > max_area:
                continue
            
            # Get bounding rectangle
            x, y, w, h = cv2.boundingRect(contour)
            
            # Calculate aspect ratio
            aspect_ratio = w / h if h > 0 else 0
            
            # Calculate region statistics
            region = stroke_var[y:y+h, x:x+w]
            
            # Check region characteristics
            # Handwriting typically has:
            # - Medium stroke width variation
            # - Irregular contour with low circularity
            # - Reasonable aspect ratio (not too wide or tall)
            
            # Calculate average stroke width variation
            stroke_variation = np.mean(region)
            
            # Calculate contour regularity
            perimeter = cv2.arcLength(contour, True)
            circularity = 4 * np.pi * area / (perimeter * perimeter) if perimeter > 0 else 0
            
            # Calculate region density
            region_thresh = thresh[y:y+h, x:x+w]
            density = np.count_nonzero(region_thresh) / (w * h) if w * h > 0 else 0
            
            # Rule-based classification of handwriting
            is_handwriting = (
                stroke_variation > 20 and  # High stroke variation
                circularity < 0.5 and      # Low circularity (irregular shape)
                0.1 < aspect_ratio < 10 and  # Reasonable aspect ratio
                0.05 < density < 0.5       # Medium density
            )
            
            if is_handwriting:
                # Calculate handwriting confidence based on features
                hw_confidence = (
                    min(1.0, stroke_variation / 50) * 0.4 +
                    (1.0 - min(1.0, circularity * 2)) * 0.3 +
                    min(1.0, density * 3.0) * 0.3
                )
                
                candidate_regions.append({
                    'bbox': (x, y, w, h),
                    'area': area,
                    'stroke_variation': float(stroke_variation),
                    'circularity': float(circularity),
                    'density': float(density),
                    'detection_confidence': float(hw_confidence)
                })
        
        # Sort regions by detection confidence
        candidate_regions.sort(key=lambda r: r['detection_confidence'], reverse=True)
        
        # Apply additional filtering for overlapping regions
        filtered_regions = self._filter_overlapping_regions(candidate_regions)
        
        # Apply sensitivity threshold
        sensitivity = self.config['detection_sensitivity']
        final_regions = [
            region for region in filtered_regions
            if region['detection_confidence'] >= sensitivity
        ]
        
        return final_regions
    
    def _filter_overlapping_regions(self, regions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Filter out highly overlapping regions
        
        Args:
            regions: List of detected regions
            
        Returns:
            Filtered list of regions
        """
        if not regions:
            return []
        
        # Sort regions by detection confidence
        regions = sorted(regions, key=lambda r: r['detection_confidence'], reverse=True)
        
        # Function to calculate IoU (Intersection over Union)
        def calculate_iou(bbox1, bbox2):
            x1, y1, w1, h1 = bbox1
            x2, y2, w2, h2 = bbox2
            
            # Calculate coordinates of intersection
            x_left = max(x1, x2)
            y_top = max(y1, y2)
            x_right = min(x1 + w1, x2 + w2)
            y_bottom = min(y1 + h1, y2 + h2)
            
            # Check if there is an intersection
            if x_right < x_left or y_bottom < y_top:
                return 0.0
            
            # Calculate areas
            intersection_area = (x_right - x_left) * (y_bottom - y_top)
            bbox1_area = w1 * h1
            bbox2_area = w2 * h2
            union_area = bbox1_area + bbox2_area - intersection_area
            
            # Calculate IoU
            return intersection_area / union_area if union_area > 0 else 0.0
        
        # Filter out overlapping regions
        filtered_regions = []
        for region in regions:
            should_include = True
            for selected_region in filtered_regions:
                iou = calculate_iou(region['bbox'], selected_region['bbox'])
                if iou > 0.5:  # If more than 50% overlap
                    should_include = False
                    break
            
            if should_include:
                filtered_regions.append(region)
        
        return filtered_regions
    
    def _process_handwritten_region(self, image: np.ndarray, region: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a handwritten region to recognize text
        
        Args:
            image: Original image
            region: Detected handwritten region
            
        Returns:
            Processed region with recognized text
        """
        x, y, w, h = region['bbox']
        
        # Extract region from image
        region_image = image[y:y+h, x:x+w]
        
        # Preprocess the region for better recognition
        preprocessed = self._preprocess_handwriting(region_image)
        
        # Recognize text
        recognition_result = self._recognize_handwritten_text(preprocessed)
        
        # Combine results
        result = {
            'bbox': region['bbox'],
            'text': recognition_result['text'],
            'confidence': recognition_result['confidence'],
            'detection_confidence': region['detection_confidence'],
            'language': recognition_result['language'],
            'characters': recognition_result.get('characters', [])
        }
        
        return result
    
    def _preprocess_handwriting(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocess a handwritten region for optimal recognition
        
        Args:
            image: Handwritten region image
            
        Returns:
            Preprocessed image
        """
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Get preprocessing level
        level = self.config['preprocessing_level']
        
        if level == 'basic':
            # Basic preprocessing
            # Apply Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            
            # Apply basic thresholding
            _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            
            return binary
            
        elif level == 'advanced':
            # Advanced preprocessing
            # Apply bilateral filter for edge-preserving noise reduction
            filtered = cv2.bilateralFilter(gray, 5, 75, 75)
            
            # Enhance contrast using CLAHE
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(filtered)
            
            # Apply adaptive thresholding
            binary = cv2.adaptiveThreshold(
                enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY_INV, 11, 2
            )
            
            # Apply morphological operations to clean up the image
            kernel = np.ones((2, 2), np.uint8)
            cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
            
            return cleaned
        
        else:
            # No preprocessing, just convert to binary
            _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            return binary
    
    def _recognize_handwritten_text(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Recognize text in a preprocessed handwritten region
        
        Args:
            image: Preprocessed handwritten region image
            
        Returns:
            Dictionary with recognition results
        """
        # Define tesseract configuration for handwriting
        config = r'--psm 6 --oem 3'
        
        # Add language configuration
        lang = self.config['language']
        
        try:
            # Perform OCR optimized for handwriting
            ocr_data = pytesseract.image_to_data(
                image, lang=lang, config=config,
                output_type=pytesseract.Output.DICT
            )
            
            # Extract text and confidence values
            texts = []
            confidences = []
            characters = []
            
            for i, text in enumerate(ocr_data['text']):
                conf = float(ocr_data['conf'][i])
                
                # Filter out empty text and invalid confidence
                if text and conf >= 0:
                    text = text.strip()
                    if text:
                        texts.append(text)
                        confidences.append(conf / 100.0)  # Convert to 0-1 range
                        
                        # Add character-level information
                        characters.append({
                            'text': text,
                            'confidence': conf / 100.0,
                            'bbox': (
                                ocr_data['left'][i],
                                ocr_data['top'][i],
                                ocr_data['width'][i],
                                ocr_data['height'][i]
                            )
                        })
            
            # Combine text and calculate average confidence
            combined_text = ' '.join(texts)
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            # Apply post-processing if enabled
            if self.config['enable_post_processing']:
                combined_text = self._post_process_handwritten_text(combined_text)
            
            return {
                'text': combined_text,
                'confidence': avg_confidence,
                'language': lang,
                'characters': characters
            }
            
        except Exception as e:
            logger.error(f"Recognition error: {e}")
            return {
                'text': '',
                'confidence': 0.0,
                'language': lang,
                'characters': []
            }
    
    def _post_process_handwritten_text(self, text: str) -> str:
        """
        Apply post-processing to recognized handwritten text
        
        Args:
            text: Recognized text
            
        Returns:
            Post-processed text
        """
        if not text:
            return ""
        
        # Remove excessive whitespace
        processed = ' '.join(text.split())
        
        # Correct common OCR errors in handwriting recognition
        
        # Fix common character confusions
        replacements = {
            'O0': '0',  # Letter O to number 0
            'l1': '1',  # Letter l to number 1
            'Z2': '2',  # Letter Z to number 2
            'S5': '5',  # Letter S to number 5
            'B8': '8',  # Letter B to number 8
            'rn': 'm',  # 'rn' to 'm'
            'vv': 'w'   # 'vv' to 'w'
        }
        
        for chars, replacement in replacements.items():
            for char in chars:
                # Only replace if it's likely a number context
                if char in '01258' and self._is_numeric_context(processed, char):
                    processed = processed.replace(char, replacement)
        
        # Correct spacing issues
        processed = processed.replace(' ,', ',')
        processed = processed.replace(' .', '.')
        processed = processed.replace(' :', ':')
        processed = processed.replace(' ;', ';')
        processed = processed.replace('( ', '(')
        processed = processed.replace(' )', ')')
        
        return processed
    
    def _is_numeric_context(self, text: str, char_pos: int) -> bool:
        """
        Check if a character appears in a numeric context
        
        Args:
            text: The text string
            char_pos: Position of the character
            
        Returns:
            True if the character is in a numeric context
        """
        # Simple implementation - consider more sophisticated logic for a real system
        try:
            idx = text.index(char_pos)
            
            # Check characters before and after
            before = text[idx-1] if idx > 0 else ''
            after = text[idx+1] if idx < len(text)-1 else ''
            
            return before.isdigit() or after.isdigit()
            
        except ValueError:
            return False
    
    def _generate_visualization(
        self, 
        image: np.ndarray, 
        detected_regions: List[Dict[str, Any]], 
        processed_regions: List[Dict[str, Any]], 
        output_path: str
    ):
        """
        Generate visualization of detected handwriting
        
        Args:
            image: Original image
            detected_regions: List of detected handwritten regions
            processed_regions: List of processed regions with recognized text
            output_path: Path to save visualization
        """
        # Create a copy of the image for visualization
        viz_image = image.copy()
        
        # Draw detected regions with color based on confidence
        for region in detected_regions:
            x, y, w, h = region['bbox']
            confidence = region['detection_confidence']
            
            # Choose color based on confidence (green for high, red for low)
            color = (
                0,  # B
                int(255 * confidence),  # G
                int(255 * (1 - confidence))  # R
            )
            
            # Draw rectangle
            cv2.rectangle(viz_image, (x, y), (x + w, y + h), color, 2)
        
        # Add recognized text
        for region in processed_regions:
            x, y, w, h = region['bbox']
            text = region['text']
            confidence = region['confidence']
            
            if text:
                # Draw text background
                text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)[0]
                cv2.rectangle(
                    viz_image, 
                    (x, y - text_size[1] - 10), 
                    (x + text_size[0], y - 5), 
                    (255, 255, 255), 
                    -1
                )
                
                # Draw text
                cv2.putText(
                    viz_image, 
                    text, 
                    (x, y - 10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 
                    0.5, 
                    (0, 0, 0), 
                    2
                )
                
                # Draw confidence
                conf_text = f"{confidence:.2f}"
                cv2.putText(
                    viz_image, 
                    conf_text, 
                    (x + w - 40, y + h - 10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 
                    0.5, 
                    (255, 255, 255), 
                    2
                )
        
        # Save visualization
        cv2.imwrite(output_path, viz_image)


def batch_process_documents(
    image_paths: List[str], 
    output_dir: str, 
    config: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Process multiple documents for handwriting recognition
    
    Args:
        image_paths: List of paths to document images
        output_dir: Directory to save results
        config: Configuration for handwriting detection
        
    Returns:
        Dictionary with batch processing results
    """
    if not image_paths:
        return {"error": "No images provided"}
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Create handwriting detector
    detector = HandwritingDetector(config)
    
    # Process each image
    results = []
    for image_path in image_paths:
        try:
            # Create document-specific output directory
            doc_name = Path(image_path).stem
            doc_output_dir = os.path.join(output_dir, doc_name)
            os.makedirs(doc_output_dir, exist_ok=True)
            
            # Process document
            result = detector.process_document(image_path, doc_output_dir)
            results.append({
                "filename": os.path.basename(image_path),
                "handwriting_detected": result["handwriting_detected"],
                "regions_detected": result["regions_detected"],
                "average_confidence": result["average_confidence"],
                "output_dir": doc_output_dir
            })
            
        except Exception as e:
            logger.error(f"Error processing {image_path}: {e}")
            results.append({
                "filename": os.path.basename(image_path),
                "error": str(e)
            })
    
    # Create batch summary
    batch_summary = {
        "total_documents": len(image_paths),
        "successful_processing": sum(1 for r in results if "error" not in r),
        "documents_with_handwriting": sum(1 for r in results if r.get("handwriting_detected", False)),
        "total_regions_detected": sum(r.get("regions_detected", 0) for r in results),
        "average_confidence": sum(r.get("average_confidence", 0) for r in results) / len(results) if results else 0,
        "document_results": results
    }
    
    # Save batch summary
    summary_path = os.path.join(output_dir, "batch_summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(batch_summary, f, indent=2, ensure_ascii=False)
    
    return batch_summary


def main():
    """Main function to parse arguments and run handwriting recognition"""
    parser = argparse.ArgumentParser(description="Handwriting recognition for document processing")
    parser.add_argument("input_path", help="Path to the document image")
    parser.add_argument("--output-dir", help="Directory to save results")
    parser.add_argument("--language", default="eng", choices=list(SUPPORTED_LANGUAGES.keys()), 
                        help="Language for recognition")
    parser.add_argument("--min-confidence", type=int, default=50, 
                        help="Minimum confidence threshold (0-100)")
    parser.add_argument("--visualize", action="store_true", 
                        help="Generate visualization")
    parser.add_argument("--batch-mode", action="store_true", 
                        help="Process multiple images from a directory")
    
    args = parser.parse_args()
    
    try:
        # Configure handwriting detector
        config = {
            'language': args.language,
            'min_confidence': args.min_confidence,
            'visualization_enabled': args.visualize
        }
        
        # Process in batch mode or single document mode
        if args.batch_mode:
            # Get all images in the directory
            if os.path.isdir(args.input_path):
                images = [
                    os.path.join(args.input_path, f) 
                    for f in os.listdir(args.input_path) 
                    if f.lower().endswith(('.png', '.jpg', '.jpeg', '.tiff', '.bmp'))
                ]
                
                if not images:
                    print(f"No images found in directory: {args.input_path}")
                    return 1
                
                # Process batch
                output_dir = args.output_dir or os.path.join(args.input_path, "handwriting_results")
                batch_results = batch_process_documents(images, output_dir, config)
                
                # Print summary
                print(json.dumps({
                    "total_documents": batch_results["total_documents"],
                    "documents_with_handwriting": batch_results["documents_with_handwriting"],
                    "total_regions_detected": batch_results["total_regions_detected"],
                    "output_dir": output_dir
                }, indent=2))
                
            else:
                print(f"Error: {args.input_path} is not a directory")
                return 1
        else:
            # Process single document
            detector = HandwritingDetector(config)
            output_dir = args.output_dir or os.path.join(os.path.dirname(args.input_path), "handwriting_results")
            
            result = detector.process_document(args.input_path, output_dir)
            
            # Print result summary
            print(json.dumps({
                "filename": result["filename"],
                "handwriting_detected": result["handwriting_detected"],
                "regions_detected": result["regions_detected"],
                "regions_confident": result["regions_confident"],
                "average_confidence": result["average_confidence"],
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