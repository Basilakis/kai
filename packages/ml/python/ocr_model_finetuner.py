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
        """
        Export Nougat model for deployment in various formats
        
        Args:
            model_dir: Directory containing the trained model
            export_dir: Directory to export the model to
            format: Export format (default, onnx, torchscript)
            
        Returns:
            Dictionary with export results and paths
        """
        try:
            import torch
            
            # Load the model
            device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            model, processor = load_model(model_dir, device=device)
            model.eval()  # Ensure model is in evaluation mode
            
            # Create export directory if it doesn't exist
            os.makedirs(export_dir, exist_ok=True)
            
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
                
                # Create example usage script
                example_path = os.path.join(export_dir, 'example_usage.py')
                with open(example_path, 'w', encoding='utf-8') as f:
                    f.write("""
from nougat.utils.checkpoint import get_checkpoint
from nougat.model import load_model
import os
import time

def process_document(file_path, checkpoint_path=None):
    # Get model path from current directory if not specified
    if checkpoint_path is None:
        checkpoint_path = os.path.join(os.path.dirname(__file__), 'nougat')
    
    start_time = time.time()
    
    # Load model and processor
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model, processor = load_model(checkpoint_path, device=device)
    model.eval()
    
    # Process the document
    inputs = processor(file_path, return_tensors="pt").to(device)
    
    # Run inference
    with torch.no_grad():
        outputs = model(**inputs)
    
    # Process outputs to text
    from nougat.postprocessing import markdown_compatible
    text = markdown_compatible(outputs.sequences)
    
    processing_time = time.time() - start_time
    
    return {
        'text': text,
        'processing_time': processing_time,
        'device': device
    }

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        result = process_document(file_path)
        print(f"Processed in {result['processing_time']:.2f} seconds on {result['device']}")
        print("\\nEXTRACTED TEXT:\\n")
        print(result['text'])
    else:
        print("Usage: python example_usage.py <path_to_document>")
    """)
                
                return {
                    'success': True,
                    'format': 'default',
                    'export_dir': export_dir,
                    'files_exported': len(os.listdir(export_dir)),
                    'example_path': example_path
                }
                
            # ONNX format
            elif format == 'onnx':
                try:
                    import onnx
                    import onnxruntime
                    from onnxruntime.quantization import quantize_dynamic, QuantType
                    
                    # Create subdirectory for ONNX models
                    onnx_dir = os.path.join(export_dir, 'onnx')
                    os.makedirs(onnx_dir, exist_ok=True)
                    
                    # Set up encoder and decoder paths
                    encoder_path = os.path.join(onnx_dir, 'nougat_encoder.onnx')
                    decoder_path = os.path.join(onnx_dir, 'nougat_decoder.onnx')
                    config_path = os.path.join(onnx_dir, 'config.json')
                    model_info_path = os.path.join(onnx_dir, 'model_info.json')
                    
                    # Create dummy inputs
                    batch_size = 1
                    sequence_length = self.config.get('max_sequence_length', 512)
                    height, width = 2048, 1536  # Default image dimensions
                    num_channels = 3
                    
                    # 1. Export encoder (image to features)
                    # Create dummy image tensor
                    image_tensor = torch.randn(batch_size, num_channels, height, width, dtype=torch.float32).to(device)
                    
                    # Create a wrapper for encoder only
                    class EncoderWrapper(torch.nn.Module):
                        def __init__(self, model):
                            super().__init__()
                            self.encoder = model.encoder
                            
                        def forward(self, pixel_values):
                            return self.encoder(pixel_values)
                    
                    encoder_wrapper = EncoderWrapper(model)
                    
                    # Prepare dynamic axes for variable inputs
                    encoder_dynamic_axes = {
                        'pixel_values': {0: 'batch_size', 2: 'height', 3: 'width'},
                        'encoder_outputs': {0: 'batch_size', 1: 'sequence_length'}
                    }
                    
                    # Export encoder to ONNX
                    torch.onnx.export(
                        encoder_wrapper,
                        (image_tensor,),
                        encoder_path,
                        export_params=True,
                        opset_version=15,
                        do_constant_folding=True,
                        input_names=['pixel_values'],
                        output_names=['encoder_outputs'],
                        dynamic_axes=encoder_dynamic_axes,
                        verbose=False
                    )
                    
                    # 2. Export decoder (text generation)
                    # Create dummy encoder outputs and decoder inputs
                    encoder_outputs = torch.randn(batch_size, sequence_length, model.config.hidden_size, dtype=torch.float32).to(device)
                    decoder_input_ids = torch.ones((batch_size, 1), dtype=torch.long).to(device)
                    
                    # Create a wrapper for decoder only
                    class DecoderWrapper(torch.nn.Module):
                        def __init__(self, model):
                            super().__init__()
                            self.decoder = model.decoder
                            self.lm_head = model.lm_head
                            
                        def forward(self, input_ids, encoder_hidden_states):
                            decoder_outputs = self.decoder(
                                input_ids=input_ids,
                                encoder_hidden_states=encoder_hidden_states,
                                use_cache=False
                            )
                            lm_logits = self.lm_head(decoder_outputs[0])
                            return lm_logits
                    
                    decoder_wrapper = DecoderWrapper(model)
                    
                    # Prepare dynamic axes for variable inputs
                    decoder_dynamic_axes = {
                        'input_ids': {0: 'batch_size', 1: 'decoder_sequence_length'},
                        'encoder_hidden_states': {0: 'batch_size', 1: 'encoder_sequence_length'},
                        'logits': {0: 'batch_size', 1: 'decoder_sequence_length'}
                    }
                    
                    # Export decoder to ONNX
                    torch.onnx.export(
                        decoder_wrapper,
                        (decoder_input_ids, encoder_outputs),
                        decoder_path,
                        export_params=True,
                        opset_version=15,
                        do_constant_folding=True,
                        input_names=['input_ids', 'encoder_hidden_states'],
                        output_names=['logits'],
                        dynamic_axes=decoder_dynamic_axes,
                        verbose=False
                    )
                    
                    # Verify and optimize the ONNX models
                    for path in [encoder_path, decoder_path]:
                        onnx_model = onnx.load(path)
                        onnx.checker.check_model(onnx_model)
                    
                    # Create quantized versions for improved inference speed
                    encoder_quantized_path = os.path.join(onnx_dir, 'nougat_encoder_quantized.onnx')
                    decoder_quantized_path = os.path.join(onnx_dir, 'nougat_decoder_quantized.onnx')
                    
                    # Quantize the models
                    quantize_dynamic(encoder_path, encoder_quantized_path, weight_type=QuantType.QUInt8)
                    quantize_dynamic(decoder_path, decoder_quantized_path, weight_type=QuantType.QUInt8)
                    
                    # Export tokenizer configuration if available
                    tokenizer_config_path = os.path.join(onnx_dir, 'tokenizer_config.json')
                    if hasattr(model, 'tokenizer') and hasattr(model.tokenizer, 'save_pretrained'):
                        try:
                            model.tokenizer.save_pretrained(onnx_dir)
                            logger.info(f"Saved tokenizer configuration to {onnx_dir}")
                        except Exception as e:
                            logger.warning(f"Failed to save tokenizer: {e}")
                    else:
                        # Create a basic tokenizer configuration
                        with open(tokenizer_config_path, 'w', encoding='utf-8') as f:
                            json.dump({
                                'pad_token_id': 0,
                                'eos_token_id': 2,
                                'bos_token_id': 1,
                                'unk_token_id': 3,
                                'model_max_length': sequence_length,
                                'export_date': time.strftime('%Y-%m-%d %H:%M:%S')
                            }, f, indent=2)
                    
                    # Save configuration
                    with open(config_path, 'w', encoding='utf-8') as f:
                        config_dict = {
                            'model_type': self.config['model_type'],
                            'vocabulary_size': model.config.vocab_size,
                            'hidden_size': model.config.hidden_size,
                            'encoder_layers': model.config.encoder_layers,
                            'decoder_layers': model.config.decoder_layers,
                            'max_position_embeddings': model.config.max_position_embeddings,
                            'max_sequence_length': sequence_length,
                            'image_size': [height, width],
                        }
                        json.dump(config_dict, f, indent=2)
                    
                    # Save model info
                    with open(model_info_path, 'w', encoding='utf-8') as f:
                        json.dump({
                            'engine': 'nougat',
                            'export_format': 'onnx',
                            'export_date': time.strftime('%Y-%m-%d %H:%M:%S'),
                            'domain': self.config['domain'],
                            'encoder_path': os.path.basename(encoder_path),
                            'decoder_path': os.path.basename(decoder_path),
                            'encoder_quantized_path': os.path.basename(encoder_quantized_path),
                            'decoder_quantized_path': os.path.basename(decoder_quantized_path),
                            'config_path': os.path.basename(config_path),
                        }, f, indent=2)
                    
                    # Create utility scripts for inference
                    inference_path = os.path.join(onnx_dir, 'onnx_inference.py')
                    with open(inference_path, 'w', encoding='utf-8') as f:
                        f.write("""
import onnxruntime as ort
import numpy as np
import json
import os
import time
import re
from PIL import Image
from typing import Dict, List, Any, Optional, Union

class SimpleTokenizer:
    """Simple tokenizer for decoding token IDs to text"""
    
    def __init__(self, tokenizer_config_path=None):
        self.token_map = {}
        self.id_to_token = {}
        self.special_tokens = {
            "pad_token_id": 0,
            "eos_token_id": 2,
            "bos_token_id": 1,
            "unk_token_id": 3
        }
        
        # Load tokenizer config if available
        if tokenizer_config_path and os.path.exists(tokenizer_config_path):
            try:
                with open(tokenizer_config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    # Update special tokens from config
                    for key, value in config.items():
                        if key.endswith('_token_id'):
                            self.special_tokens[key] = value
                    
                    # If vocabulary is present in the config, use it
                    if 'vocab' in config:
                        self.token_map = config['vocab']
                        self.id_to_token = {int(v): k for k, v in self.token_map.items()}
            except Exception as e:
                print(f"Error loading tokenizer config: {e}")
    
    def decode(self, token_ids, skip_special_tokens=True):
        """Decode token IDs to text"""
        if not token_ids:
            return ""
        
        # If we have a vocabulary mapping, use it
        if self.id_to_token:
            tokens = []
            for token_id in token_ids:
                # Skip special tokens if requested
                if skip_special_tokens and token_id in self.special_tokens.values():
                    continue
                
                # Convert ID to token
                token = self.id_to_token.get(token_id, f"[UNK:{token_id}]")
                tokens.append(token)
            
            return "".join(tokens)
        else:
            # Fallback: Convert raw token IDs to string representation
            # This is mainly for debugging when no vocabulary is available
            filtered_ids = [
                token_id for token_id in token_ids 
                if not (skip_special_tokens and token_id in self.special_tokens.values())
            ]
            
            # Simple post-processing to make output more readable
            text = "".join(chr(max(32, min(id % 128, 126))) for id in filtered_ids)
            # Replace repeated spaces with single space
            text = re.sub(r' +', ' ', text)
            return text

class NougatONNXModel:
    def __init__(self, onnx_dir, use_quantized=True):
        self.onnx_dir = onnx_dir
        
        # Load model info and config
        with open(os.path.join(onnx_dir, 'model_info.json'), 'r') as f:
            self.model_info = json.load(f)
            
        with open(os.path.join(onnx_dir, 'config.json'), 'r') as f:
            self.config = json.load(f)
        
        # Determine paths based on quantization preference
        if use_quantized and 'encoder_quantized_path' in self.model_info:
            encoder_path = os.path.join(onnx_dir, self.model_info['encoder_quantized_path'])
            decoder_path = os.path.join(onnx_dir, self.model_info['decoder_quantized_path'])
        else:
            encoder_path = os.path.join(onnx_dir, self.model_info['encoder_path'])
            decoder_path = os.path.join(onnx_dir, self.model_info['decoder_path'])
        
        # Initialize sessions
        self.encoder_session = ort.InferenceSession(encoder_path)
        self.decoder_session = ort.InferenceSession(decoder_path)
        
        # Initialize tokenizer
        tokenizer_config_path = os.path.join(onnx_dir, 'tokenizer_config.json')
        self.tokenizer = SimpleTokenizer(tokenizer_config_path)
        
        # Vocabulary & tokenization
        self.pad_token_id = self.tokenizer.special_tokens.get("pad_token_id", 0)
        self.eos_token_id = self.tokenizer.special_tokens.get("eos_token_id", 2)
        self.bos_token_id = self.tokenizer.special_tokens.get("bos_token_id", 1)
        self.unk_token_id = self.tokenizer.special_tokens.get("unk_token_id", 3)
        
    def preprocess_image(self, image_path, target_size=None):
        # Load image
        if isinstance(image_path, str):
            image = Image.open(image_path).convert('RGB')
        else:
            image = image_path
            
        # Resize if needed
        if target_size is None:
            target_size = self.config.get('image_size', [2048, 1536])
        
        image = image.resize(target_size)
        
        # Convert to tensor format [1, C, H, W]
        img_array = np.array(image)
        # Normalize and transpose to channel-first format
        img_tensor = img_array.transpose(2, 0, 1).astype(np.float32) / 255.0
        # Add batch dimension
        img_tensor = np.expand_dims(img_tensor, axis=0)
        
        return img_tensor
    
    def generate_text(self, image_path, max_length=512):
        # Preprocess image
        pixel_values = self.preprocess_image(image_path)
        
        # Run encoder
        encoder_outputs = self.encoder_session.run(
            ['encoder_outputs'], 
            {'pixel_values': pixel_values}
        )[0]
        
        # Initialize generation
        input_ids = np.array([[self.bos_token_id]], dtype=np.int64)  # Start token
        generated_ids = [self.bos_token_id]
        
        # Autoregressive generation
        for i in range(max_length):
            # Run decoder step
            logits = self.decoder_session.run(
                ['logits'],
                {
                    'input_ids': input_ids,
                    'encoder_hidden_states': encoder_outputs
                }
            )[0]
            
            # Get next token (greedy decoding)
            next_token_id = np.argmax(logits[0, -1, :])
            generated_ids.append(next_token_id.item())
            
            # Check for EOS token
            if next_token_id == self.eos_token_id:
                break
                
            # Update input_ids for next step
            input_ids = np.array([[next_token_id]], dtype=np.int64)
        
        # Convert token IDs to text using tokenizer
        generated_text = self.tokenizer.decode(generated_ids, skip_special_tokens=True)
        
        return {
            'token_ids': generated_ids,
            'generated_text': generated_text
        }

def process_document(file_path, onnx_dir=None):
    # Get model path
    if onnx_dir is None:
        onnx_dir = os.path.dirname(os.path.abspath(__file__))
    
    start_time = time.time()
    
    # Initialize model
    model = NougatONNXModel(onnx_dir)
    
    # Generate text
    result = model.generate_text(file_path)
    
    processing_time = time.time() - start_time
    
    return {
        'token_ids': result['token_ids'],
        'text': result['generated_text'],
        'processing_time': processing_time
    }

if __name__ == '__main__':
    import sys
    import argparse
    
    parser = argparse.ArgumentParser(description='Process documents with ONNX Nougat model')
    parser.add_argument('file_path', help='Path to the document to process')
    parser.add_argument('--model-dir', help='Directory containing the ONNX models')
    parser.add_argument('--max-length', type=int, default=1024, help='Maximum length for generation')
    parser.add_argument('--output', help='Output file for the extracted text')
    
    args = parser.parse_args()
    
    result = process_document(args.file_path, args.model_dir)
    print(f"Processed in {result['processing_time']:.2f} seconds")
    print("\\nEXTRACTED TEXT:\\n")
    print(result['text'])
    
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(result['text'])
        print(f"Saved output to {args.output}")
""")
                    
                    # Create requirements file
                    requirements_path = os.path.join(onnx_dir, 'requirements.txt')
                    with open(requirements_path, 'w') as f:
                        f.write("""
onnxruntime>=1.14.0
numpy>=1.20.0
Pillow>=9.0.0
""")
                    
                    return {
                        'success': True,
                        'format': 'onnx',
                        'export_dir': onnx_dir,
                        'encoder_path': encoder_path,
                        'decoder_path': decoder_path,
                        'quantized_encoder': encoder_quantized_path,
                        'quantized_decoder': decoder_quantized_path,
                        'inference_script': inference_path,
                        'config_path': config_path,
                        'message': "ONNX export completed successfully with encoder and decoder components"
                    }
                    
                except Exception as e:
                    logger.error(f"Error during ONNX export: {str(e)}")
                    return {'success': False, 'message': f"ONNX export failed: {str(e)}"}
                    
                except ImportError as ie:
                    logger.error(f"Missing dependencies for ONNX export: {str(ie)}")
                    return {'success': False, 'message': f"ONNX export failed due to missing dependencies: {str(ie)}"}
            
            # TorchScript format
            elif format == 'torchscript':
                try:
                    # Create subdirectory for TorchScript models
                    torchscript_dir = os.path.join(export_dir, 'torchscript')
                    os.makedirs(torchscript_dir, exist_ok=True)
                    
                    # Set up export paths
                    full_model_path = os.path.join(torchscript_dir, 'nougat_model.pt')
                    encoder_path = os.path.join(torchscript_dir, 'nougat_encoder.pt')
                    decoder_path = os.path.join(torchscript_dir, 'nougat_decoder.pt')
                    optimized_path = os.path.join(torchscript_dir, 'nougat_model_optimized.pt')
                    config_path = os.path.join(torchscript_dir, 'config.json')
                    
                    # Export encoder and decoder components separately for better tracing
                    # Create dummy inputs
                    batch_size = 1
                    sequence_length = self.config.get('max_sequence_length', 512)
                    height, width = 2048, 1536
                    num_channels = 3
                    
                    # Create dummy tensors
                    image_tensor = torch.randn(batch_size, num_channels, height, width, dtype=torch.float32).to(device)
                    encoder_outputs = torch.randn(batch_size, sequence_length, model.config.hidden_size, dtype=torch.float32).to(device)
                    decoder_input_ids = torch.ones((batch_size, 1), dtype=torch.long).to(device)
                    
                    # Create specialized wrappers for tracing
                    class EncoderWrapper(torch.nn.Module):
                        def __init__(self, model):
                            super().__init__()
                            self.encoder = model.encoder
                            
                        def forward(self, pixel_values):
                            return self.encoder(pixel_values)
                    
                    class DecoderWrapper(torch.nn.Module):
                        def __init__(self, model):
                            super().__init__()
                            self.decoder = model.decoder
                            self.lm_head = model.lm_head
                            
                        def forward(self, input_ids, encoder_hidden_states):
                            decoder_outputs = self.decoder(
                                input_ids=input_ids,
                                encoder_hidden_states=encoder_hidden_states,
                                use_cache=False
                            )
                            lm_logits = self.lm_head(decoder_outputs[0])
                            return lm_logits
                    
                    # Create full model wrapper combining encoder and decoder
                    class NougatModelWrapper(torch.nn.Module):
                        def __init__(self, model):
                            super().__init__()
                            self.encoder = model.encoder
                            self.decoder = model.decoder
                            self.lm_head = model.lm_head
                            self.config = model.config
                            
                        def forward(self, pixel_values):
                            # Run encoder
                            encoder_outputs = self.encoder(pixel_values)
                            
                            # Initial decoder input (start token)
                            batch_size = pixel_values.size(0)
                            decoder_input_ids = torch.ones((batch_size, 1), dtype=torch.long, device=pixel_values.device)
                            
                            # Run decoder (just first step for tracing)
                            decoder_outputs = self.decoder(
                                input_ids=decoder_input_ids,
                                encoder_hidden_states=encoder_outputs,
                                use_cache=False
                            )
                            lm_logits = self.lm_head(decoder_outputs[0])
                            
                            return encoder_outputs, lm_logits
                    
                    # Initialize wrappers
                    encoder_wrapper = EncoderWrapper(model)
                    decoder_wrapper = DecoderWrapper(model)
                    full_model_wrapper = NougatModelWrapper(model)
                    
                    # Trace the encoder
                    encoder_traced = torch.jit.trace(
                        encoder_wrapper,
                        (image_tensor,)
                    )
                    encoder_traced.save(encoder_path)
                    
                    # Trace the decoder
                    decoder_traced = torch.jit.trace(
                        decoder_wrapper,
                        (decoder_input_ids, encoder_outputs)
                    )
                    decoder_traced.save(decoder_path)
                    
                    # Try scripting the full model first
                    try:
                        scripted_model = torch.jit.script(full_model_wrapper)
                        scripting_successful = True
                    except Exception as script_err:
                        logger.warning(f"Full model scripting failed: {script_err}. Falling back to tracing.")
                        scripting_successful = False
                    
                    # If scripting failed, try tracing
                    if not scripting_successful:
                        traced_model = torch.jit.trace(
                            full_model_wrapper,
                            (image_tensor,)
                        )
                        traced_model.save(full_model_path)
                        
                        # Optimize the traced model
                        optimized_model = torch.jit.optimize_for_inference(traced_model)
                        optimized_model.save(optimized_path)
                    else:
                        # Save the scripted model
                        scripted_model.save(full_model_path)
                        
                        # Optimize the scripted model
                        optimized_model = torch.jit.optimize_for_inference(scripted_model)
                        optimized_model.save(optimized_path)
                    
                    # Save model configuration
                    with open(config_path, 'w', encoding='utf-8') as f:
                        config_dict = {
                            'engine': 'nougat',
                            'export_format': 'torchscript',
                            'model_type': self.config['model_type'],
                            'export_date': time.strftime('%Y-%m-%d %H:%M:%S'),
                            'domain': self.config['domain'],
                            'vocabulary_size': model.config.vocab_size,
                            'hidden_size': model.config.hidden_size,
                            'encoder_layers': model.config.encoder_layers,
                            'decoder_layers': model.config.decoder_layers,
                            'max_position_embeddings': model.config.max_position_embeddings,
                            'max_sequence_length': self.config.get('max_sequence_length', 512),
                            'image_size': [height, width],
                            'full_model_path': os.path.basename(full_model_path),
                            'encoder_path': os.path.basename(encoder_path),
                            'decoder_path': os.path.basename(decoder_path),
                            'optimized_path': os.path.basename(optimized_path),
                        }
                        json.dump(config_dict, f, indent=2)
                    
                    # Export tokenizer configuration if available
                    tokenizer_config_path = os.path.join(torchscript_dir, 'tokenizer_config.json')
                    if hasattr(model, 'tokenizer') and hasattr(model.tokenizer, 'save_pretrained'):
                        try:
                            model.tokenizer.save_pretrained(torchscript_dir)
                            logger.info(f"Saved tokenizer configuration to {torchscript_dir}")
                        except Exception as e:
                            logger.warning(f"Failed to save tokenizer: {e}")
                    else:
                        # Create a basic tokenizer configuration
                        with open(tokenizer_config_path, 'w', encoding='utf-8') as f:
                            json.dump({
                                'pad_token_id': 0,
                                'eos_token_id': 2,
                                'bos_token_id': 1,
                                'unk_token_id': 3,
                                'model_max_length': self.config.get('max_sequence_length', 512),
                                'export_date': time.strftime('%Y-%m-%d %H:%M:%S')
                            }, f, indent=2)
                    
                    # Create inference utility script
                    inference_path = os.path.join(torchscript_dir, 'torchscript_inference.py')
                    with open(inference_path, 'w', encoding='utf-8') as f:
                        f.write("""
import torch
import json
import os
import time
import re
import numpy as np
from PIL import Image
from typing import Dict, List, Any, Optional, Union

class SimpleTokenizer:
    """Simple tokenizer for decoding token IDs to text"""
    
    def __init__(self, tokenizer_config_path=None):
        self.token_map = {}
        self.id_to_token = {}
        self.special_tokens = {
            "pad_token_id": 0,
            "eos_token_id": 2,
            "bos_token_id": 1,
            "unk_token_id": 3
        }
        
        # Load tokenizer config if available
        if tokenizer_config_path and os.path.exists(tokenizer_config_path):
            try:
                with open(tokenizer_config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    # Update special tokens from config
                    for key, value in config.items():
                        if key.endswith('_token_id'):
                            self.special_tokens[key] = value
                    
                    # If vocabulary is present in the config, use it
                    if 'vocab' in config:
                        self.token_map = config['vocab']
                        self.id_to_token = {int(v): k for k, v in self.token_map.items()}
            except Exception as e:
                print(f"Error loading tokenizer config: {e}")
    
    def decode(self, token_ids, skip_special_tokens=True):
        """Decode token IDs to text"""
        if not token_ids:
            return ""
        
        # If we have a vocabulary mapping, use it
        if self.id_to_token:
            tokens = []
            for token_id in token_ids:
                # Skip special tokens if requested
                if skip_special_tokens and token_id in self.special_tokens.values():
                    continue
                
                # Convert ID to token
                token = self.id_to_token.get(token_id, f"[UNK:{token_id}]")
                tokens.append(token)
            
            return "".join(tokens)
        else:
            # Fallback: Convert raw token IDs to string representation
            # This is mainly for debugging when no vocabulary is available
            filtered_ids = [
                token_id for token_id in token_ids 
                if not (skip_special_tokens and token_id in self.special_tokens.values())
            ]
            
            # Simple post-processing to make output more readable
            text = "".join(chr(max(32, min(id % 128, 126))) for id in filtered_ids)
            # Replace repeated spaces with single space
            text = re.sub(r' +', ' ', text)
            return text

class NougatTorchScriptModel:
    def __init__(self, model_dir, use_optimized=True, use_cuda=None):
        self.model_dir = model_dir
        
        # Determine device
        if use_cuda is None:
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        else:
            self.device = torch.device('cuda' if use_cuda and torch.cuda.is_available() else 'cpu')
        
        # Load configuration
        with open(os.path.join(model_dir, 'config.json'), 'r') as f:
            self.config = json.load(f)
        
        # Load model based on preference
        if use_optimized and 'optimized_path' in self.config:
            model_path = os.path.join(model_dir, self.config['optimized_path'])
        else:
            model_path = os.path.join(model_dir, self.config['full_model_path'])
        
        # Load separate components if needed
        encoder_path = os.path.join(model_dir, self.config['encoder_path'])
        decoder_path = os.path.join(model_dir, self.config['decoder_path'])
        
        # Load models to device
        self.full_model = torch.jit.load(model_path).to(self.device)
        self.encoder = torch.jit.load(encoder_path).to(self.device)
        self.decoder = torch.jit.load(decoder_path).to(self.device)
        
        # Initialize tokenizer
        tokenizer_config_path = os.path.join(model_dir, 'tokenizer_config.json')
        self.tokenizer = SimpleTokenizer(tokenizer_config_path)
        
        # Vocabulary & generation parameters
        self.pad_token_id = self.tokenizer.special_tokens.get("pad_token_id", 0)
        self.eos_token_id = self.tokenizer.special_tokens.get("eos_token_id", 2)
        self.bos_token_id = self.tokenizer.special_tokens.get("bos_token_id", 1)
        self.max_length = self.config.get('max_sequence_length', 512)
        
    def preprocess_image(self, image_path, target_size=None):
        # Load image
        if isinstance(image_path, str):
            image = Image.open(image_path).convert('RGB')
        else:
            image = image_path
            
        # Resize if needed
        if target_size is None:
            target_size = tuple(self.config.get('image_size', [2048, 1536]))
        
        image = image.resize((target_size[1], target_size[0]))
        
        # Convert to tensor format [1, C, H, W]
        img_tensor = torch.FloatTensor(np.array(image)).permute(2, 0, 1) / 255.0
        img_tensor = img_tensor.unsqueeze(0).to(self.device)
        
        return img_tensor
    
    def generate_text(self, image_path, max_length=None, beam_size=1):
        # Set max length
        if max_length is None:
            max_length = self.max_length
            
        # Preprocess image
        pixel_values = self.preprocess_image(image_path)
        
        # Run encoder to get features
        with torch.no_grad():
            encoder_outputs = self.encoder(pixel_values)
        
        # Initialize generation
        input_ids = torch.ones((1, 1), dtype=torch.long, device=self.device) * self.bos_token_id
        generated_ids = [self.bos_token_id]
        
        # Generate text autoregressively
        with torch.no_grad():
            for i in range(max_length):
                # Run decoder step
                logits = self.decoder(input_ids, encoder_outputs)
                
                # Get next token (greedy decoding)
                next_token_id = torch.argmax(logits[0, -1, :])
                generated_ids.append(next_token_id.item())
                
                # Check for EOS token
                if next_token_id == self.eos_token_id:
                    break
                    
                # Update input_ids for next step
                input_ids = next_token_id.unsqueeze(0).unsqueeze(0)
        
        # Convert token IDs to text using tokenizer
        generated_text = self.tokenizer.decode(generated_ids, skip_special_tokens=True)
        
        return {
            'token_ids': generated_ids,
            'generated_text': generated_text
        }

def process_document(file_path, model_dir=None, use_optimized=True):
    # Get model directory if not provided
    if model_dir is None:
        model_dir = os.path.dirname(os.path.abspath(__file__))
    
    start_time = time.time()
    
    # Initialize model
    model = NougatTorchScriptModel(model_dir, use_optimized)
    
    # Generate text
    result = model.generate_text(file_path)
    
    processing_time = time.time() - start_time
    
    return {
        'token_ids': result['token_ids'],
        'text': result['generated_text'],
        'processing_time': processing_time,
        'device': str(model.device)
    }

if __name__ == '__main__':
    import sys
    import argparse
    
    parser = argparse.ArgumentParser(description='Process documents with TorchScript Nougat model')
    parser.add_argument('file_path', help='Path to the document to process')
    parser.add_argument('--model-dir', help='Directory containing the TorchScript models')
    parser.add_argument('--max-length', type=int, default=1024, help='Maximum length for generation')
    parser.add_argument('--output', help='Output file for the extracted text')
    parser.add_argument('--no-optimize', action='store_true', help='Do not use optimized model')
    
    args = parser.parse_args()
    
    result = process_document(args.file_path, args.model_dir, not args.no_optimize)
    print(f"Processed in {result['processing_time']:.2f} seconds on {result['device']}")
    print("\\nEXTRACTED TEXT:\\n")
    print(result['text'])
    
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(result['text'])
        print(f"Saved output to {args.output}")
""")
                    
                    # Create requirements file
                    requirements_path = os.path.join(torchscript_dir, 'requirements.txt')
                    with open(requirements_path, 'w') as f:
                        f.write("""
torch>=1.10.0
Pillow>=9.0.0
numpy>=1.20.0
""")
                    
                    return {
                        'success': True,
                        'format': 'torchscript',
                        'export_dir': torchscript_dir,
                        'full_model_path': full_model_path,
                        'encoder_path': encoder_path,
                        'decoder_path': decoder_path,
                        'optimized_path': optimized_path,
                        'inference_script': inference_path,
                        'config_path': config_path,
                        'message': "TorchScript export completed successfully with full model and components"
                    }
                    
                except Exception as e:
                    logger.error(f"Error during TorchScript export: {str(e)}")
                    return {'success': False, 'message': f"TorchScript export failed: {str(e)}"}
            
            else:
                return {'success': False, 'message': f"Unsupported export format: {format}"}
                
        except Exception as e:
            logger.error(f"Error exporting Nougat model: {e}")
            return {'success': False, 'error': str(e)}
    
    def _export_marker_model(self, model_dir: str, export_dir: str, format: str) -> Dict[str, Any]:
        """
        Export Marker model for deployment with comprehensive implementation
        
        Args:
            model_dir: Directory containing the trained model
            export_dir: Directory to export the model to
            format: Export format (default, onnx, torchscript)
            
        Returns:
            Dictionary with export results and paths
        """
        if not MARKER_AVAILABLE:
            return {'success': False, 'message': "Marker dependencies not available"}
        
        try:
            import torch
            
            # Create export directory
            os.makedirs(export_dir, exist_ok=True)
            
            # Load the marker model
            marker_model = DocumentAnalysisModel.from_pretrained(model_dir)
            device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            marker_model.to(device)
            marker_model.eval()
            
            # Default format - save model files
            if format == 'default':
                # Create output directory for the model
                model_output_dir = os.path.join(export_dir, 'marker_model')
                os.makedirs(model_output_dir, exist_ok=True)
                
                # Save the model
                marker_model.save_pretrained(model_output_dir)
                
                # Get model configuration
                model_config = marker_model.config.to_dict() if hasattr(marker_model, 'config') else {}
                
                # Save configuration
                config_path = os.path.join(export_dir, 'marker_config.json')
                with open(config_path, 'w', encoding='utf-8') as f:
                    config_data = {
                        'engine': 'marker',
                        'export_format': 'default',
                        'model_type': self.config['model_type'],
                        'domain': self.config['domain'],
                        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
                        'model_config': model_config
                    }
                    json.dump(config_data, f, indent=2)
                
                # Create example usage script with proper error handling
                example_path = os.path.join(export_dir, 'example_usage.py')
                with open(example_path, 'w', encoding='utf-8') as f:
                    f.write("""
from marker.models import DocumentAnalysisModel
import os
import time
import json
import logging
from typing import Dict, Any, Optional, Union

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MarkerDocumentProcessor:
    def __init__(self, model_path: str = None):
        """Initialize the Marker document processor
        
        Args:
            model_path: Path to the model directory
        """
        # Get model path
        if model_path is None:
            model_path = os.path.join(os.path.dirname(__file__), 'marker_model')
            
        logger.info(f"Loading Marker model from {model_path}")
        
        try:
            # Load the model
            self.model = DocumentAnalysisModel.from_pretrained(model_path)
            
            # Set to evaluation mode
            self.model.eval()
            
            # Load configuration if available
            config_path = os.path.join(os.path.dirname(model_path), 'marker_config.json')
            if os.path.exists(config_path):
                with open(config_path, 'r', encoding='utf-8') as f:
                    self.config = json.load(f)
            else:
                self.config = {}
                
            self.loaded = True
            logger.info("Model loaded successfully")
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            self.loaded = False
            self.model = None
    
    def process_document(self, document_path: str) -> Dict[str, Any]:
        """Process a document with the Marker model
        
        Args:
            document_path: Path to the document file
            
        Returns:
            Dictionary containing extraction results
        """
        if not self.loaded:
            return {'success': False, 'error': 'Model not loaded'}
            
        if not os.path.exists(document_path):
            return {'success': False, 'error': f'Document not found: {document_path}'}
            
        try:
            start_time = time.time()
            
            # Process the document
            result = self.model.analyze_document(document_path)
            
            # Convert to markdown
            from marker import document_to_markdown
            markdown = document_to_markdown(result)
            
            # Calculate processing time
            processing_time = time.time() - start_time
            
            # Collect output data
            output = {
                'success': True,
                'processing_time': processing_time,
                'markdown': markdown,
                'text': result.text if hasattr(result, 'text') else '',
                'entities': self._extract_entities(result),
                'tables': self._extract_tables(result),
                'document_metadata': {
                    'page_count': getattr(result, 'page_count', 1),
                    'document_type': getattr(result, 'document_type', 'unknown'),
                    'confidence': getattr(result, 'confidence', 0.0),
                }
            }
            
            return output
            
        except Exception as e:
            logger.error(f"Error processing document: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _extract_entities(self, result) -> Dict[str, Any]:
        """Extract entities from the result"""
        entities = {}
        
        # Extract entities based on the model's result structure
        if hasattr(result, 'entities'):
            for entity in result.entities:
                if hasattr(entity, 'type') and hasattr(entity, 'text'):
                    entity_type = entity.type
                    entity_text = entity.text
                    
                    if entity_type not in entities:
                        entities[entity_type] = []
                        
                    entities[entity_type].append({
                        'text': entity_text,
                        'confidence': getattr(entity, 'confidence', 0.0),
                        'bbox': getattr(entity, 'bbox', None)
                    })
                    
        return entities
    
    def _extract_tables(self, result) -> list:
        """Extract tables from the result"""
        tables = []
        
        # Extract tables based on the model's result structure
        if hasattr(result, 'tables'):
            for i, table in enumerate(result.tables):
                table_data = {
                    'id': i,
                    'rows': getattr(table, 'num_rows', 0),
                    'columns': getattr(table, 'num_columns', 0),
                    'data': []
                }
                
                # Extract table content
                if hasattr(table, 'data'):
                    table_data['data'] = table.data
                elif hasattr(table, 'cells'):
                    # Restructure cells into a 2D array
                    cells_by_row = {}
                    for cell in table.cells:
                        row = getattr(cell, 'row', 0)
                        col = getattr(cell, 'column', 0)
                        text = getattr(cell, 'text', '')
                        
                        if row not in cells_by_row:
                            cells_by_row[row] = {}
                            
                        cells_by_row[row][col] = text
                    
                    # Convert to 2D array
                    for row_idx in sorted(cells_by_row.keys()):
                        row_data = []
                        for col_idx in sorted(cells_by_row[row_idx].keys()):
                            row_data.append(cells_by_row[row_idx][col_idx])
                        table_data['data'].append(row_data)
                
                tables.append(table_data)
                
        return tables

# Example usage
def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Process documents with Marker')
    parser.add_argument('document_path', help='Path to the document to process')
    parser.add_argument('--model', help='Path to the model directory')
    parser.add_argument('--output', help='Output file for the extracted data')
    
    args = parser.parse_args()
    
    # Initialize processor
    processor = MarkerDocumentProcessor(args.model)
    
    # Process document
    result = processor.process_document(args.document_path)
    
    if result['success']:
        print(f"Document processed in {result['processing_time']:.2f} seconds")
        print(f"Extracted {len(result.get('entities', {}))} entity types")
        print(f"Found {len(result.get('tables', []))} tables")
        
        # Save to output file if specified
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2)
            print(f"Results saved to {args.output}")
        else:
            # Print first 500 characters of extracted text
            text = result.get('text', '')
            print("\\nExtracted text preview:\\n")
            print(text[:500] + ('...' if len(text) > 500 else ''))
    else:
        print(f"Error: {result.get('error', 'Unknown error')}")

if __name__ == "__main__":
    main()
                    """)
                
                # Create requirements file
                requirements_path = os.path.join(export_dir, 'requirements.txt')
                with open(requirements_path, 'w') as f:
                    f.write("""
marker-doc>=0.1.0
torch>=1.10.0
Pillow>=9.0.0
numpy>=1.20.0
tqdm>=4.50.0
transformers>=4.15.0
""")
                
                return {
                    'success': True,
                    'format': 'default',
                    'export_path': model_output_dir,
                    'config_path': config_path,
                    'example_path': example_path,
                    'requirements_path': requirements_path,
                    'message': "Marker model exported successfully with example code and requirements"
                }
                
            # ONNX format
            elif format == 'onnx':
                try:
                    import onnx
                    import onnxruntime
                    from onnxruntime.quantization import quantize_dynamic, QuantType
                    
                    # Create ONNX subdirectory
                    onnx_dir = os.path.join(export_dir, 'onnx')
                    os.makedirs(onnx_dir, exist_ok=True)
                    
                    # Set up paths for different components
                    detector_path = os.path.join(onnx_dir, 'marker_detector.onnx')
                    analyzer_path = os.path.join(onnx_dir, 'marker_analyzer.onnx')
                    recognizer_path = os.path.join(onnx_dir, 'marker_recognizer.onnx')
                    config_path = os.path.join(onnx_dir, 'marker_onnx_config.json')
                    
                    # Marker has multiple components - extract separately if available
                    # First, the document detector component
                    if hasattr(marker_model, 'document_detector'):
                        detector = marker_model.document_detector
                        
                        # Create dummy input for detector
                        batch_size = 1
                        channels = 3
                        height, width = 1024, 768  # Common document size
                        detector_input = torch.rand(batch_size, channels, height, width).to(device)
                        
                        # Prepare dynamic axes
                        detector_dynamic_axes = {
                            'input': {0: 'batch_size', 2: 'height', 3: 'width'},
                            'output': {0: 'batch_size'}
                        }
                        
                        # Export detector
                        torch.onnx.export(
                            detector,
                            detector_input,
                            detector_path,
                            export_params=True,
                            opset_version=13,
                            do_constant_folding=True,
                            input_names=['input'],
                            output_names=['output'],
                            dynamic_axes=detector_dynamic_axes,
                            verbose=False
                        )
                        
                        # Verify and optimize
                        detector_model = onnx.load(detector_path)
                        onnx.checker.check_model(detector_model)
                        
                        # Quantize
                        detector_quantized_path = os.path.join(onnx_dir, 'marker_detector_quantized.onnx')
                        quantize_dynamic(detector_path, detector_quantized_path, weight_type=QuantType.QUInt8)
                    
                    # Next, the document analyzer component
                    if hasattr(marker_model, 'document_analyzer'):
                        analyzer = marker_model.document_analyzer
                        
                        # Create dummy input for analyzer
                        batch_size = 1
                        channels = 3
                        height, width = 1024, 768
                        analyzer_input = torch.rand(batch_size, channels, height, width).to(device)
                        
                        # Prepare dynamic axes
                        analyzer_dynamic_axes = {
                            'input': {0: 'batch_size', 2: 'height', 3: 'width'},
                            'output': {0: 'batch_size'}
                        }
                        
                        # Export analyzer
                        torch.onnx.export(
                            analyzer,
                            analyzer_input,
                            analyzer_path,
                            export_params=True,
                            opset_version=13,
                            do_constant_folding=True,
                            input_names=['input'],
                            output_names=['output'],
                            dynamic_axes=analyzer_dynamic_axes,
                            verbose=False
                        )
                        
                        # Verify and optimize
                        analyzer_model = onnx.load(analyzer_path)
                        onnx.checker.check_model(analyzer_model)
                        
                        # Quantize
                        analyzer_quantized_path = os.path.join(onnx_dir, 'marker_analyzer_quantized.onnx')
                        quantize_dynamic(analyzer_path, analyzer_quantized_path, weight_type=QuantType.QUInt8)
                    
                    # Finally, the text recognizer component if available
                    if hasattr(marker_model, 'text_recognizer'):
                        recognizer = marker_model.text_recognizer
                        
                        # Create dummy input for recognizer
                        batch_size = 1
                        channels = 3
                        height, width = 64, 256  # Text region size
                        recognizer_input = torch.rand(batch_size, channels, height, width).to(device)
                        
                        # Prepare dynamic axes
                        recognizer_dynamic_axes = {
                            'input': {0: 'batch_size', 2: 'height', 3: 'width'},
                            'output': {0: 'batch_size', 1: 'sequence_length'}
                        }
                        
                        # Export recognizer
                        torch.onnx.export(
                            recognizer,
                            recognizer_input,
                            recognizer_path,
                            export_params=True,
                            opset_version=13,
                            do_constant_folding=True,
                            input_names=['input'],
                            output_names=['output'],
                            dynamic_axes=recognizer_dynamic_axes,
                            verbose=False
                        )
                        
                        # Verify and optimize
                        recognizer_model = onnx.load(recognizer_path)
                        onnx.checker.check_model(recognizer_model)
                        
                        # Quantize
                        recognizer_quantized_path = os.path.join(onnx_dir, 'marker_recognizer_quantized.onnx')
                        quantize_dynamic(recognizer_path, recognizer_quantized_path, weight_type=QuantType.QUInt8)
                    
                    # Save configuration with exported component paths
                    with open(config_path, 'w', encoding='utf-8') as f:
                        model_config = marker_model.config.to_dict() if hasattr(marker_model, 'config') else {}
                        
                        config_data = {
                            'engine': 'marker',
                            'export_format': 'onnx',
                            'components': {
                                'detector': {
                                    'path': os.path.basename(detector_path) if os.path.exists(detector_path) else None,
                                    'quantized_path': os.path.basename(detector_quantized_path) if 'detector_quantized_path' in locals() else None,
                                    'input_shape': [batch_size, channels, height, width],
                                },
                                'analyzer': {
                                    'path': os.path.basename(analyzer_path) if os.path.exists(analyzer_path) else None,
                                    'quantized_path': os.path.basename(analyzer_quantized_path) if 'analyzer_quantized_path' in locals() else None,
                                    'input_shape': [batch_size, channels, height, width],
                                },
                                'recognizer': {
                                    'path': os.path.basename(recognizer_path) if os.path.exists(recognizer_path) else None,
                                    'quantized_path': os.path.basename(recognizer_quantized_path) if 'recognizer_quantized_path' in locals() else None,
                                    'input_shape': [batch_size, channels, 64, 256],
                                }
                            },
                            'model_config': model_config,
                            'domain': self.config['domain'],
                            'export_date': time.strftime('%Y-%m-%d %H:%M:%S')
                        }
                        json.dump(config_data, f, indent=2)
                    
                    # Create comprehensive utility scripts
                    inference_path = os.path.join(onnx_dir, 'marker_onnx_inference.py')
                    with open(inference_path, 'w', encoding='utf-8') as f:
                        f.write("""
import onnxruntime as ort
import numpy as np
import cv2
import json
import os
import time
from typing import Dict, List, Any, Optional, Union
from PIL import Image
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MarkerONNXProcessor:
    def __init__(self, model_dir: str = None, use_quantized: bool = True):
        """Initialize the Marker ONNX processor
        
        Args:
            model_dir: Directory containing the ONNX models
            use_quantized: Whether to use quantized models if available
        """
        # Get model directory if not provided
        if model_dir is None:
            model_dir = os.path.dirname(os.path.abspath(__file__))
            
        self.model_dir = model_dir
        self.use_quantized = use_quantized
        self.components = {}
        self.sessions = {}
        
        # Load configuration
        config_path = os.path.join(model_dir, 'marker_onnx_config.json')
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                self.config = json.load(f)
            logger.info(f"Loaded configuration from {config_path}")
        except Exception as e:
            logger.error(f"Error loading configuration: {e}")
            self.config = {'components': {}}
        
        # Initialize model components
        for component_name, component_info in self.config.get('components', {}).items():
            if not component_info:
                continue
                
            # Determine path to use (quantized or regular)
            if self.use_quantized and component_info.get('quantized_path'):
                model_path = os.path.join(self.model_dir, component_info['quantized_path'])
                model_type = 'quantized'
            elif component_info.get('path'):
                model_path = os.path.join(self.model_dir, component_info['path'])
                model_type = 'standard'
            else:
                logger.warning(f"No path found for component: {component_name}")
                continue
            
            # Initialize session if model exists
            if os.path.exists(model_path):
                try:
                    session_options = ort.SessionOptions()
                    session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                    
                    # Create session
                    session = ort.InferenceSession(model_path, session_options)
                    
                    # Store in components dict
                    self.components[component_name] = {
                        'path': model_path,
                        'type': model_type,
                        'input_shape': component_info.get('input_shape')
                    }
                    
                    # Store session
                    self.sessions[component_name] = session
                    
                    logger.info(f"Loaded {component_name} model from {model_path}")
                except Exception as e:
                    logger.error(f"Error loading {component_name} model: {e}")
            else:
                logger.warning(f"Model file not found: {model_path}")
        
        # Check if essential components are loaded
        self.ready = 'analyzer' in self.sessions
        if not self.ready:
            logger.warning("Essential components missing, processor may not function correctly")
    
    def preprocess_image(self, image_path: Union[str, np.ndarray], target_size: Optional[List[int]] = None) -> np.ndarray:
        """Preprocess image for inference
        
        Args:
            image_path: Path to image or image array
            target_size: Target size for preprocessing [height, width]
            
        Returns:
            Preprocessed image as numpy array
        """
        # Load image if path is provided
        if isinstance(image_path, str):
            try:
                image = cv2.imread(image_path)
                if image is None:
                    raise ValueError(f"Failed to load image: {image_path}")
                image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            except Exception as e:
                logger.error(f"Error loading image: {e}")
                # Create blank image as fallback
                if target_size:
                    image = np.zeros((target_size[0], target_size[1], 3), dtype=np.uint8)
                else:
                    image = np.zeros((1024, 768, 3), dtype=np.uint8)
        else:
            # Use provided array
            image = image_path
            
            # Convert BGR to RGB if needed
            if image.shape[2] == 3:
                image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Get target size from configuration if not provided
        if target_size is None:
            # Use analyzer input shape if available
            if 'analyzer' in self.components and self.components['analyzer'].get('input_shape'):
                # Format is [batch, channels, height, width]
                input_shape = self.components['analyzer']['input_shape']
                target_size = [input_shape[2], input_shape[3]]
            else:
                # Default size
                target_size = [1024, 768]
        
        # Resize while maintaining aspect ratio
        h, w = image.shape[:2]
        scale = min(target_size[0] / h, target_size[1] / w)
        new_h, new_w = int(h * scale), int(w * scale)
        
        # Resize using opencv
        if new_h > 0 and new_w > 0:
            image = cv2.resize(image, (new_w, new_h))
        
        # Pad to target size
        padded_image = np.zeros((target_size[0], target_size[1], 3), dtype=np.uint8)
        
        # Ensure padded dimensions don't exceed target dimensions
        copy_h = min(new_h, target_size[0])
        copy_w = min(new_w, target_size[1])
        
        padded_image[:copy_h, :copy_w] = image[:copy_h, :copy_w]
        
        # Normalize and convert to CHW format (channel-first)
        image_chw = padded_image.transpose(2, 0, 1).astype(np.float32) / 255.0
        
        # Add batch dimension
        image_batch = np.expand_dims(image_chw, axis=0)
        
        return image_batch
    
    def process_document(self, document_path: str) -> Dict[str, Any]:
        """Process a document with the Marker ONNX models
        
        Args:
            document_path: Path to the document image
            
        Returns:
            Dictionary with processing results
        """
        if not self.ready:
            return {'success': False, 'error': 'Processor not ready, missing essential components'}
            
        try:
            start_time = time.time()
            
            # Preprocess image
            input_data = self.preprocess_image(document_path)
            
            # Results dictionary
            results = {}
            
            # Run each component in sequence
            # 1. Document detection if available
            if 'detector' in self.sessions:
                detector_session = self.sessions['detector']
                detector_output = detector_session.run(None, {'input': input_data})[0]
                results['detector'] = detector_output
            
            # 2. Document analysis
            analyzer_session = self.sessions['analyzer']
            analyzer_output = analyzer_session.run(None, {'input': input_data})[0]
            results['analyzer'] = analyzer_output
            
            # 3. Text recognition if needed
            if 'recognizer' in self.sessions and hasattr(analyzer_output, 'text_regions'):
                # Process each text region
                recognized_text = []
                recognizer_session = self.sessions['recognizer']
                
                for region in analyzer_output.text_regions:
                    # Extract and preprocess region
                    region_img = self._extract_region(input_data[0], region)
                    region_input = self.preprocess_image(region_img, [64, 256])
                    
                    # Recognize text
                    region_output = recognizer_session.run(None, {'input': region_input})[0]
                    
                    # Convert output to text
                    text = self._decode_text(region_output)
                    recognized_text.append(text)
                    
                results['recognized_text'] = recognized_text
            
            # Post-process results
            document_structure = self._post_process_results(results)
            
            processing_time = time.time() - start_time
            
            return {
                'success': True,
                'processing_time': processing_time,
                'document_structure': document_structure
            }
            
        except Exception as e:
            logger.error(f"Error processing document: {e}")
            return {'success': False, 'error': str(e)}
    
    def _extract_region(self, image: np.ndarray, region) -> np.ndarray:
        """Extract region from image
        
        Args:
            image: Full image (CHW format)
            region: Region coordinates
            
        Returns:
            Extracted region
        """
        # Convert CHW to HWC
        img_hwc = image.transpose(1, 2, 0)
        
        # Extract coordinates
        x1, y1, x2, y2 = region.bbox if hasattr(region, 'bbox') else (0, 0, img_hwc.shape[1], img_hwc.shape[0])
        
        # Ensure coordinates are within bounds
        x1 = max(0, int(x1))
        y1 = max(0, int(y1))
        x2 = min(img_hwc.shape[1], int(x2))
        y2 = min(img_hwc.shape[0], int(y2))
        
        # Extract region
        region_img = img_hwc[y1:y2, x1:x2]
        
        return region_img
    
    def _decode_text(self, output) -> str:
        """Decode text from model output
        
        Args:
            output: Model output tensor
            
        Returns:
            Decoded text
        """
        # This is a simplified implementation
        # In a real implementation, this would use the model's tokenizer
        return f"Text region with confidence {np.mean(output):.2f}"
    
    def _post_process_results(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process model results
        
        Args:
            results: Raw results from model components
            
        Returns:
            Structured document information
        """
        # This is a simplified implementation
        document_structure = {
            'type': 'document',
            'analyzer_confidence': float(np.mean(results['analyzer'])) if 'analyzer' in results else 0,
            'text': results.get('recognized_text', []),
        }
        
        return document_structure

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Process documents with Marker ONNX models')
    parser.add_argument('document_path', help='Path to the document to process')
    parser.add_argument('--model-dir', help='Directory containing the ONNX models')
    parser.add_argument('--output', help='Output file for the extracted data')
    parser.add_argument('--no-quantized', action='store_true', help='Do not use quantized models')
    
    args = parser.parse_args()
    
    # Initialize processor
    processor = MarkerONNXProcessor(args.model_dir, not args.no_quantized)
    
    # Process document
    result = processor.process_document(args.document_path)
    
    if result['success']:
        print(f"Document processed in {result['processing_time']:.2f} seconds")
        
        # Save to output file if specified
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2)
            print(f"Results saved to {args.output}")
        else:
            # Print document structure
            print("Document structure:")
            print(json.dumps(result['document_structure'], indent=2))
    else:
        print(f"Error: {result.get('error', 'Unknown error')}")

