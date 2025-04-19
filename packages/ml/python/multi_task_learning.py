#!/usr/bin/env python3
"""
Multi-Task Learning Framework for Material Recognition

This module provides implementations for multi-task learning architectures:
1. Joint material classification and property prediction
2. Semantic embedding learning alongside classification
3. Auxiliary task weighting strategies
4. Task-specific loss combinations

Multi-task learning helps improve generalization by learning shared representations
across related tasks, which is particularly beneficial for material understanding.
"""

import os
import numpy as np
import logging
from typing import Dict, List, Tuple, Union, Optional, Any, Callable

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('multi_task_learning')

# Conditionally import TensorFlow or PyTorch based on availability
try:
    import tensorflow as tf
    from tensorflow.keras import layers, models, losses, optimizers
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    logger.debug("TensorFlow not available. TensorFlow-based models will be disabled.")

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.debug("PyTorch not available. PyTorch-based models will be disabled.")

# Import advanced losses
from advanced_losses import get_loss_function


# ---- Task Definition Classes ----

class MaterialTask:
    """Base class for material-related tasks"""
    
    def __init__(self, name: str, weight: float = 1.0):
        """
        Initialize a material task
        
        Args:
            name: Task name
            weight: Weight for this task in the combined loss
        """
        self.name = name
        self.weight = weight
    
    def get_loss(self, framework: str) -> Union[Any, Callable]:
        """
        Get loss function for this task
        
        Args:
            framework: 'tensorflow' or 'pytorch'
            
        Returns:
            Loss function appropriate for the framework
        """
        raise NotImplementedError("Subclasses must implement get_loss()")
    
    def get_output_size(self) -> int:
        """Get the size of the output tensor for this task"""
        raise NotImplementedError("Subclasses must implement get_output_size()")


class ClassificationTask(MaterialTask):
    """Material classification task"""
    
    def __init__(self, num_classes: int, weight: float = 1.0, 
                 loss_type: str = 'crossentropy', 
                 focal_gamma: float = 2.0, focal_alpha: float = 0.25):
        """
        Initialize classification task
        
        Args:
            num_classes: Number of material classes
            weight: Weight for this task in the combined loss
            loss_type: Type of loss ('crossentropy' or 'focal')
            focal_gamma: Focusing parameter for focal loss
            focal_alpha: Alpha parameter for focal loss
        """
        super().__init__(name="classification", weight=weight)
        self.num_classes = num_classes
        self.loss_type = loss_type
        self.focal_gamma = focal_gamma
        self.focal_alpha = focal_alpha
    
    def get_loss(self, framework: str) -> Union[Any, Callable]:
        """Get classification loss function"""
        return get_loss_function(
            loss_name=self.loss_type,
            framework=framework,
            gamma=self.focal_gamma,
            alpha=self.focal_alpha
        )
    
    def get_output_size(self) -> int:
        """Get output size (number of classes)"""
        return self.num_classes


class PropertyPredictionTask(MaterialTask):
    """Material property prediction task (regression)"""
    
    def __init__(self, properties: List[str], weight: float = 0.5):
        """
        Initialize property prediction task
        
        Args:
            properties: List of property names to predict
            weight: Weight for this task in the combined loss
        """
        super().__init__(name="property_prediction", weight=weight)
        self.properties = properties
        self.num_properties = len(properties)
    
    def get_loss(self, framework: str) -> Union[Any, Callable]:
        """Get regression loss function for property prediction"""
        if framework == 'tensorflow':
            return tf.keras.losses.MeanSquaredError() if TF_AVAILABLE else None
        elif framework == 'pytorch':
            return F.mse_loss if TORCH_AVAILABLE else None
        else:
            raise ValueError(f"Unsupported framework: {framework}")
    
    def get_output_size(self) -> int:
        """Get output size (number of properties)"""
        return self.num_properties


