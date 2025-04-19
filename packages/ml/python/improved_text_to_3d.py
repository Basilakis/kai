"""
Improved Text to 3D Generation

This module provides enhanced 3D model generation from text descriptions using newer
models that outperform the previous stack (Stable Diffusion + Shap-E + GET3D):

1. Triposr: For single-view reconstruction with high fidelity and speed
2. Wonder3D: For high-quality 3D assets from single images with excellent texture detail
3. Instant3D: For detailed 3D models from text with higher geometric accuracy

The module maintains the physics validation system from the original implementation
but provides higher quality outputs with a more unified approach.

Dependencies:
- torch>=2.0.0
- transformers>=4.30.0
- diffusers>=0.20.0
- triposr>=0.2.0
- instant3d>=0.1.0
- wonder3d>=0.1.0
- trimesh>=3.20.0
- numpy>=1.24.0
- open3d>=0.17.0
"""

import os
import sys
import json
import time
import tempfile
import shutil
import logging
from typing import Dict, List, Optional, Tuple, Union, Any
from dataclasses import dataclass, field
import numpy as np
from PIL import Image
import torch

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import dependencies with graceful error handling
try:
    import triposr
    HAS_TRIPOSR = True
except ImportError:
    logger.warning("Triposr not available. Will fall back to alternative models.")
    HAS_TRIPOSR = False

try:
    import wonder3d
    HAS_WONDER3D = True
except ImportError:
    logger.warning("Wonder3D not available. Will fall back to alternative models.")
    HAS_WONDER3D = False

try:
    import instant3d
    HAS_INSTANT3D = True
except ImportError:
    logger.warning("Instant3D not available. Will fall back to alternative models.")
    HAS_INSTANT3D = False

@dataclass
class ImprovedTextTo3DConfig:
    """Configuration for improved text to 3D pipeline"""
    # General configuration
    device: str = "cuda" if torch.cuda.is_available() else "cpu"
    output_dir: str = "output/text_to_3d"
    cache_dir: str = ".cache/text_to_3d"
    
    # Model selection
    preferred_model: str = "auto"  # 'auto', 'triposr', 'wonder3d', 'instant3d'
    
    # Triposr configuration
    triposr_variant: str = "triposr-v1-HD"
    triposr_guidance_scale: float = 7.5
    triposr_num_inference_steps: int = 50
    
    # Wonder3D configuration
    wonder3d_variant: str = "wonder3d-v1.0"
    wonder3d_guidance_scale: float = 8.0
    wonder3d_num_inference_steps: int = 30
    
    # Instant3D configuration
    instant3d_variant: str = "instant3d-v1.1"
    instant3d_guidance_scale: float = 9.0
    instant3d_num_inference_steps: int = 50
    
    # Texture parameters
    texture_resolution: int = 2048
    use_pbr_materials: bool = True
    
    # Mesh parameters
    mesh_resolution: int = 512
    simplify_mesh: bool = True
    target_faces: int = 50000
    
    # Physics validation
    physics_enabled: bool = True
    physics_steps: int = 100
    collision_margin: float = 0.01
    
    # Export formats
    export_formats: List[str] = field(default_factory=lambda: ["obj", "glb", "gltf", "usdz"])
    
    # Category mapping for specialized models
    category_model_mapping: Dict[str, str] = field(default_factory=lambda: {
        "furniture": "triposr",
        "character": "wonder3d",
        "vehicle": "wonder3d",
        "building": "instant3d",
        "household": "triposr",
        "abstract": "instant3d"
    })


