"""
ESRGAN Super-Resolution Processor

This module provides high-quality texture upscaling using ESRGAN (Enhanced Super-Resolution 
Generative Adversarial Networks). It includes:

1. Pre-trained ESRGAN model loading
2. Material-specific optimization for different texture types
3. GPU acceleration with PyTorch
4. Fallback mechanisms for CPU-only environments

The implementation follows the architecture from the paper:
"ESRGAN: Enhanced Super-Resolution Generative Adversarial Networks"
by Wang et al. (https://arxiv.org/abs/1809.00219)
"""

import os
import numpy as np
import cv2
from PIL import Image
import logging
from typing import Dict, List, Union, Tuple, Optional, Any, Callable

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("esrgan_processor")

# Configure paths for pre-trained models
MODELS_DIR = os.environ.get("MODELS_DIR", os.path.join(os.path.dirname(__file__), "models"))
ESRGAN_MODELS_DIR = os.path.join(MODELS_DIR, "esrgan")
DEFAULT_MODEL_PATH = os.path.join(ESRGAN_MODELS_DIR, "RRDB_ESRGAN_x4.pth")
MATERIAL_SPECIFIC_MODELS = {
    "wood": os.path.join(ESRGAN_MODELS_DIR, "wood_texture_x4.pth"),
    "metal": os.path.join(ESRGAN_MODELS_DIR, "metal_texture_x4.pth"),
    "fabric": os.path.join(ESRGAN_MODELS_DIR, "fabric_texture_x4.pth"),
    "stone": os.path.join(ESRGAN_MODELS_DIR, "stone_texture_x4.pth"),
    "tile": os.path.join(ESRGAN_MODELS_DIR, "tile_texture_x4.pth")
}

# Try to import PyTorch for GPU acceleration
TORCH_AVAILABLE = False
try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    logger.warning("PyTorch not available, falling back to CV2 for upscaling")

# Fallback configuration for when PyTorch isn't available
FALLBACK_CONFIG = {
    "interpolation": cv2.INTER_LANCZOS4,
    "sharpening_factor": 1.5,
    "edge_enhancement": True
}

class RRDBNet(nn.Module):
    """
    RRDB Network architecture for ESRGAN.
    Residual in Residual Dense Block Network.
    """
    def __init__(self, in_nc=3, out_nc=3, nf=64, nb=23, gc=32, upscale=4, norm_type=None):
        """
        Initialize the RRDB Network.
        
        Args:
            in_nc: Number of input channels
            out_nc: Number of output channels
            nf: Number of features
            nb: Number of RRDB blocks
            gc: Growth channels for dense blocks
            upscale: Upscaling factor (2, 4, etc.)
            norm_type: Normalization type
        """
        super(RRDBNet, self).__init__()
        
        # First convolution layer
        self.conv_first = nn.Conv2d(in_nc, nf, 3, 1, 1, bias=True)
        
        # Build RRDB blocks
        self.RRDB_trunk = self._make_RRDB_blocks(nf, nb, gc)
        
        # Trunk convolution
        self.trunk_conv = nn.Conv2d(nf, nf, 3, 1, 1, bias=True)
        
        # Upsampling layers
        self.upconv1 = nn.Conv2d(nf, nf, 3, 1, 1, bias=True)
        self.upconv2 = nn.Conv2d(nf, nf, 3, 1, 1, bias=True)
        
        if upscale == 4:
            self.upsample1 = nn.Upsample(scale_factor=2, mode='nearest')
            self.upsample2 = nn.Upsample(scale_factor=2, mode='nearest')
        elif upscale == 2:
            self.upsample1 = nn.Upsample(scale_factor=2, mode='nearest')
            self.upsample2 = None
        else:
            raise ValueError(f"Unsupported upscale factor: {upscale}")
        
        # Final output layer
        self.HRconv = nn.Conv2d(nf, nf, 3, 1, 1, bias=True)
        self.conv_last = nn.Conv2d(nf, out_nc, 3, 1, 1, bias=True)
        
        # Activation function
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)
        
    def _make_RRDB_blocks(self, nf, nb, gc):
        """Create Residual in Residual Dense Blocks (RRDB)"""
        layers = []
        for _ in range(nb):
            layers.append(RRDB(nf, gc))
        return nn.Sequential(*layers)
    
    def forward(self, x):
        """Forward pass through the network"""
        # First features
        fea = self.conv_first(x)
        
        # RRDB blocks
        trunk = self.RRDB_trunk(fea)
        trunk = self.trunk_conv(trunk)
        fea = fea + trunk
        
        # Upsampling
        fea = self.lrelu(self.upconv1(self.upsample1(fea)))
        if self.upsample2 is not None:
            fea = self.lrelu(self.upconv2(self.upsample2(fea)))
        
        # Final layers
        out = self.conv_last(self.lrelu(self.HRconv(fea)))
        
        return out