class EmbeddingTask(MaterialTask):
    """Semantic embedding learning task"""
    
    def __init__(self, embedding_dim: int = 128, weight: float = 0.3, 
                 use_triplet_loss: bool = True, margin: float = 0.3,
                 normalize_embeddings: bool = True):
        """
        Initialize embedding learning task
        
        Args:
            embedding_dim: Dimension of the embedding vector
            weight: Weight for this task in the combined loss
            use_triplet_loss: Whether to use triplet loss (vs. center loss)
            margin: Margin parameter for triplet loss
            normalize_embeddings: Whether to L2 normalize embeddings
        """
        super().__init__(name="embedding", weight=weight)
        self.embedding_dim = embedding_dim
        self.use_triplet_loss = use_triplet_loss
        self.margin = margin
        self.normalize_embeddings = normalize_embeddings
    
    def get_loss(self, framework: str) -> Union[Any, Callable]:
        """Get embedding loss function (triplet or center loss)"""
        if self.use_triplet_loss:
            if framework == 'tensorflow':
                return self._get_tf_triplet_loss() if TF_AVAILABLE else None
            elif framework == 'pytorch':
                return self._get_pytorch_triplet_loss() if TORCH_AVAILABLE else None
        else:
            if framework == 'tensorflow':
                return self._get_tf_center_loss() if TF_AVAILABLE else None
            elif framework == 'pytorch':
                return self._get_pytorch_center_loss() if TORCH_AVAILABLE else None
        
        raise ValueError(f"Unsupported framework: {framework}")
    
    def get_output_size(self) -> int:
        """Get output size (embedding dimension)"""
        return self.embedding_dim
    
    def _get_tf_triplet_loss(self):
        """Get TensorFlow implementation of triplet loss"""
        if not TF_AVAILABLE:
            return None
        
        def triplet_loss(y_true, y_pred):
            """
            Triplet loss implementation for TensorFlow
            
            Args:
                y_true: Labels (used for mining triplets)
                y_pred: Embeddings
                
            Returns:
                Triplet loss value
            """
            embeddings = y_pred
            if self.normalize_embeddings:
                embeddings = tf.math.l2_normalize(embeddings, axis=1)
            
            # Convert one-hot labels to indices if needed
            if len(y_true.shape) > 1 and y_true.shape[1] > 1:
                labels = tf.argmax(y_true, axis=1)
            else:
                labels = y_true
            
            # Get pairwise distances
            distances = self._tf_pairwise_distances(embeddings)
            
            # Create mask for positive and negative pairs
            labels = tf.cast(labels, tf.int32)
            adjacency = tf.equal(tf.expand_dims(labels, 0), tf.expand_dims(labels, 1))
            adjacency = tf.cast(adjacency, tf.float32)
            
            # Create mask for positive pairs (excluding self-comparisons)
            pdist_adjacency = adjacency - tf.eye(tf.shape(labels)[0], dtype=tf.float32)
            mask_positives = tf.cast(pdist_adjacency > 0, tf.float32)
            
            # Create mask for negative pairs
            mask_negatives = tf.cast(adjacency < 1, tf.float32)
            
            # Get hardest positive and negative distances
            pos_distances = distances * mask_positives
            # Replace zeros with large value to avoid selecting them
            large_val = tf.reduce_max(distances) + 1.0
            pos_distances = pos_distances + (1.0 - mask_positives) * large_val
            hardest_positive_dist = tf.reduce_min(pos_distances, axis=1)
            
            neg_distances = distances * mask_negatives
            # Replace zeros with large negative value to avoid selecting them
            neg_distances = neg_distances + (1.0 - mask_negatives) * (-1.0)
            hardest_negative_dist = tf.reduce_max(neg_distances, axis=1)
            
            # Calculate triplet loss with margin
            triplet_loss = tf.maximum(0.0, hardest_positive_dist - hardest_negative_dist + self.margin)
            triplet_loss = tf.reduce_mean(triplet_loss)
            
            return triplet_loss
        
        return triplet_loss
    
    def _tf_pairwise_distances(self, embeddings):
        """Compute pairwise distances between embeddings in TensorFlow"""
        dot_product = tf.matmul(embeddings, embeddings, transpose_b=True)
        square_norm = tf.diag_part(dot_product)
        distances = tf.expand_dims(square_norm, 0) - 2.0 * dot_product + tf.expand_dims(square_norm, 1)
        distances = tf.maximum(distances, 0.0)
        return distances
    
    def _get_pytorch_triplet_loss(self):
        """Get PyTorch implementation of triplet loss"""
        if not TORCH_AVAILABLE:
            return None
        
        class TripletLoss(nn.Module):
            """PyTorch implementation of triplet loss with hard mining"""
            
            def __init__(self, margin, normalize):
                super(TripletLoss, self).__init__()
                self.margin = margin
                self.normalize = normalize
            
            def forward(self, embeddings, labels):
                if self.normalize:
                    embeddings = F.normalize(embeddings, p=2, dim=1)
                
                # Convert one-hot labels to indices if needed
                if len(labels.shape) > 1 and labels.shape[1] > 1:
                    labels = torch.argmax(labels, dim=1)
                
                batch_size = embeddings.size(0)
                
                # Calculate pairwise distances
                dist_mat = self._pairwise_distances(embeddings)
                
                # Get a mask for positive pairs (same class, different instances)
                labels = labels.view(batch_size, 1)
                pos_mask = (labels == labels.t())
                pos_mask.fill_diagonal_(0)  # Exclude self-comparison
                
                # Get a mask for negative pairs (different classes)
                neg_mask = (labels != labels.t())
                
                # Get hardest positive and negative for each anchor
                pos_dist = dist_mat * pos_mask.float()
                # Replace zeros (from mask) with large value
                pos_dist[pos_mask == 0] = float('inf')
                hardest_pos_dist, _ = pos_dist.min(dim=1)
                
                neg_dist = dist_mat * neg_mask.float()
                # Replace zeros (from mask) with negative value
                neg_dist[neg_mask == 0] = -1.0
                hardest_neg_dist, _ = neg_dist.max(dim=1)
                
                # Calculate triplet loss
                loss = F.relu(hardest_pos_dist - hardest_neg_dist + self.margin).mean()
                
                return loss
            
            def _pairwise_distances(self, x):
                """Compute pairwise distances between vectors"""
                # x shape: (batch_size, embedding_dim)
                dot_product = torch.matmul(x, x.t())
                square_norm = torch.diag(dot_product)
                dist = square_norm.unsqueeze(0) - 2.0 * dot_product + square_norm.unsqueeze(1)
                dist = F.relu(dist)  # Ensure non-negative
                return dist
        
        return TripletLoss(margin=self.margin, normalize=self.normalize_embeddings)
    
    def _get_tf_center_loss(self):
        """Get TensorFlow implementation of center loss"""
        if not TF_AVAILABLE:
            return None
        
        class CenterLoss(tf.keras.layers.Layer):
            """TensorFlow implementation of center loss"""
            
            def __init__(self, num_classes, embedding_dim, alpha=0.5, **kwargs):
                super(CenterLoss, self).__init__(**kwargs)
                self.num_classes = num_classes
                self.embedding_dim = embedding_dim
                self.alpha = alpha
                
            def build(self, input_shape):
                self.centers = self.add_weight(
                    name='centers',
                    shape=(self.num_classes, self.embedding_dim),
                    initializer='zeros',
                    trainable=False
                )
                super(CenterLoss, self).build(input_shape)
                
            def call(self, inputs):
                embeddings, labels = inputs
                if self.normalize_embeddings:
                    embeddings = tf.math.l2_normalize(embeddings, axis=1)
                
                # Convert one-hot labels to indices if needed
                if len(labels.shape) > 1 and labels.shape[1] > 1:
                    labels = tf.argmax(labels, axis=1)
                
                # Get centers for the corresponding labels
                centers_batch = tf.gather(self.centers, labels)
                
                # Calculate l2 distance between embeddings and their centers
                diff = embeddings - centers_batch
                center_loss = tf.reduce_mean(tf.square(diff))
                
                # Update centers
                unique_labels, unique_indices = tf.unique(labels)
                unique_count = tf.gather(
                    tf.bincount(tf.cast(labels, tf.int32), minlength=self.num_classes),
                    unique_labels
                )
                
                diff_unique = tf.unsorted_segment_sum(diff, unique_indices, tf.shape(unique_labels)[0])
                diff_unique = diff_unique / tf.expand_dims(tf.cast(unique_count, tf.float32), 1)
                diff_unique = self.alpha * diff_unique
                
                centers_update = tf.scatter_nd(
                    tf.expand_dims(unique_labels, 1),
                    diff_unique,
                    tf.shape(self.centers)
                )
                self.centers.assign_sub(centers_update)
                
                return center_loss
        
        return CenterLoss
    
    def _get_pytorch_center_loss(self):
        """Get PyTorch implementation of center loss"""
        if not TORCH_AVAILABLE:
            return None
        
        class CenterLoss(nn.Module):
            """PyTorch implementation of center loss"""
            
            def __init__(self, num_classes, embedding_dim, alpha=0.5, normalize=True):
                super(CenterLoss, self).__init__()
                self.num_classes = num_classes
                self.embedding_dim = embedding_dim
                self.alpha = alpha
                self.normalize = normalize
                self.centers = nn.Parameter(
                    torch.zeros(num_classes, embedding_dim),
                    requires_grad=False
                )
                
            def forward(self, embeddings, labels):
                if self.normalize:
                    embeddings = F.normalize(embeddings, p=2, dim=1)
                
                # Convert one-hot labels to indices if needed
                if len(labels.shape) > 1 and labels.shape[1] > 1:
                    labels = torch.argmax(labels, dim=1)
                
                batch_size = embeddings.size(0)
                
                # Get centers for the corresponding labels
                centers_batch = self.centers[labels]
                
                # Calculate center loss
                center_loss = torch.mean((embeddings - centers_batch).pow(2).sum(dim=1))
                
                # Update centers
                # Only update centers for classes that appear in this batch
                unique_labels, unique_indices, counts = torch.unique(
                    labels, return_inverse=True, return_counts=True
                )
                
                # Compute difference between embeddings and centers
                diff = embeddings - centers_batch
                
                # Compute updates for each unique label
                diff_unique = torch.zeros_like(self.centers)
                for i, label in enumerate(unique_labels):
                    indices = (labels == label).nonzero(as_tuple=True)[0]
                    diff_unique[label] = diff[indices].sum(0) / counts[i]
                
                # Update centers
                self.centers.data = self.centers.data - self.alpha * diff_unique
                
                return center_loss
        
        return CenterLoss


