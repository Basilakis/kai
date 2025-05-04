#!/usr/bin/env python
"""
Material Type Detector

This script detects the material type from text or images.
It's used as the first step in OCR processing to determine which
metadata fields should be used for extraction.
"""

import os
import sys
import json
import re
import argparse
import logging
from typing import Dict, Any, List, Optional, Tuple
import uuid

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('material-type-detector')

# Try to import ML libraries
try:
    import numpy as np
    import tensorflow as tf
    TF_AVAILABLE = True
except ImportError:
    logger.warning("TensorFlow not available. ML-based detection will be disabled.")
    TF_AVAILABLE = False

try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    logger.warning("Pillow not available. Image processing will be limited.")
    PILLOW_AVAILABLE = False

# Material types
MATERIAL_TYPES = ['tile', 'wood', 'lighting', 'furniture', 'decoration', 'all']

# Keywords for material type detection
MATERIAL_TYPE_KEYWORDS = {
    'tile': [
        'tile', 'tiles', 'ceramic', 'porcelain', 'mosaic', 'floor tile', 'wall tile',
        'glazed', 'unglazed', 'rectified', 'grout', 'pei rating', 'r-rating'
    ],
    'wood': [
        'wood', 'wooden', 'hardwood', 'timber', 'oak', 'maple', 'pine', 'walnut', 'cherry',
        'flooring', 'plank', 'veneer', 'solid wood', 'engineered wood', 'laminate'
    ],
    'lighting': [
        'light', 'lighting', 'lamp', 'chandelier', 'pendant', 'sconce', 'fixture',
        'bulb', 'led', 'lumens', 'brightness', 'illumination', 'ceiling light'
    ],
    'furniture': [
        'furniture', 'chair', 'table', 'sofa', 'couch', 'desk', 'cabinet', 'shelf',
        'bookcase', 'bed', 'dresser', 'nightstand', 'ottoman', 'stool', 'bench'
    ],
    'decoration': [
        'decoration', 'decor', 'ornament', 'vase', 'artwork', 'painting', 'sculpture',
        'mirror', 'rug', 'carpet', 'curtain', 'pillow', 'cushion', 'throw', 'blanket'
    ],
    'all': [] # Common fields applicable to all material types
}


