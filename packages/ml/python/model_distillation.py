#!/usr/bin/env python3
"""
Knowledge Distillation Pipeline for Model Compression

This module implements a teacher-student knowledge distillation framework 
for compressing larger models into smaller, more efficient models while 
maintaining performance. It supports:

1. Teacher-student architecture for transferring knowledge
2. Temperature-scaled distillation loss
3. Progressive distillation process
4. Integration with TensorFlow and PyTorch frameworks
"""

import os
import time
import logging
import numpy as np
from typing import Dict, List, Tuple, Union, Optional, Any, Callable
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('model_distillation')

# Try to import TensorFlow
try:
    import tensorflow as tf
    TF_AVAILABLE = True
except ImportError:
    logger.warning("TensorFlow not available. TensorFlow-based distillation will be disabled.")
    TF_AVAILABLE = False

# Try to import PyTorch
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    TORCH_AVAILABLE = True
except ImportError:
    logger.warning("PyTorch not available. PyTorch-based distillation will be disabled.")
    TORCH_AVAILABLE = False


# ---- Distillation Losses ----

class DistillationLosses:
    """
    Collection of knowledge distillation loss functions for different frameworks.
    """
    
    @staticmethod
    def tf_knowledge_distillation_loss(student_logits, teacher_logits, temperature=1.0, alpha=0.5):
        """
        Knowledge distillation loss for TensorFlow models.
        
        Args:
            student_logits: Logits from the student model
            teacher_logits: Logits from the teacher model
            temperature: Temperature for softening the distributions
            alpha: Weight for balancing distillation and standard loss
            
        Returns:
            Distillation loss function that can be used in model compilation
        """
        if not TF_AVAILABLE:
            raise ImportError("TensorFlow is not available")
        
        def distillation_loss(y_true, y_pred):
            # Standard cross-entropy loss with true labels
            y_true_one_hot = tf.one_hot(tf.cast(y_true, tf.int32), depth=y_pred.shape[-1])
            ce_loss = tf.keras.losses.categorical_crossentropy(
                y_true_one_hot, y_pred, from_logits=True
            )
            
            # Soft targets from teacher
            teacher_prob = tf.nn.softmax(teacher_logits / temperature, axis=-1)
            student_prob = tf.nn.softmax(student_logits / temperature, axis=-1)
            
            # KL divergence loss
            kl_loss = tf.keras.losses.kullback_leibler_divergence(teacher_prob, student_prob)
            kl_loss = kl_loss * (temperature ** 2)
            
            # Combined loss
            return alpha * ce_loss + (1 - alpha) * kl_loss
        
        return distillation_loss
    
    @staticmethod
    def torch_knowledge_distillation_loss(student_logits, teacher_logits, targets, temperature=1.0, alpha=0.5):
        """
        Knowledge distillation loss for PyTorch models.
        
        Args:
            student_logits: Logits from the student model
            teacher_logits: Logits from the teacher model
            targets: Ground truth labels
            temperature: Temperature for softening the distributions
            alpha: Weight for balancing distillation and standard loss
            
        Returns:
            Combined distillation loss
        """
        if not TORCH_AVAILABLE:
            raise ImportError("PyTorch is not available")
        
        # Standard cross-entropy loss with true labels
        ce_loss = F.cross_entropy(student_logits, targets)
        
        # Soft targets from teacher
        teacher_prob = F.softmax(teacher_logits / temperature, dim=-1)
        student_prob = F.softmax(student_logits / temperature, dim=-1)
        
        # KL divergence loss
        kl_loss = F.kl_div(
            F.log_softmax(student_logits / temperature, dim=-1),
            teacher_prob,
            reduction='batchmean'
        ) * (temperature ** 2)
        
        # Combined loss
        return alpha * ce_loss + (1 - alpha) * kl_loss
    
    @staticmethod
    def tf_feature_distillation_loss(student_features, teacher_features, weights=None):
        """
        Feature-level distillation loss for TensorFlow models.
        
        Args:
            student_features: Feature maps from the student model
            teacher_features: Feature maps from the teacher model
            weights: Optional weights for different feature maps
            
        Returns:
            Feature distillation loss
        """
        if not TF_AVAILABLE:
            raise ImportError("TensorFlow is not available")
        
        if isinstance(student_features, list) and isinstance(teacher_features, list):
            # Handle multiple feature maps
            if weights is None:
                weights = [1.0] * len(student_features)
            
            total_loss = 0.0
            for s_feat, t_feat, w in zip(student_features, teacher_features, weights):
                # Normalize features
                s_feat = tf.nn.l2_normalize(s_feat, axis=-1)
                t_feat = tf.nn.l2_normalize(t_feat, axis=-1)
                
                # MSE loss between normalized features
                loss = tf.reduce_mean(tf.square(s_feat - t_feat))
                total_loss += w * loss
            
            return total_loss / sum(weights)
        else:
            # Single feature map
            # Normalize features
            student_features = tf.nn.l2_normalize(student_features, axis=-1)
            teacher_features = tf.nn.l2_normalize(teacher_features, axis=-1)
            
            # MSE loss between normalized features
            return tf.reduce_mean(tf.square(student_features - teacher_features))
    
    @staticmethod
    def torch_feature_distillation_loss(student_features, teacher_features, weights=None):
        """
        Feature-level distillation loss for PyTorch models.
        
        Args:
            student_features: Feature maps from the student model
            teacher_features: Feature maps from the teacher model
            weights: Optional weights for different feature maps
            
        Returns:
            Feature distillation loss
        """
        if not TORCH_AVAILABLE:
            raise ImportError("PyTorch is not available")
        
        if isinstance(student_features, list) and isinstance(teacher_features, list):
            # Handle multiple feature maps
            if weights is None:
                weights = [1.0] * len(student_features)
            
            total_loss = 0.0
            for s_feat, t_feat, w in zip(student_features, teacher_features, weights):
                # Normalize features
                s_feat = F.normalize(s_feat, p=2, dim=1)
                t_feat = F.normalize(t_feat, p=2, dim=1)
                
                # MSE loss between normalized features
                loss = torch.mean((s_feat - t_feat) ** 2)
                total_loss += w * loss
            
            return total_loss / sum(weights)
        else:
            # Single feature map
            # Normalize features
            student_features = F.normalize(student_features, p=2, dim=1)
            teacher_features = F.normalize(teacher_features, p=2, dim=1)
            
            # MSE loss between normalized features
            return torch.mean((student_features - teacher_features) ** 2)
    
    @staticmethod
    def tf_attention_transfer_loss(student_attention, teacher_attention, beta=1.0):
        """
        Attention transfer loss for TensorFlow models.
        
        Args:
            student_attention: Attention maps from the student model
            teacher_attention: Attention maps from the teacher model
            beta: Weight for the attention transfer loss
            
        Returns:
            Attention transfer loss
        """
        if not TF_AVAILABLE:
            raise ImportError("TensorFlow is not available")
        
        if isinstance(student_attention, list) and isinstance(teacher_attention, list):
            # Handle multiple attention maps
            total_loss = 0.0
            for s_att, t_att in zip(student_attention, teacher_attention):
                # Normalize attention maps
                s_att = tf.nn.l2_normalize(tf.reduce_sum(tf.abs(s_att), axis=1), axis=None)
                t_att = tf.nn.l2_normalize(tf.reduce_sum(tf.abs(t_att), axis=1), axis=None)
                
                # L2 loss between normalized attention maps
                loss = tf.reduce_mean(tf.square(s_att - t_att))
                total_loss += loss
            
            return beta * (total_loss / len(student_attention))
        else:
            # Single attention map
            # Normalize attention maps
            student_attention = tf.nn.l2_normalize(tf.reduce_sum(tf.abs(student_attention), axis=1), axis=None)
            teacher_attention = tf.nn.l2_normalize(tf.reduce_sum(tf.abs(teacher_attention), axis=1), axis=None)
            
            # L2 loss between normalized attention maps
            return beta * tf.reduce_mean(tf.square(student_attention - teacher_attention))
    
    @staticmethod
    def torch_attention_transfer_loss(student_attention, teacher_attention, beta=1.0):
        """
        Attention transfer loss for PyTorch models.
        
        Args:
            student_attention: Attention maps from the student model
            teacher_attention: Attention maps from the teacher model
            beta: Weight for the attention transfer loss
            
        Returns:
            Attention transfer loss
        """
        if not TORCH_AVAILABLE:
            raise ImportError("PyTorch is not available")
        
        if isinstance(student_attention, list) and isinstance(teacher_attention, list):
            # Handle multiple attention maps
            total_loss = 0.0
            for s_att, t_att in zip(student_attention, teacher_attention):
                # Normalize attention maps
                s_att = F.normalize(torch.sum(torch.abs(s_att), dim=1).view(s_att.size(0), -1), p=2, dim=1)
                t_att = F.normalize(torch.sum(torch.abs(t_att), dim=1).view(t_att.size(0), -1), p=2, dim=1)
                
                # L2 loss between normalized attention maps
                loss = torch.mean((s_att - t_att) ** 2)
                total_loss += loss
            
            return beta * (total_loss / len(student_attention))
        else:
            # Single attention map
            # Normalize attention maps
            student_attention = F.normalize(torch.sum(torch.abs(student_attention), dim=1).view(student_attention.size(0), -1), p=2, dim=1)
            teacher_attention = F.normalize(torch.sum(torch.abs(teacher_attention), dim=1).view(teacher_attention.size(0), -1), p=2, dim=1)
            
            # L2 loss between normalized attention maps
            return beta * torch.mean((student_attention - teacher_attention) ** 2)


