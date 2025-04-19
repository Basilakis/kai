#!/usr/bin/env python3
"""
Advanced Augmentation Pipeline for Material Recognition

This module provides advanced data augmentation techniques for material image datasets:
1. Advanced transformations: MixUp, CutMix, RandAugment, AugMix
2. Synthetic sample generation for underrepresented material categories
3. Category-specific augmentation strategies

These techniques help improve model generalization and performance for material recognition.
"""

import os
import numpy as np
import cv2
import random
import logging
from typing import List, Dict, Tuple, Union, Optional, Callable, Any

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('augmentation')

# Conditionally import TensorFlow or PyTorch based on availability
try:
    import tensorflow as tf
    import tensorflow.keras.preprocessing.image as tf_image
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    logger.debug("TensorFlow not available. Some augmentations may be limited.")

try:
    import torch
    import torchvision
    import torchvision.transforms as transforms
    from torchvision.transforms import functional as TF
    from torch.utils.data import Dataset
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.debug("PyTorch not available. Some augmentations may be limited.")

# Basic image manipulation functions that don't require TF or PyTorch
def load_image(image_path: str) -> np.ndarray:
    """Load an image as a numpy array"""
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Failed to load image: {image_path}")
    # Convert to RGB
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    return image

def save_image(image: np.ndarray, output_path: str) -> None:
    """Save a numpy array as an image"""
    # Convert to BGR for OpenCV
    image_bgr = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    cv2.imwrite(output_path, image_bgr)

# ---- Advanced Augmentation Techniques ----

def mixup(image1: np.ndarray, image2: np.ndarray, label1: int, label2: int, alpha: float = 0.2) -> Tuple[np.ndarray, np.ndarray]:
    """
    MixUp augmentation: creates a weighted combination of two images and their labels.
    
    Args:
        image1: First image as numpy array
        image2: Second image as numpy array
        label1: Class label for first image
        label2: Class label for second image
        alpha: Parameter for beta distribution
        
    Returns:
        Tuple of (mixed image, mixed labels)
    """
    if image1.shape != image2.shape:
        # Resize image2 to match image1
        image2 = cv2.resize(image2, (image1.shape[1], image1.shape[0]))
    
    # Generate mixing weight from beta distribution
    lam = np.random.beta(alpha, alpha)
    
    # Mix images
    mixed_image = lam * image1 + (1 - lam) * image2
    mixed_image = mixed_image.astype(np.uint8)
    
    # Create one-hot labels for mixing
    num_classes = max(label1, label2) + 1
    label1_onehot = np.zeros(num_classes)
    label2_onehot = np.zeros(num_classes)
    label1_onehot[label1] = 1
    label2_onehot[label2] = 1
    
    # Mix labels
    mixed_label = lam * label1_onehot + (1 - lam) * label2_onehot
    
    return mixed_image, mixed_label

