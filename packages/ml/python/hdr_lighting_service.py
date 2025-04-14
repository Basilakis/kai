import os
import sys
import time
import json
import logging
import numpy as np
from PIL import Image
import torch
from io import BytesIO
import base64
from typing import Dict, Any, List, Tuple, Optional, Union
import requests
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Check if HDRNet is available
try:
    import hdrnet_pytorch
    HDRNET_AVAILABLE = True
    logger.info("HDRNet library found and imported successfully")
except ImportError:
    HDRNET_AVAILABLE = False
    logger.warning("HDRNet library not found. Using fallback options for lighting estimation.")

# Check if EnvMapNet is available
try:
    import envmapnet
    ENVMAPNET_AVAILABLE = True
    logger.info("EnvMapNet library found and imported successfully")
except ImportError:
    ENVMAPNET_AVAILABLE = False
    logger.warning("EnvMapNet library not found. Using HDRNet only for environment map generation.")

# Default paths for saved models
DEFAULT_HDRNET_MODEL_PATH = os.environ.get("HDRNET_MODEL_PATH", "./models/hdrnet_model.pth")
DEFAULT_ENVMAPNET_MODEL_PATH = os.environ.get("ENVMAPNET_MODEL_PATH", "./models/envmapnet_model.pth")

# Cache directory for environment maps
CACHE_DIR = os.environ.get("HDR_CACHE_DIR", "./cache/env_maps")
os.makedirs(CACHE_DIR, exist_ok=True)

# Default environment maps by category
DEFAULT_ENV_MAPS = {
    "neutral": "./assets/env/neutral_studio.hdr",
    "indoor": "./assets/env/interior_dim.hdr",
    "outdoor": "./assets/env/outdoor_sunny.hdr",
    "studio": "./assets/env/photo_studio.hdr",
}


