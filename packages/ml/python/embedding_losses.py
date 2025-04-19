#!/usr/bin/env python3
"""
Embedding Space Organization Losses for Material Recognition

This module provides advanced loss functions for organizing embedding spaces:
1. Center Loss: Minimizes intra-class variations by penalizing distance to class centers
2. ArcFace: Enhances inter-class margins through additive angular margin penalty
3. CosFace: Applies large margin cosine loss for improved separability
4. Triplet Loss: Enhances embedding space by pushing similar samples together and dissimilar ones apart

These losses are crucial for material recognition where similar materials need clear separation.
"""

import numpy as np
import logging
from typing import Dict, List, Tuple, Union, Optional, Any, Callable

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('embedding_losses')

# Conditionally import TensorFlow or PyTorch based on availability
try:
    import tensorflow as tf
    from tensorflow.keras import layers, models, losses, optimizers, backend as K
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    logger.debug("TensorFlow not available. TensorFlow-based losses will be disabled.")

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.debug("PyTorch not available. PyTorch-based losses will be disabled.")


# ---- Center Loss Implementation ----

if TF_AVAILABLE:
    class TFCenterLoss(layers.Layer):
        """
        TensorFlow implementation of Center Loss
        
        Center Loss minimizes the distance between features and their corresponding
        class centers, reducing intra-class variations.
        
        Reference:
        Wen et al. "A Discriminative Feature Learning Approach for Deep Face Recognition"
        """
        
        def __init__(self, num_classes: int, embedding_dim: int, alpha: float = 0.5, **kwargs):
            """
            Initialize Center Loss layer
            
            Args:
                num_classes: Number of classes in the dataset
                embedding_dim: Dimension of the feature embeddings
                alpha: Update rate for centers (smaller values provide more stable training)
                **kwargs: Additional arguments for the Layer
            """
            super(TFCenterLoss, self).__init__(**kwargs)
            self.num_classes = num_classes
            self.embedding_dim = embedding_dim
            self.alpha = alpha
            
        def build(self, input_shape):
            """Build the layer by creating weights (centers)"""
            # Initialize centers with zeros
            self.centers = self.add_weight(
                name='centers',
                shape=(self.num_classes, self.embedding_dim),
                initializer='zeros',
                trainable=False
            )
            super(TFCenterLoss, self).build(input_shape)
            
        def call(self, inputs):
            """
            Calculate center loss
            
            Args:
                inputs: Tuple of (features, labels)
                  - features: Feature embeddings [batch_size, embedding_dim]
                  - labels: Class labels [batch_size] or one-hot encoded [batch_size, num_classes]
                
            Returns:
                Center loss value
            """
            features, labels = inputs
            
            # Convert one-hot labels to indices if needed
            if len(labels.shape) > 1 and labels.shape[1] > 1:
                labels = tf.argmax(labels, axis=1)
            
            # Cast labels to int32
            labels = tf.cast(labels, tf.int32)
            
            # Gather centers for the corresponding labels
            centers_batch = tf.gather(self.centers, labels)
            
            # Calculate the center loss
            center_loss = tf.reduce_mean(tf.square(features - centers_batch))
            
            # Update centers
            # First, we need to find unique labels in the batch
            unique_labels, unique_indices, unique_counts = tf.unique_with_counts(labels)
            
            # Calculate differences for each center
            diff = features - centers_batch
            
            # Aggregate differences for each label
            diff_unique = tf.zeros_like(self.centers)
            for idx, label in enumerate(unique_labels):
                label_indices = tf.where(tf.equal(labels, label))[:, 0]
                label_features = tf.gather(features, label_indices)
                label_centers = tf.gather(centers_batch, label_indices)
                label_diff = tf.reduce_mean(label_features - label_centers, axis=0)
                
                # Create update for specific center
                update = tf.tensor_scatter_nd_update(
                    diff_unique, 
                    tf.reshape(label, [1, 1]), 
                    tf.reshape(label_diff, [1, self.embedding_dim])
                )
                diff_unique = diff_unique + update
                
            # Apply center updates with learning rate alpha
            updates = self.alpha * diff_unique
            self.centers.assign_sub(updates)
            
            return center_loss

    def tf_center_loss_wrapper(num_classes: int, embedding_dim: int, alpha: float = 0.5):
        """
        Wrapper function for TensorFlow center loss to simplify usage
        
        Args:
            num_classes: Number of classes in the dataset
            embedding_dim: Dimension of the feature embeddings
            alpha: Update rate for centers
            
        Returns:
            Function that calculates center loss
        """
        center_loss_layer = TFCenterLoss(num_classes, embedding_dim, alpha)
        
        def center_loss(y_true, y_pred):
            return center_loss_layer([y_pred, y_true])
        
        return center_loss


