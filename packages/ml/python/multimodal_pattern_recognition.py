#!/usr/bin/env python3
"""
Multi-Modal Pattern Recognition

This module implements learning algorithms for pattern-specification relationships
using transformer-based architectures and cross-modal attention mechanisms.

Key features:
1. Transformer-based architecture for pattern-text associations
2. Cross-modal attention for visual-textual feature correlation
3. Contrastive learning for relationship modeling
4. Training pipeline for multi-modal learning

It integrates with the existing embedding system to provide enhanced
pattern-specification relationship learning capabilities.
"""

import os
import sys
import json
import numpy as np
import logging
import time
from typing import Dict, List, Any, Tuple, Optional, Union, Callable
from pathlib import Path
import threading
from datetime import datetime
import cv2
from tqdm import tqdm

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('multimodal_pattern_recognition')

# Check for deep learning frameworks
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    from torch.utils.data import Dataset, DataLoader
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch not available. Multi-modal recognition will be limited.")

try:
    from transformers import (
        AutoTokenizer, 
        AutoModel, 
        AutoImageProcessor, 
        ViTModel,
        CLIPModel, 
        CLIPProcessor,
        BertModel, 
        BertTokenizer
    )
    from transformers.optimization import AdamW, get_linear_schedule_with_warmup
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    logger.warning("Transformers library not available. Multi-modal recognition will be limited.")


