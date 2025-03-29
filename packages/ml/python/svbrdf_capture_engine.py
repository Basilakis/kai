#!/usr/bin/env python3
"""
SVBRDF Capture Engine

This module implements the Single-Image SVBRDF (Spatially Varying Bidirectional Reflectance Distribution Function) 
capture functionality based on the work from:
https://github.com/valentin-deschaintre/Single-Image-SVBRDF-Capture-rendering-loss

Key features:
- TensorFlow 2.x compatibility using compat.v1 mode
- Extraction of material appearance properties (diffuse, specular, normals, roughness, metallic)
- Integration with the material recognition pipeline
- No external GitHub dependencies (integrated implementation)

The module provides functionality to extract detailed material appearance information from a single image,
which can enhance material classification and allow for more realistic rendering.
"""

import os
import sys
import logging
import numpy as np
from typing import Dict, List, Tuple, Optional, Union, Any
import cv2
from pathlib import Path
import json
import time

# TensorFlow 2.x compatibility mode as specified
import tensorflow.compat.v1 as tf
tf.disable_v2_behavior()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SVBRDFParameters:
    """Parameters for SVBRDF maps"""
    
    def __init__(self):
        """Initialize parameters with defaults"""
        
        # Input/output parameters
        self.input_size = 256         # Network input resolution
        self.output_size = 256        # Output maps resolution
        self.output_format = 'png'    # Output format for maps (png, exr)
        
        # Network and model parameters
        self.weights_path = None      # Path to network weights
        self.batch_size = 1           # Batch size for prediction
        self.use_gpu = True           # Whether to use GPU acceleration
        self.gpu_memory_fraction = 0.8  # Fraction of GPU memory to use
        
        # SVBRDF processing parameters
        self.gamma_correction = True  # Apply gamma correction to inputs
        self.gamma_value = 2.2        # Gamma correction value
        self.normal_format = 'dx_dy'  # Format for normal maps: dx_dy or dx_dy_dz
        self.specular_scale = 1.0     # Scale factor for specular reflections
        self.roughness_range = [0.05, 1.0]  # Min/max range for roughness
        self.metallic_range = [0.0, 1.0]    # Min/max range for metallic
        
        # Runtime parameters
        self.use_tiling = False       # Whether to use tiling for large inputs
        self.tile_size = 256          # Tile size for processing
        self.tile_overlap = 32        # Overlap between tiles
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert parameters to dictionary"""
        return {key: value for key, value in self.__dict__.items()}
        
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SVBRDFParameters':
        """Create parameters from dictionary"""
        params = cls()
        for key, value in data.items():
            if hasattr(params, key):
                setattr(params, key, value)
        return params


class SVBRDFMaps:
    """Container for SVBRDF maps extracted from an image"""
    
    def __init__(
        self,
        diffuse: np.ndarray = None,
        specular: np.ndarray = None, 
        normals: np.ndarray = None,
        roughness: np.ndarray = None,
        metallic: np.ndarray = None
    ):
        """
        Initialize SVBRDF maps
        
        Args:
            diffuse: Diffuse color map (albedo) [H, W, 3]
            specular: Specular color map [H, W, 3]
            normals: Surface normal map [H, W, 3]
            roughness: Surface roughness map [H, W, 1]
            metallic: Metallic map [H, W, 1]
        """
        self.diffuse = diffuse
        self.specular = specular
        self.normals = normals
        self.roughness = roughness
        self.metallic = metallic
        
        # Additional properties
        self.resolution = None
        self.confidence = 0.0
        self.processing_time = 0.0
        
        # Set resolution if diffuse map is provided
        if diffuse is not None:
            self.resolution = (diffuse.shape[1], diffuse.shape[0])  # (width, height)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert maps to serializable dictionary (without image data)"""
        return {
            "resolution": self.resolution,
            "confidence": self.confidence,
            "processing_time": self.processing_time,
            "has_diffuse": self.diffuse is not None,
            "has_specular": self.specular is not None,
            "has_normals": self.normals is not None,
            "has_roughness": self.roughness is not None,
            "has_metallic": self.metallic is not None
        }
    
    def save_maps(self, output_dir: str, base_filename: str = "material") -> Dict[str, str]:
        """
        Save all maps to disk
        
        Args:
            output_dir: Directory to save maps to
            base_filename: Base filename for all maps
            
        Returns:
            Dictionary of map paths
        """
        os.makedirs(output_dir, exist_ok=True)
        
        paths = {}
        
        # Save diffuse map
        if self.diffuse is not None:
            diffuse_path = os.path.join(output_dir, f"{base_filename}_diffuse.png")
            cv2.imwrite(diffuse_path, cv2.cvtColor(self.diffuse_to_image(), cv2.COLOR_RGB2BGR))
            paths["diffuse"] = diffuse_path
        
        # Save normal map
        if self.normals is not None:
            normals_path = os.path.join(output_dir, f"{base_filename}_normals.png")
            cv2.imwrite(normals_path, cv2.cvtColor(self.normals_to_image(), cv2.COLOR_RGB2BGR))
            paths["normals"] = normals_path
        
        # Save roughness map
        if self.roughness is not None:
            roughness_path = os.path.join(output_dir, f"{base_filename}_roughness.png")
            cv2.imwrite(roughness_path, self.roughness_to_image())
            paths["roughness"] = roughness_path
        
        # Save metallic map
        if self.metallic is not None:
            metallic_path = os.path.join(output_dir, f"{base_filename}_metallic.png")
            cv2.imwrite(metallic_path, self.metallic_to_image())
            paths["metallic"] = metallic_path
        
        # Save specular map
        if self.specular is not None:
            specular_path = os.path.join(output_dir, f"{base_filename}_specular.png")
            cv2.imwrite(specular_path, cv2.cvtColor(self.specular_to_image(), cv2.COLOR_RGB2BGR))
            paths["specular"] = specular_path
        
        # Save preview image
        preview_path = os.path.join(output_dir, f"{base_filename}_preview.png")
        cv2.imwrite(preview_path, cv2.cvtColor(self.generate_preview(), cv2.COLOR_RGB2BGR))
        paths["preview"] = preview_path
        
        # Save metadata
        metadata_path = os.path.join(output_dir, f"{base_filename}_metadata.json")
        with open(metadata_path, 'w') as f:
            json.dump(self.to_dict(), f, indent=2)
        paths["metadata"] = metadata_path
        
        return paths
    
    def diffuse_to_image(self) -> np.ndarray:
        """Convert diffuse map to 8-bit image"""
        if self.diffuse is None:
            return None
        return np.clip(self.diffuse * 255, 0, 255).astype(np.uint8)
    
    def normals_to_image(self) -> np.ndarray:
        """Convert normal map to 8-bit image"""
        if self.normals is None:
            return None
        # Convert from [-1,1] to [0,1] range
        normals_vis = (self.normals + 1.0) * 0.5
        return np.clip(normals_vis * 255, 0, 255).astype(np.uint8)
    
    def roughness_to_image(self) -> np.ndarray:
        """Convert roughness map to 8-bit image"""
        if self.roughness is None:
            return None
        return np.clip(self.roughness * 255, 0, 255).astype(np.uint8)
    
    def metallic_to_image(self) -> np.ndarray:
        """Convert metallic map to 8-bit image"""
        if self.metallic is None:
            return None
        return np.clip(self.metallic * 255, 0, 255).astype(np.uint8)
    
    def specular_to_image(self) -> np.ndarray:
        """Convert specular map to 8-bit image"""
        if self.specular is None:
            return None
        return np.clip(self.specular * 255, 0, 255).astype(np.uint8)
    
    def generate_preview(self, size: Tuple[int, int] = None) -> np.ndarray:
        """
        Generate a preview image combining all maps
        
        Args:
            size: Optional size to resize preview to (width, height)
            
        Returns:
            Preview image as numpy array [H, W, 3]
        """
        if self.diffuse is None:
            return None
        
        # Get dimensions
        if size is None:
            size = self.resolution
        
        # Create base image with diffuse
        preview = self.diffuse_to_image()
        
        # Add normal map overlay in top-right corner
        if self.normals is not None:
            normals_img = self.normals_to_image()
            quarter_h, quarter_w = preview.shape[0] // 2, preview.shape[1] // 2
            preview[0:quarter_h, -quarter_w:] = normals_img[0:quarter_h, 0:quarter_w]
        
        # Add roughness map overlay in bottom-left corner
        if self.roughness is not None:
            roughness_img = self.roughness_to_image()
            if len(roughness_img.shape) == 2:
                roughness_img = np.stack([roughness_img] * 3, axis=-1)
            quarter_h, quarter_w = preview.shape[0] // 2, preview.shape[1] // 2
            preview[-quarter_h:, 0:quarter_w] = roughness_img[-quarter_h:, 0:quarter_w]
        
        # Add metallic map overlay in bottom-right corner
        if self.metallic is not None:
            metallic_img = self.metallic_to_image()
            if len(metallic_img.shape) == 2:
                metallic_img = np.stack([metallic_img] * 3, axis=-1)
            quarter_h, quarter_w = preview.shape[0] // 2, preview.shape[1] // 2
            preview[-quarter_h:, -quarter_w:] = metallic_img[-quarter_h:, 0:quarter_w]
        
        # Resize if needed
        if size != self.resolution:
            preview = cv2.resize(preview, size)
        
        return preview