def cutmix(image1: np.ndarray, image2: np.ndarray, label1: int, label2: int, alpha: float = 1.0) -> Tuple[np.ndarray, np.ndarray]:
    """
    CutMix augmentation: cuts and pastes random patches between images.
    
    Args:
        image1: First image as numpy array
        image2: Second image as numpy array
        label1: Class label for first image
        label2: Class label for second image
        alpha: Parameter controlling cut size
        
    Returns:
        Tuple of (mixed image, mixed labels)
    """
    if image1.shape != image2.shape:
        # Resize image2 to match image1
        image2 = cv2.resize(image2, (image1.shape[1], image1.shape[0]))
    
    # Get image dimensions
    h, w = image1.shape[0], image1.shape[1]
    
    # Sample bounding box
    lam = np.random.beta(alpha, alpha)
    
    # Cut area
    cut_ratio = np.sqrt(1. - lam)
    cut_w = int(w * cut_ratio)
    cut_h = int(h * cut_ratio)
    
    # Center point for the cut
    cx = np.random.randint(w)
    cy = np.random.randint(h)
    
    # Bounding box coordinates
    bbx1 = np.clip(cx - cut_w // 2, 0, w)
    bby1 = np.clip(cy - cut_h // 2, 0, h)
    bbx2 = np.clip(cx + cut_w // 2, 0, w)
    bby2 = np.clip(cy + cut_h // 2, 0, h)
    
    # Copy image1 and replace patch with image2
    mixed_image = image1.copy()
    mixed_image[bby1:bby2, bbx1:bbx2, :] = image2[bby1:bby2, bbx1:bbx2, :]
    
    # Area ratio
    lam = 1 - ((bbx2 - bbx1) * (bby2 - bby1) / (w * h))
    
    # Create one-hot labels for mixing
    num_classes = max(label1, label2) + 1
    label1_onehot = np.zeros(num_classes)
    label2_onehot = np.zeros(num_classes)
    label1_onehot[label1] = 1
    label2_onehot[label2] = 1
    
    # Mix labels according to area ratio
    mixed_label = lam * label1_onehot + (1 - lam) * label2_onehot
    
    return mixed_image, mixed_label

# ---- RandAugment Implementation ----
# Based on "RandAugment: Practical automated data augmentation with a reduced search space"

def apply_randaugment(image: np.ndarray, num_ops: int = 2, magnitude: int = 10) -> np.ndarray:
    """
    Apply RandAugment to an image.
    
    Args:
        image: Input image as numpy array
        num_ops: Number of operations to apply
        magnitude: Magnitude of augmentation (0-10)
        
    Returns:
        Augmented image
    """
    # Define available operations
    operations = [
        lambda img, m: _shear_x(img, m),
        lambda img, m: _shear_y(img, m),
        lambda img, m: _translate_x(img, m),
        lambda img, m: _translate_y(img, m),
        lambda img, m: _rotate(img, m),
        lambda img, m: _color(img, m),
        lambda img, m: _contrast(img, m),
        lambda img, m: _brightness(img, m),
        lambda img, m: _sharpness(img, m),
        lambda img, m: _posterize(img, m),
        lambda img, m: _solarize(img, m),
    ]
    
    # Select random operations
    ops_indices = np.random.choice(len(operations), num_ops, replace=False)
    
    # Scale magnitude
    magnitude = float(magnitude) / 10.0
    
    # Apply operations
    img = image.copy()
    for idx in ops_indices:
        op = operations[idx]
        img = op(img, magnitude)
    
    return img

# RandAugment Operations
def _shear_x(image: np.ndarray, magnitude: float) -> np.ndarray:
    """Apply X-shear transformation"""
    v = magnitude * 0.3 * random.choice([-1, 1])
    h, w = image.shape[:2]
    M = np.array([[1, v, 0], [0, 1, 0]], dtype=np.float32)
    return cv2.warpAffine(image, M, (w, h), borderMode=cv2.BORDER_REFLECT_101)

def _shear_y(image: np.ndarray, magnitude: float) -> np.ndarray:
    """Apply Y-shear transformation"""
    v = magnitude * 0.3 * random.choice([-1, 1])
    h, w = image.shape[:2]
    M = np.array([[1, 0, 0], [v, 1, 0]], dtype=np.float32)
    return cv2.warpAffine(image, M, (w, h), borderMode=cv2.BORDER_REFLECT_101)

def _translate_x(image: np.ndarray, magnitude: float) -> np.ndarray:
    """Apply X-translation"""
    v = magnitude * 0.45 * random.choice([-1, 1])
    v = v * image.shape[1]
    h, w = image.shape[:2]
    M = np.array([[1, 0, v], [0, 1, 0]], dtype=np.float32)
    return cv2.warpAffine(image, M, (w, h), borderMode=cv2.BORDER_REFLECT_101)

def _translate_y(image: np.ndarray, magnitude: float) -> np.ndarray:
    """Apply Y-translation"""
    v = magnitude * 0.45 * random.choice([-1, 1])
    v = v * image.shape[0]
    h, w = image.shape[:2]
    M = np.array([[1, 0, 0], [0, 1, v]], dtype=np.float32)
    return cv2.warpAffine(image, M, (w, h), borderMode=cv2.BORDER_REFLECT_101)

def _rotate(image: np.ndarray, magnitude: float) -> np.ndarray:
    """Rotate image"""
    v = magnitude * 30.0 * random.choice([-1, 1])
    h, w = image.shape[:2]
    M = cv2.getRotationMatrix2D((w/2, h/2), v, 1)
    return cv2.warpAffine(image, M, (w, h), borderMode=cv2.BORDER_REFLECT_101)

def _color(image: np.ndarray, magnitude: float) -> np.ndarray:
    """Adjust color"""
    v = magnitude * 0.9 + 0.1
    img_hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV).astype(np.float32)
    img_hsv[:, :, 1] = img_hsv[:, :, 1] * v
    img_hsv[:, :, 1] = np.clip(img_hsv[:, :, 1], 0, 255)
    img_hsv = img_hsv.astype(np.uint8)
    return cv2.cvtColor(img_hsv, cv2.COLOR_HSV2RGB)

def _contrast(image: np.ndarray, magnitude: float) -> np.ndarray:
    """Adjust contrast"""
    v = magnitude * 0.9 + 0.1
    mean = np.mean(image, axis=(0, 1), keepdims=True)
    return np.clip((image - mean) * v + mean, 0, 255).astype(np.uint8)

def _brightness(image: np.ndarray, magnitude: float) -> np.ndarray:
    """Adjust brightness"""
    v = magnitude * 0.9 + 0.1
    return np.clip(image * v, 0, 255).astype(np.uint8)

def _sharpness(image: np.ndarray, magnitude: float) -> np.ndarray:
    """Adjust sharpness"""
    v = magnitude * 0.9 + 0.1
    kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
    sharpened = cv2.filter2D(image, -1, kernel)
    return cv2.addWeighted(image, 1-v, sharpened, v, 0)

def _posterize(image: np.ndarray, magnitude: float) -> np.ndarray:
    """Reduce bits for each color channel"""
    bits = int(8 - magnitude * 4)
    bits = max(1, bits)
    mask = np.power(2, bits) - 1
    return ((image // mask) * mask).astype(np.uint8)

def _solarize(image: np.ndarray, magnitude: float) -> np.ndarray:
    """Invert pixel values above threshold"""
    threshold = 255 - magnitude * 128
    return np.where(image >= threshold, 255 - image, image).astype(np.uint8)

# ---- AugMix Implementation ----
# Based on "AugMix: A Simple Data Processing Method to Improve Robustness and Uncertainty"

def apply_augmix(image: np.ndarray, severity: int = 3, width: int = 3, depth: int = -1) -> np.ndarray:
    """
    Apply AugMix to an image.
    
    Args:
        image: Input image as numpy array
        severity: Severity of augmentation operations (1-10)
        width: Number of parallel augmentation chains
        depth: Depth of each augmentation chain (-1 for random)
        
    Returns:
        Augmented image
    """
    # AugMix uses a subset of RandAugment operations
    operations = [
        lambda img, m: _shear_x(img, m),
        lambda img, m: _shear_y(img, m),
        lambda img, m: _translate_x(img, m),
        lambda img, m: _translate_y(img, m),
        lambda img, m: _rotate(img, m),
        lambda img, m: _color(img, m),
        lambda img, m: _contrast(img, m),
        lambda img, m: _brightness(img, m),
        lambda img, m: _sharpness(img, m),
        lambda img, m: _posterize(img, m),
        lambda img, m: _solarize(img, m),
    ]
    
    severity = severity / 10.0
    
    # Create augmentation chains
    augmented = np.zeros_like(image, dtype=np.float32)
    weights = np.random.dirichlet([1] * width)
    
    for i in range(width):
        # Determine depth
        if depth <= 0:
            chain_depth = np.random.randint(1, 4)
        else:
            chain_depth = depth
        
        # Create chain
        chain_image = image.copy().astype(np.float32)
        
        # Apply operations
        for _ in range(chain_depth):
            op_index = np.random.randint(len(operations))
            chain_image = operations[op_index](chain_image, severity)
        
        # Add to combined image
        augmented += weights[i] * chain_image
    
    # Mix with original image
    m = np.random.beta(1, 1)
    augmented = m * image.astype(np.float32) + (1 - m) * augmented
    
    return np.clip(augmented, 0, 255).astype(np.uint8)

# ---- Synthetic Sample Generation ----

def generate_synthetic_samples(images: List[np.ndarray], labels: List[int], 
                             num_samples: int, technique: str = 'mixup',
                             class_counts: Optional[Dict[int, int]] = None) -> Tuple[List[np.ndarray], List[Union[int, np.ndarray]]]:
    """
    Generate synthetic samples for underrepresented classes.
    
    Args:
        images: List of source images
        labels: List of corresponding labels
        num_samples: Number of synthetic samples to generate
        technique: Generation technique ('mixup', 'cutmix', or 'augment')
        class_counts: Dictionary of {class_label: count} to prioritize underrepresented classes
        
    Returns:
        Tuple of (synthetic_images, synthetic_labels)
    """
    if len(images) < 2:
        raise ValueError("Need at least 2 images to generate synthetic samples")
    
    synthetic_images = []
    synthetic_labels = []
    
    # Determine class weights for sampling if class_counts is provided
    if class_counts:
        class_weights = {}
        total = sum(class_counts.values())
        # Invert frequencies to prioritize rare classes
        for label, count in class_counts.items():
            class_weights[label] = 1.0 - (count / total)
        
        # Normalize weights
        weight_sum = sum(class_weights.values())
        if weight_sum > 0:
            for label in class_weights:
                class_weights[label] /= weight_sum
    
    # Generate samples
    for _ in range(num_samples):
        if technique in ['mixup', 'cutmix']:
            # Select two source images
            if class_counts:
                # Weighted selection for first image from rarer classes
                idx1 = np.random.choice(
                    len(images), 
                    p=[class_weights.get(label, 1.0/len(class_weights)) for label in labels]
                )
                # Second image can be any
                idx2 = np.random.choice(len(images))
            else:
                # Random selection
                idx1, idx2 = np.random.choice(len(images), 2, replace=False)
            
            # Apply technique
            if technique == 'mixup':
                mixed_img, mixed_label = mixup(images[idx1], images[idx2], labels[idx1], labels[idx2])
            else:  # cutmix
                mixed_img, mixed_label = cutmix(images[idx1], images[idx2], labels[idx1], labels[idx2])
            
            synthetic_images.append(mixed_img)
            synthetic_labels.append(mixed_label)
        
        elif technique == 'augment':
            # Select an image
            if class_counts:
                # Weighted selection prioritizing rarer classes
                idx = np.random.choice(
                    len(images), 
                    p=[class_weights.get(label, 1.0/len(class_weights)) for label in labels]
                )
            else:
                idx = np.random.choice(len(images))
            
            # Apply augmentations
            if random.random() < 0.5:
                aug_img = apply_randaugment(images[idx])
            else:
                aug_img = apply_augmix(images[idx])
            
            synthetic_images.append(aug_img)
            synthetic_labels.append(labels[idx])  # Same label for augmented image
    
    return synthetic_images, synthetic_labels

# ---- Category-Specific Augmentation Strategies ----

def get_category_augmentation_strategy(material_category: str) -> Dict[str, Any]:
    """
    Get augmentation parameters tailored to specific material categories.
    
    Args:
        material_category: Material category name or ID
        
    Returns:
        Dictionary with augmentation parameters
    """
    # Lowercase and normalize category name
    category = material_category.lower().strip()
    
    # Default settings
    defaults = {
        'use_randaugment': True,
        'randaugment_n': 2,
        'randaugment_m': 5,
        'use_augmix': True,
        'augmix_severity': 5,
        'use_mixup': True,
        'mixup_alpha': 0.2,
        'use_cutmix': True,
        'cutmix_alpha': 1.0,
        'color_jitter': 0.3,
        'rotation_range': 15,
    }
    
    # Category-specific strategies
    strategies = {
        # Wood materials - emphasize texture preserving transformations
        'wood': {
            'randaugment_m': 3,  # Lower magnitude to preserve textures
            'rotation_range': 30,  # Allow more rotation
            'color_jitter': 0.4,  # More color variation for wood stains
            'use_cutmix': False,  # Avoid cutting wood textures
        },
        
        # Fabric materials - emphasize color and geometric transformations
        'fabric': {
            'color_jitter': 0.5,  # Higher color variation for fabrics
            'use_mixup': True,
            'mixup_alpha': 0.3,  # More aggressive mixing
        },
        
        # Stone materials - emphasize texture and moderate color shifts
        'stone': {
            'randaugment_m': 4,
            'use_augmix': True,
            'augmix_severity': 6,
            'use_cutmix': False,  # Preserve texture patterns
        },
        
        # Metal materials - emphasize lighting and reflection variations
        'metal': {
            'randaugment_m': 6,  # Higher magnitude for lighting changes
            'color_jitter': 0.2,  # Less color change (metallic colors matter)
            'brightness_range': 0.4,  # More brightness variation for reflections
            'contrast_range': 0.4,  # More contrast for metallic surface
        },
        
        # Glass materials - emphasize transparency and reflection effects
        'glass': {
            'randaugment_m': 6,
            'use_mixup': True,
            'mixup_alpha': 0.4,  # More aggressive mixing for transparency
            'brightness_range': 0.5,  # Significant brightness variation
        },
        
        # Plastic materials - moderate transformations
        'plastic': {
            'randaugment_m': 5,
            'color_jitter': 0.4,
            'use_cutmix': True,
        },
        
        # Leather materials - emphasize texture and color
        'leather': {
            'randaugment_m': 4,
            'color_jitter': 0.4,
            'use_cutmix': False,
        },
        
        # Ceramic materials - emphasize patterns and surface variations
        'ceramic': {
            'randaugment_m': 4,
            'rotation_range': 25,
            'use_augmix': True,
        },
    }
    
    # Match to closest category
    matched_category = None
    for key in strategies.keys():
        if key in category:
            matched_category = key
            break
    
    # Use default if no match
    if matched_category is None:
        return defaults
    
    # Merge defaults with category-specific strategy
    merged = defaults.copy()
    merged.update(strategies[matched_category])
    return merged

# ---- Framework-Specific Data Augmentation Integrations ----

if TF_AVAILABLE:
    class TensorFlowAugmentationPipeline:
        """Advanced augmentation pipeline for TensorFlow datasets"""
        
        def __init__(self, 
                    use_randaugment: bool = True, 
                    randaugment_n: int = 2, 
                    randaugment_m: int = 10,
                    use_augmix: bool = True, 
                    augmix_severity: int = 3,
                    use_mixup: bool = True, 
                    mixup_alpha: float = 0.2,
                    use_cutmix: bool = True, 
                    cutmix_alpha: float = 1.0):
            """
            Initialize the TensorFlow augmentation pipeline.
            
            Args:
                use_randaugment: Whether to use RandAugment
                randaugment_n: Number of RandAugment operations
                randaugment_m: Magnitude of RandAugment operations
                use_augmix: Whether to use AugMix
                augmix_severity: Severity of AugMix augmentations
                use_mixup: Whether to use MixUp
                mixup_alpha: Alpha parameter for MixUp
                use_cutmix: Whether to use CutMix
                cutmix_alpha: Alpha parameter for CutMix
            """
            self.use_randaugment = use_randaugment
            self.randaugment_n = randaugment_n
            self.randaugment_m = randaugment_m
            self.use_augmix = use_augmix
            self.augmix_severity = augmix_severity
            self.use_mixup = use_mixup
            self.mixup_alpha = mixup_alpha
            self.use_cutmix = use_cutmix
            self.cutmix_alpha = cutmix_alpha
        
        def apply_to_dataset(self, dataset, num_classes):
            """Apply augmentations to a TensorFlow dataset"""
            # Define augmentation function
            def augment_fn(images, labels):
                # Convert to numpy for our augmentation functions
                images_np = images.numpy()
                labels_np = labels.numpy()
                
                batch_size = images_np.shape[0]
                augmented_images = []
                augmented_labels = []
                
                for i in range(batch_size):
                    img = images_np[i]
                    label = labels_np[i]
                    
                    # Decide which augmentation to apply
                    aug_choice = np.random.rand()
                    
                    if aug_choice < 0.3 and self.use_randaugment:
                        # Apply RandAugment
                        aug_img = apply_randaugment(img, self.randaugment_n, self.randaugment_m)
                        aug_label = label
                    elif aug_choice < 0.6 and self.use_augmix:
                        # Apply AugMix
                        aug_img = apply_augmix(img, self.augmix_severity)
                        aug_label = label
                    elif aug_choice < 0.8 and self.use_mixup and batch_size > 1:
                        # Apply MixUp with another image in batch
                        j = (i + 1) % batch_size  # Next image in batch
                        aug_img, mixed_label = mixup(img, images_np[j], label, labels_np[j], self.mixup_alpha)
                        
                        # Convert label format based on what the model expects
                        if isinstance(label, (int, np.integer)):
                            # Convert to one-hot if needed
                            aug_label = mixed_label
                        else:
                            aug_label = mixed_label
                    elif self.use_cutmix and batch_size > 1:
                        # Apply CutMix with another image in batch
                        j = (i + 1) % batch_size  # Next image in batch
                        aug_img, mixed_label = cutmix(img, images_np[j], label, labels_np[j], self.cutmix_alpha)
                        
                        # Convert label format
                        if isinstance(label, (int, np.integer)):
                            aug_label = mixed_label
                        else:
                            aug_label = mixed_label
                    else:
                        # No augmentation
                        aug_img = img
                        aug_label = label
                    
                    augmented_images.append(aug_img)
                    augmented_labels.append(aug_label)
                
                # Convert back to tensors
                augmented_images = tf.convert_to_tensor(np.array(augmented_images), dtype=tf.float32)
                augmented_labels = tf.convert_to_tensor(np.array(augmented_labels))
                
                return augmented_images, augmented_labels
            
            # Apply augmentation to dataset
            augmented_dataset = dataset.map(
                lambda x, y: tf.py_function(
                    augment_fn, [x, y], [tf.float32, y.dtype]
                ),
                num_parallel_calls=tf.data.AUTOTUNE
            )
            
            return augmented_dataset

if TORCH_AVAILABLE:
    class PyTorchAugmentationPipeline:
        """Advanced augmentation pipeline for PyTorch datasets"""
        
        def __init__(self, 
                    use_randaugment: bool = True, 
                    randaugment_n: int = 2, 
                    randaugment_m: int = 10,
                    use_augmix: bool = True, 
                    augmix_severity: int = 3,
                    use_mixup: bool = True, 
                    mixup_alpha: float = 0.2,
                    use_cutmix: bool = True, 
                    cutmix_alpha: float = 1.0):
            """
            Initialize the PyTorch augmentation pipeline.
            
            Args:
                use_randaugment: Whether to use RandAugment
                randaugment_n: Number of RandAugment operations
                randaugment_m: Magnitude of RandAugment operations
                use_augmix: Whether to use AugMix
                augmix_severity: Severity of AugMix augmentations
                use_mixup: Whether to use MixUp
                mixup_alpha: Alpha parameter for MixUp
                use_cutmix: Whether to use CutMix
                cutmix_alpha: Alpha parameter for CutMix
            """
            self.use_randaugment = use_randaugment
            self.randaugment_n = randaugment_n
            self.randaugment_m = randaugment_m
            self.use_augmix = use_augmix
            self.augmix_severity = augmix_severity
            self.use_mixup = use_mixup
            self.mixup_alpha = mixup_alpha
            self.use_cutmix = use_cutmix
            self.cutmix_alpha = cutmix_alpha
            
            # Define base transform for individual images
            self.transform = transforms.Compose([
                transforms.ToPILImage(),
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
            ])
        
        def apply_augmentations(self, img_batch, label_batch, num_classes):
            """Apply augmentations to a batch of PyTorch tensors"""
            batch_size = img_batch.size(0)
            device = img_batch.device
            
            # Only apply batch augmentations when batch size > 1
            if batch_size <= 1 or (not self.use_mixup and not self.use_cutmix):
                return img_batch, label_batch
            
            # Decide whether to use MixUp or CutMix
            r = torch.rand(1).item()
            
            if r < 0.5 and self.use_mixup:
                # Apply MixUp
                lam = torch.from_numpy(np.random.beta(self.mixup_alpha, self.mixup_alpha, size=1)).float().to(device)
                rand_idx = torch.randperm(batch_size).to(device)
                
                # Mix images
                img_batch = lam * img_batch + (1 - lam) * img_batch[rand_idx]
                
                # Mix labels (assume one-hot or create one-hot)
                if label_batch.dim() == 1:  # Not one-hot
                    label_a = torch.zeros(batch_size, num_classes).to(device)
                    label_b = torch.zeros(batch_size, num_classes).to(device)
                    label_a.scatter_(1, label_batch.view(-1, 1), 1)
                    label_b.scatter_(1, label_batch[rand_idx].view(-1, 1), 1)
                    mixed_label = lam * label_a + (1 - lam) * label_b
                else:  # Already one-hot
                    mixed_label = lam * label_batch + (1 - lam) * label_batch[rand_idx]
                
                return img_batch, mixed_label
            
            elif self.use_cutmix:
                # Apply CutMix
                lam = torch.from_numpy(np.random.beta(self.cutmix_alpha, self.cutmix_alpha, size=1)).float().to(device)
                rand_idx = torch.randperm(batch_size).to(device)
                
                # Get dimensions
                W = img_batch.size(3)
                H = img_batch.size(2)
                
                # Calculate patch size
                cut_ratio = torch.sqrt(1. - lam)
                cut_w = (W * cut_ratio).int()
                cut_h = (H * cut_ratio).int()
                
                # Get random center point
                cx = torch.randint(W, (1,)).to(device)
                cy = torch.randint(H, (1,)).to(device)
                
                # Calculate box coordinates
                bbx1 = torch.clamp(cx - cut_w // 2, 0, W)
                bby1 = torch.clamp(cy - cut_h // 2, 0, H)
                bbx2 = torch.clamp(cx + cut_w // 2, 0, W)
                bby2 = torch.clamp(cy + cut_h // 2, 0, H)
                
                # Cut and paste boxes
                img_batch_mixed = img_batch.clone()
                img_batch_mixed[:, :, bby1:bby2, bbx1:bbx2] = img_batch[rand_idx, :, bby1:bby2, bbx1:bbx2]
                
                # Adjust lambda to match cut area
                lam = 1 - ((bbx2 - bbx1) * (bby2 - bby1) / (W * H))
                
                # Mix labels
                if label_batch.dim() == 1:  # Not one-hot
                    label_a = torch.zeros(batch_size, num_classes).to(device)
                    label_b = torch.zeros(batch_size, num_classes).to(device)
                    label_a.scatter_(1, label_batch.view(-1, 1), 1)
                    label_b.scatter_(1, label_batch[rand_idx].view(-1, 1), 1)
                    mixed_label = lam * label_a + (1 - lam) * label_b
                else:  # Already one-hot
                    mixed_label = lam * label_batch + (1 - lam) * label_batch[rand_idx]
                
                return img_batch_mixed, mixed_label
            
            return img_batch, label_batch
        
        def get_transforms(self, material_category=None):
            """
            Get PyTorch transforms pipeline, optionally tailored to material category.
            
            Args:
                material_category: Optional material category for specific strategies
                
            Returns:
                torchvision.transforms.Compose with appropriate transforms
            """
            # Get category-specific parameters if provided
            if material_category:
                params = get_category_augmentation_strategy(material_category)
                rand_n = params.get('randaugment_n', self.randaugment_n)
                rand_m = params.get('randaugment_m', self.randaugment_m)
                use_rand = params.get('use_randaugment', self.use_randaugment)
                color_jitter = params.get('color_jitter', 0.3)
                rotation_range = params.get('rotation_range', 15)
            else:
                rand_n = self.randaugment_n
                rand_m = self.randaugment_m
                use_rand = self.use_randaugment
                color_jitter = 0.3
                rotation_range = 15
            
            # Define transforms list
            transform_list = [
                transforms.ToPILImage(),
                transforms.Resize((224, 224)),
            ]
            
            # Basic transformations
            transform_list.extend([
                transforms.RandomHorizontalFlip(),
                transforms.RandomRotation(rotation_range),
                transforms.ColorJitter(
                    brightness=color_jitter,
                    contrast=color_jitter,
                    saturation=color_jitter,
                    hue=color_jitter / 2
                )
            ])
            
            # Add RandAugment if enabled
            if use_rand:
                transform_list.append(
                    transforms.RandAugment(num_ops=rand_n, magnitude=rand_m)
                )
            
            # Final transforms
            transform_list.extend([
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
            ])
            
            return transforms.Compose(transform_list)

# ---- Augmentation Utilities ----

def analyze_class_distribution(labels: List[int]) -> Dict[int, int]:
    """
    Analyze class distribution and identify underrepresented classes.
    
    Args:
        labels: List of class labels
        
    Returns:
        Dictionary with {class_label: count}
    """
    class_counts = {}
    for label in labels:
        class_counts[label] = class_counts.get(label, 0) + 1
    return class_counts

def get_sampling_weights(class_counts: Dict[int, int], power: float = 1.0) -> Dict[int, float]:
    """
    Calculate sampling weights for each class to counteract imbalance.
    
    Args:
        class_counts: Dictionary with {class_label: count}
        power: Power factor to control sampling weight curve (higher emphasizes rare classes more)
        
    Returns:
        Dictionary with {class_label: weight}
    """
    if not class_counts:
        return {}
    
    # Calculate total count
    total_count = sum(class_counts.values())
    
    # Calculate inverse frequency for each class
    weights = {}
    for class_id, count in class_counts.items():
        if count > 0:
            # Calculate inverse frequency
            inv_freq = total_count / count
            # Apply power factor
            weights[class_id] = inv_freq ** power
    
    # Normalize weights
    weight_sum = sum(weights.values())
    if weight_sum > 0:
        for class_id in weights:
            weights[class_id] /= weight_sum
    
    return weights

def estimate_augmentation_needs(class_counts: Dict[int, int], target_count: int = None) -> Dict[int, int]:
    """
    Estimate how many synthetic samples are needed for each class.
    
    Args:
        class_counts: Dictionary with {class_label: count}
        target_count: Target count per class (if None, uses max count)
        
    Returns:
        Dictionary with {class_label: num_samples_needed}
    """
    if not class_counts:
        return {}
    
    # Determine target count
    if target_count is None:
        target_count = max(class_counts.values())
    
    # Calculate needed samples
    needed_samples = {}
    for class_id, count in class_counts.items():
        if count < target_count:
            needed_samples[class_id] = target_count - count
    
    return needed_samples

# Examples and usage
if __name__ == "__main__":
    # Test augmentation functions
    import matplotlib.pyplot as plt
    
    # Test on a sample image
    sample_image = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
    
    # Display the original image
    plt.figure(figsize=(16, 12))
    plt.subplot(3, 3, 1)
    plt.title("Original")
    plt.imshow(sample_image)
    
    # Apply RandAugment with different parameters
    plt.subplot(3, 3, 2)
    plt.title("RandAugment (n=2, m=5)")
    plt.imshow(apply_randaugment(sample_image, num_ops=2, magnitude=5))
    
    plt.subplot(3, 3, 3)
    plt.title("RandAugment (n=3, m=10)")
    plt.imshow(apply_randaugment(sample_image, num_ops=3, magnitude=10))
    
    # Apply AugMix with different parameters
    plt.subplot(3, 3, 4)
    plt.title("AugMix (severity=3)")
    plt.imshow(apply_augmix(sample_image, severity=3))
    
    plt.subplot(3, 3, 5)
    plt.title("AugMix (severity=7)")
    plt.imshow(apply_augmix(sample_image, severity=7))
    
    # Create a second sample image for MixUp and CutMix
    sample_image2 = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
    
    plt.subplot(3, 3, 6)
    plt.title("Second Image")
    plt.imshow(sample_image2)
    
    # Apply MixUp
    mixup_img, _ = mixup(sample_image, sample_image2, 0, 1, alpha=0.2)
    plt.subplot(3, 3, 7)
    plt.title("MixUp (alpha=0.2)")
    plt.imshow(mixup_img)
    
    # Apply CutMix
    cutmix_img, _ = cutmix(sample_image, sample_image2, 0, 1, alpha=1.0)
    plt.subplot(3, 3, 8)
    plt.title("CutMix (alpha=1.0)")
    plt.imshow(cutmix_img)
    
    # Save or display the figure
    plt.tight_layout()
    plt.savefig("augmentation_examples.png")
    plt.close()
    
    print("Augmentation tests complete. See 'augmentation_examples.png' for results.")