#!/usr/bin/env python3
"""
Pattern Classification System

This module implements advanced classification approaches for material patterns 
with proper model implementations, training pipelines, and evaluation metrics.

Key features:
1. Hierarchical classification architecture for material taxonomy
2. Ensemble of specialized classifiers for different attributes
3. Transfer learning from pre-trained foundation models
4. Comprehensive evaluation metrics and validation pipeline

It integrates with the existing material recognition system to provide enhanced
classification capabilities beyond basic similarity functions.
"""

import os
import sys
import json
import numpy as np
import logging
import time
from typing import Dict, List, Any, Tuple, Optional, Union, Callable
from pathlib import Path
from datetime import datetime
from collections import defaultdict
import cv2
from tqdm import tqdm
import pickle
from sklearn.metrics import (
    accuracy_score, 
    precision_score, 
    recall_score, 
    f1_score, 
    confusion_matrix,
    classification_report
)
from sklearn.model_selection import train_test_split

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('pattern_classification')

# Check for deep learning frameworks
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    from torch.utils.data import Dataset, DataLoader
    from torch.optim import Adam, SGD
    import torchvision.models as models
    import torchvision.transforms as transforms
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch not available. Advanced classification will be limited.")

try:
    import tensorflow as tf
    from tensorflow.keras import applications, layers, models as tf_models
    from tensorflow.keras.optimizers import Adam as TFAdam
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    logger.warning("TensorFlow not available. Advanced classification will be limited.")

# Make sure at least one framework is available
if not TORCH_AVAILABLE and not TF_AVAILABLE:
    logger.error("No deep learning framework available. Classification will be severely limited.")


class MaterialClassifier:
    """
    Base class for material classifiers that provides common functionality
    and a consistent interface for different classifier implementations.
    """
    
    def __init__(self, 
                name: str,
                num_classes: int,
                model_path: Optional[str] = None,
                input_shape: Tuple[int, int, int] = (224, 224, 3),
                batch_size: int = 32,
                cache_dir: Optional[str] = None):
        """
        Initialize the classifier
        
        Args:
            name: Name of the classifier
            num_classes: Number of classes
            model_path: Path to a pre-trained model
            input_shape: Shape of input images (height, width, channels)
            batch_size: Batch size for training and inference
            cache_dir: Directory to cache models and data
        """
        self.name = name
        self.num_classes = num_classes
        self.model_path = model_path
        self.input_shape = input_shape
        self.batch_size = batch_size
        self.cache_dir = cache_dir
        
        # Convert input shape if needed
        if len(self.input_shape) == 3:
            self.height, self.width, self.channels = self.input_shape
        else:
            self.height, self.width = self.input_shape
            self.channels = 3
        
        # Class mapping
        self.classes = {}
        self.class_weights = None
        
        # Training history
        self.history = {}
        
        # Evaluation metrics
        self.metrics = {}
        
        # Create cache directory if needed
        if self.cache_dir:
            os.makedirs(self.cache_dir, exist_ok=True)
    
    def preprocess_image(self, image: Union[str, np.ndarray]) -> np.ndarray:
        """
        Preprocess an image for the classifier
        
        Args:
            image: Image file path or numpy array
            
        Returns:
            Preprocessed image as numpy array
        """
        # Load image if path is provided
        if isinstance(image, str):
            # Check if file exists
            if not os.path.exists(image):
                logger.error(f"Image file not found: {image}")
                return np.zeros(self.input_shape)
            
            # Load image
            image_array = cv2.imread(image)
            if image_array is None:
                logger.error(f"Error loading image: {image}")
                return np.zeros(self.input_shape)
            
            # Convert BGR to RGB
            image_array = cv2.cvtColor(image_array, cv2.COLOR_BGR2RGB)
        else:
            # If image is already a numpy array, ensure it's RGB
            if len(image.shape) == 3 and image.shape[2] == 3:
                # Check if it's BGR (OpenCV format)
                if isinstance(image, np.ndarray):
                    image_array = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                else:
                    image_array = image
            else:
                logger.error("Invalid image format")
                return np.zeros(self.input_shape)
        
        # Resize image to the required input shape
        resized = cv2.resize(image_array, (self.width, self.height))
        
        # Normalize pixel values to [0, 1]
        normalized = resized / 255.0
        
        return normalized
    
    def load_model(self) -> bool:
        """
        Load a pre-trained model
        
        Returns:
            True if model was loaded successfully, False otherwise
        """
        # This is a base method that should be implemented by subclasses
        logger.warning("load_model not implemented in base class")
        return False
    
    def save_model(self, save_path: Optional[str] = None) -> bool:
        """
        Save the model to disk
        
        Args:
            save_path: Path to save the model
            
        Returns:
            True if model was saved successfully, False otherwise
        """
        # This is a base method that should be implemented by subclasses
        logger.warning("save_model not implemented in base class")
        return False
    
    def predict(self, 
               image: Union[str, np.ndarray], 
               return_probabilities: bool = False) -> Union[str, Dict[str, float]]:
        """
        Predict the class of an image
        
        Args:
            image: Image file path or numpy array
            return_probabilities: If True, return a dictionary mapping class names to probabilities
            
        Returns:
            Predicted class or dictionary of class probabilities
        """
        # This is a base method that should be implemented by subclasses
        logger.warning("predict not implemented in base class")
        if return_probabilities:
            return {}
        else:
            return ""
    
    def train(self, 
             train_data: Union[str, Dict[str, Any]],
             validation_data: Optional[Union[str, Dict[str, Any]]] = None,
             epochs: int = 10,
             learning_rate: float = 0.001,
             output_dir: Optional[str] = None) -> Dict[str, Any]:
        """
        Train the classifier
        
        Args:
            train_data: Training data as file path or dictionary
            validation_data: Validation data as file path or dictionary
            epochs: Number of training epochs
            learning_rate: Learning rate
            output_dir: Directory to save training outputs
            
        Returns:
            Training history
        """
        # This is a base method that should be implemented by subclasses
        logger.warning("train not implemented in base class")
        return {}
    
    def evaluate(self, 
                test_data: Union[str, Dict[str, Any]],
                output_dir: Optional[str] = None) -> Dict[str, Any]:
        """
        Evaluate the classifier on test data
        
        Args:
            test_data: Test data as file path or dictionary
            output_dir: Directory to save evaluation outputs
            
        Returns:
            Evaluation metrics
        """
        # This is a base method that should be implemented by subclasses
        logger.warning("evaluate not implemented in base class")
        return {}
    
    def _load_classes(self, class_file: str) -> Dict[int, str]:
        """
        Load class mapping from a file
        
        Args:
            class_file: Path to the class mapping file
            
        Returns:
            Dictionary mapping class indices to class names
        """
        try:
            if not os.path.exists(class_file):
                logger.warning(f"Class file not found: {class_file}")
                return {}
            
            with open(class_file, 'r') as f:
                class_data = json.load(f)
            
            # Check format
            if isinstance(class_data, dict):
                # Convert string keys to integers if needed
                classes = {}
                for k, v in class_data.items():
                    try:
                        classes[int(k)] = v
                    except ValueError:
                        classes[k] = v
                return classes
            elif isinstance(class_data, list):
                # Convert list to dict with indices as keys
                return {i: class_name for i, class_name in enumerate(class_data)}
            else:
                logger.warning(f"Unsupported class file format: {class_file}")
                return {}
                
        except Exception as e:
            logger.error(f"Error loading classes from {class_file}: {e}")
            return {}
    
    def _calculate_class_weights(self, labels: List[int]) -> Dict[int, float]:
        """
        Calculate class weights based on frequency
        
        Args:
            labels: List of class labels (integers)
            
        Returns:
            Dictionary mapping class indices to weights
        """
        if not labels:
            return {}
        
        # Count occurrences of each class
        class_counts = {}
        for label in labels:
            if label not in class_counts:
                class_counts[label] = 0
            class_counts[label] += 1
        
        # Calculate weights (inversely proportional to frequency)
        total_samples = len(labels)
        num_classes = max(self.num_classes, len(class_counts))
        weights = {}
        
        for label, count in class_counts.items():
            weights[label] = total_samples / (num_classes * count)
        
        return weights


