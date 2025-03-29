#!/usr/bin/env python3
"""
OCR Model Fine-tuner for Neural OCR

This module provides capabilities for domain-specific fine-tuning of OCR models
to improve accuracy for material datasheets and technical specifications.

Key features:
1. Fine-tuning of Nougat models for technical content
2. Optimization of Marker for material catalog layouts
3. Training custom extractors for thepipe
4. Dataset management for training and evaluation
5. Evaluation metrics specific to material data extraction
"""

import os
import sys
import json
import logging
import tempfile
import shutil
import time
from typing import Dict, List, Any, Tuple, Optional, Union
from pathlib import Path
import numpy as np
import cv2
import torch

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Try to import engine-specific modules
try:
    # Nougat imports
    import nougat
    from nougat.utils.checkpoint import get_checkpoint
    from nougat.utils.device import parse_args, get_device
    from nougat.dataset.rasterize import rasterize_paper
    from nougat.postprocessing import markdown_compatible, close_envs
    from nougat.model import load_model, NougatModel
    
    NOUGAT_AVAILABLE = True
    logger.info("Nougat dependencies loaded successfully")
except ImportError:
    NOUGAT_AVAILABLE = False
    logger.warning("Nougat not available for fine-tuning")

try:
    # Marker imports
    import marker
    from marker import document_to_markdown
    from marker.models import DocumentAnalysisModel
    
    MARKER_AVAILABLE = True
    logger.info("Marker dependencies loaded successfully")
except ImportError:
    MARKER_AVAILABLE = False
    logger.warning("Marker not available for fine-tuning")

try:
    # thepipe imports
    import thepipe
    from thepipe.pipeline import Pipeline
    from thepipe.extractors import DocumentExtractor
    
    THEPIPE_AVAILABLE = True
    logger.info("thepipe dependencies loaded successfully")
except ImportError:
    THEPIPE_AVAILABLE = False
    logger.warning("thepipe not available for fine-tuning")