# ---- TensorFlow Implementation ----

class TensorFlowDistiller:
    """
    Knowledge distillation implementation for TensorFlow models.
    """
    
    def __init__(self, teacher_model, student_model, temperature=5.0, alpha=0.5, 
                 use_feature_distillation=False, use_attention_transfer=False):
        """
        Initialize the TensorFlow distiller.
        
        Args:
            teacher_model: Pre-trained teacher model
            student_model: Student model to be trained
            temperature: Temperature for softening the distributions
            alpha: Weight for balancing distillation and standard loss
            use_feature_distillation: Whether to use feature-level distillation
            use_attention_transfer: Whether to use attention transfer
        """
        if not TF_AVAILABLE:
            raise ImportError("TensorFlow is not available")
        
        self.teacher_model = teacher_model
        self.student_model = student_model
        self.temperature = temperature
        self.alpha = alpha
        self.use_feature_distillation = use_feature_distillation
        self.use_attention_transfer = use_attention_transfer
        
        # Make teacher model non-trainable
        self.teacher_model.trainable = False
    
    def compile_distillation_model(self, optimizer, metrics=None, feature_distill_weight=0.1, 
                                  attention_transfer_weight=0.1):
        """
        Compile the distillation model with appropriate loss functions.
        
        Args:
            optimizer: Optimizer for training
            metrics: Metrics for evaluating the model
            feature_distill_weight: Weight for feature distillation loss
            attention_transfer_weight: Weight for attention transfer loss
            
        Returns:
            Compiled student model
        """
        # Create input layers
        inputs = tf.keras.layers.Input(shape=self.student_model.input_shape[1:])
        
        # Get teacher predictions
        teacher_preds = self.teacher_model(inputs, training=False)
        
        # Get student predictions
        student_preds = self.student_model(inputs)
        
        # Create distillation loss
        distill_loss_fn = DistillationLosses.tf_knowledge_distillation_loss(
            student_preds, teacher_preds, self.temperature, self.alpha
        )
        
        # Configure metrics
        metrics = metrics or ['accuracy']
        
        # Compile the student model with the distillation loss
        self.student_model.compile(
            optimizer=optimizer,
            loss=distill_loss_fn,
            metrics=metrics
        )
        
        return self.student_model
    
    def create_model_with_intermediate_outputs(self, model, layer_names):
        """
        Create a model that outputs intermediate layer activations.
        
        Args:
            model: The model
            layer_names: Names of layers to extract outputs from
            
        Returns:
            Model with multiple outputs
        """
        # Get the specified layers
        layers = [model.get_layer(name) for name in layer_names]
        
        # Create a new model with multiple outputs
        return tf.keras.Model(
            inputs=model.input,
            outputs=[model.output] + [layer.output for layer in layers]
        )
    
    def train_with_feature_distillation(self, train_data, valid_data=None, epochs=10, 
                                       teacher_feature_layers=None, student_feature_layers=None,
                                       feature_weights=None, callbacks=None):
        """
        Train the student model with feature-level distillation.
        
        Args:
            train_data: Training data
            valid_data: Validation data (optional)
            epochs: Number of training epochs
            teacher_feature_layers: Names of teacher layers to extract features from
            student_feature_layers: Names of student layers to extract features from
            feature_weights: Weights for different feature layers
            callbacks: Training callbacks
            
        Returns:
            Training history
        """
        if not self.use_feature_distillation:
            logger.warning("Feature distillation is disabled. Using standard distillation.")
            return self.train(train_data, valid_data, epochs, callbacks)
        
        # Default feature layers if not specified
        teacher_feature_layers = teacher_feature_layers or ["block_5_add", "block_12_add"]
        student_feature_layers = student_feature_layers or ["block_3_add", "block_6_add"]
        
        # Create models with intermediate outputs
        teacher_with_features = self.create_model_with_intermediate_outputs(
            self.teacher_model, teacher_feature_layers
        )
        student_with_features = self.create_model_with_intermediate_outputs(
            self.student_model, student_feature_layers
        )
        
        # Define training step with feature distillation
        @tf.function
        def train_step(x, y):
            with tf.GradientTape() as tape:
                # Get teacher outputs
                teacher_outputs = teacher_with_features(x, training=False)
                teacher_pred = teacher_outputs[0]
                teacher_features = teacher_outputs[1:]
                
                # Get student outputs
                student_outputs = student_with_features(x, training=True)
                student_pred = student_outputs[0]
                student_features = student_outputs[1:]
                
                # Calculate standard distillation loss
                distill_loss = DistillationLosses.tf_knowledge_distillation_loss(
                    student_pred, teacher_pred, self.temperature, self.alpha
                )(y, student_pred)
                
                # Calculate feature distillation loss
                feature_loss = DistillationLosses.tf_feature_distillation_loss(
                    student_features, teacher_features, feature_weights
                )
                
                # Combined loss
                total_loss = distill_loss + 0.1 * feature_loss
            
            # Apply gradients
            gradients = tape.gradient(total_loss, self.student_model.trainable_variables)
            self.student_model.optimizer.apply_gradients(
                zip(gradients, self.student_model.trainable_variables)
            )
            
            return total_loss
        
        # Custom training loop
        for epoch in range(epochs):
            logger.info(f"Epoch {epoch+1}/{epochs}")
            
            # Training
            start_time = time.time()
            total_loss = 0
            num_batches = 0
            
            for x_batch, y_batch in train_data:
                batch_loss = train_step(x_batch, y_batch)
                total_loss += batch_loss
                num_batches += 1
            
            avg_loss = total_loss / num_batches
            time_taken = time.time() - start_time
            
            logger.info(f"Training loss: {avg_loss:.4f}, Time: {time_taken:.2f}s")
            
            # Validation
            if valid_data is not None:
                valid_loss = 0
                valid_batches = 0
                
                for x_batch, y_batch in valid_data:
                    # Get teacher outputs
                    teacher_outputs = teacher_with_features(x_batch, training=False)
                    teacher_pred = teacher_outputs[0]
                    teacher_features = teacher_outputs[1:]
                    
                    # Get student outputs
                    student_outputs = student_with_features(x_batch, training=False)
                    student_pred = student_outputs[0]
                    student_features = student_outputs[1:]
                    
                    # Calculate standard distillation loss
                    distill_loss = DistillationLosses.tf_knowledge_distillation_loss(
                        student_pred, teacher_pred, self.temperature, self.alpha
                    )(y_batch, student_pred)
                    
                    # Calculate feature distillation loss
                    feature_loss = DistillationLosses.tf_feature_distillation_loss(
                        student_features, teacher_features, feature_weights
                    )
                    
                    # Combined loss
                    batch_loss = distill_loss + 0.1 * feature_loss
                    valid_loss += batch_loss
                    valid_batches += 1
                
                avg_valid_loss = valid_loss / valid_batches
                logger.info(f"Validation loss: {avg_valid_loss:.4f}")
        
        return self.student_model
    
    def train(self, train_data, valid_data=None, epochs=10, callbacks=None):
        """
        Train the student model with standard knowledge distillation.
        
        Args:
            train_data: Training data
            valid_data: Validation data (optional)
            epochs: Number of training epochs
            callbacks: Training callbacks
            
        Returns:
            Training history
        """
        # Train the student model
        history = self.student_model.fit(
            train_data,
            validation_data=valid_data,
            epochs=epochs,
            callbacks=callbacks
        )
        
        return history
    
    def evaluate(self, test_data):
        """
        Evaluate the distilled student model.
        
        Args:
            test_data: Test dataset
            
        Returns:
            Evaluation metrics
        """
        return self.student_model.evaluate(test_data)
    
    def save_student_model(self, save_path):
        """
        Save the distilled student model.
        
        Args:
            save_path: Path to save the model
            
        Returns:
            Path to the saved model
        """
        self.student_model.save(save_path)
        logger.info(f"Distilled student model saved to {save_path}")
        return save_path
    
    def progressive_distillation(self, train_data, valid_data=None, num_stages=3, 
                               epochs_per_stage=5, reduction_factor=0.5, callbacks=None):
        """
        Perform progressive distillation with gradual model compression.
        
        Args:
            train_data: Training data
            valid_data: Validation data (optional)
            num_stages: Number of distillation stages
            epochs_per_stage: Number of epochs per stage
            reduction_factor: Factor to reduce model size at each stage
            callbacks: Training callbacks
            
        Returns:
            Final distilled student model
        """
        # Start with the teacher model
        current_model = self.teacher_model
        
        for stage in range(num_stages):
            logger.info(f"Progressive Distillation Stage {stage+1}/{num_stages}")
            
            # Create a smaller student model
            # In a real implementation, this would create a new, smaller model architecture
            # Here we'll just use the existing student model for simplicity
            student_model = self.student_model
            
            # Create a distiller for this stage
            stage_distiller = TensorFlowDistiller(
                teacher_model=current_model,
                student_model=student_model,
                temperature=self.temperature,
                alpha=self.alpha,
                use_feature_distillation=self.use_feature_distillation
            )
            
            # Compile the student model
            stage_distiller.compile_distillation_model(
                optimizer=tf.keras.optimizers.Adam(learning_rate=0.001 * (0.8 ** stage))
            )
            
            # Train the student model
            if self.use_feature_distillation:
                stage_distiller.train_with_feature_distillation(
                    train_data=train_data,
                    valid_data=valid_data,
                    epochs=epochs_per_stage,
                    callbacks=callbacks
                )
            else:
                stage_distiller.train(
                    train_data=train_data,
                    valid_data=valid_data,
                    epochs=epochs_per_stage,
                    callbacks=callbacks
                )
            
            # Use the student model as the teacher for the next stage
            current_model = student_model
        
        # Return the final distilled model
        return current_model