if TORCH_AVAILABLE:
    class PytorchCenterLoss(nn.Module):
        """
        PyTorch implementation of Center Loss
        
        Center Loss minimizes the distance between features and their corresponding
        class centers, reducing intra-class variations.
        
        Reference:
        Wen et al. "A Discriminative Feature Learning Approach for Deep Face Recognition"
        """
        
        def __init__(self, num_classes: int, embedding_dim: int, alpha: float = 0.5):
            """
            Initialize Center Loss
            
            Args:
                num_classes: Number of classes in the dataset
                embedding_dim: Dimension of the feature embeddings
                alpha: Update rate for centers (smaller values provide more stable training)
            """
            super(PytorchCenterLoss, self).__init__()
            self.num_classes = num_classes
            self.embedding_dim = embedding_dim
            self.alpha = alpha
            
            # Initialize centers
            self.centers = nn.Parameter(
                torch.zeros(num_classes, embedding_dim),
                requires_grad=False
            )
            
        def forward(self, features, labels):
            """
            Calculate center loss
            
            Args:
                features: Feature embeddings [batch_size, embedding_dim]
                labels: Class labels [batch_size] or one-hot encoded [batch_size, num_classes]
                
            Returns:
                Center loss value
            """
            # Convert one-hot labels to indices if needed
            if len(labels.shape) > 1 and labels.shape[1] > 1:
                labels = torch.argmax(labels, dim=1)
            
            # Gather centers for the corresponding labels
            centers_batch = self.centers[labels]
            
            # Calculate the center loss
            center_loss = torch.mean((features - centers_batch).pow(2))
            
            # Update centers
            # Get unique labels in batch
            unique_labels, indices, counts = torch.unique(
                labels, return_inverse=True, return_counts=True
            )
            
            # For each unique label, compute the center updates
            for i, label in enumerate(unique_labels):
                # Get indices of samples with this label
                label_indices = (labels == label).nonzero(as_tuple=True)[0]
                
                # Calculate mean difference for this center
                label_features = features[label_indices]
                label_center = self.centers[label].unsqueeze(0).expand_as(label_features)
                diff = label_features - label_center
                mean_diff = diff.mean(0)
                
                # Update center
                self.centers.data[label] = self.centers.data[label] - self.alpha * mean_diff
            
            return center_loss


# ---- ArcFace Loss Implementation ----

if TF_AVAILABLE:
    class TFArcFaceLoss(layers.Layer):
        """
        TensorFlow implementation of ArcFace Loss
        
        ArcFace adds an angular margin penalty to the target logit,
        improving inter-class separation in the embedding space.
        
        Reference:
        Deng et al. "ArcFace: Additive Angular Margin Loss for Deep Face Recognition"
        """
        
        def __init__(self, num_classes: int, embedding_dim: int, margin: float = 0.5, scale: float = 64.0, **kwargs):
            """
            Initialize ArcFace Loss layer
            
            Args:
                num_classes: Number of classes in the dataset
                embedding_dim: Dimension of the feature embeddings
                margin: Angular margin penalty (radians)
                scale: Scale factor for logits
                **kwargs: Additional arguments for the Layer
            """
            super(TFArcFaceLoss, self).__init__(**kwargs)
            self.num_classes = num_classes
            self.embedding_dim = embedding_dim
            self.margin = margin
            self.scale = scale
            self.cos_m = tf.math.cos(margin)
            self.sin_m = tf.math.sin(margin)
            # Threshold to prevent instability due to rounding errors
            self.th = tf.math.cos(np.pi - margin)
            
        def build(self, input_shape):
            """Build the layer by creating weights (class centers)"""
            # Initialize weights with L2 normalized vectors
            self.weights = self.add_weight(
                name='weights',
                shape=(self.num_classes, self.embedding_dim),
                initializer='glorot_uniform',
                trainable=True,
                regularizer=tf.keras.regularizers.l2(1e-4)
            )
            super(TFArcFaceLoss, self).build(input_shape)
            
        def call(self, inputs):
            """
            Calculate ArcFace loss
            
            Args:
                inputs: Tuple of (features, labels)
                  - features: Feature embeddings [batch_size, embedding_dim]
                  - labels: Class labels [batch_size] or one-hot encoded [batch_size, num_classes]
                
            Returns:
                ArcFace logits
            """
            features, labels = inputs
            
            # Normalize feature vectors and weights
            features = tf.nn.l2_normalize(features, axis=1)
            weights = tf.nn.l2_normalize(self.weights, axis=1)
            
            # Compute cosine similarity
            cos_theta = tf.matmul(features, weights, transpose_b=True)
            cos_theta = tf.clip_by_value(cos_theta, -1.0 + K.epsilon(), 1.0 - K.epsilon())
            
            # Convert labels to one-hot if they aren't already
            if len(labels.shape) == 1 or labels.shape[1] == 1:
                labels = tf.one_hot(tf.cast(labels, tf.int32), depth=self.num_classes)
            
            # Get target logits
            target_logits = tf.reduce_sum(labels * cos_theta, axis=1, keepdims=True)
            
            # Calculate additive angular margin
            sin_theta = tf.sqrt(1.0 - tf.square(target_logits))
            cos_theta_m = target_logits * self.cos_m - sin_theta * self.sin_m
            
            # Apply threshold for numerical stability
            cond_v = target_logits - self.th
            cond = tf.cast(tf.nn.relu(cond_v), dtype=tf.bool)
            keep_val = target_logits - self.sin_m * self.margin
            cos_theta_m = tf.where(cond, cos_theta_m, keep_val)
            
            # Apply margin to target logits only
            mask = labels
            inv_mask = 1.0 - mask
            
            s_cos_theta = self.scale * cos_theta
            output = s_cos_theta * inv_mask + self.scale * cos_theta_m * mask
            
            return output

    def tf_arcface_loss_wrapper(num_classes: int, embedding_dim: int, margin: float = 0.5, scale: float = 64.0):
        """
        Wrapper function for TensorFlow ArcFace loss
        
        Args:
            num_classes: Number of classes in the dataset
            embedding_dim: Dimension of the feature embeddings
            margin: Angular margin penalty (radians)
            scale: Scale factor for logits
            
        Returns:
            Loss function for training
        """
        arcface_layer = TFArcFaceLoss(num_classes, embedding_dim, margin, scale)
        
        def arcface_loss(y_true, y_pred):
            arcface_logits = arcface_layer([y_pred, y_true])
            # Use categorical cross-entropy on the modified logits
            return tf.keras.losses.categorical_crossentropy(
                y_true, arcface_logits, from_logits=True
            )
        
        return arcface_loss