class MultiModalPatternRecognizer:
    """
    Multi-modal pattern recognizer that learns relationships between visual patterns
    and textual specifications using transformer-based architecture and cross-modal attention.
    """
    
    def __init__(self, 
                 model_path: Optional[str] = None,
                 vision_encoder: str = "vit-base-patch16-224",
                 text_encoder: str = "bert-base-uncased",
                 use_pretrained: bool = True,
                 embedding_dim: int = 768,
                 device: Optional[str] = None,
                 cache_dir: Optional[str] = None):
        """
        Initialize the multi-modal pattern recognizer
        
        Args:
            model_path: Path to load a pre-trained model, if None, initializes with default weights
            vision_encoder: Vision transformer model name
            text_encoder: Text transformer model name
            use_pretrained: Whether to use pre-trained weights
            embedding_dim: Dimension of the final joint embedding space
            device: Device to run the model on ('cuda', 'cpu', or None for auto-detection)
            cache_dir: Directory to cache models and data
        """
        self.model_path = model_path
        self.vision_encoder_name = vision_encoder
        self.text_encoder_name = text_encoder
        self.use_pretrained = use_pretrained
        self.embedding_dim = embedding_dim
        self.cache_dir = cache_dir
        
        # Initialize device
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)
        
        # Check if required libraries are available
        if not TORCH_AVAILABLE or not TRANSFORMERS_AVAILABLE:
            logger.error("Required libraries (PyTorch and/or Transformers) not available")
            return
        
        # Create cache directory if needed
        if self.cache_dir:
            os.makedirs(self.cache_dir, exist_ok=True)
        
        # Initialize model
        if self.model_path and os.path.exists(self.model_path):
            # Load pre-trained model
            self._load_model()
        else:
            # Initialize from scratch
            self._initialize_model()
        
        # Initialize processors
        self._initialize_processors()
        
        # Move model to device
        if hasattr(self, 'model'):
            self.model.to(self.device)
    
    def _initialize_model(self):
        """Initialize model architecture"""
        if not TORCH_AVAILABLE or not TRANSFORMERS_AVAILABLE:
            return
        
        try:
            # Check if we can use CLIP as an all-in-one solution
            if "clip" in self.vision_encoder_name.lower() and "clip" in self.text_encoder_name.lower():
                logger.info("Initializing CLIP-based multi-modal model")
                self.model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
                self.model_type = "clip"
            else:
                # Initialize separate vision and text encoders
                logger.info(f"Initializing vision encoder: {self.vision_encoder_name}")
                vision_encoder = ViTModel.from_pretrained(
                    self.vision_encoder_name, 
                    cache_dir=self.cache_dir
                )
                
                logger.info(f"Initializing text encoder: {self.text_encoder_name}")
                text_encoder = BertModel.from_pretrained(
                    self.text_encoder_name, 
                    cache_dir=self.cache_dir
                )
                
                # Initialize MultiModalModel
                logger.info("Initializing multi-modal model with cross-attention")
                self.model = MultiModalTransformer(
                    vision_encoder=vision_encoder,
                    text_encoder=text_encoder,
                    embedding_dim=self.embedding_dim
                )
                self.model_type = "custom"
            
            logger.info(f"Model initialized successfully on device: {self.device}")
            
        except Exception as e:
            logger.error(f"Error initializing model: {e}")
            raise
    
    def _initialize_processors(self):
        """Initialize image and text processors"""
        if not TRANSFORMERS_AVAILABLE:
            return
        
        try:
            if self.model_type == "clip":
                # Initialize CLIP processor
                self.processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
            else:
                # Initialize separate image and text processors
                self.image_processor = AutoImageProcessor.from_pretrained(
                    self.vision_encoder_name,
                    cache_dir=self.cache_dir
                )
                
                self.tokenizer = AutoTokenizer.from_pretrained(
                    self.text_encoder_name,
                    cache_dir=self.cache_dir
                )
            
            logger.info("Processors initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing processors: {e}")
            raise
    
    def _load_model(self):
        """Load a pre-trained model from disk"""
        if not TORCH_AVAILABLE:
            return
        
        try:
            logger.info(f"Loading model from {self.model_path}")
            
            # Check if it's a directory (for HuggingFace models) or a file (for PyTorch models)
            if os.path.isdir(self.model_path):
                # Try to load as a CLIP model first
                try:
                    self.model = CLIPModel.from_pretrained(self.model_path)
                    self.model_type = "clip"
                except:
                    # Otherwise load as a custom model
                    self.model = MultiModalTransformer.from_pretrained(self.model_path)
                    self.model_type = "custom"
            else:
                # Load as a PyTorch checkpoint
                checkpoint = torch.load(self.model_path, map_location=self.device)
                
                # Determine model type from checkpoint
                if "model_type" in checkpoint:
                    self.model_type = checkpoint["model_type"]
                    
                    if self.model_type == "clip":
                        self.model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
                        self.model.load_state_dict(checkpoint["model_state_dict"])
                    else:
                        # Initialize model architecture first
                        vision_encoder = ViTModel.from_pretrained(
                            checkpoint.get("vision_encoder_name", self.vision_encoder_name),
                            cache_dir=self.cache_dir
                        )
                        
                        text_encoder = BertModel.from_pretrained(
                            checkpoint.get("text_encoder_name", self.text_encoder_name),
                            cache_dir=self.cache_dir
                        )
                        
                        self.model = MultiModalTransformer(
                            vision_encoder=vision_encoder,
                            text_encoder=text_encoder,
                            embedding_dim=checkpoint.get("embedding_dim", self.embedding_dim)
                        )
                        
                        # Load weights
                        self.model.load_state_dict(checkpoint["model_state_dict"])
                else:
                    # Default to custom model if not specified
                    self.model_type = "custom"
                    
                    # Initialize model architecture first
                    vision_encoder = ViTModel.from_pretrained(
                        self.vision_encoder_name,
                        cache_dir=self.cache_dir
                    )
                    
                    text_encoder = BertModel.from_pretrained(
                        self.text_encoder_name,
                        cache_dir=self.cache_dir
                    )
                    
                    self.model = MultiModalTransformer(
                        vision_encoder=vision_encoder,
                        text_encoder=text_encoder,
                        embedding_dim=self.embedding_dim
                    )
                    
                    # Load weights
                    self.model.load_state_dict(checkpoint["model_state_dict"])
                
                # Update model parameters from checkpoint
                if "vision_encoder_name" in checkpoint:
                    self.vision_encoder_name = checkpoint["vision_encoder_name"]
                
                if "text_encoder_name" in checkpoint:
                    self.text_encoder_name = checkpoint["text_encoder_name"]
                
                if "embedding_dim" in checkpoint:
                    self.embedding_dim = checkpoint["embedding_dim"]
            
            logger.info(f"Model loaded successfully with type: {self.model_type}")
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            raise
    
    def save_model(self, save_path: str, save_format: str = "pytorch"):
        """
        Save the model to disk
        
        Args:
            save_path: Path to save the model
            save_format: Format to save the model in ('pytorch' or 'huggingface')
        """
        if not hasattr(self, 'model'):
            logger.error("No model to save")
            return
        
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            
            if save_format == "huggingface" and hasattr(self.model, "save_pretrained"):
                # Save as HuggingFace model
                self.model.save_pretrained(save_path)
                
                # Save processors
                if self.model_type == "clip" and hasattr(self, 'processor'):
                    self.processor.save_pretrained(save_path)
                else:
                    if hasattr(self, 'image_processor'):
                        self.image_processor.save_pretrained(os.path.join(save_path, "image_processor"))
                    
                    if hasattr(self, 'tokenizer'):
                        self.tokenizer.save_pretrained(os.path.join(save_path, "tokenizer"))
                
                logger.info(f"Model saved in HuggingFace format to {save_path}")
            else:
                # Save as PyTorch checkpoint
                checkpoint = {
                    "model_state_dict": self.model.state_dict(),
                    "model_type": self.model_type,
                    "vision_encoder_name": self.vision_encoder_name,
                    "text_encoder_name": self.text_encoder_name,
                    "embedding_dim": self.embedding_dim,
                    "date_saved": datetime.now().isoformat()
                }
                
                torch.save(checkpoint, save_path)
                logger.info(f"Model saved in PyTorch format to {save_path}")
            
        except Exception as e:
            logger.error(f"Error saving model: {e}")
            raise
    
    def preprocess_image(self, image: Union[str, np.ndarray]) -> Dict[str, torch.Tensor]:
        """
        Preprocess an image for the model
        
        Args:
            image: Image as file path or numpy array
            
        Returns:
            Preprocessed image as a tensor dict
        """
        if not TRANSFORMERS_AVAILABLE:
            logger.error("Transformers library not available")
            return {}
        
        # Load image if path is provided
        if isinstance(image, str):
            # Check if file exists
            if not os.path.exists(image):
                logger.error(f"Image file not found: {image}")
                return {}
            
            # Load image
            image_array = cv2.imread(image)
            if image_array is None:
                logger.error(f"Error loading image: {image}")
                return {}
            
            # Convert BGR to RGB
            image_array = cv2.cvtColor(image_array, cv2.COLOR_BGR2RGB)
        else:
            # If image is already a numpy array, ensure it's RGB
            if len(image.shape) == 3 and image.shape[2] == 3:
                # Check if it's BGR (OpenCV format)
                if isinstance(image, np.ndarray):
                    image_array = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                else:
                    image_array = image
            else:
                logger.error("Invalid image format")
                return {}
        
        try:
            # Process based on model type
            if self.model_type == "clip":
                # Process with CLIP processor
                processed = self.processor(images=image_array, return_tensors="pt")
                return processed
            else:
                # Process with ViT image processor
                processed = self.image_processor(images=image_array, return_tensors="pt")
                
                # Move to device
                for key in processed:
                    processed[key] = processed[key].to(self.device)
                
                return processed
                
        except Exception as e:
            logger.error(f"Error preprocessing image: {e}")
            return {}
    
    def preprocess_text(self, text: str) -> Dict[str, torch.Tensor]:
        """
        Preprocess text for the model
        
        Args:
            text: Text string
            
        Returns:
            Preprocessed text as a tensor dict
        """
        if not TRANSFORMERS_AVAILABLE:
            logger.error("Transformers library not available")
            return {}
        
        try:
            # Process based on model type
            if self.model_type == "clip":
                # Process with CLIP processor
                processed = self.processor(text=text, return_tensors="pt")
                return processed
            else:
                # Process with BERT tokenizer
                processed = self.tokenizer(
                    text,
                    padding="max_length",
                    truncation=True,
                    max_length=128,
                    return_tensors="pt"
                )
                
                # Move to device
                for key in processed:
                    processed[key] = processed[key].to(self.device)
                
                return processed
                
        except Exception as e:
            logger.error(f"Error preprocessing text: {e}")
            return {}
    
    def encode_image(self, image: Union[str, np.ndarray]) -> np.ndarray:
        """
        Encode an image into a feature vector
        
        Args:
            image: Image as file path or numpy array
            
        Returns:
            Image feature vector as numpy array
        """
        if not hasattr(self, 'model'):
            logger.error("Model not initialized")
            return np.array([])
        
        # Preprocess image
        inputs = self.preprocess_image(image)
        if not inputs:
            return np.array([])
        
        try:
            # Set model to evaluation mode
            self.model.eval()
            
            # Move inputs to device
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Forward pass with no gradient calculation
            with torch.no_grad():
                if self.model_type == "clip":
                    # Get image features from CLIP
                    outputs = self.model.get_image_features(**inputs)
                else:
                    # Get image features from custom model
                    outputs = self.model.encode_image(**inputs)
                
                # Convert to numpy
                features = outputs.cpu().numpy()
                
                return features
                
        except Exception as e:
            logger.error(f"Error encoding image: {e}")
            return np.array([])
    
    def encode_text(self, text: str) -> np.ndarray:
        """
        Encode text into a feature vector
        
        Args:
            text: Text string
            
        Returns:
            Text feature vector as numpy array
        """
        if not hasattr(self, 'model'):
            logger.error("Model not initialized")
            return np.array([])
        
        # Preprocess text
        inputs = self.preprocess_text(text)
        if not inputs:
            return np.array([])
        
        try:
            # Set model to evaluation mode
            self.model.eval()
            
            # Move inputs to device
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Forward pass with no gradient calculation
            with torch.no_grad():
                if self.model_type == "clip":
                    # Get text features from CLIP
                    outputs = self.model.get_text_features(**inputs)
                else:
                    # Get text features from custom model
                    outputs = self.model.encode_text(**inputs)
                
                # Convert to numpy
                features = outputs.cpu().numpy()
                
                return features
                
        except Exception as e:
            logger.error(f"Error encoding text: {e}")
            return np.array([])
    
    def compute_similarity(self, 
                          image: Union[str, np.ndarray], 
                          texts: List[str]) -> List[float]:
        """
        Compute similarity between an image and multiple texts
        
        Args:
            image: Image as file path or numpy array
            texts: List of text strings
            
        Returns:
            List of similarity scores between the image and texts
        """
        if not hasattr(self, 'model'):
            logger.error("Model not initialized")
            return []
        
        try:
            # Set model to evaluation mode
            self.model.eval()
            
            # Preprocess image
            image_inputs = self.preprocess_image(image)
            if not image_inputs:
                return []
            
            # Move image inputs to device
            image_inputs = {k: v.to(self.device) for k, v in image_inputs.items()}
            
            # Process each text
            similarities = []
            for text in texts:
                # Preprocess text
                text_inputs = self.preprocess_text(text)
                if not text_inputs:
                    similarities.append(0.0)
                    continue
                
                # Move text inputs to device
                text_inputs = {k: v.to(self.device) for k, v in text_inputs.items()}
                
                # Forward pass with no gradient calculation
                with torch.no_grad():
                    if self.model_type == "clip":
                        # Compute similarity with CLIP
                        logits_per_image = self.model(**{**image_inputs, **text_inputs}).logits_per_image
                        similarity = torch.sigmoid(logits_per_image).item()
                    else:
                        # Compute similarity with custom model
                        image_features = self.model.encode_image(**image_inputs)
                        text_features = self.model.encode_text(**text_inputs)
                        
                        # Normalize features
                        image_features = F.normalize(image_features, p=2, dim=1)
                        text_features = F.normalize(text_features, p=2, dim=1)
                        
                        # Compute cosine similarity
                        similarity = torch.mm(image_features, text_features.t())[0][0].item()
                        
                        # Convert from cosine similarity (-1 to 1) to range 0 to 1
                        similarity = (similarity + 1) / 2
                    
                    similarities.append(similarity)
            
            return similarities
                
        except Exception as e:
            logger.error(f"Error computing similarity: {e}")
            return []
    
    def classify_pattern(self, 
                        image: Union[str, np.ndarray], 
                        pattern_classes: List[str]) -> List[Tuple[str, float]]:
        """
        Classify a pattern image into predefined pattern classes
        
        Args:
            image: Pattern image as file path or numpy array
            pattern_classes: List of pattern class names
            
        Returns:
            List of (pattern_class, confidence) tuples, sorted by confidence (descending)
        """
        # Compute similarity between image and pattern classes
        similarities = self.compute_similarity(image, pattern_classes)
        
        # Combine with pattern classes and sort by similarity (descending)
        results = [(pattern_classes[i], similarities[i]) for i in range(len(pattern_classes))]
        results.sort(key=lambda x: x[1], reverse=True)
        
        return results
    
    def extract_specifications(self, 
                             image: Union[str, np.ndarray], 
                             specification_templates: List[str]) -> Dict[str, Any]:
        """
        Extract specifications from a pattern image using specification templates
        
        Args:
            image: Pattern image as file path or numpy array
            specification_templates: List of specification template strings
            
        Returns:
            Dictionary of extracted specifications
        """
        # Simplified template-based extraction
        similarities = self.compute_similarity(image, specification_templates)
        
        # Extract specifications from the most similar templates
        # In a real implementation, this would use more sophisticated NLP techniques
        specifications = {}
        
        # Find templates with similarity above threshold
        threshold = 0.7
        matching_templates = [(specification_templates[i], similarities[i]) 
                             for i in range(len(specification_templates))
                             if similarities[i] >= threshold]
        
        # Sort by similarity (descending)
        matching_templates.sort(key=lambda x: x[1], reverse=True)
        
        # Extract specifications from templates
        for template, _ in matching_templates:
            # Simple parsing of templates 
            # Format: "Type: {type}, Material: {material}, Pattern: {pattern}"
            parts = template.split(", ")
            for part in parts:
                if ": " in part:
                    key, value = part.split(": ", 1)
                    key = key.strip().lower()
                    value = value.strip()
                    
                    # Remove template placeholders
                    if value.startswith("{") and value.endswith("}"):
                        continue
                    
                    specifications[key] = value
        
        return specifications
    
    def find_pattern_specification_relationships(self,
                                             image: Union[str, np.ndarray],
                                             specifications: List[str]) -> Dict[str, float]:
        """
        Find relationships between a pattern image and textual specifications
        
        Args:
            image: Pattern image as file path or numpy array
            specifications: List of textual specifications
            
        Returns:
            Dictionary mapping specifications to relationship scores
        """
        # Compute similarity between image and specifications
        similarities = self.compute_similarity(image, specifications)
        
        # Create mapping of specifications to scores
        relationships = {specifications[i]: similarities[i] for i in range(len(specifications))}
        
        return relationships
    
    def train(self, 
             train_dataset: 'MultiModalDataset',
             validation_dataset: Optional['MultiModalDataset'] = None,
             num_epochs: int = 10,
             batch_size: int = 16,
             learning_rate: float = 2e-5,
             weight_decay: float = 0.01,
             warmup_steps: int = 0,
             output_dir: Optional[str] = None,
             save_every: int = 1,
             contrastive_loss_weight: float = 0.5):
        """
        Train the model on a dataset of image-text pairs
        
        Args:
            train_dataset: Training dataset
            validation_dataset: Optional validation dataset
            num_epochs: Number of training epochs
            batch_size: Batch size
            learning_rate: Learning rate
            weight_decay: Weight decay for regularization
            warmup_steps: Number of warmup steps for learning rate scheduler
            output_dir: Directory to save checkpoints
            save_every: Save checkpoint every N epochs
            contrastive_loss_weight: Weight for contrastive loss vs. cross-entropy loss
        """
        if not hasattr(self, 'model'):
            logger.error("Model not initialized")
            return
        
        # Create output directory if needed
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        
        # Create data loaders
        train_loader = DataLoader(
            train_dataset,
            batch_size=batch_size,
            shuffle=True,
            num_workers=4
        )
        
        if validation_dataset:
            val_loader = DataLoader(
                validation_dataset,
                batch_size=batch_size,
                shuffle=False,
                num_workers=4
            )
        
        # Prepare optimizer and scheduler
        optimizer = AdamW(
            self.model.parameters(),
            lr=learning_rate,
            weight_decay=weight_decay
        )
        
        total_steps = len(train_loader) * num_epochs
        if warmup_steps > 0:
            scheduler = get_linear_schedule_with_warmup(
                optimizer,
                num_warmup_steps=warmup_steps,
                num_training_steps=total_steps
            )
        else:
            scheduler = None
        
        # Training loop
        logger.info(f"Starting training for {num_epochs} epochs")
        
        for epoch in range(num_epochs):
            # Training
            self.model.train()
            train_loss = 0.0
            train_steps = 0
            
            for batch in tqdm(train_loader, desc=f"Epoch {epoch+1}/{num_epochs}"):
                # Move batch to device
                batch = {k: v.to(self.device) if isinstance(v, torch.Tensor) else v 
                        for k, v in batch.items()}
                
                # Zero gradients
                optimizer.zero_grad()
                
                # Forward pass
                outputs = self.model(**batch)
                
                # Compute loss
                if self.model_type == "clip":
                    # CLIP has its own loss function
                    loss = outputs.loss
                else:
                    # Compute custom loss (cross-entropy + contrastive)
                    loss = outputs.loss
                
                # Backward pass
                loss.backward()
                
                # Update parameters
                optimizer.step()
                
                # Update scheduler if provided
                if scheduler:
                    scheduler.step()
                
                # Update statistics
                train_loss += loss.item()
                train_steps += 1
            
            # Log training loss
            avg_train_loss = train_loss / train_steps
            logger.info(f"Epoch {epoch+1}/{num_epochs} - Train Loss: {avg_train_loss:.4f}")
            
            # Validation
            if validation_dataset:
                self.model.eval()
                val_loss = 0.0
                val_steps = 0
                
                with torch.no_grad():
                    for batch in tqdm(val_loader, desc="Validation"):
                        # Move batch to device
                        batch = {k: v.to(self.device) if isinstance(v, torch.Tensor) else v 
                                for k, v in batch.items()}
                        
                        # Forward pass
                        outputs = self.model(**batch)
                        
                        # Compute loss
                        if self.model_type == "clip":
                            # CLIP has its own loss function
                            loss = outputs.loss
                        else:
                            # Compute custom loss (cross-entropy + contrastive)
                            loss = outputs.loss
                        
                        # Update statistics
                        val_loss += loss.item()
                        val_steps += 1
                
                # Log validation loss
                avg_val_loss = val_loss / val_steps
                logger.info(f"Epoch {epoch+1}/{num_epochs} - Validation Loss: {avg_val_loss:.4f}")
            
            # Save checkpoint
            if output_dir and (epoch + 1) % save_every == 0:
                checkpoint_path = os.path.join(output_dir, f"checkpoint-epoch-{epoch+1}.pt")
                self.save_model(checkpoint_path)
                logger.info(f"Checkpoint saved to {checkpoint_path}")
        
        # Save final model
        if output_dir:
            final_path = os.path.join(output_dir, "final_model.pt")
            self.save_model(final_path)
            logger.info(f"Final model saved to {final_path}")