class OCRDataset:
    """Manages datasets for OCR model fine-tuning"""
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the OCR dataset
        
        Args:
            config: Configuration dictionary
        """
        self.config = {
            'dataset_dir': None,
            'train_ratio': 0.8,
            'val_ratio': 0.1,
            'test_ratio': 0.1,
            'augmentation': True,
            'min_samples': 100,
            'max_samples': 10000,
            'balance_classes': True,
            'image_size': (1024, 1024),
            'cache_preprocessed': True
        }
        
        if config:
            self.config.update(config)
        
        # Create dataset directory if needed
        if not self.config['dataset_dir']:
            self.config['dataset_dir'] = os.path.join(os.getcwd(), 'ocr_datasets')
        
        os.makedirs(self.config['dataset_dir'], exist_ok=True)
        
        # Initialize dataset statistics
        self.statistics = {
            'total_samples': 0,
            'train_samples': 0,
            'val_samples': 0,
            'test_samples': 0,
            'categories': {},
            'last_updated': None
        }
        
        # Load existing dataset if available
        self._load_dataset_info()
    
    def _load_dataset_info(self):
        """Load dataset information if available"""
        info_path = os.path.join(self.config['dataset_dir'], 'dataset_info.json')
        if os.path.exists(info_path):
            try:
                with open(info_path, 'r', encoding='utf-8') as f:
                    self.statistics = json.load(f)
                logger.info(f"Loaded dataset info: {self.statistics['total_samples']} samples")
            except Exception as e:
                logger.error(f"Failed to load dataset info: {e}")
    
    def _save_dataset_info(self):
        """Save dataset information"""
        info_path = os.path.join(self.config['dataset_dir'], 'dataset_info.json')
        try:
            self.statistics['last_updated'] = time.strftime('%Y-%m-%d %H:%M:%S')
            with open(info_path, 'w', encoding='utf-8') as f:
                json.dump(self.statistics, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save dataset info: {e}")
    
    def prepare_from_documents(self, document_paths: List[str], labels_path: str = None) -> Dict[str, Any]:
        """
        Prepare dataset from document files
        
        Args:
            document_paths: List of paths to document files
            labels_path: Path to labels file (optional)
            
        Returns:
            Dictionary with dataset preparation results
        """
        logger.info(f"Preparing dataset from {len(document_paths)} documents")
        
        # Create subdirectories
        train_dir = os.path.join(self.config['dataset_dir'], 'train')
        val_dir = os.path.join(self.config['dataset_dir'], 'val')
        test_dir = os.path.join(self.config['dataset_dir'], 'test')
        
        os.makedirs(train_dir, exist_ok=True)
        os.makedirs(val_dir, exist_ok=True)
        os.makedirs(test_dir, exist_ok=True)
        
        # Load labels if provided
        labels = {}
        if labels_path and os.path.exists(labels_path):
            try:
                with open(labels_path, 'r', encoding='utf-8') as f:
                    labels = json.load(f)
                logger.info(f"Loaded {len(labels)} labels")
            except Exception as e:
                logger.error(f"Failed to load labels: {e}")
        
        # Process each document
        processed_count = 0
        for doc_path in document_paths:
            try:
                # Determine document type
                if doc_path.lower().endswith('.pdf'):
                    # Process PDF document
                    result = self._process_pdf_document(doc_path, labels.get(doc_path))
                elif doc_path.lower().endswith(('.jpg', '.jpeg', '.png', '.tif', '.tiff')):
                    # Process image document
                    result = self._process_image_document(doc_path, labels.get(doc_path))
                else:
                    logger.warning(f"Unsupported document type: {doc_path}")
                    continue
                
                if result and result.get('success'):
                    processed_count += 1
                    
                    # Update statistics
                    self.statistics['total_samples'] += result.get('sample_count', 0)
                    
                    # Update category statistics
                    for category, count in result.get('categories', {}).items():
                        if category not in self.statistics['categories']:
                            self.statistics['categories'][category] = 0
                        self.statistics['categories'][category] += count
            
            except Exception as e:
                logger.error(f"Error processing document {doc_path}: {e}")
        
        # Split dataset into train/val/test
        self._split_dataset()
        
        # Save dataset info
        self._save_dataset_info()
        
        return {
            'processed_documents': processed_count,
            'total_samples': self.statistics['total_samples'],
            'train_samples': self.statistics['train_samples'],
            'val_samples': self.statistics['val_samples'],
            'test_samples': self.statistics['test_samples'],
            'categories': self.statistics['categories']
        }
    
    def _process_pdf_document(self, pdf_path: str, labels: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Process a PDF document to extract training samples
        
        Args:
            pdf_path: Path to PDF file
            labels: Labels for this document (optional)
            
        Returns:
            Dictionary with processing results
        """
        try:
            # Import PyMuPDF for PDF processing
            import fitz
            
            result = {
                'success': False,
                'sample_count': 0,
                'categories': {}
            }
            
            # Open the PDF
            doc = fitz.open(pdf_path)
            
            # Process each page
            for page_idx, page in enumerate(doc):
                # Extract images for this page
                pix = page.get_pixmap(dpi=300)
                img_path = os.path.join(self.config['dataset_dir'], 'temp', f"{Path(pdf_path).stem}_page{page_idx+1}.png")
                os.makedirs(os.path.dirname(img_path), exist_ok=True)
                pix.save(img_path)
                
                # Get page labels if available
                page_labels = None
                if labels and 'pages' in labels and str(page_idx) in labels['pages']:
                    page_labels = labels['pages'][str(page_idx)]
                
                # Process page image
                page_result = self._process_image_document(img_path, page_labels)
                
                # Update result
                if page_result and page_result.get('success'):
                    result['success'] = True
                    result['sample_count'] += page_result.get('sample_count', 0)
                    
                    # Update categories
                    for category, count in page_result.get('categories', {}).items():
                        if category not in result['categories']:
                            result['categories'][category] = 0
                        result['categories'][category] += count
                
                # Clean up temporary image
                try:
                    os.unlink(img_path)
                except:
                    pass
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing PDF {pdf_path}: {e}")
            return {'success': False, 'error': str(e)}
    
    def _process_image_document(self, image_path: str, labels: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Process an image document to extract training samples
        
        Args:
            image_path: Path to image file
            labels: Labels for this image (optional)
            
        Returns:
            Dictionary with processing results
        """
        try:
            result = {
                'success': False,
                'sample_count': 0,
                'categories': {}
            }
            
            # Read the image
            image = cv2.imread(image_path)
            if image is None:
                return {'success': False, 'error': 'Failed to read image'}
            
            # Create sample ID based on image path
            sample_id = Path(image_path).stem
            
            # Base directory for samples
            sample_dir = os.path.join(self.config['dataset_dir'], 'samples')
            os.makedirs(sample_dir, exist_ok=True)
            
            # Save image sample
            sample_path = os.path.join(sample_dir, f"{sample_id}.png")
            cv2.imwrite(sample_path, image)
            
            # Create label file
            label_path = os.path.join(sample_dir, f"{sample_id}.json")
            
            # Use provided labels or create default ones
            sample_labels = labels or {
                'regions': [],
                'text': '',
                'metadata': {
                    'source': image_path,
                    'format': 'auto'
                }
            }
            
            # Save labels
            with open(label_path, 'w', encoding='utf-8') as f:
                json.dump(sample_labels, f, indent=2)
            
            # Update statistics
            result['success'] = True
            result['sample_count'] = 1
            
            # Update category statistics
            category = sample_labels.get('category', 'uncategorized')
            result['categories'][category] = 1
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing image {image_path}: {e}")
            return {'success': False, 'error': str(e)}
    
    def _split_dataset(self):
        """Split dataset into train/val/test sets"""
        # Get all samples
        sample_dir = os.path.join(self.config['dataset_dir'], 'samples')
        if not os.path.exists(sample_dir):
            logger.warning("No samples directory found")
            return
        
        # Get all sample image files
        sample_files = [f for f in os.listdir(sample_dir) if f.endswith('.png')]
        
        if not sample_files:
            logger.warning("No sample files found")
            return
        
        # Shuffle samples
        np.random.shuffle(sample_files)
        
        # Calculate split sizes
        total = len(sample_files)
        train_size = int(total * self.config['train_ratio'])
        val_size = int(total * self.config['val_ratio'])
        test_size = total - train_size - val_size
        
        # Split into sets
        train_files = sample_files[:train_size]
        val_files = sample_files[train_size:train_size+val_size]
        test_files = sample_files[train_size+val_size:]
        
        # Create symbolic links in train/val/test directories
        self._create_split_links('train', train_files)
        self._create_split_links('val', val_files)
        self._create_split_links('test', test_files)
        
        # Update statistics
        self.statistics['train_samples'] = len(train_files)
        self.statistics['val_samples'] = len(val_files)
        self.statistics['test_samples'] = len(test_files)
    
    def _create_split_links(self, split_name: str, files: List[str]):
        """Create links to sample files in the split directory"""
        split_dir = os.path.join(self.config['dataset_dir'], split_name)
        sample_dir = os.path.join(self.config['dataset_dir'], 'samples')
        
        # Clear previous files
        for f in os.listdir(split_dir):
            try:
                os.unlink(os.path.join(split_dir, f))
            except:
                pass
        
        # Create links for images and labels
        for file in files:
            # Image file
            src_img = os.path.join(sample_dir, file)
            dst_img = os.path.join(split_dir, file)
            
            # Create link (or copy if links not supported)
            try:
                os.symlink(src_img, dst_img)
            except:
                shutil.copy(src_img, dst_img)
            
            # Label file (JSON with same base name)
            base_name = os.path.splitext(file)[0]
            label_file = f"{base_name}.json"
            
            src_label = os.path.join(sample_dir, label_file)
            dst_label = os.path.join(split_dir, label_file)
            
            if os.path.exists(src_label):
                try:
                    os.symlink(src_label, dst_label)
                except:
                    shutil.copy(src_label, dst_label)
    
    def augment_data(self, augmentation_config: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Augment training data with synthetic variations
        
        Args:
            augmentation_config: Configuration for augmentation
            
        Returns:
            Dictionary with augmentation results
        """
        if not self.config['augmentation']:
            return {'success': False, 'message': 'Augmentation disabled in config'}
        
        config = {
            'rotation_range': 5,  # degrees
            'zoom_range': 0.1,    # fraction
            'brightness_range': 0.1,
            'contrast_range': 0.1,
            'noise_probability': 0.2,
            'blur_probability': 0.2,
            'augmentation_factor': 2,  # How many augmented images per original
            'only_train_set': True      # Only augment training set
        }
        
        if augmentation_config:
            config.update(augmentation_config)
        
        # Only augment training set
        if config['only_train_set']:
            split_dir = os.path.join(self.config['dataset_dir'], 'train')
        else:
            split_dir = os.path.join(self.config['dataset_dir'], 'samples')
        
        # Get original images
        original_files = [f for f in os.listdir(split_dir) if f.endswith('.png')]
        
        if not original_files:
            return {'success': False, 'message': 'No image files found for augmentation'}
        
        # Create augmented directory
        augmented_dir = os.path.join(self.config['dataset_dir'], 'augmented')
        os.makedirs(augmented_dir, exist_ok=True)
        
        # Process each original image
        augmented_count = 0
        
        for original_file in original_files:
            # Load original image
            img_path = os.path.join(split_dir, original_file)
            image = cv2.imread(img_path)
            
            if image is None:
                continue
            
            # Load original label
            base_name = os.path.splitext(original_file)[0]
            label_path = os.path.join(split_dir, f"{base_name}.json")
            
            if os.path.exists(label_path):
                with open(label_path, 'r', encoding='utf-8') as f:
                    label_data = json.load(f)
            else:
                label_data = {}
            
            # Create augmented variations
            for i in range(config['augmentation_factor']):
                # Create augmented image
                aug_image = self._augment_image(image, config)
                
                # Save augmented image
                aug_name = f"{base_name}_aug{i+1}.png"
                aug_path = os.path.join(augmented_dir, aug_name)
                cv2.imwrite(aug_path, aug_image)
                
                # Copy and modify label
                aug_label = label_data.copy()
                
                # Add augmentation metadata
                if 'metadata' not in aug_label:
                    aug_label['metadata'] = {}
                
                aug_label['metadata']['augmented'] = True
                aug_label['metadata']['original_file'] = original_file
                aug_label['metadata']['augmentation_id'] = i + 1
                
                # Save augmented label
                aug_label_path = os.path.join(augmented_dir, f"{base_name}_aug{i+1}.json")
                with open(aug_label_path, 'w', encoding='utf-8') as f:
                    json.dump(aug_label, f, indent=2)
                
                augmented_count += 1
        
        # Update statistics
        self.statistics['augmented_samples'] = augmented_count
        self._save_dataset_info()
        
        return {
            'success': True,
            'original_count': len(original_files),
            'augmented_count': augmented_count
        }
    
    def _augment_image(self, image: np.ndarray, config: Dict[str, Any]) -> np.ndarray:
        """
        Apply augmentation to an image
        
        Args:
            image: Original image
            config: Augmentation configuration
            
        Returns:
            Augmented image
        """
        # Get image dimensions
        height, width = image.shape[:2]
        
        # Random rotation
        if config['rotation_range'] > 0:
            angle = np.random.uniform(-config['rotation_range'], config['rotation_range'])
            M = cv2.getRotationMatrix2D((width / 2, height / 2), angle, 1)
            image = cv2.warpAffine(image, M, (width, height), borderMode=cv2.BORDER_REPLICATE)
        
        # Random zoom
        if config['zoom_range'] > 0:
            zoom = 1 + np.random.uniform(-config['zoom_range'], config['zoom_range'])
            M = cv2.getRotationMatrix2D((width / 2, height / 2), 0, zoom)
            image = cv2.warpAffine(image, M, (width, height), borderMode=cv2.BORDER_REPLICATE)
        
        # Random brightness
        if config['brightness_range'] > 0:
            brightness = 1 + np.random.uniform(-config['brightness_range'], config['brightness_range'])
            image = cv2.convertScaleAbs(image, alpha=brightness, beta=0)
        
        # Random contrast
        if config['contrast_range'] > 0:
            contrast = 1 + np.random.uniform(-config['contrast_range'], config['contrast_range'])
            image = cv2.convertScaleAbs(image, alpha=contrast, beta=128 * (1 - contrast))
        
        # Random noise
        if config['noise_probability'] > 0 and np.random.random() < config['noise_probability']:
            noise = np.random.normal(0, 15, image.shape).astype(np.uint8)
            image = cv2.add(image, noise)
        
        # Random blur
        if config['blur_probability'] > 0 and np.random.random() < config['blur_probability']:
            blur_size = np.random.choice([3, 5])
            image = cv2.GaussianBlur(image, (blur_size, blur_size), 0)
        
        return image
    
    def get_data_loaders(self, batch_size: int = 16) -> Dict[str, Any]:
        """
        Get PyTorch data loaders for the dataset
        
        Args:
            batch_size: Batch size for data loaders
            
        Returns:
            Dictionary with data loaders
        """
        try:
            import torch
            from torch.utils.data import Dataset, DataLoader
            
            class OCRImageDataset(Dataset):
                def __init__(self, root_dir, transform=None):
                    self.root_dir = root_dir
                    self.transform = transform
                    self.image_files = [f for f in os.listdir(root_dir) if f.endswith('.png')]
                    
                def __len__(self):
                    return len(self.image_files)
                
                def __getitem__(self, idx):
                    # Load image
                    img_path = os.path.join(self.root_dir, self.image_files[idx])
                    image = cv2.imread(img_path)
                    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                    
                    # Load label
                    label_path = os.path.join(
                        self.root_dir, 
                        os.path.splitext(self.image_files[idx])[0] + '.json'
                    )
                    
                    if os.path.exists(label_path):
                        with open(label_path, 'r', encoding='utf-8') as f:
                            label_data = json.load(f)
                    else:
                        label_data = {}
                    
                    # Apply transforms if any
                    if self.transform:
                        image = self.transform(image)
                    else:
                        # Convert to tensor manually
                        image = torch.from_numpy(image.transpose((2, 0, 1))).float() / 255.0
                    
                    return image, label_data
            
            # Create datasets
            train_dataset = OCRImageDataset(
                os.path.join(self.config['dataset_dir'], 'train')
            )
            
            val_dataset = OCRImageDataset(
                os.path.join(self.config['dataset_dir'], 'val')
            )
            
            test_dataset = OCRImageDataset(
                os.path.join(self.config['dataset_dir'], 'test')
            )
            
            # Create data loaders
            train_loader = DataLoader(
                train_dataset, 
                batch_size=batch_size,
                shuffle=True,
                num_workers=4
            )
            
            val_loader = DataLoader(
                val_dataset,
                batch_size=batch_size,
                shuffle=False,
                num_workers=4
            )
            
            test_loader = DataLoader(
                test_dataset,
                batch_size=batch_size,
                shuffle=False,
                num_workers=4
            )
            
            return {
                'train_loader': train_loader,
                'val_loader': val_loader,
                'test_loader': test_loader,
                'train_dataset': train_dataset,
                'val_dataset': val_dataset,
                'test_dataset': test_dataset
            }
            
        except Exception as e:
            logger.error(f"Error creating data loaders: {e}")
            return {'error': str(e)}


class OCRModelFineTuner:
    """Fine-tunes OCR models for domain-specific content"""
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the OCR model fine-tuner
        
        Args:
            config: Configuration dictionary
        """
        self.config = {
            'model_dir': None,
            'engine': 'nougat',  # or 'marker', 'thepipe'
            'learning_rate': 1e-5,
            'epochs': 10,
            'batch_size': 8,
            'max_sequence_length': 1024,
            'gradient_accumulation_steps': 4,
            'warmup_ratio': 0.1,
            'weight_decay': 0.01,
            'fp16': True,
            'model_type': 'base',  # or 'small', 'large'
            'pretrained_model_path': None,
            'save_checkpoints': True,
            'checkpoint_steps': 100,
            'evaluation_steps': 50,
            'tensorboard_logging': True,
            'domain': 'material_datasheets'
        }
        
        if config:
            self.config.update(config)
        
        # Create model directory if needed
        if not self.config['model_dir']:
            self.config['model_dir'] = os.path.join(os.getcwd(), 'ocr_models')
        
        os.makedirs(self.config['model_dir'], exist_ok=True)
        
        # Create engine-specific model directory
        self.engine_model_dir = os.path.join(
            self.config['model_dir'],
            self.config['engine'],
            self.config['domain']
        )
        
        os.makedirs(self.engine_model_dir, exist_ok=True)
        
        # Check engine availability
        self.engine_available = False
        if self.config['engine'] == 'nougat':
            self.engine_available = NOUGAT_AVAILABLE
        elif self.config['engine'] == 'marker':
            self.engine_available = MARKER_AVAILABLE
        elif self.config['engine'] == 'thepipe':
            self.engine_available = THEPIPE_AVAILABLE
        
        if not self.engine_available:
            logger.warning(f"Selected engine {self.config['engine']} is not available")
    
    def finetune(self, dataset: OCRDataset) -> Dict[str, Any]:
        """
        Fine-tune the selected OCR model
        
        Args:
            dataset: OCRDataset object with training data
            
        Returns:
            Dictionary with fine-tuning results
        """
        if not self.engine_available:
            return {'success': False, 'message': f"Engine {self.config['engine']} is not available"}
        
        # Get data loaders
        data_loaders = dataset.get_data_loaders(batch_size=self.config['batch_size'])
        
        if 'error' in data_loaders:
            return {'success': False, 'message': f"Error getting data loaders: {data_loaders['error']}"}
        
        # Start training based on engine type
        if self.config['engine'] == 'nougat':
            return self._finetune_nougat(data_loaders)
        elif self.config['engine'] == 'marker':
            return self._finetune_marker(data_loaders)
        elif self.config['engine'] == 'thepipe':
            return self._finetune_thepipe(data_loaders)
        else:
            return {'success': False, 'message': f"Unsupported engine: {self.config['engine']}"}
    
    def _finetune_nougat(self, data_loaders: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fine-tune Nougat model
        
        Args:
            data_loaders: Dictionary with PyTorch data loaders
            
        Returns:
            Dictionary with fine-tuning results
        """
        if not NOUGAT_AVAILABLE:
            return {'success': False, 'message': "Nougat is not available"}
        
        try:
            import torch
            import torch.nn as nn
            import torch.optim as optim
            from torch.utils.tensorboard import SummaryWriter
            from tqdm import tqdm
            
            # Create model directories
            checkpoint_dir = os.path.join(self.engine_model_dir, 'checkpoints')
            logs_dir = os.path.join(self.engine_model_dir, 'logs')
            
            os.makedirs(checkpoint_dir, exist_ok=True)
            os.makedirs(logs_dir, exist_ok=True)
            
            # Initialize TensorBoard if enabled
            writer = None
            if self.config['tensorboard_logging']:
                writer = SummaryWriter(logs_dir)
            
            # Load pretrained model
            device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            
            if self.config['pretrained_model_path']:
                model_path = self.config['pretrained_model_path']
            else:
                # Use default Nougat model
                model_path = self.config['model_type']
            
            logger.info(f"Loading Nougat model from {model_path}")
            
            # Get checkpoint and load model
            ckpt = get_checkpoint(model_path)
            model, processor = load_model(
                ckpt,
                device=device,
                dtype=torch.float16 if self.config['fp16'] else torch.float32
            )
            
            # Set up training parameters
            optimizer = optim.AdamW(
                model.parameters(),
                lr=self.config['learning_rate'],
                weight_decay=self.config['weight_decay']
            )
            
            # Use CTC loss for sequence prediction
            criterion = nn.CTCLoss(blank=0, reduction='mean')
            
            # Prepare for training
            model.train()
            global_step = 0
            best_val_loss = float('inf')
            
            # Training loop
            for epoch in range(self.config['epochs']):
                logger.info(f"Starting epoch {epoch+1}/{self.config['epochs']}")
                
                # Training
                train_loss = 0.0
                train_steps = 0
                
                for images, labels in tqdm(data_loaders['train_loader'], desc=f"Epoch {epoch+1}"):
                    images = images.to(device)
                    
                    # Process batch
                    inputs = processor(images, return_tensors="pt").to(device)
                    
                    # Forward pass
                    with torch.set_grad_enabled(True):
                        outputs = model(**inputs)
                        
                        # Calculate loss
                        loss = outputs.loss
                        
                        # Scale loss for gradient accumulation
                        loss = loss / self.config['gradient_accumulation_steps']
                        
                        # Backward pass
                        loss.backward()
                        
                        # Update weights with gradient accumulation
                        if (global_step + 1) % self.config['gradient_accumulation_steps'] == 0:
                            optimizer.step()
                            optimizer.zero_grad()
                        
                        train_loss += loss.item() * self.config['gradient_accumulation_steps']
                        train_steps += 1
                        global_step += 1
                        
                        # Log to TensorBoard
                        if writer and global_step % 10 == 0:
                            writer.add_scalar('train/loss', loss.item() * self.config['gradient_accumulation_steps'], global_step)
                        
                        # Checkpoint saving
                        if self.config['save_checkpoints'] and global_step % self.config['checkpoint_steps'] == 0:
                            checkpoint_path = os.path.join(checkpoint_dir, f"checkpoint-{global_step}")
                            os.makedirs(checkpoint_path, exist_ok=True)
                            model.save_pretrained(checkpoint_path)
                            logger.info(f"Saved checkpoint at step {global_step}")
                        
                        # Evaluation
                        if global_step % self.config['evaluation_steps'] == 0:
                            val_loss = self._evaluate_nougat(model, processor, data_loaders['val_loader'], criterion, device)
                            
                            if writer:
                                writer.add_scalar('validation/loss', val_loss, global_step)
                            
                            # Save best model
                            if val_loss < best_val_loss:
                                best_val_loss = val_loss
                                best_model_path = os.path.join(self.engine_model_dir, 'best_model')
                                os.makedirs(best_model_path, exist_ok=True)
                                model.save_pretrained(best_model_path)
                                logger.info(f"Saved best model with validation loss {val_loss:.4f}")
                            
                            # Back to training mode
                            model.train()
                
                # End of epoch
                epoch_loss = train_loss / train_steps if train_steps > 0 else 0
                logger.info(f"Epoch {epoch+1} completed. Average loss: {epoch_loss:.4f}")
                
                if writer:
                    writer.add_scalar('train/epoch_loss', epoch_loss, epoch)
            
            # Final evaluation
            model.eval()
            test_loss = self._evaluate_nougat(model, processor, data_loaders['test_loader'], criterion, device)
            logger.info(f"Final test loss: {test_loss:.4f}")
            
            # Save final model
            final_model_path = os.path.join(self.engine_model_dir, 'final_model')
            os.makedirs(final_model_path, exist_ok=True)
            model.save_pretrained(final_model_path)
            
            if writer:
                writer.close()
            
            return {
                'success': True,
                'training_steps': global_step,
                'final_test_loss': test_loss,
                'best_val_loss': best_val_loss,
                'model_path': final_model_path
            }
            
        except Exception as e:
            logger.error(f"Error fine-tuning Nougat model: {e}")
            return {'success': False, 'error': str(e)}
    
    def _evaluate_nougat(self, model, processor, dataloader, criterion, device):
        """Evaluate Nougat model on validation or test set"""
        model.eval()
        total_loss = 0.0
        steps = 0
        
        with torch.no_grad():
            for images, _ in dataloader:
                images = images.to(device)
                
                # Process batch
                inputs = processor(images, return_tensors="pt").to(device)
                
                # Forward pass
                outputs = model(**inputs)
                loss = outputs.loss
                
                total_loss += loss.item()
                steps += 1
        
        return total_loss / steps if steps > 0 else 0
    
    def _finetune_marker(self, data_loaders: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fine-tune Marker model
        
        Args:
            data_loaders: Dictionary with PyTorch data loaders
            
        Returns:
            Dictionary with fine-tuning results
        """
        if not MARKER_AVAILABLE:
            return {'success': False, 'message': "Marker is not available"}
        
        # Marker uses a similar training approach to Nougat
        # Implementation would follow similar pattern as _finetune_nougat
        # with Marker-specific model loading and processing
        
        return {'success': False, 'message': "Marker fine-tuning not fully implemented yet"}
    
    def _finetune_thepipe(self, data_loaders: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fine-tune thepipe extractors
        
        Args:
            data_loaders: Dictionary with PyTorch data loaders
            
        Returns:
            Dictionary with fine-tuning results
        """
        if not THEPIPE_AVAILABLE:
            return {'success': False, 'message': "thepipe is not available"}
        
        try:
            # thepipe uses a different approach - training custom extractors
            
            # Create directories
            extractors_dir = os.path.join(self.engine_model_dir, 'extractors')
            os.makedirs(extractors_dir, exist_ok=True)
            
            # Load training data
            train_data = []
            
            for images, labels in data_loaders['train_loader']:
                # Process each sample
                for i, label_data in enumerate(labels):
                    if 'text' in label_data and 'regions' in label_data:
                        train_data.append(label_data)
            
            # Create and train extractors
            extractors = self._create_material_extractors()
            
            # Train extractors on the dataset
            for extractor in extractors:
                logger.info(f"Training extractor: {extractor.name}")
                
                for sample in train_data:
                    text = sample.get('text', '')
                    if text:
                        # Train extractor on this sample
                        extractor.train(text, sample.get('regions', []))
            
            # Save trained extractors
            pipeline = Pipeline(extractors=extractors)
            pipeline_path = os.path.join(self.engine_model_dir, 'pipeline.json')
            pipeline.save(pipeline_path)
            
            return {
                'success': True,
                'extractor_count': len(extractors),
                'trained_samples': len(train_data),
                'pipeline_path': pipeline_path
            }
            
        except Exception as e:
            logger.error(f"Error fine-tuning thepipe extractors: {e}")
            return {'success': False, 'error': str(e)}
    
    def _create_material_extractors(self):
        """Create extractors for material datasheets"""
        extractors = []
        
        # Dimension extractor
        dimension_extractor = DocumentExtractor(
            'dimensions',
            patterns=[
                r'\d+\s*[xX×]\s*\d+\s*(mm|cm|m)',
                r'dimensions?:?\s*\d+\s*[xX×]\s*\d+',
                r'size:?\s*\d+\s*[xX×]\s*\d+'
            ]
        )
        extractors.append(dimension_extractor)
        
        # Material type extractor
        material_extractor = DocumentExtractor(
            'material_type',
            patterns=[
                r'material:?\s*([a-zA-Z]+)',
                r'type:?\s*([a-zA-Z]+)',
                r'(ceramic|porcelain|natural stone|marble|granite|slate)'
            ]
        )
        extractors.append(material_extractor)
        
        # Product code extractor
        product_code_extractor = DocumentExtractor(
            'product_code',
            patterns=[
                r'product\s*code:?\s*([A-Z0-9\-]+)',
                r'item\s*number:?\s*([A-Z0-9\-]+)',
                r'SKU:?\s*([A-Z0-9\-]+)'
            ]
        )
        extractors.append(product_code_extractor)
        
        # Technical properties extractor
        technical_extractor = DocumentExtractor(
            'technical_properties',
            patterns=[
                r'PEI:?\s*([IVX\d]+)',
                r'R-rating:?\s*(R\d+)',
                r'slip resistance:?\s*([A-Z0-9]+)'
            ]
        )
        extractors.append(technical_extractor)
        
        return extractors
    
    def export_model(self, export_dir: str = None, format: str = 'default') -> Dict[str, Any]:
        """
        Export the fine-tuned model for deployment
        
        Args:
            export_dir: Directory to export the model to
            format: Export format (default, onnx, torchscript)
            
        Returns:
            Dictionary with export results
        """
        if not export_dir:
            export_dir = os.path.join(self.engine_model_dir, 'exported')
        
        os.makedirs(export_dir, exist_ok=True)
        
        # Find best model directory
        best_model_dir = os.path.join(self.engine_model_dir, 'best_model')
        if not os.path.exists(best_model_dir):
            best_model_dir = os.path.join(self.engine_model_dir, 'final_model')
        
        if not os.path.exists(best_model_dir):
            return {'success': False, 'message': "No trained model found"}
        
        # Export based on engine type
        if self.config['engine'] == 'nougat':
            return self._export_nougat_model(best_model_dir, export_dir, format)
        elif self.config['engine'] == 'marker':
            return self._export_marker_model(best_model_dir, export_dir, format)
        elif self.config['engine'] == 'thepipe':
            return self._export_thepipe_model(best_model_dir, export_dir, format)
        else:
            return {'success': False, 'message': f"Unsupported engine: {self.config['engine']}"}
    
    def _export_nougat_model(self, model_dir: str, export_dir: str, format: str) -> Dict[str, Any]:
        """Export Nougat model"""
        try:
            import torch
            
            # Load the model
            device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            model, processor = load_model(model_dir, device=device)
            
            # Default format - save model files
            if format == 'default':
                # Copy model files to export directory
                for filename in os.listdir(model_dir):
                    src_path = os.path.join(model_dir, filename)
                    dst_path = os.path.join(export_dir, filename)
                    
                    if os.path.isfile(src_path):
                        shutil.copy(src_path, dst_path)
                    elif os.path.isdir(src_path):
                        shutil.copytree(src_path, dst_path, dirs_exist_ok=True)
                
                # Create configuration file
                config_path = os.path.join(export_dir, 'engine_config.json')
                with open(config_path, 'w', encoding='utf-8') as f:
                    json.dump({
                        'engine': 'nougat',
                        'domain': self.config['domain'],
                        'model_type': self.config['model_type'],
                        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
                        'configuration': self.config
                    }, f, indent=2)
                
                return {
                    'success': True,
                    'format': 'default',
                    'export_dir': export_dir,
                    'files_exported': len(os.listdir(export_dir))
                }
                
            # ONNX format
            elif format == 'onnx':
                try:
                    import onnx
                    import onnxruntime
                    
                    # TODO: Implement ONNX export for Nougat model
                    return {'success': False, 'message': "ONNX export not fully implemented for Nougat"}
                    
                except ImportError:
                    return {'success': False, 'message': "ONNX libraries not available"}
            
            # TorchScript format
            elif format == 'torchscript':
                # TODO: Implement TorchScript export for Nougat model
                return {'success': False, 'message': "TorchScript export not fully implemented for Nougat"}
            
            else:
                return {'success': False, 'message': f"Unsupported export format: {format}"}
                
        except Exception as e:
            logger.error(f"Error exporting Nougat model: {e}")
            return {'success': False, 'error': str(e)}
    
    def _export_marker_model(self, model_dir: str, export_dir: str, format: str) -> Dict[str, Any]:
        """Export Marker model"""
        # TODO: Implement Marker model export
        return {'success': False, 'message': "Marker model export not fully implemented"}
    
    def _export_thepipe_model(self, model_dir: str, export_dir: str, format: str) -> Dict[str, Any]:
        """Export thepipe model"""
        try:
            # For thepipe, export the pipeline configuration
            pipeline_path = os.path.join(model_dir, 'pipeline.json')
            if not os.path.exists(pipeline_path):
                pipeline_path = os.path.join(self.engine_model_dir, 'pipeline.json')
            
            if not os.path.exists(pipeline_path):
                return {'success': False, 'message': "No pipeline configuration found"}
            
            # Copy pipeline to export directory
            dst_path = os.path.join(export_dir, 'pipeline.json')
            shutil.copy(pipeline_path, dst_path)
            
            # Create configuration file
            config_path = os.path.join(export_dir, 'engine_config.json')
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump({
                    'engine': 'thepipe',
                    'domain': self.config['domain'],
                    'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
                    'configuration': self.config
                }, f, indent=2)
            
            return {
                'success': True,
                'format': 'default',
                'export_dir': export_dir,
                'files_exported': len(os.listdir(export_dir))
            }
            
        except Exception as e:
            logger.error(f"Error exporting thepipe model: {e}")
            return {'success': False, 'error': str(e)}


def main():
    """Main entry point for command-line usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description="OCR Model Fine-tuner")
    parser.add_argument('--engine', choices=['nougat', 'marker', 'thepipe'], default='nougat',
                       help='OCR engine to fine-tune')
    parser.add_argument('--dataset-dir', help='Path to dataset directory')
    parser.add_argument('--model-dir', help='Path to model directory')
    parser.add_argument('--train', action='store_true', help='Train the model')
    parser.add_argument('--export', action='store_true', help='Export the model after training')
    parser.add_argument('--export-dir', help='Directory to export the model to')
    parser.add_argument('--export-format', choices=['default', 'onnx', 'torchscript'], 
                       default='default', help='Format for model export')
    parser.add_argument('--domain', default='material_datasheets', 
                       help='Domain for fine-tuning (e.g., material_datasheets)')
    parser.add_argument('--data-paths', nargs='+', help='Paths to data files for dataset creation')
    parser.add_argument('--model-type', choices=['base', 'small', 'large'], default='base',
                       help='Model size/type')
    
    args = parser.parse_args()
    
    # Set up configuration
    config = {
        'engine': args.engine,
        'model_dir': args.model_dir,
        'domain': args.domain,
        'model_type': args.model_type
    }
    
    # Create dataset if data paths provided
    if args.data_paths:
        dataset_config = {
            'dataset_dir': args.dataset_dir
        }
        
        dataset = OCRDataset(dataset_config)
        result = dataset.prepare_from_documents(args.data_paths)
        
        print(f"Dataset preparation: {result}")
        
        # Augment data
        dataset.augment_data()
    
    # Train model if requested
    if args.train:
        finetuner = OCRModelFineTuner(config)
        
        if args.data_paths:
            result = finetuner.finetune(dataset)
            print(f"Model fine-tuning: {result}")
        else:
            print("No dataset available for training")
    
    # Export model if requested
    if args.export:
        if not args.train:
            # Initialize finetuner without training
            finetuner = OCRModelFineTuner(config)
        
        result = finetuner.export_model(args.export_dir, args.export_format)
        print(f"Model export: {result}")


if __name__ == "__main__":
    main()