class PyTorchMaterialClassifier(MaterialClassifier):
    """
    Material classifier using PyTorch with transfer learning
    from pre-trained vision models.
    """
    
    def __init__(self, 
                name: str,
                num_classes: int,
                model_path: Optional[str] = None,
                base_model: str = "resnet18",
                input_shape: Tuple[int, int, int] = (224, 224, 3),
                batch_size: int = 32,
                device: Optional[str] = None,
                cache_dir: Optional[str] = None):
        """
        Initialize the PyTorch classifier
        
        Args:
            name: Name of the classifier
            num_classes: Number of classes
            model_path: Path to a pre-trained model
            base_model: Base model architecture (resnet18, efficientnet_b0, mobilenet_v2)
            input_shape: Shape of input images (height, width, channels)
            batch_size: Batch size for training and inference
            device: Device to run the model on ('cuda', 'cpu', or None for auto-detection)
            cache_dir: Directory to cache models and data
        """
        super().__init__(name, num_classes, model_path, input_shape, batch_size, cache_dir)
        
        # Check if PyTorch is available
        if not TORCH_AVAILABLE:
            logger.error("PyTorch not available")
            return
        
        self.base_model = base_model
        
        # Set device
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)
        
        # Initialize transforms
        self.transform = transforms.Compose([
            transforms.ToTensor(),
            transforms.Resize((self.height, self.width)),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                               std=[0.229, 0.224, 0.225])
        ])
        
        # Initialize model
        self._initialize_model()
        
        # Load pre-trained model if path is provided
        if self.model_path and os.path.exists(self.model_path):
            self.load_model()
    
    def _initialize_model(self):
        """Initialize the model architecture"""
        if not TORCH_AVAILABLE:
            return
        
        try:
            # Select base model
            if self.base_model == 'resnet18':
                base = models.resnet18(pretrained=True)
                num_features = base.fc.in_features
                base.fc = nn.Linear(num_features, self.num_classes)
            elif self.base_model == 'efficientnet_b0':
                base = models.efficientnet_b0(pretrained=True)
                num_features = base.classifier[1].in_features
                base.classifier = nn.Sequential(
                    nn.Dropout(p=0.2, inplace=True),
                    nn.Linear(num_features, self.num_classes)
                )
            elif self.base_model == 'mobilenet_v2':
                base = models.mobilenet_v2(pretrained=True)
                num_features = base.classifier[1].in_features
                base.classifier = nn.Sequential(
                    nn.Dropout(p=0.2),
                    nn.Linear(num_features, self.num_classes)
                )
            else:
                logger.error(f"Unsupported base model: {self.base_model}")
                return
            
            # Create model
            self.model = base
            
            # Move to device
            self.model.to(self.device)
            
            logger.info(f"Initialized PyTorch model: {self.base_model} with {self.num_classes} classes")
            
        except Exception as e:
            logger.error(f"Error initializing PyTorch model: {e}")
    
    def load_model(self) -> bool:
        """
        Load a pre-trained model
        
        Returns:
            True if model was loaded successfully, False otherwise
        """
        if not TORCH_AVAILABLE or not hasattr(self, 'model'):
            return False
        
        try:
            logger.info(f"Loading model from {self.model_path}")
            
            # Load checkpoint
            checkpoint = torch.load(self.model_path, map_location=self.device)
            
            # Load model state
            if 'model_state_dict' in checkpoint:
                self.model.load_state_dict(checkpoint['model_state_dict'])
            else:
                # Try to load as a complete model
                self.model = checkpoint
            
            # Load classes if available
            if 'classes' in checkpoint:
                self.classes = checkpoint['classes']
            
            # Load history if available
            if 'history' in checkpoint:
                self.history = checkpoint['history']
            
            # Load metrics if available
            if 'metrics' in checkpoint:
                self.metrics = checkpoint['metrics']
            
            logger.info(f"Model loaded successfully from {self.model_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return False
    
    def save_model(self, save_path: Optional[str] = None) -> bool:
        """
        Save the model to disk
        
        Args:
            save_path: Path to save the model
            
        Returns:
            True if model was saved successfully, False otherwise
        """
        if not TORCH_AVAILABLE or not hasattr(self, 'model'):
            return False
        
        try:
            # Use provided path or default
            path = save_path or self.model_path
            
            if path is None:
                # Generate default path
                if not self.cache_dir:
                    logger.error("No save path provided and no cache directory set")
                    return False
                
                # Create filename with timestamp
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                path = os.path.join(self.cache_dir, f"{self.name}_{timestamp}.pt")
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(path), exist_ok=True)
            
            # Create checkpoint
            checkpoint = {
                'model_state_dict': self.model.state_dict(),
                'classes': self.classes,
                'num_classes': self.num_classes,
                'base_model': self.base_model,
                'history': self.history,
                'metrics': self.metrics,
                'timestamp': datetime.now().isoformat()
            }
            
            # Save model
            torch.save(checkpoint, path)
            
            logger.info(f"Model saved to {path}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving model: {e}")
            return False
    
    def preprocess_image(self, image: Union[str, np.ndarray]) -> torch.Tensor:
        """
        Preprocess an image for the PyTorch model
        
        Args:
            image: Image file path or numpy array
            
        Returns:
            Preprocessed image as PyTorch tensor
        """
        if not TORCH_AVAILABLE:
            return None
        
        # Load image if path is provided
        if isinstance(image, str):
            # Check if file exists
            if not os.path.exists(image):
                logger.error(f"Image file not found: {image}")
                return torch.zeros((3, self.height, self.width), device=self.device)
            
            # Load image
            image_array = cv2.imread(image)
            if image_array is None:
                logger.error(f"Error loading image: {image}")
                return torch.zeros((3, self.height, self.width), device=self.device)
            
            # Convert BGR to RGB
            image_array = cv2.cvtColor(image_array, cv2.COLOR_BGR2RGB)
        else:
            # If image is already a numpy array, ensure it's RGB
            if len(image.shape) == 3 and image.shape[2] == 3:
                # Check if it's BGR (OpenCV format)
                if isinstance(image, np.ndarray):
                    image_array = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                else:
                    image_array = image
            else:
                logger.error("Invalid image format")
                return torch.zeros((3, self.height, self.width), device=self.device)
        
        try:
            # Convert to PIL Image and apply transforms
            from PIL import Image
            pil_image = Image.fromarray(image_array)
            tensor = self.transform(pil_image)
            
            # Add batch dimension and move to device
            tensor = tensor.unsqueeze(0).to(self.device)
            
            return tensor
            
        except Exception as e:
            logger.error(f"Error preprocessing image: {e}")
            return torch.zeros((3, self.height, self.width), device=self.device)
    
    def predict(self, 
               image: Union[str, np.ndarray], 
               return_probabilities: bool = False) -> Union[str, Dict[str, float]]:
        """
        Predict the class of an image
        
        Args:
            image: Image file path or numpy array
            return_probabilities: If True, return a dictionary mapping class names to probabilities
            
        Returns:
            Predicted class or dictionary of class probabilities
        """
        if not TORCH_AVAILABLE or not hasattr(self, 'model'):
            if return_probabilities:
                return {}
            else:
                return ""
        
        try:
            # Preprocess image
            tensor = self.preprocess_image(image)
            
            # Set model to evaluation mode
            self.model.eval()
            
            # Forward pass
            with torch.no_grad():
                output = self.model(tensor)
                
                # Apply softmax to get probabilities
                probabilities = F.softmax(output, dim=1).squeeze().cpu().numpy()
                
                # Get predicted class
                predicted_idx = int(np.argmax(probabilities))
                
                if return_probabilities:
                    # Map indices to class names
                    result = {}
                    for idx, prob in enumerate(probabilities):
                        class_name = self.classes.get(idx, f"class_{idx}")
                        result[class_name] = float(prob)
                    
                    return result
                else:
                    # Return class name
                    return self.classes.get(predicted_idx, f"class_{predicted_idx}")
                
        except Exception as e:
            logger.error(f"Error predicting: {e}")
            if return_probabilities:
                return {}
            else:
                return ""
    
    def train(self, 
             train_data: Union[str, Dict[str, Any]],
             validation_data: Optional[Union[str, Dict[str, Any]]] = None,
             epochs: int = 10,
             learning_rate: float = 0.001,
             output_dir: Optional[str] = None) -> Dict[str, Any]:
        """
        Train the classifier
        
        Args:
            train_data: Training data as file path or dictionary
            validation_data: Validation data as file path or dictionary
            epochs: Number of training epochs
            learning_rate: Learning rate
            output_dir: Directory to save training outputs
            
        Returns:
            Training history
        """
        if not TORCH_AVAILABLE or not hasattr(self, 'model'):
            return {}
        
        try:
            # Create output directory if needed
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
            
            # Prepare data
            train_dataset = self._prepare_dataset(train_data)
            train_loader = DataLoader(train_dataset, batch_size=self.batch_size, shuffle=True)
            
            if validation_data:
                val_dataset = self._prepare_dataset(validation_data)
                val_loader = DataLoader(val_dataset, batch_size=self.batch_size, shuffle=False)
                
            # Prepare optimizer and loss function
            optimizer = Adam(self.model.parameters(), lr=learning_rate)
            
            if self.class_weights is not None and len(self.class_weights) > 0:
                # Convert class weights to tensor
                weight_tensor = torch.tensor(
                    [self.class_weights.get(i, 1.0) for i in range(self.num_classes)],
                    device=self.device
                )
                criterion = nn.CrossEntropyLoss(weight=weight_tensor)
            else:
                criterion = nn.CrossEntropyLoss()
            
            # Initialize history
            history = {
                'train_loss': [],
                'train_accuracy': [],
                'val_loss': [],
                'val_accuracy': []
            }
            
            # Training loop
            logger.info(f"Starting training for {epochs} epochs")
            
            for epoch in range(epochs):
                # Training
                self.model.train()
                train_loss = 0.0
                correct = 0
                total = 0
                
                for i, (inputs, labels) in enumerate(tqdm(train_loader, desc=f"Epoch {epoch+1}/{epochs}")):
                    # Move to device
                    inputs, labels = inputs.to(self.device), labels.to(self.device)
                    
                    # Zero the parameter gradients
                    optimizer.zero_grad()
                    
                    # Forward pass
                    outputs = self.model(inputs)
                    loss = criterion(outputs, labels)
                    
                    # Backward and optimize
                    loss.backward()
                    optimizer.step()
                    
                    # Statistics
                    train_loss += loss.item()
                    _, predicted = outputs.max(1)
                    total += labels.size(0)
                    correct += predicted.eq(labels).sum().item()
                
                train_loss = train_loss / len(train_loader)
                train_accuracy = correct / total
                
                # Validation
                if validation_data:
                    self.model.eval()
                    val_loss = 0.0
                    correct = 0
                    total = 0
                    
                    with torch.no_grad():
                        for inputs, labels in val_loader:
                            # Move to device
                            inputs, labels = inputs.to(self.device), labels.to(self.device)
                            
                            # Forward pass
                            outputs = self.model(inputs)
                            loss = criterion(outputs, labels)
                            
                            # Statistics
                            val_loss += loss.item()
                            _, predicted = outputs.max(1)
                            total += labels.size(0)
                            correct += predicted.eq(labels).sum().item()
                    
                    val_loss = val_loss / len(val_loader)
                    val_accuracy = correct / total
                    
                    logger.info(f"Epoch {epoch+1}/{epochs} - "
                                f"Train Loss: {train_loss:.4f}, "
                                f"Train Acc: {train_accuracy:.4f}, "
                                f"Val Loss: {val_loss:.4f}, "
                                f"Val Acc: {val_accuracy:.4f}")
                else:
                    logger.info(f"Epoch {epoch+1}/{epochs} - "
                                f"Train Loss: {train_loss:.4f}, "
                                f"Train Acc: {train_accuracy:.4f}")
                
                # Update history
                history['train_loss'].append(train_loss)
                history['train_accuracy'].append(train_accuracy)
                
                if validation_data:
                    history['val_loss'].append(val_loss)
                    history['val_accuracy'].append(val_accuracy)
                
                # Save checkpoint
                if output_dir:
                    checkpoint_path = os.path.join(output_dir, f"checkpoint_epoch_{epoch+1}.pt")
                    self.save_model(checkpoint_path)
            
            # Save final model
            if output_dir:
                final_path = os.path.join(output_dir, "final_model.pt")
                self.save_model(final_path)
            
            # Update instance history
            self.history = history
            
            return history
            
        except Exception as e:
            logger.error(f"Error training model: {e}")
            return {}
    
    def evaluate(self, 
                test_data: Union[str, Dict[str, Any]],
                output_dir: Optional[str] = None) -> Dict[str, Any]:
        """
        Evaluate the classifier on test data
        
        Args:
            test_data: Test data as file path or dictionary
            output_dir: Directory to save evaluation outputs
            
        Returns:
            Evaluation metrics
        """
        if not TORCH_AVAILABLE or not hasattr(self, 'model'):
            return {}
        
        try:
            # Create output directory if needed
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
            
            # Prepare data
            test_dataset = self._prepare_dataset(test_data)
            test_loader = DataLoader(test_dataset, batch_size=self.batch_size, shuffle=False)
            
            # Set model to evaluation mode
            self.model.eval()
            
            # Initialize metrics
            all_labels = []
            all_predictions = []
            
            # Evaluation loop
            logger.info(f"Evaluating model on {len(test_dataset)} samples")
            
            with torch.no_grad():
                for inputs, labels in tqdm(test_loader, desc="Evaluating"):
                    # Move to device
                    inputs, labels = inputs.to(self.device), labels.to(self.device)
                    
                    # Forward pass
                    outputs = self.model(inputs)
                    _, predicted = outputs.max(1)
                    
                    # Add to metrics
                    all_labels.extend(labels.cpu().numpy())
                    all_predictions.extend(predicted.cpu().numpy())
            
            # Calculate metrics
            if len(all_labels) > 0 and len(all_predictions) > 0:
                accuracy = accuracy_score(all_labels, all_predictions)
                
                # For multi-class metrics, use 'weighted' average
                precision = precision_score(all_labels, all_predictions, average='weighted', zero_division=0)
                recall = recall_score(all_labels, all_predictions, average='weighted', zero_division=0)
                f1 = f1_score(all_labels, all_predictions, average='weighted', zero_division=0)
                
                # Calculate confusion matrix
                cm = confusion_matrix(all_labels, all_predictions)
                
                # Generate classification report
                class_names = [self.classes.get(i, f"class_{i}") for i in range(self.num_classes)]
                report = classification_report(all_labels, all_predictions, 
                                              target_names=class_names, zero_division=0)
                
                # Compile metrics
                metrics = {
                    'accuracy': float(accuracy),
                    'precision': float(precision),
                    'recall': float(recall),
                    'f1_score': float(f1),
                    'confusion_matrix': cm.tolist(),
                    'classification_report': report,
                    'num_samples': len(all_labels),
                    'timestamp': datetime.now().isoformat()
                }
                
                # Save metrics
                if output_dir:
                    metrics_path = os.path.join(output_dir, "evaluation_metrics.json")
                    with open(metrics_path, 'w') as f:
                        # Convert numpy arrays to lists for JSON serialization
                        json_metrics = metrics.copy()
                        json_metrics['confusion_matrix'] = cm.tolist()
                        json.dump(json_metrics, f, indent=2)
                
                # Log metrics
                logger.info(f"Evaluation metrics:")
                logger.info(f"  Accuracy: {accuracy:.4f}")
                logger.info(f"  Precision: {precision:.4f}")
                logger.info(f"  Recall: {recall:.4f}")
                logger.info(f"  F1 Score: {f1:.4f}")
                logger.info(f"  Samples: {len(all_labels)}")
                
                # Update instance metrics
                self.metrics = metrics
                
                return metrics
            else:
                logger.warning("No labels or predictions available for evaluation")
                return {}
            
        except Exception as e:
            logger.error(f"Error evaluating model: {e}")
            return {}
    
    def _prepare_dataset(self, data: Union[str, Dict[str, Any]]) -> 'PyTorchDataset':
        """
        Prepare a dataset from data
        
        Args:
            data: Data as file path or dictionary
            
        Returns:
            PyTorch dataset
        """
        # Load data from file if path is provided
        if isinstance(data, str):
            # Check if file exists
            if not os.path.exists(data):
                logger.error(f"Data file not found: {data}")
                return None
            
            # Load data
            with open(data, 'r') as f:
                data_dict = json.load(f)
        else:
            data_dict = data
        
        # Check if data is in the expected format
        if not isinstance(data_dict, dict):
            logger.error(f"Invalid data format, expected dictionary")
            return None
        
        # Extract images and labels
        images = data_dict.get('images', [])
        labels = data_dict.get('labels', [])
        
        # Extract class mapping if available
        if 'classes' in data_dict:
            self.classes = data_dict['classes']
        
        # Create dataset
        dataset = PyTorchDataset(
            images=images,
            labels=labels,
            transform=self.transform,
            classes=self.classes
        )
        
        # Calculate class weights if not already set
        if self.class_weights is None and labels:
            self.class_weights = self._calculate_class_weights(labels)
        
        return dataset


