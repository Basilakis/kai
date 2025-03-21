#!/usr/bin/env python3
"""
Embedding Generator for Material Recognition

This script generates vector embeddings for images to enable similarity search.
It can use different methods to generate embeddings:
1. Feature-based: Using SIFT features and PCA for dimensionality reduction
2. ML-based: Using a pre-trained neural network (MobileNetV2, ResNet, etc.)
3. Hybrid: Combining both approaches

Usage:
    python embedding_generator.py <image_path> [options]

Arguments:
    image_path              Path to the image file

Options:
    --method                Method to use for embedding generation (feature-based, ml-based, hybrid)
    --model-path            Path to the pre-trained model (for ML-based method)
    --output-dimensions     Dimensions of the output embedding vector
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
from pathlib import Path

# Conditionally import TensorFlow or PyTorch based on availability
try:
    import tensorflow as tf
    from tensorflow.keras import applications
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False

try:
    import torch
    import torch.nn as nn
    import torchvision
    from torchvision import transforms
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

# Check if at least one ML framework is available
if not TF_AVAILABLE and not TORCH_AVAILABLE:
    print("Warning: Neither TensorFlow nor PyTorch is available. ML-based embedding will be disabled.")


class FeatureBasedEmbedding:
    """Generate embeddings using feature-based approach (SIFT + PCA)"""
    
    def __init__(self, output_dimensions: int = 128):
        """
        Initialize the feature-based embedding generator
        
        Args:
            output_dimensions: Dimensions of the output embedding vector
        """
        self.output_dimensions = output_dimensions
        self.feature_detector = cv2.SIFT_create()
        
        # PCA for dimensionality reduction
        self.pca = None
    
    def extract_features(self, image: np.ndarray) -> np.ndarray:
        """
        Extract SIFT features from an image
        
        Args:
            image: Input image
            
        Returns:
            Feature descriptors
        """
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Detect keypoints and compute descriptors
        keypoints, descriptors = self.feature_detector.detectAndCompute(gray, None)
        
        if descriptors is None or len(descriptors) == 0:
            # If no features detected, return a zero vector
            return np.zeros((1, 128), dtype=np.float32)
        
        return descriptors
    
    def generate_embedding(self, image: np.ndarray) -> np.ndarray:
        """
        Generate embedding for an image
        
        Args:
            image: Input image
            
        Returns:
            Embedding vector
        """
        # Extract features
        descriptors = self.extract_features(image)
        
        if descriptors.shape[0] == 0:
            # If no features detected, return a zero vector
            return np.zeros(self.output_dimensions, dtype=np.float32)
        
        # Compute bag of visual words or feature statistics
        # For simplicity, we'll use mean and std of descriptors
        mean_desc = np.mean(descriptors, axis=0)
        std_desc = np.std(descriptors, axis=0)
        
        # Concatenate statistics
        stats_vector = np.concatenate([mean_desc, std_desc])
        
        # Apply dimensionality reduction if needed
        if stats_vector.shape[0] > self.output_dimensions:
            if self.pca is None:
                from sklearn.decomposition import PCA
                self.pca = PCA(n_components=self.output_dimensions)
                stats_vector = self.pca.fit_transform(stats_vector.reshape(1, -1))[0]
            else:
                stats_vector = self.pca.transform(stats_vector.reshape(1, -1))[0]
        
        # Ensure the vector has the correct dimensions
        if stats_vector.shape[0] < self.output_dimensions:
            # Pad with zeros if needed
            padding = np.zeros(self.output_dimensions - stats_vector.shape[0], dtype=np.float32)
            stats_vector = np.concatenate([stats_vector, padding])
        
        # Normalize the vector
        norm = np.linalg.norm(stats_vector)
        if norm > 0:
            stats_vector = stats_vector / norm
        
        return stats_vector


class TensorFlowEmbedding:
    """Generate embeddings using TensorFlow models"""
    
    def __init__(self, model_path: Optional[str] = None, output_dimensions: int = 128):
        """
        Initialize the TensorFlow embedding generator
        
        Args:
            model_path: Path to the pre-trained model
            output_dimensions: Dimensions of the output embedding vector
        """
        if not TF_AVAILABLE:
            raise ImportError("TensorFlow is not available")
        
        self.output_dimensions = output_dimensions
        
        # Load pre-trained model
        if model_path and os.path.exists(model_path):
            self.model = tf.keras.models.load_model(model_path)
        else:
            # Use MobileNetV2 as base model
            base_model = applications.MobileNetV2(
                input_shape=(224, 224, 3),
                include_top=False,
                weights='imagenet'
            )
            
            # Add global pooling layer
            self.model = tf.keras.Sequential([
                base_model,
                tf.keras.layers.GlobalAveragePooling2D()
            ])
        
        # Add projection layer if needed
        if self.model.output_shape[-1] != output_dimensions:
            projection = tf.keras.Sequential([
                tf.keras.layers.Dense(output_dimensions, activation=None),
                tf.keras.layers.LayerNormalization()
            ])
            self.model = tf.keras.Sequential([self.model, projection])
    
    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocess image for the model
        
        Args:
            image: Input image
            
        Returns:
            Preprocessed image
        """
        # Resize image
        image = tf.image.resize(image, (224, 224))
        
        # Preprocess for MobileNetV2
        image = applications.mobilenet_v2.preprocess_input(image)
        
        return image
    
    def generate_embedding(self, image: np.ndarray) -> np.ndarray:
        """
        Generate embedding for an image
        
        Args:
            image: Input image
            
        Returns:
            Embedding vector
        """
        # Preprocess image
        preprocessed = self.preprocess_image(image)
        
        # Add batch dimension
        preprocessed = tf.expand_dims(preprocessed, 0)
        
        # Generate embedding
        embedding = self.model.predict(preprocessed)[0]
        
        # Normalize the vector
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        
        return embedding