class TextureConsistencyTask(MaterialTask):
    """Texture consistency regularization task"""
    
    def __init__(self, weight: float = 0.2, smoothness_factor: float = 0.1):
        """
        Initialize texture consistency task
        
        Args:
            weight: Weight for this task in the combined loss
            smoothness_factor: Weight for the smoothness term
        """
        super().__init__(name="texture_consistency", weight=weight)
        self.smoothness_factor = smoothness_factor
    
    def get_loss(self, framework: str) -> Union[Any, Callable]:
        """Get texture consistency loss function"""
        if framework == 'tensorflow':
            return self._get_tf_texture_loss() if TF_AVAILABLE else None
        elif framework == 'pytorch':
            return self._get_pytorch_texture_loss() if TORCH_AVAILABLE else None
        else:
            raise ValueError(f"Unsupported framework: {framework}")
    
    def get_output_size(self) -> int:
        """Texture consistency doesn't need a dedicated output"""
        return 0
    
    def _get_tf_texture_loss(self):
        """Get TensorFlow implementation of texture consistency loss"""
        if not TF_AVAILABLE:
            return None
        
        def texture_consistency_loss(y_true, feature_maps):
            """
            Texture consistency loss implementation for TensorFlow
            
            Args:
                y_true: Not used, but kept for API consistency
                feature_maps: Intermediate feature maps from the network
                
            Returns:
                Texture consistency loss value
            """
            # Calculate Gram matrix (texture representation)
            def gram_matrix(x):
                batch_size, h, w, c = x.shape
                features = tf.reshape(x, (batch_size, h * w, c))
                gram = tf.matmul(features, features, transpose_a=True)
                return gram / tf.cast(h * w * c, tf.float32)
            
            # Calculate variations in the feature maps for smoothness
            def smoothness_loss(x):
                h_diff = x[:, 1:, :, :] - x[:, :-1, :, :]
                w_diff = x[:, :, 1:, :] - x[:, :, :-1, :]
                return tf.reduce_mean(tf.abs(h_diff)) + tf.reduce_mean(tf.abs(w_diff))
            
            gram = gram_matrix(feature_maps)
            
            # Encourage similar textures within each class
            # This would typically require class information, but we simplify by assuming
            # textures should be consistent across the batch
            mean_gram = tf.reduce_mean(gram, axis=0, keepdims=True)
            texture_loss = tf.reduce_mean(tf.square(gram - mean_gram))
            
            # Add smoothness term to prevent overly complex textures
            smooth_loss = smoothness_loss(feature_maps)
            total_loss = texture_loss + self.smoothness_factor * smooth_loss
            
            return total_loss
        
        return texture_consistency_loss
    
    def _get_pytorch_texture_loss(self):
        """Get PyTorch implementation of texture consistency loss"""
        if not TORCH_AVAILABLE:
            return None
        
        class TextureConsistencyLoss(nn.Module):
            """PyTorch implementation of texture consistency loss"""
            
            def __init__(self, smoothness_factor=0.1):
                super(TextureConsistencyLoss, self).__init__()
                self.smoothness_factor = smoothness_factor
                
            def forward(self, _, feature_maps):
                # Calculate Gram matrix (texture representation)
                batch_size, c, h, w = feature_maps.size()
                features = feature_maps.view(batch_size, c, h * w)
                gram = torch.bmm(features, features.transpose(1, 2))
                gram = gram / (c * h * w)
                
                # Calculate variations for smoothness
                h_diff = feature_maps[:, :, 1:, :] - feature_maps[:, :, :-1, :]
                w_diff = feature_maps[:, :, :, 1:] - feature_maps[:, :, :, :-1]
                smoothness = torch.mean(torch.abs(h_diff)) + torch.mean(torch.abs(w_diff))
                
                # Encourage similar textures within each class
                mean_gram = torch.mean(gram, dim=0, keepdim=True)
                texture_loss = torch.mean((gram - mean_gram).pow(2))
                
                total_loss = texture_loss + self.smoothness_factor * smoothness
                
                return total_loss
        
        return TextureConsistencyLoss(smoothness_factor=self.smoothness_factor)