class PyTorchDataset(Dataset):
    """
    PyTorch dataset for material classification
    """
    
    def __init__(self, 
                images: List[Union[str, np.ndarray]],
                labels: List[int],
                transform=None,
                classes: Optional[Dict[int, str]] = None):
        """
        Initialize the dataset
        
        Args:
            images: List of image file paths or numpy arrays
            labels: List of class labels (integers)
            transform: PyTorch transforms to apply to images
            classes: Dictionary mapping class indices to class names
        """
        self.images = images
        self.labels = labels
        self.transform = transform
        self.classes = classes or {}
        
        # Validate data
        if len(self.images) != len(self.labels):
            logger.warning(f"Number of images ({len(self.images)}) does not match "
                         f"number of labels ({len(self.labels)})")
    
    def __len__(self):
        """Get dataset length"""
        return len(self.images)
    
    def __getitem__(self, idx):
        """
        Get dataset item at index
        
        Returns:
            Tuple of (image, label)
        """
        # Get image and label
        image = self.images[idx]
        label = self.labels[idx]
        
        # Load image if path is provided
        if isinstance(image, str):
            # Check if file exists
            if not os.path.exists(image):
                logger.error(f"Image file not found: {image}")
                return torch.zeros((3, 224, 224)), label
            
            # Load image
            try:
                from PIL import Image as PILImage
                image = PILImage.open(image).convert('RGB')
            except Exception as e:
                logger.error(f"Error loading image: {e}")
                return torch.zeros((3, 224, 224)), label
        else:
            # Convert numpy array to PIL Image
            try:
                from PIL import Image as PILImage
                if isinstance(image, np.ndarray):
                    # Convert BGR to RGB if needed
                    if image.shape[2] == 3:
                        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                    image = PILImage.fromarray(image)
            except Exception as e:
                logger.error(f"Error converting image: {e}")
                return torch.zeros((3, 224, 224)), label
        
        # Apply transform if available
        if self.transform:
            image = self.transform(image)
        
        return image, label


