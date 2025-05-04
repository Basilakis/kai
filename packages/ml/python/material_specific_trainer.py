#!/usr/bin/env python
"""
Material-Specific Trainer

This script trains models for specific material types using metadata fields
defined for that material type.
"""

import os
import sys
import json
import time
import argparse
import logging
from typing import Dict, Any, List, Optional, Tuple
import uuid

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('material-specific-trainer')

# Try to import ML libraries
try:
    import numpy as np
    import tensorflow as tf
    TF_AVAILABLE = True
except ImportError:
    logger.warning("TensorFlow not available. ML-based training will be disabled.")
    TF_AVAILABLE = False

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import DataLoader, Dataset
    import torchvision.transforms as transforms
    TORCH_AVAILABLE = True
except ImportError:
    logger.warning("PyTorch not available. PyTorch-based training will be disabled.")
    TORCH_AVAILABLE = False

# Material categories
MATERIAL_CATEGORIES = ['tile', 'wood', 'lighting', 'furniture', 'decoration', 'other']

# Texture-focused materials (materials where texture is a key feature)
TEXTURE_FOCUSED_MATERIALS = ['tile', 'wood', 'stone', 'fabric', 'carpet']

# Color-focused materials (materials where color is a key feature)
COLOR_FOCUSED_MATERIALS = ['paint', 'fabric', 'tile']

# Shape-focused materials (materials where shape is a key feature)
SHAPE_FOCUSED_MATERIALS = ['furniture', 'lighting', 'decoration']


