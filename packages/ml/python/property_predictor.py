#!/usr/bin/env python
"""
Property Predictor

This script predicts property values from images using trained models.
It's used as part of the Visual Reference Library feature.
"""

import os
import sys
import json
import argparse
import logging
from typing import Dict, Any, List, Optional, Tuple, Union

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('property-predictor')

# Try to import ML libraries
try:
    import numpy as np
    import tensorflow as tf
    from tensorflow.keras.models import load_model
    from tensorflow.keras.preprocessing.image import load_img, img_to_array
    TF_AVAILABLE = True
except ImportError:
    logger.warning("TensorFlow not available. ML-based prediction will be disabled.")
    TF_AVAILABLE = False

try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    logger.warning("Pillow not available. Image processing will be limited.")
    PILLOW_AVAILABLE = False


class PropertyPredictor:
    """Predicts property values from images"""
    
    def __init__(self, model_dir: str, property_name: str, material_type: str):
        """
        Initialize the predictor
        
        Args:
            model_dir: Directory containing trained model
            property_name: Property name
            material_type: Material type
        """
        self.model_dir = model_dir
        self.property_name = property_name
        self.material_type = material_type
        
        # Load model and metadata
        self.model = None
        self.metadata = None
        self.class_names = None
        self.model_type = None
        
        self._load_model_and_metadata()
    
    def _load_model_and_metadata(self):
        """Load model and metadata"""
        if not TF_AVAILABLE:
            logger.error("TensorFlow is not available. Cannot load model.")
            return
        
        logger.info(f"Loading model and metadata from {self.model_dir}")
        
        # Check if model directory exists
        if not os.path.exists(self.model_dir):
            logger.error(f"Model directory {self.model_dir} does not exist")
            return
        
        # Load model
        model_path = os.path.join(self.model_dir, 'final_model.h5')
        if os.path.exists(model_path):
            try:
                self.model = load_model(model_path)
                logger.info(f"Loaded model from {model_path}")
            except Exception as e:
                logger.error(f"Error loading model: {e}")
                return
        else:
            logger.error(f"Model file {model_path} not found")
            return
        
        # Load metadata
        metadata_path = os.path.join(self.model_dir, 'property_metadata.json')
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, 'r') as f:
                    self.metadata = json.load(f)
                    logger.info(f"Loaded metadata from {metadata_path}")
                    
                    # Determine model type based on field type
                    field_type = self.metadata.get('fieldType', 'text')
                    if field_type in ['dropdown', 'boolean', 'text']:
                        self.model_type = 'classification'
                    elif field_type == 'number':
                        self.model_type = 'regression'
                    else:
                        self.model_type = 'classification'
            except Exception as e:
                logger.error(f"Error loading metadata: {e}")
        else:
            logger.warning(f"Metadata file {metadata_path} not found")
        
        # Load class names for classification models
        if self.model_type == 'classification':
            class_names_path = os.path.join(self.model_dir, 'class_names.json')
            if os.path.exists(class_names_path):
                try:
                    with open(class_names_path, 'r') as f:
                        self.class_names = json.load(f)
                        logger.info(f"Loaded {len(self.class_names)} class names")
                except Exception as e:
                    logger.error(f"Error loading class names: {e}")
            else:
                logger.warning(f"Class names file {class_names_path} not found")
    
    def predict(self, image_path: str) -> Dict[str, Any]:
        """
        Predict property value from image
        
        Args:
            image_path: Path to image file
            
        Returns:
            Dictionary with prediction result
        """
        if not TF_AVAILABLE or not PILLOW_AVAILABLE:
            logger.error("TensorFlow or Pillow is not available. Cannot make predictions.")
            return {
                "error": "TensorFlow or Pillow is not available"
            }
        
        if self.model is None:
            logger.error("Model not loaded")
            return {
                "error": "Model not loaded"
            }
        
        logger.info(f"Predicting {self.property_name} from image: {image_path}")
        
        try:
            # Load and preprocess image
            img = load_img(image_path, target_size=(224, 224))
            img_array = img_to_array(img)
            img_array = np.expand_dims(img_array, axis=0)
            img_array = img_array / 255.0  # Normalize
            
            # Make prediction
            predictions = self.model.predict(img_array)[0]
            
            # Process prediction based on model type
            if self.model_type == 'classification':
                return self._process_classification_prediction(predictions)
            elif self.model_type == 'regression':
                return self._process_regression_prediction(predictions)
            else:
                logger.error(f"Unsupported model type: {self.model_type}")
                return {
                    "error": f"Unsupported model type: {self.model_type}"
                }
        
        except Exception as e:
            logger.error(f"Error making prediction: {e}")
            return {
                "error": str(e)
            }
    
    def _process_classification_prediction(self, predictions: np.ndarray) -> Dict[str, Any]:
        """
        Process classification prediction
        
        Args:
            predictions: Model predictions
            
        Returns:
            Dictionary with processed prediction
        """
        # Get top prediction
        top_idx = np.argmax(predictions)
        confidence = float(predictions[top_idx])
        
        # Get class name
        class_name = self.class_names[top_idx] if self.class_names and top_idx < len(self.class_names) else str(top_idx)
        
        # Get alternatives
        alternatives = []
        for i, pred in enumerate(predictions):
            if i != top_idx and pred >= 0.1:  # Only include alternatives with reasonable confidence
                alt_name = self.class_names[i] if self.class_names and i < len(self.class_names) else str(i)
                alternatives.append({
                    "value": alt_name,
                    "confidence": float(pred)
                })
        
        # Sort alternatives by confidence
        alternatives.sort(key=lambda x: x["confidence"], reverse=True)
        
        # Limit to top 5 alternatives
        alternatives = alternatives[:5]
        
        # Convert value based on field type
        value = class_name
        if self.metadata:
            field_type = self.metadata.get('fieldType', 'text')
            
            if field_type == 'boolean':
                value = value.lower() in ['true', 'yes', '1', 'y']
            
            elif field_type == 'dropdown' and self.metadata.get('options'):
                # Try to match with dropdown options
                for option in self.metadata['options']:
                    if option.get('value') == value or option.get('label') == value:
                        value = option.get('value')
                        break
        
        return {
            "value": value,
            "confidence": confidence,
            "alternatives": alternatives if alternatives else None
        }
    
    def _process_regression_prediction(self, predictions: np.ndarray) -> Dict[str, Any]:
        """
        Process regression prediction
        
        Args:
            predictions: Model predictions
            
        Returns:
            Dictionary with processed prediction
        """
        # Get predicted value
        value = float(predictions[0])
        
        # Apply validation rules if available
        if self.metadata and 'validation' in self.metadata:
            validation = self.metadata['validation']
            
            # Apply min/max constraints
            if 'min' in validation and value < validation['min']:
                value = validation['min']
            
            if 'max' in validation and value > validation['max']:
                value = validation['max']
            
            # Apply step if specified
            if 'step' in validation and validation['step'] > 0:
                step = validation['step']
                value = round(value / step) * step
        
        # Round to reasonable precision
        value = round(value, 4)
        
        return {
            "value": value,
            "confidence": 0.8  # Fixed confidence for regression
        }


def main():
    """Main function to parse arguments and run the prediction"""
    parser = argparse.ArgumentParser(description="Predict property values from images")
    parser.add_argument("--property", required=True, help="Property name")
    parser.add_argument("--material-type", required=True, help="Material type")
    parser.add_argument("--image", required=True, help="Path to image file")
    parser.add_argument("--model-dir", required=True, help="Directory containing trained model")
    
    args = parser.parse_args()
    
    try:
        # Check if TensorFlow and Pillow are available
        if not TF_AVAILABLE or not PILLOW_AVAILABLE:
            logger.error("TensorFlow or Pillow is not available. Cannot make predictions.")
            sys.exit(1)
        
        # Create predictor
        predictor = PropertyPredictor(
            args.model_dir,
            args.property,
            args.material_type
        )
        
        # Make prediction
        result = predictor.predict(args.image)
        
        # Print result as JSON
        print(json.dumps(result))
        
    except Exception as e:
        logger.error(f"Error in prediction: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
