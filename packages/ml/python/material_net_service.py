import os
import sys
import time
import uuid
import json
import numpy as np
import torch
from torch.utils.data import DataLoader
from PIL import Image
import torchvision.transforms as transforms
from typing import Dict, List, Optional, Tuple, Union, Any
import logging
import io
import base64
from pathlib import Path
import cv2

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("MaterialNetService")

# Check if CUDA is available
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"Using device: {DEVICE}")

# Default paths
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")

# Create directories if they don't exist
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

# MaterialNet configuration
DEFAULT_CONFIG = {
    "model_type": "materialnet-1.0.0",
    "use_cache": True,
    "cache_ttl": 86400,  # 24 hours
    "batch_size": 1,
    "image_size": 512,
    "property_maps": ["albedo", "roughness", "metalness", "normal", "height", "ao"],
    "confidence_threshold": 0.7
}

class MaterialNetModel:
    """
    MaterialNet model for PBR property extraction from images
    """
    def __init__(self, model_path: Optional[str] = None, config: Optional[Dict] = None):
        self.config = DEFAULT_CONFIG.copy()
        if config:
            self.config.update(config)
        
        logger.info(f"Initializing MaterialNet with config: {self.config}")
        
        # Load model
        self.model_path = model_path or os.path.join(MODEL_DIR, f"{self.config['model_type']}.pt")
        self._load_model()
        
        # Setup preprocessing
        self.transform = transforms.Compose([
            transforms.Resize((self.config["image_size"], self.config["image_size"])),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        
        # Initialize cache
        self.cache = {}
        self.cache_ttl = self.config["cache_ttl"]
        
        logger.info("MaterialNet model initialized successfully")
    
    def _load_model(self):
        """Load the MaterialNet model"""
        try:
            if os.path.exists(self.model_path):
                logger.info(f"Loading model from {self.model_path}")
                self.model = torch.load(self.model_path, map_location=DEVICE)
                self.model.eval()
            else:
                logger.warning(f"Model file not found at {self.model_path}, downloading...")
                self._download_model()
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            # Create a simplified placeholder model for testing/development
            logger.warning("Using a placeholder model for development")
            self.model = self._create_placeholder_model()
    
    def _download_model(self):
        """Download the MaterialNet model"""
        # This would be implemented to download from a model repository
        # For now, create a placeholder
        logger.info("Placeholder for model download functionality")
        self.model = self._create_placeholder_model()
    
    def _create_placeholder_model(self):
        """Create a placeholder model for testing"""
        # This is a temporary solution for development without the real model
        class PlaceholderModel(torch.nn.Module):
            def __init__(self):
                super().__init__()
                self.backbone = torch.nn.Sequential(
                    torch.nn.Conv2d(3, 64, kernel_size=3, padding=1),
                    torch.nn.ReLU(),
                    torch.nn.MaxPool2d(2)
                )
                self.property_heads = torch.nn.ModuleDict({
                    "albedo": torch.nn.Sequential(
                        torch.nn.Conv2d(64, 3, kernel_size=3, padding=1),
                        torch.nn.Sigmoid()
                    ),
                    "roughness": torch.nn.Sequential(
                        torch.nn.Conv2d(64, 1, kernel_size=3, padding=1),
                        torch.nn.Sigmoid()
                    ),
                    "metalness": torch.nn.Sequential(
                        torch.nn.Conv2d(64, 1, kernel_size=3, padding=1),
                        torch.nn.Sigmoid()
                    ),
                    "normal": torch.nn.Sequential(
                        torch.nn.Conv2d(64, 3, kernel_size=3, padding=1),
                        torch.nn.Tanh()
                    ),
                    "height": torch.nn.Sequential(
                        torch.nn.Conv2d(64, 1, kernel_size=3, padding=1),
                        torch.nn.Sigmoid()
                    ),
                    "ao": torch.nn.Sequential(
                        torch.nn.Conv2d(64, 1, kernel_size=3, padding=1),
                        torch.nn.Sigmoid()
                    )
                })
                
            def forward(self, x):
                features = self.backbone(x)
                return {
                    prop: head(features) for prop, head in self.property_heads.items()
                }
        
        model = PlaceholderModel()
        model.to(DEVICE)
        model.eval()
        return model
    
    def _preprocess_image(self, image_path: str) -> torch.Tensor:
        """Preprocess an image for the model"""
        try:
            img = Image.open(image_path).convert("RGB")
            img_tensor = self.transform(img).unsqueeze(0).to(DEVICE)
            return img_tensor
        except Exception as e:
            logger.error(f"Error preprocessing image: {str(e)}")
            raise ValueError(f"Failed to preprocess image: {str(e)}")
    
    def _get_cache_key(self, image_path: str) -> str:
        """Generate a cache key for the image"""
        try:
            # Use file modification time and size as part of the key
            stats = os.stat(image_path)
            mtime = stats.st_mtime
            size = stats.st_size
            return f"{image_path}_{mtime}_{size}"
        except:
            # If stat fails, use just the path
            return image_path
    
    def _check_cache(self, image_path: str) -> Optional[Dict]:
        """Check if results are in cache and valid"""
        if not self.config["use_cache"]:
            return None
        
        cache_key = self._get_cache_key(image_path)
        if cache_key in self.cache:
            cache_entry = self.cache[cache_key]
            if time.time() - cache_entry["timestamp"] < self.cache_ttl:
                logger.info(f"Cache hit for {image_path}")
                return cache_entry["result"]
            else:
                logger.info(f"Cache expired for {image_path}")
                del self.cache[cache_key]
        
        return None
    
    def _update_cache(self, image_path: str, result: Dict):
        """Update the cache with new results"""
        if not self.config["use_cache"]:
            return
        
        cache_key = self._get_cache_key(image_path)
        self.cache[cache_key] = {
            "timestamp": time.time(),
            "result": result
        }
        logger.info(f"Updated cache for {image_path}")
    
    def _postprocess_maps(self, property_maps: Dict[str, torch.Tensor], size: Optional[Tuple[int, int]] = None) -> Dict[str, np.ndarray]:
        """Convert property tensors to numpy arrays and resize if needed"""
        processed_maps = {}
        
        for prop_name, prop_tensor in property_maps.items():
            # Convert to numpy and move to CPU if needed
            prop_map = prop_tensor.detach().cpu().numpy()[0]
            
            # Transpose from CHW to HWC format
            if prop_map.shape[0] in [1, 3]:
                prop_map = np.transpose(prop_map, (1, 2, 0))
            
            # Squeeze single-channel maps
            if prop_map.shape[-1] == 1:
                prop_map = np.squeeze(prop_map, -1)
            
            # Special handling for normal maps (normalize vectors)
            if prop_name == "normal":
                # Ensure normal vectors are normalized
                norm = np.sqrt(np.sum(prop_map * prop_map, axis=2, keepdims=True))
                prop_map = prop_map / (norm + 1e-10)
                
                # Convert from [-1,1] to [0,1] for storage
                prop_map = (prop_map + 1.0) * 0.5
            
            # Resize if needed
            if size and (prop_map.shape[0] != size[0] or prop_map.shape[1] != size[1]):
                if len(prop_map.shape) == 3:
                    # Multi-channel (like RGB)
                    prop_map = cv2.resize(prop_map, size, interpolation=cv2.INTER_LINEAR)
                else:
                    # Single channel
                    prop_map = cv2.resize(prop_map, size, interpolation=cv2.INTER_LINEAR)
            
            processed_maps[prop_name] = prop_map
        
        return processed_maps
    
    def _encode_property_maps(self, property_maps: Dict[str, np.ndarray]) -> Dict[str, Dict]:
        """Encode property maps for API response"""
        encoded_maps = {}
        
        for prop_name, prop_map in property_maps.items():
            # Scale values to 0-255 range
            if prop_map.dtype == np.float32 or prop_map.dtype == np.float64:
                prop_map = (prop_map * 255).astype(np.uint8)
            
            # Ensure RGB for color maps
            if prop_name == "albedo" and len(prop_map.shape) == 2:
                prop_map = cv2.cvtColor(prop_map, cv2.COLOR_GRAY2RGB)
            elif prop_name == "normal" and len(prop_map.shape) == 2:
                # For normal maps, create a default normal map pointing up
                h, w = prop_map.shape
                prop_map = np.zeros((h, w, 3), dtype=np.uint8)
                prop_map[:, :, 0] = 128  # X: 0
                prop_map[:, :, 1] = 128  # Y: 0
                prop_map[:, :, 2] = 255  # Z: 1
            
            # Encode as PNG
            success, buffer = cv2.imencode(".png", prop_map)
            if not success:
                logger.error(f"Failed to encode {prop_name} map")
                continue
            
            # Convert to base64
            img_base64 = base64.b64encode(buffer).decode("utf-8")
            
            # Calculate properties
            min_val = np.min(prop_map)
            max_val = np.max(prop_map)
            mean_val = np.mean(prop_map)
            
            encoded_maps[prop_name] = {
                "data": f"data:image/png;base64,{img_base64}",
                "width": prop_map.shape[1],
                "height": prop_map.shape[0],
                "channels": 1 if len(prop_map.shape) == 2 else prop_map.shape[2],
                "stats": {
                    "min": float(min_val),
                    "max": float(max_val),
                    "mean": float(mean_val)
                }
            }
        
        return encoded_maps
    
    def extract_properties(self, image_path: str, original_size: Optional[Tuple[int, int]] = None) -> Dict:
        """Extract PBR properties from an image"""
        # Check cache first
        cached_result = self._check_cache(image_path)
        if cached_result:
            return cached_result
        
        try:
            # Start timing
            start_time = time.time()
            
            # Get original image size if not provided
            if not original_size:
                with Image.open(image_path) as img:
                    original_size = img.size
            
            # Preprocess the image
            img_tensor = self._preprocess_image(image_path)
            
            # Run inference
            with torch.no_grad():
                property_maps = self.model(img_tensor)
            
            # Postprocess the outputs
            processed_maps = self._postprocess_maps(property_maps, original_size)
            
            # Encode for API response
            encoded_maps = self._encode_property_maps(processed_maps)
            
            # Create response
            result = {
                "success": True,
                "properties": encoded_maps,
                "metadata": {
                    "model": self.config["model_type"],
                    "processing_time": time.time() - start_time,
                    "original_size": original_size,
                    "confidence": 0.95,  # Placeholder
                }
            }
            
            # Update cache
            self._update_cache(image_path, result)
            
            return result
        
        except Exception as e:
            logger.error(f"Error extracting properties: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def extract_specific_property(self, image_path: str, property_name: str) -> Dict:
        """Extract a specific PBR property from an image"""
        if property_name not in self.config["property_maps"]:
            return {
                "success": False,
                "error": f"Unsupported property: {property_name}"
            }
        
        try:
            # Get full extraction
            full_result = self.extract_properties(image_path)
            if not full_result["success"]:
                return full_result
            
            # Return just the requested property
            return {
                "success": True,
                "property": {
                    property_name: full_result["properties"][property_name]
                },
                "metadata": full_result["metadata"]
            }
        
        except Exception as e:
            logger.error(f"Error extracting property {property_name}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_supported_properties(self) -> List[str]:
        """Return a list of supported PBR properties"""
        return self.config["property_maps"]
    
    def extract_material_summary(self, image_path: str) -> Dict:
        """Extract a summary of material properties"""
        try:
            # Get full extraction
            full_result = self.extract_properties(image_path)
            if not full_result["success"]:
                return full_result
            
            # Analyze properties to create a summary
            properties = full_result["properties"]
            
            # Extract average values for each property
            average_roughness = properties["roughness"]["stats"]["mean"] if "roughness" in properties else 0.5
            average_metalness = properties["metalness"]["stats"]["mean"] if "metalness" in properties else 0.0
            
            # Determine material type based on properties
            material_type = "unknown"
            material_attributes = []
            
            if average_metalness > 0.7:
                material_type = "metal"
                if average_roughness < 0.3:
                    material_attributes.append("polished")
                elif average_roughness < 0.7:
                    material_attributes.append("brushed")
                else:
                    material_attributes.append("rough")
            elif average_metalness > 0.4:
                material_type = "metallic composite"
            elif average_roughness < 0.3:
                material_type = "glass" if average_metalness < 0.1 else "ceramic"
                material_attributes.append("smooth")
            elif average_roughness < 0.5:
                material_type = "plastic" if average_metalness < 0.2 else "composite"
            else:
                # Analyze dominant color from albedo
                if "albedo" in properties:
                    # RGB values typically indicate the material type for non-metals
                    material_type = "organic"  # Default to organic materials like wood, leather, etc.
                    material_attributes.append("textured")
            
            summary = {
                "material_type": material_type,
                "attributes": material_attributes,
                "pbr_values": {
                    "roughness": float(average_roughness),
                    "metalness": float(average_metalness),
                }
            }
            
            return {
                "success": True,
                "summary": summary,
                "properties": properties,
                "metadata": full_result["metadata"]
            }
        
        except Exception as e:
            logger.error(f"Error extracting material summary: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }


# Initialize global model instance
_model_instance = None

def get_model_instance(config: Optional[Dict] = None) -> MaterialNetModel:
    """Get or create a MaterialNet model instance"""
    global _model_instance
    if _model_instance is None:
        _model_instance = MaterialNetModel(config=config)
    return _model_instance

# API Functions
def extract_pbr_properties(image_path: str, config: Optional[Dict] = None) -> Dict:
    """Extract PBR properties from an image"""
    model = get_model_instance(config)
    return model.extract_properties(image_path)

def extract_specific_property(image_path: str, property_name: str, config: Optional[Dict] = None) -> Dict:
    """Extract a specific PBR property from an image"""
    model = get_model_instance(config)
    return model.extract_specific_property(image_path, property_name)

def get_material_summary(image_path: str, config: Optional[Dict] = None) -> Dict:
    """Get a summary of material properties"""
    model = get_model_instance(config)
    return model.extract_material_summary(image_path)

def get_supported_properties(config: Optional[Dict] = None) -> List[str]:
    """Get a list of supported PBR properties"""
    model = get_model_instance(config)
    return model.get_supported_properties()

# Server endpoints will be implemented in a separate file

if __name__ == "__main__":
    # Example usage
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        if os.path.exists(image_path):
            result = extract_pbr_properties(image_path)
            print(json.dumps(result, indent=2))
        else:
            print(f"Image not found: {image_path}")
    else:
        print("Usage: python material_net_service.py <image_path>")