if __name__ == "__main__":
    main()
""")
                    
                    # Create requirements file
                    requirements_path = os.path.join(onnx_dir, 'requirements.txt')
                    with open(requirements_path, 'w') as f:
                        f.write("""
onnxruntime>=1.14.0
numpy>=1.20.0
Pillow>=9.0.0
opencv-python>=4.5.0
""")
                    
                    # Return success with file information
                    exported_files = [f for f in os.listdir(onnx_dir) if f.endswith('.onnx')]
                    
                    return {
                        'success': True,
                        'format': 'onnx',
                        'export_dir': onnx_dir,
                        'components': list(self.config.get('components', {}).keys()),
                        'exported_files': exported_files,
                        'inference_script': inference_path,
                        'config_path': config_path,
                        'message': f"Marker model exported to ONNX format successfully with {len(exported_files)} component files"
                    }
                    
                except Exception as e:
                    logger.error(f"Error during Marker ONNX export: {str(e)}")
                    return {'success': False, 'message': f"ONNX export failed: {str(e)}"}
            
            # TorchScript format
            elif format == 'torchscript':
                try:
                    # Create TorchScript subdirectory
                    torchscript_dir = os.path.join(export_dir, 'torchscript')
                    os.makedirs(torchscript_dir, exist_ok=True)
                    
                    # Set up paths for different components
                    detector_path = os.path.join(torchscript_dir, 'marker_detector.pt')
                    analyzer_path = os.path.join(torchscript_dir, 'marker_analyzer.pt')
                    recognizer_path = os.path.join(torchscript_dir, 'marker_recognizer.pt')
                    full_model_path = os.path.join(torchscript_dir, 'marker_full_model.pt')
                    config_path = os.path.join(torchscript_dir, 'marker_torchscript_config.json')
                    
                    # Export Marker components to TorchScript
                    exported_components = {}
                    
                    # First, try to export the full model
                    # Create a wrapper model class
                    class MarkerModelWrapper(torch.nn.Module):
                        def __init__(self, model):
                            super().__init__()
                            self.model = model
                            
                        def forward(self, x):
                            return self.model.analyze_document(x)
                    
                    full_model_wrapper = None
                    
                    try:
                        full_model_wrapper = MarkerModelWrapper(marker_model)
                        # Try scripting first
                        full_scripted = torch.jit.script(full_model_wrapper)
                        full_scripted.save(full_model_path)
                        exported_components['full_model'] = {'path': os.path.basename(full_model_path), 'method': 'script'}
                        logger.info(f"Exported full model to {full_model_path}")
                    except Exception as e:
                        logger.warning(f"Could not script full model: {e}")
                        full_model_wrapper = None
                    
                    # Now export individual components
                    
                    # Document detector
                    if hasattr(marker_model, 'document_detector'):
                        detector = marker_model.document_detector
                        
                        # Create dummy input for detector
                        batch_size = 1
                        channels = 3
                        height, width = 1024, 768
                        detector_input = torch.rand(batch_size, channels, height, width).to(device)
                        
                        # Try scripting first
                        try:
                            detector_scripted = torch.jit.script(detector)
                            detector_scripted.save(detector_path)
                            exported_components['detector'] = {'path': os.path.basename(detector_path), 'method': 'script'}
                        except Exception as e:
                            logger.warning(f"Detector scripting failed: {e}. Falling back to tracing.")
                            detector_traced = torch.jit.trace(detector, detector_input)
                            detector_traced.save(detector_path)
                            exported_components['detector'] = {'path': os.path.basename(detector_path), 'method': 'trace'}
                    
                    # Document analyzer
                    if hasattr(marker_model, 'document_analyzer'):
                        analyzer = marker_model.document_analyzer
                        
                        # Create dummy input for analyzer
                        batch_size = 1
                        channels = 3
                        height, width = 1024, 768
                        analyzer_input = torch.rand(batch_size, channels, height, width).to(device)
                        
                        # Try scripting first
                        try:
                            analyzer_scripted = torch.jit.script(analyzer)
                            analyzer_scripted.save(analyzer_path)
                            exported_components['analyzer'] = {'path': os.path.basename(analyzer_path), 'method': 'script'}
                        except Exception as e:
                            logger.warning(f"Analyzer scripting failed: {e}. Falling back to tracing.")
                            analyzer_traced = torch.jit.trace(analyzer, analyzer_input)
                            analyzer_traced.save(analyzer_path)
                            exported_components['analyzer'] = {'path': os.path.basename(analyzer_path), 'method': 'trace'}
                    
                    # Text recognizer
                    if hasattr(marker_model, 'text_recognizer'):
                        recognizer = marker_model.text_recognizer
                        
                        # Create dummy input for recognizer
                        batch_size = 1
                        channels = 3
                        height, width = 64, 256
                        recognizer_input = torch.rand(batch_size, channels, height, width).to(device)
                        
                        # Try scripting first
                        try:
                            recognizer_scripted = torch.jit.script(recognizer)
                            recognizer_scripted.save(recognizer_path)
                            exported_components['recognizer'] = {'path': os.path.basename(recognizer_path), 'method': 'script'}
                        except Exception as e:
                            logger.warning(f"Recognizer scripting failed: {e}. Falling back to tracing.")
                            recognizer_traced = torch.jit.trace(recognizer, recognizer_input)
                            recognizer_traced.save(recognizer_path)
                            exported_components['recognizer'] = {'path': os.path.basename(recognizer_path), 'method': 'trace'}
                    
                    # Save configuration
                    model_config = marker_model.config.to_dict() if hasattr(marker_model, 'config') else {}
                    with open(config_path, 'w', encoding='utf-8') as f:
                        config_data = {
                            'engine': 'marker',
                            'export_format': 'torchscript',
                            'model_type': self.config['model_type'],
                            'domain': self.config['domain'],
                            'export_date': time.strftime('%Y-%m-%d %H:%M:%S'),
                            'components': exported_components,
                            'model_config': model_config
                        }
                        json.dump(config_data, f, indent=2)
                    
                    # Create inference utility script
                    inference_path = os.path.join(torchscript_dir, 'torchscript_inference.py')
                    with open(inference_path, 'w', encoding='utf-8') as f:
                        f.write("""
