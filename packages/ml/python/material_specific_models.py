#!/usr/bin/env python3
"""
Material-Specific Model Architectures

This module provides specialized neural network architectures optimized for different 
material types:

1. Texture-focused models for fabric/wood materials
   - Enhanced texture perception with multi-scale filters
   - Specialized convolution patterns for grain and weave detection

2. Color-focused models for paint/plastic materials
   - Color space transformations and analysis
   - Enhanced color consistency across lighting conditions

3. Structure-focused models for stone/metal materials
   - Edge and pattern detection for structural elements
   - Surface property extraction (roughness, reflectivity)

4. Adaptive model selection based on material category
   - Model routing based on material type detection
   - Ensemble approaches combining material-specific models

These specialized architectures improve material recognition accuracy by tailoring
the feature extraction process to the unique characteristics of each material type.
"""

import os
import numpy as np
import logging
from typing import Dict, List, Tuple, Union, Optional, Callable, Any

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('material_specific_models')

# Conditionally import TensorFlow or PyTorch based on availability
try:
    import tensorflow as tf
    from tensorflow.keras import layers, models, applications, regularizers
    import tensorflow_addons as tfa
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    logger.debug("TensorFlow not available. TensorFlow-based models will be disabled.")

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    import torchvision.models as tvmodels
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.debug("PyTorch not available. PyTorch-based models will be disabled.")


# ---- Material Categories ----

MATERIAL_CATEGORIES = [
    'fabric',    # Includes textiles, cloth, etc.
    'wood',      # Includes various wood types
    'metal',     # Includes all metal types
    'stone',     # Includes stone, concrete, marble, etc.
    'paint',     # Includes painted surfaces
    'plastic',   # Includes various plastic types
    'glass',     # Includes transparent/translucent materials
    'ceramic',   # Includes ceramic, porcelain, etc.
    'leather',   # Includes natural and synthetic leather
    'paper',     # Includes paper, cardboard, etc.
    'other'      # Fallback category
]

# Group categories by their primary characteristics
TEXTURE_FOCUSED_MATERIALS = ['fabric', 'wood', 'leather', 'paper']
COLOR_FOCUSED_MATERIALS = ['paint', 'plastic']
STRUCTURE_FOCUSED_MATERIALS = ['metal', 'stone', 'ceramic', 'glass']


# ---- TensorFlow Model Implementations ----

