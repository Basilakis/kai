#!/usr/bin/env python3
"""
Model Trainer for Material Recognition

This script trains models for material recognition using:
1. Feature-based approach: Extracts SIFT features and stores them for matching
2. ML-based approach: Trains a neural network classifier using TensorFlow or PyTorch
3. Hybrid approach: Combines both methods

Usage:
    python model_trainer.py <training_data_dir> <output_dir> [options]

Arguments:
    training_data_dir          Directory containing training data
    output_dir                 Directory to save trained models
    
Options:
    --model-type               Type of model to train (hybrid, feature-based, ml-based)
    --epochs                   Number of epochs for ML training
    --batch-size               Batch size for ML training
    --learning-rate            Learning rate for ML training
    --enable-dynamic-params    Enable dynamic parameter adjustment during training
    --parameter-storage        Storage type for parameters (file or supabase)
    --supabase-url             Supabase URL (required if parameter-storage is supabase)
    --supabase-key             Supabase API key (required if parameter-storage is supabase)
    --store-models-in-supabase Store trained models in Supabase Storage
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
import glob
import shutil
from pathlib import Path

# Import progress reporter and parameter manager
from progress_reporter import HybridProgressReporter, progress_reporter
from parameter_manager import create_parameter_manager
from advanced_losses import get_loss_function # Import the loss factory
from vit_models import create_vit_classifier, create_hybrid_cnn_transformer # Import ViT models

# Conditionally import TensorFlow or PyTorch based on availability
try:
    import tensorflow as tf
    from tensorflow.keras import layers, models, applications, optimizers
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import Dataset, DataLoader
    import torchvision
    from torchvision import transforms
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

# Check if at least one ML framework is available
if not TF_AVAILABLE and not TORCH_AVAILABLE:
    print("Warning: Neither TensorFlow nor PyTorch is available. ML-based training will be disabled.")


class MaterialDataset:
    """Dataset class for material images"""
    
    def __init__(self, data_dir: str):
        """
        Initialize the dataset
        
        Args:
            data_dir: Directory containing material images organized by material ID
        """
        self.data_dir = data_dir
        self.material_dirs = self._get_material_dirs()
        self.material_ids = [os.path.basename(d) for d in self.material_dirs]
        self.class_to_idx = {material_id: i for i, material_id in enumerate(self.material_ids)}
        self.idx_to_class = {i: material_id for i, material_id in enumerate(self.material_ids)}
        self.image_paths = self._get_image_paths()
        
        print(f"Found {len(self.material_ids)} material classes")
        print(f"Found {len(self.image_paths)} total images")
    
    def _get_material_dirs(self) -> List[str]:
        """Get directories for each material class"""
        return [os.path.join(self.data_dir, d) for d in os.listdir(self.data_dir) 
                if os.path.isdir(os.path.join(self.data_dir, d))]
    
    def _get_image_paths(self) -> List[Tuple[str, int]]:
        """Get all image paths with their class indices"""
        image_paths = []
        for material_dir in self.material_dirs:
            material_id = os.path.basename(material_dir)
            class_idx = self.class_to_idx[material_id]
            
            # Get all image files in the material directory
            for ext in ['jpg', 'jpeg', 'png', 'webp']:
                image_files = glob.glob(os.path.join(material_dir, f"*.{ext}"))
                for image_file in image_files:
                    image_paths.append((image_file, class_idx))
        
        return image_paths
    
    def get_metadata(self) -> Dict[str, Any]:
        """Get dataset metadata"""
        return {
            "material_ids": self.material_ids,
            "class_to_idx": self.class_to_idx,
            "idx_to_class": self.idx_to_class,
            "num_classes": len(self.material_ids),
            "num_images": len(self.image_paths)
        }


class FeatureExtractor:
    """Feature extractor for materials using SIFT"""
    
    def __init__(self):
        """Initialize the feature extractor"""
        self.feature_detector = cv2.SIFT_create()
    
    def extract_features(self, image_path: str) -> Tuple[List[cv2.KeyPoint], np.ndarray]:
        """
        Extract SIFT features from an image
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Tuple of (keypoints, descriptors)
        """
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Failed to load image: {image_path}")
        
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Detect keypoints and compute descriptors
        keypoints, descriptors = self.feature_detector.detectAndCompute(gray, None)
        
        return keypoints, descriptors


class FeatureBasedTrainer:
    """Trainer for feature-based material recognition"""
    
    def __init__(self, dataset: MaterialDataset, progress_reporter=None,
                store_models_in_supabase: bool = False, supabase_url: str = None, 
                supabase_key: str = None):
        """
        Initialize the feature-based trainer
        
        Args:
            dataset: Material dataset
            progress_reporter: Optional progress reporter for real-time updates
            store_models_in_supabase: Whether to store models in Supabase Storage
            supabase_url: Supabase URL (required if store_models_in_supabase is True)
            supabase_key: Supabase API key (required if store_models_in_supabase is True)
        """
        self.dataset = dataset
        self.feature_extractor = FeatureExtractor()
        self.material_descriptors = {}
        self.progress_reporter = progress_reporter
        self.job_id = None
        self.store_models_in_supabase = store_models_in_supabase
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.supabase_client = None
        
        # Initialize Supabase client if models are to be stored in Supabase
        if store_models_in_supabase and supabase_url and supabase_key:
            try:
                from supabase import create_client
                self.supabase_client = create_client(supabase_url, supabase_key)
                print(f"Supabase client initialized for model storage")
            except ImportError:
                print("Warning: supabase-py not installed. Models will be stored locally.")
                print("Install with: pip install supabase")
            except Exception as e:
                print(f"Error initializing Supabase client: {e}")
    
    def train(self) -> Dict[str, Any]:
        """
        Train the feature-based model by extracting features from all images
        
        Returns:
            Dictionary with training results
        """
        print("Training feature-based model...")
        start_time = time.time()
        
        # Start a new training job in the progress reporter
        self.job_id = str(uuid.uuid4())
        model_type = "feature-based"
        metadata = {
            "dataset_size": len(self.dataset.image_paths),
            "num_classes": len(self.dataset.material_ids),
            "material_ids": self.dataset.material_ids
        }
        
        try:
            # Report training start
            if self.progress_reporter:
                self.progress_reporter.start_job(model_type, self.job_id, metadata)
            
            # Initialize material descriptors
            material_descriptors = {material_id: [] for material_id in self.dataset.material_ids}
            
            # Extract features from all images
            total_images = len(self.dataset.image_paths)
            for i, (image_path, class_idx) in enumerate(self.dataset.image_paths):
                material_id = self.dataset.idx_to_class[class_idx]
                
                try:
                    # Extract features
                    keypoints, descriptors = self.feature_extractor.extract_features(image_path)
                    
                    if descriptors is not None and len(descriptors) > 0:
                        material_descriptors[material_id].append(descriptors)
                    
                    # Report progress every 10 images or when processing is complete
                    if i % 10 == 0 or i == total_images - 1:
                        progress = (i + 1) / total_images * 100
                        if self.progress_reporter:
                            self.progress_reporter.report_progress(
                                self.job_id,
                                progress=progress,
                                message=f"Processed {i+1}/{total_images} images",
                                current_material=material_id
                            )
                except Exception as e:
                    print(f"Error extracting features from {image_path}: {e}")
                    if self.progress_reporter:
                        self.progress_reporter.report_error(
                            self.job_id, 
                            f"Error extracting features from {os.path.basename(image_path)}: {str(e)}"
                        )
            
            # Combine descriptors for each material
            combined_descriptors = {}
            for material_id, descriptors_list in material_descriptors.items():
                if descriptors_list:
                    combined_descriptors[material_id] = np.vstack(descriptors_list)
                else:
                    print(f"Warning: No valid descriptors for material {material_id}")
                    combined_descriptors[material_id] = np.array([])
            
            self.material_descriptors = combined_descriptors
            
            # Calculate training time
            training_time = time.time() - start_time
            
            # Report completion
            result = {
                "model_type": "feature-based",
                "num_materials": len(self.material_descriptors),
                "descriptors_shape": {material_id: descriptors.shape if descriptors.size > 0 else (0, 0) 
                                    for material_id, descriptors in self.material_descriptors.items()},
                "training_time": training_time
            }
            
            if self.progress_reporter:
                self.progress_reporter.complete_job(self.job_id, result)
            return result
            
        except Exception as e:
            if self.progress_reporter:
                self.progress_reporter.report_error(self.job_id, str(e))
            raise
        
    
    def save_model(self, output_dir: str) -> str:
        """
        Save the feature-based model
        
        Args:
            output_dir: Directory to save the model
            
        Returns:
            Path to the saved model
        """
        os.makedirs(output_dir, exist_ok=True)
        
        # Prepare data for saving
        material_ids = list(self.material_descriptors.keys())
        descriptors = [self.material_descriptors[material_id] for material_id in material_ids]
        
        # Save descriptors locally
        model_path = os.path.join(output_dir, 'feature_descriptors.npz')
        np.savez_compressed(
            model_path,
            material_ids=material_ids,
            descriptors=descriptors
        )
        
        # Save to Supabase if enabled
        if self.store_models_in_supabase and self.supabase_client:
            try:
                # Upload model file to Supabase storage
                with open(model_path, 'rb') as f:
                    model_data = f.read()
                
                # Create storage path
                storage_path = f"models/{self.job_id}/feature_descriptors.npz"
                
                # Upload to Supabase Storage
                self.supabase_client.storage.from_('ml-models').upload(
                    storage_path,
                    model_data,
                    {'content-type': 'application/octet-stream'}
                )
                
                # Store metadata in 'models' table
                self.supabase_client.table('models').insert({
                    'job_id': self.job_id,
                    'model_type': 'feature-based',
                    'path': storage_path,
                    'filename': 'feature_descriptors.npz',
                    'num_materials': len(material_ids),
                    'created_at': int(time.time() * 1000)
                }).execute()
                
                print(f"Model saved to Supabase storage: {storage_path}")
            except Exception as e:
                print(f"Error saving model to Supabase: {e}")
        
        return model_path


class TensorFlowTrainer:
    """Trainer for TensorFlow-based material recognition"""
    
    def __init__(self, dataset: MaterialDataset, epochs: int = 10, batch_size: int = 32,
                 learning_rate: float = 0.001, progress_reporter=None, enable_dynamic_params: bool = False,
                 parameter_storage: str = 'file', supabase_url: str = None, supabase_key: str = None,
                 store_models_in_supabase: bool = False, loss_function: str = 'crossentropy',
                 focal_gamma: float = 2.0, focal_alpha: float = 0.25, use_augmentations: bool = False,
                 architecture: str = 'mobilenet'):
        """
        Initialize the TensorFlow trainer
        
        Args:
            dataset: Material dataset
            epochs: Number of training epochs
            batch_size: Batch size for training
            learning_rate: Learning rate for optimizer
            progress_reporter: Optional progress reporter for real-time updates
            enable_dynamic_params: Whether to enable dynamic parameter adjustment
            parameter_storage: Storage type for parameters ('file' or 'supabase')
            supabase_url: Supabase URL (required if parameter_storage is 'supabase')
            supabase_key: Supabase API key (required if parameter_storage is 'supabase')
            store_models_in_supabase: Whether to store models in Supabase Storage
            loss_function: Name of the loss function ('crossentropy' or 'focal')
            focal_gamma: Gamma parameter for Focal Loss
            focal_alpha: Alpha parameter for Focal Loss
            use_augmentations: Whether to apply data augmentations
            architecture: Model architecture ('mobilenet', 'vit', or 'hybrid-cnn-vit')
        """
        if not TF_AVAILABLE:
            raise ImportError("TensorFlow is not available")
        
        self.dataset = dataset
        self.epochs = epochs
        self.batch_size = batch_size
        self.learning_rate = learning_rate
        self.loss_function_name = loss_function
        self.focal_gamma = focal_gamma
        self.focal_alpha = focal_alpha
        self.use_augmentations = use_augmentations # Store flag
        self.architecture = architecture # Store architecture choice
        self.model = None
        self.train_dataset = None
        self.val_dataset = None
        self.progress_reporter = progress_reporter
        self.job_id = None
        self.enable_dynamic_params = enable_dynamic_params
        self.param_manager = None
        self.parameter_storage = parameter_storage
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.store_models_in_supabase = store_models_in_supabase
        self.supabase_client = None
        
        # Initialize Supabase client if storing models in Supabase
        if store_models_in_supabase and supabase_url and supabase_key:
            try:
                from supabase import create_client
                self.supabase_client = create_client(supabase_url, supabase_key)
                print(f"Supabase client initialized for model storage")
            except ImportError:
                print("Warning: supabase-py not installed. Models will be stored locally.")
                print("Install with: pip install supabase")
            except Exception as e:
                print(f"Error initializing Supabase client: {e}")
    
    def _prepare_data(self) -> Tuple[tf.data.Dataset, tf.data.Dataset]:
        """
        Prepare training and validation datasets
        
        Returns:
            Tuple of (train_dataset, val_dataset)
        """
        # Split data into training and validation sets
        image_paths = self.dataset.image_paths.copy()
        np.random.shuffle(image_paths)
        
        split_idx = int(len(image_paths) * 0.8)  # 80% for training, 20% for validation
        train_paths = image_paths[:split_idx]
        val_paths = image_paths[split_idx:]
        
        # Create TensorFlow datasets
        def load_and_preprocess_image(image_path, label):
            img = tf.io.read_file(image_path)
            img = tf.image.decode_image(img, channels=3, expand_animations=False)
            img = tf.image.resize(img, [224, 224])
            img = tf.cast(img, tf.float32) / 255.0
            img = tf.keras.applications.mobilenet_v2.preprocess_input(img)
            return img, label
        
        train_ds = tf.data.Dataset.from_tensor_slices(
            ([path for path, _ in train_paths], [label for _, label in train_paths])
        )
        train_ds = train_ds.map(load_and_preprocess_image, num_parallel_calls=tf.data.AUTOTUNE)
        train_ds = train_ds.batch(self.batch_size).prefetch(tf.data.AUTOTUNE)
        
        val_ds = tf.data.Dataset.from_tensor_slices(
            ([path for path, _ in val_paths], [label for _, label in val_paths])
        )
        val_ds = val_ds.map(load_and_preprocess_image, num_parallel_calls=tf.data.AUTOTUNE)
        val_ds = val_ds.batch(self.batch_size).prefetch(tf.data.AUTOTUNE)
        
        return train_ds, val_ds
    
    def _create_model(self) -> tf.keras.Model:
        """
        Create a TensorFlow model for material classification
        
        Returns:
            TensorFlow model
        """
        num_classes = len(self.dataset.material_ids)
        
        if self.architecture == 'mobilenet':
            # Use MobileNetV2 as base model
            base_model = applications.MobileNetV2(
                input_shape=(224, 224, 3),
                include_top=False,
                weights='imagenet'
            )
            
            # Freeze the base model
            base_model.trainable = False
            
            # Create the model
            model = models.Sequential([
                base_model,
                layers.GlobalAveragePooling2D(),
                layers.Dense(256, activation='relu'),
                layers.Dropout(0.5),
                layers.Dense(num_classes, activation='softmax')
            ])
        elif self.architecture == 'vit':
            # Use Vision Transformer model
            img_size = 224
            patch_size = 16
            num_patches = (img_size // patch_size) ** 2
            projection_dim = 128
            transformer_layers = 4
            
            model = create_vit_classifier(
                input_shape=(img_size, img_size, 3),
                num_classes=num_classes,
                patch_size=patch_size,
                num_patches=num_patches,
                projection_dim=projection_dim,
                num_heads=8,
                transformer_units=[projection_dim * 2, projection_dim],
                mlp_head_units=[projection_dim * 2, projection_dim],
                transformer_layers=transformer_layers
            )
        elif self.architecture == 'hybrid-cnn-vit':
            # Use Hybrid CNN-Transformer model
            model = create_hybrid_cnn_transformer(
                input_shape=(224, 224, 3),
                num_classes=num_classes,
                cnn_backbone='MobileNetV2',
                projection_dim=128,
                num_heads=8,
                transformer_layers=2,
                mlp_head_units=[256]
            )
        else:
            # Default to MobileNetV2 for unrecognized architecture
            logger.warning(f"Unrecognized architecture '{self.architecture}', defaulting to MobileNetV2")
            base_model = applications.MobileNetV2(
                input_shape=(224, 224, 3),
                include_top=False,
                weights='imagenet'
            )
            
            base_model.trainable = False
            
            model = models.Sequential([
                base_model,
                layers.GlobalAveragePooling2D(),
                layers.Dense(256, activation='relu'),
                layers.Dropout(0.5),
                layers.Dense(num_classes, activation='softmax')
            ])

        # Get the selected loss function
        loss_fn = get_loss_function(
            loss_name=self.loss_function_name,
            framework='tensorflow',
            gamma=self.focal_gamma,
            alpha=self.focal_alpha
        )

        # Compile the model
        model.compile(
            optimizer=optimizers.Adam(learning_rate=self.learning_rate), # AdamW might be better
            loss=loss_fn, # Use selected loss function
            metrics=['accuracy']
        )
        
        return model
    
    
    def train(self) -> Dict[str, Any]:
        """
        Train the TensorFlow model
        
        Returns:
            Dictionary with training results
        """
        print("Training TensorFlow model...")
        start_time = time.time()
        
        # Start a new training job in the progress reporter
        self.job_id = str(uuid.uuid4())
        model_type = "ml-based-tensorflow"
        metadata = {
            "dataset_size": len(self.dataset.image_paths),
            "num_classes": len(self.dataset.material_ids),
            "material_ids": self.dataset.material_ids,
            "epochs": self.epochs,
            "batch_size": self.batch_size,
            "learning_rate": self.learning_rate,
            "enable_dynamic_params": self.enable_dynamic_params,
            "loss_function": self.loss_function_name,
            "architecture": self.architecture
        }

        try:
            # Report training start
            if self.progress_reporter:
                self.progress_reporter.start_job(model_type, self.job_id, metadata)
            
            # Initialize parameter manager if dynamic parameters are enabled
            if self.enable_dynamic_params:
                self.param_manager = create_parameter_manager(
                    job_id=self.job_id,
                    storage_type=self.parameter_storage,
                    supabase_url=self.supabase_url,
                    supabase_key=self.supabase_key,
                    base_dir='./params'
                )
                self.param_manager.report_current_parameters({
                    "learning_rate": self.learning_rate,
                    "batch_size": self.batch_size,
                    "epochs": self.epochs
                })
                print(f"Dynamic parameter adjustment enabled for job {self.job_id} using {self.parameter_storage} storage")
            
            # Prepare data
            self.train_dataset, self.val_dataset = self._prepare_data()
            
            # Create model
            self.model = self._create_model()
            
            # Create a custom callback for progress reporting and parameter updates
            class ProgressAndParamCallback(tf.keras.callbacks.Callback):
                def __init__(self, trainer):
                    self.trainer = trainer
                    self.total_epochs = trainer.epochs
                    self.optimizer = None
                
                def on_train_begin(self, logs=None):
                    # Store reference to optimizer
                    self.optimizer = self.trainer.model.optimizer
                
                def on_epoch_begin(self, epoch, logs=None):
                    progress = epoch / self.total_epochs * 100
                    if self.trainer.progress_reporter:
                        self.trainer.progress_reporter.report_progress(
                            self.trainer.job_id,
                            progress=progress,
                            message=f"Starting epoch {epoch+1}/{self.total_epochs}",
                            currentEpoch=epoch+1,
                            totalEpochs=self.total_epochs
                        )
                    
                    # Check for parameter updates if dynamic parameters are enabled
                    if self.trainer.enable_dynamic_params and self.trainer.param_manager:
                        if self.trainer.param_manager.has_updates():
                            updates = self.trainer.param_manager.get_updates()
                            print(f"Applying parameter updates: {updates}")
                            
                            # Apply learning rate update if provided
                            if 'learning_rate' in updates and self.optimizer:
                                new_lr = float(updates['learning_rate'])
                                tf.keras.backend.set_value(self.optimizer.lr, new_lr)
                                print(f"Updated learning rate to: {new_lr}")
                                self.trainer.learning_rate = new_lr
                            
                            # Apply other updates as needed
                            if 'batch_size' in updates:
                                print("Note: Batch size cannot be changed during training in TensorFlow")
                            
                            if 'epochs' in updates:
                                new_epochs = int(updates['epochs'])
                                if new_epochs > self.trainer.epochs:
                                    self.trainer.epochs = new_epochs
                                    self.total_epochs = new_epochs
                                    print(f"Extended training to {new_epochs} epochs")
                                else:
                                    print("Note: Cannot reduce epochs during training")
                            
                            # Acknowledge the updates
                            self.trainer.param_manager.acknowledge_updates()
                            
                            # Report the parameter changes
                            if self.trainer.progress_reporter:
                                self.trainer.progress_reporter.report_progress(
                                    self.trainer.job_id,
                                    progress=progress,
                                    message=f"Updated parameters during epoch {epoch+1}",
                                    currentEpoch=epoch+1,
                                    totalEpochs=self.total_epochs,
                                    parameter_updates=updates
                                )
                
                def on_epoch_end(self, epoch, logs=None):
                    logs = logs or {}
                    progress = (epoch + 1) / self.total_epochs * 100
                    
                    if self.trainer.progress_reporter:
                        self.trainer.progress_reporter.report_progress(
                            self.trainer.job_id,
                            progress=progress,
                            message=f"Completed epoch {epoch+1}/{self.total_epochs}",
                            currentEpoch=epoch+1,
                            totalEpochs=self.total_epochs,
                            loss=float(logs.get('loss', 0)),
                            accuracy=float(logs.get('accuracy', 0)),
                            val_loss=float(logs.get('val_loss', 0)),
                            val_accuracy=float(logs.get('val_accuracy', 0)),
                            current_learning_rate=float(tf.keras.backend.get_value(self.optimizer.lr))
                        )
            
            # Train model with progress reporting and parameter updates
            history = self.model.fit(
                self.train_dataset,
                epochs=self.epochs,
                validation_data=self.val_dataset,
                verbose=1,
                callbacks=[ProgressAndParamCallback(self)]
            )
            
            # Calculate training time
            training_time = time.time() - start_time
            
            # Get final metrics
            final_loss = history.history['loss'][-1]
            final_accuracy = history.history['accuracy'][-1]
            val_loss = history.history['val_loss'][-1]
            val_accuracy = history.history['val_accuracy'][-1]
            
            # Calculate per-class metrics on validation set
            per_class_metrics = self._calculate_per_class_metrics(self.model, self.val_dataset, len(self.dataset.material_ids))
            
            # Report completion
            final_metrics = {
                "loss": float(final_loss),
                "accuracy": float(final_accuracy),
                "val_loss": float(val_loss),
                "val_accuracy": float(val_accuracy),
                "training_time": training_time,
                "per_class_metrics": per_class_metrics
            }
            
            if self.progress_reporter:
                self.progress_reporter.complete_job(self.job_id, final_metrics)
            
            return {
                "model_type": "ml-based-tensorflow",
                "num_classes": len(self.dataset.material_ids),
                "epochs": self.epochs,
                "batch_size": self.batch_size,
                "learning_rate": self.learning_rate,
                "training_time": training_time,
                "loss_function": self.loss_function_name,
                "architecture": self.architecture,
                "final_loss": float(final_loss),
                "final_accuracy": float(final_accuracy),
                "val_loss": float(val_loss),
                "val_accuracy": float(val_accuracy),
                "per_class_metrics": per_class_metrics
            }
            
        except Exception as e:
            if self.progress_reporter:
                self.progress_reporter.report_error(self.job_id, str(e))
            raise
    
    def save_model(self, output_dir: str) -> str:
        """
        Save the TensorFlow model
        
        Args:
            output_dir: Directory to save the model
            
        Returns:
            Path to the saved model
        """
        if self.model is None:
            raise ValueError("Model has not been trained yet")
        
        # Save the model locally
        model_path = os.path.join(output_dir, 'material_classifier_tf')
        self.model.save(model_path)
        
        # Save to Supabase if enabled
        if self.store_models_in_supabase and self.supabase_client:
            try:
                # Create a zip file of the model directory
                zip_path = f"{model_path}.zip"
                shutil.make_archive(model_path, 'zip', model_path)
                
                # Upload model zip to Supabase storage
                with open(zip_path, 'rb') as f:
                    model_data = f.read()
                
                # Create storage path
                storage_path = f"models/{self.job_id}/material_classifier_tf.zip"
                
                # Upload to Supabase Storage
                self.supabase_client.storage.from_('ml-models').upload(
                    storage_path,
                    model_data,
                    {'content-type': 'application/zip'}
                )
                
                # Store metadata in 'models' table
                self.supabase_client.table('models').insert({
                    'job_id': self.job_id,
                    'model_type': 'tensorflow',
                    'path': storage_path,
                    'filename': 'material_classifier_tf.zip',
                    'num_classes': len(self.dataset.material_ids),
                    'created_at': int(time.time() * 1000)
                }).execute()
                
                print(f"Model saved to Supabase storage: {storage_path}")
                
                # Clean up the zip file
                os.remove(zip_path)
            except Exception as e:
                print(f"Error saving model to Supabase: {e}")
        
        return model_path
    def _calculate_per_class_metrics(self, model, val_dataset, num_classes):
        """
        Calculate precision, recall, F1 score per class and confusion matrix.
        
        Args:
            model: The trained model
            val_dataset: Validation dataset
            num_classes: Number of classes
            
        Returns:
            Dictionary with per-class metrics
        """
        # Initialize counters for true positives, false positives, false negatives
        tp = np.zeros(num_classes)
        fp = np.zeros(num_classes)
        fn = np.zeros(num_classes)
        
        # Initialize confusion matrix
        confusion_matrix = np.zeros((num_classes, num_classes), dtype=np.int32)
        
        # Process validation dataset
        y_true_all = []
        y_pred_all = []
        
        for images, labels in val_dataset:
            predictions = model.predict(images, verbose=0)
            pred_classes = np.argmax(predictions, axis=1)
            
            # Collect for overall metrics
            y_true_all.extend(labels.numpy())
            y_pred_all.extend(pred_classes)
            
            # Update per-class metrics
            for i in range(len(labels)):
                true_class = labels[i]
                pred_class = pred_classes[i]
                
                # Update confusion matrix
                confusion_matrix[true_class][pred_class] += 1
                
                # Update counters
                if true_class == pred_class:
                    tp[true_class] += 1
                else:
                    fp[pred_class] += 1
                    fn[true_class] += 1
        
        # Calculate precision, recall, F1 score per class
        precision = np.zeros(num_classes)
        recall = np.zeros(num_classes)
        f1_score = np.zeros(num_classes)
        
        for i in range(num_classes):
            precision[i] = tp[i] / (tp[i] + fp[i]) if (tp[i] + fp[i]) > 0 else 0
            recall[i] = tp[i] / (tp[i] + fn[i]) if (tp[i] + fn[i]) > 0 else 0
            f1_score[i] = 2 * precision[i] * recall[i] / (precision[i] + recall[i]) if (precision[i] + recall[i]) > 0 else 0
        
        # Create mapping from class index to material ID
        class_to_material = {idx: material_id for material_id, idx in self.dataset.class_to_idx.items()}
        
        # Format results
        per_class_metrics = {}
        for i in range(num_classes):
            material_id = class_to_material.get(i, f"class_{i}")
            per_class_metrics[material_id] = {
                "precision": float(precision[i]),
                "recall": float(recall[i]),
                "f1_score": float(f1_score[i]),
                "support": int(tp[i] + fn[i])
            }
        
        # Add error patterns analysis
        error_patterns = self._analyze_error_patterns(confusion_matrix, class_to_material, num_classes)
        
        # Add overall metrics
        overall_metrics = {
            "macro_precision": float(np.mean(precision)),
            "macro_recall": float(np.mean(recall)),
            "macro_f1": float(np.mean(f1_score)),
            "confusion_matrix": confusion_matrix.tolist(),
            "error_patterns": error_patterns
        }
        
        return {
            "per_class": per_class_metrics,
            "overall": overall_metrics
        }
    
    def _analyze_error_patterns(self, confusion_matrix, class_to_material, num_classes):
        """
        Analyze confusion matrix to identify error patterns.
        
        Args:
            confusion_matrix: Confusion matrix
            class_to_material: Mapping from class index to material ID
            num_classes: Number of classes
            
        Returns:
            Dictionary with error patterns
        """
        error_patterns = []
        
        # Find top confused pairs
        for i in range(num_classes):
            for j in range(num_classes):
                if i == j:
                    continue  # Skip correct classifications
                    
                if confusion_matrix[i][j] > 0:
                    true_material = class_to_material.get(i, f"class_{i}")
                    pred_material = class_to_material.get(j, f"class_{j}")
                    
                    error_patterns.append({
                        "true_material": true_material,
                        "predicted_material": pred_material,
                        "count": int(confusion_matrix[i][j]),
                        "error_rate": float(confusion_matrix[i][j] / np.sum(confusion_matrix[i]))
                    })
        
        # Sort by count descending
        error_patterns.sort(key=lambda x: x["count"], reverse=True)
        
        # Return top 10 error patterns
        return error_patterns[:10]

class PyTorchTrainer:
    """Trainer for PyTorch-based material recognition"""
    
    class MaterialDataset(Dataset):
        """PyTorch Dataset for material images"""
        
        def __init__(self, image_paths, transform=None):
            self.image_paths = image_paths
            self.transform = transform
        
        def __len__(self):
            return len(self.image_paths)
        
        def __getitem__(self, idx):
            image_path, label = self.image_paths[idx]
            image = cv2.imread(image_path)
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            if self.transform:
                image = self.transform(image)
            
            return image, label
    
    def __init__(self, dataset: MaterialDataset, epochs: int = 10, batch_size: int = 32,
                 learning_rate: float = 0.001, progress_reporter=None, enable_dynamic_params: bool = False,
                 parameter_storage: str = 'file', supabase_url: str = None, supabase_key: str = None,
                 store_models_in_supabase: bool = False, loss_function: str = 'crossentropy',
                 focal_gamma: float = 2.0, focal_alpha: float = 0.25, architecture: str = 'resnet'):
        """
        Initialize the PyTorch trainer
        
        Args:
            dataset: Material dataset
            epochs: Number of training epochs
            batch_size: Batch size for training
            learning_rate: Learning rate for optimizer
            progress_reporter: Optional progress reporter for real-time updates
            enable_dynamic_params: Whether to enable dynamic parameter adjustment
            parameter_storage: Storage type for parameters ('file' or 'supabase')
            supabase_url: Supabase URL (required if parameter_storage is 'supabase')
            supabase_key: Supabase API key (required if parameter_storage is 'supabase')
            store_models_in_supabase: Whether to store models in Supabase Storage
            loss_function: Name of the loss function ('crossentropy' or 'focal')
            focal_gamma: Gamma parameter for Focal Loss
            focal_alpha: Alpha parameter for Focal Loss
            architecture: Model architecture ('resnet', 'vit', or 'hybrid-cnn-vit')
        """
        if not TORCH_AVAILABLE:
            raise ImportError("PyTorch is not available")
        
        self.dataset = dataset
        self.epochs = epochs
        self.batch_size = batch_size
        self.learning_rate = learning_rate
        self.loss_function_name = loss_function
        self.focal_gamma = focal_gamma
        self.focal_alpha = focal_alpha
        self.architecture = architecture
        self.model = None
        self.train_loader = None
        self.val_loader = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.progress_reporter = progress_reporter
        self.job_id = None
        self.enable_dynamic_params = enable_dynamic_params
        self.param_manager = None
        self.parameter_storage = parameter_storage
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.store_models_in_supabase = store_models_in_supabase
        self.supabase_client = None
        
        # Initialize Supabase client if storing models in Supabase
        if store_models_in_supabase and supabase_url and supabase_key:
            try:
                from supabase import create_client
                self.supabase_client = create_client(supabase_url, supabase_key)
                print(f"Supabase client initialized for model storage")
            except ImportError:
                print("Warning: supabase-py not installed. Models will be stored locally.")
                print("Install with: pip install supabase")
            except Exception as e:
                print(f"Error initializing Supabase client: {e}")
    
    def _prepare_data(self) -> Tuple[DataLoader, DataLoader]:
        """
        Prepare training and validation data loaders
        
        Returns:
            Tuple of (train_loader, val_loader)
        """
        # Define transformations
        transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        # Split data into training and validation sets
        image_paths = self.dataset.image_paths.copy()
        np.random.shuffle(image_paths)
        
        split_idx = int(len(image_paths) * 0.8)  # 80% for training, 20% for validation
        train_paths = image_paths[:split_idx]
        val_paths = image_paths[split_idx:]
        
        # Create datasets
        train_dataset = self.MaterialDataset(train_paths, transform=transform)
        val_dataset = self.MaterialDataset(val_paths, transform=transform)
        
        # Create data loaders
        train_loader = DataLoader(
            train_dataset,
            batch_size=self.batch_size,
            shuffle=True,
            num_workers=4
        )
        
        val_loader = DataLoader(
            val_dataset,
            batch_size=self.batch_size,
            shuffle=False,
            num_workers=4
        )
        
        return train_loader, val_loader
    
    def _create_model(self) -> nn.Module:
        """
        Create a PyTorch model for material classification
        
        Returns:
            PyTorch model
        """
        num_classes = len(self.dataset.material_ids)
        
        # Check if requested architecture is supported
        if self.architecture in ['vit', 'hybrid-cnn-vit']:
            logger.warning(f"Architecture {self.architecture} not fully supported in PyTorch implementation. Using ResNet as fallback.")
        
        # Use ResNet18 as base model
        model = torchvision.models.resnet18(pretrained=True)
        
        # Freeze the base model
        for param in model.parameters():
            param.requires_grad = False
        
        # Replace the final layer
        model.fc = nn.Sequential(
            nn.Linear(model.fc.in_features, 256),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(256, num_classes)
        )
        
        return model.to(self.device)
    
    def train(self) -> Dict[str, Any]:
        """
        Train the PyTorch model
        
        Returns:
            Dictionary with training results
        """
        print("Training PyTorch model...")
        start_time = time.time()
        
        # Start a new training job in the progress reporter
        self.job_id = str(uuid.uuid4())
        model_type = "ml-based-pytorch"
        metadata = {
            "dataset_size": len(self.dataset.image_paths),
            "num_classes": len(self.dataset.material_ids),
            "material_ids": self.dataset.material_ids,
            "epochs": self.epochs,
            "batch_size": self.batch_size,
            "learning_rate": self.learning_rate,
            "enable_dynamic_params": self.enable_dynamic_params,
            "loss_function": self.loss_function_name,
            "architecture": self.architecture
        }

        try:
            # Report training start if progress reporter is available
            if self.progress_reporter:
                self.progress_reporter.start_job(model_type, self.job_id, metadata)
            
            # Initialize parameter manager if dynamic parameters are enabled
            if self.enable_dynamic_params:
                self.param_manager = create_parameter_manager(
                    job_id=self.job_id,
                    storage_type=self.parameter_storage,
                    supabase_url=self.supabase_url,
                    supabase_key=self.supabase_key,
                    base_dir='./params'
                )
                self.param_manager.report_current_parameters({
                    "learning_rate": self.learning_rate,
                    "batch_size": self.batch_size,
                    "epochs": self.epochs
                })
                print(f"Dynamic parameter adjustment enabled for job {self.job_id} using {self.parameter_storage} storage")
            
            # Prepare data
            self.train_loader, self.val_loader = self._prepare_data()
            
            # Create model
            self.model = self._create_model()

            # Define loss function and optimizer
            criterion = get_loss_function(
                loss_name=self.loss_function_name,
                framework='pytorch',
                gamma=self.focal_gamma,
                alpha=self.focal_alpha,
                reduction='mean' # Default reduction for training
            )
            optimizer = optim.Adam(self.model.fc.parameters(), lr=self.learning_rate)

            # Training loop
            best_accuracy = 0.0
            training_losses = []
            training_accuracies = []
            val_losses = []
            val_accuracies = []
            
            # Track current number of epochs (may change with dynamic parameters)
            current_epochs = self.epochs
            
            for epoch in range(current_epochs):
                # Skip if we've already reached or exceeded the desired epochs
                if epoch >= self.epochs:
                    break
                    
                # Report epoch start if progress reporter is available
                if self.progress_reporter:
                    progress = epoch / self.epochs * 100
                    self.progress_reporter.report_progress(
                        self.job_id,
                        progress=progress,
                        message=f"Starting epoch {epoch+1}/{self.epochs}",
                        currentEpoch=epoch+1,
                        totalEpochs=self.epochs
                    )
                
                # Check for parameter updates if dynamic parameters are enabled
                if self.enable_dynamic_params and self.param_manager and self.param_manager.has_updates():
                    updates = self.param_manager.get_updates()
                    print(f"Applying parameter updates: {updates}")
                    
                    # Apply learning rate update if provided
                    if 'learning_rate' in updates:
                        new_lr = float(updates['learning_rate'])
                        for param_group in optimizer.param_groups:
                            param_group['lr'] = new_lr
                        self.learning_rate = new_lr
                        print(f"Updated learning rate to: {new_lr}")
                    
                    # Update batch size if provided (for next epoch)
                    if 'batch_size' in updates:
                        new_batch_size = int(updates['batch_size'])
                        if new_batch_size != self.batch_size:
                            print(f"Note: Batch size will be updated to {new_batch_size} for the next data preparation")
                            self.batch_size = new_batch_size
                    
                    # Update epochs if provided
                    if 'epochs' in updates:
                        new_epochs = int(updates['epochs'])
                        if new_epochs > self.epochs:
                            print(f"Extended training to {new_epochs} epochs")
                            self.epochs = new_epochs
                        else:
                            print("Note: Cannot reduce epochs during training")
                    
                    # Acknowledge the updates
                    self.param_manager.acknowledge_updates()
                    
                    # Report the parameter changes
                    if self.progress_reporter:
                        self.progress_reporter.report_progress(
                            self.job_id,
                            progress=progress,
                            message=f"Updated parameters during epoch {epoch+1}",
                            currentEpoch=epoch+1,
                            totalEpochs=self.epochs,
                            parameter_updates=updates,
                            current_learning_rate=self.learning_rate
                        )
                
                # Training phase
                self.model.train()
                running_loss = 0.0
                correct = 0
                total = 0
                
                for inputs, labels in self.train_loader:
                    inputs, labels = inputs.to(self.device), labels.to(self.device)
                    
                    optimizer.zero_grad()
                    
                    outputs = self.model(inputs)
                    loss = criterion(outputs, labels)
                    loss.backward()
                    optimizer.step()
                    
                    running_loss += loss.item() * inputs.size(0)
                    
                    _, predicted = outputs.max(1)
                    total += labels.size(0)
                    correct += predicted.eq(labels).sum().item()
                
                epoch_loss = running_loss / len(self.train_loader.dataset)
                epoch_accuracy = correct / total
                training_losses.append(epoch_loss)
                training_accuracies.append(epoch_accuracy)
                
                # Validation phase
                self.model.eval()
            val_running_loss = 0.0
            val_correct = 0
            val_total = 0
            
            # For per-class metrics calculation
            all_labels = []
            all_predictions = []
            
            with torch.no_grad():
                for inputs, labels in self.val_loader:
                    inputs, labels = inputs.to(self.device), labels.to(self.device)
                    
                    outputs = self.model(inputs)
                    loss = criterion(outputs, labels)
                    
                    val_running_loss += loss.item() * inputs.size(0)
                    
                    _, predicted = outputs.max(1)
                    val_total += labels.size(0)
                    val_correct += predicted.eq(labels).sum().item()
                    
                    # Collect labels and predictions for metrics
                    all_labels.extend(labels.cpu().numpy())
                    all_predictions.extend(predicted.cpu().numpy())
                
                val_epoch_loss = val_running_loss / len(self.val_loader.dataset)
                val_epoch_accuracy = val_correct / val_total
                val_losses.append(val_epoch_loss)
                val_accuracies.append(val_epoch_accuracy)
                
                print(f"Epoch {epoch+1}/{self.epochs} - "
                      f"Loss: {epoch_loss:.4f}, Accuracy: {epoch_accuracy:.4f}, "
                      f"Val Loss: {val_epoch_loss:.4f}, Val Accuracy: {val_epoch_accuracy:.4f}")
                
                # Save best model
                if val_epoch_accuracy > best_accuracy:
                    best_accuracy = val_epoch_accuracy
                
                # Report epoch results if progress reporter is available
                if self.progress_reporter:
                    self.progress_reporter.report_progress(
                        self.job_id,
                        progress=(epoch + 1) / self.epochs * 100,
                        message=f"Completed epoch {epoch+1}/{self.epochs}",
                        currentEpoch=epoch+1,
                        totalEpochs=self.epochs,
                        loss=float(epoch_loss),
                        accuracy=float(epoch_accuracy),
                        val_loss=float(val_epoch_loss),
                        val_accuracy=float(val_epoch_accuracy)
                    )
            
            # Calculate per-class metrics
            per_class_metrics = self._calculate_per_class_metrics(all_labels, all_predictions)
            
            # Calculate training time
            training_time = time.time() - start_time
            
            # Report completion if progress reporter is available
            if self.progress_reporter:
                final_metrics = {
                    "loss": float(training_losses[-1]),
                    "accuracy": float(training_accuracies[-1]),
                    "val_loss": float(val_losses[-1]),
                    "val_accuracy": float(val_accuracies[-1]),
                    "training_time": training_time,
                    "per_class_metrics": per_class_metrics
                }
                self.progress_reporter.complete_job(self.job_id, final_metrics)
                
            return {
                "model_type": "ml-based-pytorch",
                "num_classes": len(self.dataset.material_ids),
                "epochs": self.epochs,
                "batch_size": self.batch_size,
                "learning_rate": self.learning_rate,
                "loss_function": self.loss_function_name,
                "architecture": self.architecture,
                "training_time": training_time,
                "final_loss": float(training_losses[-1]),
                "final_accuracy": float(training_accuracies[-1]),
                "val_loss": float(val_losses[-1]),
                "val_accuracy": float(val_accuracies[-1]),
                "per_class_metrics": per_class_metrics
            }
            
        except Exception as e:
            # Report error if progress reporter is available
            if self.progress_reporter:
                self.progress_reporter.report_error(self.job_id, str(e))
            raise
    
    def save_model(self, output_dir: str) -> str:
        """
        Save the PyTorch model
        
        Args:
            output_dir: Directory to save the model
            
        Returns:
            Path to the saved model
        """
        if self.model is None:
            raise ValueError("Model has not been trained yet")
        
        os.makedirs(output_dir, exist_ok=True)
        model_path = os.path.join(output_dir, 'material_classifier_torch.pt')
        
        # Save the model locally
        torch.save(self.model, model_path)
        
        # Save to Supabase if enabled
        if self.store_models_in_supabase and self.supabase_client:
            try:
                # Upload model file to Supabase storage
                with open(model_path, 'rb') as f:
                    model_data = f.read()
                
                # Create storage path
                storage_path = f"models/{self.job_id}/material_classifier_torch.pt"
                
                # Upload to Supabase Storage
                self.supabase_client.storage.from_('ml-models').upload(
                    storage_path,
                    model_data,
                    {'content-type': 'application/octet-stream'}
                )
                
                # Store metadata in 'models' table
                self.supabase_client.table('models').insert({
                    'job_id': self.job_id,
                    'model_type': 'pytorch',
                    'path': storage_path,
                    'filename': 'material_classifier_torch.pt',
                    'num_classes': len(self.dataset.material_ids),
                    'created_at': int(time.time() * 1000)
                }).execute()
                
                print(f"Model saved to Supabase storage: {storage_path}")
            except Exception as e:
                print(f"Error saving model to Supabase: {e}")
        
        return model_path
    def _calculate_per_class_metrics(self, all_labels, all_predictions):
        """
        Calculate precision, recall, F1 score per class and confusion matrix.
        
        Args:
            all_labels: List of true labels
            all_predictions: List of predicted labels
            
        Returns:
            Dictionary with per-class metrics
        """
        # Convert lists to numpy arrays
        y_true = np.array(all_labels)
        y_pred = np.array(all_predictions)
        
        num_classes = len(self.dataset.material_ids)
        
        # Initialize confusion matrix
        confusion_matrix = np.zeros((num_classes, num_classes), dtype=np.int32)
        
        # Fill confusion matrix
        for i in range(len(y_true)):
            confusion_matrix[y_true[i]][y_pred[i]] += 1
        
        # Calculate precision, recall, F1 score per class
        per_class_metrics = {}
        
        # Create mapping from class index to material ID
        class_to_material = {idx: material_id for material_id, idx in self.dataset.class_to_idx.items()}
        
        for i in range(num_classes):
            # True positives: diagonal element
            tp = confusion_matrix[i, i]
            
            # False positives: sum of column i excluding TP
            fp = np.sum(confusion_matrix[:, i]) - tp
            
            # False negatives: sum of row i excluding TP
            fn = np.sum(confusion_matrix[i, :]) - tp
            
            # Calculate metrics
            precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
            recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
            f1 = float(2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
            
            material_id = class_to_material.get(i, f"class_{i}")
            per_class_metrics[material_id] = {
                "precision": precision,
                "recall": recall,
                "f1_score": f1,
                "support": int(tp + fn)
            }
        
        # Analyze error patterns
        error_patterns = []
        for i in range(num_classes):
            for j in range(num_classes):
                if i == j:
                    continue  # Skip correct classifications
                
                if confusion_matrix[i, j] > 0:
                    true_material = class_to_material.get(i, f"class_{i}")
                    pred_material = class_to_material.get(j, f"class_{j}")
                    
                    error_patterns.append({
                        "true_material": true_material,
                        "predicted_material": pred_material,
                        "count": int(confusion_matrix[i, j]),
                        "error_rate": float(confusion_matrix[i, j] / np.sum(confusion_matrix[i, :]))
                    })
        
        # Sort by count descending
        error_patterns.sort(key=lambda x: x["count"], reverse=True)
        
        # Calculate overall metrics
        overall_metrics = {
            "macro_precision": float(np.mean([m["precision"] for m in per_class_metrics.values()])),
            "macro_recall": float(np.mean([m["recall"] for m in per_class_metrics.values()])),
            "macro_f1": float(np.mean([m["f1_score"] for m in per_class_metrics.values()])),
            "confusion_matrix": confusion_matrix.tolist(),
            "error_patterns": error_patterns[:10]  # Top 10 error patterns
        }
        
        return {
            "per_class": per_class_metrics,
            "overall": overall_metrics
        }

class HybridTrainer:
    """Trainer for hybrid material recognition (combines feature-based and ML-based)"""
    
    def __init__(self, dataset: MaterialDataset, epochs: int = 10, batch_size: int = 32,
                 learning_rate: float = 0.001, progress_reporter=None, enable_dynamic_params: bool = False,
                 parameter_storage: str = 'file', supabase_url: str = None, supabase_key: str = None,
                 store_models_in_supabase: bool = False, loss_function: str = 'crossentropy',
                 focal_gamma: float = 2.0, focal_alpha: float = 0.25, architecture: str = 'mobilenet'):
        """
        Initialize the hybrid trainer
        
        Args:
            dataset: Material dataset
            epochs: Number of training epochs
            batch_size: Batch size for training
            learning_rate: Learning rate for optimizer
            progress_reporter: Optional progress reporter for real-time updates
            enable_dynamic_params: Whether to enable dynamic parameter adjustment
            parameter_storage: Storage type for parameters ('file' or 'supabase')
            supabase_url: Supabase URL (required if parameter_storage is 'supabase')
            supabase_key: Supabase API key (required if parameter_storage is 'supabase')
            store_models_in_supabase: Whether to store models in Supabase Storage
            loss_function: Name of the loss function ('crossentropy' or 'focal')
            focal_gamma: Gamma parameter for Focal Loss
            focal_alpha: Alpha parameter for Focal Loss
            architecture: Model architecture to use ('mobilenet', 'vit', 'hybrid-cnn-vit')
        """
        self.dataset = dataset
        self.epochs = epochs
        self.batch_size = batch_size
        self.learning_rate = learning_rate
        self.progress_reporter = progress_reporter
        self.enable_dynamic_params = enable_dynamic_params
        self.parameter_storage = parameter_storage
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.loss_function_name = loss_function
        self.focal_gamma = focal_gamma
        self.focal_alpha = focal_alpha
        self.architecture = architecture
        self.store_models_in_supabase = store_models_in_supabase
        self.job_id = None
        
        # Initialize Supabase client if storing models in Supabase
        self.supabase_client = None
        if store_models_in_supabase and supabase_url and supabase_key:
            try:
                from supabase import create_client
                self.supabase_client = create_client(supabase_url, supabase_key)
                print(f"Supabase client initialized for model storage")
            except ImportError:
                print("Warning: supabase-py not installed. Models will be stored locally.")
                print("Install with: pip install supabase")
            except Exception as e:
                print(f"Error initializing Supabase client: {e}")
        
        # Initialize sub-trainers
        self.feature_trainer = FeatureBasedTrainer(
            dataset, 
            progress_reporter=progress_reporter,
            store_models_in_supabase=store_models_in_supabase,
            supabase_url=supabase_url,
            supabase_key=supabase_key
        )
        
        if TF_AVAILABLE:
            self.ml_trainer = TensorFlowTrainer(
                dataset, 
                epochs, 
                batch_size, 
                learning_rate, 
                progress_reporter=progress_reporter,
                enable_dynamic_params=enable_dynamic_params,
                parameter_storage=parameter_storage,
                supabase_url=supabase_url,
                supabase_key=supabase_key,
                store_models_in_supabase=store_models_in_supabase,
                loss_function=loss_function,
                focal_gamma=focal_gamma,
                focal_alpha=focal_alpha,
                architecture=architecture
            )
        elif TORCH_AVAILABLE:
            self.ml_trainer = PyTorchTrainer(
                dataset, 
                epochs, 
                batch_size, 
                learning_rate, 
                progress_reporter=progress_reporter,
                enable_dynamic_params=enable_dynamic_params,
                parameter_storage=parameter_storage,
                supabase_url=supabase_url,
                supabase_key=supabase_key,
                store_models_in_supabase=store_models_in_supabase,
                loss_function=loss_function,
                focal_gamma=focal_gamma,
                focal_alpha=focal_alpha
            )
        else:
            self.ml_trainer = None
            print("Warning: No ML framework available. Hybrid training will only use feature-based approach.")
    
    
    def train(self) -> Dict[str, Any]:
        """
        Train both feature-based and ML-based models
        
        Returns:
            Dictionary with training results
        """
        print("Training hybrid model...")
        start_time = time.time()
        
        # Start a new training job in the progress reporter
        self.job_id = str(uuid.uuid4())
        model_type = "hybrid"
        metadata = {
            "dataset_size": len(self.dataset.image_paths),
            "num_classes": len(self.dataset.material_ids),
            "material_ids": self.dataset.material_ids,
            "epochs": self.epochs,
            "batch_size": self.batch_size,
            "learning_rate": self.learning_rate,
            "enable_dynamic_params": self.enable_dynamic_params,
            "loss_function": self.loss_function_name,
            "architecture": self.architecture
        }

        try:
            # Report training start
            if self.progress_reporter:
                self.progress_reporter.start_job(model_type, self.job_id, metadata)
            
            # Initialize parameter manager if dynamic parameters are enabled
            if self.enable_dynamic_params:
                self.param_manager = create_parameter_manager(
                    job_id=self.job_id,
                    storage_type=self.parameter_storage,
                    supabase_url=self.supabase_url,
                    supabase_key=self.supabase_key,
                    base_dir='./params'
                )
                self.param_manager.report_current_parameters({
                    "learning_rate": self.learning_rate,
                    "batch_size": self.batch_size,
                    "epochs": self.epochs
                })
                print(f"Dynamic parameter adjustment enabled for job {self.job_id} using {self.parameter_storage} storage")
            
            # Train feature-based model (already has progress reporter)
            feature_results = self.feature_trainer.train()
            
            # Report feature-based training completion
            if self.progress_reporter:
                self.progress_reporter.report_progress(self.job_id, progress=50, 
                                                     message="Feature-based training completed", 
                                                     loss=0, accuracy=0)
            
            # Train ML-based model if available
            ml_results = None
            if self.ml_trainer is not None:
                ml_results = self.ml_trainer.train()
            
            # Report training completion
            if self.progress_reporter:
                self.progress_reporter.complete_job(self.job_id, {
                    "feature_results": feature_results,
                    "ml_results": ml_results,
                    "training_time": time.time() - start_time
                })
        except Exception as e:
            # Report error if training fails
            if self.progress_reporter:
                self.progress_reporter.report_error(self.job_id, str(e))
            raise
        
        # Calculate training time
        training_time = time.time() - start_time
        
        return {
            "model_type": "hybrid",
            "feature_results": feature_results,
            "loss_function": self.loss_function_name,
            "ml_results": ml_results,
            "training_time": training_time
        }
    
    def save_model(self, output_dir: str) -> Dict[str, str]:
        """
        Save both feature-based and ML-based models
        
        Args:
            output_dir: Directory to save the models
            
        Returns:
            Dictionary with paths to saved models
        """
        os.makedirs(output_dir, exist_ok=True)
        
        # Save feature-based model
        feature_model_path = self.feature_trainer.save_model(output_dir)
        
        # Add Supabase storage parameters from hybrid trainer to sub-trainers
        if self.store_models_in_supabase and hasattr(self, 'supabase_client') and self.supabase_client:
            self.feature_trainer.store_models_in_supabase = True
            self.feature_trainer.supabase_client = self.supabase_client
            self.feature_trainer.job_id = self.feature_trainer.job_id or str(uuid.uuid4())
        
        # Save ML-based model if available
        ml_model_path = None
        if self.ml_trainer is not None:
            ml_model_path = self.ml_trainer.save_model(output_dir)
        
        # Save metadata
        metadata = {
            "model_type": "hybrid",
            "feature_model_path": feature_model_path,
            "ml_model_path": ml_model_path,
            "materials": {
                material_id: {"index": idx}
                for material_id, idx in self.dataset.class_to_idx.items()
            }
        }
        
        metadata_path = os.path.join(output_dir, 'material_metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        # Save metadata to Supabase if enabled
        if self.store_models_in_supabase and self.supabase_client:
            try:
                # Upload metadata file to Supabase storage
                with open(metadata_path, 'rb') as f:
                    metadata_data = f.read()
                
                # Create storage path
                storage_path = f"models/{self.job_id}/material_metadata.json"
                
                # Upload to Supabase Storage
                self.supabase_client.storage.from_('ml-models').upload(
                    storage_path,
                    metadata_data,
                    {'content-type': 'application/json'}
                )
                
                print(f"Metadata saved to Supabase storage: {storage_path}")
            except Exception as e:
                print(f"Error saving metadata to Supabase: {e}")
        
        return {
            "feature_model_path": feature_model_path,
            "ml_model_path": ml_model_path,
            "metadata_path": metadata_path
        }


def main():
    """Main function to parse arguments and run the training"""
    parser = argparse.ArgumentParser(description="Train material recognition models")
    parser.add_argument("training_data_dir", help="Directory containing training data")
    parser.add_argument("output_dir", help="Directory to save trained models")
    parser.add_argument("--model-type", choices=["hybrid", "feature-based", "ml-based"], 
                        default="hybrid", help="Type of model to train")
    parser.add_argument("--epochs", type=int, default=10,
                        help="Number of epochs for ML training")
    parser.add_argument("--batch-size", type=int, default=32,
                        help="Batch size for ML training")
    parser.add_argument("--learning-rate", type=float, default=0.001,
                        help="Learning rate for ML training")
    parser.add_argument("--loss-function", choices=["crossentropy", "focal"], default="crossentropy",
                        help="Loss function to use for ML training")
    parser.add_argument("--architecture", choices=["mobilenet", "resnet", "vit", "hybrid-cnn-vit"], default="mobilenet",
                        help="ML model architecture to use (default: mobilenet for TF, resnet for PyTorch)")
    parser.add_argument("--focal-gamma", type=float, default=2.0, help="Gamma for Focal Loss")
    parser.add_argument("--focal-alpha", type=float, default=0.25, help="Alpha for Focal Loss")
    parser.add_argument("--enable-dynamic-params", action="store_true",
                        help="Enable dynamic parameter adjustment during training")
    parser.add_argument("--parameter-storage", choices=["file", "supabase"], default="file",
                        help="Storage type for parameter management (file or supabase)")
    parser.add_argument("--supabase-url", 
                        help="Supabase URL (required if parameter-storage is supabase)")
    parser.add_argument("--supabase-key", 
                        help="Supabase API key (required if parameter-storage is supabase)")
    parser.add_argument("--store-models-in-supabase", action="store_true",
                        help="Store trained models in Supabase Storage")
    
    args = parser.parse_args()
    
    try:
        # Validate arguments for Supabase usage
        if args.parameter_storage == 'supabase' and (not args.supabase_url or not args.supabase_key):
            parser.error("--supabase-url and --supabase-key are required when --parameter-storage is 'supabase'")
        
        if args.store_models_in_supabase and (not args.supabase_url or not args.supabase_key):
            parser.error("--supabase-url and --supabase-key are required when --store-models-in-supabase is enabled")
        
        # Check if training data directory exists
        if not os.path.exists(args.training_data_dir):
            raise FileNotFoundError(f"Training data directory not found: {args.training_data_dir}")
        
        # Create output directory if it doesn't exist
        os.makedirs(args.output_dir, exist_ok=True)
        
        # Load dataset
        dataset = MaterialDataset(args.training_data_dir)
        
        # Create a progress reporter for real-time updates
        reporter = HybridProgressReporter()
        
        # Train model based on model type
        if args.model_type == "feature-based":
            trainer = FeatureBasedTrainer(
                dataset, 
                progress_reporter=reporter,
                store_models_in_supabase=args.store_models_in_supabase,
                supabase_url=args.supabase_url,
                supabase_key=args.supabase_key
            )
        elif args.model_type == "ml-based":
            if TF_AVAILABLE:
                trainer = TensorFlowTrainer(
                    dataset, 
                    args.epochs, 
                    args.batch_size, 
                    args.learning_rate, 
                    progress_reporter=reporter,
                    enable_dynamic_params=args.enable_dynamic_params,
                    parameter_storage=args.parameter_storage,
                    supabase_url=args.supabase_url,
                    supabase_key=args.supabase_key,
                    store_models_in_supabase=args.store_models_in_supabase,
                    loss_function=args.loss_function,
                    focal_gamma=args.focal_gamma,
                    focal_alpha=args.focal_alpha,
                    architecture=args.architecture
                )
            elif TORCH_AVAILABLE:
                trainer = PyTorchTrainer(
                    dataset, 
                    args.epochs, 
                    args.batch_size, 
                    args.learning_rate, 
                    progress_reporter=reporter,
                    enable_dynamic_params=args.enable_dynamic_params,
                    parameter_storage=args.parameter_storage,
                    supabase_url=args.supabase_url,
                    supabase_key=args.supabase_key,
                    store_models_in_supabase=args.store_models_in_supabase,
                    loss_function=args.loss_function,
                    focal_gamma=args.focal_gamma,
                    focal_alpha=args.focal_alpha,
                    architecture=args.architecture
                )
            else:
                raise ImportError("ML-based training requested but no ML framework is available")
        else:  # hybrid
            trainer = HybridTrainer(
                dataset, 
                args.epochs, 
                args.batch_size, 
                args.learning_rate, 
                progress_reporter=reporter,
                enable_dynamic_params=args.enable_dynamic_params,
                parameter_storage=args.parameter_storage,
                supabase_url=args.supabase_url,
                supabase_key=args.supabase_key,
                store_models_in_supabase=args.store_models_in_supabase,
                loss_function=args.loss_function,
                focal_gamma=args.focal_gamma,
                focal_alpha=args.focal_alpha,
                architecture=args.architecture
            )

        # Train model
        results = trainer.train()
        
        # Save model
        model_path = trainer.save_model(args.output_dir)
        
        # Add model path to results
        if isinstance(model_path, dict):
            results["model_paths"] = model_path
        else:
            results["model_path"] = model_path
        
        # Print results as JSON
        print(json.dumps(results, indent=2))
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()