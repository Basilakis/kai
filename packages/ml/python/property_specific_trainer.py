#!/usr/bin/env python
"""
Property-Specific Trainer

This script trains models to recognize specific material properties from visual references.
It's used as part of the Visual Reference Library feature.
"""

import os
import sys
import json
import time
import argparse
import logging
from typing import Dict, Any, List, Optional, Tuple, Union
import uuid

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('property-specific-trainer')

# Try to import ML libraries
try:
    import numpy as np
    import tensorflow as tf
    from tensorflow.keras.models import Model, Sequential
    from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
    from tensorflow.keras.applications import EfficientNetB0, ResNet50V2, MobileNetV2
    from tensorflow.keras.preprocessing.image import ImageDataGenerator
    from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau
    TF_AVAILABLE = True
except ImportError:
    logger.warning("TensorFlow not available. ML-based training will be disabled.")
    TF_AVAILABLE = False

try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    logger.warning("Pillow not available. Image processing will be limited.")
    PILLOW_AVAILABLE = False


class PropertyDataset:
    """Dataset for property-specific training"""
    
    def __init__(self, data_dir: str, property_name: str, material_type: str, metadata: Dict[str, Any]):
        """
        Initialize the dataset
        
        Args:
            data_dir: Directory containing training data
            property_name: Property name
            material_type: Material type
            metadata: Property metadata
        """
        self.data_dir = data_dir
        self.property_name = property_name
        self.material_type = material_type
        self.metadata = metadata
        self.field_type = metadata.get('fieldType', 'text')
        self.options = metadata.get('options', [])
        self.validation = metadata.get('validation', {})
        
        # Analyze dataset
        self.class_names = []
        self.num_classes = 0
        self.value_range = {'min': 0, 'max': 0}
        self.class_distribution = {}
        
        self._analyze_dataset()
    
    def _analyze_dataset(self):
        """Analyze the dataset structure"""
        logger.info(f"Analyzing dataset in {self.data_dir}")
        
        if not os.path.exists(self.data_dir):
            logger.error(f"Dataset directory {self.data_dir} does not exist")
            return
        
        # For classification tasks
        if self.field_type in ['dropdown', 'boolean', 'text']:
            # Get class names from subdirectories
            class_dirs = [d for d in os.listdir(self.data_dir) 
                         if os.path.isdir(os.path.join(self.data_dir, d))]
            
            self.class_names = sorted(class_dirs)
            self.num_classes = len(self.class_names)
            
            # Count samples per class
            for class_name in self.class_names:
                class_dir = os.path.join(self.data_dir, class_name)
                image_files = [f for f in os.listdir(class_dir) 
                              if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
                self.class_distribution[class_name] = len(image_files)
            
            logger.info(f"Found {self.num_classes} classes: {', '.join(self.class_names)}")
            logger.info(f"Class distribution: {self.class_distribution}")
        
        # For regression tasks
        elif self.field_type == 'number':
            # Read value ranges from metadata.json files
            all_values = []
            
            for item_dir in [d for d in os.listdir(self.data_dir) 
                            if os.path.isdir(os.path.join(self.data_dir, d))]:
                metadata_path = os.path.join(self.data_dir, item_dir, 'metadata.json')
                
                if os.path.exists(metadata_path):
                    try:
                        with open(metadata_path, 'r') as f:
                            metadata = json.load(f)
                            
                            if self.property_name in metadata:
                                value = float(metadata[self.property_name])
                                all_values.append(value)
                    except Exception as e:
                        logger.warning(f"Error reading metadata for {item_dir}: {e}")
            
            if all_values:
                self.value_range = {
                    'min': min(all_values),
                    'max': max(all_values)
                }
                
                # Create bins for distribution analysis
                num_bins = 10
                bin_width = (self.value_range['max'] - self.value_range['min']) / num_bins
                
                for i in range(num_bins):
                    bin_min = self.value_range['min'] + i * bin_width
                    bin_max = bin_min + bin_width
                    bin_name = f"{bin_min:.2f}-{bin_max:.2f}"
                    
                    bin_count = sum(1 for v in all_values if bin_min <= v < bin_max)
                    self.class_distribution[bin_name] = bin_count
                
                logger.info(f"Value range: {self.value_range['min']} to {self.value_range['max']}")
                logger.info(f"Value distribution: {self.class_distribution}")
            else:
                logger.warning(f"No numeric values found for property {self.property_name}")


class PropertyModelTrainer:
    """Trainer for property-specific models"""
    
    def __init__(self, dataset: PropertyDataset, output_dir: str, model_type: str,
                 epochs: int = 20, batch_size: int = 32, learning_rate: float = 0.001,
                 validation_split: float = 0.2, augmentation: bool = True,
                 transfer_learning: bool = True, base_model: str = 'efficientnet'):
        """
        Initialize the trainer
        
        Args:
            dataset: Dataset for training
            output_dir: Directory to save trained models
            model_type: Model type ('classification', 'regression', or 'detection')
            epochs: Number of training epochs
            batch_size: Batch size for training
            learning_rate: Learning rate for training
            validation_split: Validation split ratio
            augmentation: Whether to use data augmentation
            transfer_learning: Whether to use transfer learning
            base_model: Base model for transfer learning
        """
        self.dataset = dataset
        self.output_dir = output_dir
        self.model_type = model_type
        self.epochs = epochs
        self.batch_size = batch_size
        self.learning_rate = learning_rate
        self.validation_split = validation_split
        self.augmentation = augmentation
        self.transfer_learning = transfer_learning
        self.base_model = base_model
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Initialize model
        self.model = None
        self.train_generator = None
        self.validation_generator = None
        self.history = None
    
    def build_model(self):
        """Build the model architecture"""
        if not TF_AVAILABLE:
            logger.error("TensorFlow is not available. Cannot build model.")
            return
        
        logger.info(f"Building {self.model_type} model with {self.base_model} base")
        
        # Get base model
        if self.base_model == 'efficientnet':
            base_model = EfficientNetB0(weights='imagenet', include_top=False, input_shape=(224, 224, 3))
        elif self.base_model == 'resnet':
            base_model = ResNet50V2(weights='imagenet', include_top=False, input_shape=(224, 224, 3))
        elif self.base_model == 'mobilenet':
            base_model = MobileNetV2(weights='imagenet', include_top=False, input_shape=(224, 224, 3))
        else:
            logger.warning(f"Unknown base model: {self.base_model}. Using EfficientNet.")
            base_model = EfficientNetB0(weights='imagenet', include_top=False, input_shape=(224, 224, 3))
        
        # Freeze base model if using transfer learning
        if self.transfer_learning:
            base_model.trainable = False
        
        # Build model architecture
        if self.model_type == 'classification':
            # Classification model
            model = Sequential([
                base_model,
                GlobalAveragePooling2D(),
                Dropout(0.2),
                Dense(256, activation='relu'),
                Dropout(0.2),
                Dense(self.dataset.num_classes, activation='softmax')
            ])
            
            # Compile model
            model.compile(
                optimizer=tf.keras.optimizers.Adam(learning_rate=self.learning_rate),
                loss='categorical_crossentropy',
                metrics=['accuracy']
            )
        
        elif self.model_type == 'regression':
            # Regression model
            model = Sequential([
                base_model,
                GlobalAveragePooling2D(),
                Dropout(0.2),
                Dense(256, activation='relu'),
                Dropout(0.2),
                Dense(1)  # Single output for regression
            ])
            
            # Compile model
            model.compile(
                optimizer=tf.keras.optimizers.Adam(learning_rate=self.learning_rate),
                loss='mse',
                metrics=['mae']
            )
        
        else:
            logger.error(f"Unsupported model type: {self.model_type}")
            return
        
        self.model = model
        logger.info(f"Model built successfully")
    
    def prepare_data_generators(self):
        """Prepare data generators for training and validation"""
        if not TF_AVAILABLE:
            logger.error("TensorFlow is not available. Cannot prepare data generators.")
            return
        
        logger.info(f"Preparing data generators with batch size {self.batch_size}")
        
        # Define augmentation parameters
        if self.augmentation:
            train_datagen = ImageDataGenerator(
                rescale=1./255,
                validation_split=self.validation_split,
                rotation_range=20,
                width_shift_range=0.2,
                height_shift_range=0.2,
                shear_range=0.2,
                zoom_range=0.2,
                horizontal_flip=True,
                fill_mode='nearest'
            )
        else:
            train_datagen = ImageDataGenerator(
                rescale=1./255,
                validation_split=self.validation_split
            )
        
        # For classification tasks
        if self.model_type == 'classification':
            # Training generator
            self.train_generator = train_datagen.flow_from_directory(
                self.dataset.data_dir,
                target_size=(224, 224),
                batch_size=self.batch_size,
                class_mode='categorical',
                subset='training',
                shuffle=True
            )
            
            # Validation generator
            self.validation_generator = train_datagen.flow_from_directory(
                self.dataset.data_dir,
                target_size=(224, 224),
                batch_size=self.batch_size,
                class_mode='categorical',
                subset='validation',
                shuffle=False
            )
            
            logger.info(f"Found {self.train_generator.samples} training samples")
            logger.info(f"Found {self.validation_generator.samples} validation samples")
        
        # For regression tasks
        elif self.model_type == 'regression':
            # For regression, we need to create a custom generator
            # This is a simplified example - in a real implementation,
            # you would need to create a custom generator that reads
            # the numeric values from metadata files
            
            logger.warning("Regression data generator not fully implemented")
            
            # Placeholder for regression generator
            self.train_generator = None
            self.validation_generator = None
    
    def train(self) -> Dict[str, Any]:
        """
        Train the model
        
        Returns:
            Dictionary with training results
        """
        if not TF_AVAILABLE:
            logger.error("TensorFlow is not available. Cannot train model.")
            return {
                "error": "TensorFlow is not available"
            }
        
        if self.model is None:
            self.build_model()
        
        if self.train_generator is None:
            self.prepare_data_generators()
        
        if self.model is None or self.train_generator is None:
            logger.error("Model or data generators not initialized")
            return {
                "error": "Model or data generators not initialized"
            }
        
        logger.info(f"Starting training for {self.epochs} epochs")
        start_time = time.time()
        
        # Define callbacks
        callbacks = [
            ModelCheckpoint(
                filepath=os.path.join(self.output_dir, 'best_model.h5'),
                monitor='val_loss',
                save_best_only=True,
                verbose=1
            ),
            EarlyStopping(
                monitor='val_loss',
                patience=5,
                restore_best_weights=True,
                verbose=1
            ),
            ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.2,
                patience=3,
                min_lr=1e-6,
                verbose=1
            )
        ]
        
        # Train the model
        history = self.model.fit(
            self.train_generator,
            epochs=self.epochs,
            validation_data=self.validation_generator,
            callbacks=callbacks
        )
        
        self.history = history.history
        
        # Calculate training time
        training_time = time.time() - start_time
        
        # Save model and training history
        self.model.save(os.path.join(self.output_dir, 'final_model.h5'))
        
        with open(os.path.join(self.output_dir, 'training_history.json'), 'w') as f:
            json.dump(self.history, f, indent=2)
        
        # Save class names for classification models
        if self.model_type == 'classification':
            with open(os.path.join(self.output_dir, 'class_names.json'), 'w') as f:
                json.dump(self.dataset.class_names, f, indent=2)
        
        # Evaluate model on validation set
        if self.validation_generator:
            evaluation = self.model.evaluate(self.validation_generator)
            
            if self.model_type == 'classification':
                val_loss, val_accuracy = evaluation
                
                # Calculate confusion matrix
                confusion_matrix = self._calculate_confusion_matrix()
                
                return {
                    "accuracy": float(history.history['accuracy'][-1]),
                    "loss": float(history.history['loss'][-1]),
                    "validationAccuracy": float(val_accuracy),
                    "validationLoss": float(val_loss),
                    "trainingTime": training_time,
                    "epochs": len(history.history['accuracy']),
                    "modelPath": os.path.join(self.output_dir, 'final_model.h5'),
                    "confusionMatrix": confusion_matrix,
                    "classLabels": self.dataset.class_names
                }
            
            elif self.model_type == 'regression':
                val_loss, val_mae = evaluation
                
                return {
                    "accuracy": 0.0,  # Not applicable for regression
                    "loss": float(history.history['loss'][-1]),
                    "validationLoss": float(val_loss),
                    "validationMae": float(val_mae),
                    "trainingTime": training_time,
                    "epochs": len(history.history['loss']),
                    "modelPath": os.path.join(self.output_dir, 'final_model.h5'),
                    "valueRange": self.dataset.value_range
                }
        
        # If no validation generator, return basic metrics
        return {
            "accuracy": float(history.history['accuracy'][-1]) if 'accuracy' in history.history else 0.0,
            "loss": float(history.history['loss'][-1]),
            "trainingTime": training_time,
            "epochs": len(history.history['loss']),
            "modelPath": os.path.join(self.output_dir, 'final_model.h5')
        }
    
    def _calculate_confusion_matrix(self) -> List[List[float]]:
        """
        Calculate confusion matrix for classification model
        
        Returns:
            Confusion matrix as a list of lists
        """
        if self.model_type != 'classification' or self.validation_generator is None:
            return []
        
        # Get predictions
        self.validation_generator.reset()
        predictions = self.model.predict(self.validation_generator)
        predicted_classes = np.argmax(predictions, axis=1)
        
        # Get true classes
        true_classes = self.validation_generator.classes
        
        # Calculate confusion matrix
        confusion_matrix = np.zeros((self.dataset.num_classes, self.dataset.num_classes))
        
        for i in range(len(true_classes)):
            confusion_matrix[true_classes[i]][predicted_classes[i]] += 1
        
        # Normalize by row (true classes)
        row_sums = confusion_matrix.sum(axis=1)
        normalized_matrix = confusion_matrix / row_sums[:, np.newaxis]
        
        # Convert to list of lists
        return normalized_matrix.tolist()