class TriposrModel:
    """Triposr model for high-quality single-view reconstruction"""
    
    def __init__(self, config: ImprovedTextTo3DConfig):
        self.config = config
        self.device = torch.device(config.device)
        self.model = None
        self._initialized = False
        
    async def initialize(self):
        """Initialize the Triposr model"""
        if self._initialized:
            return
        
        if not HAS_TRIPOSR:
            raise ImportError("Triposr is not available. Please install it with 'pip install triposr'.")
            
        logger.info("Initializing Triposr model")
        
        try:
            from triposr import TriposrPipeline
            
            # Load model and move to device
            self.model = TriposrPipeline.from_pretrained(
                self.config.triposr_variant,
                torch_dtype=torch.float16 if "cuda" in self.config.device else torch.float32,
                cache_dir=self.config.cache_dir
            ).to(self.device)
            
            self._initialized = True
            logger.info("Triposr model initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Triposr model: {e}")
            raise RuntimeError(f"Triposr initialization failed: {e}")
    
    async def generate_from_text(self, prompt: str) -> Dict[str, Any]:
        """Generate a 3D model from a text prompt using Triposr"""
        if not self._initialized:
            await self.initialize()
            
        logger.info(f"Generating 3D model from prompt using Triposr: '{prompt}'")
        
        try:
            # Generate an intermediate image first
            text_to_image_model = self.model.text_to_image_pipe
            with torch.no_grad():
                image = text_to_image_model(
                    prompt=prompt,
                    guidance_scale=self.config.triposr_guidance_scale,
                    num_inference_steps=self.config.triposr_num_inference_steps,
                ).images[0]
            
            # Generate 3D model from the image
            with torch.no_grad():
                result = self.model(
                    image=image,
                    prompt=prompt,
                    mesh_resolution=self.config.mesh_resolution
                )
            
            # Extract mesh data
            vertices = result.vertices
            faces = result.faces
            uvs = result.uvs
            texture = result.texture
            normals = self._compute_vertex_normals(vertices, faces)
            
            # Normalize mesh to unit size
            vertices = self._normalize_mesh(vertices)
            
            # Create result dictionary
            model_data = {
                "geometry": {
                    "vertices": vertices.cpu().numpy() if isinstance(vertices, torch.Tensor) else vertices,
                    "faces": faces.cpu().numpy() if isinstance(faces, torch.Tensor) else faces,
                    "normals": normals.cpu().numpy() if isinstance(normals, torch.Tensor) else normals,
                    "uvs": uvs.cpu().numpy() if isinstance(uvs, torch.Tensor) else uvs,
                    "texture": texture.cpu().numpy() if isinstance(texture, torch.Tensor) else texture
                },
                "metadata": {
                    "prompt": prompt,
                    "model": "triposr",
                    "variant": self.config.triposr_variant,
                    "guidance_scale": self.config.triposr_guidance_scale,
                    "inference_steps": self.config.triposr_num_inference_steps,
                    "mesh_resolution": self.config.mesh_resolution,
                    "timestamp": time.time()
                }
            }
            
            logger.info(f"Triposr model generation complete with {len(vertices)} vertices, {len(faces)} faces")
            return model_data
            
        except Exception as e:
            logger.error(f"Error generating 3D model with Triposr: {e}")
            raise RuntimeError(f"Triposr generation failed: {e}")
    
    async def generate_from_image(self, image_path: str, prompt: Optional[str] = None) -> Dict[str, Any]:
        """Generate a 3D model from an image using Triposr"""
        if not self._initialized:
            await self.initialize()
            
        logger.info(f"Generating 3D model from image using Triposr: '{image_path}'")
        
        try:
            # Load image
            image = Image.open(image_path).convert("RGB")
            
            # Generate 3D model from the image
            with torch.no_grad():
                result = self.model(
                    image=image,
                    prompt=prompt,
                    mesh_resolution=self.config.mesh_resolution
                )
            
            # Extract mesh data
            vertices = result.vertices
            faces = result.faces
            uvs = result.uvs
            texture = result.texture
            normals = self._compute_vertex_normals(vertices, faces)
            
            # Normalize mesh to unit size
            vertices = self._normalize_mesh(vertices)
            
            # Create result dictionary
            model_data = {
                "geometry": {
                    "vertices": vertices.cpu().numpy() if isinstance(vertices, torch.Tensor) else vertices,
                    "faces": faces.cpu().numpy() if isinstance(faces, torch.Tensor) else faces,
                    "normals": normals.cpu().numpy() if isinstance(normals, torch.Tensor) else normals,
                    "uvs": uvs.cpu().numpy() if isinstance(uvs, torch.Tensor) else uvs,
                    "texture": texture.cpu().numpy() if isinstance(texture, torch.Tensor) else texture
                },
                "metadata": {
                    "source_image": image_path,
                    "prompt": prompt,
                    "model": "triposr",
                    "variant": self.config.triposr_variant,
                    "mesh_resolution": self.config.mesh_resolution,
                    "timestamp": time.time()
                }
            }
            
            logger.info(f"Triposr image-based generation complete with {len(vertices)} vertices, {len(faces)} faces")
            return model_data
            
        except Exception as e:
            logger.error(f"Error generating 3D model from image with Triposr: {e}")
            raise RuntimeError(f"Triposr image-based generation failed: {e}")
    
    def _normalize_mesh(self, vertices: Union[torch.Tensor, np.ndarray]) -> Union[torch.Tensor, np.ndarray]:
        """Normalize mesh to fit in a unit cube centered at origin"""
        if isinstance(vertices, np.ndarray):
            vertices = torch.tensor(vertices)
            
        # Calculate bounding box
        min_vals, _ = torch.min(vertices, dim=0)
        max_vals, _ = torch.max(vertices, dim=0)
        
        # Calculate center and scale
        center = (min_vals + max_vals) / 2
        scale = torch.max(max_vals - min_vals) / 2
        
        # Normalize vertices
        normalized_vertices = (vertices - center) / (scale + 1e-6)
        
        return normalized_vertices
    
    def _compute_vertex_normals(self, 
                              vertices: Union[torch.Tensor, np.ndarray], 
                              faces: Union[torch.Tensor, np.ndarray]) -> torch.Tensor:
        """Compute vertex normals for the mesh"""
        if isinstance(vertices, np.ndarray):
            vertices = torch.tensor(vertices, device=self.device)
            
        if isinstance(faces, np.ndarray):
            faces = torch.tensor(faces, device=self.device)
            
        # Initialize normals
        normals = torch.zeros_like(vertices)
        
        # Compute face normals and accumulate on vertices
        for face_idx in range(faces.shape[0]):
            # Get face vertices
            face = faces[face_idx]
            v0 = vertices[face[0]]
            v1 = vertices[face[1]]
            v2 = vertices[face[2]]
            
            # Compute face normal
            normal = torch.cross(v1 - v0, v2 - v0)
            
            # Accumulate on vertices
            normals[face[0]] += normal
            normals[face[1]] += normal
            normals[face[2]] += normal
            
        # Normalize
        norms = torch.norm(normals, dim=1, keepdim=True)
        mask = norms > 1e-6
        normals[mask] = normals[mask] / norms[mask]
        
        return normals