class TensorFlowMaterialClassifier(MaterialClassifier):
    """
    Material classifier using TensorFlow with transfer learning
    from pre-trained vision models.
    """
    
    def __init__(self, 
                name: str,
                num_classes: int,
                model_path: Optional[str] = None,
                base_model: str = "mobilenet_v2",
                input_shape: Tuple[int, int, int] = (224, 224, 3),
                batch_size: int = 32,
                cache_dir: Optional[str] = None):
        """
        Initialize the TensorFlow classifier
        
        Args:
            name: Name of the classifier
            num_classes: Number of classes
            model_path: Path to a pre-trained model
            base_model: Base model architecture (mobilenet_v2, efficientnet, resnet50)
            input_shape: Shape of input images (height, width, channels)
            batch_size: Batch size for training and inference
            cache_dir: Directory to cache models and data
        """
        super().__init__(name, num_classes, model_path, input_shape, batch_size, cache_dir)
        
        # Check if TensorFlow is available
        if not TF_AVAILABLE:
            logger.error("TensorFlow not available")
            return
        
        self.base_model = base_model
        
        # Initialize model
        self._initialize_model()
        
        # Load pre-trained model if path is provided
        if self.model_path and os.path.exists(self.model_path):
            self.load_model()
    
    def _initialize_model(self):
        """Initialize the model architecture"""
        if not TF_AVAILABLE:
            return
        
        try:
            # Select base model
            if self.base_model == 'mobilenet_v2':
                base = applications.MobileNetV2(
                    input_shape=self.input_shape,
                    include_top=False,
                    weights='imagenet'
                )
            elif self.base_model == 'efficientnet':
                base = applications.EfficientNetB0(
                    input_shape=self.input_shape,
                    include_top=False,
                    weights='imagenet'
                )
            elif self.base_model == 'resnet50':
                base = applications.ResNet50(
                    input_shape=self.input_shape,
                    include_top=False,
                    weights='imagenet'
                )
            else:
                logger.error(f"Unsupported base model: {self.base_model}")
                return
            
            # Freeze base model layers
            base.trainable = False
            
            # Create model
            model = tf_models.Sequential([
                base,
                layers.GlobalAveragePooling2D(),
                layers.Dense(128, activation='relu'),
                layers.Dropout(0.2),
                layers.Dense(self.num_classes, activation='softmax')
            ])
            
            # Compile model
            model.compile(
                optimizer=TFAdam(learning_rate=0.001),
                loss='sparse_categorical_crossentropy',
                metrics=['accuracy']
            )
            
            self.model = model
            
            logger.info(f"Initialized TensorFlow model: {self.base_model} with {self.num_classes} classes")
            
        except Exception as e:
            logger.error(f"Error initializing TensorFlow model: {e}")
    
    def load_model(self) -> bool:
        """
        Load a pre-trained model
        
        Returns:
            True if model was loaded successfully, False otherwise
        """
        if not TF_AVAILABLE:
            return False
        
        try:
            logger.info(f"Loading model from {self.model_path}")
            
            # Load model
            self.model = tf_models.load_model(self.model_path)
            
            # Load classes if available
            classes_path = os.path.join(os.path.dirname(self.model_path), "classes.json")
            if os.path.exists(classes_path):
                with open(classes_path, 'r') as f:
                    self.classes = json.load(f)
            
            # Load history if available
            history_path = os.path.join(os.path.dirname(self.model_path), "history.json")
            if os.path.exists(history_path):
                with open(history_path, 'r') as f:
                    self.history = json.load(f)
            
            # Load metrics if available
            metrics_path = os.path.join(os.path.dirname(self.model_path), "metrics.json")
            if os.path.exists(metrics_path):
                with open(metrics_path, 'r') as f:
                    self.metrics = json.load(f)
            
            logger.info(f"Model loaded successfully from {self.model_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return False
    
    def save_model(self, save_path: Optional[str] = None) -> bool:
        """
        Save the model to disk
        
        Args:
            save_path: Path to save the model
            
        Returns:
            True if model was saved successfully, False otherwise
        """
        if not TF_AVAILABLE or not hasattr(self, 'model'):
            return False
        
        try:
            # Use provided path or default
            path = save_path or self.model_path
            
            if path is None:
                # Generate default path
                if not self.cache_dir:
                    logger.error("No save path provided and no cache directory set")
                    return False
                
                # Create filename with timestamp
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                path = os.path.join(self.cache_dir, f"{self.name}_{timestamp}")
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(path), exist_ok=True)
            
            # Save model
            self.model.save(path)
            
            # Save classes if available
            if self.classes:
                classes_path = os.path.join(os.path.dirname(path), "classes.json")
                with open(classes_path, 'w') as f:
                    json.dump(self.classes, f, indent=2)
            
            # Save history if available
            if self.history:
                history_path = os.path.join(os.path.dirname(path), "history.json")
                with open(history_path, 'w') as f:
                    json.dump(self.history, f, indent=2)
            
            # Save metrics if available
            if self.metrics:
                metrics_path = os.path.join(os.path.dirname(path), "metrics.json")
                with open(metrics_path, 'w') as f:
                    json.dump(self.metrics, f, indent=2)
            
            logger.info(f"Model saved to {path}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving model: {e}")
            return False
    
    def preprocess_image(self, image: Union[str, np.ndarray]) -> np.ndarray:
        """
        Preprocess an image for the TensorFlow model
        
        Args:
            image: Image file path or numpy array
            
        Returns:
            Preprocessed image as numpy array
        """
        if not TF_AVAILABLE:
            return None
        
        # Load image if path is provided
        if isinstance(image, str):
            # Check if file exists
            if not os.path.exists(image):
                logger.error(f"Image file not found: {image}")
                return np.zeros(self.input_shape)
            
            # Load image
            try:
                img = tf.keras.preprocessing.image.load_img(
                    image, target_size=(self.height, self.width)
                )
                img_array = tf.keras.preprocessing.image.img_to_array(img)
                img_array = np.expand_dims(img_array, axis=0)
                
                # Apply preprocess_input for the appropriate base model
                if self.base_model == 'mobilenet_v2':
                    processed = applications.mobilenet_v2.preprocess_input(img_array)
                elif self.base_model == 'efficientnet':
                    processed = applications.efficientnet.preprocess_input(img_array)
                elif self.base_model == 'resnet50':
                    processed = applications.resnet50.preprocess_input(img_array)
                else:
                    processed = img_array / 255.0
                
                return processed
                
            except Exception as e:
                logger.error(f"Error preprocessing image: {e}")
                return np.zeros((1, self.height, self.width, self.channels))
        else:
            # If image is already a numpy array
            try:
                # Resize if needed
                if image.shape[0] != self.height or image.shape[1] != self.width:
                    image = cv2.resize(image, (self.width, self.height))
                
                # Convert BGR to RGB if needed
                if len(image.shape) == 3 and image.shape[2] == 3:
                    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                
                # Add batch dimension
                img_array = np.expand_dims(image, axis=0)
                
                # Apply preprocess_input for the appropriate base model
                if self.base_model == 'mobilenet_v2':
                    processed = applications.mobilenet_v2.preprocess_input(img_array)
                elif self.base_model == 'efficientnet':
                    processed = applications.efficientnet.preprocess_input(img_array)
                elif self.base_model == 'resnet50':
                    processed = applications.resnet50.preprocess_input(img_array)
                else:
                    processed = img_array / 255.0
                
                return processed
                
            except Exception as e:
                logger.error(f"Error preprocessing image: {e}")
                return np.zeros((1, self.height, self.width, self.channels))
    
    def predict(self, 
               image: Union[str, np.ndarray], 
               return_probabilities: bool = False) -> Union[str, Dict[str, float]]:
        """
        Predict the class of an image
        
        Args:
            image: Image file path or numpy array
            return_probabilities: If True, return a dictionary mapping class names to probabilities
            
        Returns:
            Predicted class or dictionary of class probabilities
        """
        if not TF_AVAILABLE or not hasattr(self, 'model'):
            if return_probabilities:
                return {}
            else:
                return ""
        
        try:
            # Preprocess image
            processed = self.preprocess_image(image)
            
            # Make prediction
            predictions = self.model.predict(processed)[0]
            
            # Get predicted class
            predicted_idx = int(np.argmax(predictions))
            
            if return_probabilities:
                # Map indices to class names
                result = {}
                for idx, prob in enumerate(predictions):
                    class_name = self.classes.get(str(idx), f"class_{idx}")
                    result[class_name] = float(prob)
                
                return result
            else:
                # Return class name
                return self.classes.get(str(predicted_idx), f"class_{predicted_idx}")
                
        except Exception as e:
            logger.error(f"Error predicting: {e}")
            if return_probabilities:
                return {}
            else:
                return ""
    
    def train(self, 
             train_data: Union[str, Dict[str, Any]],
             validation_data: Optional[Union[str, Dict[str, Any]]] = None,
             epochs: int = 10,
             learning_rate: float = 0.001,
             output_dir: Optional[str] = None) -> Dict[str, Any]:
        """
        Train the classifier
        
        Args:
            train_data: Training data as file path or dictionary
            validation_data: Validation data as file path or dictionary
            epochs: Number of training epochs
            learning_rate: Learning rate
            output_dir: Directory to save training outputs
            
        Returns:
            Training history
        """
        if not TF_AVAILABLE or not hasattr(self, 'model'):
            return {}
        
        try:
            # Create output directory if needed
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
            
            # Prepare data
            train_images, train_labels = self._prepare_data(train_data)
            
            if validation_data:
                val_images, val_labels = self._prepare_data(validation_data)
            else:
                val_images, val_labels = None, None
            
            # Configure optimizer
            self.model.optimizer = TFAdam(learning_rate=learning_rate)
            
            # Configure class weights
            if self.class_weights is not None and len(self.class_weights) > 0:
                # Convert to dictionary with string keys
                class_weights = {str(k): float(v) for k, v in self.class_weights.items()}
            else:
                class_weights = None
            
            # Create callbacks
            callbacks = []
            
            if output_dir:
                # Create checkpoint callback
                checkpoint_path = os.path.join(output_dir, "checkpoint_epoch_{epoch:02d}.h5")
                checkpoint_callback = tf.keras.callbacks.ModelCheckpoint(
                    filepath=checkpoint_path,
                    save_best_only=False,
                    save_weights_only=False,
                    verbose=1
                )
                callbacks.append(checkpoint_callback)
                
                # Create TensorBoard callback
                tensorboard_path = os.path.join(output_dir, "logs")
                tensorboard_callback = tf.keras.callbacks.TensorBoard(
                    log_dir=tensorboard_path,
                    histogram_freq=1
                )
                callbacks.append(tensorboard_callback)
            
            # Train model
            history = self.model.fit(
                train_images,
                train_labels,
                batch_size=self.batch_size,
                epochs=epochs,
                validation_data=(val_images, val_labels) if val_images is not None else None,
                callbacks=callbacks,
                class_weight=class_weights
            )
            
            # Convert history to dictionary
            history_dict = {
                'train_loss': history.history['loss'],
                'train_accuracy': history.history['accuracy']
            }
            
            if validation_data:
                history_dict['val_loss'] = history.history['val_loss']
                history_dict['val_accuracy'] = history.history['val_accuracy']
            
            # Save final model
            if output_dir:
                final_path = os.path.join(output_dir, "final_model")
                self.save_model(final_path)
            
            # Update instance history
            self.history = history_dict
            
            return history_dict
            
        except Exception as e:
            logger.error(f"Error training model: {e}")
            return {}
    
    def evaluate(self, 
                test_data: Union[str, Dict[str, Any]],
                output_dir: Optional[str] = None) -> Dict[str, Any]:
        """
        Evaluate the classifier on test data
        
        Args:
            test_data: Test data as file path or dictionary
            output_dir: Directory to save evaluation outputs
            
        Returns:
            Evaluation metrics
        """
        if not TF_AVAILABLE or not hasattr(self, 'model'):
            return {}
        
        try:
            # Create output directory if needed
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
            
            # Prepare data
            test_images, test_labels = self._prepare_data(test_data)
            
            # Evaluate model
            logger.info(f"Evaluating model on {len(test_labels)} samples")
            
            # Get model predictions
            predictions = self.model.predict(test_images)
            predicted_labels = np.argmax(predictions, axis=1)
            
            # Calculate metrics
            if len(test_labels) > 0 and len(predicted_labels) > 0:
                accuracy = accuracy_score(test_labels, predicted_labels)
                
                # For multi-class metrics, use 'weighted' average
                precision = precision_score(test_labels, predicted_labels, average='weighted', zero_division=0)
                recall = recall_score(test_labels, predicted_labels, average='weighted', zero_division=0)
                f1 = f1_score(test_labels, predicted_labels, average='weighted', zero_division=0)
                
                # Calculate confusion matrix
                cm = confusion_matrix(test_labels, predicted_labels)
                
                # Generate classification report
                class_names = [self.classes.get(str(i), f"class_{i}") for i in range(self.num_classes)]
                report = classification_report(test_labels, predicted_labels, 
                                              target_names=class_names, zero_division=0)
                
                # Compile metrics
                metrics = {
                    'accuracy': float(accuracy),
                    'precision': float(precision),
                    'recall': float(recall),
                    'f1_score': float(f1),
                    'confusion_matrix': cm.tolist(),
                    'classification_report': report,
                    'num_samples': len(test_labels),
                    'timestamp': datetime.now().isoformat()
                }
                
                # Save metrics
                if output_dir:
                    metrics_path = os.path.join(output_dir, "evaluation_metrics.json")
                    with open(metrics_path, 'w') as f:
                        # Convert numpy arrays to lists for JSON serialization
                        json_metrics = metrics.copy()
                        json_metrics['confusion_matrix'] = cm.tolist()
                        json.dump(json_metrics, f, indent=2)
                
                # Log metrics
                logger.info(f"Evaluation metrics:")
                logger.info(f"  Accuracy: {accuracy:.4f}")
                logger.info(f"  Precision: {precision:.4f}")
                logger.info(f"  Recall: {recall:.4f}")
                logger.info(f"  F1 Score: {f1:.4f}")
                logger.info(f"  Samples: {len(test_labels)}")
                
                # Update instance metrics
                self.metrics = metrics
                
                return metrics
            else:
                logger.warning("No labels or predictions available for evaluation")
                return {}
            
        except Exception as e:
            logger.error(f"Error evaluating model: {e}")
            return {}
    
    def _prepare_data(self, data: Union[str, Dict[str, Any]]) -> Tuple[np.ndarray, np.ndarray]:
        """
        Prepare data for TensorFlow model
        
        Args:
            data: Data as file path or dictionary
            
        Returns:
            Tuple of (images, labels)
        """
        # Load data from file if path is provided
        if isinstance(data, str):
            # Check if file exists
            if not os.path.exists(data):
                logger.error(f"Data file not found: {data}")
                return None, None
            
            # Load data
            with open(data, 'r') as f:
                data_dict = json.load(f)
        else:
            data_dict = data
        
        # Check if data is in the expected format
        if not isinstance(data_dict, dict):
            logger.error(f"Invalid data format, expected dictionary")
            return None, None
        
        # Extract images and labels
        image_paths = data_dict.get('images', [])
        labels = np.array(data_dict.get('labels', []))
        
        # Extract class mapping if available
        if 'classes' in data_dict:
            self.classes = data_dict['classes']
        
        # Load and preprocess images
        images = []
        valid_labels = []
        
        for i, image_path in enumerate(image_paths):
            try:
                # Check if image is a path or array
                if isinstance(image_path, str):
                    # Check if file exists
                    if not os.path.exists(image_path):
                        logger.warning(f"Image file not found: {image_path}")
                        continue
                    
                    # Load and preprocess image
                    img = tf.keras.preprocessing.image.load_img(
                        image_path, target_size=(self.height, self.width)
                    )
                    img_array = tf.keras.preprocessing.image.img_to_array(img)
                    
                    # Apply preprocess_input for the appropriate base model
                    if self.base_model == 'mobilenet_v2':
                        processed = applications.mobilenet_v2.preprocess_input(img_array)
                    elif self.base_model == 'efficientnet':
                        processed = applications.efficientnet.preprocess_input(img_array)
                    elif self.base_model == 'resnet50':
                        processed = applications.resnet50.preprocess_input(img_array)
                    else:
                        processed = img_array / 255.0
                    
                    images.append(processed)
                    valid_labels.append(labels[i])
                else:
                    # If image is already a numpy array
                    image_array = image_path
                    
                    # Resize if needed
                    if image_array.shape[0] != self.height or image_array.shape[1] != self.width:
                        image_array = cv2.resize(image_array, (self.width, self.height))
                    
                    # Convert BGR to RGB if needed
                    if len(image_array.shape) == 3 and image_array.shape[2] == 3:
                        image_array = cv2.cvtColor(image_array, cv2.COLOR_BGR2RGB)
                    
                    # Apply preprocess_input for the appropriate base model
                    if self.base_model == 'mobilenet_v2':
                        processed = applications.mobilenet_v2.preprocess_input(image_array)
                    elif self.base_model == 'efficientnet':
                        processed = applications.efficientnet.preprocess_input(image_array)
                    elif self.base_model == 'resnet50':
                        processed = applications.resnet50.preprocess_input(image_array)
                    else:
                        processed = image_array / 255.0
                    
                    images.append(processed)
                    valid_labels.append(labels[i])
                    
            except Exception as e:
                logger.warning(f"Error processing image {image_path}: {e}")
        
        # Convert lists to numpy arrays
        if images:
            images_array = np.array(images)
            labels_array = np.array(valid_labels)
            
            # Calculate class weights if not already set
            if self.class_weights is None and len(labels_array) > 0:
                self.class_weights = self._calculate_class_weights(labels_array)
            
            return images_array, labels_array
        else:
            logger.warning("No valid images found")
            return np.array([]), np.array([])


