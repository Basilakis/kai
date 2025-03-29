#!/usr/bin/env python3
"""
Material SVBRDF Processor

This module provides an interface for the SVBRDF capture engine to integrate with the
material recognition system. It handles preprocessing, capture, and integration of
material appearance properties.

It is designed to work with the TensorFlow 2.x compatibility mode and provides
a simplified API for extracting SVBRDF maps from material images.
"""

import os
import sys
import logging
import numpy as np
from typing import Dict, List, Tuple, Optional, Union, Any
import cv2
import json
from pathlib import Path
import time

# Import SVBRDF capture engine
from svbrdf_capture_engine import (
    SVBRDFCaptureEngine,
    SVBRDFParameters,
    SVBRDFMaps
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MaterialSVBRDFProcessor:
    """
    Processor for extracting SVBRDF material properties
    
    This class serves as the main interface for using the SVBRDF capture engine
    within the material recognition system. It provides methods for processing
    material images, extracting appearance properties, and integrating with
    the material metadata system.
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the Material SVBRDF Processor
        
        Args:
            config: Configuration dictionary (or None for defaults)
        """
        self.config = {
            # Engine configuration
            'engine': {
                'weights_path': os.environ.get('SVBRDF_WEIGHTS_PATH', None),
                'use_gpu': True,
                'input_size': 256,
                'gpu_memory_fraction': 0.5
            },
            
            # Processing options
            'processing': {
                'apply_preprocessing': True,
                'normalize_lighting': True,
                'enhance_details': True,
                'max_image_size': 1024
            },
            
            # Output options
            'output': {
                'save_maps': True,
                'maps_directory': 'material_maps',
                'extract_tiled': False,
                'tile_size': 256,
                'metadata_extract': True
            }
        }
        
        # Update configuration if provided
        if config:
            self._update_config_recursive(self.config, config)
        
        # Initialize SVBRDF parameters
        self.svbrdf_params = SVBRDFParameters()
        self._apply_engine_config()
        
        # Initialize engine
        self.engine = None  # Lazy initialization
    
    def _update_config_recursive(self, target: Dict, source: Dict):
        """Update configuration recursively"""
        for key, value in source.items():
            if key in target and isinstance(target[key], dict) and isinstance(value, dict):
                self._update_config_recursive(target[key], value)
            else:
                target[key] = value
    
    def _apply_engine_config(self):
        """Apply engine configuration to SVBRDF parameters"""
        engine_config = self.config['engine']
        
        self.svbrdf_params.weights_path = engine_config.get('weights_path')
        self.svbrdf_params.use_gpu = engine_config.get('use_gpu', True)
        self.svbrdf_params.input_size = engine_config.get('input_size', 256)
        self.svbrdf_params.gpu_memory_fraction = engine_config.get('gpu_memory_fraction', 0.5)
    
    def _get_engine(self) -> SVBRDFCaptureEngine:
        """Get or initialize the SVBRDF capture engine"""
        if self.engine is None:
            logger.info("Initializing SVBRDF capture engine...")
            self.engine = SVBRDFCaptureEngine(self.svbrdf_params)
        return self.engine
    
    def _preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocess image for SVBRDF capture
        
        Args:
            image: Input image [H, W, 3] in BGR or RGB format
            
        Returns:
            Preprocessed image [H, W, 3] in RGB format
        """
        # Check if we need to convert from BGR (OpenCV default)
        if len(image.shape) == 3 and image.shape[2] == 3:
            # Assume BGR and convert to RGB
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Apply preprocessing if enabled
        if self.config['processing']['apply_preprocessing']:
            # Convert to float if needed
            if image.dtype != np.float32:
                image = image.astype(np.float32)
                if image.max() > 1.0:
                    image /= 255.0
            
            # Apply normalization
            if self.config['processing']['normalize_lighting']:
                # Simple color normalization
                for i in range(3):
                    channel = image[:, :, i]
                    min_val = np.percentile(channel, 5)
                    max_val = np.percentile(channel, 95)
                    if max_val > min_val:
                        channel = np.clip((channel - min_val) / (max_val - min_val), 0, 1)
                        image[:, :, i] = channel
            
            # Apply detail enhancement
            if self.config['processing']['enhance_details']:
                # Convert back to 8-bit for detail enhancement
                temp_img = (image * 255).astype(np.uint8)
                # Apply detail enhancement
                temp_img = cv2.detailEnhance(
                    temp_img, 
                    sigma_s=0.5,  # Range 0-200
                    sigma_r=0.1   # Range 0-1
                )
                # Convert back to float
                image = temp_img.astype(np.float32) / 255.0
        
        # Resize if needed
        max_size = self.config['processing']['max_image_size']
        if max(image.shape[0], image.shape[1]) > max_size:
            scale = max_size / max(image.shape[0], image.shape[1])
            new_width = int(image.shape[1] * scale)
            new_height = int(image.shape[0] * scale)
            image = cv2.resize(image, (new_width, new_height))
        
        return image
    
    def process_image(
        self, 
        image_path: str,
        output_dir: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process an image file to extract SVBRDF maps and material properties
        
        Args:
            image_path: Path to the input image
            output_dir: Optional directory to save the maps and metadata
            
        Returns:
            Dictionary with material properties and paths to saved maps
        """
        # Ensure engine is initialized
        engine = self._get_engine()
        
        # Determine output directory
        if output_dir is None and self.config['output']['save_maps']:
            output_dir = self.config['output']['maps_directory']
            os.makedirs(output_dir, exist_ok=True)
        
        try:
            # Read and preprocess image
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError(f"Failed to read image: {image_path}")
            
            # Preprocess image
            preprocessed = self._preprocess_image(image)
            
            # Extract SVBRDF maps
            svbrdf_maps = engine.predict(preprocessed)
            
            # Extract material properties
            properties = engine.get_material_properties(svbrdf_maps)
            
            # Save maps if requested
            if output_dir and self.config['output']['save_maps']:
                base_filename = os.path.splitext(os.path.basename(image_path))[0]
                map_paths = svbrdf_maps.save_maps(output_dir, base_filename)
                properties['map_paths'] = map_paths
            
            # Add metadata
            properties['source_image'] = image_path
            properties['processing_config'] = self.config['processing']
            
            return properties
            
        except Exception as e:
            logger.error(f"Error processing image {image_path}: {e}")
            raise
    
    def process_material_batch(
        self, 
        material_ids: List[str],
        image_paths: List[str],
        output_dir: Optional[str] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Process a batch of material images
        
        Args:
            material_ids: List of material IDs
            image_paths: List of paths to material images
            output_dir: Optional directory to save the maps and metadata
            
        Returns:
            Dictionary mapping material IDs to their properties
        """
        if len(material_ids) != len(image_paths):
            raise ValueError("Number of material IDs and image paths must match")
        
        # Process each material
        results = {}
        for material_id, image_path in zip(material_ids, image_paths):
            try:
                # Process the image
                material_dir = None
                if output_dir:
                    material_dir = os.path.join(output_dir, material_id)
                    os.makedirs(material_dir, exist_ok=True)
                
                properties = self.process_image(image_path, material_dir)
                results[material_id] = properties
                
            except Exception as e:
                logger.error(f"Error processing material {material_id}: {e}")
                results[material_id] = {
                    'error': str(e),
                    'success': False
                }
        
        return results
    
    def integrate_with_material_metadata(
        self, 
        material_id: str,
        svbrdf_properties: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Integrate SVBRDF properties with material metadata
        
        Args:
            material_id: Material ID
            svbrdf_properties: SVBRDF properties from process_image
            
        Returns:
            Updated material metadata
        """
        # This would integrate with the material metadata system
        # For now, just convert to a metadata-compatible format
        
        metadata = {
            'appearance': {
                'diffuse_color': svbrdf_properties.get('average_color', {}),
                'roughness': svbrdf_properties.get('average_roughness', 0.5),
                'metallic': svbrdf_properties.get('average_metallic', 0.0),
                'reflectivity': svbrdf_properties.get('reflectivity', 0.5),
                'surface_smoothness': svbrdf_properties.get('surface_smoothness', 0.5)
            },
            'svbrdf_maps': svbrdf_properties.get('map_paths', {}),
            'svbrdf_analysis': {
                'confidence': svbrdf_properties.get('confidence', 0.0),
                'processing_time': svbrdf_properties.get('processing_time', 0.0)
            }
        }
        
        return metadata
    
    def close(self):
        """Clean up resources"""
        if self.engine is not None:
            self.engine.close()
            self.engine = None


# Singleton instance for use by other modules
_instance = None

def get_processor(config: Dict[str, Any] = None) -> MaterialSVBRDFProcessor:
    """Get or create the singleton processor instance"""
    global _instance
    if _instance is None:
        _instance = MaterialSVBRDFProcessor(config)
    return _instance


def process_material_image(
    image_path: str,
    material_id: Optional[str] = None,
    output_dir: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Process a material image and extract SVBRDF properties
    
    This is a convenience function for one-off processing.
    
    Args:
        image_path: Path to the material image
        material_id: Optional material ID (for metadata integration)
        output_dir: Optional directory to save the maps
        config: Optional processor configuration
        
    Returns:
        Dictionary with material properties
    """
    processor = get_processor(config)
    
    # Process the image
    properties = processor.process_image(image_path, output_dir)
    
    # Integrate with metadata if material_id is provided
    if material_id:
        metadata = processor.integrate_with_material_metadata(material_id, properties)
        properties['metadata'] = metadata
    
    return properties


if __name__ == "__main__":
    """Simple command-line interface"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Material SVBRDF Processor")
    parser.add_argument("image_path", help="Path to the material image")
    parser.add_argument("--output-dir", help="Output directory")
    parser.add_argument("--material-id", help="Material ID")
    parser.add_argument("--config", help="Path to configuration JSON file")
    
    args = parser.parse_args()
    
    # Load config if provided
    config = None
    if args.config and os.path.exists(args.config):
        with open(args.config, 'r') as f:
            config = json.load(f)
    
    # Process image
    properties = process_material_image(
        args.image_path,
        args.material_id,
        args.output_dir,
        config
    )
    
    # Print result
    print(json.dumps(properties, indent=2))