# ---- Multi-Task Model Implementations ----

if TF_AVAILABLE:
    class TensorFlowMultiTaskModel:
        """TensorFlow-based multi-task learning model"""
        
        def __init__(self, input_shape: Tuple[int, int, int], 
                    tasks: List[MaterialTask],
                    backbone: str = 'mobilenet',
                    embedding_dim: int = 128,
                    features_level: int = -2):
            """
            Initialize TensorFlow multi-task model
            
            Args:
                input_shape: Shape of input images (height, width, channels)
                tasks: List of tasks to perform
                backbone: Base model architecture ('mobilenet', 'vit', 'hybrid-cnn-vit')
                embedding_dim: Dimension of shared embeddings
                features_level: Which level of features to use for texture consistency
            """
            self.input_shape = input_shape
            self.tasks = tasks
            self.backbone = backbone
            self.embedding_dim = embedding_dim
            self.features_level = features_level
            self.feature_extractor = None
            self.model = None
            
            # Get classification task (needed for center loss)
            self.num_classes = 0
            for task in tasks:
                if isinstance(task, ClassificationTask):
                    self.num_classes = task.num_classes
                    break
            
            self._build_model()
        
        def _build_model(self):
            """Build the multi-task model architecture"""
            # Create input layer
            inputs = tf.keras.Input(shape=self.input_shape)
            
            # Create base model for feature extraction
            if self.backbone == 'mobilenet':
                base_model = tf.keras.applications.MobileNetV2(
                    input_shape=self.input_shape,
                    include_top=False,
                    weights='imagenet'
                )
            elif self.backbone == 'vit':
                from vit_models import create_vit_backbone
                base_model = create_vit_backbone(
                    input_shape=self.input_shape,
                    hidden_size=768,
                    num_heads=12,
                    num_layers=12
                )
            elif self.backbone == 'hybrid-cnn-vit':
                from vit_models import create_hybrid_cnn_transformer_backbone
                base_model = create_hybrid_cnn_transformer_backbone(
                    input_shape=self.input_shape,
                    cnn_backbone='MobileNetV2',
                    projection_dim=768,
                    num_heads=8,
                    transformer_layers=4
                )
            else:
                raise ValueError(f"Unsupported backbone: {self.backbone}")
            
            # Extract features using base model
            features = base_model(inputs)
            
            # Store intermediate feature maps for texture consistency if needed
            feature_maps = None
            for task in self.tasks:
                if isinstance(task, TextureConsistencyTask):
                    # Extract intermediate feature maps
                    if self.backbone == 'mobilenet':
                        feature_maps = base_model.layers[self.features_level].output
                    else:
                        # For ViT models, use attention maps
                        feature_maps = base_model.layers[self.features_level].output
                    break
            
            # Create shared embedding layer
            x = tf.keras.layers.GlobalAveragePooling2D()(features)
            x = tf.keras.layers.Dense(self.embedding_dim, activation='relu')(x)
            shared_embedding = tf.keras.layers.Dropout(0.5)(x)
            
            # Create task-specific heads
            outputs = {}
            losses = {}
            metrics = {}
            
            for task in self.tasks:
                if isinstance(task, ClassificationTask):
                    # Classification head
                    classification_output = tf.keras.layers.Dense(
                        task.num_classes, activation='softmax', 
                        name='classification'
                    )(shared_embedding)
                    outputs['classification'] = classification_output
                    
                    # Add loss and metrics
                    losses['classification'] = task.get_loss('tensorflow')
                    metrics['classification'] = ['accuracy']
                
                elif isinstance(task, PropertyPredictionTask):
                    # Property prediction head
                    property_output = tf.keras.layers.Dense(
                        task.num_properties, 
                        name='property_prediction'
                    )(shared_embedding)
                    outputs['property_prediction'] = property_output
                    
                    # Add loss and metrics
                    losses['property_prediction'] = task.get_loss('tensorflow')
                    metrics['property_prediction'] = ['mae', 'mse']
                
                elif isinstance(task, EmbeddingTask):
                    # Embedding learning head (just a projection layer)
                    embedding_output = tf.keras.layers.Dense(
                        task.embedding_dim, 
                        name='embedding'
                    )(shared_embedding)
                    
                    # Normalize if specified
                    if task.normalize_embeddings:
                        embedding_output = tf.keras.layers.Lambda(
                            lambda x: tf.math.l2_normalize(x, axis=1),
                            name='normalized_embedding'
                        )(embedding_output)
                    
                    outputs['embedding'] = embedding_output
                    
                    # For embedding loss, we need both embeddings and labels
                    if task.use_triplet_loss:
                        # Triplet loss needs to be applied in the model.fit using a custom callback
                        # Store the loss function for external use
                        self.embedding_loss_fn = task.get_loss('tensorflow')
                    else:
                        # For center loss, we can create a custom layer
                        center_loss_layer = task.get_loss('tensorflow')(
                            num_classes=self.num_classes,
                            embedding_dim=task.embedding_dim
                        )
                        # This layer needs both embeddings and labels
                        # Will be connected during model.compile
                        self.center_loss_layer = center_loss_layer
                
                elif isinstance(task, TextureConsistencyTask):
                    # Texture consistency doesn't need a dedicated output
                    # But we need to store the feature maps and loss function
                    self.texture_loss_fn = task.get_loss('tensorflow')
                    self.feature_maps = feature_maps
            
            # Create the model
            self.model = tf.keras.Model(inputs=inputs, outputs=outputs)
            
            # Store the base feature extractor
            self.feature_extractor = tf.keras.Model(inputs=inputs, outputs=shared_embedding)
            
            # Configure weight for each loss
            loss_weights = {}
            for task in self.tasks:
                if task.name in outputs.keys():
                    loss_weights[task.name] = task.weight
            
            # Compile the model
            self.model.compile(
                optimizer=tf.keras.optimizers.Adam(),
                loss=losses,
                metrics=metrics,
                loss_weights=loss_weights
            )
        
        def fit(self, x_train, y_train, validation_data=None, **kwargs):
            """
            Train the multi-task model
            
            Args:
                x_train: Training data
                y_train: Dictionary of training targets for each task
                validation_data: Tuple of (x_val, y_val) where y_val is a dict
                **kwargs: Additional arguments to pass to model.fit
                
            Returns:
                Training history
            """
            # Create custom callback for embedding loss and texture loss if needed
            callbacks = kwargs.pop('callbacks', [])
            
            # Handle embedding learning and texture consistency tasks
            for task in self.tasks:
                if isinstance(task, EmbeddingTask) and task.use_triplet_loss:
                    # Create a callback that adds triplet loss to the total loss
                    triplet_callback = self._create_triplet_loss_callback(
                        task, y_train['classification']
                    )
                    callbacks.append(triplet_callback)
                
                if isinstance(task, TextureConsistencyTask):
                    # Create a callback that adds texture consistency loss
                    texture_callback = self._create_texture_loss_callback(task)
                    callbacks.append(texture_callback)
            
            # Update kwargs with callbacks
            kwargs['callbacks'] = callbacks
            
            # Fit the model
            return self.model.fit(x_train, y_train, validation_data=validation_data, **kwargs)
        
        def _create_triplet_loss_callback(self, task, labels):
            """Create a callback that adds triplet loss to the total loss"""
            class TripletLossCallback(tf.keras.callbacks.Callback):
                def __init__(self, task, labels, weight):
                    super(TripletLossCallback, self).__init__()
                    self.task = task
                    self.labels = labels
                    self.weight = weight
                    self.triplet_loss_fn = task.get_loss('tensorflow')
                
                def on_batch_end(self, batch, logs=None):
                    # Get the current embeddings
                    embeddings = self.model.get_layer('embedding').output
                    # Calculate triplet loss
                    triplet_loss = self.triplet_loss_fn(self.labels, embeddings)
                    # Add weighted loss to the total loss
                    logs['loss'] += self.weight * triplet_loss
            
            return TripletLossCallback(task, labels, task.weight)
        
        def _create_texture_loss_callback(self, task):
            """Create a callback that adds texture consistency loss"""
            class TextureConsistencyCallback(tf.keras.callbacks.Callback):
                def __init__(self, task, feature_maps, weight):
                    super(TextureConsistencyCallback, self).__init__()
                    self.task = task
                    self.feature_maps = feature_maps
                    self.weight = weight
                    self.texture_loss_fn = task.get_loss('tensorflow')
                
                def on_batch_end(self, batch, logs=None):
                    # Calculate texture consistency loss
                    texture_loss = self.texture_loss_fn(None, self.feature_maps)
                    # Add weighted loss to the total loss
                    logs['loss'] += self.weight * texture_loss
            
            return TextureConsistencyCallback(task, self.feature_maps, task.weight)