class Wonder3DModel:
    """Wonder3D model for high-quality 3D assets with excellent texture detail"""
    
    def __init__(self, config: ImprovedTextTo3DConfig):
        self.config = config
        self.device = torch.device(config.device)
        self.model = None
        self._initialized = False
        
    async def initialize(self):
        """Initialize the Wonder3D model"""
        if self._initialized:
            return
        
        if not HAS_WONDER3D:
            raise ImportError("Wonder3D is not available. Please install it with 'pip install wonder3d'.")
            
        logger.info("Initializing Wonder3D model")
        
        try:
            from wonder3d import Wonder3DPipeline
            
            # Load model and move to device
            self.model = Wonder3DPipeline.from_pretrained(
                self.config.wonder3d_variant,
                torch_dtype=torch.float16 if "cuda" in self.config.device else torch.float32,
                cache_dir=self.config.cache_dir
            ).to(self.device)
            
            self._initialized = True
            logger.info("Wonder3D model initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Wonder3D model: {e}")
            raise RuntimeError(f"Wonder3D initialization failed: {e}")
    
    async def generate_from_text(self, prompt: str) -> Dict[str, Any]:
        """Generate a 3D model from a text prompt using Wonder3D"""
        if not self._initialized:
            await self.initialize()
            
        logger.info(f"Generating 3D model from prompt using Wonder3D: '{prompt}'")
        
        try:
            # Generate an intermediate image first
            text_to_image_model = self.model.text_to_image_pipeline
            with torch.no_grad():
                image = text_to_image_model(
                    prompt=prompt,
                    guidance_scale=self.config.wonder3d_guidance_scale,
                    num_inference_steps=self.config.wonder3d_num_inference_steps,
                ).images[0]
            
            # Generate multi-view images with detailed textures
            with torch.no_grad():
                multiview_result = self.model.generate_multiview(
                    image=image,
                    prompt=prompt,
                    num_views=8
                )
            
            # Generate 3D model from multi-view images
            with torch.no_grad():
                result = self.model.generate_mesh(
                    multiview_images=multiview_result.images,
                    prompt=prompt,
                    resolution=self.config.mesh_resolution,
                    texture_resolution=self.config.texture_resolution
                )
            
            # Extract mesh data
            vertices = result.vertices
            faces = result.faces
            uvs = result.uvs
            texture = result.texture
            normals = result.normals if hasattr(result, "normals") else self._compute_vertex_normals(vertices, faces)
            
            # Normalize mesh to unit size
            vertices = self._normalize_mesh(vertices)
            
            # Create result dictionary
            model_data = {
                "geometry": {
                    "vertices": vertices.cpu().numpy() if isinstance(vertices, torch.Tensor) else vertices,
                    "faces": faces.cpu().numpy() if isinstance(faces, torch.Tensor) else faces,
                    "normals": normals.cpu().numpy() if isinstance(normals, torch.Tensor) else normals,
                    "uvs": uvs.cpu().numpy() if isinstance(uvs, torch.Tensor) else uvs,
                    "texture": texture.cpu().numpy() if isinstance(texture, torch.Tensor) else texture
                },
                "metadata": {
                    "prompt": prompt,
                    "model": "wonder3d",
                    "variant": self.config.wonder3d_variant,
                    "guidance_scale": self.config.wonder3d_guidance_scale,
                    "inference_steps": self.config.wonder3d_num_inference_steps,
                    "mesh_resolution": self.config.mesh_resolution,
                    "texture_resolution": self.config.texture_resolution,
                    "timestamp": time.time()
                }
            }
            
            logger.info(f"Wonder3D model generation complete with {len(vertices)} vertices, {len(faces)} faces")
            return model_data
            
        except Exception as e:
            logger.error(f"Error generating 3D model with Wonder3D: {e}")
            raise RuntimeError(f"Wonder3D generation failed: {e}")
    
    async def generate_from_image(self, image_path: str, prompt: Optional[str] = None) -> Dict[str, Any]:
        """Generate a 3D model from an image using Wonder3D"""
        if not self._initialized:
            await self.initialize()
            
        logger.info(f"Generating 3D model from image using Wonder3D: '{image_path}'")
        
        try:
            # Load image
            image = Image.open(image_path).convert("RGB")
            
            # Generate multi-view images with detailed textures
            with torch.no_grad():
                multiview_result = self.model.generate_multiview(
                    image=image,
                    prompt=prompt,
                    num_views=8
                )
            
            # Generate 3D model from multi-view images
            with torch.no_grad():
                result = self.model.generate_mesh(
                    multiview_images=multiview_result.images,
                    prompt=prompt,
                    resolution=self.config.mesh_resolution,
                    texture_resolution=self.config.texture_resolution
                )
            
            # Extract mesh data
            vertices = result.vertices
            faces = result.faces
            uvs = result.uvs
            texture = result.texture
            normals = result.normals if hasattr(result, "normals") else self._compute_vertex_normals(vertices, faces)
            
            # Normalize mesh to unit size
            vertices = self._normalize_mesh(vertices)
            
            # Create result dictionary
            model_data = {
                "geometry": {
                    "vertices": vertices.cpu().numpy() if isinstance(vertices, torch.Tensor) else vertices,
                    "faces": faces.cpu().numpy() if isinstance(faces, torch.Tensor) else faces,
                    "normals": normals.cpu().numpy() if isinstance(normals, torch.Tensor) else normals,
                    "uvs": uvs.cpu().numpy() if isinstance(uvs, torch.Tensor) else uvs,
                    "texture": texture.cpu().numpy() if isinstance(texture, torch.Tensor) else texture
                },
                "metadata": {
                    "source_image": image_path,
                    "prompt": prompt,
                    "model": "wonder3d",
                    "variant": self.config.wonder3d_variant,
                    "mesh_resolution": self.config.mesh_resolution,
                    "texture_resolution": self.config.texture_resolution,
                    "timestamp": time.time()
                }
            }
            
            logger.info(f"Wonder3D image-based generation complete with {len(vertices)} vertices, {len(faces)} faces")
            return model_data
            
        except Exception as e:
            logger.error(f"Error generating 3D model from image with Wonder3D: {e}")
            raise RuntimeError(f"Wonder3D image-based generation failed: {e}")
    
    def _normalize_mesh(self, vertices: Union[torch.Tensor, np.ndarray]) -> Union[torch.Tensor, np.ndarray]:
        """Normalize mesh to fit in a unit cube centered at origin"""
        if isinstance(vertices, np.ndarray):
            vertices = torch.tensor(vertices)
            
        # Calculate bounding box
        min_vals, _ = torch.min(vertices, dim=0)
        max_vals, _ = torch.max(vertices, dim=0)
        
        # Calculate center and scale
        center = (min_vals + max_vals) / 2
        scale = torch.max(max_vals - min_vals) / 2
        
        # Normalize vertices
        normalized_vertices = (vertices - center) / (scale + 1e-6)
        
        return normalized_vertices
    
    def _compute_vertex_normals(self, 
                              vertices: Union[torch.Tensor, np.ndarray], 
                              faces: Union[torch.Tensor, np.ndarray]) -> torch.Tensor:
        """Compute vertex normals for the mesh"""
        if isinstance(vertices, np.ndarray):
            vertices = torch.tensor(vertices, device=self.device)
            
        if isinstance(faces, np.ndarray):
            faces = torch.tensor(faces, device=self.device)
            
        # Initialize normals
        normals = torch.zeros_like(vertices)
        
        # Compute face normals and accumulate on vertices
        for face_idx in range(faces.shape[0]):
            # Get face vertices
            face = faces[face_idx]
            v0 = vertices[face[0]]
            v1 = vertices[face[1]]
            v2 = vertices[face[2]]
            
            # Compute face normal
            normal = torch.cross(v1 - v0, v2 - v0)
            
            # Accumulate on vertices
            normals[face[0]] += normal
            normals[face[1]] += normal
            normals[face[2]] += normal
            
        # Normalize
        norms = torch.norm(normals, dim=1, keepdim=True)
        mask = norms > 1e-6
        normals[mask] = normals[mask] / norms[mask]
        
        return normals


