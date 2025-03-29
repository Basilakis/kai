#!/usr/bin/env python3
"""
Material Recognizer

This script implements a hybrid approach for material recognition using:
1. Feature-based matching with OpenCV
2. ML-based classification with TensorFlow/PyTorch
3. Combined results with confidence scoring
4. Adaptive embedding selection based on quality assessment

Usage:
    python material_recognizer.py <image_path> [options]

Arguments:
    image_path                  Path to the image to recognize
    
Options:
    --model-type                Type of model to use (hybrid, feature-based, ml-based)
    --confidence-threshold      Minimum confidence threshold for matches
    --max-results               Maximum number of results to return
    --adaptive                  Use adaptive embedding selection (default: True)
    --no-adaptive               Disable adaptive embedding selection
    --quality-threshold         Quality threshold for adaptive method switching
    --material-id               Optional material ID for context-aware adaptation
"""

import os
import sys
import json
import argparse
import numpy as np
import cv2
from typing import Dict, List, Any, Tuple, Optional, Union
import time
import uuid

# Import embedding bridge if available
try:
    from embedding_bridge import generate_embedding
    EMBEDDING_BRIDGE_AVAILABLE = True
except ImportError:
    EMBEDDING_BRIDGE_AVAILABLE = False
    print("Warning: Embedding bridge not available. Falling back to traditional embedding generation.")

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
    
    def __init__(self, 
                model_type: str = 'hybrid', 
                confidence_threshold: float = 0.6, 
                max_results: int = 5,
                adaptive: bool = True,
                quality_threshold: float = 0.65,
                material_id: Optional[str] = None):
        """
        Initialize the material recognizer
        
        Args:
            model_type: Type of model to use (hybrid, feature-based, ml-based)
            confidence_threshold: Minimum confidence threshold for matches
            max_results: Maximum number of results to return
            adaptive: Whether to use adaptive embedding selection
            quality_threshold: Quality threshold for adaptive method switching
            material_id: Optional material ID for context-aware adaptation
        """
        self.model_type = model_type
        self.confidence_threshold = confidence_threshold
        self.max_results = max_results
        self.adaptive = adaptive and EMBEDDING_BRIDGE_AVAILABLE
        self.quality_threshold = quality_threshold
        self.material_id = material_id
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
    
    def _generate_embedding(self, image: np.ndarray) -> Dict[str, Any]:
        """Generate embedding using the adaptive bridge if available"""
        if not self.adaptive or not EMBEDDING_BRIDGE_AVAILABLE:
            # Fallback to traditional embedding extraction
            keypoints, descriptors = self._extract_features(image)
            return {
                "vector": descriptors,
                "dimensions": descriptors.shape[1] if descriptors is not None else 0,
                "method": self.model_type,
                "adaptive": False
            }
        
        # Save image to temporary file (required for embedding_bridge)
        temp_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp')
        os.makedirs(temp_path, exist_ok=True)
        temp_file = os.path.join(temp_path, f"temp_img_{uuid.uuid4()}.jpg")
        cv2.imwrite(temp_file, image)
        
        try:
            # Use adaptive embedding generation through the bridge
            result = generate_embedding(
                image_path=temp_file,
                method=self.model_type,
                material_id=self.material_id,
                adaptive=True,
                quality_threshold=self.quality_threshold
            )
            
            # Clean up temp file
            if os.path.exists(temp_file):
                os.remove(temp_file)
                
            return result
        except Exception as e:
            print(f"Warning: Error generating adaptive embedding: {e}")
            # Clean up temp file
            if os.path.exists(temp_file):
                os.remove(temp_file)
                
            # Fallback to traditional embedding extraction
            keypoints, descriptors = self._extract_features(image)
            return {
                "vector": descriptors,
                "dimensions": descriptors.shape[1] if descriptors is not None else 0,
                "method": self.model_type,
                "adaptive": False
            }
    
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
    
    def _adaptive_recognition(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Perform recognition using the adaptive embedding system"""
        # Generate embedding using adaptive bridge
        embedding_result = self._generate_embedding(image)
        
        # Extract embedding vector and metadata
        vector = embedding_result.get("vector", [])
        method = embedding_result.get("method", self.model_type)
        initial_method = embedding_result.get("initial_method", method)
        quality_scores = embedding_result.get("quality_scores", {})
        method_switches = embedding_result.get("method_switches", 0)
        
        if len(vector) == 0:
            print("Warning: Failed to generate embedding")
            return []
        
        # Find similar materials using vector similarity
        matches_list = []
        for material_id, material_info in self.material_metadata["materials"].items():
            if "vectorRepresentation" not in material_info:
                continue
                
            material_vector = material_info["vectorRepresentation"]
            
            # Calculate cosine similarity
            similarity = self._calculate_similarity(vector, material_vector)
            
            if similarity >= self.confidence_threshold:
                matches_list.append({
                    "materialId": material_id,
                    "confidence": float(similarity),
                    "features": {
                        "vectorSimilarity": float(similarity),
                        "embeddingMethod": method,
                        "initialMethod": initial_method,
                        "methodSwitches": method_switches,
                        "qualityScores": quality_scores
                    }
                })
        
        # Sort by confidence (descending)
        matches_list.sort(key=lambda x: x["confidence"], reverse=True)
        
        return matches_list[:self.max_results]
    
    def _calculate_similarity(self, vec1: Union[List[float], np.ndarray], 
                             vec2: Union[List[float], np.ndarray]) -> float:
        """Calculate cosine similarity between two vectors"""
        # Convert to numpy arrays if needed
        if not isinstance(vec1, np.ndarray):
            vec1 = np.array(vec1)
        if not isinstance(vec2, np.ndarray):
            vec2 = np.array(vec2)
            
        # Ensure vectors have the same dimension
        min_dim = min(vec1.shape[0], vec2.shape[0])
        vec1 = vec1[:min_dim]
        vec2 = vec2[:min_dim]
        
        # Calculate cosine similarity
        dot_product = np.dot(vec1, vec2)
        norm_a = np.linalg.norm(vec1)
        norm_b = np.linalg.norm(vec2)
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
            
        similarity = dot_product / (norm_a * norm_b)
        
        # Normalize to [0, 1] range
        return (similarity + 1) / 2
    
    def _hybrid_recognition(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Combine feature-based and ML-based recognition results"""
        # If adaptive embedding is enabled, use it
        if self.adaptive and EMBEDDING_BRIDGE_AVAILABLE:
            return self._adaptive_recognition(image)
            
        # Otherwise use traditional hybrid approach
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
        if self.adaptive and EMBEDDING_BRIDGE_AVAILABLE:
            matches = self._adaptive_recognition(image)
        elif self.model_type == 'feature-based':
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
            "adaptiveEnabled": self.adaptive and EMBEDDING_BRIDGE_AVAILABLE,
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
    parser.add_argument("--adaptive", action="store_true", default=True,
                        help="Use adaptive embedding selection")
    parser.add_argument("--no-adaptive", action="store_false", dest="adaptive",
                        help="Disable adaptive embedding selection")
    parser.add_argument("--quality-threshold", type=float, default=0.65,
                        help="Quality threshold for adaptive method switching")
    parser.add_argument("--material-id", help="Optional material ID for context-aware adaptation")
    
    args = parser.parse_args()
    
    try:
        # Initialize recognizer
        recognizer = MaterialRecognizer(
            model_type=args.model_type,
            confidence_threshold=args.confidence_threshold,
            max_results=args.max_results,
            adaptive=args.adaptive,
            quality_threshold=args.quality_threshold,
            material_id=args.material_id
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