if TORCH_AVAILABLE:
    class PyTorchMultiTaskModel(nn.Module):
        """PyTorch-based multi-task learning model"""
        
        def __init__(self, input_shape: Tuple[int, int, int], 
                    tasks: List[MaterialTask],
                    backbone: str = 'resnet',
                    embedding_dim: int = 128,
                    features_level: int = -2):
            """
            Initialize PyTorch multi-task model
            
            Args:
                input_shape: Shape of input images (channels, height, width)
                tasks: List of tasks to perform
                backbone: Base model architecture ('resnet', 'vit', 'hybrid-cnn-vit')
                embedding_dim: Dimension of shared embeddings
                features_level: Which level of features to use for texture consistency
            """
            super(PyTorchMultiTaskModel, self).__init__()
            self.input_shape = input_shape
            self.tasks = tasks
            self.backbone = backbone
            self.embedding_dim = embedding_dim
            self.features_level = features_level
            
            # Get classification task (needed for center loss)
            self.num_classes = 0
            for task in self.tasks:
                if isinstance(task, ClassificationTask):
                    self.num_classes = task.num_classes
                    break
            
            # Build feature extractor
            self._build_feature_extractor()
            
            # Build task-specific heads
            self._build_task_heads()
            
            # Initialize task losses
            self._initialize_losses()
        
        def _build_feature_extractor(self):
            """Build the base feature extractor"""
            # Define base model according to backbone type
            if self.backbone == 'resnet':
                import torchvision.models as models
                base_model = models.resnet18(pretrained=True)
                self.feature_extractor = nn.Sequential(*list(base_model.children())[:-2])
                # Calculate feature size
                with torch.no_grad():
                    dummy_input = torch.zeros(1, *self.input_shape)
                    features = self.feature_extractor(dummy_input)
                    self.feature_size = features.size(1) * features.size(2) * features.size(3)
                
                # Store intermediate feature maps for texture consistency if needed
                self.texture_feature_extractor = None
                for task in self.tasks:
                    if isinstance(task, TextureConsistencyTask):
                        # Extract features from an earlier layer
                        self.texture_feature_extractor = nn.Sequential(
                            *list(base_model.children())[:self.features_level]
                        )
                        break
            
            else:
                # For other backbones (ViT, Hybrid), implement similar logic
                # This would require importing the corresponding PyTorch implementations
                raise NotImplementedError(f"PyTorch implementation for {self.backbone} not available")
            
            # Shared embedding layers
            self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
            self.shared_embedding = nn.Sequential(
                nn.Flatten(),
                nn.Linear(self.feature_size, self.embedding_dim),
                nn.ReLU(),
                nn.Dropout(0.5)
            )
        
        def _build_task_heads(self):
            """Build task-specific heads"""
            self.task_heads = nn.ModuleDict()
            
            for task in self.tasks:
                if isinstance(task, ClassificationTask):
                    # Classification head
                    self.task_heads['classification'] = nn.Linear(
                        self.embedding_dim, task.num_classes
                    )
                
                elif isinstance(task, PropertyPredictionTask):
                    # Property prediction head
                    self.task_heads['property_prediction'] = nn.Linear(
                        self.embedding_dim, task.num_properties
                    )
                
                elif isinstance(task, EmbeddingTask):
                    # Embedding learning head
                    if task.normalize_embeddings:
                        self.task_heads['embedding'] = nn.Sequential(
                            nn.Linear(self.embedding_dim, task.embedding_dim),
                            nn.functional.normalize
                        )
                    else:
                        self.task_heads['embedding'] = nn.Linear(
                            self.embedding_dim, task.embedding_dim
                        )
        
        def _initialize_losses(self):
            """Initialize task-specific loss functions"""
            self.loss_fns = {}
            self.loss_weights = {}
            
            for task in self.tasks:
                self.loss_fns[task.name] = task.get_loss('pytorch')
                self.loss_weights[task.name] = task.weight
        
        def forward(self, x):
            """Forward pass through the model"""
            # Extract features using base model
            features = self.feature_extractor(x)
            
            # Store texture features if needed
            texture_features = None
            if self.texture_feature_extractor is not None:
                texture_features = self.texture_feature_extractor(x)
            
            # Create shared embedding
            x = self.avgpool(features)
            shared_embedding = self.shared_embedding(x)
            
            # Forward through task-specific heads
            outputs = {}
            for task in self.tasks:
                if isinstance(task, ClassificationTask):
                    outputs['classification'] = self.task_heads['classification'](shared_embedding)
                
                elif isinstance(task, PropertyPredictionTask):
                    outputs['property_prediction'] = self.task_heads['property_prediction'](shared_embedding)
                
                elif isinstance(task, EmbeddingTask):
                    outputs['embedding'] = self.task_heads['embedding'](shared_embedding)
            
            # Add intermediate features if needed for texture consistency
            if texture_features is not None:
                outputs['texture_features'] = texture_features
            
            return outputs
        
        def calculate_losses(self, outputs, targets):
            """
            Calculate losses for each task
            
            Args:
                outputs: Dictionary of model outputs
                targets: Dictionary of target values
                
            Returns:
                Tuple of (total_loss, task_losses)
            """
            task_losses = {}
            total_loss = 0.0
            
            for task in self.tasks:
                if isinstance(task, ClassificationTask):
                    # Calculate classification loss
                    if 'classification' in outputs and 'classification' in targets:
                        task_losses['classification'] = self.loss_fns['classification'](
                            outputs['classification'], targets['classification']
                        )
                        total_loss += self.loss_weights['classification'] * task_losses['classification']
                
                elif isinstance(task, PropertyPredictionTask):
                    # Calculate property prediction loss
                    if 'property_prediction' in outputs and 'property_prediction' in targets:
                        task_losses['property_prediction'] = self.loss_fns['property_prediction'](
                            outputs['property_prediction'], targets['property_prediction']
                        )
                        total_loss += self.loss_weights['property_prediction'] * task_losses['property_prediction']
                
                elif isinstance(task, EmbeddingTask):
                    # Calculate embedding loss
                    if 'embedding' in outputs and 'classification' in targets:
                        # For embedding loss, we typically need the class labels
                        task_losses['embedding'] = self.loss_fns['embedding'](
                            outputs['embedding'], targets['classification']
                        )
                        total_loss += self.loss_weights['embedding'] * task_losses['embedding']
                
                elif isinstance(task, TextureConsistencyTask):
                    # Calculate texture consistency loss
                    if 'texture_features' in outputs:
                        task_losses['texture_consistency'] = self.loss_fns['texture_consistency'](
                            None, outputs['texture_features']
                        )
                        total_loss += self.loss_weights['texture_consistency'] * task_losses['texture_consistency']
            
            return total_loss, task_losses