class Instant3DModel:
    """Instant3D model for detailed 3D models with high geometric accuracy"""
    
    def __init__(self, config: ImprovedTextTo3DConfig):
        self.config = config
        self.device = torch.device(config.device)
        self.model = None
        self._initialized = False
        
    async def initialize(self):
        """Initialize the Instant3D model"""
        if self._initialized:
            return
        
        if not HAS_INSTANT3D:
            raise ImportError("Instant3D is not available. Please install it with 'pip install instant3d'.")
            
        logger.info("Initializing Instant3D model")
        
        try:
            from instant3d import Instant3DPipeline
            
            # Load model and move to device
            self.model = Instant3DPipeline.from_pretrained(
                self.config.instant3d_variant,
                torch_dtype=torch.float16 if "cuda" in self.config.device else torch.float32,
                cache_dir=self.config.cache_dir
            ).to(self.device)
            
            self._initialized = True
            logger.info("Instant3D model initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Instant3D model: {e}")
            raise RuntimeError(f"Instant3D initialization failed: {e}")
    
    async def generate_from_text(self, prompt: str) -> Dict[str, Any]:
        """Generate a 3D model from a text prompt using Instant3D"""
        if not self._initialized:
            await self.initialize()
            
        logger.info(f"Generating 3D model from prompt using Instant3D: '{prompt}'")
        
        try:
            # Generate 3D model directly from text
            with torch.no_grad():
                result = self.model(
                    prompt=prompt,
                    guidance_scale=self.config.instant3d_guidance_scale,
                    num_inference_steps=self.config.instant3d_num_inference_steps,
                    output_type="mesh",
                    mesh_resolution=self.config.mesh_resolution,
                    texture_resolution=self.config.texture_resolution
                )
            
            # Extract mesh data
            vertices = result.vertices
            faces = result.faces
            uvs = result.uvs
            texture = result.texture
            normals = result.normals if hasattr(result, "normals") else self._compute_vertex_normals(vertices, faces)
            
            # Normalize mesh to unit size
            vertices = self._normalize_mesh(vertices)
            
            # Create result dictionary
            model_data = {
                "geometry": {
                    "vertices": vertices.cpu().numpy() if isinstance(vertices, torch.Tensor) else vertices,
                    "faces": faces.cpu().numpy() if isinstance(faces, torch.Tensor) else faces,
                    "normals": normals.cpu().numpy() if isinstance(normals, torch.Tensor) else normals,
                    "uvs": uvs.cpu().numpy() if isinstance(uvs, torch.Tensor) else uvs,
                    "texture": texture.cpu().numpy() if isinstance(texture, torch.Tensor) else texture
                },
                "metadata": {
                    "prompt": prompt,
                    "model": "instant3d",
                    "variant": self.config.instant3d_variant,
                    "guidance_scale": self.config.instant3d_guidance_scale,
                    "inference_steps": self.config.instant3d_num_inference_steps,
                    "mesh_resolution": self.config.mesh_resolution,
                    "texture_resolution": self.config.texture_resolution,
                    "timestamp": time.time()
                }
            }
            
            logger.info(f"Instant3D model generation complete with {len(vertices)} vertices, {len(faces)} faces")
            return model_data
            
        except Exception as e:
            logger.error(f"Error generating 3D model with Instant3D: {e}")
            raise RuntimeError(f"Instant3D generation failed: {e}")
    
    def _normalize_mesh(self, vertices: Union[torch.Tensor, np.ndarray]) -> Union[torch.Tensor, np.ndarray]:
        """Normalize mesh to fit in a unit cube centered at origin"""
        if isinstance(vertices, np.ndarray):
            vertices = torch.tensor(vertices)
            
        # Calculate bounding box
        min_vals, _ = torch.min(vertices, dim=0)
        max_vals, _ = torch.max(vertices, dim=0)
        
        # Calculate center and scale
        center = (min_vals + max_vals) / 2
        scale = torch.max(max_vals - min_vals) / 2
        
        # Normalize vertices
        normalized_vertices = (vertices - center) / (scale + 1e-6)
        
        return normalized_vertices
    
    def _compute_vertex_normals(self, 
                              vertices: Union[torch.Tensor, np.ndarray], 
                              faces: Union[torch.Tensor, np.ndarray]) -> torch.Tensor:
        """Compute vertex normals for the mesh"""
        if isinstance(vertices, np.ndarray):
            vertices = torch.tensor(vertices, device=self.device)
            
        if isinstance(faces, np.ndarray):
            faces = torch.tensor(faces, device=self.device)
            
        # Initialize normals
        normals = torch.zeros_like(vertices)
        
        # Compute face normals and accumulate on vertices
        for face_idx in range(faces.shape[0]):
            # Get face vertices
            face = faces[face_idx]
            v0 = vertices[face[0]]
            v1 = vertices[face[1]]
            v2 = vertices[face[2]]
            
            # Compute face normal
            normal = torch.cross(v1 - v0, v2 - v0)
            
            # Accumulate on vertices
            normals[face[0]] += normal
            normals[face[1]] += normal
            normals[face[2]] += normal
            
        # Normalize
        norms = torch.norm(normals, dim=1, keepdim=True)
        mask = norms > 1e-6
        normals[mask] = normals[mask] / norms[mask]
        
        return normals


class PhysicsValidator:
    """Validate physics properties of 3D models"""
    
    def __init__(self, config: ImprovedTextTo3DConfig):
        self.config = config
        
    async def validate_physics(self, model: Dict[str, Any]) -> Dict[str, bool]:
        """Validate mesh physics properties"""
        if not self.config.physics_enabled:
            return {"valid": True, "message": "Physics validation skipped"}
            
        logger.info("Validating mesh physics properties")
        
        try:
            import trimesh
            import numpy as np
            
            # Get mesh data
            vertices = model["geometry"]["vertices"]
            faces = model["geometry"]["faces"]
            
            # Create trimesh object
            mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
            
            # Check if mesh is watertight
            is_watertight = mesh.is_watertight
            
            # Check if mesh is convex
            is_convex = mesh.is_convex
            
            # Check if mesh volume is valid
            has_volume = mesh.volume > 0
            
            # Check for self-intersections
            has_self_intersections = len(mesh.face_adjacency_projections) > 0
            
            # Combine validation results
            validity = is_watertight and has_volume and not has_self_intersections
            
            # If not valid, attempt to repair
            repaired = False
            if not validity and self.config.physics_steps > 0:
                logger.info("Attempting to repair mesh for physics validity")
                
                # Fill holes
                if not is_watertight:
                    mesh.fill_holes()
                
                # Remove duplicate vertices
                mesh = mesh.merge_vertices()
                
                # Fix face winding
                mesh.fix_face_winding()
                
                # Fix normals
                mesh.fix_normals()
                
                # Check again after repair
                is_watertight = mesh.is_watertight
                has_volume = mesh.volume > 0
                has_self_intersections = len(mesh.face_adjacency_projections) > 0
                
                # Update validity
                validity = is_watertight and has_volume and not has_self_intersections
                repaired = validity
                
                # Update model geometry if repaired
                if repaired:
                    model["geometry"]["vertices"] = np.array(mesh.vertices)
                    model["geometry"]["faces"] = np.array(mesh.faces)
                    model["geometry"]["normals"] = np.array(mesh.vertex_normals)
            
            # Create validation report
            report = {
                "valid": validity,
                "is_watertight": is_watertight,
                "is_convex": is_convex,
                "has_volume": has_volume,
                "has_self_intersections": has_self_intersections,
                "volume": float(mesh.volume) if has_volume else 0.0,
                "center_mass": mesh.center_mass.tolist() if has_volume else [0, 0, 0],
                "repaired": repaired,
                "message": "Physics validation " + ("passed" if validity else "failed")
            }
            
            logger.info(f"Physics validation {'passed' if validity else 'failed'}" + 
                      f"{' (after repair)' if repaired else ''}")
            return report
            
        except Exception as e:
            logger.error(f"Error validating physics: {e}")
            return {"valid": False, "message": f"Physics validation error: {e}"}