class HierarchicalMaterialClassifier:
    """
    Hierarchical material classifier that combines multiple specialized
    classifiers organized in a taxonomy tree.
    """
    
    def __init__(self, 
                name: str,
                taxonomy: Dict[str, Any],
                model_dir: Optional[str] = None,
                framework: str = "pytorch",
                device: Optional[str] = None,
                cache_dir: Optional[str] = None):
        """
        Initialize the hierarchical classifier
        
        Args:
            name: Name of the classifier
            taxonomy: Taxonomy tree structure defining the hierarchy
            model_dir: Directory containing pre-trained models
            framework: Deep learning framework to use ('pytorch' or 'tensorflow')
            device: Device to run the model on ('cuda', 'cpu', or None for auto-detection)
            cache_dir: Directory to cache models and data
        """
        self.name = name
        self.taxonomy = taxonomy
        self.model_dir = model_dir
        self.framework = framework
        self.device = device
        self.cache_dir = cache_dir
        
        # Create cache directory if needed
        if self.cache_dir:
            os.makedirs(self.cache_dir, exist_ok=True)
        
        # Validate framework
        if self.framework not in ['pytorch', 'tensorflow']:
            logger.warning(f"Unsupported framework: {self.framework}. Defaulting to pytorch.")
            self.framework = 'pytorch'
        
        # Classifiers for each node in the taxonomy
        self.classifiers = {}
        
        # Root classifier
        self.root_classifier = None
        
        # Initialize classifiers
        self._initialize_classifiers()
    
    def _initialize_classifiers(self):
        """Initialize classifiers for each node in the taxonomy"""
        # Check if taxonomy is available
        if not self.taxonomy:
            logger.error("Taxonomy not provided")
            return
        
        # Check if model directory exists
        if self.model_dir and not os.path.exists(self.model_dir):
            logger.warning(f"Model directory not found: {self.model_dir}")
        
        try:
            # Initialize classifiers for each node
            for node_name, node_data in self.taxonomy.get('nodes', {}).items():
                # Get class list
                classes = node_data.get('classes', [])
                if not classes:
                    logger.warning(f"No classes defined for node: {node_name}")
                    continue
                
                # Get model path
                model_path = None
                if self.model_dir:
                    model_path = os.path.join(self.model_dir, f"{node_name}_model")
                    if not os.path.exists(model_path):
                        logger.warning(f"Model not found for node: {node_name}")
                        model_path = None
                
                # Create classifier
                if self.framework == 'pytorch':
                    classifier = PyTorchMaterialClassifier(
                        name=node_name,
                        num_classes=len(classes),
                        model_path=model_path,
                        base_model="resnet18",
                        device=self.device,
                        cache_dir=self.cache_dir
                    )
                else:
                    classifier = TensorFlowMaterialClassifier(
                        name=node_name,
                        num_classes=len(classes),
                        model_path=model_path,
                        base_model="mobilenet_v2",
                        cache_dir=self.cache_dir
                    )
                
                # Set class mapping
                classifier.classes = {i: class_name for i, class_name in enumerate(classes)}
                
                # Store classifier
                self.classifiers[node_name] = classifier
            
            # Set root classifier
            root_node = self.taxonomy.get('root')
            if root_node and root_node in self.classifiers:
                self.root_classifier = self.classifiers[root_node]
                logger.info(f"Root classifier set to: {root_node}")
            else:
                logger.warning("Root classifier not found")
            
        except Exception as e:
            logger.error(f"Error initializing classifiers: {e}")
    
    def predict(self, 
               image: Union[str, np.ndarray], 
               return_probabilities: bool = False,
               return_hierarchy: bool = False) -> Union[str, Dict[str, Any]]:
        """
        Predict the class of an image using the hierarchy
        
        Args:
            image: Image file path or numpy array
            return_probabilities: If True, return a dictionary mapping class names to probabilities
            return_hierarchy: If True, return the full prediction hierarchy
            
        Returns:
            Predicted class or prediction details
        """
        if not self.root_classifier:
            logger.error("Root classifier not available")
            if return_probabilities or return_hierarchy:
                return {}
            else:
                return ""
        
        try:
            # Start with root prediction
            current_node = self.taxonomy.get('root')
            current_classifier = self.root_classifier
            
            # Track prediction path
            hierarchy = []
            
            # Traverse the hierarchy
            while current_node:
                # Get current node data
                node_data = self.taxonomy.get('nodes', {}).get(current_node, {})
                
                # Predict with current classifier
                if return_probabilities:
                    prediction = current_classifier.predict(image, return_probabilities=True)
                else:
                    prediction = current_classifier.predict(image, return_probabilities=False)
                
                # Add to hierarchy
                hierarchy.append({
                    'node': current_node,
                    'prediction': prediction
                })
                
                # Get predicted class
                if return_probabilities:
                    # Find the class with the highest probability
                    pred_class = max(prediction.items(), key=lambda x: x[1])[0]
                else:
                    pred_class = prediction
                
                # Check if we should move to a child node
                if 'children' in node_data:
                    child_mapping = node_data.get('children', {})
                    next_node = child_mapping.get(pred_class)
                    
                    if next_node and next_node in self.classifiers:
                        # Move to child node
                        current_node = next_node
                        current_classifier = self.classifiers[next_node]
                    else:
                        # No valid child node, stop here
                        break
                else:
                    # Leaf node, stop here
                    break
            
            # Return the result
            if return_hierarchy:
                return hierarchy
            elif return_probabilities:
                # Return final node prediction
                return hierarchy[-1]['prediction']
            else:
                # Return final class
                return hierarchy[-1]['prediction']
            
        except Exception as e:
            logger.error(f"Error predicting: {e}")
            if return_probabilities or return_hierarchy:
                return {}
            else:
                return ""
    
    def save(self, output_dir: str) -> bool:
        """
        Save all classifiers and taxonomy
        
        Args:
            output_dir: Directory to save models
            
        Returns:
            True if saved successfully, False otherwise
        """
        try:
            # Create output directory
            os.makedirs(output_dir, exist_ok=True)
            
            # Save taxonomy
            taxonomy_path = os.path.join(output_dir, "taxonomy.json")
            with open(taxonomy_path, 'w') as f:
                json.dump(self.taxonomy, f, indent=2)
            
            # Save classifiers
            for node_name, classifier in self.classifiers.items():
                # Create node directory
                node_dir = os.path.join(output_dir, node_name)
                os.makedirs(node_dir, exist_ok=True)
                
                # Save classifier
                model_path = os.path.join(node_dir, "model")
                classifier.save_model(model_path)
            
            logger.info(f"Hierarchical classifier saved to {output_dir}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving hierarchical classifier: {e}")
            return False
    
    def load(self, input_dir: str) -> bool:
        """
        Load all classifiers and taxonomy
        
        Args:
            input_dir: Directory containing saved models
            
        Returns:
            True if loaded successfully, False otherwise
        """
        try:
            # Check if directory exists
            if not os.path.exists(input_dir):
                logger.error(f"Input directory not found: {input_dir}")
                return False
            
            # Load taxonomy
            taxonomy_path = os.path.join(input_dir, "taxonomy.json")
            if not os.path.exists(taxonomy_path):
                logger.error(f"Taxonomy file not found: {taxonomy_path}")
                return False
            
            with open(taxonomy_path, 'r') as f:
                self.taxonomy = json.load(f)
            
            # Clear existing classifiers
            self.classifiers = {}
            self.root_classifier = None
            
            # Initialize classifiers
            self.model_dir = input_dir
            self._initialize_classifiers()
            
            logger.info(f"Hierarchical classifier loaded from {input_dir}")
            return True
            
        except Exception as e:
            logger.error(f"Error loading hierarchical classifier: {e}")
            return False