class MaterialTypeDetector:
    """Detects material type from text or images"""
    
    def __init__(self, model_path: Optional[str] = None):
        """
        Initialize the material type detector
        
        Args:
            model_path: Optional path to ML model for image-based detection
        """
        self.model_path = model_path
        self.model = None
        
        # Load ML model if available
        if model_path and TF_AVAILABLE:
            try:
                self.model = tf.keras.models.load_model(model_path)
                logger.info(f"Loaded material type detection model from {model_path}")
            except Exception as e:
                logger.error(f"Error loading model: {e}")
    
    def detect_from_text(self, text: str) -> Dict[str, Any]:
        """
        Detect material type from text
        
        Args:
            text: Text to analyze
            
        Returns:
            Dictionary with material type and confidence
        """
        logger.info("Detecting material type from text")
        
        # Convert text to lowercase for case-insensitive matching
        lower_text = text.lower()
        
        # Count keyword occurrences for each material type
        scores = {material_type: {"count": 0, "keywords": []} for material_type in MATERIAL_TYPES}
        
        # Check for explicit material type declarations
        material_type_match = re.search(r'material\s+type:?\s*(\w+)', lower_text, re.IGNORECASE)
        if material_type_match and material_type_match.group(1):
            declared_type = material_type_match.group(1).lower()
            
            # Check if the declared type matches a known material type
            for material_type, keywords in MATERIAL_TYPE_KEYWORDS.items():
                if material_type == declared_type or declared_type in keywords:
                    logger.info(f"Explicit material type declaration found: {material_type}")
                    return {
                        "materialType": material_type,
                        "confidence": 0.9,
                        "keywords": [declared_type]
                    }
        
        # Count keyword occurrences
        for material_type, keywords in MATERIAL_TYPE_KEYWORDS.items():
            if material_type == 'all':
                continue  # Skip 'all' type for keyword matching
            
            for keyword in keywords:
                # Use word boundary to match whole words
                matches = re.findall(r'\b' + re.escape(keyword) + r'\b', lower_text, re.IGNORECASE)
                
                if matches:
                    scores[material_type]["count"] += len(matches)
                    scores[material_type]["keywords"].append(keyword)
        
        # Find material type with highest score
        max_score = 0
        detected_type = 'all'
        detected_keywords = []
        
        for material_type, score in scores.items():
            if score["count"] > max_score:
                max_score = score["count"]
                detected_type = material_type
                detected_keywords = list(set(score["keywords"]))  # Remove duplicates
        
        # Calculate confidence based on score
        # Higher score = higher confidence, with a maximum of 0.95
        confidence = min(0.5 + (max_score * 0.05), 0.95)
        
        # If no keywords were found or confidence is too low, default to 'all'
        if max_score == 0 or confidence < 0.6:
            logger.info('No clear material type detected, defaulting to "all"')
            return {
                "materialType": "all",
                "confidence": 0.5
            }
        
        # Get alternative types (those with at least 50% of the max score)
        alternatives = []
        for material_type, score in scores.items():
            if material_type != detected_type and score["count"] >= max_score * 0.5:
                alternatives.append({
                    "materialType": material_type,
                    "confidence": min(0.5 + (score["count"] * 0.05), 0.9)
                })
        
        logger.info(f"Detected material type: {detected_type} with confidence {confidence}")
        
        result = {
            "materialType": detected_type,
            "confidence": confidence,
            "keywords": detected_keywords
        }
        
        if alternatives:
            result["alternativeTypes"] = alternatives
        
        return result
    
    def detect_from_image(self, image_path: str) -> Dict[str, Any]:
        """
        Detect material type from image
        
        Args:
            image_path: Path to image file
            
        Returns:
            Dictionary with material type and confidence
        """
        logger.info(f"Detecting material type from image: {image_path}")
        
        # Check if image exists
        if not os.path.exists(image_path):
            logger.error(f"Image file not found: {image_path}")
            return {
                "materialType": "all",
                "confidence": 0.5,
                "error": "Image file not found"
            }
        
        # If ML model is available, use it
        if self.model and TF_AVAILABLE and PILLOW_AVAILABLE:
            try:
                # Load and preprocess image
                img = Image.open(image_path)
                img = img.resize((224, 224))  # Resize to model input size
                img_array = np.array(img) / 255.0  # Normalize
                img_array = np.expand_dims(img_array, axis=0)  # Add batch dimension
                
                # Make prediction
                predictions = self.model.predict(img_array)[0]
                
                # Get top prediction
                top_idx = np.argmax(predictions)
                confidence = float(predictions[top_idx])
                
                # Map index to material type
                material_type = MATERIAL_TYPES[top_idx] if top_idx < len(MATERIAL_TYPES) else "all"
                
                logger.info(f"Detected material type from image: {material_type} with confidence {confidence}")
                
                # Get alternative types
                alternatives = []
                for i, pred in enumerate(predictions):
                    if i != top_idx and pred >= 0.2:  # Only include alternatives with reasonable confidence
                        alt_type = MATERIAL_TYPES[i] if i < len(MATERIAL_TYPES) else "all"
                        alternatives.append({
                            "materialType": alt_type,
                            "confidence": float(pred)
                        })
                
                result = {
                    "materialType": material_type,
                    "confidence": confidence
                }
                
                if alternatives:
                    result["alternativeTypes"] = alternatives
                
                return result
                
            except Exception as e:
                logger.error(f"Error in image-based detection: {e}")
        
        # If ML model is not available or failed, return default
        return {
            "materialType": "all",
            "confidence": 0.5
        }
    
    def detect(self, text: str, image_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Detect material type from text and optionally image
        
        Args:
            text: Text to analyze
            image_path: Optional path to image file
            
        Returns:
            Dictionary with material type and confidence
        """
        # Detect from text
        text_result = self.detect_from_text(text)
        
        # If text detection is confident enough, use it
        if text_result["confidence"] >= 0.8:
            return text_result
        
        # If image path is provided, try image detection
        if image_path:
            try:
                image_result = self.detect_from_image(image_path)
                
                # If image detection is more confident, use it
                if image_result["confidence"] > text_result["confidence"]:
                    return image_result
            except Exception as e:
                logger.warning(f"Error in image-based material type detection: {e}")
                # Continue with text result on error
        
        # Default to text result
        return text_result


def main():
    """Main function to parse arguments and run the detection"""
    parser = argparse.ArgumentParser(description="Detect material type from text or image")
    parser.add_argument("--text", help="Text to analyze")
    parser.add_argument("--text-file", help="Path to text file to analyze")
    parser.add_argument("--image", help="Path to image file to analyze")
    parser.add_argument("--model", help="Path to ML model for image-based detection")
    
    args = parser.parse_args()
    
    # Ensure we have either text or text file
    if not args.text and not args.text_file:
        parser.error("Either --text or --text-file is required")
    
    # Get text from file if provided
    text = args.text
    if args.text_file:
        try:
            with open(args.text_file, 'r', encoding='utf-8') as f:
                text = f.read()
        except Exception as e:
            logger.error(f"Error reading text file: {e}")
            sys.exit(1)
    
    try:
        # Create detector
        detector = MaterialTypeDetector(args.model)
        
        # Detect material type
        result = detector.detect(text, args.image)
        
        # Print result as JSON
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        logger.error(f"Error in material type detection: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