class HDRLightingService:
    """Service for HDR environment map generation and lighting estimation."""

    def __init__(self, hdrnet_model_path: str = None, envmapnet_model_path: str = None):
        """Initialize the HDR lighting service with optional model paths."""
        self.hdrnet_model_path = hdrnet_model_path or DEFAULT_HDRNET_MODEL_PATH
        self.envmapnet_model_path = envmapnet_model_path or DEFAULT_ENVMAPNET_MODEL_PATH
        self.hdrnet_model = None
        self.envmapnet_model = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.cache = {}
        
        # Load HDRNet model if available
        if HDRNET_AVAILABLE:
            try:
                self._load_hdrnet_model()
                logger.info(f"HDRNet model loaded from {self.hdrnet_model_path}")
            except Exception as e:
                logger.error(f"Failed to load HDRNet model: {str(e)}")
        
        # Load EnvMapNet model if available
        if ENVMAPNET_AVAILABLE:
            try:
                self._load_envmapnet_model()
                logger.info(f"EnvMapNet model loaded from {self.envmapnet_model_path}")
            except Exception as e:
                logger.error(f"Failed to load EnvMapNet model: {str(e)}")

    def _load_hdrnet_model(self):
        """Load the HDRNet model for lighting inference."""
        if os.path.exists(self.hdrnet_model_path):
            self.hdrnet_model = hdrnet_pytorch.HDRNetModel()
            state_dict = torch.load(self.hdrnet_model_path, map_location=self.device)
            self.hdrnet_model.load_state_dict(state_dict)
            self.hdrnet_model.to(self.device)
            self.hdrnet_model.eval()
        else:
            logger.warning(f"HDRNet model not found at {self.hdrnet_model_path}")

    def _load_envmapnet_model(self):
        """Load the EnvMapNet model for environment map generation."""
        if os.path.exists(self.envmapnet_model_path):
            self.envmapnet_model = envmapnet.EnvMapNetModel()
            state_dict = torch.load(self.envmapnet_model_path, map_location=self.device)
            self.envmapnet_model.load_state_dict(state_dict)
            self.envmapnet_model.to(self.device)
            self.envmapnet_model.eval()
        else:
            logger.warning(f"EnvMapNet model not found at {self.envmapnet_model_path}")

    async def generate_environment_map(self, 
                                 image_url: str, 
                                 quality: str = 'medium',
                                 intensity: float = 1.0,
                                 rotation: float = 0.0,
                                 tone_mapping: str = 'aces') -> Dict[str, Any]:
        """
        Generate an HDR environment map from a source image.
        
        Args:
            image_url: URL of the source image
            quality: Quality level ('low', 'medium', 'high')
            intensity: Lighting intensity multiplier
            rotation: Rotation of the environment map in degrees
            tone_mapping: Tone mapping operator ('linear', 'reinhard', 'aces', 'cineon')
            
        Returns:
            Dictionary with environment map URL and metadata
        """
        # Generate cache key
        cache_key = f"{image_url}_{quality}_{intensity}_{rotation}_{tone_mapping}"
        
        # Check cache
        if cache_key in self.cache:
            logger.info(f"Using cached environment map for {cache_key}")
            return self.cache[cache_key]
        
        try:
            # Download image
            image = await self._download_image(image_url)
            if image is None:
                logger.error(f"Failed to download image from {image_url}")
                return self._get_default_env_map(quality, "neutral")
            
            # Process the image to generate the environment map
            if ENVMAPNET_AVAILABLE and self.envmapnet_model:
                env_map, light_info = await self._generate_with_envmapnet(
                    image, quality, intensity, rotation, tone_mapping
                )
            elif HDRNET_AVAILABLE and self.hdrnet_model:
                env_map, light_info = await self._generate_with_hdrnet(
                    image, quality, intensity, rotation, tone_mapping
                )
            else:
                logger.warning("No HDR generation models available, using default environment")
                return self._get_default_env_map(quality, "neutral")
            
            # Save the environment map
            env_map_url = self._save_environment_map(env_map, image_url, quality)
            
            # Create result
            result = {
                "env_map_url": env_map_url,
                "light_estimation": light_info,
                "metadata": {
                    "source_image": image_url,
                    "quality": quality,
                    "intensity": intensity,
                    "rotation": rotation,
                    "tone_mapping": tone_mapping,
                    "timestamp": time.time()
                }
            }
            
            # Cache the result
            self.cache[cache_key] = result
            
            return result
        except Exception as e:
            logger.error(f"Error generating environment map: {str(e)}")
            return self._get_default_env_map(quality, "neutral")

    async def _generate_with_envmapnet(self, 
                                 image: Image.Image, 
                                 quality: str,
                                 intensity: float,
                                 rotation: float,
                                 tone_mapping: str) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Generate environment map using EnvMapNet."""
        # Preprocess image
        img_tensor = self._preprocess_image(image, quality)
        
        # Generate environment map
        with torch.no_grad():
            env_map_tensor = self.envmapnet_model(img_tensor)
            
        # Extract lighting information
        light_info = self._extract_lighting_from_env_map(env_map_tensor)
        
        # Apply intensity and rotation
        env_map_tensor = self._apply_env_map_adjustments(env_map_tensor, intensity, rotation)
        
        # Convert to numpy
        env_map = env_map_tensor[0].cpu().numpy()
        
        return env_map, light_info

    async def _generate_with_hdrnet(self, 
                              image: Image.Image, 
                              quality: str,
                              intensity: float,
                              rotation: float,
                              tone_mapping: str) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Generate environment map using HDRNet."""
        # Preprocess image
        img_tensor = self._preprocess_image(image, quality)
        
        # Generate illumination prediction
        with torch.no_grad():
            illumination = self.hdrnet_model(img_tensor)
            
        # Convert illumination to environment map
        env_map = self._illumination_to_env_map(illumination[0].cpu().numpy(), quality)
        
        # Extract lighting information
        light_info = self._extract_lighting_from_illumination(illumination)
        
        # Apply intensity and rotation
        env_map = self._apply_adjustments(env_map, intensity, rotation)
        
        return env_map, light_info

    def _preprocess_image(self, image: Image.Image, quality: str) -> torch.Tensor:
        """Preprocess image for model input."""
        # Determine target size based on quality
        if quality == 'high':
            size = (512, 512)
        elif quality == 'medium':
            size = (256, 256)
        else:
            size = (128, 128)
            
        # Resize and convert to tensor
        image = image.resize(size, Image.Resampling.LANCZOS)
        img_np = np.array(image).astype(np.float32) / 255.0
        img_tensor = torch.from_numpy(img_np).permute(2, 0, 1).unsqueeze(0)
        img_tensor = img_tensor.to(self.device)
        
        return img_tensor

    def _illumination_to_env_map(self, illumination: np.ndarray, quality: str) -> np.ndarray:
        """Convert illumination prediction to environment map."""
        # Simplified conversion for demonstration
        # In a real implementation, this would use proper conversion methods
        
        # Determine environment map size based on quality
        if quality == 'high':
            size = (1024, 512)
        elif quality == 'medium':
            size = (512, 256)
        else:
            size = (256, 128)
            
        # Create a simple environment map (this is a placeholder)
        # In a real implementation, this would properly project the illumination
        env_map = np.zeros((size[1], size[0], 3), dtype=np.float32)
        
        # For demonstration, just use the illumination as dominant light
        # In a real implementation, this would use proper IBL techniques
        env_map[:] = illumination.reshape(-1, 3)[:1]
        
        return env_map

    def _extract_lighting_from_illumination(self, illumination: torch.Tensor) -> Dict[str, Any]:
        """Extract lighting information from illumination prediction."""
        # Convert to numpy
        illum_np = illumination[0].cpu().numpy()
        
        # Get dominant light direction and color
        dominant_color = illum_np.reshape(-1, 3)[:1][0]
        
        # Return lighting information
        return {
            "dominant": [
                {
                    "color": dominant_color.tolist(),
                    "intensity": float(np.mean(dominant_color)),
                    "direction": [0.0, 1.0, 0.0]  # Default direction (upward)
                }
            ],
            "ambient": {
                "color": [0.5, 0.5, 0.6],
                "intensity": 0.2
            }
        }

    def _extract_lighting_from_env_map(self, env_map: torch.Tensor) -> Dict[str, Any]:
        """Extract lighting information from environment map."""
        # Convert to numpy
        env_map_np = env_map[0].cpu().numpy()
        
        # Find brightest areas (simplified)
        flat_map = env_map_np.reshape(-1, 3)
        brightnesses = np.mean(flat_map, axis=1)
        
        # Get top 3 brightest points
        top_indices = np.argsort(brightnesses)[-3:]
        
        # Create lighting information
        dominant_lights = []
        for idx in top_indices:
            color = flat_map[idx]
            dominant_lights.append({
                "color": color.tolist(),
                "intensity": float(brightnesses[idx]),
                # Simplified direction calculation
                "direction": [
                    np.sin(idx / flat_map.shape[0] * np.pi * 2),
                    np.cos(idx / flat_map.shape[0] * np.pi * 2),
                    0.0
                ]
            })
        
        # Calculate ambient light as average of non-bright areas
        ambient_mask = np.ones(brightnesses.shape, dtype=bool)
        ambient_mask[top_indices] = False
        ambient_color = np.mean(flat_map[ambient_mask], axis=0)
        
        return {
            "dominant": dominant_lights,
            "ambient": {
                "color": ambient_color.tolist(),
                "intensity": float(np.mean(ambient_color) * 0.5)
            }
        }

    def _apply_env_map_adjustments(self, env_map: torch.Tensor, intensity: float, rotation: float) -> torch.Tensor:
        """Apply intensity and rotation adjustments to environment map tensor."""
        # Apply intensity
        env_map = env_map * intensity
        
        # Apply rotation (simplified)
        if rotation != 0:
            # Convert rotation to radians
            rot_rad = rotation * np.pi / 180.0
            
            # Get dimensions
            _, c, h, w = env_map.shape
            
            # Calculate rotation in pixels
            rotation_px = int(w * rot_rad / (2 * np.pi))
            
            # Rotate by shifting
            if rotation_px != 0:
                env_map = torch.roll(env_map, shifts=rotation_px, dims=3)
        
        return env_map

    def _apply_adjustments(self, env_map: np.ndarray, intensity: float, rotation: float) -> np.ndarray:
        """Apply intensity and rotation adjustments to environment map array."""
        # Apply intensity
        env_map = env_map * intensity
        
        # Apply rotation (simplified)
        if rotation != 0:
            # Convert rotation to radians
            rot_rad = rotation * np.pi / 180.0
            
            # Calculate rotation in pixels
            rotation_px = int(env_map.shape[1] * rot_rad / (2 * np.pi))
            
            # Rotate by shifting
            if rotation_px != 0:
                env_map = np.roll(env_map, shift=rotation_px, axis=1)
        
        return env_map

    def _save_environment_map(self, env_map: np.ndarray, image_url: str, quality: str) -> str:
        """Save environment map to file and return URL."""
        # Create filename based on image URL and quality
        url_hash = hash(image_url) % 10000
        filename = f"env_map_{url_hash}_{quality}.hdr"
        filepath = os.path.join(CACHE_DIR, filename)
        
        # Save as HDR file (simplified)
        # In a real implementation, this would use proper HDR file format
        np.save(filepath, env_map)
        
        # Return URL
        return f"/api/env_maps/{filename}"

    async def _download_image(self, url: str) -> Optional[Image.Image]:
        """Download image from URL."""
        try:
            # Check if URL is local or remote
            if url.startswith(('http://', 'https://')):
                response = requests.get(url, timeout=10)
                response.raise_for_status()
                return Image.open(BytesIO(response.content))
            else:
                # Local file path
                return Image.open(url)
        except Exception as e:
            logger.error(f"Failed to download or open image: {str(e)}")
            return None

    def _get_default_env_map(self, quality: str, type_name: str = "neutral") -> Dict[str, Any]:
        """Get default environment map if generation fails."""
        env_map_path = DEFAULT_ENV_MAPS.get(type_name, DEFAULT_ENV_MAPS["neutral"])
        
        return {
            "env_map_url": env_map_path,
            "light_estimation": {
                "dominant": [
                    {
                        "color": [1.0, 1.0, 1.0],
                        "intensity": 0.8,
                        "direction": [0.0, 1.0, 0.0]
                    }
                ],
                "ambient": {
                    "color": [0.5, 0.5, 0.6],
                    "intensity": 0.2
                }
            },
            "metadata": {
                "source": "default",
                "quality": quality,
                "timestamp": time.time()
            }
        }

    async def extract_lighting(self, image_url: str) -> Dict[str, Any]:
        """
        Extract lighting information from an image.
        
        Args:
            image_url: URL of the image
            
        Returns:
            Dictionary with dominant lights and ambient light information
        """
        try:
            # Download image
            image = await self._download_image(image_url)
            if image is None:
                logger.error(f"Failed to download image from {image_url}")
                return self._get_default_lighting()
            
            # Process the image to extract lighting
            if HDRNET_AVAILABLE and self.hdrnet_model:
                # Preprocess image
                img_tensor = self._preprocess_image(image, 'medium')
                
                # Generate illumination prediction
                with torch.no_grad():
                    illumination = self.hdrnet_model(img_tensor)
                
                # Extract lighting information
                lighting = self._extract_lighting_from_illumination(illumination)
                return lighting
            else:
                logger.warning("HDRNet model not available, using default lighting")
                return self._get_default_lighting()
        except Exception as e:
            logger.error(f"Error extracting lighting: {str(e)}")
            return self._get_default_lighting()

    def _get_default_lighting(self) -> Dict[str, Any]:
        """Get default lighting if extraction fails."""
        return {
            "dominantLights": [
                {
                    "color": [1.0, 1.0, 1.0],
                    "intensity": 0.8,
                    "direction": [0.0, 1.0, 0.0]
                }
            ],
            "ambientLight": {
                "color": [0.5, 0.5, 0.6],
                "intensity": 0.2
            }
        }