class MultiModalTransformer(nn.Module):
    """
    Custom multi-modal transformer model with vision and text encoders,
    cross-attention, and contrastive learning capabilities.
    """
    
    def __init__(self, 
                vision_encoder: nn.Module,
                text_encoder: nn.Module,
                embedding_dim: int = 768,
                num_attention_heads: int = 8,
                dropout: float = 0.1):
        """
        Initialize the multi-modal transformer model
        
        Args:
            vision_encoder: Pre-trained vision encoder
            text_encoder: Pre-trained text encoder
            embedding_dim: Dimension of the joint embedding space
            num_attention_heads: Number of attention heads in cross-attention
            dropout: Dropout probability
        """
        super().__init__()
        
        # Save encoders
        self.vision_encoder = vision_encoder
        self.text_encoder = text_encoder
        
        # Get encoder output dimensions
        self.vision_dim = vision_encoder.config.hidden_size
        self.text_dim = text_encoder.config.hidden_size
        
        # Projection layers to joint embedding space
        self.vision_projection = nn.Linear(self.vision_dim, embedding_dim)
        self.text_projection = nn.Linear(self.text_dim, embedding_dim)
        
        # Cross-attention layers
        self.vision_to_text_attention = nn.MultiheadAttention(
            embed_dim=embedding_dim,
            num_heads=num_attention_heads,
            dropout=dropout
        )
        
        self.text_to_vision_attention = nn.MultiheadAttention(
            embed_dim=embedding_dim,
            num_heads=num_attention_heads,
            dropout=dropout
        )
        
        # Feed-forward layers
        self.vision_ff = nn.Sequential(
            nn.Linear(embedding_dim, embedding_dim * 4),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(embedding_dim * 4, embedding_dim),
            nn.Dropout(dropout)
        )
        
        self.text_ff = nn.Sequential(
            nn.Linear(embedding_dim, embedding_dim * 4),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(embedding_dim * 4, embedding_dim),
            nn.Dropout(dropout)
        )
        
        # Layer normalization
        self.vision_ln1 = nn.LayerNorm(embedding_dim)
        self.vision_ln2 = nn.LayerNorm(embedding_dim)
        self.text_ln1 = nn.LayerNorm(embedding_dim)
        self.text_ln2 = nn.LayerNorm(embedding_dim)
        
        # Joint representation layer
        self.joint_representation = nn.Linear(embedding_dim * 2, embedding_dim)
        
        # Save dimensions
        self.embedding_dim = embedding_dim
    
    def encode_image(self, pixel_values, **kwargs):
        """
        Encode an image into a feature vector
        
        Args:
            pixel_values: Image pixel values
            **kwargs: Additional arguments for the vision encoder
            
        Returns:
            Image feature vector
        """
        # Vision encoder
        vision_outputs = self.vision_encoder(pixel_values=pixel_values, **kwargs)
        vision_features = vision_outputs.last_hidden_state
        
        # Get [CLS] token or average over sequence
        if hasattr(vision_outputs, "pooler_output"):
            vision_pooled = vision_outputs.pooler_output
        else:
            vision_pooled = vision_features[:, 0]
        
        # Project to embedding dimension
        vision_embedding = self.vision_projection(vision_pooled)
        
        return vision_embedding
    
    def encode_text(self, input_ids, attention_mask=None, **kwargs):
        """
        Encode text into a feature vector
        
        Args:
            input_ids: Text token IDs
            attention_mask: Attention mask
            **kwargs: Additional arguments for the text encoder
            
        Returns:
            Text feature vector
        """
        # Text encoder
        text_outputs = self.text_encoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
            **kwargs
        )
        text_features = text_outputs.last_hidden_state
        
        # Get [CLS] token
        text_pooled = text_features[:, 0]
        
        # Project to embedding dimension
        text_embedding = self.text_projection(text_pooled)
        
        return text_embedding
    
    def forward(self, 
               pixel_values=None, 
               input_ids=None, 
               attention_mask=None,
               vision_features=None,
               text_features=None,
               labels=None,
               **kwargs):
        """
        Forward pass through the model
        
        Args:
            pixel_values: Image pixel values
            input_ids: Text token IDs
            attention_mask: Text attention mask
            vision_features: Pre-computed vision features (optional)
            text_features: Pre-computed text features (optional)
            labels: Labels for computing loss (optional)
            **kwargs: Additional arguments
            
        Returns:
            Model outputs including loss and embeddings
        """
        # Process vision input
        if vision_features is None and pixel_values is not None:
            # Vision encoder
            vision_outputs = self.vision_encoder(pixel_values=pixel_values, **kwargs)
            vision_features = vision_outputs.last_hidden_state
            
            # Get pooled output
            if hasattr(vision_outputs, "pooler_output"):
                vision_pooled = vision_outputs.pooler_output
            else:
                vision_pooled = vision_features[:, 0]
            
            # Project to embedding dimension
            vision_embedding = self.vision_projection(vision_pooled)
        else:
            vision_embedding = vision_features
        
        # Process text input
        if text_features is None and input_ids is not None:
            # Text encoder
            text_outputs = self.text_encoder(
                input_ids=input_ids,
                attention_mask=attention_mask,
                **kwargs
            )
            text_features = text_outputs.last_hidden_state
            
            # Get pooled output
            text_pooled = text_features[:, 0]
            
            # Project to embedding dimension
            text_embedding = self.text_projection(text_pooled)
        else:
            text_embedding = text_features
        
        # Cross-attention between vision and text
        # Reshape for attention (seq_len, batch_size, embedding_dim)
        vision_embedding_attn = vision_embedding.unsqueeze(0)
        text_embedding_attn = text_embedding.unsqueeze(0)
        
        # Vision attended by text
        attn_output_v, _ = self.text_to_vision_attention(
            query=vision_embedding_attn,
            key=text_embedding_attn,
            value=text_embedding_attn
        )
        
        # Text attended by vision
        attn_output_t, _ = self.vision_to_text_attention(
            query=text_embedding_attn,
            key=vision_embedding_attn,
            value=vision_embedding_attn
        )
        
        # Reshape back (batch_size, embedding_dim)
        attn_output_v = attn_output_v.squeeze(0)
        attn_output_t = attn_output_t.squeeze(0)
        
        # Residual connections and layer normalization
        vision_attended = self.vision_ln1(vision_embedding + attn_output_v)
        text_attended = self.text_ln1(text_embedding + attn_output_t)
        
        # Feed-forward layers
        vision_out = self.vision_ln2(vision_attended + self.vision_ff(vision_attended))
        text_out = self.text_ln2(text_attended + self.text_ff(text_attended))
        
        # Joint representation
        joint_embedding = torch.cat([vision_out, text_out], dim=1)
        joint_embedding = self.joint_representation(joint_embedding)
        
        # Compute similarity scores
        similarity = torch.matmul(vision_out, text_out.t())
        
        # Compute loss if labels provided
        loss = None
        if labels is not None:
            # Contrastive loss
            temperature = 0.07
            logits = similarity / temperature
            
            # CrossEntropyLoss: Assume diagonal is positive pairs
            batch_size = logits.size(0)
            targets = torch.arange(batch_size, device=logits.device)
            loss = F.cross_entropy(logits, targets)
        
        # Return outputs
        outputs = {
            "loss": loss,
            "vision_embedding": vision_out,
            "text_embedding": text_out,
            "joint_embedding": joint_embedding,
            "similarity": similarity,
            "logits": similarity if loss is not None else None
        }
        
        # Convert to SimpleNamespace for attribute access
        from types import SimpleNamespace
        return SimpleNamespace(**outputs)


