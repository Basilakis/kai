#!/usr/bin/env python3
"""
Material Recognizer

This script implements a hybrid approach for material recognition using:
1. Feature-based matching with OpenCV
2. ML-based classification with TensorFlow/PyTorch
3. Combined results with confidence scoring

Usage:
    python material_recognizer.py <image_path> [options]

Arguments:
    image_path                  Path to the image to recognize
    
Options:
    --model-type                Type of model to use (hybrid, feature-based, ml-based)
    --confidence-threshold      Minimum confidence threshold for matches
    --max-results               Maximum number of results to return
"""

import os
import sys
import json
import argparse
import numpy as np
import cv2
from typing import Dict, List, Any, Tuple, Optional
import time
import uuid

# Conditionally import TensorFlow or PyTorch based on availability
try:
    import tensorflow as tf
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False

try:
    import torch
    import torchvision
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

# Check if at least one ML framework is available
if not TF_AVAILABLE and not TORCH_AVAILABLE:
    print("Warning: Neither TensorFlow nor PyTorch is available. ML-based recognition will be disabled.")

# Constants
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models')
FEATURE_MODEL_PATH = os.path.join(MODEL_DIR, 'feature_descriptors.npz')
ML_MODEL_PATH_TF = os.path.join(MODEL_DIR, 'material_classifier_tf')
ML_MODEL_PATH_TORCH = os.path.join(MODEL_DIR, 'material_classifier_torch.pt')
MATERIAL_METADATA_PATH = os.path.join(MODEL_DIR, 'material_metadata.json')

# Ensure model directory exists
os.makedirs(MODEL_DIR, exist_ok=True)