if TORCH_AVAILABLE:
    class PytorchArcFaceLoss(nn.Module):
        """
        PyTorch implementation of ArcFace Loss
        
        ArcFace adds an angular margin penalty to the target logit,
        improving inter-class separation in the embedding space.
        
        Reference:
        Deng et al. "ArcFace: Additive Angular Margin Loss for Deep Face Recognition"
        """
        
        def __init__(self, num_classes: int, embedding_dim: int, margin: float = 0.5, scale: float = 64.0):
            """
            Initialize ArcFace Loss layer
            
            Args:
                num_classes: Number of classes in the dataset
                embedding_dim: Dimension of the feature embeddings
                margin: Angular margin penalty (radians)
                scale: Scale factor for logits
            """
            super(PytorchArcFaceLoss, self).__init__()
            self.num_classes = num_classes
            self.embedding_dim = embedding_dim
            self.margin = margin
            self.scale = scale
            self.cos_m = np.cos(margin)
            self.sin_m = np.sin(margin)
            # Threshold to prevent instability due to rounding errors
            self.th = np.cos(np.pi - margin)
            
            # Initialize weights
            self.weight = nn.Parameter(
                torch.Tensor(num_classes, embedding_dim)
            )
            nn.init.xavier_uniform_(self.weight)
            
        def forward(self, features, labels):
            """
            Calculate ArcFace loss
            
            Args:
                features: Feature embeddings [batch_size, embedding_dim]
                labels: Class labels [batch_size] or one-hot encoded [batch_size, num_classes]
                
            Returns:
                ArcFace logits
            """
            # Normalize feature vectors and weights
            features = F.normalize(features, p=2, dim=1)
            weights = F.normalize(self.weight, p=2, dim=1)
            
            # Compute cosine similarity
            cos_theta = torch.matmul(features, weights.T)
            cos_theta = torch.clamp(cos_theta, -1.0 + 1e-7, 1.0 - 1e-7)
            
            # Convert labels to one-hot if they aren't already
            if len(labels.shape) == 1 or labels.shape[1] == 1:
                labels_onehot = torch.zeros(
                    labels.size(0), self.num_classes, 
                    device=features.device
                )
                labels_onehot.scatter_(1, labels.view(-1, 1), 1.0)
            else:
                labels_onehot = labels
            
            # Get target logits
            target_logits = torch.sum(labels_onehot * cos_theta, dim=1, keepdim=True)
            
            # Calculate additive angular margin
            sin_theta = torch.sqrt(1.0 - torch.pow(target_logits, 2))
            cos_theta_m = target_logits * self.cos_m - sin_theta * self.sin_m
            
            # Apply threshold for numerical stability
            cond_v = target_logits - self.th
            cond = cond_v > 0
            keep_val = target_logits - self.sin_m * self.margin
            cos_theta_m = torch.where(cond, cos_theta_m, keep_val)
            
            # Apply margin to target logits only
            output = cos_theta.clone()
            output[torch.arange(features.size(0)), labels] = cos_theta_m.squeeze()
            
            # Scale logits
            output = output * self.scale
            
            return output


# ---- CosFace Loss Implementation ----