class MultiModalDataset(Dataset):
    """
    Dataset for multi-modal pattern-specification learning
    
    Loads pairs of images and their corresponding textual specifications
    for training the multi-modal model.
    """
    
    def __init__(self, 
                data_file: str,
                image_processor,
                tokenizer,
                image_root_dir: Optional[str] = None,
                max_text_length: int = 128):
        """
        Initialize the dataset
        
        Args:
            data_file: Path to JSON file with image-text pairs
            image_processor: Image processor for preprocessing images
            tokenizer: Tokenizer for preprocessing text
            image_root_dir: Root directory for resolving relative image paths
            max_text_length: Maximum text length after tokenization
        """
        self.data_file = data_file
        self.image_processor = image_processor
        self.tokenizer = tokenizer
        self.image_root_dir = image_root_dir
        self.max_text_length = max_text_length
        
        # Load data
        self.data = self._load_data()
    
    def _load_data(self):
        """Load and preprocess data from JSON file"""
        try:
            with open(self.data_file, 'r') as f:
                data = json.load(f)
            
            # Check format and extract pairs
            if isinstance(data, dict) and "pairs" in data:
                return data["pairs"]
            elif isinstance(data, list):
                return data
            else:
                raise ValueError(f"Unsupported data format in {self.data_file}")
                
        except Exception as e:
            logger.error(f"Error loading data from {self.data_file}: {e}")
            return []
    
    def __len__(self):
        """Get dataset length"""
        return len(self.data)
    
    def __getitem__(self, idx):
        """
        Get dataset item at index
        
        Returns:
            Dictionary with preprocessed image and text tensors
        """
        item = self.data[idx]
        
        # Extract image path and text
        image_path = item["image_path"]
        text = item["text"]
        
        # Resolve image path if relative
        if self.image_root_dir and not os.path.isabs(image_path):
            image_path = os.path.join(self.image_root_dir, image_path)
        
        # Load and preprocess image
        try:
            image = cv2.imread(image_path)
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Process image
            image_features = self.image_processor(
                images=image, 
                return_tensors="pt"
            )
            
            # Remove batch dimension
            image_features = {k: v.squeeze(0) for k, v in image_features.items()}
            
            # Process text
            text_features = self.tokenizer(
                text,
                padding="max_length",
                truncation=True,
                max_length=self.max_text_length,
                return_tensors="pt"
            )
            
            # Remove batch dimension
            text_features = {k: v.squeeze(0) for k, v in text_features.items()}
            
            # Combine features
            features = {**image_features, **text_features}
            
            # Add metadata
            features["image_path"] = image_path
            features["text"] = text
            
            return features
            
        except Exception as e:
            logger.error(f"Error processing item {idx}: {e}")
            # Return empty tensors in case of error
            return {
                "pixel_values": torch.zeros((3, 224, 224)),
                "input_ids": torch.zeros((self.max_text_length,), dtype=torch.long),
                "attention_mask": torch.zeros((self.max_text_length,), dtype=torch.long),
                "image_path": image_path,
                "text": text
            }


