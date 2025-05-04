#!/usr/bin/env python
"""
Model Comparison Script

This script compares multiple models on the same test dataset
and outputs comparison metrics.
"""

import os
import sys
import json
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from sklearn.metrics import confusion_matrix, accuracy_score, precision_score, recall_score, f1_score
from PIL import Image
import io

def load_and_preprocess_image(image_path, target_size=(224, 224)):
    """Load and preprocess an image for model prediction."""
    img = tf.keras.preprocessing.image.load_img(image_path, target_size=target_size)
    img_array = tf.keras.preprocessing.image.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)
    img_array = img_array / 255.0  # Normalize
    return img_array

def get_class_indices(test_data_path):
    """Get class indices from test data directory."""
    class_names = sorted(os.listdir(test_data_path))
    class_indices = {name: i for i, name in enumerate(class_names)}
    return class_indices, class_names

def evaluate_model(model, test_data_path, class_indices, class_names):
    """Evaluate a model on test data."""
    # Create data generator
    test_datagen = ImageDataGenerator(rescale=1./255)
    test_generator = test_datagen.flow_from_directory(
        test_data_path,
        target_size=(224, 224),
        batch_size=32,
        class_mode='categorical',
        shuffle=False
    )
    
    # Evaluate model
    y_pred_prob = model.predict(test_generator)
    y_pred = np.argmax(y_pred_prob, axis=1)
    y_true = test_generator.classes
    
    # Calculate metrics
    accuracy = accuracy_score(y_true, y_pred)
    precision = precision_score(y_true, y_pred, average='weighted')
    recall = recall_score(y_true, y_pred, average='weighted')
    f1 = f1_score(y_true, y_pred, average='weighted')
    conf_matrix = confusion_matrix(y_true, y_pred)
    
    # Convert confusion matrix to list for JSON serialization
    conf_matrix_list = conf_matrix.tolist()
    
    # Get file paths for samples
    file_paths = [os.path.join(test_data_path, class_names[c], f) 
                 for c, files in enumerate(os.listdir(test_data_path)) 
                 for f in os.listdir(os.path.join(test_data_path, class_names[c]))]
    
    return {
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1_score": float(f1),
        "confusion_matrix": conf_matrix_list,
        "predictions": {
            "y_true": y_true.tolist(),
            "y_pred": y_pred.tolist(),
            "y_pred_prob": y_pred_prob.tolist(),
            "file_paths": file_paths
        }
    }

def compare_models(config_path):
    """Compare multiple models on the same test dataset."""
    # Load configuration
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    models_config = config['models']
    test_data_path = config['testDataPath']
    
    # Get class indices
    class_indices, class_names = get_class_indices(test_data_path)
    
    # Load models
    models = {}
    for model_config in models_config:
        model_id = model_config['id']
        model_path = model_config['path']
        models[model_id] = load_model(model_path)
    
    # Evaluate each model
    evaluations = {}
    for model_id, model in models.items():
        evaluations[model_id] = evaluate_model(model, test_data_path, class_indices, class_names)
    
    # Find disagreements
    disagreements = find_disagreements(evaluations, test_data_path, class_names)
    
    # Calculate disagreement rate
    total_samples = len(evaluations[list(evaluations.keys())[0]]['predictions']['y_true'])
    disagreement_rate = len(disagreements) / total_samples if total_samples > 0 else 0
    
    # Prepare result
    result = {
        "evaluations": evaluations,
        "disagreementRate": disagreement_rate,
        "disagreementExamples": disagreements[:10],  # Limit to 10 examples
        "accuracyDifference": calculate_accuracy_difference(evaluations)
    }
    
    # Print result as JSON
    print(json.dumps(result))
    
    return result

def find_disagreements(evaluations, test_data_path, class_names):
    """Find samples where models disagree."""
    model_ids = list(evaluations.keys())
    if len(model_ids) < 2:
        return []
    
    # Get predictions
    predictions = {}
    for model_id in model_ids:
        predictions[model_id] = evaluations[model_id]['predictions']['y_pred']
    
    # Find disagreements
    disagreements = []
    y_true = evaluations[model_ids[0]]['predictions']['y_true']
    file_paths = evaluations[model_ids[0]]['predictions']['file_paths']
    
    for i in range(len(y_true)):
        # Check if models disagree
        model_predictions = [predictions[model_id][i] for model_id in model_ids]
        if len(set(model_predictions)) > 1:
            # Models disagree on this sample
            disagreement = {
                "imagePath": file_paths[i],
                "actualValue": class_names[y_true[i]],
                "predictions": []
            }
            
            for model_id in model_ids:
                pred_idx = predictions[model_id][i]
                pred_prob = evaluations[model_id]['predictions']['y_pred_prob'][i][pred_idx]
                
                disagreement["predictions"].append({
                    "modelId": model_id,
                    "predictedValue": class_names[pred_idx],
                    "confidence": float(pred_prob)
                })
            
            disagreements.append(disagreement)
    
    return disagreements

def calculate_accuracy_difference(evaluations):
    """Calculate the difference in accuracy between models."""
    model_ids = list(evaluations.keys())
    if len(model_ids) < 2:
        return 0
    
    accuracies = [evaluations[model_id]['accuracy'] for model_id in model_ids]
    max_accuracy = max(accuracies)
    min_accuracy = min(accuracies)
    
    return max_accuracy - min_accuracy

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python model_comparison.py <config_path>")
        sys.exit(1)
    
    config_path = sys.argv[1]
    compare_models(config_path)