# ---- Multi-Task Dataset Creators ----

def create_multi_task_dataset(
    images: List[np.ndarray], 
    labels: List[int], 
    material_properties: Optional[Dict[int, Dict[str, float]]] = None,
    property_names: Optional[List[str]] = None):
    """
    Create a multi-task dataset with classification and property prediction
    
    Args:
        images: List of input images
        labels: List of class labels
        material_properties: Dictionary mapping class labels to property values
        property_names: List of property names to include
        
    Returns:
        Dictionary of targets for each task
    """
    # Create classification targets
    classification_targets = np.array(labels)
    
    # Create property prediction targets if properties are provided
    property_targets = None
    if material_properties and property_names:
        num_samples = len(labels)
        num_properties = len(property_names)
        property_targets = np.zeros((num_samples, num_properties))
        
        for i, label in enumerate(labels):
            if label in material_properties:
                for j, prop_name in enumerate(property_names):
                    if prop_name in material_properties[label]:
                        property_targets[i, j] = material_properties[label][prop_name]
    
    # Build the targets dictionary
    targets = {'classification': classification_targets}
    if property_targets is not None:
        targets['property_prediction'] = property_targets
    
    return targets


# ---- Utility Functions ----

def create_material_property_dict(material_info: List[Dict[str, Any]]) -> Dict[int, Dict[str, float]]:
    """
    Create a dictionary mapping material class indices to their properties
    
    Args:
        material_info: List of dictionaries with material information
        
    Returns:
        Dictionary mapping class indices to property values
    """
    material_properties = {}
    
    for material in material_info:
        class_idx = material.get('class_idx')
        properties = material.get('properties', {})
        
        if class_idx is not None:
            material_properties[class_idx] = properties
    
    return material_properties