class MaterialRecognizer:
    """Material recognition system using a hybrid approach"""
    
    def __init__(self, model_type: str = 'hybrid', confidence_threshold: float = 0.6, max_results: int = 5):
        """
        Initialize the material recognizer
        
        Args:
            model_type: Type of model to use (hybrid, feature-based, ml-based)
            confidence_threshold: Minimum confidence threshold for matches
            max_results: Maximum number of results to return
        """
        self.model_type = model_type
        self.confidence_threshold = confidence_threshold
        self.max_results = max_results
        self.start_time = time.time()
        
        # Load material metadata
        self.material_metadata = self._load_material_metadata()
        
        # Initialize feature-based model if needed
        if model_type in ['hybrid', 'feature-based']:
            self.feature_extractor = cv2.SIFT_create()
            self.feature_matcher = cv2.FlannBasedMatcher({'algorithm': 1, 'trees': 5}, {'checks': 50})
            self.feature_descriptors = self._load_feature_descriptors()
        
        # Initialize ML-based model if needed
        if model_type in ['hybrid', 'ml-based']:
            if TF_AVAILABLE:
                self.ml_model = self._load_tf_model()
            elif TORCH_AVAILABLE:
                self.ml_model = self._load_torch_model()
            else:
                print("Warning: ML-based recognition requested but no ML framework is available.")
                if model_type == 'ml-based':
                    self.model_type = 'feature-based'
                    print("Falling back to feature-based recognition.")
    
    def _load_material_metadata(self) -> Dict[str, Any]:
        """Load material metadata from JSON file"""
        if os.path.exists(MATERIAL_METADATA_PATH):
            with open(MATERIAL_METADATA_PATH, 'r') as f:
                return json.load(f)
        else:
            # Return empty metadata if file doesn't exist
            print(f"Warning: Material metadata file not found at {MATERIAL_METADATA_PATH}")
            return {"materials": {}}
    
    def _load_feature_descriptors(self) -> Dict[str, Any]:
        """Load pre-computed feature descriptors for materials"""
        if os.path.exists(FEATURE_MODEL_PATH):
            return np.load(FEATURE_MODEL_PATH, allow_pickle=True)
        else:
            # Return empty descriptors if file doesn't exist
            print(f"Warning: Feature descriptors file not found at {FEATURE_MODEL_PATH}")
            return {"material_ids": np.array([]), "descriptors": np.array([])}
    
    def _load_tf_model(self) -> Any:
        """Load TensorFlow model for material classification"""
        if TF_AVAILABLE and os.path.exists(ML_MODEL_PATH_TF):
            return tf.saved_model.load(ML_MODEL_PATH_TF)
        else:
            print(f"Warning: TensorFlow model not found at {ML_MODEL_PATH_TF}")
            return None
    
    def _load_torch_model(self) -> Any:
        """Load PyTorch model for material classification"""
        if TORCH_AVAILABLE and os.path.exists(ML_MODEL_PATH_TORCH):
            model = torch.load(ML_MODEL_PATH_TORCH, map_location=torch.device('cpu'))
            model.eval()
            return model
        else:
            print(f"Warning: PyTorch model not found at {ML_MODEL_PATH_TORCH}")
            return None
    
    def _extract_features(self, image: np.ndarray) -> Tuple[List[cv2.KeyPoint], np.ndarray]:
        """Extract SIFT features from an image"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        keypoints, descriptors = self.feature_extractor.detectAndCompute(gray, None)
        return keypoints, descriptors
    
    def _feature_based_recognition(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Perform feature-based recognition using OpenCV"""
        # Extract features from the query image
        keypoints, descriptors = self._extract_features(image)
        
        if descriptors is None or len(descriptors) == 0:
            print("Warning: No features detected in the image")
            return []
        
        if len(self.feature_descriptors["material_ids"]) == 0:
            print("Warning: No feature descriptors available for matching")
            return []
        
        # Match features against the database
        matches_list = []
        for i, material_id in enumerate(self.feature_descriptors["material_ids"]):
            material_descriptors = self.feature_descriptors["descriptors"][i]
            
            if len(material_descriptors) == 0:
                continue
            
            # Match descriptors
            matches = self.feature_matcher.knnMatch(descriptors, material_descriptors, k=2)
            
            # Apply ratio test to filter good matches
            good_matches = []
            for m, n in matches:
                if m.distance < 0.75 * n.distance:
                    good_matches.append(m)
            
            # Calculate confidence based on number and quality of matches
            if len(good_matches) > 0:
                confidence = len(good_matches) / max(len(keypoints), 10)
                avg_distance = sum(m.distance for m in good_matches) / len(good_matches)
                # Normalize confidence (lower distance is better)
                confidence = confidence * (1 - min(avg_distance / 500, 0.9))
                
                if confidence >= self.confidence_threshold:
                    material_info = self.material_metadata["materials"].get(material_id, {})
                    matches_list.append({
                        "materialId": material_id,
                        "confidence": float(confidence),
                        "matchCount": len(good_matches),
                        "features": {
                            "featureMatches": len(good_matches),
                            "avgDistance": float(avg_distance)
                        }
                    })
        
        # Sort by confidence (descending)
        matches_list.sort(key=lambda x: x["confidence"], reverse=True)
        
        return matches_list[:self.max_results]
    
    def _ml_based_recognition(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Perform ML-based recognition using TensorFlow or PyTorch"""
        # Resize image for the neural network
        resized_img = cv2.resize(image, (224, 224))
        
        if TF_AVAILABLE and self.ml_model is not None:
            # Preprocess for TensorFlow
            img_tensor = tf.convert_to_tensor(resized_img, dtype=tf.float32)
            img_tensor = tf.expand_dims(img_tensor, 0)  # Add batch dimension
            img_tensor = tf.keras.applications.mobilenet_v2.preprocess_input(img_tensor)
            
            # Get predictions
            predictions = self.ml_model(img_tensor)
            if isinstance(predictions, dict):
                predictions = predictions['predictions']
            
            # Convert to numpy for processing
            predictions = predictions.numpy().flatten()
            
        elif TORCH_AVAILABLE and self.ml_model is not None:
            # Preprocess for PyTorch
            img_tensor = torch.from_numpy(resized_img).permute(2, 0, 1).float()
            img_tensor = img_tensor / 255.0
            img_tensor = torch.unsqueeze(img_tensor, 0)  # Add batch dimension
            
            # Normalize with ImageNet stats
            normalize = torchvision.transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
            img_tensor = normalize(img_tensor)
            
            # Get predictions
            with torch.no_grad():
                predictions = self.ml_model(img_tensor)
                predictions = torch.nn.functional.softmax(predictions, dim=1)
                predictions = predictions.numpy().flatten()
        else:
            return []
        
        # Map predictions to materials
        material_ids = list(self.material_metadata["materials"].keys())
        matches_list = []
        
        for i, confidence in enumerate(predictions):
            if i < len(material_ids) and confidence >= self.confidence_threshold:
                material_id = material_ids[i]
                material_info = self.material_metadata["materials"].get(material_id, {})
                
                matches_list.append({
                    "materialId": material_id,
                    "confidence": float(confidence),
                    "features": {
                        "classificationScore": float(confidence)
                    }
                })
        
        # Sort by confidence (descending)
        matches_list.sort(key=lambda x: x["confidence"], reverse=True)
        
        return matches_list[:self.max_results]
    
    def _hybrid_recognition(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Combine feature-based and ML-based recognition results"""
        feature_matches = self._feature_based_recognition(image)
        ml_matches = self._ml_based_recognition(image)
        
        # Combine results
        combined_matches = {}
        
        # Add feature-based matches
        for match in feature_matches:
            material_id = match["materialId"]
            combined_matches[material_id] = match
        
        # Add or update with ML-based matches
        for match in ml_matches:
            material_id = match["materialId"]
            if material_id in combined_matches:
                # Average the confidence scores
                feature_conf = combined_matches[material_id]["confidence"]
                ml_conf = match["confidence"]
                avg_conf = (feature_conf + ml_conf) / 2
                
                # Combine features
                combined_matches[material_id]["confidence"] = avg_conf
                combined_matches[material_id]["features"].update(match["features"])
            else:
                combined_matches[material_id] = match
        
        # Convert to list and sort by confidence
        result_list = list(combined_matches.values())
        result_list.sort(key=lambda x: x["confidence"], reverse=True)
        
        return result_list[:self.max_results]
    
    def recognize(self, image_path: str) -> Dict[str, Any]:
        """
        Recognize materials in an image
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Dictionary with recognition results
        """
        # Check if image exists
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")
        
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Failed to load image: {image_path}")
        
        # Extract basic image features
        height, width, channels = image.shape
        aspect_ratio = width / height
        
        # Perform recognition based on model type
        if self.model_type == 'feature-based':
            matches = self._feature_based_recognition(image)
        elif self.model_type == 'ml-based':
            matches = self._ml_based_recognition(image)
        else:  # hybrid
            matches = self._hybrid_recognition(image)
        
        # Calculate processing time
        processing_time = time.time() - self.start_time
        
        # Prepare result
        result = {
            "matches": matches,
            "extractedFeatures": {
                "imageSize": {
                    "width": width,
                    "height": height
                },
                "aspectRatio": aspect_ratio,
                "channels": channels,
                "dominantColors": self._extract_dominant_colors(image)
            },
            "processingTime": processing_time
        }
        
        return result
    
    def _extract_dominant_colors(self, image: np.ndarray, num_colors: int = 5) -> List[Dict[str, Any]]:
        """Extract dominant colors from an image"""
        # Reshape image to be a list of pixels
        pixels = image.reshape(-1, 3)
        
        # Convert to float32
        pixels = np.float32(pixels)
        
        # Define criteria and apply kmeans
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
        _, labels, centers = cv2.kmeans(pixels, num_colors, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
        
        # Convert back to uint8
        centers = np.uint8(centers)
        
        # Count occurrences of each label
        counts = np.bincount(labels.flatten())
        
        # Sort colors by frequency
        sorted_indices = np.argsort(counts)[::-1]
        sorted_centers = centers[sorted_indices]
        sorted_counts = counts[sorted_indices]
        
        # Calculate percentages
        total_pixels = image.shape[0] * image.shape[1]
        percentages = sorted_counts / total_pixels
        
        # Format results
        colors = []
        for i in range(min(num_colors, len(sorted_centers))):
            b, g, r = sorted_centers[i]
            hex_color = f"#{r:02x}{g:02x}{b:02x}"
            colors.append({
                "rgb": {"r": int(r), "g": int(g), "b": int(b)},
                "hex": hex_color,
                "percentage": float(percentages[i])
            })
        
        return colors


def main():
    """Main function to parse arguments and run the recognition"""
    parser = argparse.ArgumentParser(description="Recognize materials in an image")
    parser.add_argument("image_path", help="Path to the image file")
    parser.add_argument("--model-type", choices=["hybrid", "feature-based", "ml-based"], 
                        default="hybrid", help="Type of model to use")
    parser.add_argument("--confidence-threshold", type=float, default=0.6,
                        help="Minimum confidence threshold for matches")
    parser.add_argument("--max-results", type=int, default=5,
                        help="Maximum number of results to return")
    
    args = parser.parse_args()
    
    try:
        # Initialize recognizer
        recognizer = MaterialRecognizer(
            model_type=args.model_type,
            confidence_threshold=args.confidence_threshold,
            max_results=args.max_results
        )
        
        # Perform recognition
        result = recognizer.recognize(args.image_path)
        
        # Print result as JSON
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()