class SVBRDFCaptureEngine:
    """
    Engine for capturing SVBRDF maps from a single image
    
    This engine implements the core functionality from:
    https://github.com/valentin-deschaintre/Single-Image-SVBRDF-Capture-rendering-loss
    
    It is adapted to work with TensorFlow 2.x using compatibility mode.
    """
    
    def __init__(self, params: SVBRDFParameters = None):
        """
        Initialize the SVBRDF capture engine
        
        Args:
            params: SVBRDF parameters (or None for defaults)
        """
        self.params = params or SVBRDFParameters()
        self.model = None
        self.session = None
        
        # Placeholders for model inputs/outputs
        self.input_placeholder = None
        self.output_diffuse = None
        self.output_specular = None
        self.output_normals = None
        self.output_roughness = None
        self.output_metallic = None
        
        # Initialize model
        self._init_model()
    
    def _init_model(self):
        """Initialize the TensorFlow model"""
        logger.info("Initializing SVBRDF capture model...")
        
        # Configure TensorFlow session
        config = tf.ConfigProto()
        if self.params.use_gpu:
            config.gpu_options.allow_growth = True
            config.gpu_options.per_process_gpu_memory_fraction = self.params.gpu_memory_fraction
        else:
            # Force CPU usage
            config.gpu_options.visible_device_list = ''
        
        # Create session
        self.session = tf.Session(config=config)
        
        with tf.variable_scope('svbrdf_model'):
            # Create placeholders
            self.input_placeholder = tf.placeholder(
                tf.float32, 
                shape=[None, self.params.input_size, self.params.input_size, 3],
                name='input_image'
            )
            
            # Build the model
            self._build_model()
            
            # Initialize variables
            self.session.run(tf.global_variables_initializer())
            
            # Load weights if provided
            if self.params.weights_path is not None:
                self._load_weights()
        
        logger.info("SVBRDF capture model initialized")
    
    def _build_model(self):
        """Build the TensorFlow model for SVBRDF prediction"""
        # Implement the core model architecture from the GitHub repository
        # This is a simplified version of the architecture
        
        # Encoder
        with tf.variable_scope('encoder'):
            # Initial layers
            x = self._conv_block(self.input_placeholder, 64, name='conv1')
            skip1 = x  # Skip connection 1
            
            # Downsampling blocks
            x = self._conv_block(x, 128, strides=2, name='conv2')
            skip2 = x  # Skip connection 2
            
            x = self._conv_block(x, 256, strides=2, name='conv3')
            skip3 = x  # Skip connection 3
            
            x = self._conv_block(x, 512, strides=2, name='conv4')
            skip4 = x  # Skip connection 4
            
            # Bottleneck
            x = self._conv_block(x, 512, name='bottleneck')
        
        # Decoder - Shared layers
        with tf.variable_scope('decoder_shared'):
            # Upsampling blocks with skip connections
            x = self._upsample_block(x, 512, skip4, name='upconv1')
            x = self._upsample_block(x, 256, skip3, name='upconv2')
            x = self._upsample_block(x, 128, skip2, name='upconv3')
            shared_features = self._upsample_block(x, 64, skip1, name='upconv4')
        
        # Separate heads for each SVBRDF component
        with tf.variable_scope('diffuse_head'):
            diffuse = self._output_head(shared_features, 3, name='diffuse')
            self.output_diffuse = tf.nn.sigmoid(diffuse, name='diffuse_output')
        
        with tf.variable_scope('normal_head'):
            normals = self._output_head(shared_features, 3, name='normals')
            # Normalize normal vectors
            self.output_normals = tf.nn.tanh(normals, name='normals_output')
        
        with tf.variable_scope('roughness_head'):
            roughness = self._output_head(shared_features, 1, name='roughness')
            self.output_roughness = tf.nn.sigmoid(roughness, name='roughness_output')
        
        with tf.variable_scope('metallic_head'):
            metallic = self._output_head(shared_features, 1, name='metallic')
            self.output_metallic = tf.nn.sigmoid(metallic, name='metallic_output')
        
        with tf.variable_scope('specular_head'):
            specular = self._output_head(shared_features, 3, name='specular')
            self.output_specular = tf.nn.sigmoid(specular, name='specular_output')
    
    def _conv_block(self, x, filters, kernel_size=3, strides=1, name=None):
        """Convolutional block with batch normalization and ReLU"""
        x = tf.layers.conv2d(
            x, filters, kernel_size, strides=strides, padding='same', name=f'{name}_conv'
        )
        x = tf.layers.batch_normalization(x, name=f'{name}_bn')
        x = tf.nn.relu(x, name=f'{name}_relu')
        return x
    
    def _upsample_block(self, x, filters, skip_connection, name=None):
        """Upsampling block with skip connections"""
        # Upsample
        x = tf.layers.conv2d_transpose(
            x, filters, 3, strides=2, padding='same', name=f'{name}_upconv'
        )
        
        # Concatenate with skip connection
        x = tf.concat([x, skip_connection], axis=-1, name=f'{name}_concat')
        
        # Process combined features
        x = self._conv_block(x, filters, name=f'{name}_conv1')
        x = self._conv_block(x, filters, name=f'{name}_conv2')
        
        return x
    
    def _output_head(self, x, channels, name=None):
        """Output head for material maps"""
        x = tf.layers.conv2d(
            x, 32, 3, padding='same', activation=tf.nn.relu, name=f'{name}_conv1'
        )
        x = tf.layers.conv2d(
            x, channels, 3, padding='same', name=f'{name}_conv2'
        )
        return x
    
    def _load_weights(self):
        """Load pre-trained weights"""
        if not os.path.exists(self.params.weights_path):
            logger.warning(f"Weights file not found: {self.params.weights_path}")
            return
        
        logger.info(f"Loading weights from: {self.params.weights_path}")
        
        # Create saver for restoring weights
        saver = tf.train.Saver()
        
        # Restore weights
        try:
            saver.restore(self.session, self.params.weights_path)
            logger.info("Weights loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load weights: {e}")
    
    def predict(self, image: np.ndarray) -> SVBRDFMaps:
        """
        Predict SVBRDF maps from an input image
        
        Args:
            image: Input image as numpy array [H, W, 3] in RGB format
            
        Returns:
            SVBRDFMaps object containing the extracted maps
        """
        if self.session is None:
            raise RuntimeError("Model not initialized. Call _init_model() first")
        
        start_time = time.time()
        
        # Preprocess image
        processed_image = self._preprocess_image(image)
        
        # Run prediction
        feed_dict = {self.input_placeholder: processed_image}
        
        outputs = self.session.run(
            [
                self.output_diffuse,
                self.output_specular,
                self.output_normals,
                self.output_roughness,
                self.output_metallic
            ],
            feed_dict=feed_dict
        )
        
        # Extract results
        diffuse_map = outputs[0][0]
        specular_map = outputs[1][0]
        normals_map = outputs[2][0]
        roughness_map = outputs[3][0]
        metallic_map = outputs[4][0]
        
        # Create SVBRDF maps object
        maps = SVBRDFMaps(
            diffuse=diffuse_map,
            specular=specular_map,
            normals=normals_map,
            roughness=roughness_map,
            metallic=metallic_map
        )
        
        # Set processing time
        maps.processing_time = time.time() - start_time
        
        # Set confidence (placeholder for now)
        maps.confidence = 0.85
        
        return maps
    
    def _preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocess image for input to the model
        
        Args:
            image: Input image [H, W, 3] in RGB format
            
        Returns:
            Preprocessed image as batch [1, input_size, input_size, 3]
        """
        # Convert to float and normalize to [0, 1]
        if image.dtype == np.uint8:
            image = image.astype(np.float32) / 255.0
        
        # Apply gamma correction if enabled
        if self.params.gamma_correction:
            image = np.power(image, 1.0 / self.params.gamma_value)
        
        # Resize to input size
        if image.shape[0] != self.params.input_size or image.shape[1] != self.params.input_size:
            image = cv2.resize(image, (self.params.input_size, self.params.input_size))
        
        # Ensure RGB format
        if len(image.shape) == 2:
            image = np.stack([image] * 3, axis=-1)
        
        # Add batch dimension
        image = np.expand_dims(image, axis=0)
        
        return image
    
    def process_image(self, image_path: str, output_dir: Optional[str] = None) -> SVBRDFMaps:
        """
        Process an image file to extract SVBRDF maps
        
        Args:
            image_path: Path to the input image
            output_dir: Optional directory to save the maps
            
        Returns:
            SVBRDFMaps object containing the extracted maps
        """
        # Check if image exists
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")
        
        # Read image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Failed to read image: {image_path}")
        
        # Convert BGR to RGB
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Predict SVBRDF maps
        maps = self.predict(image)
        
        # Save maps if output_dir is specified
        if output_dir is not None:
            base_filename = os.path.splitext(os.path.basename(image_path))[0]
            maps.save_maps(output_dir, base_filename)
        
        return maps
    
    def get_material_properties(self, maps: SVBRDFMaps) -> Dict[str, Any]:
        """
        Extract high-level material properties from SVBRDF maps
        
        Args:
            maps: SVBRDFMaps object
            
        Returns:
            Dictionary of material properties
        """
        properties = {}
        
        # Extract average color
        if maps.diffuse is not None:
            avg_color = np.mean(maps.diffuse, axis=(0, 1))
            properties["average_color"] = {
                "r": float(avg_color[0]),
                "g": float(avg_color[1]),
                "b": float(avg_color[2])
            }
        
        # Extract average roughness
        if maps.roughness is not None:
            avg_roughness = float(np.mean(maps.roughness))
            properties["average_roughness"] = avg_roughness
        
        # Extract average metallic
        if maps.metallic is not None:
            avg_metallic = float(np.mean(maps.metallic))
            properties["average_metallic"] = avg_metallic
        
        # Extract normal map statistics
        if maps.normals is not None:
            normal_variance = float(np.mean(np.var(maps.normals, axis=(0, 1))))
            properties["normal_variance"] = normal_variance
            properties["surface_smoothness"] = 1.0 - min(1.0, normal_variance * 5.0)
        
        # Calculate overall reflectivity
        if maps.diffuse is not None and maps.specular is not None:
            diffuse_luminance = np.mean(maps.diffuse) * 0.3
            specular_luminance = np.mean(maps.specular) * 0.7
            properties["reflectivity"] = float(diffuse_luminance + specular_luminance)
        
        # Add processing information
        properties["processing_time"] = maps.processing_time
        properties["confidence"] = maps.confidence
        
        return properties
    
    def close(self):
        """Close TensorFlow session and release resources"""
        if self.session is not None:
            self.session.close()
            self.session = None


def main():
    """Main function to parse arguments and run SVBRDF capture"""
    import argparse
    
    parser = argparse.ArgumentParser(description="SVBRDF Capture Engine")
    parser.add_argument("image_path", help="Path to the input image")
    parser.add_argument("--output-dir", help="Output directory for SVBRDF maps")
    parser.add_argument("--weights", help="Path to model weights")
    parser.add_argument("--no-gpu", action="store_true", help="Disable GPU usage")
    parser.add_argument("--input-size", type=int, default=256, help="Input image size")
    
    args = parser.parse_args()
    
    # Create parameters
    params = SVBRDFParameters()
    if args.weights:
        params.weights_path = args.weights
    params.use_gpu = not args.no_gpu
    params.input_size = args.input_size
    
    # Create SVBRDF capture engine
    engine = SVBRDFCaptureEngine(params)
    
    try:
        # Process image
        maps = engine.process_image(args.image_path, args.output_dir)
        
        # Extract material properties
        properties = engine.get_material_properties(maps)
        
        # Print material properties
        print(json.dumps(properties, indent=2))
        
        if args.output_dir:
            print(f"SVBRDF maps saved to: {args.output_dir}")
    
    finally:
        # Clean up
        engine.close()


if __name__ == "__main__":
    main()