# Create singleton instance
hdr_lighting_service = HDRLightingService()

# API routes for FastAPI
async def setup_routes(app):
    """Set up FastAPI routes for the HDR lighting service."""
    from fastapi import FastAPI, HTTPException, Form, File, UploadFile
    
    @app.post("/hdrnet/generate")
    async def generate_env_map_endpoint(
        image_url: str = Form(...),
        quality: str = Form("medium"),
        intensity: float = Form(1.0),
        rotation: float = Form(0.0),
        tone_mapping: str = Form("aces")
    ):
        """Generate environment map endpoint."""
        if quality not in ["low", "medium", "high"]:
            raise HTTPException(status_code=400, detail="Quality must be 'low', 'medium', or 'high'")
        
        if tone_mapping not in ["linear", "reinhard", "aces", "cineon"]:
            raise HTTPException(status_code=400, detail="Tone mapping must be 'linear', 'reinhard', 'aces', or 'cineon'")
        
        result = await hdr_lighting_service.generate_environment_map(
            image_url=image_url,
            quality=quality,
            intensity=intensity,
            rotation=rotation,
            tone_mapping=tone_mapping
        )
        
        return result
    
    @app.post("/hdrnet/extract_lighting")
    async def extract_lighting_endpoint(request_data: dict):
        """Extract lighting information endpoint."""
        if "image_url" not in request_data:
            raise HTTPException(status_code=400, detail="'image_url' is required")
        
        result = await hdr_lighting_service.extract_lighting(
            image_url=request_data["image_url"]
        )
        
        return result
    
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        health_status = {
            "status": "ok",
            "hdrnet_available": HDRNET_AVAILABLE,
            "envmapnet_available": ENVMAPNET_AVAILABLE,
            "device": str(hdr_lighting_service.device)
        }
        return health_status


# Used for standalone testing
if __name__ == "__main__":
    import uvicorn
    from fastapi import FastAPI
    
    app = FastAPI(title="HDR Lighting Service")
    
    @app.on_event("startup")
    async def startup_event():
        await setup_routes(app)
    
    uvicorn.run(app, host="0.0.0.0", port=8000)