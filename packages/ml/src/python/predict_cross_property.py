#!/usr/bin/env python
"""
Predict with Cross-Property Model Script

This script predicts multiple properties from an image using a cross-property model.
"""

import os
import sys
import json
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import load_img, img_to_array
import time

def predict_cross_property(config_path):
    """Predict multiple properties from an image using a cross-property model."""
    # Load configuration
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    model_path = config['modelPath']
    properties = config['properties']
    image_path = config['imagePath']
    
    # Load model
    model = load_model(model_path)
    
    # Load class indices
    model_dir = os.path.dirname(model_path)
    class_indices_path = os.path.join(model_dir, 'class_indices.json')
    
    if not os.path.exists(class_indices_path):
        raise ValueError(f"Class indices not found: {class_indices_path}")
    
    with open(class_indices_path, 'r') as f:
        class_indices = json.load(f)
    
    # Load and preprocess image
    img = load_img(image_path, target_size=(224, 224))
    img_array = img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)
    img_array = img_array / 255.0
    
    # Predict
    start_time = time.time()
    predictions = model.predict(img_array)
    processing_time = time.time() - start_time
    
    # Process predictions
    result_predictions = {}
    
    for i, prop in enumerate(properties):
        if prop not in class_indices:
            continue
        
        # Get prediction for this property
        prop_predictions = predictions[i][0]
        
        # Get top prediction
        top_idx = np.argmax(prop_predictions)
        top_confidence = float(prop_predictions[top_idx])
        
        # Get class name
        top_class = class_indices[prop][str(top_idx)]
        
        # Add to result
        result_predictions[prop] = {
            'value': top_class,
            'confidence': top_confidence
        }
    
    # Return result
    result = {
        'predictions': result_predictions,
        'processingTime': float(processing_time)
    }
    
    print(json.dumps(result))
    
    return result

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python predict_cross_property.py <config_path>")
        sys.exit(1)
    
    config_path = sys.argv[1]
    predict_cross_property(config_path)