class ModelExporter:
    """Export 3D models in various formats with MaterialX support"""
    
    def __init__(self, config: ImprovedTextTo3DConfig):
        self.config = config
        
        # Create output directory if it doesn't exist
        os.makedirs(self.config.output_dir, exist_ok=True)
        
    async def export_model(self, 
                         model: Dict[str, Any], 
                         formats: Optional[List[str]] = None) -> Dict[str, str]:
        """Export a 3D model in various formats with MaterialX support"""
        # Use configured formats if none provided
        export_formats = formats or self.config.export_formats
        
        logger.info(f"Exporting model in formats: {export_formats}")
        
        # Get model name from prompt or use timestamp
        prompt = model["metadata"].get("prompt", "")
        model_name = self._sanitize_filename(prompt[:30]) if prompt else f"model_{int(time.time())}"
        
        # Create paths dictionary
        export_paths = {}
        
        try:
            # Export in each requested format
            for format in export_formats:
                format = format.lower()
                
                if format == "obj":
                    path = await self._export_obj(model, model_name)
                    export_paths["obj"] = path
                    
                elif format in ["glb", "gltf"]:
                    path = await self._export_glb(model, model_name, format)
                    export_paths[format] = path
                    
                elif format == "usdz":
                    path = await self._export_usdz(model, model_name)
                    export_paths["usdz"] = path
                    
                elif format == "ply":
                    path = await self._export_ply(model, model_name)
                    export_paths["ply"] = path
                    
                elif format == "materialx":
                    path = await self._export_materialx(model, model_name)
                    export_paths["materialx"] = path
                    
                else:
                    logger.warning(f"Unsupported export format: {format}")
                    
            return export_paths
            
        except Exception as e:
            logger.error(f"Error exporting model: {e}")
            raise RuntimeError(f"Model export failed: {e}")
    
    async def _export_obj(self, model: Dict[str, Any], model_name: str) -> str:
        """Export model in OBJ format with MTL and textures"""
        try:
            import trimesh
            from PIL import Image
            
            # Get mesh data
            vertices = model["geometry"]["vertices"]
            faces = model["geometry"]["faces"]
            normals = model["geometry"]["normals"]
            uvs = model["geometry"]["uvs"]
            
            # Create export path
            export_dir = os.path.join(self.config.output_dir, model_name)
            os.makedirs(export_dir, exist_ok=True)
            
            obj_path = os.path.join(export_dir, f"{model_name}.obj")
            mtl_path = os.path.join(export_dir, f"{model_name}.mtl")
            
            # Create trimesh object
            mesh = trimesh.Trimesh(
                vertices=vertices, 
                faces=faces, 
                vertex_normals=normals,
                visual=trimesh.visual.TextureVisuals(uv=uvs) if uvs is not None else None
            )
            
            # Export OBJ
            mesh.export(obj_path, file_type="obj", include_normals=True, include_texture=uvs is not None)
            
            # If we have textures, export them
            texture = model["geometry"].get("texture")
            if texture is not None:
                albedo_path = os.path.join(export_dir, "albedo.png")
                Image.fromarray(texture).save(albedo_path)
                
                # Create MTL file with PBR properties
                with open(mtl_path, "w") as f:
                    f.write(f"newmtl material0\n")
                    f.write(f"Ka 1.000000 1.000000 1.000000\n")
                    f.write(f"Kd 1.000000 1.000000 1.000000\n")
                    f.write(f"Ks 0.000000 0.000000 0.000000\n")
                    f.write(f"Ns 10.000000\n")
                    f.write(f"illum 2\n")
                    f.write(f"map_Kd albedo.png\n")
                    
                    # If more texture maps exist in the model
                    additional_textures = {
                        "normal": "map_bump",
                        "roughness": "map_Ns",
                        "metallic": "map_Pm",
                        "ao": "map_Ka",
                        "emissive": "map_Ke"
                    }
                    
                    for tex_name, mtl_cmd in additional_textures.items():
                        tex_data = model["geometry"].get(f"{tex_name}_texture")
                        if tex_data is not None:
                            tex_path = os.path.join(export_dir, f"{tex_name}.png")
                            Image.fromarray(tex_data).save(tex_path)
                            f.write(f"{mtl_cmd} {tex_name}.png\n")
            
            logger.info(f"Model exported to OBJ: {obj_path}")
            return obj_path
            
        except Exception as e:
            logger.error(f"Error exporting to OBJ: {e}")
            raise RuntimeError(f"OBJ export failed: {e}")
    
    async def _export_glb(self, model: Dict[str, Any], model_name: str, format: str) -> str:
        """Export model in GLB/GLTF format with PBR materials"""
        try:
            import trimesh
            from PIL import Image
            
            # Get mesh data
            vertices = model["geometry"]["vertices"]
            faces = model["geometry"]["faces"]
            normals = model["geometry"]["normals"]
            uvs = model["geometry"]["uvs"]
            
            # Create export path
            export_dir = os.path.join(self.config.output_dir, model_name)
            os.makedirs(export_dir, exist_ok=True)
            
            gltf_path = os.path.join(export_dir, f"{model_name}.{format}")
            
            # Create trimesh object
            mesh = trimesh.Trimesh(
                vertices=vertices, 
                faces=faces, 
                vertex_normals=normals,
                visual=trimesh.visual.TextureVisuals(uv=uvs) if uvs is not None else None
            )
            
            # Handle textures and PBR materials
            texture = model["geometry"].get("texture")
            if texture is not None and self.config.use_pbr_materials:
                # Create PBR material
                material = trimesh.visual.material.PBRMaterial()
                
                # Add base color texture
                albedo_path = os.path.join(export_dir, "albedo.png")
                Image.fromarray(texture).save(albedo_path)
                material.baseColorTexture = albedo_path
                
                # Add additional texture maps if available
                texture_mappings = {
                    "normal_texture": {"attr": "normalTexture", "filename": "normal.png"},
                    "roughness_texture": {"attr": "roughnessTexture", "filename": "roughness.png"},
                    "metallic_texture": {"attr": "metallicTexture", "filename": "metallic.png"},
                    "ao_texture": {"attr": "occlusionTexture", "filename": "ao.png"},
                    "emissive_texture": {"attr": "emissiveTexture", "filename": "emissive.png"}
                }
                
                for tex_key, mapping in texture_mappings.items():
                    tex_data = model["geometry"].get(tex_key)
                    if tex_data is not None:
                        tex_path = os.path.join(export_dir, mapping["filename"])
                        Image.fromarray(tex_data).save(tex_path)
                        setattr(material, mapping["attr"], tex_path)
                
                # Set default factors for PBR
                material.roughnessFactor = 0.8
                material.metallicFactor = 0.1
                
                # Update mesh visual
                mesh.visual = trimesh.visual.TextureVisuals(
                    uv=uvs,
                    material=material
                )
            
            # Export GLB/GLTF
            mesh.export(gltf_path, file_type=format)
            
            logger.info(f"Model exported to {format.upper()}: {gltf_path}")
            return gltf_path
            
        except Exception as e:
            logger.error(f"Error exporting to {format.upper()}: {e}")
            raise RuntimeError(f"{format.upper()} export failed: {e}")
    
    async def _export_usdz(self, model: Dict[str, Any], model_name: str) -> str:
        """Export model in USDZ format"""
        try:
            # First export as OBJ
            obj_path = await self._export_obj(model, model_name)
            
            # Create export path
            export_dir = os.path.join(self.config.output_dir, model_name)
            os.makedirs(export_dir, exist_ok=True)
            
            usdz_path = os.path.join(export_dir, f"{model_name}.usdz")
            
            # Try to use usdz_converter if available
            try:
                import subprocess
                
                # Check if usdz_converter is available
                result = subprocess.run(["which", "usdz_converter"], capture_output=True, text=True)
                
                if result.returncode == 0:
                    # Use usdz_converter
                    subprocess.run(["usdz_converter", obj_path, usdz_path], check=True)
                else:
                    # Try Apple's usdz_converter
                    subprocess.run(["xcrun", "usdz_converter", obj_path, usdz_path], check=True)
                    
                logger.info(f"Model exported to USDZ: {usdz_path}")
                return usdz_path
                
            except Exception as converter_error:
                logger.warning(f"USDZ conversion using system tools failed: {converter_error}")
                logger.info("Falling back to USD Python library")
                
                try:
                    import pxr.Usd as Usd
                    import pxr.UsdGeom as UsdGeom
                    
                    # Create USD stage
                    stage = Usd.Stage.CreateNew(usdz_path)
                    
                    # Add mesh to stage
                    mesh_prim = UsdGeom.Mesh.Define(stage, "/Model")
                    
                    # Get mesh data
                    vertices = model["geometry"]["vertices"]
                    faces = model["geometry"]["faces"]
                    
                    # Set mesh data
                    mesh_prim.CreatePointsAttr(vertices.flatten().tolist())
                    
                    # Set face counts and indices
                    face_counts = [3] * len(faces)  # Assuming triangular faces
                    face_indices = faces.flatten().tolist()
                    
                    mesh_prim.CreateFaceVertexCountsAttr(face_counts)
                    mesh_prim.CreateFaceVertexIndicesAttr(face_indices)
                    
                    # Save USD stage
                    stage.Save()
                    
                    logger.info(f"Model exported to USDZ using USD library: {usdz_path}")
                    return usdz_path
                    
                except ImportError:
                    logger.error("USD Python library not available")
                    raise RuntimeError("USDZ export requires USD Python library or usdz_converter")
                
        except Exception as e:
            logger.error(f"Error exporting to USDZ: {e}")
            raise RuntimeError(f"USDZ export failed: {e}")
    
    async def _export_ply(self, model: Dict[str, Any], model_name: str) -> str:
        """Export model in PLY format"""
        try:
            import trimesh
            
            # Get mesh data
            vertices = model["geometry"]["vertices"]
            faces = model["geometry"]["faces"]
            normals = model["geometry"]["normals"]
            
            # Create export path
            export_dir = os.path.join(self.config.output_dir, model_name)
            os.makedirs(export_dir, exist_ok=True)
            
            ply_path = os.path.join(export_dir, f"{model_name}.ply")
            
            # Create trimesh object
            mesh = trimesh.Trimesh(
                vertices=vertices, 
                faces=faces, 
                vertex_normals=normals
            )
            
            # Export PLY
            mesh.export(ply_path, file_type="ply")
            
            logger.info(f"Model exported to PLY: {ply_path}")
            return ply_path
            
        except Exception as e:
            logger.error(f"Error exporting to PLY: {e}")
            raise RuntimeError(f"PLY export failed: {e}")
    
    async def _export_materialx(self, model: Dict[str, Any], model_name: str) -> str:
        """Export model materials in MaterialX format"""
        try:
            # Create export path
            export_dir = os.path.join(self.config.output_dir, model_name)
            os.makedirs(export_dir, exist_ok=True)
            
            mtlx_path = os.path.join(export_dir, f"{model_name}.mtlx")
            
            # Check if we have required textures
            texture = model["geometry"].get("texture")
            if texture is None:
                raise ValueError("Cannot export MaterialX without texture information")
            
            from PIL import Image
            
            # Save base color texture
            albedo_path = os.path.join(export_dir, "albedo.png")
            Image.fromarray(texture).save(albedo_path)
            
            # Check for additional texture maps
            normal_map = model["geometry"].get("normal_texture")
            roughness_map = model["geometry"].get("roughness_texture")
            metallic_map = model["geometry"].get("metallic_texture")
            ao_map = model["geometry"].get("ao_texture")
            
            # Save additional texture maps if available
            texture_files = {"basecolor": "albedo.png"}
            
            if normal_map is not None:
                normal_path = os.path.join(export_dir, "normal.png")
                Image.fromarray(normal_map).save(normal_path)
                texture_files["normal"] = "normal.png"
                
            if roughness_map is not None:
                roughness_path = os.path.join(export_dir, "roughness.png")
                Image.fromarray(roughness_map).save(roughness_path)
                texture_files["roughness"] = "roughness.png"
                
            if metallic_map is not None:
                metallic_path = os.path.join(export_dir, "metallic.png")
                Image.fromarray(metallic_map).save(metallic_path)
                texture_files["metallic"] = "metallic.png"
                
            if ao_map is not None:
                ao_path = os.path.join(export_dir, "ao.png")
                Image.fromarray(ao_map).save(ao_path)
                texture_files["occlusion"] = "ao.png"
            
            # Create MaterialX document
            with open(mtlx_path, "w") as f:
                f.write('<?xml version="1.0"?>\n')
                f.write('<materialx version="1.38" xmlns:xi="http://www.w3.org/2001/XInclude">\n')
                
                # Create material
                material_name = "material_" + model_name.replace(" ", "_")
                f.write(f'  <material name="{material_name}">\n')
                f.write(f'    <shaderref name="{material_name}_shader" node="StandardSurface">\n')
                
                # Base color
                f.write(f'      <input name="base_color" type="color3" nodename="{material_name}_basecolor" />\n')
                
                # Metalness
                if "metallic" in texture_files:
                    f.write(f'      <input name="metalness" type="float" nodename="{material_name}_metallic" />\n')
                else:
                    f.write(f'      <input name="metalness" type="float" value="0.1" />\n')
                
                # Roughness
                if "roughness" in texture_files:
                    f.write(f'      <input name="roughness" type="float" nodename="{material_name}_roughness" />\n')
                else:
                    f.write(f'      <input name="roughness" type="float" value="0.7" />\n')
                
                # Normal map
                if "normal" in texture_files:
                    f.write(f'      <input name="normal" type="vector3" nodename="{material_name}_normal" />\n')
                
                # AO
                if "occlusion" in texture_files:
                    f.write(f'      <input name="occlusion" type="float" nodename="{material_name}_occlusion" />\n')
                
                f.write('    </shaderref>\n')
                f.write('  </material>\n\n')
                
                # Create texture nodes
                for map_type, filename in texture_files.items():
                    if map_type == "basecolor":
                        f.write(f'  <image name="{material_name}_basecolor" type="color3">\n')
                        f.write(f'    <input name="file" type="filename" value="{filename}" />\n')
                        f.write('  </image>\n\n')
                    elif map_type == "normal":
                        f.write(f'  <normalmap name="{material_name}_normal" type="vector3">\n')
                        f.write(f'    <input name="in" type="vector3" nodename="{material_name}_normal_image" />\n')
                        f.write('  </normalmap>\n\n')
                        f.write(f'  <image name="{material_name}_normal_image" type="vector3">\n')
                        f.write(f'    <input name="file" type="filename" value="{filename}" />\n')
                        f.write('  </image>\n\n')
                    else:  # roughness, metallic, occlusion
                        f.write(f'  <image name="{material_name}_{map_type}" type="float">\n')
                        f.write(f'    <input name="file" type="filename" value="{filename}" />\n')
                        f.write('  </image>\n\n')
                
                f.write('</materialx>\n')
            
            logger.info(f"Material exported to MaterialX: {mtlx_path}")
            return mtlx_path
            
        except Exception as e:
            logger.error(f"Error exporting to MaterialX: {e}")
            raise RuntimeError(f"MaterialX export failed: {e}")
    
    def _sanitize_filename(self, name: str) -> str:
        """Sanitize a string to be used as a filename"""
        # Replace spaces with underscores
        name = name.replace(" ", "_")
        
        # Remove invalid characters
        import re
        name = re.sub(r'[^\w\-_.]', '', name)
        
        # Ensure name isn't empty
        if not name:
            name = f"model_{int(time.time())}"
            
        return name