if TF_AVAILABLE:
    class TFCosFaceLoss(layers.Layer):
        """
        TensorFlow implementation of CosFace Loss (LMCL)
        
        CosFace applies a cosine margin penalty to improve class separation.
        
        Reference:
        Wang et al. "CosFace: Large Margin Cosine Loss for Deep Face Recognition"
        """
        
        def __init__(self, num_classes: int, embedding_dim: int, margin: float = 0.35, scale: float = 64.0, **kwargs):
            """
            Initialize CosFace Loss layer
            
            Args:
                num_classes: Number of classes in the dataset
                embedding_dim: Dimension of the feature embeddings
                margin: Cosine margin penalty
                scale: Scale factor for logits
                **kwargs: Additional arguments for the Layer
            """
            super(TFCosFaceLoss, self).__init__(**kwargs)
            self.num_classes = num_classes
            self.embedding_dim = embedding_dim
            self.margin = margin
            self.scale = scale
            
        def build(self, input_shape):
            """Build the layer by creating weights (class centers)"""
            # Initialize weights
            self.weights = self.add_weight(
                name='weights',
                shape=(self.num_classes, self.embedding_dim),
                initializer='glorot_uniform',
                trainable=True,
                regularizer=tf.keras.regularizers.l2(1e-4)
            )
            super(TFCosFaceLoss, self).build(input_shape)
            
        def call(self, inputs):
            """
            Calculate CosFace loss
            
            Args:
                inputs: Tuple of (features, labels)
                  - features: Feature embeddings [batch_size, embedding_dim]
                  - labels: Class labels [batch_size] or one-hot encoded [batch_size, num_classes]
                
            Returns:
                CosFace logits
            """
            features, labels = inputs
            
            # Normalize feature vectors and weights
            features = tf.nn.l2_normalize(features, axis=1)
            weights = tf.nn.l2_normalize(self.weights, axis=1)
            
            # Compute cosine similarity
            cos_theta = tf.matmul(features, weights, transpose_b=True)
            
            # Convert labels to one-hot if they aren't already
            if len(labels.shape) == 1 or labels.shape[1] == 1:
                labels = tf.one_hot(tf.cast(labels, tf.int32), depth=self.num_classes)
            
            # Apply margin and scale
            margin_cos_theta = cos_theta - self.margin * labels
            output = self.scale * margin_cos_theta
            
            return output

    def tf_cosface_loss_wrapper(num_classes: int, embedding_dim: int, margin: float = 0.35, scale: float = 64.0):
        """
        Wrapper function for TensorFlow CosFace loss
        
        Args:
            num_classes: Number of classes in the dataset
            embedding_dim: Dimension of the feature embeddings
            margin: Cosine margin penalty
            scale: Scale factor for logits
            
        Returns:
            Loss function for training
        """
        cosface_layer = TFCosFaceLoss(num_classes, embedding_dim, margin, scale)
        
        def cosface_loss(y_true, y_pred):
            cosface_logits = cosface_layer([y_pred, y_true])
            # Use categorical cross-entropy on the modified logits
            return tf.keras.losses.categorical_crossentropy(
                y_true, cosface_logits, from_logits=True
            )
        
        return cosface_loss


if TORCH_AVAILABLE:
    class PytorchCosFaceLoss(nn.Module):
        """
        PyTorch implementation of CosFace Loss (LMCL)
        
        CosFace applies a cosine margin penalty to improve class separation.
        
        Reference:
        Wang et al. "CosFace: Large Margin Cosine Loss for Deep Face Recognition"
        """
        
        def __init__(self, num_classes: int, embedding_dim: int, margin: float = 0.35, scale: float = 64.0):
            """
            Initialize CosFace Loss layer
            
            Args:
                num_classes: Number of classes in the dataset
                embedding_dim: Dimension of the feature embeddings
                margin: Cosine margin penalty
                scale: Scale factor for logits
            """
            super(PytorchCosFaceLoss, self).__init__()
            self.num_classes = num_classes
            self.embedding_dim = embedding_dim
            self.margin = margin
            self.scale = scale
            
            # Initialize weights
            self.weight = nn.Parameter(
                torch.Tensor(num_classes, embedding_dim)
            )
            nn.init.xavier_uniform_(self.weight)
            
        def forward(self, features, labels):
            """
            Calculate CosFace loss
            
            Args:
                features: Feature embeddings [batch_size, embedding_dim]
                labels: Class labels [batch_size] or one-hot encoded [batch_size, num_classes]
                
            Returns:
                CosFace logits
            """
            # Normalize feature vectors and weights
            features = F.normalize(features, p=2, dim=1)
            weights = F.normalize(self.weight, p=2, dim=1)
            
            # Compute cosine similarity
            cos_theta = torch.matmul(features, weights.T)
            
            # Convert labels to one-hot if they aren't already
            if len(labels.shape) == 1 or labels.shape[1] == 1:
                labels_onehot = torch.zeros(
                    labels.size(0), self.num_classes, 
                    device=features.device
                )
                labels_onehot.scatter_(1, labels.view(-1, 1), 1.0)
            else:
                labels_onehot = labels
            
            # Apply margin and scale
            margin_cos_theta = cos_theta - self.margin * labels_onehot
            output = self.scale * margin_cos_theta
            
            return output


# ---- Triplet Loss Implementation ----