# ---- PyTorch Implementation ----

class PyTorchDistiller:
    """
    Knowledge distillation implementation for PyTorch models.
    """
    
    def __init__(self, teacher_model, student_model, temperature=5.0, alpha=0.5,
                use_feature_distillation=False, use_attention_transfer=False,
                device=None):
        """
        Initialize the PyTorch distiller.
        
        Args:
            teacher_model: Pre-trained teacher model
            student_model: Student model to be trained
            temperature: Temperature for softening the distributions
            alpha: Weight for balancing distillation and standard loss
            use_feature_distillation: Whether to use feature-level distillation
            use_attention_transfer: Whether to use attention transfer
            device: Device to run the models on (cpu or cuda)
        """
        if not TORCH_AVAILABLE:
            raise ImportError("PyTorch is not available")
        
        self.teacher_model = teacher_model
        self.student_model = student_model
        self.temperature = temperature
        self.alpha = alpha
        self.use_feature_distillation = use_feature_distillation
        self.use_attention_transfer = use_attention_transfer
        
        # Set device
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.teacher_model.to(self.device)
        self.student_model.to(self.device)
        
        # Set teacher model to evaluation mode
        self.teacher_model.eval()
        
        # Feature layers for distillation
        self.teacher_feature_layers = []
        self.student_feature_layers = []
    
    def register_feature_hooks(self, teacher_layer_names, student_layer_names):
        """
        Register hooks to extract features from specific layers.
        
        Args:
            teacher_layer_names: Names of teacher layers to extract features from
            student_layer_names: Names of student layers to extract features from
        """
        self.teacher_features = {}
        self.student_features = {}
        
        # Register hooks for teacher model
        for name, module in self.teacher_model.named_modules():
            if name in teacher_layer_names:
                self.teacher_feature_layers.append(name)
                
                def get_teacher_feature_hook(name):
                    def hook(module, input, output):
                        self.teacher_features[name] = output
                    return hook
                
                module.register_forward_hook(get_teacher_feature_hook(name))
        
        # Register hooks for student model
        for name, module in self.student_model.named_modules():
            if name in student_layer_names:
                self.student_feature_layers.append(name)
                
                def get_student_feature_hook(name):
                    def hook(module, input, output):
                        self.student_features[name] = output
                    return hook
                
                module.register_forward_hook(get_student_feature_hook(name))
    
    def train_epoch(self, train_loader, optimizer, epoch, feature_weight=0.1,
                   log_interval=10):
        """
        Train the student model for one epoch.
        
        Args:
            train_loader: DataLoader for training data
            optimizer: Optimizer for training
            epoch: Current epoch number
            feature_weight: Weight for feature distillation loss
            log_interval: Interval for logging progress
            
        Returns:
            Average loss for the epoch
        """
        self.student_model.train()
        self.teacher_model.eval()
        
        total_loss = 0
        correct = 0
        total = 0
        
        for batch_idx, (data, target) in enumerate(train_loader):
            data, target = data.to(self.device), target.to(self.device)
            
            optimizer.zero_grad()
            
            # Forward pass through teacher model
            with torch.no_grad():
                teacher_logits = self.teacher_model(data)
            
            # Forward pass through student model
            student_logits = self.student_model(data)
            
            # Calculate standard distillation loss
            distill_loss = DistillationLosses.torch_knowledge_distillation_loss(
                student_logits, teacher_logits, target, self.temperature, self.alpha
            )
            
            # Calculate feature distillation loss if enabled
            feature_loss = 0.0
            if self.use_feature_distillation and self.teacher_feature_layers and self.student_feature_layers:
                teacher_features = [self.teacher_features[name] for name in self.teacher_feature_layers]
                student_features = [self.student_features[name] for name in self.student_feature_layers]
                
                feature_loss = DistillationLosses.torch_feature_distillation_loss(
                    student_features, teacher_features
                )
            
            # Calculate attention transfer loss if enabled
            attention_loss = 0.0
            if self.use_attention_transfer and self.teacher_feature_layers and self.student_feature_layers:
                # For simplicity, we'll use the same features for attention transfer
                attention_loss = DistillationLosses.torch_attention_transfer_loss(
                    student_features, teacher_features
                )
            
            # Combined loss
            loss = distill_loss + feature_weight * feature_loss + 0.1 * attention_loss
            
            # Backward pass and optimization
            loss.backward()
            optimizer.step()
            
            # Update statistics
            total_loss += loss.item()
            
            # Calculate accuracy
            _, predicted = student_logits.max(1)
            total += target.size(0)
            correct += predicted.eq(target).sum().item()
            
            # Log progress
            if batch_idx % log_interval == 0:
                accuracy = 100.0 * correct / total
                logger.info(f'Epoch: {epoch} [{batch_idx * len(data)}/{len(train_loader.dataset)} '
                           f'({100. * batch_idx / len(train_loader):.0f}%)]\t'
                           f'Loss: {loss.item():.6f}\t'
                           f'Accuracy: {accuracy:.2f}%')
        
        # Calculate average loss
        avg_loss = total_loss / len(train_loader)
        accuracy = 100.0 * correct / total
        
        logger.info(f'Epoch: {epoch}\t'
                   f'Average Loss: {avg_loss:.6f}\t'
                   f'Accuracy: {accuracy:.2f}%')
        
        return avg_loss
    
    def validate(self, valid_loader):
        """
        Validate the student model.
        
        Args:
            valid_loader: DataLoader for validation data
            
        Returns:
            Validation loss and accuracy
        """
        self.student_model.eval()
        valid_loss = 0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for data, target in valid_loader:
                data, target = data.to(self.device), target.to(self.device)
                
                # Forward pass through teacher model
                teacher_logits = self.teacher_model(data)
                
                # Forward pass through student model
                student_logits = self.student_model(data)
                
                # Calculate standard distillation loss
                loss = DistillationLosses.torch_knowledge_distillation_loss(
                    student_logits, teacher_logits, target, self.temperature, self.alpha
                )
                
                valid_loss += loss.item()
                
                # Calculate accuracy
                _, predicted = student_logits.max(1)
                total += target.size(0)
                correct += predicted.eq(target).sum().item()
        
        # Calculate average loss and accuracy
        avg_loss = valid_loss / len(valid_loader)
        accuracy = 100.0 * correct / total
        
        logger.info(f'Validation:\t'
                   f'Average Loss: {avg_loss:.6f}\t'
                   f'Accuracy: {accuracy:.2f}%')
        
        return avg_loss, accuracy
    
    def train(self, train_loader, valid_loader=None, epochs=10, lr=0.001,
             feature_weight=0.1, lr_scheduler=None, early_stopping_patience=None,
             save_best=True, save_path=None):
        """
        Train the student model with knowledge distillation.
        
        Args:
            train_loader: DataLoader for training data
            valid_loader: DataLoader for validation data (optional)
            epochs: Number of training epochs
            lr: Learning rate
            feature_weight: Weight for feature distillation loss
            lr_scheduler: Learning rate scheduler (optional)
            early_stopping_patience: Patience for early stopping (optional)
            save_best: Whether to save the best model
            save_path: Path to save the best model
            
        Returns:
            Trained student model and training history
        """
        # Initialize optimizer
        optimizer = torch.optim.Adam(self.student_model.parameters(), lr=lr)
        
        # Initialize learning rate scheduler if specified
        scheduler = None
        if lr_scheduler == 'reduce_on_plateau' and valid_loader:
            scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
                optimizer, mode='min', factor=0.5, patience=5, verbose=True
            )
        elif lr_scheduler == 'cosine_annealing':
            scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
                optimizer, T_max=epochs
            )
        
        # Initialize early stopping if specified
        early_stopping_counter = 0
        best_valid_loss = float('inf')
        
        # Training history
        history = {
            'train_loss': [],
            'valid_loss': [],
            'valid_accuracy': []
        }
        
        # Train for specified number of epochs
        for epoch in range(1, epochs + 1):
            # Train for one epoch
            train_loss = self.train_epoch(
                train_loader, optimizer, epoch, feature_weight
            )
            history['train_loss'].append(train_loss)
            
            # Validate if validation data is provided
            if valid_loader:
                valid_loss, valid_accuracy = self.validate(valid_loader)
                history['valid_loss'].append(valid_loss)
                history['valid_accuracy'].append(valid_accuracy)
                
                # Update learning rate scheduler if using ReduceLROnPlateau
                if scheduler and lr_scheduler == 'reduce_on_plateau':
                    scheduler.step(valid_loss)
                
                # Check for early stopping
                if early_stopping_patience:
                    if valid_loss < best_valid_loss:
                        best_valid_loss = valid_loss
                        early_stopping_counter = 0
                        
                        # Save best model if specified
                        if save_best and save_path:
                            self.save_student_model(save_path)
                    else:
                        early_stopping_counter += 1
                        if early_stopping_counter >= early_stopping_patience:
                            logger.info(f'Early stopping at epoch {epoch}')
                            break
            
            # Update learning rate scheduler if using CosineAnnealingLR
            if scheduler and lr_scheduler == 'cosine_annealing':
                scheduler.step()
        
        return self.student_model, history
    
    def save_student_model(self, save_path):
        """
        Save the distilled student model.
        
        Args:
            save_path: Path to save the model
            
        Returns:
            Path to the saved model
        """
        # Create directory if it doesn't exist
        save_dir = os.path.dirname(save_path)
        if save_dir and not os.path.exists(save_dir):
            os.makedirs(save_dir)
        
        # Save model
        torch.save(self.student_model.state_dict(), save_path)
        logger.info(f"Distilled student model saved to {save_path}")
        return save_path
    
    def progressive_distillation(self, train_loader, valid_loader=None, num_stages=3,
                               epochs_per_stage=5, lr=0.001, feature_weight=0.1,
                               save_path=None):
        """
        Perform progressive distillation with gradual model compression.
        
        Args:
            train_loader: DataLoader for training data
            valid_loader: DataLoader for validation data (optional)
            num_stages: Number of distillation stages
            epochs_per_stage: Number of epochs per stage
            lr: Initial learning rate
            feature_weight: Weight for feature distillation loss
            save_path: Base path to save intermediate models
            
        Returns:
            Final distilled student model and training history
        """
        # Start with the teacher model
        current_model = self.teacher_model
        
        # Create a clone of the student model architecture
        student_model = self.student_model
        
        # Training history
        history = {
            'stage_train_loss': [],
            'stage_valid_loss': [],
            'stage_valid_accuracy': []
        }
        
        for stage in range(num_stages):
            logger.info(f"Progressive Distillation Stage {stage+1}/{num_stages}")
            
            # Create a distiller for this stage
            stage_distiller = PyTorchDistiller(
                teacher_model=current_model,
                student_model=student_model,
                temperature=self.temperature * (0.8 ** stage),  # Gradually reduce temperature
                alpha=self.alpha,
                use_feature_distillation=self.use_feature_distillation,
                use_attention_transfer=self.use_attention_transfer,
                device=self.device
            )
            
            # Register feature hooks if using feature distillation
            if self.use_feature_distillation:
                # This is a simplified example - in a real implementation,
                # you would map appropriate layers between teacher and student
                teacher_layers = [f"layer{i}" for i in range(1, 4)]
                student_layers = [f"layer{i}" for i in range(1, 4)]
                stage_distiller.register_feature_hooks(teacher_layers, student_layers)
            
            # Train the student model
            _, stage_history = stage_distiller.train(
                train_loader=train_loader,
                valid_loader=valid_loader,
                epochs=epochs_per_stage,
                lr=lr * (0.8 ** stage),  # Gradually reduce learning rate
                feature_weight=feature_weight,
                lr_scheduler='cosine_annealing',
                save_path=f"{save_path}_stage{stage+1}.pt" if save_path else None
            )
            
            # Update history
            history['stage_train_loss'].append(stage_history['train_loss'])
            if valid_loader:
                history['stage_valid_loss'].append(stage_history['valid_loss'])
                history['stage_valid_accuracy'].append(stage_history['valid_accuracy'])
            
            # Use the student model as the teacher for the next stage
            current_model = student_model
            
            # Create a smaller student model for the next stage
            # In a real implementation, this would create a new, smaller model architecture
            # Here we'll just use the same architecture for simplicity
            if stage < num_stages - 1:
                student_model = type(self.student_model)()  # Create a new instance
                student_model.to(self.device)
        
        # Return the final distilled model
        return current_model, history