class ImprovedTextTo3DPipeline:
    """
    Complete pipeline for generating 3D models from text descriptions
    using newer, more advanced models for higher quality results.
    """
    
    def __init__(self, config: Optional[ImprovedTextTo3DConfig] = None):
        self.config = config or ImprovedTextTo3DConfig()
        
        # Create necessary directories
        os.makedirs(self.config.output_dir, exist_ok=True)
        os.makedirs(self.config.cache_dir, exist_ok=True)
        
        # Initialize components
        self.triposr_model = None if not HAS_TRIPOSR else TriposrModel(self.config)
        self.wonder3d_model = None if not HAS_WONDER3D else Wonder3DModel(self.config)
        self.instant3d_model = None if not HAS_INSTANT3D else Instant3DModel(self.config)
        
        self.physics_validator = PhysicsValidator(self.config)
        self.exporter = ModelExporter(self.config)
        
        # Track available models
        self.available_models = {
            "triposr": HAS_TRIPOSR,
            "wonder3d": HAS_WONDER3D,
            "instant3d": HAS_INSTANT3D
        }
        
        logger.info(f"ImprovedTextTo3DPipeline initialized with available models: {[k for k, v in self.available_models.items() if v]}")
    
    async def initialize(self):
        """Initialize required models based on availability"""
        logger.info("Initializing Improved Text to 3D pipeline")
        
        try:
            # Initialize models in parallel
            initialization_tasks = []
            
            if HAS_TRIPOSR and self.triposr_model:
                initialization_tasks.append(self.triposr_model.initialize())
                
            if HAS_WONDER3D and self.wonder3d_model:
                initialization_tasks.append(self.wonder3d_model.initialize())
                
            if HAS_INSTANT3D and self.instant3d_model:
                initialization_tasks.append(self.instant3d_model.initialize())
            
            if initialization_tasks:
                import asyncio
                await asyncio.gather(*initialization_tasks)
                
            logger.info("Improved Text to 3D pipeline initialization complete")
            
        except Exception as e:
            logger.error(f"Failed to initialize Improved Text to 3D pipeline: {e}")
            raise RuntimeError(f"Pipeline initialization failed: {e}")
    
    def _get_best_model_for_prompt(self, prompt: str) -> str:
        """Select the best model based on prompt content"""
        # Default to auto selection if preferred model is "auto"
        if self.config.preferred_model != "auto":
            preferred = self.config.preferred_model.lower()
            if self.available_models.get(preferred, False):
                return preferred
            
            logger.warning(f"Preferred model '{preferred}' not available, falling back to auto selection")
        
        # Check for category keywords in prompt
        prompt_lower = prompt.lower()
        
        for category, model_name in self.config.category_model_mapping.items():
            if category in prompt_lower and self.available_models.get(model_name, False):
                logger.info(f"Selected {model_name} model based on category '{category}' in prompt")
                return model_name
        
        # If no category match, prioritize based on what's available and capability
        if self.available_models.get("wonder3d", False):
            return "wonder3d"  # Best overall quality
        elif self.available_models.get("instant3d", False):
            return "instant3d"  # Good for text-to-3D
        elif self.available_models.get("triposr", False):
            return "triposr"    # Good for simple objects
        else:
            raise RuntimeError("No 3D generation models available")
    
    async def generate_from_text(self, 
                               prompt: str,
                               model_name: Optional[str] = None,
                               export_formats: Optional[List[str]] = None) -> Dict[str, Any]:
        """Generate a complete 3D model from text description"""
        logger.info(f"Generating 3D model from text: '{prompt}'")
        
        try:
            # Determine which model to use
            model_to_use = model_name or self._get_best_model_for_prompt(prompt)
            
            # Initialize components if needed
            if model_to_use == "triposr" and self.triposr_model and not hasattr(self.triposr_model, '_initialized'):
                await self.triposr_model.initialize()
            elif model_to_use == "wonder3d" and self.wonder3d_model and not hasattr(self.wonder3d_model, '_initialized'):
                await self.wonder3d_model.initialize()
            elif model_to_use == "instant3d" and self.instant3d_model and not hasattr(self.instant3d_model, '_initialized'):
                await self.instant3d_model.initialize()
            
            # Generate 3D model using selected model
            if model_to_use == "triposr" and self.triposr_model:
                model_data = await self.triposr_model.generate_from_text(prompt)
            elif model_to_use == "wonder3d" and self.wonder3d_model:
                model_data = await self.wonder3d_model.generate_from_text(prompt)
            elif model_to_use == "instant3d" and self.instant3d_model:
                model_data = await self.instant3d_model.generate_from_text(prompt)
            else:
                raise RuntimeError(f"Selected model '{model_to_use}' is not available")
            
            # Validate physics properties
            physics_report = await self.physics_validator.validate_physics(model_data)
            
            # Export model
            export_paths = await self.exporter.export_model(
                model_data,
                formats=export_formats
            )
            
            # Combine results
            result = {
                "model": model_data,
                "physics_report": physics_report,
                "export_paths": export_paths,
                "model_used": model_to_use,
                "status": "success",
                "message": f"3D model generated successfully using {model_to_use}"
            }
            
            logger.info(f"3D model generation complete using {model_to_use}")
            return result
            
        except Exception as e:
            logger.error(f"Error generating 3D model: {e}")
            return {
                "status": "error",
                "message": f"3D model generation failed: {e}",
                "error": str(e)
            }
    
    async def generate_from_image(self, 
                               image_path: str,
                               prompt: Optional[str] = None,
                               model_name: Optional[str] = None,
                               export_formats: Optional[List[str]] = None) -> Dict[str, Any]:
        """Generate a 3D model from an image"""
        logger.info(f"Generating 3D model from image: '{image_path}'")
        
        try:
            # Determine which model to use
            # For image-based generation, Triposr and Wonder3D are best
            if model_name:
                model_to_use = model_name
            elif self.available_models.get("wonder3d", False):
                model_to_use = "wonder3d"  # Best for image-to-3D
            elif self.available_models.get("triposr", False):
                model_to_use = "triposr"   # Also good for image-to-3D
            else:
                raise RuntimeError("No suitable image-to-3D generation models available")
            
            # Initialize components if needed
            if model_to_use == "triposr" and self.triposr_model and not hasattr(self.triposr_model, '_initialized'):
                await self.triposr_model.initialize()
            elif model_to_use == "wonder3d" and self.wonder3d_model and not hasattr(self.wonder3d_model, '_initialized'):
                await self.wonder3d_model.initialize()
            
            # Generate 3D model using selected model
            if model_to_use == "triposr" and self.triposr_model:
                model_data = await self.triposr_model.generate_from_image(image_path, prompt)
            elif model_to_use == "wonder3d" and self.wonder3d_model:
                model_data = await self.wonder3d_model.generate_from_image(image_path, prompt)
            else:
                raise RuntimeError(f"Selected model '{model_to_use}' is not available for image-based generation")
            
            # Validate physics properties
            physics_report = await self.physics_validator.validate_physics(model_data)
            
            # Export model
            export_paths = await self.exporter.export_model(
                model_data,
                formats=export_formats
            )
            
            # Combine results
            result = {
                "model": model_data,
                "physics_report": physics_report,
                "export_paths": export_paths,
                "model_used": model_to_use,
                "status": "success",
                "message": f"3D model generated successfully from image using {model_to_use}"
            }
            
            logger.info(f"3D model generation from image complete using {model_to_use}")
            return result
            
        except Exception as e:
            logger.error(f"Error generating 3D model from image: {e}")
            return {
                "status": "error",
                "message": f"3D model generation from image failed: {e}",
                "error": str(e)
            }