def create_multimodal_recognizer(
                                model_path: Optional[str] = None,
                                vision_encoder: str = "vit-base-patch16-224",
                                text_encoder: str = "bert-base-uncased",
                                use_clip: bool = True,
                                embedding_dim: int = 768,
                                device: Optional[str] = None,
                                cache_dir: Optional[str] = None) -> MultiModalPatternRecognizer:
    """
    Create a multi-modal pattern recognizer
    
    Args:
        model_path: Path to load a pre-trained model
        vision_encoder: Vision transformer model name
        text_encoder: Text transformer model name
        use_clip: Whether to use CLIP model (instead of separate encoders)
        embedding_dim: Dimension of the joint embedding space
        device: Device to run the model on ('cuda', 'cpu', or None for auto-detection)
        cache_dir: Directory to cache models and data
        
    Returns:
        Initialized multi-modal pattern recognizer
    """
    if not TORCH_AVAILABLE or not TRANSFORMERS_AVAILABLE:
        logger.error("Required libraries (PyTorch and/or Transformers) not available")
        return None
    
    try:
        if use_clip:
            # Use CLIP model for both vision and text
            vision_encoder = "openai/clip-vit-base-patch32"
            text_encoder = "openai/clip-vit-base-patch32"
        
        # Initialize recognizer
        recognizer = MultiModalPatternRecognizer(
            model_path=model_path,
            vision_encoder=vision_encoder,
            text_encoder=text_encoder,
            use_pretrained=True,
            embedding_dim=embedding_dim,
            device=device,
            cache_dir=cache_dir
        )
        
        logger.info(f"Multi-modal pattern recognizer created successfully with model type: {recognizer.model_type}")
        
        return recognizer
        
    except Exception as e:
        logger.error(f"Error creating multi-modal pattern recognizer: {e}")
        return None