# ---- Unified API for Model Distillation ----

class ModelDistiller:
    """
    Unified API for model distillation that works with both TensorFlow and PyTorch.
    """
    
    def __init__(self, framework=None):
        """
        Initialize the model distiller.
        
        Args:
            framework: The framework to use ("tensorflow", "pytorch", or None for auto-detect)
        """
        self.framework = framework
        
        # Auto-detect framework if not specified
        if self.framework is None:
            if TF_AVAILABLE and TORCH_AVAILABLE:
                logger.warning("Both TensorFlow and PyTorch are available. Please specify the framework.")
                logger.warning("Defaulting to TensorFlow.")
                self.framework = "tensorflow"
            elif TF_AVAILABLE:
                self.framework = "tensorflow"
            elif TORCH_AVAILABLE:
                self.framework = "pytorch"
            else:
                raise ImportError("Neither TensorFlow nor PyTorch is available.")
        
        # Validate framework
        if self.framework not in ["tensorflow", "pytorch"]:
            raise ValueError(f"Unsupported framework: {self.framework}")
        
        # Check framework availability
        if self.framework == "tensorflow" and not TF_AVAILABLE:
            raise ImportError("TensorFlow is not available.")
        elif self.framework == "pytorch" and not TORCH_AVAILABLE:
            raise ImportError("PyTorch is not available.")
        
        logger.info(f"Using {self.framework} framework for model distillation.")
    
    def distill(self, teacher_model, student_model, train_data, valid_data=None, 
               temperature=5.0, alpha=0.5, use_feature_distillation=False,
               use_attention_transfer=False, epochs=10, lr=0.001,
               feature_weight=0.1, save_path=None):
        """
        Distill knowledge from a teacher model to a student model.
        
        Args:
            teacher_model: Pre-trained teacher model
            student_model: Student model to be trained
            train_data: Training data
            valid_data: Validation data (optional)
            temperature: Temperature for softening the distributions
            alpha: Weight for balancing distillation and standard loss
            use_feature_distillation: Whether to use feature-level distillation
            use_attention_transfer: Whether to use attention transfer
            epochs: Number of training epochs
            lr: Learning rate (for PyTorch)
            feature_weight: Weight for feature distillation loss
            save_path: Path to save the best model
            
        Returns:
            Trained student model and training history
        """
        if self.framework == "tensorflow":
            # Create TensorFlow distiller
            distiller = TensorFlowDistiller(
                teacher_model=teacher_model,
                student_model=student_model,
                temperature=temperature,
                alpha=alpha,
                use_feature_distillation=use_feature_distillation,
                use_attention_transfer=use_attention_transfer
            )
            
            # Compile the model
            distiller.compile_distillation_model(
                optimizer=tf.keras.optimizers.Adam(learning_rate=lr)
            )
            
            # Train the model
            if use_feature_distillation:
                history = distiller.train_with_feature_distillation(
                    train_data=train_data,
                    valid_data=valid_data,
                    epochs=epochs
                )
            else:
                history = distiller.train(
                    train_data=train_data,
                    valid_data=valid_data,
                    epochs=epochs
                )
            
            # Save the model if specified
            if save_path:
                distiller.save_student_model(save_path)
            
            return student_model, history
        
        elif self.framework == "pytorch":
            # Create PyTorch distiller
            distiller = PyTorchDistiller(
                teacher_model=teacher_model,
                student_model=student_model,
                temperature=temperature,
                alpha=alpha,
                use_feature_distillation=use_feature_distillation,
                use_attention_transfer=use_attention_transfer
            )
            
            # Register feature hooks if using feature distillation
            if use_feature_distillation:
                # This is a simplified example - in a real implementation,
                # you would map appropriate layers between teacher and student
                teacher_layers = ["layer1", "layer2", "layer3"]
                student_layers = ["layer1", "layer2", "layer3"]
                distiller.register_feature_hooks(teacher_layers, student_layers)
            
            # Train the model
            student_model, history = distiller.train(
                train_loader=train_data,
                valid_loader=valid_data,
                epochs=epochs,
                lr=lr,
                feature_weight=feature_weight,
                save_best=True,
                save_path=save_path
            )
            
            return student_model, history
    
    def progressive_distillation(self, teacher_model, student_model, train_data, valid_data=None,
                                num_stages=3, epochs_per_stage=5, temperature=5.0, alpha=0.5,
                                use_feature_distillation=False, lr=0.001, save_path=None):
        """
        Perform progressive distillation from a teacher model to a student model.
        
        Args:
            teacher_model: Pre-trained teacher model
            student_model: Student model to be trained
            train_data: Training data
            valid_data: Validation data (optional)
            num_stages: Number of distillation stages
            epochs_per_stage: Number of epochs per stage
            temperature: Temperature for softening the distributions
            alpha: Weight for balancing distillation and standard loss
            use_feature_distillation: Whether to use feature-level distillation
            lr: Learning rate (for PyTorch)
            save_path: Path to save intermediate models
            
        Returns:
            Trained student model and training history
        """
        if self.framework == "tensorflow":
            # Create TensorFlow distiller
            distiller = TensorFlowDistiller(
                teacher_model=teacher_model,
                student_model=student_model,
                temperature=temperature,
                alpha=alpha,
                use_feature_distillation=use_feature_distillation
            )
            
            # Perform progressive distillation
            final_model = distiller.progressive_distillation(
                train_data=train_data,
                valid_data=valid_data,
                num_stages=num_stages,
                epochs_per_stage=epochs_per_stage
            )
            
            # Save the final model if specified
            if save_path:
                final_model.save(save_path)
            
            return final_model
        
        elif self.framework == "pytorch":
            # Create PyTorch distiller
            distiller = PyTorchDistiller(
                teacher_model=teacher_model,
                student_model=student_model,
                temperature=temperature,
                alpha=alpha,
                use_feature_distillation=use_feature_distillation
            )
            
            # Perform progressive distillation
            final_model, history = distiller.progressive_distillation(
                train_loader=train_data,
                valid_loader=valid_data,
                num_stages=num_stages,
                epochs_per_stage=epochs_per_stage,
                lr=lr,
                save_path=save_path
            )
            
            return final_model, history
    
    def evaluate(self, model, test_data):
        """
        Evaluate a model on test data.
        
        Args:
            model: The model to evaluate
            test_data: Test data
            
        Returns:
            Evaluation metrics
        """
        if self.framework == "tensorflow":
            return model.evaluate(test_data)
        
        elif self.framework == "pytorch":
            model.eval()
            total = 0
            correct = 0
            
            device = next(model.parameters()).device
            
            with torch.no_grad():
                for data, target in test_data:
                    data, target = data.to(device), target.to(device)
                    output = model(data)
                    _, predicted = output.max(1)
                    total += target.size(0)
                    correct += predicted.eq(target).sum().item()
            
            accuracy = 100.0 * correct / total
            return accuracy