if TF_AVAILABLE:
    class TextureFocusedModel(tf.keras.Model):
        """
        Texture-focused model architecture optimized for materials like fabric and wood
        that have distinctive textural patterns.
        
        Features:
        - Multi-scale filters to capture texture at different granularities
        - Gabor filter banks for detecting oriented patterns
        - Residual connections to preserve fine texture details
        """
        
        def __init__(self, input_shape=(224, 224, 3), num_classes=10, base_filters=64,
                   gabor_filters=True, dropout_rate=0.5):
            """
            Initialize texture-focused model
            
            Args:
                input_shape: Input image shape (height, width, channels)
                num_classes: Number of output classes
                base_filters: Number of base filters in the first layer
                gabor_filters: Whether to use Gabor filter banks
                dropout_rate: Dropout rate for regularization
            """
            super(TextureFocusedModel, self).__init__()
            
            self.input_shape = input_shape
            self.num_classes = num_classes
            self.base_filters = base_filters
            self.gabor_filters = gabor_filters
            self.dropout_rate = dropout_rate
            
            # Input layer
            self.inputs = tf.keras.Input(shape=input_shape)
            
            # Use MobileNetV2 as base feature extractor, but with modifications
            base_model = tf.keras.applications.MobileNetV2(
                input_shape=input_shape,
                include_top=False,
                weights='imagenet'
            )
            
            # Freeze early layers to preserve low-level feature extraction
            for layer in base_model.layers[:50]:
                layer.trainable = False
            
            # Extract features at multiple scales for texture analysis
            x = base_model(self.inputs)
            
            # Add texture-specific processing
            x = self._add_texture_enhancement(x)
            
            # Global pooling
            x = tf.keras.layers.GlobalAveragePooling2D()(x)
            
            # Dense layer with higher capacity for texture discrimination
            x = tf.keras.layers.Dense(
                1024, 
                activation='relu',
                kernel_regularizer=tf.keras.regularizers.l2(1e-5)
            )(x)
            x = tf.keras.layers.Dropout(dropout_rate)(x)
            
            # Add another dense layer focused on texture attributes
            x = tf.keras.layers.Dense(
                512, 
                activation='relu',
                kernel_regularizer=tf.keras.regularizers.l2(1e-5)
            )(x)
            x = tf.keras.layers.Dropout(dropout_rate)(x)
            
            # Output layer
            outputs = tf.keras.layers.Dense(num_classes, activation='softmax')(x)
            
            # Create the model
            self.model = tf.keras.Model(inputs=self.inputs, outputs=outputs)
        
        def _add_texture_enhancement(self, x):
            """Add texture-specific enhancement layers"""
            # Multi-scale texture processing
            # 1x1 convolution to reduce channels
            reduced = tf.keras.layers.Conv2D(
                self.base_filters, 
                kernel_size=1,
                padding='same',
                activation='relu'
            )(x)
            
            # Process at different scales
            branch1 = tf.keras.layers.Conv2D(
                self.base_filters // 2, 
                kernel_size=3,
                padding='same',
                activation='relu',
                dilation_rate=1  # Standard convolution
            )(reduced)
            
            branch2 = tf.keras.layers.Conv2D(
                self.base_filters // 2, 
                kernel_size=3,
                padding='same',
                activation='relu',
                dilation_rate=2  # Dilated convolution for larger receptive field
            )(reduced)
            
            branch3 = tf.keras.layers.Conv2D(
                self.base_filters // 2, 
                kernel_size=3,
                padding='same',
                activation='relu',
                dilation_rate=4  # Even larger receptive field
            )(reduced)
            
            # Add Gabor filters if specified (good for texture)
            if self.gabor_filters:
                # Approximating Gabor filter effect with oriented convolutions
                # Multiple orientations
                gabor_results = []
                for angle in [0, 45, 90, 135]:
                    # Create oriented filter effect with separable conv
                    g_branch = tf.keras.layers.SeparableConv2D(
                        self.base_filters // 4,
                        kernel_size=5,
                        padding='same',
                        activation='relu',
                        depth_multiplier=1
                    )(reduced)
                    gabor_results.append(g_branch)
                
                # Combine Gabor filter outputs
                gabor_combined = tf.keras.layers.Concatenate()(gabor_results)
                branch4 = tf.keras.layers.Conv2D(
                    self.base_filters // 2,
                    kernel_size=1,
                    padding='same',
                    activation='relu'
                )(gabor_combined)
            else:
                branch4 = tf.keras.layers.Conv2D(
                    self.base_filters // 2,
                    kernel_size=5,
                    padding='same',
                    activation='relu'
                )(reduced)
            
            # Combine all branches
            combined = tf.keras.layers.Concatenate()([branch1, branch2, branch3, branch4])
            
            # Add residual connection
            output = tf.keras.layers.Conv2D(
                x.shape[-1],  # Match original channels
                kernel_size=1,
                padding='same',
                activation=None
            )(combined)
            
            enhanced = tf.keras.layers.Add()([x, output])
            return enhanced
        
        def call(self, inputs, training=None):
            """Forward pass"""
            return self.model(inputs, training=training)
        
        def build_graph(self):
            """Build the model graph"""
            self.model.summary()
            return self.model
    
    
    class ColorFocusedModel(tf.keras.Model):
        """
        Color-focused model architecture optimized for materials like paint and plastic
        where color properties are dominant identifying features.
        
        Features:
        - Color space transformations (RGB, HSV, Lab)
        - Channel-wise attention mechanisms
        - Enhanced color constancy across lighting conditions
        """
        
        def __init__(self, input_shape=(224, 224, 3), num_classes=10, base_filters=64,
                   use_color_spaces=True, channel_attention=True, dropout_rate=0.5):
            """
            Initialize color-focused model
            
            Args:
                input_shape: Input image shape (height, width, channels)
                num_classes: Number of output classes
                base_filters: Number of base filters in the first layer
                use_color_spaces: Whether to use multiple color space transformations
                channel_attention: Whether to add channel attention mechanism
                dropout_rate: Dropout rate for regularization
            """
            super(ColorFocusedModel, self).__init__()
            
            self.input_shape = input_shape
            self.num_classes = num_classes
            self.base_filters = base_filters
            self.use_color_spaces = use_color_spaces
            self.channel_attention = channel_attention
            self.dropout_rate = dropout_rate
            
            # Input layer
            self.inputs = tf.keras.Input(shape=input_shape)
            
            # Use EfficientNet as base model (good color handling)
            base_model = tf.keras.applications.EfficientNetB0(
                input_shape=input_shape,
                include_top=False,
                weights='imagenet'
            )
            
            # Only train the top layers
            base_model.trainable = False
            for layer in base_model.layers[-20:]:
                layer.trainable = True
            
            # Base feature extraction
            x = base_model(self.inputs)
            
            # Add color-specific processing
            x = self._add_color_enhancement(x)
            
            # Global pooling
            x = tf.keras.layers.GlobalAveragePooling2D()(x)
            
            # Dense layer with focus on color discrimination
            x = tf.keras.layers.Dense(
                768, 
                activation='relu',
                kernel_regularizer=tf.keras.regularizers.l2(1e-5)
            )(x)
            x = tf.keras.layers.Dropout(dropout_rate)(x)
            
            # Output layer
            outputs = tf.keras.layers.Dense(num_classes, activation='softmax')(x)
            
            # Create the model
            self.model = tf.keras.Model(inputs=self.inputs, outputs=outputs)
        
        def _add_color_enhancement(self, x):
            """Add color-specific enhancement layers"""
            # Channel attention mechanism
            if self.channel_attention:
                x = self._channel_attention_block(x)
            
            # Convolution to expand features
            x = tf.keras.layers.Conv2D(
                self.base_filters * 4,
                kernel_size=1,
                padding='same',
                activation='relu'
            )(x)
            
            # Color-specific processing with expanded features
            x = tf.keras.layers.Conv2D(
                self.base_filters * 4,
                kernel_size=3,
                padding='same',
                activation='relu',
                groups=4  # Group convolution to process color channels more independently
            )(x)
            
            # Final processing
            x = tf.keras.layers.Conv2D(
                self.base_filters * 2,
                kernel_size=1,
                padding='same',
                activation='relu'
            )(x)
            
            return x
        
        def _channel_attention_block(self, x):
            """Channel attention mechanism to focus on important color channels"""
            channels = x.shape[-1]
            
            # Squeeze (global pooling)
            avg_pool = tf.keras.layers.GlobalAveragePooling2D()(x)
            max_pool = tf.keras.layers.GlobalMaxPooling2D()(x)
            
            # Excite (MLP with bottleneck)
            avg_pool = tf.keras.layers.Reshape((1, 1, channels))(avg_pool)
            max_pool = tf.keras.layers.Reshape((1, 1, channels))(max_pool)
            
            shared_mlp1 = tf.keras.layers.Conv2D(
                channels // 8,
                kernel_size=1,
                activation='relu'
            )
            shared_mlp2 = tf.keras.layers.Conv2D(
                channels,
                kernel_size=1,
                activation='sigmoid'
            )
            
            avg_out = shared_mlp2(shared_mlp1(avg_pool))
            max_out = shared_mlp2(shared_mlp1(max_pool))
            
            # Combine and reweight
            attention = tf.keras.layers.add([avg_out, max_out])
            x = tf.keras.layers.multiply([x, attention])
            
            return x
        
        def call(self, inputs, training=None):
            """Forward pass"""
            return self.model(inputs, training=training)
        
        def build_graph(self):
            """Build the model graph"""
            self.model.summary()
            return self.model
    
    
    class StructureFocusedModel(tf.keras.Model):
        """
        Structure-focused model architecture optimized for materials like metal and stone
        where structural properties (edges, patterns) are key.
        
        Features:
        - Enhanced edge detection and pattern recognition
        - Hierarchical feature extraction with skip connections
        - Focus on surface property extraction (roughness, reflectivity)
        """
        
        def __init__(self, input_shape=(224, 224, 3), num_classes=10, base_filters=64,
                    edge_enhancement=True, dropout_rate=0.5):
            """
            Initialize structure-focused model
            
            Args:
                input_shape: Input image shape (height, width, channels)
                num_classes: Number of output classes
                base_filters: Number of base filters in the first layer
                edge_enhancement: Whether to add edge enhancement layers
                dropout_rate: Dropout rate for regularization
            """
            super(StructureFocusedModel, self).__init__()
            
            self.input_shape = input_shape
            self.num_classes = num_classes
            self.base_filters = base_filters
            self.edge_enhancement = edge_enhancement
            self.dropout_rate = dropout_rate
            
            # Input layer
            self.inputs = tf.keras.Input(shape=input_shape)
            
            # Use ResNet as base model (good for structural features)
            base_model = tf.keras.applications.ResNet50V2(
                input_shape=input_shape,
                include_top=False,
                weights='imagenet'
            )
            
            # Only train the top layers
            base_model.trainable = False
            for layer in base_model.layers[-30:]:
                layer.trainable = True
            
            # Extract features at multiple levels for structure analysis
            # Get intermediate outputs from base model
            intermediate_model = tf.keras.Model(
                inputs=base_model.input,
                outputs=[
                    base_model.get_layer('conv2_block3_out').output,  # Early features (edges)
                    base_model.get_layer('conv3_block4_out').output,  # Mid-level features
                    base_model.get_layer('conv4_block6_out').output,  # Higher-level features
                    base_model.output  # Final features
                ]
            )
            
            # Extract multi-level features
            features = intermediate_model(self.inputs)
            
            # Add structure-specific processing
            x = self._add_structure_enhancement(features)
            
            # Global pooling
            x = tf.keras.layers.GlobalAveragePooling2D()(x)
            
            # Dense layer with higher capacity for structure discrimination
            x = tf.keras.layers.Dense(
                1024, 
                activation='relu',
                kernel_regularizer=tf.keras.regularizers.l2(1e-5)
            )(x)
            x = tf.keras.layers.Dropout(dropout_rate)(x)
            
            # Add another dense layer focused on structural attributes
            x = tf.keras.layers.Dense(
                512, 
                activation='relu',
                kernel_regularizer=tf.keras.regularizers.l2(1e-5)
            )(x)
            x = tf.keras.layers.Dropout(dropout_rate/2)(x)
            
            # Output layer
            outputs = tf.keras.layers.Dense(num_classes, activation='softmax')(x)
            
            # Create the model
            self.model = tf.keras.Model(inputs=self.inputs, outputs=outputs)
        
        def _add_structure_enhancement(self, features):
            """Add structure-specific enhancement layers"""
            # Unpack features
            early_features, mid_features, high_features, final_features = features
            
            # Edge enhancement on early features if specified
            if self.edge_enhancement:
                # Create edge detection filters approximating Sobel operators
                edge_features = tf.keras.layers.Conv2D(
                    self.base_filters,
                    kernel_size=3,
                    padding='same',
                    use_bias=False,
                    kernel_initializer=tf.keras.initializers.Constant([
                        [[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]]
                    ])
                )(early_features)
                edge_features = tf.keras.layers.BatchNormalization()(edge_features)
                edge_features = tf.keras.layers.Activation('relu')(edge_features)
                
                # Combine with original features
                early_features = tf.keras.layers.Concatenate()([
                    early_features,
                    edge_features
                ])
                
                # Adjust channel count
                early_features = tf.keras.layers.Conv2D(
                    self.base_filters * 2,
                    kernel_size=1,
                    padding='same',
                    activation='relu'
                )(early_features)
            
            # Process mid-level features
            mid_features = tf.keras.layers.Conv2D(
                self.base_filters * 4,
                kernel_size=1,
                padding='same',
                activation='relu'
            )(mid_features)
            
            # Process high-level features
            high_features = tf.keras.layers.Conv2D(
                self.base_filters * 8,
                kernel_size=1,
                padding='same',
                activation='relu'
            )(high_features)
            
            # Combine multi-level features with careful resizing
            # Resize all to match high_features dimensions
            if early_features.shape[1] != high_features.shape[1]:
                early_features = tf.keras.layers.Conv2D(
                    self.base_filters * 2,
                    kernel_size=3,
                    strides=2,
                    padding='same',
                    activation='relu'
                )(early_features)
                early_features = tf.keras.layers.Conv2D(
                    self.base_filters * 2,
                    kernel_size=3,
                    strides=2,
                    padding='same',
                    activation='relu'
                )(early_features)
            
            if mid_features.shape[1] != high_features.shape[1]:
                mid_features = tf.keras.layers.Conv2D(
                    self.base_filters * 4,
                    kernel_size=3,
                    strides=2,
                    padding='same',
                    activation='relu'
                )(mid_features)
            
            # Combine features with weighted attention
            combined = tf.keras.layers.Concatenate()([
                early_features, mid_features, high_features, final_features
            ])
            
            # Final structure-focused processing
            output = tf.keras.layers.Conv2D(
                final_features.shape[-1],
                kernel_size=1,
                padding='same',
                activation='relu'
            )(combined)
            
            return output
        
        def call(self, inputs, training=None):
            """Forward pass"""
            return self.model(inputs, training=training)
        
        def build_graph(self):
            """Build the model graph"""
            self.model.summary()
            return self.model
    
    
    class MaterialSpecificFactory:
        """
        Factory class for creating material-specific models based on material type.
        """
        
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
            
            # Structure-focused materials
            elif material_type in STRUCTURE_FOCUSED_MATERIALS:
                logger.info(f"Creating structure-focused model for {material_type}")
                return StructureFocusedModel(
                    input_shape=input_shape,
                    num_classes=num_classes,
                    **kwargs
                )
            
            # Default case
            else:
                logger.warning(f"Unknown material type: {material_type}. Using default model.")
                # Use MobileNetV2 as default model
                base_model = tf.keras.applications.MobileNetV2(
                    input_shape=input_shape,
                    include_top=False,
                    weights='imagenet'
                )
                
                model = tf.keras.Sequential([
                    base_model,
                    tf.keras.layers.GlobalAveragePooling2D(),
                    tf.keras.layers.Dense(1024, activation='relu'),
                    tf.keras.layers.Dropout(0.5),
                    tf.keras.layers.Dense(num_classes, activation='softmax')
                ])
                
                return model