if TF_AVAILABLE:
    def tf_batch_hard_triplet_loss(y_true, y_pred, margin=0.3):
        """
        TensorFlow implementation of Batch Hard Triplet Loss
        
        Finds the hardest positive and negative samples within a batch to form triplets.
        
        Args:
            y_true: Labels [batch_size]
            y_pred: Feature embeddings [batch_size, embedding_dim]
            margin: Triplet margin
            
        Returns:
            Triplet loss value
        """
        # Normalize embeddings
        embeddings = tf.math.l2_normalize(y_pred, axis=1)
        
        # Convert one-hot labels to indices if needed
        if len(y_true.shape) > 1 and y_true.shape[1] > 1:
            labels = tf.argmax(y_true, axis=1)
        else:
            labels = y_true
        
        # Calculate pairwise distances
        dot_product = tf.matmul(embeddings, embeddings, transpose_b=True)
        square_norm = tf.linalg.diag_part(dot_product)
        distances = tf.expand_dims(square_norm, 0) - 2.0 * dot_product + tf.expand_dims(square_norm, 1)
        distances = tf.maximum(distances, 0.0)
        
        # Create mask for positive and negative pairs
        labels = tf.cast(labels, tf.int32)
        mask_positives = tf.cast(tf.equal(tf.expand_dims(labels, 0), tf.expand_dims(labels, 1)), tf.float32)
        mask_negatives = tf.cast(tf.not_equal(tf.expand_dims(labels, 0), tf.expand_dims(labels, 1)), tf.float32)
        
        # Remove self-comparisons
        mask_positives = mask_positives - tf.eye(tf.shape(labels)[0], dtype=tf.float32)
        
        # Get hardest positive for each anchor
        hardest_positive_dist = tf.reduce_max(distances * mask_positives, axis=1)
        
        # Get hardest negative for each anchor
        max_distance = tf.reduce_max(distances)
        distances_neg = distances + max_distance * (1.0 - mask_negatives)
        hardest_negative_dist = tf.reduce_min(distances_neg, axis=1)
        
        # Calculate triplet loss with margin
        basic_loss = tf.maximum(0.0, hardest_positive_dist - hardest_negative_dist + margin)
        triplet_loss = tf.reduce_mean(basic_loss)
        
        return triplet_loss

if TORCH_AVAILABLE:
    def pytorch_batch_hard_triplet_loss(labels, embeddings, margin=0.3):
        """
        PyTorch implementation of Batch Hard Triplet Loss
        
        Finds the hardest positive and negative samples within a batch to form triplets.
        
        Args:
            labels: Labels [batch_size]
            embeddings: Feature embeddings [batch_size, embedding_dim]
            margin: Triplet margin
            
        Returns:
            Triplet loss value
        """
        # Normalize embeddings
        embeddings = F.normalize(embeddings, p=2, dim=1)
        
        # Convert one-hot labels to indices if needed
        if len(labels.shape) > 1 and labels.shape[1] > 1:
            labels = torch.argmax(labels, dim=1)
        
        # Calculate pairwise distances
        dist_mat = torch.cdist(embeddings, embeddings, p=2)
        
        # Create mask for positive and negative pairs
        # Two embeddings are positive if they have the same label
        labels = labels.view(-1, 1)
        mask_positives = (labels == labels.t()).float()
        mask_negatives = (labels != labels.t()).float()
        
        # Remove self-comparisons
        mask_positives = mask_positives - torch.eye(labels.size(0), device=labels.device)
        
        # Get hardest positive for each anchor
        hardest_positive_dist, _ = (dist_mat * mask_positives).max(dim=1)
        
        # Get hardest negative for each anchor
        max_distance = dist_mat.max()
        dist_mat_neg = dist_mat + max_distance * (1.0 - mask_negatives)
        hardest_negative_dist, _ = dist_mat_neg.min(dim=1)
        
        # Calculate triplet loss with margin
        basic_loss = F.relu(hardest_positive_dist - hardest_negative_dist + margin)
        triplet_loss = basic_loss.mean()
        
        return triplet_loss


# ---- Combined Loss (ArcFace + Center Loss) ----

if TF_AVAILABLE:
    def tf_combined_margin_center_loss(num_classes, embedding_dim, 
                                    arc_margin=0.5, arc_scale=64.0,
                                    center_weight=0.1, center_alpha=0.5):
        """
        Combined ArcFace and Center Loss for TensorFlow
        
        Args:
            num_classes: Number of classes
            embedding_dim: Feature dimension
            arc_margin: ArcFace angular margin
            arc_scale: ArcFace scale factor
            center_weight: Weight for center loss term
            center_alpha: Center loss update rate
            
        Returns:
            Combined loss function
        """
        arcface_layer = TFArcFaceLoss(num_classes, embedding_dim, arc_margin, arc_scale)
        center_loss_layer = TFCenterLoss(num_classes, embedding_dim, center_alpha)
        
        def combined_loss(y_true, y_pred):
            arcface_logits = arcface_layer([y_pred, y_true])
            clf_loss = tf.keras.losses.categorical_crossentropy(
                y_true, arcface_logits, from_logits=True
            )
            
            center_loss_val = center_loss_layer([y_pred, y_true])
            return clf_loss + center_weight * center_loss_val
        
        return combined_loss