class ResidualDenseBlock(nn.Module):
    """
    Residual Dense Block for RRDB
    """
    def __init__(self, nf=64, gc=32):
        """
        Initialize ResidualDenseBlock
        
        Args:
            nf: Number of feature maps
            gc: Growth channels
        """
        super(ResidualDenseBlock, self).__init__()
        
        # Dense convolution layers
        self.conv1 = nn.Conv2d(nf, gc, 3, 1, 1, bias=True)
        self.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1, bias=True)
        self.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1, bias=True)
        self.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1, bias=True)
        self.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1, bias=True)
        
        # Activation
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)
        
        # Initialization
        self._initialize_weights()
    
    def _initialize_weights(self):
        """Initialize weights for better training stability"""
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, a=0.2, mode='fan_in', nonlinearity='leaky_relu')
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)
    
    def forward(self, x):
        """Forward pass through the Residual Dense Block"""
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
        
        # Residual connection with scaling factor
        return x5 * 0.2 + x

class RRDB(nn.Module):
    """
    Residual in Residual Dense Block
    """
    def __init__(self, nf, gc=32):
        """
        Initialize RRDB
        
        Args:
            nf: Number of feature maps
            gc: Growth channels for dense blocks
        """
        super(RRDB, self).__init__()
        
        # Define three RDBs in series
        self.RDB1 = ResidualDenseBlock(nf, gc)
        self.RDB2 = ResidualDenseBlock(nf, gc)
        self.RDB3 = ResidualDenseBlock(nf, gc)
    
    def forward(self, x):
        """Forward pass through RRDB"""
        out = self.RDB1(x)
        out = self.RDB2(out)
        out = self.RDB3(out)
        
        # Residual scaling
        return out * 0.2 + x