async def test_pipeline():
    """Test the Improved Text to 3D pipeline"""
    # Create configuration
    config = ImprovedTextTo3DConfig()
    
    # Create pipeline
    pipeline = ImprovedTextTo3DPipeline(config)
    
    # Initialize pipeline
    await pipeline.initialize()
    
    # Test text-to-3D generation
    result = await pipeline.generate_from_text(
        prompt="A modern ergonomic office chair with adjustable armrests",
        export_formats=["obj", "glb"]
    )
    
    # Print results
    print(f"Generation status: {result['status']}")
    print(f"Message: {result['message']}")
    print(f"Model used: {result['model_used']}")
    print(f"Export paths: {result['export_paths']}")
    
    # Test image-to-3D generation if we have an example image
    import os
    if os.path.exists("example.jpg"):
        image_result = await pipeline.generate_from_image(
            image_path="example.jpg",
            prompt="An office chair",
            export_formats=["obj", "glb"]
        )
        
        # Print image-based results
        print(f"Image-based generation status: {image_result['status']}")
        print(f"Message: {image_result['message']}")
        print(f"Model used: {image_result['model_used']}")
        print(f"Export paths: {image_result['export_paths']}")


if __name__ == "__main__":
    # Run test pipeline
    import asyncio
    asyncio.run(test_pipeline())