class MaterialDataset:
    """Dataset for material recognition training"""
    
    def __init__(self, data_dir: str, material_type: Optional[str] = None):
        """
        Initialize the dataset
        
        Args:
            data_dir: Directory containing training data
            material_type: Optional material type to filter by
        """
        self.data_dir = data_dir
        self.material_type = material_type
        self.image_paths = []
        self.labels = []
        self.material_ids = []
        self.class_to_idx = {}
        
        # Load dataset
        self._load_dataset()
    
    def _load_dataset(self):
        """Load dataset from directory"""
        logger.info(f"Loading dataset from {self.data_dir}")
        
        # Get all subdirectories (each represents a material)
        material_dirs = [d for d in os.listdir(self.data_dir) 
                        if os.path.isdir(os.path.join(self.data_dir, d))]
        
        # Filter by material type if specified
        if self.material_type:
            # Look for metadata.json files to determine material type
            material_dirs = [d for d in material_dirs if self._is_matching_material_type(d)]
        
        logger.info(f"Found {len(material_dirs)} materials")
        
        # Create class index mapping
        self.material_ids = sorted(material_dirs)
        self.class_to_idx = {material_id: idx for idx, material_id in enumerate(self.material_ids)}
        
        # Load images for each material
        for material_id in self.material_ids:
            material_dir = os.path.join(self.data_dir, material_id)
            
            # Get all image files
            image_files = [f for f in os.listdir(material_dir) 
                          if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
            
            for image_file in image_files:
                image_path = os.path.join(material_dir, image_file)
                self.image_paths.append(image_path)
                self.labels.append(self.class_to_idx[material_id])
        
        logger.info(f"Loaded {len(self.image_paths)} images")
    
    def _is_matching_material_type(self, material_id: str) -> bool:
        """
        Check if a material matches the specified material type
        
        Args:
            material_id: Material ID
            
        Returns:
            True if material matches the material type
        """
        metadata_path = os.path.join(self.data_dir, material_id, 'metadata.json')
        
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                
                # Check if material type matches
                if 'materialType' in metadata:
                    return metadata['materialType'] == self.material_type
            except Exception as e:
                logger.warning(f"Error reading metadata for {material_id}: {e}")
        
        # If no metadata or error, assume it doesn't match
        return False


class MaterialSpecificFactory:
    """Factory for creating material-specific models"""
    
    @staticmethod
    def create_model(material_type: str, input_shape=(224, 224, 3), num_classes=10, **kwargs):
        """
        Create a material-specific model based on material type
        
        Args:
            material_type: Type of material ('fabric', 'wood', 'metal', etc.)
            input_shape: Input image shape
            num_classes: Number of output classes
            **kwargs: Additional model-specific parameters
            
        Returns:
            Material-specific TensorFlow model
        """
        material_type = material_type.lower()
        
        # Texture-focused materials
        if material_type in TEXTURE_FOCUSED_MATERIALS:
            logger.info(f"Creating texture-focused model for {material_type}")
            return TextureFocusedModel(
                input_shape=input_shape,
                num_classes=num_classes,
                **kwargs
            )
        
        # Color-focused materials
        elif material_type in COLOR_FOCUSED_MATERIALS:
            logger.info(f"Creating color-focused model for {material_type}")
            return ColorFocusedModel(
                input_shape=input_shape,
                num_classes=num_classes,
                **kwargs
            )
        
        # Shape-focused materials
        elif material_type in SHAPE_FOCUSED_MATERIALS:
            logger.info(f"Creating shape-focused model for {material_type}")
            return ShapeFocusedModel(
                input_shape=input_shape,
                num_classes=num_classes,
                **kwargs
            )
        
        # Default model for other materials
        else:
            logger.info(f"Creating default model for {material_type}")
            return DefaultModel(
                input_shape=input_shape,
                num_classes=num_classes,
                **kwargs
            )


class FeatureBasedTrainer:
    """Trainer for feature-based material recognition"""
    
    def __init__(self, dataset: MaterialDataset, progress_reporter=None, **kwargs):
        """
        Initialize the feature-based trainer
        
        Args:
            dataset: Dataset for training
            progress_reporter: Optional progress reporter
            **kwargs: Additional parameters
        """
        self.dataset = dataset
        self.progress_reporter = progress_reporter
        self.job_id = None
    
    def train(self) -> Dict[str, Any]:
        """
        Train the feature-based model by extracting features from all images
        
        Returns:
            Dictionary with training results
        """
        logger.info("Training feature-based model...")
        start_time = time.time()
        
        # Start a new training job in the progress reporter
        self.job_id = str(uuid.uuid4())
        model_type = "feature-based"
        metadata = {
            "dataset_size": len(self.dataset.image_paths),
            "num_classes": len(self.dataset.material_ids),
            "material_ids": self.dataset.material_ids,
            "material_type": self.dataset.material_type
        }
        
        try:
            # Report training start
            if self.progress_reporter:
                self.progress_reporter.start_job(model_type, self.job_id, metadata)
            
            # Initialize material descriptors
            material_descriptors = {material_id: [] for material_id in self.dataset.material_ids}
            
            # Process each image
            for i, (image_path, label) in enumerate(zip(self.dataset.image_paths, self.dataset.labels)):
                # Extract features from image
                features = self._extract_features(image_path)
                
                # Add features to material descriptor
                material_id = self.dataset.material_ids[label]
                material_descriptors[material_id].append(features)
                
                # Report progress
                if self.progress_reporter and i % 10 == 0:
                    progress = (i + 1) / len(self.dataset.image_paths)
                    self.progress_reporter.update_progress(model_type, self.job_id, progress)
            
            # Compute average descriptor for each material
            model_data = {}
            for material_id, descriptors in material_descriptors.items():
                if descriptors:
                    # Compute average descriptor
                    avg_descriptor = np.mean(descriptors, axis=0)
                    model_data[material_id] = avg_descriptor.tolist()
            
            # Compute training time
            training_time = time.time() - start_time
            
            # Report training completion
            if self.progress_reporter:
                self.progress_reporter.complete_job(model_type, self.job_id, {
                    "training_time": training_time,
                    "model_size": len(model_data)
                })
            
            return {
                "model_data": model_data,
                "training_time": training_time,
                "accuracy": 1.0,  # Feature-based models don't have traditional accuracy
                "loss": 0.0
            }
        
        except Exception as e:
            logger.error(f"Error in feature-based training: {e}")
            
            # Report training failure
            if self.progress_reporter:
                self.progress_reporter.fail_job(model_type, self.job_id, str(e))
            
            raise
    
    def _extract_features(self, image_path: str) -> np.ndarray:
        """
        Extract features from an image
        
        Args:
            image_path: Path to image file
            
        Returns:
            Feature vector
        """
        # This is a placeholder for actual feature extraction
        # In a real implementation, this would use computer vision techniques
        # to extract meaningful features from the image
        
        # For now, return a random feature vector
        return np.random.rand(128)
    
    def save_model(self, output_dir: str) -> str:
        """
        Save the trained model
        
        Args:
            output_dir: Directory to save the model
            
        Returns:
            Path to saved model
        """
        # Train the model if not already trained
        if not hasattr(self, 'model_data'):
            result = self.train()
            self.model_data = result['model_data']
        
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        
        # Save model data
        model_path = os.path.join(output_dir, 'feature_model.json')
        with open(model_path, 'w') as f:
            json.dump(self.model_data, f, indent=2)
        
        return model_path


class HybridTrainer:
    """Trainer for hybrid material recognition (feature-based + ML-based)"""
    
    def __init__(self, dataset: MaterialDataset, epochs: int = 10, batch_size: int = 32,
                 learning_rate: float = 0.001, progress_reporter=None, **kwargs):
        """
        Initialize the hybrid trainer
        
        Args:
            dataset: Dataset for training
            epochs: Number of training epochs
            batch_size: Batch size for training
            learning_rate: Learning rate for training
            progress_reporter: Optional progress reporter
            **kwargs: Additional parameters
        """
        self.dataset = dataset
        self.epochs = epochs
        self.batch_size = batch_size
        self.learning_rate = learning_rate
        self.progress_reporter = progress_reporter
        self.job_id = None
        
        # Initialize feature-based trainer
        self.feature_trainer = FeatureBasedTrainer(
            dataset, 
            progress_reporter=progress_reporter,
            **kwargs
        )
        
        # Initialize ML-based trainer if available
        if TF_AVAILABLE:
            self.ml_trainer = None  # Placeholder for TensorFlow trainer
        elif TORCH_AVAILABLE:
            self.ml_trainer = None  # Placeholder for PyTorch trainer
        else:
            self.ml_trainer = None
            logger.warning("No ML framework available. Hybrid training will only use feature-based approach.")
    
    def train(self) -> Dict[str, Any]:
        """
        Train both feature-based and ML-based models
        
        Returns:
            Dictionary with training results
        """
        logger.info("Training hybrid model...")
        start_time = time.time()
        
        # Start a new training job in the progress reporter
        self.job_id = str(uuid.uuid4())
        model_type = "hybrid"
        metadata = {
            "dataset_size": len(self.dataset.image_paths),
            "num_classes": len(self.dataset.material_ids),
            "material_ids": self.dataset.material_ids,
            "material_type": self.dataset.material_type,
            "epochs": self.epochs,
            "batch_size": self.batch_size,
            "learning_rate": self.learning_rate
        }
        
        try:
            # Report training start
            if self.progress_reporter:
                self.progress_reporter.start_job(model_type, self.job_id, metadata)
            
            # Train feature-based model
            feature_result = self.feature_trainer.train()
            
            # Train ML-based model if available
            ml_result = None
            if self.ml_trainer:
                ml_result = self.ml_trainer.train()
            
            # Compute training time
            training_time = time.time() - start_time
            
            # Compute combined accuracy and loss
            if ml_result:
                accuracy = (feature_result['accuracy'] + ml_result['accuracy']) / 2
                loss = ml_result['loss']  # Use ML loss
            else:
                accuracy = feature_result['accuracy']
                loss = 0.0
            
            # Report training completion
            if self.progress_reporter:
                self.progress_reporter.complete_job(model_type, self.job_id, {
                    "training_time": training_time,
                    "accuracy": accuracy,
                    "loss": loss
                })
            
            return {
                "feature_result": feature_result,
                "ml_result": ml_result,
                "training_time": training_time,
                "accuracy": accuracy,
                "loss": loss
            }
        
        except Exception as e:
            logger.error(f"Error in hybrid training: {e}")
            
            # Report training failure
            if self.progress_reporter:
                self.progress_reporter.fail_job(model_type, self.job_id, str(e))
            
            raise
    
    def save_model(self, output_dir: str) -> Dict[str, str]:
        """
        Save the trained models
        
        Args:
            output_dir: Directory to save the models
            
        Returns:
            Dictionary with paths to saved models
        """
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        
        # Save feature-based model
        feature_model_path = self.feature_trainer.save_model(output_dir)
        
        # Save ML-based model if available
        ml_model_path = None
        if self.ml_trainer:
            ml_model_path = self.ml_trainer.save_model(output_dir)
        
        # Save metadata
        metadata = {
            "model_type": "hybrid",
            "feature_model_path": feature_model_path,
            "ml_model_path": ml_model_path,
            "materials": {
                material_id: {"index": idx}
                for material_id, idx in self.dataset.class_to_idx.items()
            },
            "material_type": self.dataset.material_type
        }
        
        metadata_path = os.path.join(output_dir, 'material_metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return {
            "feature_model": feature_model_path,
            "ml_model": ml_model_path,
            "metadata": metadata_path
        }


class HybridProgressReporter:
    """Progress reporter for hybrid training"""
    
    def __init__(self):
        """Initialize the progress reporter"""
        self.jobs = {}
    
    def start_job(self, model_type: str, job_id: str, metadata: Dict[str, Any]):
        """
        Start a new training job
        
        Args:
            model_type: Type of model being trained
            job_id: Unique job ID
            metadata: Job metadata
        """
        self.jobs[job_id] = {
            "model_type": model_type,
            "status": "running",
            "progress": 0.0,
            "metadata": metadata,
            "start_time": time.time()
        }
        
        logger.info(f"Started {model_type} training job {job_id}")
    
    def update_progress(self, model_type: str, job_id: str, progress: float):
        """
        Update job progress
        
        Args:
            model_type: Type of model being trained
            job_id: Unique job ID
            progress: Progress value (0.0 to 1.0)
        """
        if job_id in self.jobs:
            self.jobs[job_id]["progress"] = progress
            
            # Log progress every 10%
            if int(progress * 10) > int(self.jobs[job_id].get("last_logged_progress", 0) * 10):
                logger.info(f"{model_type} training progress: {progress:.1%}")
                self.jobs[job_id]["last_logged_progress"] = progress
    
    def complete_job(self, model_type: str, job_id: str, result: Dict[str, Any]):
        """
        Complete a training job
        
        Args:
            model_type: Type of model being trained
            job_id: Unique job ID
            result: Training result
        """
        if job_id in self.jobs:
            self.jobs[job_id]["status"] = "completed"
            self.jobs[job_id]["progress"] = 1.0
            self.jobs[job_id]["result"] = result
            self.jobs[job_id]["end_time"] = time.time()
            
            duration = self.jobs[job_id]["end_time"] - self.jobs[job_id]["start_time"]
            logger.info(f"Completed {model_type} training job {job_id} in {duration:.2f}s")
    
    def fail_job(self, model_type: str, job_id: str, error: str):
        """
        Mark a training job as failed
        
        Args:
            model_type: Type of model being trained
            job_id: Unique job ID
            error: Error message
        """
        if job_id in self.jobs:
            self.jobs[job_id]["status"] = "failed"
            self.jobs[job_id]["error"] = error
            self.jobs[job_id]["end_time"] = time.time()
            
            duration = self.jobs[job_id]["end_time"] - self.jobs[job_id]["start_time"]
            logger.error(f"Failed {model_type} training job {job_id} after {duration:.2f}s: {error}")


def main():
    """Main function to parse arguments and run the training"""
    parser = argparse.ArgumentParser(description="Train material-specific recognition models")
    parser.add_argument("training_data_dir", help="Directory containing training data")
    parser.add_argument("output_dir", help="Directory to save trained models")
    parser.add_argument("--material-type", required=True, help="Material type to train for")
    parser.add_argument("--model-type", choices=["hybrid", "feature-based", "ml-based"], 
                        default="hybrid", help="Type of model to train")
    parser.add_argument("--epochs", type=int, default=10,
                        help="Number of epochs for ML training")
    parser.add_argument("--batch-size", type=int, default=32,
                        help="Batch size for ML training")
    parser.add_argument("--learning-rate", type=float, default=0.001,
                        help="Learning rate for ML training")
    parser.add_argument("--config-path", help="Path to training configuration file")
    
    args = parser.parse_args()
    
    try:
        # Create output directory if it doesn't exist
        os.makedirs(args.output_dir, exist_ok=True)
        
        # Load metadata fields from config if provided
        metadata_fields = []
        if args.config_path and os.path.exists(args.config_path):
            try:
                with open(args.config_path, 'r') as f:
                    config = json.load(f)
                    metadata_fields = config.get('fields', [])
                    logger.info(f"Loaded {len(metadata_fields)} metadata fields from config")
            except Exception as e:
                logger.warning(f"Error loading config from {args.config_path}: {e}")
        
        # Load dataset
        dataset = MaterialDataset(args.training_data_dir, material_type=args.material_type)
        
        # Create a progress reporter for real-time updates
        reporter = HybridProgressReporter()
        
        # Train model based on model type
        if args.model_type == "feature-based":
            trainer = FeatureBasedTrainer(
                dataset, 
                progress_reporter=reporter
            )
            result = trainer.train()
            model_path = trainer.save_model(args.output_dir)
            
            # Add metadata fields to result
            result['metadata_fields'] = metadata_fields
            result['model_path'] = model_path
            
        elif args.model_type == "hybrid":
            trainer = HybridTrainer(
                dataset,
                epochs=args.epochs,
                batch_size=args.batch_size,
                learning_rate=args.learning_rate,
                progress_reporter=reporter
            )
            result = trainer.train()
            model_paths = trainer.save_model(args.output_dir)
            
            # Add metadata fields to result
            result['metadata_fields'] = metadata_fields
            result['model_path'] = model_paths.get('metadata')
        
        else:
            # ML-based training not fully implemented yet
            logger.error("ML-based training not implemented")
            sys.exit(1)
        
        # Print result as JSON
        print(json.dumps(result))
        
    except Exception as e:
        logger.error(f"Error in training: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