class ESRGANProcessor:
    """
    ESRGAN-based image super-resolution processor with material-specific optimizations.
    Provides high-quality upscaling for textures used in 3D material rendering.
    """
    
    def __init__(self, 
                 model_path: Optional[str] = None, 
                 device: Optional[str] = None,
                 fallback_config: Optional[Dict[str, Any]] = None):
        """
        Initialize ESRGAN processor
        
        Args:
            model_path: Path to pre-trained ESRGAN model
            device: Device to use for processing ('cuda', 'cpu', or None for auto-detection)
            fallback_config: Configuration for fallback upscaling when PyTorch is not available
        """
        self.model = None
        self.model_path = model_path or DEFAULT_MODEL_PATH
        
        # Set fallback configuration
        self.fallback_config = fallback_config or FALLBACK_CONFIG
        
        # Initialize material-specific models mapping
        self.material_models = {}
        self.material_model_paths = MATERIAL_SPECIFIC_MODELS
        
        # Set device for processing
        if TORCH_AVAILABLE:
            if device is None:
                self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            else:
                self.device = torch.device(device)
                
            logger.info(f"Initializing ESRGAN processor on device: {self.device}")
            
            # Load default model
            self._load_model()
        else:
            logger.warning("PyTorch not available, using CV2 fallback for upscaling")
            self.device = None
    
    def _load_model(self, model_path: Optional[str] = None):
        """
        Load ESRGAN model from specified path
        
        Args:
            model_path: Path to the model file (.pth)
        """
        if not TORCH_AVAILABLE:
            logger.warning("PyTorch is not available, cannot load ESRGAN model")
            return
        
        path_to_load = model_path or self.model_path
        
        try:
            # Create models directory if it doesn't exist
            os.makedirs(os.path.dirname(path_to_load), exist_ok=True)
            
            # Check if model file exists
            if not os.path.exists(path_to_load):
                logger.warning(f"Model file {path_to_load} not found. Using default initialization.")
                self.model = RRDBNet()
                self.model.to(self.device)
                return
            
            # Load state dictionary
            state_dict = torch.load(path_to_load, map_location=self.device)
            
            # Create model with default architecture
            model = RRDBNet()
            
            # Handle different state dictionary formats
            if 'params_ema' in state_dict:
                # Format from official ESRGAN implementation
                model.load_state_dict(state_dict['params_ema'])
            elif 'state_dict' in state_dict:
                # Common PyTorch format
                model.load_state_dict(state_dict['state_dict'])
            else:
                # Direct state dictionary
                model.load_state_dict(state_dict)
            
            # Move model to device
            model.eval()
            model.to(self.device)
            
            # Store model
            self.model = model
            
            logger.info(f"Successfully loaded ESRGAN model from {path_to_load}")
            
        except Exception as e:
            logger.error(f"Error loading ESRGAN model: {e}")
            # Initialize a new model as fallback
            self.model = RRDBNet()
            self.model.to(self.device)
    
    def _get_model_for_material(self, material_type: Optional[str]) -> nn.Module:
        """
        Get the appropriate model for a specific material type
        
        Args:
            material_type: Type of material (wood, metal, etc.)
            
        Returns:
            PyTorch model for processing
        """
        if not material_type or material_type not in self.material_model_paths:
            return self.model
        
        # Check if material model is already loaded
        if material_type not in self.material_models:
            material_model_path = self.material_model_paths[material_type]
            
            # Check if model file exists
            if not os.path.exists(material_model_path):
                logger.warning(f"Material-specific model for {material_type} not found. Using default model.")
                return self.model
            
            try:
                # Load material-specific model
                self._load_model(material_model_path)
                self.material_models[material_type] = self.model
                
                # Restore default model
                self._load_model()
                
            except Exception as e:
                logger.error(f"Error loading material model: {e}")
                return self.model
        
        return self.material_models[material_type]
    
    def _preprocess_image(self, img: np.ndarray, material_type: Optional[str] = None) -> torch.Tensor:
        """
        Preprocess image for ESRGAN model
        
        Args:
            img: Input image as numpy array
            material_type: Type of material for specialized preprocessing
            
        Returns:
            Preprocessed image as PyTorch tensor
        """
        # Material-specific preprocessing
        if material_type:
            # Apply specialized preprocessing based on material type
            if material_type == "wood":
                # Enhance wood grain contrast
                img = self._enhance_contrast(img, factor=1.2)
            elif material_type == "metal":
                # Enhance smoothness for metals
                img = self._reduce_noise(img, strength=0.6)
            elif material_type == "stone":
                # Enhance texture details for stone
                img = self._enhance_sharpness(img, factor=1.3)
        
        # Convert to RGB if grayscale
        if len(img.shape) == 2:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
        elif img.shape[2] == 1:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
        elif img.shape[2] == 4:
            # Handle alpha channel
            # Split the image into RGB and Alpha channels
            rgb = img[:, :, :3]
            alpha = img[:, :, 3]
            
            # Process RGB channels
            img = rgb
            
            # Store alpha channel for later use
            self.alpha_channel = alpha
        
        # Convert to float32 and normalize to [0, 1]
        img = img.astype(np.float32) / 255.
        
        # Swap color channels from BGR to RGB if needed
        if img.shape[2] == 3:
            img = img[:, :, [2, 1, 0]]  # BGR -> RGB
        
        # Convert to PyTorch tensor
        tensor = torch.from_numpy(np.transpose(img, (2, 0, 1))).float()
        
        # Add batch dimension
        tensor = tensor.unsqueeze(0)
        
        # Move to device
        tensor = tensor.to(self.device)
        
        return tensor
    
    def _postprocess_tensor(self, tensor: torch.Tensor, original_img: np.ndarray) -> np.ndarray:
        """
        Convert output tensor back to numpy array
        
        Args:
            tensor: Output tensor from model
            original_img: Original input image
            
        Returns:
            Processed image as numpy array
        """
        # Clamp values to [0, 1]
        output = tensor.data.squeeze().float().cpu().clamp_(0, 1).numpy()
        
        # Convert from CxHxW to HxWxC
        output = np.transpose(output, (1, 2, 0))
        
        # Convert back to BGR for OpenCV if needed
        output = output[:, :, [2, 1, 0]]  # RGB -> BGR
        
        # Scale back to 0-255 range
        output = (output * 255.0).round().astype(np.uint8)
        
        # If the original image had an alpha channel, reattach it
        if hasattr(self, 'alpha_channel') and self.alpha_channel is not None:
            # Resize alpha channel to match output dimensions
            resized_alpha = cv2.resize(
                self.alpha_channel, 
                (output.shape[1], output.shape[0]), 
                interpolation=cv2.INTER_LANCZOS4
            )
            
            # Add alpha channel to output
            output = cv2.merge([output, resized_alpha])
            
            # Clear the stored alpha channel
            self.alpha_channel = None
        
        return output
    
    def _fallback_upscale(self, img: np.ndarray, scale_factor: int, material_type: Optional[str] = None) -> np.ndarray:
        """
        Fallback upscaling using OpenCV when PyTorch is not available
        
        Args:
            img: Input image as numpy array
            scale_factor: Upscaling factor
            material_type: Type of material for specialized processing
            
        Returns:
            Upscaled image as numpy array
        """
        # Get interpolation method from config
        interpolation = self.fallback_config.get("interpolation", cv2.INTER_LANCZOS4)
        
        # Perform initial upscaling
        h, w = img.shape[:2]
        upscaled = cv2.resize(img, (w * scale_factor, h * scale_factor), interpolation=interpolation)
        
        # Apply additional enhancement based on material type
        if material_type:
            if material_type == "wood":
                upscaled = self._enhance_texture_details(upscaled, strength=1.2)
            elif material_type == "metal":
                upscaled = self._enhance_smoothness(upscaled, strength=1.3)
            elif material_type == "stone":
                upscaled = self._enhance_texture_details(upscaled, strength=1.5)
            elif material_type == "fabric":
                upscaled = self._enhance_texture_details(upscaled, strength=1.1)
        
        # Apply general enhancements
        if self.fallback_config.get("edge_enhancement", True):
            upscaled = self._enhance_edges(upscaled)
        
        sharpening_factor = self.fallback_config.get("sharpening_factor", 1.5)
        if sharpening_factor > 0:
            upscaled = self._enhance_sharpness(upscaled, sharpening_factor)
        
        return upscaled
    
    # Utility methods for image enhancement
    def _enhance_contrast(self, img: np.ndarray, factor: float = 1.2) -> np.ndarray:
        """Enhance image contrast"""
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        # Apply CLAHE to L channel
        clahe = cv2.createCLAHE(clipLimit=factor, tileGridSize=(8, 8))
        l = clahe.apply(l)
        
        # Merge channels
        lab = cv2.merge((l, a, b))
        
        # Convert back to BGR
        enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        return enhanced
    
    def _reduce_noise(self, img: np.ndarray, strength: float = 0.5) -> np.ndarray:
        """Reduce noise in image"""
        # Apply bilateral filter for edge-preserving smoothing
        d = int(3 * strength)  # Filter size
        sigma_color = 25 * strength
        sigma_space = 25 * strength
        
        return cv2.bilateralFilter(img, d, sigma_color, sigma_space)
    
    def _enhance_sharpness(self, img: np.ndarray, factor: float = 1.5) -> np.ndarray:
        """Enhance image sharpness"""
        # Create sharpening kernel
        kernel = np.array([[-1, -1, -1],
                          [-1, 9 + factor, -1],
                          [-1, -1, -1]])
        
        # Apply filter
        return cv2.filter2D(img, -1, kernel)
    
    def _enhance_texture_details(self, img: np.ndarray, strength: float = 1.0) -> np.ndarray:
        """Enhance texture details"""
        return cv2.detailEnhance(img, sigma_s=10, sigma_r=0.15 * strength)
    
    def _enhance_smoothness(self, img: np.ndarray, strength: float = 1.0) -> np.ndarray:
        """Enhance smoothness while preserving edges"""
        return cv2.edgePreservingFilter(img, flags=1, sigma_s=60, sigma_r=0.4 * strength)
    
    def _enhance_edges(self, img: np.ndarray) -> np.ndarray:
        """Enhance edges in the image"""
        # Convert to grayscale
        if len(img.shape) == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img
        
        # Apply Laplacian filter
        laplacian = cv2.Laplacian(gray, cv2.CV_8U, ksize=3)
        
        # Convert back to 3 channel if original was 3 channel
        if len(img.shape) == 3:
            # Create edge mask
            edges = cv2.cvtColor(laplacian, cv2.COLOR_GRAY2BGR)
            
            # Blend with original image
            enhanced = cv2.addWeighted(img, 1.0, edges, 0.2, 0)
            return enhanced
        else:
            return cv2.addWeighted(gray, 1.0, laplacian, 0.2, 0)
    
    def upscale_image(self, 
                      img: np.ndarray, 
                      scale_factor: int = 4, 
                      material_type: Optional[str] = None,
                      enhance_output: bool = True) -> np.ndarray:
        """
        Upscale an image using ESRGAN
        
        Args:
            img: Input image as numpy array
            scale_factor: Upscaling factor (2 or 4)
            material_type: Type of material for specialized processing
            enhance_output: Whether to apply additional enhancements to output
            
        Returns:
            Upscaled image as numpy array
        """
        # Check if PyTorch is available
        if not TORCH_AVAILABLE or self.model is None:
            logger.info("Using fallback upscaling method")
            return self._fallback_upscale(img, scale_factor, material_type)
        
        # Validate scale factor
        if scale_factor not in [2, 4]:
            logger.warning(f"Unsupported scale factor: {scale_factor}. Using 4x.")
            scale_factor = 4
        
        try:
            # Choose appropriate model based on material type
            model = self._get_model_for_material(material_type)
            
            # Preprocess image
            input_tensor = self._preprocess_image(img, material_type)
            
            # Process with model
            with torch.no_grad():
                output = model(input_tensor)
            
            # Convert back to numpy array
            upscaled = self._postprocess_tensor(output, img)
            
            # Apply additional enhancements if requested
            if enhance_output:
                if material_type == "wood":
                    upscaled = self._enhance_texture_details(upscaled, strength=1.1)
                elif material_type == "metal":
                    upscaled = self._enhance_smoothness(upscaled, strength=1.1)
                elif material_type == "stone":
                    upscaled = self._enhance_texture_details(upscaled, strength=1.2)
                elif material_type == "fabric":
                    upscaled = self._enhance_texture_details(upscaled, strength=1.0)
            
            return upscaled
            
        except Exception as e:
            logger.error(f"Error during ESRGAN upscaling: {str(e)}")
            logger.info("Falling back to traditional upscaling")
            return self._fallback_upscale(img, scale_factor, material_type)