if TORCH_AVAILABLE:
    class PytorchCombinedMarginCenterLoss(nn.Module):
        """
        Combined ArcFace and Center Loss for PyTorch
        
        Combines angular margin penalty with center loss for better embeddings.
        """
        
        def __init__(self, num_classes, embedding_dim, 
                    arc_margin=0.5, arc_scale=64.0,
                    center_weight=0.1, center_alpha=0.5):
            """
            Initialize combined loss
            
            Args:
                num_classes: Number of classes
                embedding_dim: Feature dimension
                arc_margin: ArcFace angular margin
                arc_scale: ArcFace scale factor
                center_weight: Weight for center loss term
                center_alpha: Center loss update rate
            """
            super(PytorchCombinedMarginCenterLoss, self).__init__()
            self.arcface = PytorchArcFaceLoss(num_classes, embedding_dim, arc_margin, arc_scale)
            self.center_loss = PytorchCenterLoss(num_classes, embedding_dim, center_alpha)
            self.center_weight = center_weight
            self.cross_entropy = nn.CrossEntropyLoss()
            
        def forward(self, features, labels):
            """
            Calculate combined loss
            
            Args:
                features: Feature embeddings [batch_size, embedding_dim]
                labels: Class labels [batch_size]
                
            Returns:
                Combined loss value
            """
            arcface_logits = self.arcface(features, labels)
            clf_loss = self.cross_entropy(arcface_logits, labels)
            
            center_loss_val = self.center_loss(features, labels)
            return clf_loss + self.center_weight * center_loss_val


# ---- Helper Functions ----

def get_embedding_loss(loss_type: str, framework: str, num_classes: int, embedding_dim: int, **kwargs):
    """
    Factory function to get embedding loss by name
    
    Args:
        loss_type: Name of the loss ('center', 'arcface', 'cosface', 'triplet', 'combined')
        framework: 'tensorflow' or 'pytorch'
        num_classes: Number of classes
        embedding_dim: Feature dimension
        **kwargs: Additional loss parameters
            - margin: Margin for ArcFace, CosFace, or Triplet Loss
            - scale: Scale factor for ArcFace or CosFace
            - alpha: Update rate for Center Loss
            - center_weight: Weight for center loss in combined loss
            
    Returns:
        Loss function or module
    """
    # Set default parameters
    margin = kwargs.get('margin', 0.5)
    scale = kwargs.get('scale', 64.0)
    alpha = kwargs.get('alpha', 0.5)
    center_weight = kwargs.get('center_weight', 0.1)
    
    if framework == 'tensorflow':
        if not TF_AVAILABLE:
            logger.error("TensorFlow is not available.")
            return None
        
        if loss_type == 'center':
            return tf_center_loss_wrapper(num_classes, embedding_dim, alpha)
        elif loss_type == 'arcface':
            return tf_arcface_loss_wrapper(num_classes, embedding_dim, margin, scale)
        elif loss_type == 'cosface':
            return tf_cosface_loss_wrapper(num_classes, embedding_dim, margin, scale)
        elif loss_type == 'triplet':
            return lambda y_true, y_pred: tf_batch_hard_triplet_loss(y_true, y_pred, margin)
        elif loss_type == 'combined':
            return tf_combined_margin_center_loss(
                num_classes, embedding_dim,
                arc_margin=margin, arc_scale=scale,
                center_weight=center_weight, center_alpha=alpha
            )
        else:
            logger.error(f"Unknown loss type: {loss_type}")
            return None
    
    elif framework == 'pytorch':
        if not TORCH_AVAILABLE:
            logger.error("PyTorch is not available.")
            return None
        
        if loss_type == 'center':
            return PytorchCenterLoss(num_classes, embedding_dim, alpha)
        elif loss_type == 'arcface':
            return PytorchArcFaceLoss(num_classes, embedding_dim, margin, scale)
        elif loss_type == 'cosface':
            return PytorchCosFaceLoss(num_classes, embedding_dim, margin, scale)
        elif loss_type == 'triplet':
            return lambda labels, embeddings: pytorch_batch_hard_triplet_loss(labels, embeddings, margin)
        elif loss_type == 'combined':
            return PytorchCombinedMarginCenterLoss(
                num_classes, embedding_dim,
                arc_margin=margin, arc_scale=scale,
                center_weight=center_weight, center_alpha=alpha
            )
        else:
            logger.error(f"Unknown loss type: {loss_type}")
            return None
    
    else:
        logger.error(f"Unknown framework: {framework}")
        return None


# ---- Visualization Functions ----