class EnsembleMaterialClassifier:
    """
    Ensemble classifier that combines multiple specialized classifiers
    for different material attributes.
    """
    
    def __init__(self, 
                name: str,
                attributes: Dict[str, List[str]],
                model_dir: Optional[str] = None,
                framework: str = "pytorch",
                device: Optional[str] = None,
                cache_dir: Optional[str] = None):
        """
        Initialize the ensemble classifier
        
        Args:
            name: Name of the classifier
            attributes: Dictionary mapping attribute names to possible values
            model_dir: Directory containing pre-trained models
            framework: Deep learning framework to use ('pytorch' or 'tensorflow')
            device: Device to run the model on ('cuda', 'cpu', or None for auto-detection)
            cache_dir: Directory to cache models and data
        """
        self.name = name
        self.attributes = attributes
        self.model_dir = model_dir
        self.framework = framework
        self.device = device
        self.cache_dir = cache_dir
        
        # Create cache directory if needed
        if self.cache_dir:
            os.makedirs(self.cache_dir, exist_ok=True)
        
        # Validate framework
        if self.framework not in ['pytorch', 'tensorflow']:
            logger.warning(f"Unsupported framework: {self.framework}. Defaulting to pytorch.")
            self.framework = 'pytorch'
        
        # Classifier for each attribute
        self.classifiers = {}
        
        # Initialize classifiers
        self._initialize_classifiers()
    
    def _initialize_classifiers(self):
        """Initialize classifiers for each attribute"""
        # Check if attributes are available
        if not self.attributes:
            logger.error("Attributes not provided")
            return
        
        # Check if model directory exists
        if self.model_dir and not os.path.exists(self.model_dir):
            logger.warning(f"Model directory not found: {self.model_dir}")
        
        try:
            # Initialize classifiers for each attribute
            for attr_name, attr_values in self.attributes.items():
                # Get model path
                model_path = None
                if self.model_dir:
                    model_path = os.path.join(self.model_dir, f"{attr_name}_model")
                    if not os.path.exists(model_path):
                        logger.warning(f"Model not found for attribute: {attr_name}")
                        model_path = None
                
                # Create classifier
                if self.framework == 'pytorch':
                    classifier = PyTorchMaterialClassifier(
                        name=attr_name,
                        num_classes=len(attr_values),
                        model_path=model_path,
                        base_model="resnet18",
                        device=self.device,
                        cache_dir=self.cache_dir
                    )
                else:
                    classifier = TensorFlowMaterialClassifier(
                        name=attr_name,
                        num_classes=len(attr_values),
                        model_path=model_path,
                        base_model="mobilenet_v2",
                        cache_dir=self.cache_dir
                    )
                
                # Set class mapping
                classifier.classes = {i: value for i, value in enumerate(attr_values)}
                
                # Store classifier
                self.classifiers[attr_name] = classifier
            
            logger.info(f"Initialized {len(self.classifiers)} attribute classifiers")
            
        except Exception as e:
            logger.error(f"Error initializing classifiers: {e}")
    
    def predict(self, 
               image: Union[str, np.ndarray], 
               attributes: Optional[List[str]] = None,
               return_probabilities: bool = False) -> Dict[str, Any]:
        """
        Predict attributes of an image
        
        Args:
            image: Image file path or numpy array
            attributes: List of attributes to predict (all if None)
            return_probabilities: If True, return a dictionary mapping values to probabilities
            
        Returns:
            Dictionary mapping attributes to predicted values
        """
        if not self.classifiers:
            logger.error("No classifiers available")
            return {}
        
        try:
            # Determine which attributes to predict
            if attributes:
                attributes_to_predict = [attr for attr in attributes if attr in self.classifiers]
            else:
                attributes_to_predict = list(self.classifiers.keys())
            
            # Predict each attribute
            predictions = {}
            for attr in attributes_to_predict:
                classifier = self.classifiers.get(attr)
                if classifier:
                    predictions[attr] = classifier.predict(image, return_probabilities=return_probabilities)
            
            return predictions
            
        except Exception as e:
            logger.error(f"Error predicting: {e}")
            return {}
    
    def save(self, output_dir: str) -> bool:
        """
        Save all classifiers and attributes
        
        Args:
            output_dir: Directory to save models
            
        Returns:
            True if saved successfully, False otherwise
        """
        try:
            # Create output directory
            os.makedirs(output_dir, exist_ok=True)
            
            # Save attributes
            attributes_path = os.path.join(output_dir, "attributes.json")
            with open(attributes_path, 'w') as f:
                json.dump(self.attributes, f, indent=2)
            
            # Save classifiers
            for attr_name, classifier in self.classifiers.items():
                # Create attribute directory
                attr_dir = os.path.join(output_dir, attr_name)
                os.makedirs(attr_dir, exist_ok=True)
                
                # Save classifier
                model_path = os.path.join(attr_dir, "model")
                classifier.save_model(model_path)
            
            logger.info(f"Ensemble classifier saved to {output_dir}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving ensemble classifier: {e}")
            return False
    
    def load(self, input_dir: str) -> bool:
        """
        Load all classifiers and attributes
        
        Args:
            input_dir: Directory containing saved models
            
        Returns:
            True if loaded successfully, False otherwise
        """
        try:
            # Check if directory exists
            if not os.path.exists(input_dir):
                logger.error(f"Input directory not found: {input_dir}")
                return False
            
            # Load attributes
            attributes_path = os.path.join(input_dir, "attributes.json")
            if not os.path.exists(attributes_path):
                logger.error(f"Attributes file not found: {attributes_path}")
                return False
            
            with open(attributes_path, 'r') as f:
                self.attributes = json.load(f)
            
            # Clear existing classifiers
            self.classifiers = {}
            
            # Initialize classifiers
            self.model_dir = input_dir
            self._initialize_classifiers()
            
            logger.info(f"Ensemble classifier loaded from {input_dir}")
            return True
            
        except Exception as e:
            logger.error(f"Error loading ensemble classifier: {e}")
            return False