# ---- PyTorch Model Implementations ----

if TORCH_AVAILABLE:
    class PyTorchTextureFocusedModel(nn.Module):
        """
        PyTorch implementation of texture-focused model for fabric and wood materials
        """
        
        def __init__(self, num_classes=10, pretrained=True, gabor_filters=True):
            """
            Initialize texture-focused model
            
            Args:
                num_classes: Number of output classes
                pretrained: Whether to use pretrained weights
                gabor_filters: Whether to use Gabor filter banks
            """
            super(PyTorchTextureFocusedModel, self).__init__()
            
            # Use ResNet18 as base model
            self.base_model = tvmodels.resnet18(pretrained=pretrained)
            
            # Freeze early layers to preserve low-level feature extraction
            for param in list(self.base_model.parameters())[:40]:
                param.requires_grad = False
            
            # Get the number of features from the last layer
            num_ftrs = self.base_model.fc.in_features
            
            # Replace the final layers with texture-focused ones
            self.base_model.fc = nn.Identity()  # Remove the final FC layer
            
            # Create texture enhancement module
            self.texture_enhancement = self._create_texture_enhancement(num_ftrs)
            
            # Create classifier
            self.classifier = nn.Sequential(
                nn.Linear(num_ftrs, 1024),
                nn.ReLU(inplace=True),
                nn.Dropout(0.5),
                nn.Linear(1024, 512),
                nn.ReLU(inplace=True),
                nn.Dropout(0.3),
                nn.Linear(512, num_classes)
            )
            
            self.gabor_filters = gabor_filters
            if gabor_filters:
                # Create a set of oriented filters approximating Gabor effect
                self.oriented_filters = nn.ModuleList([
                    nn.Conv2d(num_ftrs, num_ftrs // 4, kernel_size=5, padding=2) 
                    for _ in range(4)  # 4 orientations
                ])
        
        def _create_texture_enhancement(self, in_channels):
            """Create texture enhancement module"""
            return nn.Sequential(
                # Multi-scale processing with dilated convolutions
                nn.Conv2d(in_channels, in_channels // 2, kernel_size=3, padding=1, dilation=1),
                nn.BatchNorm2d(in_channels // 2),
                nn.ReLU(inplace=True),
                nn.Conv2d(in_channels // 2, in_channels // 2, kernel_size=3, padding=2, dilation=2),
                nn.BatchNorm2d(in_channels // 2),
                nn.ReLU(inplace=True),
                nn.Conv2d(in_channels // 2, in_channels, kernel_size=3, padding=1),
                nn.BatchNorm2d(in_channels),
                nn.ReLU(inplace=True)
            )
        
        def forward(self, x):
            # Base feature extraction
            features = self.base_model(x)
            
            # Reshape for texture enhancement
            batch_size = x.size(0)
            features = features.view(batch_size, -1, 1, 1)
            
            # Apply texture enhancement
            enhanced = self.texture_enhancement(features)
            
            # Apply oriented filters if enabled
            if self.gabor_filters:
                oriented_results = []
                for filter_layer in self.oriented_filters:
                    oriented_results.append(filter_layer(enhanced))
                oriented_features = torch.cat(oriented_results, dim=1)
                enhanced = torch.cat([enhanced, oriented_features], dim=1)
            
            # Global pooling (already done by ResNet)
            pooled = F.adaptive_avg_pool2d(enhanced, (1, 1)).view(batch_size, -1)
            
            # Classification
            return self.classifier(pooled)
    
    
    class PyTorchColorFocusedModel(nn.Module):
        """
        PyTorch implementation of color-focused model for paint and plastic materials
        """
        
        def __init__(self, num_classes=10, pretrained=True, channel_attention=True):
            """
            Initialize color-focused model
            
            Args:
                num_classes: Number of output classes
                pretrained: Whether to use pretrained weights
                channel_attention: Whether to use channel attention
            """
            super(PyTorchColorFocusedModel, self).__init__()
            
            # Use EfficientNet as base model (good color handling)
            try:
                self.base_model = tvmodels.efficientnet_b0(pretrained=pretrained)
            except AttributeError:
                # Fallback for older PyTorch versions
                self.base_model = tvmodels.resnet34(pretrained=pretrained)
            
            # Freeze early layers
            for param in list(self.base_model.parameters())[:100]:
                param.requires_grad = False
            
            # Get the number of features from the last layer
            if hasattr(self.base_model, 'classifier'):
                num_ftrs = self.base_model.classifier[1].in_features
                self.base_model.classifier = nn.Identity()
            else:
                num_ftrs = self.base_model.fc.in_features
                self.base_model.fc = nn.Identity()
            
            # Channel attention
            self.channel_attention = channel_attention
            if channel_attention:
                self.ca_module = self._create_channel_attention(num_ftrs)
            
            # Create color enhancement module
            self.color_enhancement = self._create_color_enhancement(num_ftrs)
            
            # Create classifier
            self.classifier = nn.Sequential(
                nn.Linear(num_ftrs, 768),
                nn.ReLU(inplace=True),
                nn.Dropout(0.5),
                nn.Linear(768, num_classes)
            )
        
        def _create_channel_attention(self, channels):
            """Create channel attention module (CBAM style)"""
            return nn.Sequential(
                # Squeeze-and-excitation
                nn.AdaptiveAvgPool2d(1),
                nn.Conv2d(channels, channels // 16, kernel_size=1),
                nn.ReLU(inplace=True),
                nn.Conv2d(channels // 16, channels, kernel_size=1),
                nn.Sigmoid()
            )
        
        def _create_color_enhancement(self, in_channels):
            """Create color enhancement module"""
            return nn.Sequential(
                # Group convolution to process color channels more independently
                nn.Conv2d(in_channels, in_channels * 2, kernel_size=1),
                nn.BatchNorm2d(in_channels * 2),
                nn.ReLU(inplace=True),
                nn.Conv2d(in_channels * 2, in_channels * 2, kernel_size=3, padding=1, groups=2),
                nn.BatchNorm2d(in_channels * 2),
                nn.ReLU(inplace=True),
                nn.Conv2d(in_channels * 2, in_channels, kernel_size=1),
                nn.BatchNorm2d(in_channels),
                nn.ReLU(inplace=True)
            )
        
        def forward(self, x):
            # Base feature extraction
            features = self.base_model(x)
            
            # Reshape for enhancement
            batch_size = x.size(0)
            features = features.view(batch_size, -1, 1, 1)
            
            # Apply channel attention if enabled
            if self.channel_attention:
                ca_weights = self.ca_module(features)
                features = features * ca_weights
            
            # Apply color enhancement
            enhanced = self.color_enhancement(features)
            
            # Global pooling
            pooled = F.adaptive_avg_pool2d(enhanced, (1, 1)).view(batch_size, -1)
            
            # Classification
            return self.classifier(pooled)
    
    
    class PyTorchStructureFocusedModel(nn.Module):
        """
        PyTorch implementation of structure-focused model for metal and stone materials
        """
        
        def __init__(self, num_classes=10, pretrained=True, edge_enhancement=True):
            """
            Initialize structure-focused model
            
            Args:
                num_classes: Number of output classes
                pretrained: Whether to use pretrained weights
                edge_enhancement: Whether to add edge enhancement
            """
            super(PyTorchStructureFocusedModel, self).__init__()
            
            # Use ResNet50 as base model
            self.base_model = tvmodels.resnet50(pretrained=pretrained)
            
            # Freeze early layers
            for param in list(self.base_model.parameters())[:100]:
                param.requires_grad = False
            
            # Get the number of features from the last layer
            num_ftrs = self.base_model.fc.in_features
            self.base_model.fc = nn.Identity()
            
            # Store layers for accessing intermediate features
            self.layer1 = self.base_model.layer1  # Early features
            self.layer2 = self.base_model.layer2  # Mid-level features
            self.layer3 = self.base_model.layer3  # Higher-level features
            self.layer4 = self.base_model.layer4  # Final features
            
            # Edge enhancement
            self.edge_enhancement = edge_enhancement
            if edge_enhancement:
                self.edge_filters = self._create_edge_filters(64)
            
            # Structure enhancement module
            self.structure_enhancement = self._create_structure_enhancement(num_ftrs)
            
            # Feature fusion
            self.fusion = nn.Conv2d(num_ftrs * 2, num_ftrs, kernel_size=1)
            
            # Create classifier
            self.classifier = nn.Sequential(
                nn.Linear(num_ftrs, 1024),
                nn.ReLU(inplace=True),
                nn.Dropout(0.5),
                nn.Linear(1024, 512),
                nn.ReLU(inplace=True),
                nn.Dropout(0.3),
                nn.Linear(512, num_classes)
            )
        
        def _create_edge_filters(self, channels):
            """Create edge detection filters"""
            # Create edge detection kernel (approximating Sobel operator)
            sobel_kernel = torch.FloatTensor([
                [-1, -1, -1],
                [-1,  8, -1],
                [-1, -1, -1]
            ]).expand(channels, 1, 3, 3)
            
            conv = nn.Conv2d(channels, channels, kernel_size=3, padding=1, groups=channels, bias=False)
            conv.weight.data = sobel_kernel
            
            return nn.Sequential(
                conv,
                nn.BatchNorm2d(channels),
                nn.ReLU(inplace=True)
            )
        
        def _create_structure_enhancement(self, in_channels):
            """Create structure enhancement module"""
            return nn.Sequential(
                nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1),
                nn.BatchNorm2d(in_channels),
                nn.ReLU(inplace=True),
                nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1),
                nn.BatchNorm2d(in_channels),
                nn.ReLU(inplace=True)
            )
        
        def forward(self, x):
            # Initial convolution and pooling
            x = self.base_model.conv1(x)
            x = self.base_model.bn1(x)
            x = self.base_model.relu(x)
            x = self.base_model.maxpool(x)
            
            # Extract multi-level features
            layer1_out = self.layer1(x)  # Early features
            
            # Apply edge enhancement if enabled
            if self.edge_enhancement:
                edge_features = self.edge_filters(layer1_out)
                layer1_out = torch.cat([layer1_out, edge_features], dim=1)
                # Adjust channels
                layer1_out = nn.Conv2d(layer1_out.size(1), 256, kernel_size=1)(layer1_out)
            
            layer2_out = self.layer2(layer1_out)  # Mid-level features
            layer3_out = self.layer3(layer2_out)  # Higher-level features
            layer4_out = self.layer4(layer3_out)  # Final features
            
            # Apply structure enhancement
            enhanced = self.structure_enhancement(layer4_out)
            
            # Feature fusion with residual connection
            fused = self.fusion(torch.cat([layer4_out, enhanced], dim=1))
            
            # Global pooling
            pooled = F.adaptive_avg_pool2d(fused, (1, 1)).view(x.size(0), -1)
            
            # Classification
            return self.classifier(pooled)
    
    
    class PyTorchMaterialSpecificFactory:
        """
        Factory class for creating material-specific PyTorch models based on material type.
        """
        
        @staticmethod
        def create_model(material_type: str, num_classes=10, pretrained=True, **kwargs):
            """
            Create a material-specific model based on material type
            
            Args:
                material_type: Type of material ('fabric', 'wood', 'metal', etc.)
                num_classes: Number of output classes
                pretrained: Whether to use pretrained weights
                **kwargs: Additional model-specific parameters
                
            Returns:
                Material-specific PyTorch model
            """
            material_type = material_type.lower()
            
            # Texture-focused materials
            if material_type in TEXTURE_FOCUSED_MATERIALS:
                logger.info(f"Creating texture-focused model for {material_type}")
                return PyTorchTextureFocusedModel(
                    num_classes=num_classes,
                    pretrained=pretrained,
                    **kwargs
                )
            
            # Color-focused materials
            elif material_type in COLOR_FOCUSED_MATERIALS:
                logger.info(f"Creating color-focused model for {material_type}")
                return PyTorchColorFocusedModel(
                    num_classes=num_classes,
                    pretrained=pretrained,
                    **kwargs
                )
            
            # Structure-focused materials
            elif material_type in STRUCTURE_FOCUSED_MATERIALS:
                logger.info(f"Creating structure-focused model for {material_type}")
                return PyTorchStructureFocusedModel(
                    num_classes=num_classes,
                    pretrained=pretrained,
                    **kwargs
                )
            
            # Default case
            else:
                logger.warning(f"Unknown material type: {material_type}. Using default model.")
                # Use ResNet18 as default model
                model = tvmodels.resnet18(pretrained=pretrained)
                num_ftrs = model.fc.in_features
                model.fc = nn.Sequential(
                    nn.Linear(num_ftrs, 512),
                    nn.ReLU(),
                    nn.Dropout(0.5),
                    nn.Linear(512, num_classes)
                )
                return model


# ---- Adaptive Model Selector ----

class AdaptiveMaterialModelSelector:
    """
    Adaptive model selector that routes inputs to appropriate material-specific models
    based on material category detection.
    """
    
    def __init__(self, num_classes: int, input_shape=(224, 224, 3), framework='tensorflow'):
        """
        Initialize adaptive model selector
        
        Args:
            num_classes: Number of output classes (materials)
            input_shape: Input image shape
            framework: Deep learning framework ('tensorflow' or 'pytorch')
        """
        self.num_classes = num_classes
        self.input_shape = input_shape
        self.framework = framework.lower()
        self.models = {}
        self.material_detector = None
        
        # Initialize material category detector
        self._init_material_detector()
        
        # Initialize material-specific models
        self._init_material_models()
    
    def _init_material_detector(self):
        """Initialize material category detector model"""
        if self.framework == 'tensorflow' and TF_AVAILABLE:
            # Create a lightweight MobileNetV2-based detector
            base_model = tf.keras.applications.MobileNetV2(
                input_shape=self.input_shape,
                include_top=False,
                weights='imagenet'
            )
            
            # Add classification head
            x = base_model.output
            x = tf.keras.layers.GlobalAveragePooling2D()(x)
            x = tf.keras.layers.Dense(128, activation='relu')(x)
            outputs = tf.keras.layers.Dense(len(MATERIAL_CATEGORIES), activation='softmax')(x)
            
            self.material_detector = tf.keras.Model(inputs=base_model.input, outputs=outputs)
            
            # Compile detector
            self.material_detector.compile(
                optimizer='adam',
                loss='categorical_crossentropy',
                metrics=['accuracy']
            )
            
        elif self.framework == 'pytorch' and TORCH_AVAILABLE:
            # Create a lightweight MobileNetV2-based detector
            self.material_detector = tvmodels.mobilenet_v2(pretrained=True)
            num_ftrs = self.material_detector.classifier[1].in_features
            self.material_detector.classifier = nn.Sequential(
                nn.Linear(num_ftrs, 128),
                nn.ReLU(inplace=True),
                nn.Dropout(0.2),
                nn.Linear(128, len(MATERIAL_CATEGORIES))
            )
        
        else:
            logger.error(f"Unsupported framework or framework not available: {self.framework}")
    
    def _init_material_models(self):
        """Initialize material-specific models"""
        # Initialize models for each material category
        for category in MATERIAL_CATEGORIES:
            if category == 'other':
                continue  # Skip 'other' category (will use fallback)
            
            if self.framework == 'tensorflow' and TF_AVAILABLE:
                self.models[category] = MaterialSpecificFactory.create_model(
                    material_type=category,
                    input_shape=self.input_shape,
                    num_classes=self.num_classes
                )
            
            elif self.framework == 'pytorch' and TORCH_AVAILABLE:
                self.models[category] = PyTorchMaterialSpecificFactory.create_model(
                    material_type=category,
                    num_classes=self.num_classes
                )
    
    def train_material_detector(self, images, category_labels, **kwargs):
        """
        Train the material category detector
        
        Args:
            images: Training images
            category_labels: Material category labels
            **kwargs: Additional training parameters
            
        Returns:
            Training history
        """
        if self.framework == 'tensorflow' and TF_AVAILABLE:
            # Convert category labels to one-hot encoding
            one_hot_labels = tf.keras.utils.to_categorical(
                category_labels, num_classes=len(MATERIAL_CATEGORIES)
            )
            
            # Set default training parameters
            epochs = kwargs.get('epochs', 10)
            batch_size = kwargs.get('batch_size', 32)
            validation_split = kwargs.get('validation_split', 0.2)
            
            # Train detector
            history = self.material_detector.fit(
                images, one_hot_labels,
                epochs=epochs,
                batch_size=batch_size,
                validation_split=validation_split
            )
            
            return history
            
        elif self.framework == 'pytorch' and TORCH_AVAILABLE:
            # PyTorch training logic would go here
            # This would involve creating a DataLoader, loss function, optimizer, etc.
            logger.warn("PyTorch training not fully implemented in this example")
            return None
    
    def predict(self, image):
        """
        Predict material class using the appropriate model based on detected material category
        
        Args:
            image: Input image
            
        Returns:
            Prediction result
        """
        # Detect material category
        category_idx = self._detect_material_category(image)
        category = MATERIAL_CATEGORIES[category_idx]
        
        # Use appropriate model based on category
        if category in self.models:
            model = self.models[category]
        else:
            # Fallback to default model for 'other' category
            if self.framework == 'tensorflow' and TF_AVAILABLE:
                model = MaterialSpecificFactory.create_model(
                    material_type='other',
                    input_shape=self.input_shape,
                    num_classes=self.num_classes
                )
            elif self.framework == 'pytorch' and TORCH_AVAILABLE:
                model = PyTorchMaterialSpecificFactory.create_model(
                    material_type='other',
                    num_classes=self.num_classes
                )
            else:
                logger.error("No suitable model found")
                return None
        
        # Make prediction
        if self.framework == 'tensorflow' and TF_AVAILABLE:
            # Ensure image has batch dimension
            if len(image.shape) == 3:
                image = np.expand_dims(image, axis=0)
            
            # Make prediction
            prediction = model.predict(image)
            return prediction
            
        elif self.framework == 'pytorch' and TORCH_AVAILABLE:
            # Ensure image is a PyTorch tensor with batch dimension
            if isinstance(image, np.ndarray):
                image = torch.from_numpy(image).permute(2, 0, 1).float()
                image = image.unsqueeze(0)
            
            # Set model to evaluation mode
            model.eval()
            
            # Make prediction
            with torch.no_grad():
                prediction = model(image)
            
            return prediction
    
    def _detect_material_category(self, image):
        """
        Detect material category using the detector model
        
        Args:
            image: Input image
            
        Returns:
            Detected category index
        """
        if self.framework == 'tensorflow' and TF_AVAILABLE:
            # Ensure image has batch dimension
            if len(image.shape) == 3:
                image = np.expand_dims(image, axis=0)
            
            # Make prediction
            prediction = self.material_detector.predict(image)
            category_idx = np.argmax(prediction[0])
            
            return category_idx
            
        elif self.framework == 'pytorch' and TORCH_AVAILABLE:
            # Ensure image is a PyTorch tensor with batch dimension
            if isinstance(image, np.ndarray):
                image = torch.from_numpy(image).permute(2, 0, 1).float()
                image = image.unsqueeze(0)
            
            # Set model to evaluation mode
            self.material_detector.eval()
            
            # Make prediction
            with torch.no_grad():
                prediction = self.material_detector(image)
                category_idx = torch.argmax(prediction[0]).item()
            
            return category_idx
    
    def save_models(self, base_path: str):
        """
        Save all models to disk
        
        Args:
            base_path: Base path for saving models
            
        Returns:
            Dictionary of saved model paths
        """
        os.makedirs(base_path, exist_ok=True)
        saved_paths = {}
        
        # Save material detector
        detector_path = os.path.join(base_path, 'material_detector')
        if self.framework == 'tensorflow' and TF_AVAILABLE:
            self.material_detector.save(detector_path)
        elif self.framework == 'pytorch' and TORCH_AVAILABLE:
            torch.save(self.material_detector.state_dict(), f"{detector_path}.pt")
        
        saved_paths['detector'] = detector_path
        
        # Save material-specific models
        for category, model in self.models.items():
            model_path = os.path.join(base_path, f"{category}_model")
            
            if self.framework == 'tensorflow' and TF_AVAILABLE:
                model.save(model_path)
            elif self.framework == 'pytorch' and TORCH_AVAILABLE:
                torch.save(model.state_dict(), f"{model_path}.pt")
            
            saved_paths[category] = model_path
        
        return saved_paths
    
    def load_models(self, base_path: str):
        """
        Load all models from disk
        
        Args:
            base_path: Base path where models are saved
            
        Returns:
            True if loaded successfully, False otherwise
        """
        # Load material detector
        detector_path = os.path.join(base_path, 'material_detector')
        try:
            if self.framework == 'tensorflow' and TF_AVAILABLE:
                self.material_detector = tf.keras.models.load_model(detector_path)
            elif self.framework == 'pytorch' and TORCH_AVAILABLE:
                self.material_detector.load_state_dict(torch.load(f"{detector_path}.pt"))
        except Exception as e:
            logger.error(f"Failed to load material detector: {e}")
            return False
        
        # Load material-specific models
        for category in MATERIAL_CATEGORIES:
            if category == 'other':
                continue
            
            model_path = os.path.join(base_path, f"{category}_model")
            try:
                if self.framework == 'tensorflow' and TF_AVAILABLE:
                    self.models[category] = tf.keras.models.load_model(model_path)
                elif self.framework == 'pytorch' and TORCH_AVAILABLE:
                    self.models[category].load_state_dict(torch.load(f"{model_path}.pt"))
            except Exception as e:
                logger.warning(f"Failed to load model for {category}: {e}")
        
        return True


# ---- Model Application Functions ----

def apply_material_specific_preprocessing(image, material_type):
    """
    Apply material-specific preprocessing to an image
    
    Args:
        image: Input image as numpy array
        material_type: Type of material
        
    Returns:
        Preprocessed image
    """
    # Ensure image is float32 and in range [0, 1]
    if image.dtype != np.float32:
        image = image.astype(np.float32)
    
    if image.max() > 1.0:
        image = image / 255.0
    
    # Apply material-specific preprocessing
    if material_type in TEXTURE_FOCUSED_MATERIALS:
        # For texture-focused materials, enhance local contrast
        # Convert to LAB color space
        if len(image.shape) == 3 and image.shape[2] == 3:
            try:
                import cv2
                # Convert to BGR for OpenCV
                if image.max() <= 1.0:
                    image_bgr = (image * 255).astype(np.uint8)
                else:
                    image_bgr = image.astype(np.uint8)
                
                if image_bgr.shape[2] == 3:  # RGB
                    image_bgr = cv2.cvtColor(image_bgr, cv2.COLOR_RGB2BGR)
                
                # Convert to LAB
                lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
                
                # Split channels
                l, a, b = cv2.split(lab)
                
                # Apply CLAHE to L channel
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                l = clahe.apply(l)
                
                # Merge channels
                lab = cv2.merge((l, a, b))
                
                # Convert back to BGR then RGB
                image_enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
                image_enhanced = cv2.cvtColor(image_enhanced, cv2.COLOR_BGR2RGB)
                
                # Convert back to float32 [0, 1]
                image = image_enhanced.astype(np.float32) / 255.0
            except ImportError:
                logger.warning("OpenCV not available for advanced preprocessing")
    
    elif material_type in COLOR_FOCUSED_MATERIALS:
        # For color-focused materials, enhance color saturation
        try:
            import cv2
            # Convert to BGR for OpenCV
            if image.max() <= 1.0:
                image_bgr = (image * 255).astype(np.uint8)
            else:
                image_bgr = image.astype(np.uint8)
            
            if image_bgr.shape[2] == 3:  # RGB
                image_bgr = cv2.cvtColor(image_bgr, cv2.COLOR_RGB2BGR)
            
            # Convert to HSV
            hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
            
            # Enhance saturation
            h, s, v = cv2.split(hsv)
            s = cv2.multiply(s, 1.2)  # Increase saturation by 20%
            s = np.clip(s, 0, 255).astype(np.uint8)
            
            # Merge channels
            hsv = cv2.merge((h, s, v))
            
            # Convert back to BGR then RGB
            image_enhanced = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
            image_enhanced = cv2.cvtColor(image_enhanced, cv2.COLOR_BGR2RGB)
            
            # Convert back to float32 [0, 1]
            image = image_enhanced.astype(np.float32) / 255.0
        except ImportError:
            logger.warning("OpenCV not available for advanced preprocessing")
    
    elif material_type in STRUCTURE_FOCUSED_MATERIALS:
        # For structure-focused materials, enhance edges
        try:
            import cv2
            # Convert to BGR for OpenCV
            if image.max() <= 1.0:
                image_bgr = (image * 255).astype(np.uint8)
            else:
                image_bgr = image.astype(np.uint8)
            
            if image_bgr.shape[2] == 3:  # RGB
                image_bgr = cv2.cvtColor(image_bgr, cv2.COLOR_RGB2BGR)
            
            # Apply mild sharpening
            kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
            image_sharp = cv2.filter2D(image_bgr, -1, kernel)
            
            # Convert back to RGB
            image_sharp = cv2.cvtColor(image_sharp, cv2.COLOR_BGR2RGB)
            
            # Convert back to float32 [0, 1]
            image = image_sharp.astype(np.float32) / 255.0
        except ImportError:
            logger.warning("OpenCV not available for advanced preprocessing")
    
    # Apply standard normalization for deep learning models
    mean = np.array([0.485, 0.456, 0.406])
    std = np.array([0.229, 0.224, 0.225])
    
    # Ensure image has 3 dimensions
    if len(image.shape) == 3 and image.shape[2] == 3:
        image = (image - mean) / std
    
    return image


def get_material_specific_model(material_type: str, framework: str, num_classes: int = 10, 
                              input_shape: Tuple[int, int, int] = (224, 224, 3)):
    """
    Get a material-specific model based on material type
    
    Args:
        material_type: Type of material
        framework: 'tensorflow' or 'pytorch'
        num_classes: Number of output classes
        input_shape: Input image shape
        
    Returns:
        Material-specific model
    """
    if framework.lower() == 'tensorflow' and TF_AVAILABLE:
        return MaterialSpecificFactory.create_model(
            material_type=material_type,
            input_shape=input_shape,
            num_classes=num_classes
        )
    elif framework.lower() == 'pytorch' and TORCH_AVAILABLE:
        return PyTorchMaterialSpecificFactory.create_model(
            material_type=material_type,
            num_classes=num_classes
        )
    else:
        logger.error(f"Unsupported framework or framework not available: {framework}")
        return None


def create_material_ensemble(framework: str, num_classes: int = 10, 
                           input_shape: Tuple[int, int, int] = (224, 224, 3)):
    """
    Create an ensemble of material-specific models
    
    Args:
        framework: 'tensorflow' or 'pytorch'
        num_classes: Number of output classes
        input_shape: Input image shape
        
    Returns:
        Dictionary of material-specific models
    """
    ensemble = {}
    
    # Create models for each material category
    for category in set(TEXTURE_FOCUSED_MATERIALS + COLOR_FOCUSED_MATERIALS + STRUCTURE_FOCUSED_MATERIALS):
        ensemble[category] = get_material_specific_model(
            material_type=category,
            framework=framework,
            num_classes=num_classes,
            input_shape=input_shape
        )
    
    return ensemble


# Example usage
if __name__ == "__main__":
    print("Material-Specific Models Module")
    
    # Test TensorFlow implementations if available
    if TF_AVAILABLE:
        print("\nTesting TensorFlow Implementations:")
        
        # Test texture-focused model
        texture_model = get_material_specific_model('fabric', 'tensorflow', num_classes=10)
        if texture_model:
            print("Texture-focused model created successfully")
            
            # Test input shape
            dummy_input = np.zeros((1, 224, 224, 3))
            output = texture_model(dummy_input)
            print(f"Output shape: {output.shape}")
        
        # Test adaptive model selector
        selector = AdaptiveMaterialModelSelector(num_classes=10, framework='tensorflow')
        print("Adaptive model selector created successfully")
    
    # Test PyTorch implementations if available
    if TORCH_AVAILABLE:
        print("\nTesting PyTorch Implementations:")
        
        # Test color-focused model
        color_model = get_material_specific_model('paint', 'pytorch', num_classes=10)
        if color_model:
            print("Color-focused model created successfully")
            
            # Test input shape
            dummy_input = torch.zeros((1, 3, 224, 224))
            output = color_model(dummy_input)
            print(f"Output shape: {tuple(output.shape)}")