def plot_embeddings_2d(embeddings, labels, class_names=None, title="Feature Embeddings", 
                     figsize=(10, 8), alpha=0.7, marker_size=50, save_path=None):
    """
    Plot 2D embeddings with PCA or t-SNE dimensionality reduction
    
    Args:
        embeddings: Feature embeddings [num_samples, embedding_dim]
        labels: Class labels [num_samples]
        class_names: Optional list of class names for the legend
        title: Plot title
        figsize: Figure size
        alpha: Marker transparency
        marker_size: Size of scatter plot markers
        save_path: Path to save the plot (None for display only)
        
    Returns:
        Figure and axes objects
    """
    try:
        import matplotlib.pyplot as plt
        from sklearn.decomposition import PCA
        from sklearn.manifold import TSNE
    except ImportError:
        logger.error("Visualization requires matplotlib and scikit-learn.")
        return None, None
    
    # Convert embeddings to numpy if they're tensors
    if TF_AVAILABLE:
        if isinstance(embeddings, tf.Tensor):
            embeddings = embeddings.numpy()
    
    if TORCH_AVAILABLE:
        if isinstance(embeddings, torch.Tensor):
            embeddings = embeddings.detach().cpu().numpy()
    
    if isinstance(labels, (list, tuple)):
        labels = np.array(labels)
    
    # Convert one-hot labels to indices if needed
    if len(labels.shape) > 1 and labels.shape[1] > 1:
        labels = np.argmax(labels, axis=1)
    
    # Apply dimensionality reduction
    if embeddings.shape[1] > 50:
        # First reduce with PCA then t-SNE for high-dimensional embeddings
        embeddings_2d = PCA(n_components=50).fit_transform(embeddings)
        embeddings_2d = TSNE(n_components=2).fit_transform(embeddings_2d)
    elif embeddings.shape[1] > 2:
        if embeddings.shape[0] > 5000:
            # PCA is faster for large datasets
            embeddings_2d = PCA(n_components=2).fit_transform(embeddings)
        else:
            # t-SNE gives better separation for smaller datasets
            embeddings_2d = TSNE(n_components=2).fit_transform(embeddings)
    else:
        # Already 2D
        embeddings_2d = embeddings
    
    # Create plot
    fig, ax = plt.subplots(figsize=figsize)
    
    # Get unique labels
    unique_labels = np.unique(labels)
    
    # Create color map
    cmap = plt.cm.get_cmap('tab10', len(unique_labels))
    
    # Plot each class separately
    for i, label in enumerate(unique_labels):
        idx = labels == label
        ax.scatter(
            embeddings_2d[idx, 0], embeddings_2d[idx, 1],
            c=[cmap(i)], label=class_names[label] if class_names else f"Class {label}",
            alpha=alpha, s=marker_size
        )
    
    ax.set_title(title)
    ax.legend()
    ax.grid(alpha=0.3)
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
    
    return fig, ax


def plot_embedding_distances(embeddings, labels, class_names=None, title="Embedding Distances", 
                          figsize=(12, 10), save_path=None):
    """
    Plot distance matrix between embeddings
    
    Args:
        embeddings: Feature embeddings [num_samples, embedding_dim]
        labels: Class labels [num_samples]
        class_names: Optional list of class names
        title: Plot title
        figsize: Figure size
        save_path: Path to save the plot (None for display only)
        
    Returns:
        Figure and axes objects
    """
    try:
        import matplotlib.pyplot as plt
        import scipy.spatial.distance as distance
    except ImportError:
        logger.error("Visualization requires matplotlib and scipy.")
        return None, None
    
    # Convert embeddings to numpy if they're tensors
    if TF_AVAILABLE:
        if isinstance(embeddings, tf.Tensor):
            embeddings = embeddings.numpy()
    
    if TORCH_AVAILABLE:
        if isinstance(embeddings, torch.Tensor):
            embeddings = embeddings.detach().cpu().numpy()
    
    if isinstance(labels, (list, tuple)):
        labels = np.array(labels)
    
    # Convert one-hot labels to indices if needed
    if len(labels.shape) > 1 and labels.shape[1] > 1:
        labels = np.argmax(labels, axis=1)
    
    # Normalize embeddings
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    normalized_embeddings = embeddings / norms
    
    # Calculate distance matrix
    dist_matrix = distance.squareform(distance.pdist(normalized_embeddings, 'cosine'))
    
    # Sort by class labels
    sort_idx = np.argsort(labels)
    sorted_dist_matrix = dist_matrix[sort_idx][:, sort_idx]
    sorted_labels = labels[sort_idx]
    
    # Create plot
    fig, ax = plt.subplots(figsize=figsize)
    
    # Plot distance matrix
    im = ax.imshow(sorted_dist_matrix, cmap='viridis', interpolation='nearest')
    plt.colorbar(im, ax=ax, label='Cosine Distance')
    
    # Add class boundary lines
    unique_labels = np.unique(sorted_labels)
    boundaries = []
    
    for i in range(len(unique_labels)-1):
        last_idx = np.where(sorted_labels == unique_labels[i])[0][-1]
        boundaries.append(last_idx + 0.5)
    
    for b in boundaries:
        ax.axhline(y=b, color='r', linestyle='-', linewidth=1)
        ax.axvline(x=b, color='r', linestyle='-', linewidth=1)
    
    ax.set_title(title)
    
    # Add class labels to axes
    if class_names:
        # Calculate midpoints for ticks
        label_positions = []
        for label in unique_labels:
            indices = np.where(sorted_labels == label)[0]
            midpoint = (indices[0] + indices[-1]) / 2
            label_positions.append(midpoint)
        
        class_label_names = [class_names[label] for label in unique_labels]
        
        # Set tick labels
        ax.set_xticks(label_positions)
        ax.set_xticklabels(class_label_names, rotation=45, ha='right')
        ax.set_yticks(label_positions)
        ax.set_yticklabels(class_label_names)
    
    # Add grid lines
    ax.set_xticks(np.arange(-.5, len(sorted_labels), 1), minor=True)
    ax.set_yticks(np.arange(-.5, len(sorted_labels), 1), minor=True)
    ax.grid(which='minor', color='w', linestyle='-', linewidth=0.5, alpha=0.2)
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
    
    return fig, ax