def create_classifier(
                    framework: str = "pytorch",
                    model_type: str = "hierarchical",
                    num_classes: int = 10,
                    model_path: Optional[str] = None,
                    taxonomy: Optional[Dict[str, Any]] = None,
                    attributes: Optional[Dict[str, List[str]]] = None,
                    device: Optional[str] = None,
                    cache_dir: Optional[str] = None) -> Union[MaterialClassifier, HierarchicalMaterialClassifier, EnsembleMaterialClassifier, None]:
    """
    Create a material classifier
    
    Args:
        framework: Deep learning framework to use ('pytorch' or 'tensorflow')
        model_type: Type of classifier to create ('standard', 'hierarchical', 'ensemble')
        num_classes: Number of classes for standard classifier
        model_path: Path to pre-trained model
        taxonomy: Taxonomy tree structure for hierarchical classifier
        attributes: Attribute values for ensemble classifier
        device: Device to run the model on ('cuda', 'cpu', or None for auto-detection)
        cache_dir: Directory to cache models and data
        
    Returns:
        Initialized material classifier
    """
    try:
        if model_type == "standard":
            # Create standard classifier
            if framework == "pytorch" and TORCH_AVAILABLE:
                return PyTorchMaterialClassifier(
                    name="material_classifier",
                    num_classes=num_classes,
                    model_path=model_path,
                    device=device,
                    cache_dir=cache_dir
                )
            elif framework == "tensorflow" and TF_AVAILABLE:
                return TensorFlowMaterialClassifier(
                    name="material_classifier",
                    num_classes=num_classes,
                    model_path=model_path,
                    cache_dir=cache_dir
                )
            else:
                logger.error(f"Requested framework {framework} not available")
                return None
                
        elif model_type == "hierarchical":
            # Create hierarchical classifier
            if not taxonomy:
                logger.error("Taxonomy required for hierarchical classifier")
                return None
                
            return HierarchicalMaterialClassifier(
                name="hierarchical_classifier",
                taxonomy=taxonomy,
                model_dir=model_path,
                framework=framework,
                device=device,
                cache_dir=cache_dir
            )
            
        elif model_type == "ensemble":
            # Create ensemble classifier
            if not attributes:
                logger.error("Attributes required for ensemble classifier")
                return None
                
            return EnsembleMaterialClassifier(
                name="ensemble_classifier",
                attributes=attributes,
                model_dir=model_path,
                framework=framework,
                device=device,
                cache_dir=cache_dir
            )
        
        else:
            logger.error(f"Unsupported model type: {model_type}")
            return None
            
    except Exception as e:
        logger.error(f"Error creating classifier: {e}")
        return None