# ---- Example Usage ----

def tensorflow_example():
    """Example usage with TensorFlow models"""
    if not TF_AVAILABLE:
        logger.error("TensorFlow is not available. Skipping example.")
        return
    
    # Create dummy data for demonstration
    num_classes = 10
    input_shape = (32, 32, 3)
    
    # Create a simple teacher model
    teacher_model = tf.keras.Sequential([
        tf.keras.layers.Conv2D(64, (3, 3), activation='relu', padding='same', input_shape=input_shape),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.MaxPooling2D((2, 2)),
        tf.keras.layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.MaxPooling2D((2, 2)),
        tf.keras.layers.Conv2D(256, (3, 3), activation='relu', padding='same'),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.MaxPooling2D((2, 2)),
        tf.keras.layers.Flatten(),
        tf.keras.layers.Dense(512, activation='relu'),
        tf.keras.layers.Dropout(0.5),
        tf.keras.layers.Dense(num_classes)
    ])
    
    # Compile and pretrain the teacher model
    teacher_model.compile(
        optimizer=tf.keras.optimizers.Adam(),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True),
        metrics=['accuracy']
    )
    
    # Create a simple student model
    student_model = tf.keras.Sequential([
        tf.keras.layers.Conv2D(32, (3, 3), activation='relu', padding='same', input_shape=input_shape),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.MaxPooling2D((2, 2)),
        tf.keras.layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.MaxPooling2D((2, 2)),
        tf.keras.layers.Flatten(),
        tf.keras.layers.Dense(128, activation='relu'),
        tf.keras.layers.Dropout(0.5),
        tf.keras.layers.Dense(num_classes)
    ])
    
    # Create a distiller
    distiller = ModelDistiller(framework="tensorflow")
    
    logger.info("TensorFlow distillation example complete.")


