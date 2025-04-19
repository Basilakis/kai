#!/usr/bin/env python3
"""
Domain-Specific Neural Networks for Material Analysis

This module implements specialized neural network architectures for material
texture analysis, with features including:

1. Texture-specific convolutional filters and attention mechanisms
2. Multi-scale analysis for different detail levels
3. Specialized loss functions for texture understanding
4. Efficient implementation with ONNX export support

These domain-specific networks are designed to outperform general-purpose
networks for material classification and attribute prediction tasks.
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
import math
import cv2
from tqdm import tqdm

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('domain_specific_networks')

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
    logger.warning("PyTorch not available. Domain-specific networks will be limited.")

try:
    import tensorflow as tf
    from tensorflow.keras import applications, layers, models as tf_models
    from tensorflow.keras.optimizers import Adam as TFAdam
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    logger.warning("TensorFlow not available. Domain-specific networks will be limited.")

# Make sure at least one framework is available
if not TORCH_AVAILABLE and not TF_AVAILABLE:
    logger.error("No deep learning framework available. Domain-specific networks cannot be initialized.")


class TextureAttentionModule(nn.Module):
    """
    Attention module specifically designed for texture analysis.
    Implements a multi-head self-attention mechanism that focuses
    on texture patterns at different scales.
    """
    
    def __init__(self, 
                in_channels: int,
                heads: int = 8,
                dim_head: int = 64,
                dropout: float = 0.1):
        """
        Initialize the texture attention module
        
        Args:
            in_channels: Number of input channels
            heads: Number of attention heads
            dim_head: Dimension of each attention head
            dropout: Dropout rate
        """
        super().__init__()
        
        self.heads = heads
        self.dim_head = dim_head
        self.scale = dim_head ** -0.5
        inner_dim = dim_head * heads
        
        # Projections for query, key, value
        self.to_q = nn.Conv2d(in_channels, inner_dim, 1, bias=False)
        self.to_k = nn.Conv2d(in_channels, inner_dim, 1, bias=False)
        self.to_v = nn.Conv2d(in_channels, inner_dim, 1, bias=False)
        
        # Output projection
        self.to_out = nn.Sequential(
            nn.Conv2d(inner_dim, in_channels, 1),
            nn.Dropout(dropout)
        )
        
        # Texture-specific positional encoding (learnable)
        self.pos_enc = nn.Parameter(torch.randn(1, in_channels, 32, 32))
    
    def forward(self, x):
        """Forward pass"""
        # Get input shape
        b, c, h, w = x.shape
        
        # Add positional encoding
        pos_enc = F.interpolate(self.pos_enc, size=(h, w), mode='bilinear', align_corners=False)
        x = x + pos_enc
        
        # Project to queries, keys, values
        q = self.to_q(x)
        k = self.to_k(x)
        v = self.to_v(x)
        
        # Reshape for multi-head attention
        q = q.reshape(b, self.heads, self.dim_head, h * w).permute(0, 1, 3, 2)  # b, heads, h*w, dim_head
        k = k.reshape(b, self.heads, self.dim_head, h * w).permute(0, 1, 2, 3)  # b, heads, dim_head, h*w
        v = v.reshape(b, self.heads, self.dim_head, h * w).permute(0, 1, 3, 2)  # b, heads, h*w, dim_head
        
        # Attention
        attention = torch.matmul(q, k) * self.scale  # b, heads, h*w, h*w
        attention = F.softmax(attention, dim=-1)
        
        # Apply attention to values
        out = torch.matmul(attention, v)  # b, heads, h*w, dim_head
        out = out.permute(0, 1, 3, 2).reshape(b, self.heads * self.dim_head, h, w)
        
        # Output projection
        out = self.to_out(out)
        
        return out + x  # Residual connection


class TextureGaborFilters(nn.Module):
    """
    Texture-specific Gabor filter bank with learnable parameters.
    Implements a set of Gabor filters that can be optimized for
    texture analysis.
    """
    
    def __init__(self, 
                in_channels: int,
                out_channels: int,
                kernel_size: int = 7,
                num_orientations: int = 8,
                num_scales: int = 3):
        """
        Initialize the Gabor filter bank
        
        Args:
            in_channels: Number of input channels
            out_channels: Number of output channels
            kernel_size: Size of Gabor kernels
            num_orientations: Number of orientations
            num_scales: Number of scales
        """
        super().__init__()
        
        self.in_channels = in_channels
        self.out_channels = out_channels
        self.kernel_size = kernel_size
        self.num_orientations = num_orientations
        self.num_scales = num_scales
        
        # Calculate number of filters
        num_filters = num_orientations * num_scales
        out_per_filter = out_channels // num_filters
        
        # Ensure out_channels is divisible by num_filters
        if out_channels % num_filters != 0:
            logger.warning(f"out_channels {out_channels} not divisible by {num_filters}. Adjusting.")
            out_per_filter = max(1, out_per_filter)
        
        # Initialize Gabor filter parameters (learnable)
        self.sigma = nn.Parameter(torch.Tensor(num_scales).fill_(0.56 * kernel_size))
        self.theta = nn.Parameter(torch.Tensor(num_orientations).fill_(0.0))
        self.lambd = nn.Parameter(torch.Tensor(num_scales).fill_(10.0))
        self.gamma = nn.Parameter(torch.Tensor(1).fill_(0.5))
        self.psi = nn.Parameter(torch.Tensor(1).fill_(0.0))
        
        # Initialize weights for filter outputs
        self.filter_weights = nn.Parameter(torch.Tensor(out_channels, num_filters, in_channels))
        self.bias = nn.Parameter(torch.Tensor(out_channels))
        
        # Initialize parameters
        self._initialize_parameters()
    
    def _initialize_parameters(self):
        """Initialize parameters"""
        # Set theta to evenly spaced orientations
        for i in range(self.num_orientations):
            self.theta.data[i] = i * math.pi / self.num_orientations
        
        # Set sigma for different scales
        for i in range(self.num_scales):
            self.sigma.data[i] = (i + 1) * 0.56 * self.kernel_size / self.num_scales
        
        # Set lambda for different scales
        for i in range(self.num_scales):
            self.lambd.data[i] = 10.0 / (i + 1)
        
        # Initialize filter weights
        nn.init.kaiming_uniform_(self.filter_weights, a=math.sqrt(5))
        
        # Initialize bias
        fan_in, _ = nn.init._calculate_fan_in_and_fan_out(self.filter_weights)
        bound = 1 / math.sqrt(fan_in)
        nn.init.uniform_(self.bias, -bound, bound)
    
    def get_gabor_kernel(self, sigma, theta, lambd, gamma, psi):
        """Generate Gabor kernel"""
        # Create coordinate grid
        y_max, x_max = self.kernel_size, self.kernel_size
        y, x = torch.meshgrid(
            torch.linspace(-y_max / 2, y_max / 2, self.kernel_size),
            torch.linspace(-x_max / 2, x_max / 2, self.kernel_size)
        )
        
        # Rotation
        x_theta = x * torch.cos(theta) + y * torch.sin(theta)
        y_theta = -x * torch.sin(theta) + y * torch.cos(theta)
        
        # Calculate Gabor
        gb = torch.exp(
            -0.5 * (x_theta ** 2 + gamma ** 2 * y_theta ** 2) / sigma ** 2
        ) * torch.cos(2 * math.pi * x_theta / lambd + psi)
        
        return gb
    
    def forward(self, x):
        """Forward pass"""
        # Get input shape
        batch_size, channels, height, width = x.shape
        
        # Generate Gabor kernels
        kernels = []
        for s in range(self.num_scales):
            for o in range(self.num_orientations):
                kernel = self.get_gabor_kernel(
                    self.sigma[s], 
                    self.theta[o], 
                    self.lambd[s], 
                    self.gamma[0], 
                    self.psi[0]
                )
                kernels.append(kernel)
        
        # Apply Gabor filters
        gabor_outputs = []
        for i, kernel in enumerate(kernels):
            # Repeat kernel for each input channel
            kernel = kernel.repeat(channels, 1, 1, 1).to(x.device)
            
            # Apply filter
            output = F.conv2d(
                x, 
                kernel, 
                padding=self.kernel_size // 2, 
                groups=channels
            )
            
            gabor_outputs.append(output)
        
        # Stack outputs
        gabor_outputs = torch.stack(gabor_outputs, dim=1)  # [batch, num_filters, channels, height, width]
        
        # Apply learned weights
        out = torch.zeros(
            batch_size, 
            self.out_channels, 
            height, 
            width, 
            device=x.device
        )
        
        for i in range(self.out_channels):
            # Get weights for this output channel
            weights = self.filter_weights[i]  # [num_filters, channels]
            
            # Apply weights to Gabor outputs
            weighted = gabor_outputs * weights.view(1, -1, channels, 1, 1)
            
            # Sum over filters and channels
            channel_out = weighted.sum(dim=[1, 2])
            
            # Add bias
            channel_out = channel_out + self.bias[i]
            
            # Add to output
            out[:, i, :, :] = channel_out
        
        return out


class MultiScaleTextureModule(nn.Module):
    """
    Multi-scale texture analysis module that processes textures
    at different resolutions and combines the results.
    """
    
    def __init__(self, 
                channels: int,
                scales: List[int] = [1, 2, 4]):
        """
        Initialize the multi-scale texture module
        
        Args:
            channels: Number of channels
            scales: List of downsampling scales
        """
        super().__init__()
        
        self.channels = channels
        self.scales = scales
        
        # Create convolutions for each scale
        self.convs = nn.ModuleList([
            nn.Sequential(
                nn.Conv2d(channels, channels, 3, padding=1),
                nn.BatchNorm2d(channels),
                nn.ReLU(inplace=True)
            )
            for _ in scales
        ])
        
        # Fusion convolution
        self.fusion = nn.Sequential(
            nn.Conv2d(channels * len(scales), channels, 1),
            nn.BatchNorm2d(channels),
            nn.ReLU(inplace=True)
        )
    
    def forward(self, x):
        """Forward pass"""
        outputs = []
        
        for i, scale in enumerate(self.scales):
            # Skip downsampling for scale 1
            if scale == 1:
                scaled = x
            else:
                # Downsample
                scaled = F.interpolate(
                    x, 
                    scale_factor=1/scale, 
                    mode='bilinear', 
                    align_corners=False
                )
            
            # Apply convolution
            conv_out = self.convs[i](scaled)
            
            # Upsample back to original size if needed
            if scale != 1:
                conv_out = F.interpolate(
                    conv_out, 
                    size=(x.shape[2], x.shape[3]), 
                    mode='bilinear', 
                    align_corners=False
                )
            
            outputs.append(conv_out)
        
        # Concatenate outputs from different scales
        multi_scale = torch.cat(outputs, dim=1)
        
        # Apply fusion convolution
        out = self.fusion(multi_scale)
        
        return out + x  # Residual connection


class TextureResidualBlock(nn.Module):
    """
    Texture-specific residual block with multi-scale processing
    and attention mechanism.
    """
    
    def __init__(self, 
                channels: int,
                use_attention: bool = True,
                use_multi_scale: bool = True):
        """
        Initialize the texture residual block
        
        Args:
            channels: Number of channels
            use_attention: Whether to use attention mechanism
            use_multi_scale: Whether to use multi-scale processing
        """
        super().__init__()
        
        # First convolution
        self.conv1 = nn.Sequential(
            nn.Conv2d(channels, channels, 3, padding=1),
            nn.BatchNorm2d(channels),
            nn.ReLU(inplace=True)
        )
        
        # Second convolution
        self.conv2 = nn.Sequential(
            nn.Conv2d(channels, channels, 3, padding=1),
            nn.BatchNorm2d(channels)
        )
        
        # Optional attention module
        self.use_attention = use_attention
        if use_attention:
            self.attention = TextureAttentionModule(
                in_channels=channels,
                heads=8,
                dim_head=channels // 8
            )
        
        # Optional multi-scale module
        self.use_multi_scale = use_multi_scale
        if use_multi_scale:
            self.multi_scale = MultiScaleTextureModule(
                channels=channels
            )
        
        # Final activation
        self.relu = nn.ReLU(inplace=True)
    
    def forward(self, x):
        """Forward pass"""
        identity = x
        
        # First convolution
        out = self.conv1(x)
        
        # Second convolution
        out = self.conv2(out)
        
        # Apply attention if enabled
        if self.use_attention:
            out = self.attention(out)
        
        # Apply multi-scale if enabled
        if self.use_multi_scale:
            out = self.multi_scale(out)
        
        # Add residual connection
        out = out + identity
        
        # Apply final activation
        out = self.relu(out)
        
        return out


class TextureEnhancedBackbone(nn.Module):
    """
    Base class for texture-enhanced backbone networks.
    Adds texture-specific modules to standard CNN backbones.
    """
    
    def __init__(self, 
                base_model: nn.Module,
                in_channels: int,
                use_gabor: bool = True,
                use_texture_blocks: bool = True):
        """
        Initialize the texture-enhanced backbone
        
        Args:
            base_model: Base model to enhance
            in_channels: Number of input channels
            use_gabor: Whether to use Gabor filters
            use_texture_blocks: Whether to use texture residual blocks
        """
        super().__init__()
        
        self.base_model = base_model
        self.in_channels = in_channels
        
        # Optional Gabor filter bank
        self.use_gabor = use_gabor
        if use_gabor:
            self.gabor = TextureGaborFilters(
                in_channels=in_channels,
                out_channels=64,
                kernel_size=7,
                num_orientations=8,
                num_scales=3
            )
        
        # Optional texture residual blocks
        self.use_texture_blocks = use_texture_blocks
        if use_texture_blocks:
            # Detect where to insert texture blocks based on base model type
            if isinstance(base_model, models.ResNet):
                # Replace selected residual blocks with texture-enhanced blocks
                if hasattr(base_model, 'layer2'):
                    # Get number of blocks in layer2
                    num_blocks = len(base_model.layer2)
                    
                    # Replace last block in layer2
                    channels = base_model.layer2[-1].conv2.out_channels
                    
                    # Create texture block
                    texture_block = TextureResidualBlock(
                        channels=channels,
                        use_attention=True,
                        use_multi_scale=True
                    )
                    
                    # Insert texture block after the original block
                    self.texture_block1 = texture_block
                    
                    # Flag to indicate where to insert the texture block
                    self.insert_after_layer2 = True
                else:
                    self.insert_after_layer2 = False
                
                if hasattr(base_model, 'layer3'):
                    # Get number of blocks in layer3
                    num_blocks = len(base_model.layer3)
                    
                    # Replace last block in layer3
                    channels = base_model.layer3[-1].conv2.out_channels
                    
                    # Create texture block
                    texture_block = TextureResidualBlock(
                        channels=channels,
                        use_attention=True,
                        use_multi_scale=True
                    )
                    
                    # Insert texture block after the original block
                    self.texture_block2 = texture_block
                    
                    # Flag to indicate where to insert the texture block
                    self.insert_after_layer3 = True
                else:
                    self.insert_after_layer3 = False
            else:
                # For other model types, don't insert texture blocks
                logger.warning(f"Texture blocks not supported for model type: {type(base_model)}")
                self.use_texture_blocks = False
    
    def forward(self, x):
        """Forward pass"""
        # Apply Gabor filters if enabled
        if self.use_gabor:
            x = self.gabor(x)
        
        # Process through base model with texture blocks if enabled
        if self.use_texture_blocks and isinstance(self.base_model, models.ResNet):
            # Forward through initial layers
            x = self.base_model.conv1(x)
            x = self.base_model.bn1(x)
            x = self.base_model.relu(x)
            x = self.base_model.maxpool(x)
            
            # Layer 1
            x = self.base_model.layer1(x)
            
            # Layer 2
            x = self.base_model.layer2(x)
            if hasattr(self, 'insert_after_layer2') and self.insert_after_layer2:
                x = self.texture_block1(x)
            
            # Layer 3
            x = self.base_model.layer3(x)
            if hasattr(self, 'insert_after_layer3') and self.insert_after_layer3:
                x = self.texture_block2(x)
            
            # Layer 4
            x = self.base_model.layer4(x)
            
            # Final pooling and fc
            x = self.base_model.avgpool(x)
            x = torch.flatten(x, 1)
            x = self.base_model.fc(x)
        else:
            # Forward through base model normally
            x = self.base_model(x)
        
        return x


class TextureSpecificLoss(nn.Module):
    """
    Texture-specific loss function that combines:
    1. Standard classification loss (cross-entropy)
    2. Texture consistency loss
    3. Style loss (optional)
    """
    
    def __init__(self, 
                alpha: float = 1.0,
                beta: float = 0.5,
                gamma: float = 0.1,
                use_style_loss: bool = False):
        """
        Initialize the texture-specific loss
        
        Args:
            alpha: Weight for classification loss
            beta: Weight for texture consistency loss
            gamma: Weight for style loss
            use_style_loss: Whether to use style loss
        """
        super().__init__()
        
        self.alpha = alpha
        self.beta = beta
        self.gamma = gamma
        self.use_style_loss = use_style_loss
        
        # Classification loss
        self.cls_loss = nn.CrossEntropyLoss()
    
    def _gram_matrix(self, x):
        """Calculate Gram matrix for style loss"""
        b, c, h, w = x.size()
        f = x.view(b, c, h * w)
        g = torch.bmm(f, f.transpose(1, 2))
        return g.div(c * h * w)
    
    def forward(self, 
               pred_logits: torch.Tensor,
               targets: torch.Tensor,
               features: Optional[torch.Tensor] = None,
               style_features: Optional[torch.Tensor] = None):
        """
        Forward pass
        
        Args:
            pred_logits: Predicted logits
            targets: Target labels
            features: Features for texture consistency loss
            style_features: Features for style loss
            
        Returns:
            Total loss and dictionary of individual losses
        """
        # Calculate classification loss
        cls_loss = self.cls_loss(pred_logits, targets)
        
        # Initialize total loss with classification loss
        total_loss = self.alpha * cls_loss
        
        # Dictionary to track individual losses
        losses = {'cls_loss': cls_loss.item()}
        
        # Texture consistency loss if features provided
        texture_loss = torch.tensor(0.0, device=pred_logits.device)
        if features is not None:
            # Simple texture consistency loss based on feature variance
            texture_loss = -torch.var(features, dim=1).mean()
            total_loss = total_loss + self.beta * texture_loss
            losses['texture_loss'] = texture_loss.item()
        
        # Style loss if enabled and features provided
        style_loss = torch.tensor(0.0, device=pred_logits.device)
        if self.use_style_loss and style_features is not None:
            # Calculate Gram matrices
            gram = self._gram_matrix(style_features)
            
            # Calculate style loss (encourage diversity in style)
            style_loss = -torch.norm(gram) / (gram.size(0) * gram.size(1) * gram.size(2))
            total_loss = total_loss + self.gamma * style_loss
            losses['style_loss'] = style_loss.item()
        
        # Return total loss and individual losses
        return total_loss, losses


class TextureNetSVD(nn.Module):
    """
    Material Texture Network with SVD-based texture feature extraction.
    Specifically designed for material texture analysis.
    """
    
    def __init__(self, 
                num_classes: int,
                input_size: int = 224,
                base_channels: int = 64,
                num_blocks: int = 4,
                texture_dim: int = 32):
        """
        Initialize the TextureNet-SVD model
        
        Args:
            num_classes: Number of classes
            input_size: Input image size
            base_channels: Number of base channels
            num_blocks: Number of texture blocks
            texture_dim: Dimension of texture features
        """
        super().__init__()
        
        self.num_classes = num_classes
        self.input_size = input_size
        self.base_channels = base_channels
        self.num_blocks = num_blocks
        self.texture_dim = texture_dim
        
        # Initial convolutional layers
        self.conv1 = nn.Sequential(
            nn.Conv2d(3, base_channels, kernel_size=7, stride=2, padding=3, bias=False),
            nn.BatchNorm2d(base_channels),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=3, stride=2, padding=1)
        )
        
        # Texture blocks
        self.texture_blocks = nn.ModuleList()
        current_channels = base_channels
        
        for i in range(num_blocks):
            # Double channels every second block
            if i > 0 and i % 2 == 0:
                out_channels = current_channels * 2
            else:
                out_channels = current_channels
            
            # Add texture block
            block = TextureResidualBlock(
                channels=out_channels,
                use_attention=(i > 0),  # No attention in first block
                use_multi_scale=True
            )
            
            # Add transition if channels change
            if out_channels != current_channels:
                transition = nn.Sequential(
                    nn.Conv2d(current_channels, out_channels, kernel_size=1, stride=2, bias=False),
                    nn.BatchNorm2d(out_channels),
                    nn.ReLU(inplace=True)
                )
                self.texture_blocks.append(transition)
            
            # Add texture block
            self.texture_blocks.append(block)
            
            # Update current channels
            current_channels = out_channels
        
        # Global average pooling
        self.global_pool = nn.AdaptiveAvgPool2d((1, 1))
        
        # SVD-based texture feature extractor
        self.texture_svd = SVDTextureExtractor(
            in_channels=current_channels,
            texture_dim=texture_dim
        )
        
        # Classification head
        self.classifier = nn.Sequential(
            nn.Linear(current_channels + texture_dim, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(0.5),
            nn.Linear(512, num_classes)
        )
        
        # Initialize weights
        self._initialize_weights()
    
    def _initialize_weights(self):
        """Initialize model weights"""
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.Linear):
                nn.init.normal_(m.weight, 0, 0.01)
                nn.init.constant_(m.bias, 0)
    
    def forward(self, x):
        """Forward pass"""
        # Initial convolution
        x = self.conv1(x)
        
        # Texture blocks
        for block in self.texture_blocks:
            x = block(x)
        
        # Extract global features
        global_features = self.global_pool(x).view(x.size(0), -1)
        
        # Extract texture features using SVD
        texture_features = self.texture_svd(x)
        
        # Concatenate global and texture features
        combined_features = torch.cat([global_features, texture_features], dim=1)
        
        # Classification
        logits = self.classifier(combined_features)
        
        return logits, combined_features


class SVDTextureExtractor(nn.Module):
    """
    SVD-based texture feature extractor that captures
    texture patterns using singular value decomposition.
    """
    
    def __init__(self, 
                in_channels: int,
                texture_dim: int = 32,
                pooling_size: int = 4):
        """
        Initialize the SVD texture extractor
        
        Args:
            in_channels: Number of input channels
            texture_dim: Dimension of texture features
            pooling_size: Size of pooling regions
        """
        super().__init__()
        
        self.in_channels = in_channels
        self.texture_dim = texture_dim
        self.pooling_size = pooling_size
        
        # Dimensionality reduction before SVD
        self.dim_reduce = nn.Conv2d(in_channels, texture_dim, kernel_size=1)
        
        # Projection after SVD
        self.projection = nn.Sequential(
            nn.Linear(texture_dim, texture_dim),
            nn.ReLU(inplace=True)
        )
    
    def forward(self, x):
        """Forward pass"""
        batch_size = x.size(0)
        
        # Dimensionality reduction
        x = self.dim_reduce(x)
        
        # Get spatial dimensions
        _, c, h, w = x.size()
        
        # Calculate number of pooling regions
        num_h = h // self.pooling_size
        num_w = w // self.pooling_size
        
        # Adapt pooling size if needed
        p_h = h // num_h
        p_w = w // num_w
        
        # Extract patches and reshape for SVD
        patches = x.unfold(2, p_h, p_h).unfold(3, p_w, p_w)
        patches = patches.contiguous().view(batch_size, c, -1, p_h * p_w)
        patches = patches.permute(0, 2, 1, 3).contiguous().view(batch_size, -1, c, p_h * p_w)
        
        # SVD for each patch
        u_list = []
        s_list = []
        
        for i in range(batch_size):
            patch_features = []
            
            for j in range(patches.size(1)):
                # Get patch and reshape
                patch = patches[i, j]  # c x (p_h * p_w)
                
                # Compute SVD
                try:
                    u, s, _ = torch.svd(patch)
                    
                    # Use top singular values and vectors
                    top_s = s[:self.texture_dim] if s.size(0) >= self.texture_dim else torch.cat([s, torch.zeros(self.texture_dim - s.size(0), device=s.device)])
                    top_u = u[:, :self.texture_dim] if u.size(1) >= self.texture_dim else torch.cat([u, torch.zeros(u.size(0), self.texture_dim - u.size(1), device=u.device)], dim=1)
                    
                    # Weight singular vectors by singular values
                    weighted_u = top_u * top_s.unsqueeze(0)
                    
                    # Add to list
                    patch_features.append(weighted_u.mean(dim=0))
                    
                except RuntimeError as e:
                    # Fallback for SVD errors
                    logger.warning(f"SVD error: {e}. Using fallback.")
                    patch_features.append(torch.zeros(self.texture_dim, device=x.device))
            
            # Average patch features
            if patch_features:
                region_features = torch.stack(patch_features).mean(dim=0)
            else:
                region_features = torch.zeros(self.texture_dim, device=x.device)
            
            u_list.append(region_features)
        
        # Stack batch features
        texture_features = torch.stack(u_list)
        
        # Apply projection
        texture_features = self.projection(texture_features)
        
        return texture_features


class MaterialTextureNet(nn.Module):
    """
    Complete model for material texture analysis, combining
    texture-enhanced backbone with texture-specific losses.
    """
    
    def __init__(self, 
                num_classes: int,
                backbone: str = "resnet18",
                use_texture_backbone: bool = True,
                use_svd_features: bool = True,
                use_texture_loss: bool = True,
                pretrained: bool = True):
        """
        Initialize the material texture network
        
        Args:
            num_classes: Number of classes
            backbone: Backbone architecture
            use_texture_backbone: Whether to use texture-enhanced backbone
            use_svd_features: Whether to use SVD-based texture features
            use_texture_loss: Whether to use texture-specific loss
            pretrained: Whether to use pretrained backbone
        """
        super().__init__()
        
        self.num_classes = num_classes
        self.backbone_name = backbone
        self.use_texture_backbone = use_texture_backbone
        self.use_svd_features = use_svd_features
        self.use_texture_loss = use_texture_loss
        
        # Initialize backbone
        if backbone == "texturenet":
            # Use specialized TextureNetSVD architecture
            self.backbone = TextureNetSVD(
                num_classes=num_classes,
                input_size=224,
                base_channels=64,
                num_blocks=4,
                texture_dim=32
            )
            self.has_texture_features = True
            self.use_svd_features = True  # TextureNetSVD always uses SVD features
            self.feature_dim = self.backbone.classifier[0].in_features
            
            # Remove classifier for feature extraction
            self.features = self.backbone
            self.classifier = nn.Identity()
            
        else:
            # Initialize with standard backbone
            if backbone == "resnet18":
                base = models.resnet18(pretrained=pretrained)
                feature_dim = base.fc.in_features
                base.fc = nn.Identity()  # Remove classifier for feature extraction
            elif backbone == "resnet50":
                base = models.resnet50(pretrained=pretrained)
                feature_dim = base.fc.in_features
                base.fc = nn.Identity()
            elif backbone == "efficientnet_b0":
                base = models.efficientnet_b0(pretrained=pretrained)
                feature_dim = base.classifier[1].in_features
                base.classifier = nn.Identity()
            else:
                raise ValueError(f"Unsupported backbone: {backbone}")
            
            # Apply texture enhancements if requested
            if use_texture_backbone:
                self.features = TextureEnhancedBackbone(
                    base_model=base,
                    in_channels=3,
                    use_gabor=True,
                    use_texture_blocks=True
                )
            else:
                self.features = base
            
            # SVD texture feature extractor if requested
            if use_svd_features:
                self.texture_extractor = SVDTextureExtractor(
                    in_channels=feature_dim // 4,  # Extract from earlier layer
                    texture_dim=32,
                    pooling_size=4
                )
                self.has_texture_features = True
                self.feature_dim = feature_dim + 32  # Base features + texture features
            else:
                self.has_texture_features = False
                self.feature_dim = feature_dim
            
            # Classifier
            self.classifier = nn.Sequential(
                nn.Linear(self.feature_dim, 512),
                nn.ReLU(inplace=True),
                nn.Dropout(0.5),
                nn.Linear(512, num_classes)
            )
        
        # Texture-specific loss if requested
        if use_texture_loss:
            self.texture_loss = TextureSpecificLoss(
                alpha=1.0,
                beta=0.5,
                gamma=0.1,
                use_style_loss=True
            )
        else:
            self.texture_loss = None
    
    def forward(self, x):
        """Forward pass"""
        if self.backbone_name == "texturenet":
            # TextureNetSVD returns logits and features
            logits, features = self.backbone(x)
            return logits, features
        else:
            # Extract base features
            base_features = self.features(x)
            
            # Extract texture features if enabled
            if self.use_svd_features:
                # Extract intermediate features for SVD
                if isinstance(self.features, TextureEnhancedBackbone) and isinstance(self.features.base_model, models.ResNet):
                    # Forward to extract intermediate features
                    with torch.no_grad():
                        x = self.features.base_model.conv1(x)
                        x = self.features.base_model.bn1(x)
                        x = self.features.base_model.relu(x)
                        x = self.features.base_model.maxpool(x)
                        x = self.features.base_model.layer1(x)
                        intermediate_features = self.features.base_model.layer2(x)
                else:
                    # Fallback: use input directly
                    intermediate_features = x
                
                # Extract texture features
                texture_features = self.texture_extractor(intermediate_features)
                
                # Combine features
                combined_features = torch.cat([base_features, texture_features], dim=1)
            else:
                combined_features = base_features
            
            # Apply classifier
            logits = self.classifier(combined_features)
            
            return logits, combined_features
    
    def compute_loss(self, 
                    pred_logits: torch.Tensor,
                    targets: torch.Tensor,
                    features: torch.Tensor,
                    intermediate_features: Optional[torch.Tensor] = None):
        """
        Compute loss with texture-specific components
        
        Args:
            pred_logits: Predicted logits
            targets: Target labels
            features: Combined features
            intermediate_features: Intermediate features for style loss
            
        Returns:
            Total loss and dictionary of individual losses
        """
        if self.texture_loss:
            return self.texture_loss(
                pred_logits=pred_logits,
                targets=targets,
                features=features,
                style_features=intermediate_features
            )
        else:
            # Standard cross-entropy loss
            loss_fn = nn.CrossEntropyLoss()
            loss = loss_fn(pred_logits, targets)
            return loss, {'cls_loss': loss.item()}
    
    def export_to_onnx(self, path: str, input_size: Tuple[int, int] = (224, 224)):
        """
        Export model to ONNX format
        
        Args:
            path: Path to save ONNX model
            input_size: Input image size (height, width)
            
        Returns:
            True if export was successful, False otherwise
        """
        try:
            # Create dummy input
            dummy_input = torch.randn(1, 3, input_size[0], input_size[1])
            
            # Set model to evaluation mode
            self.eval()
            
            # Export to ONNX
            torch.onnx.export(
                self,
                dummy_input,
                path,
                export_params=True,
                opset_version=11,
                do_constant_folding=True,
                input_names=['input'],
                output_names=['output'],
                dynamic_axes={'input': {0: 'batch_size'},
                            'output': {0: 'batch_size'}}
            )
            
            logger.info(f"Model exported to ONNX: {path}")
            return True
            
        except Exception as e:
            logger.error(f"Error exporting to ONNX: {e}")
            return False


def create_texture_network(
                        num_classes: int,
                        model_type: str = "texture_resnet18",
                        pretrained: bool = True,
                        export_onnx: bool = False,
                        export_path: Optional[str] = None) -> nn.Module:
    """
    Create a texture-specific network for material analysis
    
    Args:
        num_classes: Number of classes
        model_type: Model type ('texture_resnet18', 'texture_resnet50', 'texturenet')
        pretrained: Whether to use pretrained backbone
        export_onnx: Whether to export to ONNX
        export_path: Path to save ONNX model
        
    Returns:
        Initialized model
    """
    # Map model type to configuration
    if model_type == "texture_resnet18":
        model = MaterialTextureNet(
            num_classes=num_classes,
            backbone="resnet18",
            use_texture_backbone=True,
            use_svd_features=True,
            use_texture_loss=True,
            pretrained=pretrained
        )
    elif model_type == "texture_resnet50":
        model = MaterialTextureNet(
            num_classes=num_classes,
            backbone="resnet50",
            use_texture_backbone=True,
            use_svd_features=True,
            use_texture_loss=True,
            pretrained=pretrained
        )
    elif model_type == "texturenet":
        model = MaterialTextureNet(
            num_classes=num_classes,
            backbone="texturenet",
            use_texture_backbone=True,
            use_svd_features=True,
            use_texture_loss=True,
            pretrained=False  # TextureNetSVD doesn't use pretrained weights
        )
    elif model_type == "basic_resnet18":
        model = MaterialTextureNet(
            num_classes=num_classes,
            backbone="resnet18",
            use_texture_backbone=False,
            use_svd_features=False,
            use_texture_loss=False,
            pretrained=pretrained
        )
    else:
        raise ValueError(f"Unsupported model type: {model_type}")
    
    # Export to ONNX if requested
    if export_onnx and export_path:
        logger.info(f"Exporting model to ONNX: {export_path}")
        model.export_to_onnx(export_path)
    
    return model


def create_tensorflow_texture_network(
                                    num_classes: int,
                                    model_type: str = "texture_mobilenet",
                                    pretrained: bool = True) -> Any:
    """
    Create a TensorFlow-based texture-specific network for material analysis
    
    Args:
        num_classes: Number of classes
        model_type: Model type ('texture_mobilenet', 'texture_efficientnet')
        pretrained: Whether to use pretrained backbone
        
    Returns:
        Initialized TensorFlow model
    """
    if not TF_AVAILABLE:
        logger.error("TensorFlow not available")
        return None
    
    try:
        # Set weights parameter based on pretrained flag
        weights = 'imagenet' if pretrained else None
        
        # Create model based on type
        if model_type == "texture_mobilenet":
            # Base model
            base_model = applications.MobileNetV2(
                input_shape=(224, 224, 3),
                include_top=False,
                weights=weights
            )
            
            # Add texture-specific layers
            x = base_model.output
            
            # Multi-scale pooling
            p1 = layers.GlobalAveragePooling2D()(x)
            p2 = layers.AveragePooling2D(pool_size=(2, 2))(x)
            p2 = layers.Flatten()(p2)
            p3 = layers.AveragePooling2D(pool_size=(4, 4))(x)
            p3 = layers.Flatten()(p3)
            
            # Concatenate multi-scale features
            concat = layers.Concatenate()([p1, p2, p3])
            
            # Texture feature extraction
            texture_features = layers.Dense(128, activation='relu')(concat)
            
            # Classification head
            x = layers.Dense(512, activation='relu')(texture_features)
            x = layers.Dropout(0.5)(x)
            output = layers.Dense(num_classes, activation='softmax')(x)
            
            # Create model
            model = tf_models.Model(inputs=base_model.input, outputs=output)
            
            # Compile model
            model.compile(
                optimizer=TFAdam(),
                loss='sparse_categorical_crossentropy',
                metrics=['accuracy']
            )
            
            return model
            
        elif model_type == "texture_efficientnet":
            # Base model
            base_model = applications.EfficientNetB0(
                input_shape=(224, 224, 3),
                include_top=False,
                weights=weights
            )
            
            # Add texture-specific layers
            x = base_model.output
            
            # Multi-scale pooling
            p1 = layers.GlobalAveragePooling2D()(x)
            p2 = layers.AveragePooling2D(pool_size=(2, 2))(x)
            p2 = layers.Flatten()(p2)
            p3 = layers.AveragePooling2D(pool_size=(4, 4))(x)
            p3 = layers.Flatten()(p3)
            
            # Concatenate multi-scale features
            concat = layers.Concatenate()([p1, p2, p3])
            
            # Texture feature extraction
            texture_features = layers.Dense(128, activation='relu')(concat)
            
            # Classification head
            x = layers.Dense(512, activation='relu')(texture_features)
            x = layers.Dropout(0.5)(x)
            output = layers.Dense(num_classes, activation='softmax')(x)
            
            # Create model
            model = tf_models.Model(inputs=base_model.input, outputs=output)
            
            # Compile model
            model.compile(
                optimizer=TFAdam(),
                loss='sparse_categorical_crossentropy',
                metrics=['accuracy']
            )
            
            return model
            
        else:
            logger.error(f"Unsupported model type: {model_type}")
            return None
            
    except Exception as e:
        logger.error(f"Error creating TensorFlow model: {e}")
        return None


if __name__ == "__main__":
    """
    Main function for command-line usage
    """
    import argparse
    
    parser = argparse.ArgumentParser(description="Domain-specific neural networks for texture analysis")
    
    parser.add_argument("--action", choices=["train", "predict", "export"], default="train",
                     help="Action to perform")
    parser.add_argument("--model-type", choices=["texture_resnet18", "texture_resnet50", "texturenet", "basic_resnet18"],
                     default="texture_resnet18", help="Model type")
    parser.add_argument("--num-classes", type=int, default=10,
                     help="Number of classes")
    parser.add_argument("--input", type=str, help="Input image or dataset path")
    parser.add_argument("--output", type=str, help="Output path")
    parser.add_argument("--batch-size", type=int, default=32,
                     help="Batch size for training")
    parser.add_argument("--epochs", type=int, default=10,
                     help="Number of training epochs")
    parser.add_argument("--learning-rate", type=float, default=0.001,
                     help="Learning rate")
    parser.add_argument("--export-onnx", action="store_true",
                     help="Export model to ONNX format")
    parser.add_argument("--no-pretrained", action="store_true",
                     help="Don't use pretrained weights")
    parser.add_argument("--gpu", action="store_true",
                     help="Use GPU for processing")
    
    args = parser.parse_args()
    
    # Create model
    logger.info(f"Creating model: {args.model_type}")
    model = create_texture_network(
        num_classes=args.num_classes,
        model_type=args.model_type,
        pretrained=not args.no_pretrained,
        export_onnx=args.export_onnx,
        export_path=args.output if args.export_onnx else None
    )
    
    # Move to GPU if requested
    if args.gpu and TORCH_AVAILABLE and torch.cuda.is_available():
        logger.info("Using GPU")
        model = model.cuda()
    
    # Perform action
    if args.action == "train":
        logger.info("Action not implemented: train")
        # Training would be implemented here
        
    elif args.action == "predict":
        if not args.input:
            logger.error("Input required for prediction")
            sys.exit(1)
        
        logger.info("Action not implemented: predict")
        # Prediction would be implemented here
        
    elif args.action == "export":
        if not args.output:
            logger.error("Output required for export")
            sys.exit(1)
        
        logger.info(f"Exporting model to: {args.output}")
        model.export_to_onnx(args.output)