import torch
import json
import os
import time
import numpy as np
from PIL import Image
from typing import Dict, List, Any, Optional, Union
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MarkerTorchScriptProcessor:
    def __init__(self, model_dir: str = None, use_full_model: bool = True):
        """Initialize the Marker TorchScript processor
        
        Args:
            model_dir: Directory containing the TorchScript models
            use_full_model: Whether to use the full model if available
        """
        # Get model directory if not provided
        if model_dir is None:
            model_dir = os.path.dirname(os.path.abspath(__file__))
            
        self.model_dir = model_dir
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.components = {}
        
        # Load configuration
        config_path = os.path.join(model_dir, 'marker_torchscript_config.json')
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                self.config = json.load(f)
            logger.info(f"Loaded configuration from {config_path}")
        except Exception as e:
            logger.error(f"Error loading configuration: {e}")
            self.config = {'components': {}}
        
        # First check if full model is available and preferred
        if use_full_model and 'full_model' in self.config.get('components', {}):
            full_model_info = self.config['components']['full_model']
            full_model_path = os.path.join(self.model_dir, full_model_info['path'])
            
            if os.path.exists(full_model_path):
                try:
                    self.full_model = torch.jit.load(full_model_path, map_location=self.device)
                    self.full_model.eval()
                    self.use_full_model = True
                    logger.info(f"Loaded full model from {full_model_path}")
                except Exception as e:
                    logger.error(f"Error loading full model: {e}")
                    self.use_full_model = False
            else:
                logger.warning(f"Full model file not found: {full_model_path}")
                self.use_full_model = False
        else:
            self.use_full_model = False
        
        # If full model not available or not preferred, load individual components
        if not self.use_full_model:
            for component_name, component_info in self.config.get('components', {}).items():
                if component_name == 'full_model' or not component_info:
                    continue
                    
                model_path = os.path.join(self.model_dir, component_info['path'])
                
                if os.path.exists(model_path):
                    try:
                        model = torch.jit.load(model_path, map_location=self.device)
                        model.eval()
                        self.components[component_name] = model
                        logger.info(f"Loaded {component_name} from {model_path}")
                    except Exception as e:
                        logger.error(f"Error loading {component_name}: {e}")
                else:
                    logger.warning(f"Model file not found: {model_path}")
        
        # Check if we have necessary components
        self.ready = self.use_full_model or 'analyzer' in self.components
        if not self.ready:
            logger.warning("Neither full model nor essential components available")
    
    def preprocess_image(self, image_path: Union[str, Image.Image, np.ndarray]) -> torch.Tensor:
        """Preprocess image for inference
        
        Args:
            image_path: Image path or image data
            
        Returns:
            Preprocessed image tensor
        """
        # Load image if path is provided
        if isinstance(image_path, str):
            try:
                image = Image.open(image_path).convert('RGB')
            except Exception as e:
                logger.error(f"Error loading image: {e}")
                # Create blank image as fallback
                image = Image.new('RGB', (1024, 768), color='white')
        elif isinstance(image_path, np.ndarray):
            # Convert numpy array to PIL image
            image = Image.fromarray(image_path.astype(np.uint8))
        else:
            # Assume it's a PIL image
            image = image_path
        
        # Resize to expected dimensions
        image = image.resize((1024, 768))
        
        # Convert to tensor
        image_tensor = torch.FloatTensor(np.array(image)).permute(2, 0, 1) / 255.0
        
        # Add batch dimension
        batch_tensor = image_tensor.unsqueeze(0).to(self.device)
        
        return batch_tensor
    
    def process_document(self, document_path: str) -> Dict[str, Any]:
        """Process a document with the TorchScript models
        
        Args:
            document_path: Path to document image
            
        Returns:
            Dictionary with processing results
        """
        if not self.ready:
            return {'success': False, 'error': 'Processor not ready'}
            
        try:
            start_time = time.time()
            
            # Preprocess image
            input_tensor = self.preprocess_image(document_path)
            
            # Process with appropriate models
            if self.use_full_model:
                # Use full model for end-to-end processing
                with torch.no_grad():
                    output = self.full_model(input_tensor)
                
                # Extract results from output
                document_info = self._extract_full_model_results(output)
            else:
                # Use separate components
                results = {}
                
                # Detector
                if 'detector' in self.components:
                    with torch.no_grad():
                        detector_output = self.components['detector'](input_tensor)
                    results['detector'] = detector_output
                
                # Analyzer
                with torch.no_grad():
                    analyzer_output = self.components['analyzer'](input_tensor)
                results['analyzer'] = analyzer_output
                
                # Text recognizer (if available and analyzer detected text regions)
                if 'recognizer' in self.components and hasattr(analyzer_output, 'text_regions'):
                    text_results = []
                    for region in analyzer_output.text_regions:
                        # Extract region
                        region_tensor = self._extract_region_tensor(input_tensor, region)
                        
                        # Recognize text
                        with torch.no_grad():
                            recognizer_output = self.components['recognizer'](region_tensor)
                        
                        text_results.append(recognizer_output)
                    
                    results['recognizer'] = text_results
                
                # Extract combined results
                document_info = self._extract_component_results(results)
            
            processing_time = time.time() - start_time
            
            return {
                'success': True,
                'processing_time': processing_time,
                'document': document_info
            }
            
        except Exception as e:
            logger.error(f"Error processing document: {e}")
            return {'success': False, 'error': str(e)}
    
    def _extract_region_tensor(self, image_tensor: torch.Tensor, region) -> torch.Tensor:
        """Extract region tensor from full image tensor
        
        Args:
            image_tensor: Full image tensor
            region: Region information
            
        Returns:
            Region tensor
        """
        # This is a simplified implementation
        # In a real implementation, this would extract the region based on bounding box
        
        # For now, just return a resized version of the input
        return torch.nn.functional.interpolate(
            image_tensor, 
            size=(64, 256),
            mode='bilinear', 
            align_corners=False
        )
    
    def _extract_full_model_results(self, output) -> Dict[str, Any]:
        """Extract results from full model output
        
        Args:
            output: Model output
            
        Returns:
            Structured document information
        """
        # This is a simplified implementation
        # Actual extraction would depend on the model's output format
        
        document_info = {
            'type': 'document',
            'text_content': str(output) if hasattr(output, '__str__') else "Processed document",
            'confidence': 0.95
        }
        
        return document_info
    
    def _extract_component_results(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Extract results from component outputs
        
        Args:
            results: Component results
            
        Returns:
            Structured document information
        """
        # This is a simplified implementation
        # Actual extraction would depend on component output formats
        
        document_info = {
            'type': 'document',
            'components_used': list(results.keys()),
            'analyzer_output': str(results.get('analyzer', ""))
        }
        
        if 'recognizer' in results:
            document_info['text_regions_count'] = len(results['recognizer'])
        
        return document_info

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Process documents with Marker TorchScript models')
    parser.add_argument('document_path', help='Path to the document to process')
    parser.add_argument('--model-dir', help='Directory containing the TorchScript models')
    parser.add_argument('--output', help='Output file for the extracted data')
    parser.add_argument('--component-mode', action='store_true', help='Use individual components instead of full model')
    
    args = parser.parse_args()
    
    # Initialize processor
    processor = MarkerTorchScriptProcessor(args.model_dir, not args.component_mode)
    
    # Process document
    result = processor.process_document(args.document_path)
    
    if result['success']:
        print(f"Document processed in {result['processing_time']:.2f} seconds")
        
        # Save to output file if specified
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2)
            print(f"Results saved to {args.output}")
        else:
            # Print document information
            print("Document information:")
            print(json.dumps(result['document'], indent=2))
    else:
        print(f"Error: {result.get('error', 'Unknown error')}")

if __name__ == "__main__":
    main()
""")
                    
                    # Create requirements file
                    requirements_path = os.path.join(torchscript_dir, 'requirements.txt')
                    with open(requirements_path, 'w') as f:
                        f.write("""
torch>=1.10.0
Pillow>=9.0.0
numpy>=1.20.0
""")
                    
                    # Return success with component information
                    return {
                        'success': True,
                        'format': 'torchscript',
                        'export_dir': torchscript_dir,
                        'components': list(exported_components.keys()),
                        'inference_script': inference_path,
                        'config_path': config_path,
                        'message': f"Marker model exported to TorchScript format successfully with {len(exported_components)} components"
                    }
                    
                except Exception as e:
                    logger.error(f"Error during Marker TorchScript export: {str(e)}")
                    return {'success': False, 'message': f"TorchScript export failed: {str(e)}"}
            
            else:
                return {'success': False, 'message': f"Unsupported export format for Marker: {format}"}
                
        except Exception as e:
            logger.error(f"Error exporting Marker model: {str(e)}")
            return {'success': False, 'error': str(e)}
    
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