def pytorch_example():
    """Example usage with PyTorch models"""
    if not TORCH_AVAILABLE:
        logger.error("PyTorch is not available. Skipping example.")
        return
    
    # Define a simple teacher model
    class TeacherModel(nn.Module):
        def __init__(self):
            super(TeacherModel, self).__init__()
            self.conv1 = nn.Conv2d(3, 64, kernel_size=3, padding=1)
            self.bn1 = nn.BatchNorm2d(64)
            self.conv2 = nn.Conv2d(64, 128, kernel_size=3, padding=1)
            self.bn2 = nn.BatchNorm2d(128)
            self.conv3 = nn.Conv2d(128, 256, kernel_size=3, padding=1)
            self.bn3 = nn.BatchNorm2d(256)
            self.pool = nn.MaxPool2d(2, 2)
            self.fc1 = nn.Linear(256 * 4 * 4, 512)
            self.fc2 = nn.Linear(512, 10)
        
        def forward(self, x):
            x = F.relu(self.bn1(self.conv1(x)))
            x = self.pool(x)
            x = F.relu(self.bn2(self.conv2(x)))
            x = self.pool(x)
            x = F.relu(self.bn3(self.conv3(x)))
            x = self.pool(x)
            x = x.view(-1, 256 * 4 * 4)
            x = F.relu(self.fc1(x))
            x = self.fc2(x)
            return x
    
    # Define a simple student model
    class StudentModel(nn.Module):
        def __init__(self):
            super(StudentModel, self).__init__()
            self.conv1 = nn.Conv2d(3, 32, kernel_size=3, padding=1)
            self.bn1 = nn.BatchNorm2d(32)
            self.conv2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
            self.bn2 = nn.BatchNorm2d(64)
            self.pool = nn.MaxPool2d(2, 2)
            self.fc1 = nn.Linear(64 * 8 * 8, 128)
            self.fc2 = nn.Linear(128, 10)
        
        def forward(self, x):
            x = F.relu(self.bn1(self.conv1(x)))
            x = self.pool(x)
            x = F.relu(self.bn2(self.conv2(x)))
            x = self.pool(x)
            x = x.view(-1, 64 * 8 * 8)
            x = F.relu(self.fc1(x))
            x = self.fc2(x)
            return x
    
    # Create teacher and student models
    teacher_model = TeacherModel()
    student_model = StudentModel()
    
    # Create a distiller
    distiller = ModelDistiller(framework="pytorch")
    
    logger.info("PyTorch distillation example complete.")


def main():
    """Main function to demonstrate model distillation"""
    logger.info("Model Distillation Pipeline")
    
    # Run TensorFlow example
    tensorflow_example()
    
    # Run PyTorch example
    pytorch_example()
    
    logger.info("Distillation examples completed.")


if __name__ == "__main__":
    main()