def generate_multimodal_embedding(image_path: str, 
                                specification: str,
                                model_path: Optional[str] = None,
                                use_clip: bool = True,
                                cache_dir: Optional[str] = None) -> Dict[str, Any]:
    """
    Generate multi-modal embedding for an image-specification pair
    
    Args:
        image_path: Path to the image file
        specification: Textual specification
        model_path: Path to the pre-trained model
        use_clip: Whether to use CLIP model
        cache_dir: Directory to cache models and data
        
    Returns:
        Dictionary with embeddings and metadata
    """
    # Create recognizer
    recognizer = create_multimodal_recognizer(
        model_path=model_path,
        use_clip=use_clip,
        cache_dir=cache_dir
    )
    
    if recognizer is None:
        logger.error("Failed to create recognizer")
        return {}
    
    try:
        # Encode image and text
        image_embedding = recognizer.encode_image(image_path)
        text_embedding = recognizer.encode_text(specification)
        
        # Compute similarity
        similarity = recognizer.compute_similarity(image_path, [specification])[0]
        
        # Prepare result
        result = {
            "image_embedding": image_embedding.tolist() if isinstance(image_embedding, np.ndarray) else [],
            "text_embedding": text_embedding.tolist() if isinstance(text_embedding, np.ndarray) else [],
            "similarity": similarity,
            "image_path": image_path,
            "specification": specification,
            "model_type": recognizer.model_type,
            "embedding_dim": recognizer.embedding_dim
        }
        
        return result
        
    except Exception as e:
        logger.error(f"Error generating multi-modal embedding: {e}")
        return {}