# Example usage
if __name__ == "__main__":
    print("Testing embedding loss functions")
    
    # Example parameters
    num_classes = 10
    embedding_dim = 128
    batch_size = 16
    
    # Generate random embeddings and labels for testing
    np.random.seed(0)
    embeddings = np.random.randn(batch_size, embedding_dim)
    labels = np.random.randint(0, num_classes, size=batch_size)
    
    # Test TensorFlow losses
    if TF_AVAILABLE:
        print("\nTensorFlow Implementations:")
        
        # Convert to TensorFlow tensors
        tf_embeddings = tf.convert_to_tensor(embeddings, dtype=tf.float32)
        tf_labels = tf.convert_to_tensor(labels, dtype=tf.int32)
        tf_labels_onehot = tf.one_hot(tf_labels, depth=num_classes)
        
        # Test Center Loss
        center_loss_fn = get_embedding_loss('center', 'tensorflow', num_classes, embedding_dim)
        center_loss_val = center_loss_fn(tf_labels_onehot, tf_embeddings)
        print(f"Center Loss: {center_loss_val.numpy():.4f}")
        
        # Test ArcFace
        arcface_loss_fn = get_embedding_loss('arcface', 'tensorflow', num_classes, embedding_dim)
        arcface_loss_val = arcface_loss_fn(tf_labels_onehot, tf_embeddings)
        print(f"ArcFace Loss: {arcface_loss_val.numpy():.4f}")
        
        # Test CosFace
        cosface_loss_fn = get_embedding_loss('cosface', 'tensorflow', num_classes, embedding_dim)
        cosface_loss_val = cosface_loss_fn(tf_labels_onehot, tf_embeddings)
        print(f"CosFace Loss: {cosface_loss_val.numpy():.4f}")
        
        # Test Triplet Loss
        triplet_loss_fn = get_embedding_loss('triplet', 'tensorflow', num_classes, embedding_dim)
        triplet_loss_val = triplet_loss_fn(tf_labels, tf_embeddings)
        print(f"Triplet Loss: {triplet_loss_val.numpy():.4f}")
        
        # Test Combined Loss
        combined_loss_fn = get_embedding_loss('combined', 'tensorflow', num_classes, embedding_dim)
        combined_loss_val = combined_loss_fn(tf_labels_onehot, tf_embeddings)
        print(f"Combined Loss: {combined_loss_val.numpy():.4f}")
    
    # Test PyTorch losses
    if TORCH_AVAILABLE:
        print("\nPyTorch Implementations:")
        
        # Convert to PyTorch tensors
        torch_embeddings = torch.tensor(embeddings, dtype=torch.float32)
        torch_labels = torch.tensor(labels, dtype=torch.long)
        
        # Test Center Loss
        center_loss_fn = get_embedding_loss('center', 'pytorch', num_classes, embedding_dim)
        center_loss_val = center_loss_fn(torch_embeddings, torch_labels)
        print(f"Center Loss: {center_loss_val.item():.4f}")
        
        # Test ArcFace
        arcface_loss_fn = get_embedding_loss('arcface', 'pytorch', num_classes, embedding_dim)
        arcface_logits = arcface_loss_fn(torch_embeddings, torch_labels)
        arcface_loss_val = F.cross_entropy(arcface_logits, torch_labels)
        print(f"ArcFace Loss: {arcface_loss_val.item():.4f}")
        
        # Test CosFace
        cosface_loss_fn = get_embedding_loss('cosface', 'pytorch', num_classes, embedding_dim)
        cosface_logits = cosface_loss_fn(torch_embeddings, torch_labels)
        cosface_loss_val = F.cross_entropy(cosface_logits, torch_labels)
        print(f"CosFace Loss: {cosface_loss_val.item():.4f}")
        
        # Test Triplet Loss
        triplet_loss_fn = get_embedding_loss('triplet', 'pytorch', num_classes, embedding_dim)
        triplet_loss_val = triplet_loss_fn(torch_labels, torch_embeddings)
        print(f"Triplet Loss: {triplet_loss_val.item():.4f}")
        
        # Test Combined Loss
        combined_loss_fn = get_embedding_loss('combined', 'pytorch', num_classes, embedding_dim)
        combined_loss_val = combined_loss_fn(torch_embeddings, torch_labels)
        print(f"Combined Loss: {combined_loss_val.item():.4f}")