def normalize_properties(material_properties: Dict[int, Dict[str, float]]) -> Dict[int, Dict[str, float]]:
    """
    Normalize property values to a 0-1 range for each property
    
    Args:
        material_properties: Dictionary mapping class indices to property values
        
    Returns:
        Dictionary with normalized property values
    """
    # Collect all values for each property
    property_values = {}
    for class_idx, properties in material_properties.items():
        for prop_name, value in properties.items():
            if prop_name not in property_values:
                property_values[prop_name] = []
            property_values[prop_name].append(value)
    
    # Calculate min and max for each property
    property_ranges = {}
    for prop_name, values in property_values.items():
        property_ranges[prop_name] = {
            'min': min(values),
            'max': max(values)
        }
    
    # Normalize properties
    normalized_properties = {}
    for class_idx, properties in material_properties.items():
        normalized_properties[class_idx] = {}
        for prop_name, value in properties.items():
            prop_min = property_ranges[prop_name]['min']
            prop_max = property_ranges[prop_name]['max']
            
            if prop_max > prop_min:
                normalized_value = (value - prop_min) / (prop_max - prop_min)
            else:
                normalized_value = 0.5  # Default if all values are the same
            
            normalized_properties[class_idx][prop_name] = normalized_value
    
    return normalized_properties


