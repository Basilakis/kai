#!/usr/bin/env python
"""
Find Uncertain Samples Script

This script finds samples with high uncertainty for active learning.
"""

import os
import sys
import json
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import load_img, img_to_array
from scipy.stats import entropy
import glob

def load_and_preprocess_image(image_path, target_size=(224, 224)):
    """Load and preprocess an image for model prediction."""
    img = tf.keras.preprocessing.image.load_img(image_path, target_size=target_size)
    img_array = tf.keras.preprocessing.image.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)
    img_array = img_array / 255.0  # Normalize
    return img_array

def calculate_entropy(probabilities):
    """Calculate entropy of a probability distribution."""
    return entropy(probabilities)

def find_uncertain_samples(config_path):
    """Find samples with high uncertainty for active learning."""
    # Load configuration
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    model_path = config['modelPath']
    data_paths = config['dataPaths']
    max_samples = config['maxSamples']
    min_confidence = config['minConfidence']
    max_confidence = config['maxConfidence']
    use_entropy = config['useEntropy']
    
    # Load model
    model = load_model(model_path)
    
    # Get class names from model metadata
    model_dir = os.path.dirname(model_path)
    metadata_path = os.path.join(model_dir, 'metadata.json')
    
    if os.path.exists(metadata_path):
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        class_names = metadata.get('classes', [])
    else:
        # Try to infer class names from the model output shape
        output_shape = model.output_shape
        num_classes = output_shape[-1]
        class_names = [f"class_{i}" for i in range(num_classes)]
    
    # Find image files in data paths
    image_files = []
    for data_path in data_paths:
        for ext in ['jpg', 'jpeg', 'png']:
            image_files.extend(glob.glob(os.path.join(data_path, '**', f'*.{ext}'), recursive=True))
    
    # Process each image
    uncertain_samples = []
    
    for image_path in image_files:
        # Load and preprocess image
        img_array = load_and_preprocess_image(image_path)
        
        # Get predictions
        predictions = model.predict(img_array)[0]
        
        # Get top prediction
        top_idx = np.argmax(predictions)
        top_confidence = predictions[top_idx]
        
        # Check if confidence is in the desired range
        if top_confidence >= min_confidence and top_confidence <= max_confidence:
            # Calculate entropy if needed
            sample_entropy = calculate_entropy(predictions) if use_entropy else 0
            
            # Create sample
            sample = {
                'imagePath': image_path,
                'predictions': [
                    {
                        'value': class_names[i] if i < len(class_names) else f"class_{i}",
                        'confidence': float(predictions[i])
                    }
                    for i in range(len(predictions))
                ],
                'entropy': float(sample_entropy)
            }
            
            uncertain_samples.append(sample)
    
    # Sort samples by entropy (if using entropy) or by inverse confidence
    if use_entropy:
        uncertain_samples.sort(key=lambda x: x['entropy'], reverse=True)
    else:
        uncertain_samples.sort(key=lambda x: 1.0 - max([p['confidence'] for p in x['predictions']]))
    
    # Limit to max_samples
    uncertain_samples = uncertain_samples[:max_samples]
    
    # Return results
    result = {
        'samples': uncertain_samples
    }
    
    print(json.dumps(result))
    
    return result

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python find_uncertain_samples.py <config_path>")
        sys.exit(1)
    
    config_path = sys.argv[1]
    find_uncertain_samples(config_path)
