#!/usr/bin/env python3
"""
Transfer Learning Module for Material Recognition

This module provides enhanced transfer learning capabilities:
1. Fine-tuning existing models with small datasets
2. Loading and adapting custom pretrained models
3. Specialized techniques for transfer learning with limited data

Usage:
    Import this module to enable transfer learning capabilities in the model training pipeline
"""

import os
import json
import numpy as np
import time
from typing import Dict, List, Any, Tuple, Optional, Union
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('transfer_learning')

# Conditionally import TensorFlow
try:
    import tensorflow as tf
    from tensorflow.keras import layers, models, applications, optimizers
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    logger.warning("TensorFlow is not available. TensorFlow-based transfer learning will be disabled.")

# Conditionally import PyTorch
try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import Dataset, DataLoader
    import torchvision
    from torchvision import transforms, models
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch is not available. PyTorch-based transfer learning will be disabled.")


class TransferLearningBase:
    """Base class for transfer learning operations"""
    
    def __init__(self, dataset_dir: str, output_dir: str):
        """
        Initialize transfer learning
        
        Args:
            dataset_dir: Directory containing training data
            output_dir: Directory to save models and results
        """
        self.dataset_dir = dataset_dir
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def get_available_frameworks(self) -> List[str]:
        """
        Get available deep learning frameworks
        
        Returns:
            List of available frameworks
        """
        frameworks = []
        if TF_AVAILABLE:
            frameworks.append("tensorflow")
        if TORCH_AVAILABLE:
            frameworks.append("pytorch")
        return frameworks