if __name__ == "__main__":
    # Example usage when script is run directly
    import argparse
    
    parser = argparse.ArgumentParser(description="Multi-modal pattern recognition")
    parser.add_argument("--action", choices=["train", "evaluate", "extract", "classify"], 
                        required=True, help="Action to perform")
    parser.add_argument("--image", help="Path to image file")
    parser.add_argument("--text", help="Text specification")
    parser.add_argument("--model", help="Path to model file")
    parser.add_argument("--data", help="Path to data file for training")
    parser.add_argument("--output", help="Output directory")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size for training")
    parser.add_argument("--epochs", type=int, default=10, help="Number of training epochs")
    parser.add_argument("--use-clip", action="store_true", help="Use CLIP model")
    parser.add_argument("--cache-dir", help="Cache directory")
    
    args = parser.parse_args()
    
    try:
        if args.action == "train":
            if not args.data:
                print("Error: --data is required for training")
                sys.exit(1)
            
            # Initialize recognizer
            recognizer = create_multimodal_recognizer(
                model_path=args.model,
                use_clip=args.use_clip,
                cache_dir=args.cache_dir
            )
            
            if recognizer is None:
                print("Error: Failed to create recognizer")
                sys.exit(1)
            
            # Create dataset
            if args.model_type == "clip":
                from transformers import CLIPProcessor
                processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
                image_processor = processor
                tokenizer = processor
            else:
                from transformers import AutoImageProcessor, AutoTokenizer
                image_processor = AutoImageProcessor.from_pretrained(recognizer.vision_encoder_name)
                tokenizer = AutoTokenizer.from_pretrained(recognizer.text_encoder_name)
            
            # Create output directory if needed
            if args.output:
                os.makedirs(args.output, exist_ok=True)
            
            # Create dataset
            train_dataset = MultiModalDataset(
                data_file=args.data,
                image_processor=image_processor,
                tokenizer=tokenizer,
                image_root_dir=os.path.dirname(args.data),
                max_text_length=128
            )
            
            # Train model
            recognizer.train(
                train_dataset=train_dataset,
                num_epochs=args.epochs,
                batch_size=args.batch_size,
                output_dir=args.output
            )
            
            print(f"Training completed, model saved to {args.output}")
            
        elif args.action == "evaluate":
            if not args.image or not args.text:
                print("Error: --image and --text are required for evaluation")
                sys.exit(1)
            
            # Generate embedding
            result = generate_multimodal_embedding(
                image_path=args.image,
                specification=args.text,
                model_path=args.model,
                use_clip=args.use_clip,
                cache_dir=args.cache_dir
            )
            
            if not result:
                print("Error: Failed to generate embedding")
                sys.exit(1)
            
            # Print similarity
            print(f"Similarity: {result['similarity']:.4f}")
            
            # Save result if output specified
            if args.output:
                os.makedirs(os.path.dirname(args.output), exist_ok=True)
                with open(args.output, "w") as f:
                    json.dump(result, f, indent=2)
                
                print(f"Result saved to {args.output}")
            
        elif args.action == "extract":
            if not args.image:
                print("Error: --image is required for extraction")
                sys.exit(1)
            
            # Initialize recognizer
            recognizer = create_multimodal_recognizer(
                model_path=args.model,
                use_clip=args.use_clip,
                cache_dir=args.cache_dir
            )
            
            if recognizer is None:
                print("Error: Failed to create recognizer")
                sys.exit(1)
            
            # Define specification templates
            templates = [
                "Type: ceramic, Material: porcelain, Pattern: geometric",
                "Type: textile, Material: cotton, Pattern: floral",
                "Type: stone, Material: marble, Pattern: veined",
                "Type: wood, Material: oak, Pattern: grain",
                "Type: metal, Material: steel, Pattern: brushed"
            ]
            
            # Extract specifications
            specifications = recognizer.extract_specifications(args.image, templates)
            
            # Print specifications
            print("Extracted Specifications:")
            for key, value in specifications.items():
                print(f"{key}: {value}")
            
            # Save result if output specified
            if args.output:
                os.makedirs(os.path.dirname(args.output), exist_ok=True)
                with open(args.output, "w") as f:
                    json.dump(specifications, f, indent=2)
                
                print(f"Specifications saved to {args.output}")
            
        elif args.action == "classify":
            if not args.image:
                print("Error: --image is required for classification")
                sys.exit(1)
            
            # Initialize recognizer
            recognizer = create_multimodal_recognizer(
                model_path=args.model,
                use_clip=args.use_clip,
                cache_dir=args.cache_dir
            )
            
            if recognizer is None:
                print("Error: Failed to create recognizer")
                sys.exit(1)
            
            # Define pattern classes
            pattern_classes = [
                "geometric",
                "floral",
                "stripes",
                "polka dots",
                "chevron",
                "abstract",
                "plaid",
                "animal print",
                "paisley",
                "damask"
            ]
            
            # Classify pattern
            results = recognizer.classify_pattern(args.image, pattern_classes)
            
            # Print results
            print("Pattern Classification:")
            for pattern, confidence in results:
                print(f"{pattern}: {confidence:.4f}")
            
            # Save result if output specified
            if args.output:
                os.makedirs(os.path.dirname(args.output), exist_ok=True)
                with open(args.output, "w") as f:
                    json.dump({pattern: float(confidence) for pattern, confidence in results}, f, indent=2)
                
                print(f"Classification results saved to {args.output}")
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)