# Standalone function for easier usage without creating an instance
def upscale_image(img: np.ndarray, 
                 scale_factor: int = 4,
                 material_type: Optional[str] = None,
                 model_path: Optional[str] = None,
                 device: Optional[str] = None) -> np.ndarray:
    """
    Upscale an image using ESRGAN (standalone function)
    
    Args:
        img: Input image as numpy array
        scale_factor: Upscaling factor (2 or 4)
        material_type: Type of material for specialized processing
        model_path: Path to ESRGAN model file
        device: Device to use for processing ('cuda', 'cpu', or None for auto)
        
    Returns:
        Upscaled image as numpy array
    """
    processor = ESRGANProcessor(model_path=model_path, device=device)
    return processor.upscale_image(img, scale_factor, material_type)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="ESRGAN Super-Resolution for Material Textures")
    parser.add_argument("input", help="Input image path")
    parser.add_argument("--output", "-o", help="Output image path")
    parser.add_argument("--scale", "-s", type=int, default=4, choices=[2, 4], help="Upscaling factor")
    parser.add_argument("--material", "-m", choices=["wood", "metal", "fabric", "stone", "tile"], 
                        help="Material type for specialized processing")
    parser.add_argument("--model", help="Path to custom ESRGAN model")
    parser.add_argument("--device", choices=["cuda", "cpu"], help="Processing device")
    parser.add_argument("--no-enhance", action="store_true", help="Disable additional enhancements")
    
    args = parser.parse_args()
    
    # Load input image
    input_img = cv2.imread(args.input)
    if input_img is None:
        logger.error(f"Error: Could not load input image {args.input}")
        exit(1)
    
    # Determine output path if not specified
    if not args.output:
        base, ext = os.path.splitext(args.input)
        args.output = f"{base}_upscaled{ext}"
    
    # Create ESRGAN processor
    processor = ESRGANProcessor(model_path=args.model, device=args.device)
    
    # Process image
    upscaled = processor.upscale_image(
        input_img, 
        scale_factor=args.scale, 
        material_type=args.material,
        enhance_output=not args.no_enhance
    )
    
    # Save output
    cv2.imwrite(args.output, upscaled)
    
    logger.info(f"Upscaled image saved to {args.output}")
    
    # Print stats
    orig_h, orig_w = input_img.shape[:2]
    new_h, new_w = upscaled.shape[:2]
    logger.info(f"Original size: {orig_w}x{orig_h}, Upscaled size: {new_w}x{new_h}")