class PyTorchEmbedding:
    """Generate embeddings using PyTorch models"""
    
    def __init__(self, model_path: Optional[str] = None, output_dimensions: int = 128):
        """
        Initialize the PyTorch embedding generator
        
        Args:
            model_path: Path to the pre-trained model
            output_dimensions: Dimensions of the output embedding vector
        """
        if not TORCH_AVAILABLE:
            raise ImportError("PyTorch is not available")
        
        self.output_dimensions = output_dimensions
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Load pre-trained model
        if model_path and os.path.exists(model_path):
            self.model = torch.load(model_path, map_location=self.device)
        else:
            # Use ResNet18 as base model
            self.model = torchvision.models.resnet18(pretrained=True)
            
            # Remove the classification layer
            self.model = nn.Sequential(*list(self.model.children())[:-1])
            
            # Add projection layer if needed
            if self.model[-1].out_features != output_dimensions:
                self.model = nn.Sequential(
                    self.model,
                    nn.Flatten(),
                    nn.Linear(512, output_dimensions),
                    nn.LayerNorm(output_dimensions)
                )
        
        self.model.to(self.device)
        self.model.eval()
        
        # Define image transformations
        self.transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
    
    def preprocess_image(self, image: np.ndarray) -> torch.Tensor:
        """
        Preprocess image for the model
        
        Args:
            image: Input image
            
        Returns:
            Preprocessed image tensor
        """
        # Convert BGR to RGB (OpenCV uses BGR, PyTorch expects RGB)
        if len(image.shape) == 3 and image.shape[2] == 3:
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Apply transformations
        tensor = self.transform(image)
        
        # Add batch dimension
        tensor = tensor.unsqueeze(0)
        
        return tensor.to(self.device)
    
    def generate_embedding(self, image: np.ndarray) -> np.ndarray:
        """
        Generate embedding for an image
        
        Args:
            image: Input image
            
        Returns:
            Embedding vector
        """
        # Preprocess image
        tensor = self.preprocess_image(image)
        
        # Generate embedding
        with torch.no_grad():
            embedding = self.model(tensor)
            
            # Flatten if needed
            if len(embedding.shape) > 2:
                embedding = embedding.flatten(1)
            
            embedding = embedding[0].cpu().numpy()
        
        # Normalize the vector
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        
        return embedding