def main():
    """Main function to parse arguments and run the training"""
    parser = argparse.ArgumentParser(description="Train property-specific recognition models")
    parser.add_argument("--property", required=True, help="Property name to train for")
    parser.add_argument("--material-type", required=True, help="Material type")
    parser.add_argument("--data-dir", required=True, help="Directory containing training data")
    parser.add_argument("--output-dir", required=True, help="Directory to save trained models")
    parser.add_argument("--model-type", choices=["classification", "regression", "detection"], 
                        default="classification", help="Type of model to train")
    parser.add_argument("--epochs", type=int, default=20,
                        help="Number of epochs for training")
    parser.add_argument("--batch-size", type=int, default=32,
                        help="Batch size for training")
    parser.add_argument("--learning-rate", type=float, default=0.001,
                        help="Learning rate for training")
    parser.add_argument("--validation-split", type=float, default=0.2,
                        help="Validation split ratio")
    parser.add_argument("--metadata-path", help="Path to property metadata file")
    parser.add_argument("--augmentation", action="store_true", help="Use data augmentation")
    parser.add_argument("--transfer-learning", action="store_true", help="Use transfer learning")
    parser.add_argument("--base-model", choices=["efficientnet", "resnet", "mobilenet"],
                        default="efficientnet", help="Base model for transfer learning")
    
    args = parser.parse_args()
    
    try:
        # Check if TensorFlow is available
        if not TF_AVAILABLE:
            logger.error("TensorFlow is not available. Cannot train model.")
            sys.exit(1)
        
        # Load property metadata
        metadata = {}
        if args.metadata_path and os.path.exists(args.metadata_path):
            try:
                with open(args.metadata_path, 'r') as f:
                    metadata = json.load(f)
                    logger.info(f"Loaded property metadata from {args.metadata_path}")
            except Exception as e:
                logger.warning(f"Error loading metadata from {args.metadata_path}: {e}")
        
        # Create dataset
        dataset = PropertyDataset(
            args.data_dir,
            args.property,
            args.material_type,
            metadata
        )
        
        # Create trainer
        trainer = PropertyModelTrainer(
            dataset,
            args.output_dir,
            args.model_type,
            args.epochs,
            args.batch_size,
            args.learning_rate,
            args.validation_split,
            args.augmentation,
            args.transfer_learning,
            args.base_model
        )
        
        # Train model
        result = trainer.train()
        
        # Add property metadata to result
        result['propertyMetadata'] = {
            'fieldType': metadata.get('fieldType', ''),
            'options': metadata.get('options', []),
            'validation': metadata.get('validation', {}),
            'unit': metadata.get('unit', '')
        }
        
        # Print result as JSON
        print(json.dumps(result))
        
    except Exception as e:
        logger.error(f"Error in training: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