class TensorFlowTransferLearning(TransferLearningBase):
    """Transfer learning implementation using TensorFlow"""
    
    def __init__(self, dataset_dir: str, output_dir: str):
        """
        Initialize TensorFlow transfer learning
        
        Args:
            dataset_dir: Directory containing training data
            output_dir: Directory to save models and results
        """
        super().__init__(dataset_dir, output_dir)
        
        if not TF_AVAILABLE:
            raise ImportError("TensorFlow is not available")
    
    def load_pretrained_model(self, model_name: str = "mobilenetv2", img_size: int = 224) -> tf.keras.Model:
        """
        Load a pretrained model
        
        Args:
            model_name: Name of the pretrained model architecture
            img_size: Input image size
            
        Returns:
            Pretrained model
        """
        input_shape = (img_size, img_size, 3)
        
        if model_name.lower() == "mobilenetv2":
            base_model = applications.MobileNetV2(
                input_shape=input_shape,
                include_top=False,
                weights='imagenet'
            )
        elif model_name.lower() == "resnet50":
            base_model = applications.ResNet50(
                input_shape=input_shape,
                include_top=False,
                weights='imagenet'
            )
        elif model_name.lower() == "efficientnetb0":
            base_model = applications.EfficientNetB0(
                input_shape=input_shape,
                include_top=False,
                weights='imagenet'
            )
        else:
            raise ValueError(f"Unsupported model name: {model_name}")
        
        return base_model
    
    def load_custom_pretrained_model(self, model_path: str) -> tf.keras.Model:
        """
        Load a custom pretrained model
        
        Args:
            model_path: Path to the saved model
            
        Returns:
            Loaded model
        """
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found at {model_path}")
        
        try:
            model = tf.keras.models.load_model(model_path)
            logger.info(f"Loaded custom pretrained model from {model_path}")
            return model
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
    
    def prepare_for_fine_tuning(self, base_model: tf.keras.Model, num_classes: int, 
                               num_layers_to_unfreeze: int = 0) -> tf.keras.Model:
        """
        Prepare a model for fine-tuning
        
        Args:
            base_model: Base model to prepare
            num_classes: Number of target classes
            num_layers_to_unfreeze: Number of layers to unfreeze from the end of the base model
            
        Returns:
            Model prepared for fine-tuning
        """
        # Freeze all layers in the base model
        base_model.trainable = False
        
        # Unfreeze specified number of layers from the end if requested
        if num_layers_to_unfreeze > 0:
            # Ensure we don't unfreeze more layers than exist
            num_layers_to_unfreeze = min(num_layers_to_unfreeze, len(base_model.layers))
            
            # Unfreeze the last n layers
            for layer in base_model.layers[-num_layers_to_unfreeze:]:
                layer.trainable = True
            
            logger.info(f"Unfrozen the last {num_layers_to_unfreeze} layers of base model for fine-tuning")
        
        # Create a new model with the base model and a custom head
        model = tf.keras.Sequential([
            base_model,
            layers.GlobalAveragePooling2D(),
            layers.BatchNormalization(),
            layers.Dense(256, activation='relu'),
            layers.Dropout(0.5),
            layers.Dense(128, activation='relu'),
            layers.Dropout(0.3),
            layers.Dense(num_classes, activation='softmax')
        ])
        
        return model
    
    def create_data_generators(self, img_size: int = 224, batch_size: int = 32, 
                              augmentation_strength: str = "medium"):
        """
        Create data generators for training
        
        Args:
            img_size: Input image size
            batch_size: Batch size for training
            augmentation_strength: Strength of data augmentation ('none', 'light', 'medium', 'heavy')
            
        Returns:
            Tuple of (train_generator, validation_generator, class_indices)
        """
        # Define augmentation parameters based on strength
        if augmentation_strength == "none":
            augmentation_params = {}
        elif augmentation_strength == "light":
            augmentation_params = {
                'rotation_range': 10,
                'width_shift_range': 0.1,
                'height_shift_range': 0.1,
                'zoom_range': 0.1,
                'horizontal_flip': True
            }
        elif augmentation_strength == "medium":
            augmentation_params = {
                'rotation_range': 20,
                'width_shift_range': 0.2,
                'height_shift_range': 0.2,
                'shear_range': 0.2,
                'zoom_range': 0.2,
                'horizontal_flip': True,
                'fill_mode': 'nearest'
            }
        elif augmentation_strength == "heavy":
            augmentation_params = {
                'rotation_range': 30,
                'width_shift_range': 0.3,
                'height_shift_range': 0.3,
                'shear_range': 0.3,
                'zoom_range': 0.3,
                'horizontal_flip': True,
                'vertical_flip': True,
                'fill_mode': 'nearest',
                'brightness_range': [0.7, 1.3]
            }
        else:
            raise ValueError(f"Unsupported augmentation strength: {augmentation_strength}")
        
        # Create data generators
        train_datagen = tf.keras.preprocessing.image.ImageDataGenerator(
            rescale=1./255,
            validation_split=0.2,  # 20% for validation
            **augmentation_params
        )
        
        # Load training data
        train_generator = train_datagen.flow_from_directory(
            self.dataset_dir,
            target_size=(img_size, img_size),
            batch_size=batch_size,
            class_mode='sparse',
            subset='training',
            shuffle=True
        )
        
        # Load validation data
        validation_generator = train_datagen.flow_from_directory(
            self.dataset_dir,
            target_size=(img_size, img_size),
            batch_size=batch_size,
            class_mode='sparse',
            subset='validation',
            shuffle=False
        )
        
        return train_generator, validation_generator, train_generator.class_indices
    
    def fine_tune_model(self, model: tf.keras.Model, train_generator, validation_generator, 
                       epochs: int = 10, learning_rate: float = 0.0001,
                       fine_tune_epochs: int = 5, fine_tune_learning_rate: float = 0.00001):
        """
        Fine-tune a model in two phases:
        1. Train only the top layers with the base model frozen
        2. Train the unfrozen layers with a lower learning rate
        
        Args:
            model: Model to fine-tune
            train_generator: Training data generator
            validation_generator: Validation data generator
            epochs: Number of epochs for initial training
            learning_rate: Learning rate for initial training
            fine_tune_epochs: Number of epochs for fine-tuning
            fine_tune_learning_rate: Learning rate for fine-tuning
            
        Returns:
            Dictionary with training results
        """
        # Phase 1: Train only the top layers
        logger.info("Phase 1: Training only the top layers")
        
        # Ensure the base model is frozen
        if hasattr(model, 'layers') and len(model.layers) > 0 and hasattr(model.layers[0], 'trainable'):
            model.layers[0].trainable = False
        
        # Compile the model with the initial learning rate
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )
        
        # Create callbacks
        callbacks = [
            tf.keras.callbacks.ModelCheckpoint(
                filepath=os.path.join(self.output_dir, 'best_model_phase1'),
                save_best_only=True,
                monitor='val_accuracy'
            ),
            tf.keras.callbacks.EarlyStopping(
                monitor='val_loss',
                patience=5,
                restore_best_weights=True
            ),
            tf.keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.2,
                patience=2,
                min_lr=learning_rate / 10
            )
        ]
        
        # Train the model (phase 1)
        phase1_history = model.fit(
            train_generator,
            epochs=epochs,
            validation_data=validation_generator,
            callbacks=callbacks
        )
        
        # Phase 2: Fine-tune unfrozen layers
        if fine_tune_epochs > 0 and any(layer.trainable for layer in model.layers):
            logger.info("Phase 2: Fine-tuning unfrozen layers")
            
            # Compile the model with a lower learning rate
            model.compile(
                optimizer=tf.keras.optimizers.Adam(learning_rate=fine_tune_learning_rate),
                loss='sparse_categorical_crossentropy',
                metrics=['accuracy']
            )
            
            # Update callbacks for phase 2
            callbacks = [
                tf.keras.callbacks.ModelCheckpoint(
                    filepath=os.path.join(self.output_dir, 'best_model_phase2'),
                    save_best_only=True,
                    monitor='val_accuracy'
                ),
                tf.keras.callbacks.EarlyStopping(
                    monitor='val_loss',
                    patience=10,
                    restore_best_weights=True
                ),
                tf.keras.callbacks.ReduceLROnPlateau(
                    monitor='val_loss',
                    factor=0.2,
                    patience=3,
                    min_lr=fine_tune_learning_rate / 10
                )
            ]
            
            # Train the model (phase 2)
            phase2_history = model.fit(
                train_generator,
                epochs=fine_tune_epochs,
                validation_data=validation_generator,
                callbacks=callbacks,
                initial_epoch=len(phase1_history.history['loss'])
            )
            
            # Combine histories
            history = {
                'loss': phase1_history.history['loss'] + phase2_history.history['loss'],
                'accuracy': phase1_history.history['accuracy'] + phase2_history.history['accuracy'],
                'val_loss': phase1_history.history['val_loss'] + phase2_history.history['val_loss'],
                'val_accuracy': phase1_history.history['val_accuracy'] + phase2_history.history['val_accuracy']
            }
        else:
            history = phase1_history.history
        
        # Return training results
        return {
            'history': history,
            'final_accuracy': float(history['accuracy'][-1]),
            'final_val_accuracy': float(history['val_accuracy'][-1]),
            'final_loss': float(history['loss'][-1]),
            'final_val_loss': float(history['val_loss'][-1])
        }
    
    def save_model_and_metadata(self, model: tf.keras.Model, class_indices: Dict[str, int],
                               training_results: Dict[str, Any]) -> Dict[str, str]:
        """
        Save the model and its metadata
        
        Args:
            model: Trained model to save
            class_indices: Dictionary mapping class names to indices
            training_results: Results from the training process
            
        Returns:
            Dictionary with paths to saved files
        """
        # Save the model
        model_path = os.path.join(self.output_dir, 'final_model')
        model.save(model_path)
        
        # Create class mapping
        class_mapping = {v: k for k, v in class_indices.items()}
        class_mapping_path = os.path.join(self.output_dir, 'class_mapping.json')
        with open(class_mapping_path, 'w') as f:
            json.dump(class_mapping, f, indent=2)
        
        # Create material metadata
        material_metadata = {
            "model_type": "transfer-learning-tensorflow",
            "input_size": model.input_shape[1],
            "materials": {}
        }
        
        for class_name, class_idx in class_indices.items():
            material_metadata["materials"][class_name] = {
                "id": class_name,
                "name": class_name.replace("_", " ").title(),
                "index": int(class_idx)
            }
        
        metadata_path = os.path.join(self.output_dir, 'material_metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(material_metadata, f, indent=2)
        
        # Save training results
        results_path = os.path.join(self.output_dir, 'training_results.json')
        with open(results_path, 'w') as f:
            # Filter out non-serializable objects
            serializable_results = {
                k: v for k, v in training_results.items() 
                if k != 'history' or isinstance(v, (dict, list, str, int, float, bool, type(None)))
            }
            
            # Convert numpy values to Python native types
            if 'history' in serializable_results:
                history = serializable_results['history']
                for key, values in history.items():
                    history[key] = [float(v) for v in values]
            
            json.dump(serializable_results, f, indent=2)
        
        return {
            'model_path': model_path,
            'class_mapping_path': class_mapping_path,
            'metadata_path': metadata_path,
            'results_path': results_path
        }


class PyTorchTransferLearning(TransferLearningBase):
    """Transfer learning implementation using PyTorch"""
    
    def __init__(self, dataset_dir: str, output_dir: str):
        """
        Initialize PyTorch transfer learning
        
        Args:
            dataset_dir: Directory containing training data
            output_dir: Directory to save models and results
        """
        super().__init__(dataset_dir, output_dir)
        
        if not TORCH_AVAILABLE:
            raise ImportError("PyTorch is not available")
        
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Using PyTorch with device: {self.device}")
    
    def load_pretrained_model(self, model_name: str = "resnet18") -> nn.Module:
        """
        Load a pretrained model
        
        Args:
            model_name: Name of the pretrained model architecture
            
        Returns:
            Pretrained model
        """
        if model_name.lower() == "resnet18":
            model = models.resnet18(pretrained=True)
        elif model_name.lower() == "mobilenet_v2":
            model = models.mobilenet_v2(pretrained=True)
        elif model_name.lower() == "efficientnet_b0":
            model = models.efficientnet_b0(pretrained=True)
        else:
            raise ValueError(f"Unsupported model name: {model_name}")
        
        return model
    
    def load_custom_pretrained_model(self, model_path: str) -> nn.Module:
        """
        Load a custom pretrained model
        
        Args:
            model_path: Path to the saved model
            
        Returns:
            Loaded model
        """
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found at {model_path}")
        
        try:
            model = torch.load(model_path, map_location=self.device)
            logger.info(f"Loaded custom pretrained model from {model_path}")
            return model
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
    
    def prepare_for_fine_tuning(self, base_model: nn.Module, num_classes: int, 
                               num_layers_to_unfreeze: int = 0) -> nn.Module:
        """
        Prepare a model for fine-tuning
        
        Args:
            base_model: Base model to prepare
            num_classes: Number of target classes
            num_layers_to_unfreeze: Number of layers to unfreeze from the end of the base model
            
        Returns:
            Model prepared for fine-tuning
        """
        # Freeze all parameters in the base model
        for param in base_model.parameters():
            param.requires_grad = False
        
        # Get classifier attributes based on model type
        if isinstance(base_model, models.ResNet):
            num_features = base_model.fc.in_features
            # Replace the fully connected layer
            base_model.fc = nn.Sequential(
                nn.Linear(num_features, 256),
                nn.ReLU(),
                nn.Dropout(0.5),
                nn.Linear(256, 128),
                nn.ReLU(),
                nn.Dropout(0.3),
                nn.Linear(128, num_classes)
            )
            
            # Unfreeze layers if specified
            if num_layers_to_unfreeze > 0:
                # Get layers in reverse order
                layer_names = [name for name, _ in reversed(list(base_model.named_children()))]
                
                # Limit to available layers
                num_layers_to_unfreeze = min(num_layers_to_unfreeze, len(layer_names) - 1)  # -1 to exclude fc
                
                # Unfreeze specified layers
                for i in range(num_layers_to_unfreeze):
                    layer_name = layer_names[i + 1]  # +1 to skip fc
                    for param in getattr(base_model, layer_name).parameters():
                        param.requires_grad = True
                
                logger.info(f"Unfrozen the last {num_layers_to_unfreeze} layers of base model for fine-tuning")
            
        elif isinstance(base_model, models.MobileNetV2) or 'EfficientNet' in base_model.__class__.__name__:
            # For MobileNetV2 and EfficientNet
            if hasattr(base_model, 'classifier'):
                if isinstance(base_model.classifier, nn.Sequential):
                    in_features = base_model.classifier[-1].in_features
                else:
                    in_features = base_model.classifier.in_features
                
                base_model.classifier = nn.Sequential(
                    nn.Linear(in_features, 256),
                    nn.ReLU(),
                    nn.Dropout(0.5),
                    nn.Linear(256, 128),
                    nn.ReLU(),
                    nn.Dropout(0.3),
                    nn.Linear(128, num_classes)
                )
            else:
                # Fallback for other models
                logger.warning("Model structure not recognized, replacing last layer based on standard pattern")
                last_layer_name = list(base_model._modules.keys())[-1]
                last_layer = getattr(base_model, last_layer_name)
                
                if hasattr(last_layer, 'in_features'):
                    in_features = last_layer.in_features
                    setattr(base_model, last_layer_name, nn.Linear(in_features, num_classes))
                else:
                    logger.error("Could not determine model structure for fine-tuning")
                    raise ValueError("Unsupported model architecture for fine-tuning")
            
            # Unfreeze layers if specified
            if num_layers_to_unfreeze > 0:
                # For MobileNetV2, handle features and classifier separately
                feature_layers = list(base_model.features.named_children())
                
                # Limit to available feature layers
                num_to_unfreeze = min(num_layers_to_unfreeze, len(feature_layers))
                
                # Unfreeze the last n feature layers
                for i in range(num_to_unfreeze):
                    layer_name, layer = feature_layers[-(i+1)]
                    for param in layer.parameters():
                        param.requires_grad = True
                
                logger.info(f"Unfrozen the last {num_to_unfreeze} feature layers for fine-tuning")
        else:
            logger.warning("Model architecture not explicitly supported, attempting generic adaptation")
            # Try to find the classifier or fc layer based on common patterns
            if hasattr(base_model, 'fc'):
                in_features = base_model.fc.in_features
                base_model.fc = nn.Linear(in_features, num_classes)
            elif hasattr(base_model, 'classifier'):
                if isinstance(base_model.classifier, nn.Sequential):
                    in_features = base_model.classifier[-1].in_features
                    base_model.classifier[-1] = nn.Linear(in_features, num_classes)
                else:
                    in_features = base_model.classifier.in_features
                    base_model.classifier = nn.Linear(in_features, num_classes)
            else:
                logger.error("Could not determine model structure for fine-tuning")
                raise ValueError("Unsupported model architecture for fine-tuning")
        
        return base_model.to(self.device)
    
    def create_dataloaders(self, img_size: int = 224, batch_size: int = 32, 
                          augmentation_strength: str = "medium"):
        """
        Create dataloaders for training
        
        Args:
            img_size: Input image size
            batch_size: Batch size for training
            augmentation_strength: Strength of data augmentation ('none', 'light', 'medium', 'heavy')
            
        Returns:
            Tuple of (train_loader, val_loader, class_to_idx)
        """
        # Define transformations based on augmentation strength
        if augmentation_strength == "none":
            train_transform = transforms.Compose([
                transforms.Resize((img_size, img_size)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
            ])
        elif augmentation_strength == "light":
            train_transform = transforms.Compose([
                transforms.Resize((img_size, img_size)),
                transforms.RandomHorizontalFlip(),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
            ])
        elif augmentation_strength == "medium":
            train_transform = transforms.Compose([
                transforms.Resize((img_size, img_size)),
                transforms.RandomHorizontalFlip(),
                transforms.RandomRotation(20),
                transforms.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1, hue=0.1),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
            ])
        elif augmentation_strength == "heavy":
            train_transform = transforms.Compose([
                transforms.Resize((img_size, img_size)),
                transforms.RandomHorizontalFlip(),
                transforms.RandomVerticalFlip(),
                transforms.RandomRotation(30),
                transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.2),
                transforms.RandomAffine(degrees=0, translate=(0.2, 0.2), scale=(0.8, 1.2)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
            ])
        else:
            raise ValueError(f"Unsupported augmentation strength: {augmentation_strength}")
        
        # Define validation transform (no augmentation)
        val_transform = transforms.Compose([
            transforms.Resize((img_size, img_size)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])
        
        # Load the dataset with training transforms
        full_dataset = torchvision.datasets.ImageFolder(self.dataset_dir, transform=train_transform)
        class_to_idx = full_dataset.class_to_idx
        
        # Split into training and validation sets
        val_size = int(0.2 * len(full_dataset))
        train_size = len(full_dataset) - val_size
        
        train_dataset, val_dataset = torch.utils.data.random_split(full_dataset, [train_size, val_size])
        
        # Apply validation transform to validation dataset
        val_dataset.dataset.transform = val_transform
        
        # Create data loaders
        train_loader = DataLoader(
            train_dataset,
            batch_size=batch_size,
            shuffle=True,
            num_workers=4,
            pin_memory=True
        )
        
        val_loader = DataLoader(
            val_dataset,
            batch_size=batch_size,
            shuffle=False,
            num_workers=4,
            pin_memory=True
        )
        
        return train_loader, val_loader, class_to_idx
    
    def fine_tune_model(self, model: nn.Module, train_loader, val_loader, 
                       epochs: int = 10, learning_rate: float = 0.0001,
                       fine_tune_epochs: int = 5, fine_tune_learning_rate: float = 0.00001):
        """
        Fine-tune a model in two phases:
        1. Train only the top layers with the base model frozen
        2. Train the unfrozen layers with a lower learning rate
        
        Args:
            model: Model to fine-tune
            train_loader: Training data loader
            val_loader: Validation data loader
            epochs: Number of epochs for initial training
            learning_rate: Learning rate for initial training
            fine_tune_epochs: Number of epochs for fine-tuning
            fine_tune_learning_rate: Learning rate for fine-tuning
            
        Returns:
            Dictionary with training results
        """
        # Move model to device
        model = model.to(self.device)
        
        # Define loss function
        criterion = nn.CrossEntropyLoss()
        
        # Phase 1: Train only the top layers
        logger.info("Phase 1: Training only the top layers")
        
        # Filter parameters that require gradients
        params_to_train = [param for param in model.parameters() if param.requires_grad]
        
        # Define optimizer
        optimizer = optim.Adam(params_to_train, lr=learning_rate)
        
        # Define learning rate scheduler
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, mode='min', factor=0.2, patience=3, min_lr=learning_rate/10
        )
        
        # Training history
        history = {
            'loss': [],
            'accuracy': [],
            'val_loss': [],
            'val_accuracy': []
        }
        
        # Best validation accuracy and corresponding model state
        best_val_acc = 0.0
        best_model_state = None
        
        # Train for specified number of epochs
        for epoch in range(epochs):
            # Training phase
            model.train()
            running_loss = 0.0
            correct = 0
            total = 0
            
            for inputs, labels in train_loader:
                inputs, labels = inputs.to(self.device), labels.to(self.device)
                
                # Zero gradients
                optimizer.zero_grad()
                
                # Forward pass
                outputs = model(inputs)
                loss = criterion(outputs, labels)
                
                # Backward pass
                loss.backward()
                
                # Optimize
                optimizer.step()
                
                # Update statistics
                running_loss += loss.item() * inputs.size(0)
                _, predicted = outputs.max(1)
                total += labels.size(0)
                correct += predicted.eq(labels).sum().item()
            
            # Calculate epoch metrics
            epoch_loss = running_loss / len(train_loader.dataset)
            epoch_acc = correct / total
            
            # Add to history
            history['loss'].append(epoch_loss)
            history['accuracy'].append(epoch_acc)
            
            # Validation phase
            model.eval()
            val_running_loss = 0.0
            val_correct = 0
            val_total = 0
            
            with torch.no_grad():
                for inputs, labels in val_loader:
                    inputs, labels = inputs.to(self.device), labels.to(self.device)
                    
                    # Forward pass
                    outputs = model(inputs)
                    loss = criterion(outputs, labels)
                    
                    # Update statistics
                    val_running_loss += loss.item() * inputs.size(0)
                    _, predicted = outputs.max(1)
                    val_total += labels.size(0)
                    val_correct += predicted.eq(labels).sum().item()
            
            # Calculate validation metrics
            val_epoch_loss = val_running_loss / len(val_loader.dataset)
            val_epoch_acc = val_correct / val_total
            
            # Add to history
            history['val_loss'].append(val_epoch_loss)
            history['val_accuracy'].append(val_epoch_acc)
            
            # Update learning rate
            scheduler.step(val_epoch_loss)
            
            # Save best model
            if val_epoch_acc > best_val_acc:
                best_val_acc = val_epoch_acc
                best_model_state = model.state_dict().copy()
            
            # Log progress
            logger.info(f"Epoch {epoch+1}/{epochs} - "
                      f"Loss: {epoch_loss:.4f}, Accuracy: {epoch_acc:.4f}, "
                      f"Val Loss: {val_epoch_loss:.4f}, Val Accuracy: {val_epoch_acc:.4f}")
        
        # Load best model from phase 1
        if best_model_state is not None:
            model.load_state_dict(best_model_state)
        
        # Phase 2: Fine-tune unfrozen layers if specified
        if fine_tune_epochs > 0 and any(param.requires_grad for param in model.parameters()):
            logger.info("Phase 2: Fine-tuning unfrozen layers")
            
            # Define optimizer with lower learning rate
            optimizer = optim.Adam(model.parameters(), lr=fine_tune_learning_rate)
            
            # Define learning rate scheduler
            scheduler = optim.lr_scheduler.ReduceLROnPlateau(
                optimizer, mode='min', factor=0.2, patience=3, min_lr=fine_tune_learning_rate/10
            )
            
            # Train for specified number of additional epochs
            best_phase2_val_acc = 0.0
            best_phase2_model_state = None
            
            for epoch in range(fine_tune_epochs):
                # Training phase
                model.train()
                running_loss = 0.0
                correct = 0
                total = 0
                
                for inputs, labels in train_loader:
                    inputs, labels = inputs.to(self.device), labels.to(self.device)
                    
                    # Zero gradients
                    optimizer.zero_grad()
                    
                    # Forward pass
                    outputs = model(inputs)
                    loss = criterion(outputs, labels)
                    
                    # Backward pass
                    loss.backward()
                    
                    # Optimize
                    optimizer.step()
                    
                    # Update statistics
                    running_loss += loss.item() * inputs.size(0)
                    _, predicted = outputs.max(1)
                    total += labels.size(0)
                    correct += predicted.eq(labels).sum().item()
                
                # Calculate epoch metrics
                epoch_loss = running_loss / len(train_loader.dataset)
                epoch_acc = correct / total
                
                # Add to history
                history['loss'].append(epoch_loss)
                history['accuracy'].append(epoch_acc)
                
                # Validation phase
                model.eval()
                val_running_loss = 0.0
                val_correct = 0
                val_total = 0
                
                with torch.no_grad():
                    for inputs, labels in val_loader:
                        inputs, labels = inputs.to(self.device), labels.to(self.device)
                        
                        # Forward pass
                        outputs = model(inputs)
                        loss = criterion(outputs, labels)
                        
                        # Update statistics
                        val_running_loss += loss.item() * inputs.size(0)
                        _, predicted = outputs.max(1)
                        val_total += labels.size(0)
                        val_correct += predicted.eq(labels).sum().item()
                
                # Calculate validation metrics
                val_epoch_loss = val_running_loss / len(val_loader.dataset)
                val_epoch_acc = val_correct / val_total
                
                # Add to history
                history['val_loss'].append(val_epoch_loss)
                history['val_accuracy'].append(val_epoch_acc)
                
                # Update learning rate
                scheduler.step(val_epoch_loss)
                
                # Save best model
                if val_epoch_acc > best_phase2_val_acc:
                    best_phase2_val_acc = val_epoch_acc
                    best_phase2_model_state = model.state_dict().copy()
                
                # Log progress
                logger.info(f"Fine-tune Epoch {epoch+1}/{fine_tune_epochs} - "
                          f"Loss: {epoch_loss:.4f}, Accuracy: {epoch_acc:.4f}, "
                          f"Val Loss: {val_epoch_loss:.4f}, Val Accuracy: {val_epoch_acc:.4f}")
            
            # Load best model from phase 2 if it's better than phase 1
            if best_phase2_val_acc > best_val_acc and best_phase2_model_state is not None:
                model.load_state_dict(best_phase2_model_state)
                best_val_acc = best_phase2_val_acc
            elif best_model_state is not None:
                model.load_state_dict(best_model_state)
        
        # Return training results
        return {
            'history': history,
            'final_accuracy': float(history['accuracy'][-1]),
            'final_val_accuracy': float(history['val_accuracy'][-1]),
            'final_loss': float(history['loss'][-1]),
            'final_val_loss': float(history['val_loss'][-1]),
            'best_val_accuracy': float(best_val_acc)
        }
    
    def save_model_and_metadata(self, model: nn.Module, class_to_idx: Dict[str, int],
                               training_results: Dict[str, Any]) -> Dict[str, str]:
        """
        Save the model and its metadata
        
        Args:
            model: Trained model to save
            class_to_idx: Dictionary mapping class names to indices
            training_results: Results from the training process
            
        Returns:
            Dictionary with paths to saved files
        """
        # Save the model
        model_path = os.path.join(self.output_dir, 'final_model.pt')
        torch.save(model, model_path)
        
        # Create class mapping
        idx_to_class = {v: k for k, v in class_to_idx.items()}
        class_mapping_path = os.path.join(self.output_dir, 'class_mapping.json')
        with open(class_mapping_path, 'w') as f:
            json.dump(idx_to_class, f, indent=2)
        
        # Create material metadata
        material_metadata = {
            "model_type": "transfer-learning-pytorch",
            "input_size": 224,  # Typically fixed for pretrained models
            "materials": {}
        }
        
        for class_name, class_idx in class_to_idx.items():
            material_metadata["materials"][class_name] = {
                "id": class_name,
                "name": class_name.replace("_", " ").title(),
                "index": int(class_idx)
            }
        
        metadata_path = os.path.join(self.output_dir, 'material_metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(material_metadata, f, indent=2)
        
        # Save training results
        results_path = os.path.join(self.output_dir, 'training_results.json')
        with open(results_path, 'w') as f:
            # Filter out non-serializable objects
            serializable_results = {
                k: v for k, v in training_results.items() 
                if k != 'history' or isinstance(v, (dict, list, str, int, float, bool, type(None)))
            }
            
            # Convert history values to standard Python types
            if 'history' in serializable_results:
                history = serializable_results['history']
                for key, values in history.items():
                    history[key] = [float(v) for v in values]
            
            json.dump(serializable_results, f, indent=2)
        
        return {
            'model_path': model_path,
            'class_mapping_path': class_mapping_path,
            'metadata_path': metadata_path,
            'results_path': results_path
        }


def create_transfer_learning(dataset_dir: str, output_dir: str, framework: str = "auto") -> TransferLearningBase:
    """
    Create a transfer learning instance
    
    Args:
        dataset_dir: Directory containing training data
        output_dir: Directory to save models and results
        framework: Deep learning framework to use ('tensorflow', 'pytorch', or 'auto')
        
    Returns:
        Transfer learning instance
    """
    # Determine available frameworks
    frameworks = []
    if TF_AVAILABLE:
        frameworks.append("tensorflow")
    if TORCH_AVAILABLE:
        frameworks.append("pytorch")
    
    if not frameworks:
        raise ImportError("No supported deep learning frameworks (TensorFlow or PyTorch) are available")
    
    # Select framework
    if framework == "auto":
        # Choose the first available framework
        framework = frameworks[0]
        logger.info(f"Automatically selected framework: {framework}")
    elif framework not in frameworks:
        available_frameworks = ", ".join(frameworks)
        raise ValueError(f"Framework '{framework}' is not available. Available frameworks: {available_frameworks}")
    
    # Create transfer learning instance
    if framework == "tensorflow":
        return TensorFlowTransferLearning(dataset_dir, output_dir)
    else:  # pytorch
        return PyTorchTransferLearning(dataset_dir, output_dir)


def fine_tune_with_small_dataset(dataset_dir: str, output_dir: str, framework: str = "auto",
                               model_name: str = None, custom_model_path: str = None,
                               num_layers_to_unfreeze: int = 3,
                               epochs: int = 20, fine_tune_epochs: int = 10,
                               batch_size: int = 16, learning_rate: float = 0.0001,
                               fine_tune_learning_rate: float = 0.00001,
                               augmentation_strength: str = "heavy",
                               img_size: int = 224) -> Dict[str, Any]:
    """
    Fine-tune a model with a small dataset
    
    Args:
        dataset_dir: Directory containing training data
        output_dir: Directory to save model and results
        framework: Deep learning framework to use ('tensorflow', 'pytorch', or 'auto')
        model_name: Name of the pretrained model architecture
        custom_model_path: Path to a custom pretrained model
        num_layers_to_unfreeze: Number of layers to unfreeze for fine-tuning
        epochs: Number of epochs for initial training
        fine_tune_epochs: Number of epochs for fine-tuning
        batch_size: Batch size for training
        learning_rate: Learning rate for initial training
        fine_tune_learning_rate: Learning rate for fine-tuning
        augmentation_strength: Strength of data augmentation
        img_size: Input image size
        
    Returns:
        Dictionary with training results
    """
    # Create transfer learning instance
    transfer_learning = create_transfer_learning(dataset_dir, output_dir, framework)
    
    # Identify framework being used
    framework = "tensorflow" if isinstance(transfer_learning, TensorFlowTransferLearning) else "pytorch"
    
    # Default model name if not provided
    if not model_name and not custom_model_path:
        model_name = "mobilenetv2" if framework == "tensorflow" else "resnet18"
        logger.info(f"Using default model: {model_name}")
    
    # Load data
    if framework == "tensorflow":
        train_data, val_data, class_indices = transfer_learning.create_data_generators(
            img_size=img_size,
            batch_size=batch_size,
            augmentation_strength=augmentation_strength
        )
        num_classes = len(class_indices)
    else:
        train_data, val_data, class_indices = transfer_learning.create_dataloaders(
            img_size=img_size,
            batch_size=batch_size,
            augmentation_strength=augmentation_strength
        )
        num_classes = len(class_indices)
    
    # Load model
    if custom_model_path:
        logger.info(f"Loading custom pretrained model from {custom_model_path}")
        base_model = transfer_learning.load_custom_pretrained_model(custom_model_path)
    else:
        logger.info(f"Loading pretrained model: {model_name}")
        base_model = transfer_learning.load_pretrained_model(model_name, img_size)
    
    # Prepare model for fine-tuning
    model = transfer_learning.prepare_for_fine_tuning(
        base_model,
        num_classes,
        num_layers_to_unfreeze
    )
    
    # Fine-tune the model
    start_time = time.time()
    
    training_results = transfer_learning.fine_tune_model(
        model,
        train_data,
        val_data,
        epochs=epochs,
        learning_rate=learning_rate,
        fine_tune_epochs=fine_tune_epochs,
        fine_tune_learning_rate=fine_tune_learning_rate
    )
    
    training_time = time.time() - start_time
    training_results['training_time'] = training_time
    
    # Save model and metadata
    save_results = transfer_learning.save_model_and_metadata(
        model,
        class_indices,
        training_results
    )
    
    # Combine results
    combined_results = {
        'framework': framework,
        'model_name': model_name if model_name else 'custom',
        'training_time': training_time,
        'num_classes': num_classes,
        'final_accuracy': training_results['final_accuracy'],
        'final_val_accuracy': training_results['final_val_accuracy'],
        'saved_files': save_results
    }
    
    logger.info(f"Training completed in {training_time:.2f} seconds with validation accuracy: {training_results['final_val_accuracy']:.4f}")
    
    return combined_results