class HybridEmbedding:
    """Generate embeddings using a hybrid approach (feature-based + ML-based)"""
    
    def __init__(self, model_path: Optional[str] = None, output_dimensions: int = 256):
        """
        Initialize the hybrid embedding generator
        
        Args:
            model_path: Path to the pre-trained model
            output_dimensions: Dimensions of the output embedding vector
        """
        # Determine which ML framework to use
        self.ml_embedding = None
        if TF_AVAILABLE:
            self.ml_embedding = TensorFlowEmbedding(model_path, output_dimensions // 2)
        elif TORCH_AVAILABLE:
            self.ml_embedding = PyTorchEmbedding(model_path, output_dimensions // 2)
        
        # Initialize feature-based embedding
        self.feature_embedding = FeatureBasedEmbedding(output_dimensions // 2)
        
        self.output_dimensions = output_dimensions
    
    def generate_embedding(self, image: np.ndarray) -> np.ndarray:
        """
        Generate embedding for an image using both feature-based and ML-based approaches
        
        Args:
            image: Input image
            
        Returns:
            Embedding vector
        """
        # Generate feature-based embedding
        feature_vector = self.feature_embedding.generate_embedding(image)
        
        # Generate ML-based embedding if available
        if self.ml_embedding is not None:
            ml_vector = self.ml_embedding.generate_embedding(image)
            
            # Concatenate both embeddings
            embedding = np.concatenate([feature_vector, ml_vector])
        else:
            # If ML embedding is not available, use only feature-based embedding
            # and duplicate it to match the output dimensions
            embedding = np.concatenate([feature_vector, feature_vector])
        
        # Ensure the vector has the correct dimensions
        if embedding.shape[0] != self.output_dimensions:
            if embedding.shape[0] > self.output_dimensions:
                embedding = embedding[:self.output_dimensions]
            else:
                padding = np.zeros(self.output_dimensions - embedding.shape[0], dtype=np.float32)
                embedding = np.concatenate([embedding, padding])
        
        # Normalize the vector
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        
        return embedding


def load_image(image_path: str) -> np.ndarray:
    """
    Load an image from file
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Image as numpy array
    """
    # Check if file exists
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")
    
    # Load image
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Failed to load image: {image_path}")
    
    return image


def generate_embedding(image_path: str, method: str = 'hybrid', model_path: Optional[str] = None, output_dimensions: int = 128) -> Dict[str, Any]:
    """
    Generate embedding for an image
    
    Args:
        image_path: Path to the image file
        method: Method to use for embedding generation (feature-based, ml-based, hybrid)
        model_path: Path to the pre-trained model (for ML-based method)
        output_dimensions: Dimensions of the output embedding vector
        
    Returns:
        Dictionary with embedding vector and metadata
    """
    # Load image
    image = load_image(image_path)
    
    # Initialize embedding generator based on method
    if method == 'feature-based':
        embedding_generator = FeatureBasedEmbedding(output_dimensions)
    elif method == 'ml-based':
        if TF_AVAILABLE:
            embedding_generator = TensorFlowEmbedding(model_path, output_dimensions)
        elif TORCH_AVAILABLE:
            embedding_generator = PyTorchEmbedding(model_path, output_dimensions)
        else:
            print("Warning: ML frameworks not available. Falling back to feature-based embedding.")
            embedding_generator = FeatureBasedEmbedding(output_dimensions)
    else:  # hybrid
        embedding_generator = HybridEmbedding(model_path, output_dimensions)
    
    # Generate embedding
    start_time = time.time()
    vector = embedding_generator.generate_embedding(image)
    processing_time = time.time() - start_time
    
    # Extract image metadata
    height, width = image.shape[:2]
    
    return {
        "vector": vector.tolist(),
        "dimensions": output_dimensions,
        "method": method,
        "processing_time": processing_time,
        "image_metadata": {
            "width": width,
            "height": height,
            "channels": image.shape[2] if len(image.shape) > 2 else 1,
            "path": image_path
        }
    }


def main():
    """Main function to parse arguments and generate embedding"""
    parser = argparse.ArgumentParser(description="Generate vector embedding for an image")
    parser.add_argument("image_path", help="Path to the image file")
    parser.add_argument("--method", choices=["feature-based", "ml-based", "hybrid"], 
                        default="hybrid", help="Method to use for embedding generation")
    parser.add_argument("--model-path", help="Path to the pre-trained model (for ML-based method)")
    parser.add_argument("--output-dimensions", type=int, default=128,
                        help="Dimensions of the output embedding vector")
    
    args = parser.parse_args()
    
    try:
        # Generate embedding
        result = generate_embedding(
            args.image_path,
            args.method,
            args.model_path,
            args.output_dimensions
        )
        
        # Print result as JSON
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()