def evaluate_classifier(classifier: Union[MaterialClassifier, HierarchicalMaterialClassifier, EnsembleMaterialClassifier],
                      test_data: Union[str, Dict[str, Any]],
                      output_dir: Optional[str] = None) -> Dict[str, Any]:
    """
    Evaluate a material classifier
    
    Args:
        classifier: Classifier to evaluate
        test_data: Test data as file path or dictionary
        output_dir: Directory to save evaluation outputs
        
    Returns:
        Evaluation metrics
    """
    try:
        # Create output directory if needed
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        
        # Check classifier type
        if isinstance(classifier, MaterialClassifier):
            # Standard classifier
            return classifier.evaluate(test_data, output_dir)
            
        elif isinstance(classifier, HierarchicalMaterialClassifier):
            # Hierarchical classifier - evaluate each node
            metrics = {}
            
            # Load data
            if isinstance(test_data, str):
                with open(test_data, 'r') as f:
                    data = json.load(f)
            else:
                data = test_data
            
            # Evaluate root classifier first
            if classifier.root_classifier:
                root_metrics = classifier.root_classifier.evaluate(data, output_dir)
                metrics[classifier.taxonomy.get('root')] = root_metrics
            
            # Evaluate other nodes as needed
            # In a real implementation, this would split the test data by hierarchy
            
            return metrics
            
        elif isinstance(classifier, EnsembleMaterialClassifier):
            # Ensemble classifier - evaluate each attribute
            metrics = {}
            
            # Load data
            if isinstance(test_data, str):
                with open(test_data, 'r') as f:
                    data = json.load(f)
            else:
                data = test_data
            
            # Evaluate each attribute
            for attr_name, attr_classifier in classifier.classifiers.items():
                # In a real implementation, this would filter data by attribute
                attr_metrics = attr_classifier.evaluate(data, output_dir)
                metrics[attr_name] = attr_metrics
            
            return metrics
            
        else:
            logger.error(f"Unsupported classifier type: {type(classifier)}")
            return {}
            
    except Exception as e:
        logger.error(f"Error evaluating classifier: {e}")
        return {}


if __name__ == "__main__":
    # Example usage when script is run directly
    import argparse
    
    parser = argparse.ArgumentParser(description="Material pattern classification")
    parser.add_argument("--action", choices=["train", "evaluate", "predict", "export"], 
                        required=True, help="Action to perform")
    parser.add_argument("--framework", choices=["pytorch", "tensorflow"], 
                        default="pytorch", help="Deep learning framework to use")
    parser.add_argument("--model-type", choices=["standard", "hierarchical", "ensemble"], 
                        default="standard", help="Type of classifier to create")
    parser.add_argument("--model-path", help="Path to model file or directory")
    parser.add_argument("--image", help="Path to image file for prediction")
    parser.add_argument("--data", help="Path to data file for training or evaluation")
    parser.add_argument("--output", help="Output directory")
    parser.add_argument("--num-classes", type=int, default=10, help="Number of classes")
    parser.add_argument("--taxonomy", help="Path to taxonomy JSON file")
    parser.add_argument("--attributes", help="Path to attributes JSON file")
    parser.add_argument("--epochs", type=int, default=10, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size for training")
    parser.add_argument("--learning-rate", type=float, default=0.001, help="Learning rate")
    parser.add_argument("--device", choices=["cuda", "cpu"], help="Device to use")
    parser.add_argument("--cache-dir", help="Cache directory")
    
    args = parser.parse_args()
    
    try:
        # Load taxonomy if provided
        taxonomy = None
        if args.taxonomy and os.path.exists(args.taxonomy):
            with open(args.taxonomy, 'r') as f:
                taxonomy = json.load(f)
        
        # Load attributes if provided
        attributes = None
        if args.attributes and os.path.exists(args.attributes):
            with open(args.attributes, 'r') as f:
                attributes = json.load(f)
        
        # Create classifier
        classifier = create_classifier(
            framework=args.framework,
            model_type=args.model_type,
            num_classes=args.num_classes,
            model_path=args.model_path,
            taxonomy=taxonomy,
            attributes=attributes,
            device=args.device,
            cache_dir=args.cache_dir
        )
        
        if classifier is None:
            logger.error("Failed to create classifier")
            sys.exit(1)
        
        # Perform requested action
        if args.action == "train":
            # Check if data file exists
            if not args.data or not os.path.exists(args.data):
                logger.error(f"Data file not found: {args.data}")
                sys.exit(1)
            
            # Train classifier
            if isinstance(classifier, MaterialClassifier):
                history = classifier.train(
                    train_data=args.data,
                    epochs=args.epochs,
                    learning_rate=args.learning_rate,
                    output_dir=args.output
                )
                
                logger.info(f"Training completed: {history}")
                
            else:
                logger.error(f"Training not supported for classifier type: {args.model_type}")
                sys.exit(1)
            
        elif args.action == "evaluate":
            # Check if data file exists
            if not args.data or not os.path.exists(args.data):
                logger.error(f"Data file not found: {args.data}")
                sys.exit(1)
            
            # Evaluate classifier
            metrics = evaluate_classifier(
                classifier=classifier,
                test_data=args.data,
                output_dir=args.output
            )
            
            logger.info(f"Evaluation completed: {metrics}")
            
        elif args.action == "predict":
            # Check if image file exists
            if not args.image or not os.path.exists(args.image):
                logger.error(f"Image file not found: {args.image}")
                sys.exit(1)
            
            # Predict class
            if isinstance(classifier, MaterialClassifier):
                result = classifier.predict(args.image, return_probabilities=True)
                
            elif isinstance(classifier, HierarchicalMaterialClassifier):
                result = classifier.predict(args.image, return_hierarchy=True)
                
            elif isinstance(classifier, EnsembleMaterialClassifier):
                result = classifier.predict(args.image, return_probabilities=True)
                
            else:
                logger.error(f"Prediction not supported for classifier type: {args.model_type}")
                sys.exit(1)
            
            # Print result
            print(json.dumps(result, indent=2))
            
            # Save result if output is provided
            if args.output:
                output_file = os.path.join(args.output, "prediction_result.json")
                os.makedirs(os.path.dirname(output_file), exist_ok=True)
                with open(output_file, 'w') as f:
                    json.dump(result, f, indent=2)
                
                logger.info(f"Prediction result saved to: {output_file}")
            
        elif args.action == "export":
            # Check if output directory is provided
            if not args.output:
                logger.error("Output directory not provided")
                sys.exit(1)
            
            # Save classifier
            if isinstance(classifier, MaterialClassifier):
                success = classifier.save_model(args.output)
                
            elif isinstance(classifier, HierarchicalMaterialClassifier):
                success = classifier.save(args.output)
                
            elif isinstance(classifier, EnsembleMaterialClassifier):
                success = classifier.save(args.output)
                
            else:
                logger.error(f"Export not supported for classifier type: {args.model_type}")
                sys.exit(1)
            
            if success:
                logger.info(f"Model exported to: {args.output}")
            else:
                logger.error("Failed to export model")
                sys.exit(1)
        
    except Exception as e:
        logger.error(f"Error: {e}")
        sys.exit(1)