# ---- Common Material Properties ----

COMMON_MATERIAL_PROPERTIES = [
    'hardness',         # Material hardness (Mohs scale or equivalent)
    'roughness',        # Surface roughness
    'glossiness',       # Surface glossiness
    'transparency',     # Transparency/opacity level
    'reflectivity',     # Light reflectivity
    'density',          # Material density
    'elasticity',       # Elastic properties
    'conductivity',     # Thermal/electrical conductivity
    'porosity',         # Porosity level
    'water_resistance', # Resistance to water/moisture
]

# Example material property values for common materials
EXAMPLE_MATERIAL_PROPERTIES = {
    'wood': {
        'hardness': 0.4,
        'roughness': 0.7,
        'glossiness': 0.3,
        'transparency': 0.0,
        'reflectivity': 0.2,
        'density': 0.3,
        'elasticity': 0.5,
        'conductivity': 0.1,
        'porosity': 0.6,
        'water_resistance': 0.3
    },
    'metal': {
        'hardness': 0.9,
        'roughness': 0.2,
        'glossiness': 0.9,
        'transparency': 0.0,
        'reflectivity': 0.9,
        'density': 0.9,
        'elasticity': 0.3,
        'conductivity': 0.9,
        'porosity': 0.1,
        'water_resistance': 0.7
    },
    'glass': {
        'hardness': 0.6,
        'roughness': 0.1,
        'glossiness': 0.8,
        'transparency': 0.9,
        'reflectivity': 0.7,
        'density': 0.6,
        'elasticity': 0.2,
        'conductivity': 0.2,
        'porosity': 0.0,
        'water_resistance': 0.9
    },
    'plastic': {
        'hardness': 0.3,
        'roughness': 0.3,
        'glossiness': 0.6,
        'transparency': 0.5,
        'reflectivity': 0.4,
        'density': 0.2,
        'elasticity': 0.7,
        'conductivity': 0.1,
        'porosity': 0.2,
        'water_resistance': 0.8
    },
    'fabric': {
        'hardness': 0.1,
        'roughness': 0.6,
        'glossiness': 0.2,
        'transparency': 0.3,
        'reflectivity': 0.1,
        'density': 0.1,
        'elasticity': 0.8,
        'conductivity': 0.1,
        'porosity': 0.8,
        'water_resistance': 0.4
    },
    'ceramic': {
        'hardness': 0.8,
        'roughness': 0.4,
        'glossiness': 0.7,
        'transparency': 0.1,
        'reflectivity': 0.5,
        'density': 0.7,
        'elasticity': 0.1,
        'conductivity': 0.3,
        'porosity': 0.4,
        'water_resistance': 0.8
    },
    'stone': {
        'hardness': 0.8,
        'roughness': 0.8,
        'glossiness': 0.3,
        'transparency': 0.0,
        'reflectivity': 0.3,
        'density': 0.8,
        'elasticity': 0.1,
        'conductivity': 0.4,
        'porosity': 0.5,
        'water_resistance': 0.7
    },
    'leather': {
        'hardness': 0.2,
        'roughness': 0.5,
        'glossiness': 0.4,
        'transparency': 0.0,
        'reflectivity': 0.2,
        'density': 0.4,
        'elasticity': 0.6,
        'conductivity': 0.1,
        'porosity': 0.7,
        'water_resistance': 0.5
    }
}


# Example usage
if __name__ == "__main__":
    # Create tasks
    classification_task = ClassificationTask(num_classes=10, weight=1.0, loss_type='focal')
    property_task = PropertyPredictionTask(properties=COMMON_MATERIAL_PROPERTIES, weight=0.5)
    embedding_task = EmbeddingTask(embedding_dim=128, weight=0.3, use_triplet_loss=True)
    texture_task = TextureConsistencyTask(weight=0.2)
    
    tasks = [classification_task, property_task, embedding_task, texture_task]
    
    # Create model
    if TF_AVAILABLE:
        model = TensorFlowMultiTaskModel(
            input_shape=(224, 224, 3),
            tasks=tasks,
            backbone='mobilenet',
            embedding_dim=128
        )
        print("TensorFlow multi-task model created")
    
    if TORCH_AVAILABLE:
        model = PyTorchMultiTaskModel(
            input_shape=(3, 224, 224),
            tasks=tasks,
            backbone='resnet',
            embedding_dim=128
        )
        print("PyTorch multi-task model created")