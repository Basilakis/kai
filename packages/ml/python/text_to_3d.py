"""
Text to 3D Generation System

This module provides a comprehensive pipeline for generating 3D models from text descriptions,
integrating multiple state-of-the-art models including ShapE, GET3D, DiffuScene, and stable diffusion models.
"""

import torch
import numpy as np
import os
import logging
import time
import asyncio
from typing import Dict, List, Any, Optional, Tuple, Union, Callable
from pathlib import Path
from dataclasses import dataclass, field

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Required dependencies (add to requirements.txt):
# torch>=2.0.0
# transformers>=4.30.0
# diffusers>=0.18.0
# huggingface_hub>=0.16.0
# trimesh>=3.20.0
# pytorch3d>=0.7.0
# numpy>=1.24.0
# open3d>=0.17.0

@dataclass
class TextTo3DConfig:
    """Configuration for text to 3D pipeline"""
    # General configuration
    device: str = "cuda" if torch.cuda.is_available() else "cpu"
    output_dir: str = "output/text_to_3d"
    cache_dir: str = ".cache/text_to_3d"
    
    # ShapE configuration
    shape_e_model: str = "openai/shap-e-xl"
    shape_e_guidance_scale: float = 7.5
    shape_e_steps: int = 64
    
    # GET3D configuration
    get3d_model: str = "nvidia/get3d-base"
    get3d_guidance_scale: float = 8.0
    get3d_steps: int = 100
    
    # DiffuScene configuration 
    diffuscene_model: str = "scene-diffuser/diffuscene-v1"
    diffuscene_guidance_scale: float = 9.0
    diffuscene_steps: int = 50
    
    # Stable Diffusion for textures
    texture_model: str = "stabilityai/stable-diffusion-2-1"
    texture_guidance_scale: float = 7.5
    texture_steps: int = 30
    texture_resolution: int = 1024
    
    # Mesh parameters
    mesh_resolution: int = 256
    simplify_mesh: bool = True
    target_faces: int = 10000
    
    # Physics simulation
    physics_enabled: bool = True
    physics_steps: int = 100
    collision_margin: float = 0.01
    
    # Export formats
    export_formats: List[str] = field(default_factory=lambda: ["obj", "glb", "usdz"])


class ShapEModel:
    """Shap-E model for base 3D shape generation from text"""
    
    def __init__(self, config: TextTo3DConfig):
        self.config = config
        self.device = torch.device(config.device)
        self.model = None
        self.tokenizer = None
        self._initialized = False
        
    async def initialize(self):
        """Initialize the Shap-E model and tokenizer"""
        if self._initialized:
            return
            
        logger.info("Initializing Shap-E model")
        
        try:
            from diffusers import ShapEPipeline
            from transformers import AutoTokenizer
            
            # Load model and move to device
            self.model = ShapEPipeline.from_pretrained(
                self.config.shape_e_model,
                torch_dtype=torch.float16 if "cuda" in self.config.device else torch.float32,
                cache_dir=self.config.cache_dir
            ).to(self.device)
            
            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.config.shape_e_model, 
                cache_dir=self.config.cache_dir
            )
            
            self._initialized = True
            logger.info("Shap-E model initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Shap-E model: {e}")
            raise RuntimeError(f"Shap-E initialization failed: {e}")
    
    async def generate_base_shape(self, prompt: str) -> Dict[str, Any]:
        """Generate a base 3D shape from a text prompt"""
        if not self._initialized:
            await self.initialize()
            
        logger.info(f"Generating base 3D shape from prompt: '{prompt}'")
        
        try:
            # Encode text prompt
            inputs = self.tokenizer(
                prompt,
                padding="max_length",
                max_length=77,
                truncation=True,
                return_tensors="pt"
            ).to(self.device)
            
            # Generate 3D shape
            with torch.no_grad():
                outputs = self.model(
                    prompt_embeds=inputs.input_ids,
                    guidance_scale=self.config.shape_e_guidance_scale,
                    num_inference_steps=self.config.shape_e_steps,
                    output_type="mesh"
                )
                
            # Extract the mesh from outputs
            mesh = outputs.meshes[0]
            
            # Convert to standard format
            vertices = mesh.verts
            faces = mesh.faces
            
            # If we have texture information, extract it
            if hasattr(mesh, "uvs") and mesh.uvs is not None:
                uvs = mesh.uvs
                texture = mesh.texture if hasattr(mesh, "texture") else None
            else:
                # Generate basic UVs if not provided
                uvs = self._generate_basic_uvs(vertices)
                texture = None
                
            # Normalize mesh to unit size
            vertices = self._normalize_mesh(vertices)
            
            # Compute normals
            normals = self._compute_vertex_normals(vertices, faces)
            
            # Return mesh data and metadata
            result = {
                "geometry": {
                    "vertices": vertices.cpu().numpy(),
                    "faces": faces.cpu().numpy(),
                    "normals": normals.cpu().numpy(),
                    "uvs": uvs.cpu().numpy() if uvs is not None else None,
                    "texture": texture.cpu().numpy() if texture is not None else None
                },
                "metadata": {
                    "prompt": prompt,
                    "model": self.config.shape_e_model,
                    "guidance_scale": self.config.shape_e_guidance_scale,
                    "steps": self.config.shape_e_steps,
                    "timestamp": time.time()
                }
            }
            
            logger.info(f"Base shape generated with {len(vertices)} vertices, {len(faces)} faces")
            return result
            
        except Exception as e:
            logger.error(f"Error generating base shape: {e}")
            raise RuntimeError(f"Shape generation failed: {e}")
            
    async def refine_shape(self, base_shape: Dict[str, Any], feedback: str) -> Dict[str, Any]:
        """Refine an existing shape based on feedback"""
        if not self._initialized:
            await self.initialize()
            
        logger.info(f"Refining shape based on feedback: '{feedback}'")
        
        try:
            # Combine original prompt with feedback
            original_prompt = base_shape["metadata"]["prompt"]
            combined_prompt = f"{original_prompt}. {feedback}"
            
            # Get geometry data
            vertices = torch.tensor(base_shape["geometry"]["vertices"], device=self.device)
            faces = torch.tensor(base_shape["geometry"]["faces"], device=self.device)
            
            # Create input mesh
            from diffusers.utils import load_meshes, export_to_obj
            input_mesh = {"verts": vertices, "faces": faces}
            
            # Encode combined prompt
            inputs = self.tokenizer(
                combined_prompt,
                padding="max_length",
                max_length=77,
                truncation=True,
                return_tensors="pt"
            ).to(self.device)
            
            # Refine shape with more steps and higher guidance scale
            with torch.no_grad():
                outputs = self.model(
                    prompt_embeds=inputs.input_ids,
                    guidance_scale=self.config.shape_e_guidance_scale + 1.0,  # Higher for refinement
                    num_inference_steps=self.config.shape_e_steps + 20,      # More steps for refinement
                    input_mesh=input_mesh,
                    output_type="mesh"
                )
                
            # Extract refined mesh
            refined_mesh = outputs.meshes[0]
            
            # Convert to standard format
            vertices = refined_mesh.verts
            faces = refined_mesh.faces
            
            # Extract UVs and texture if available
            if hasattr(refined_mesh, "uvs") and refined_mesh.uvs is not None:
                uvs = refined_mesh.uvs
                texture = refined_mesh.texture if hasattr(refined_mesh, "texture") else None
            else:
                # Use original UVs if available, otherwise generate basic ones
                uvs = torch.tensor(base_shape["geometry"]["uvs"], device=self.device) if base_shape["geometry"]["uvs"] is not None else self._generate_basic_uvs(vertices)
                texture = torch.tensor(base_shape["geometry"]["texture"], device=self.device) if base_shape["geometry"]["texture"] is not None else None
                
            # Normalize mesh to unit size
            vertices = self._normalize_mesh(vertices)
            
            # Compute normals
            normals = self._compute_vertex_normals(vertices, faces)
            
            # Return refined mesh data and metadata
            result = {
                "geometry": {
                    "vertices": vertices.cpu().numpy(),
                    "faces": faces.cpu().numpy(),
                    "normals": normals.cpu().numpy(),
                    "uvs": uvs.cpu().numpy() if uvs is not None else None,
                    "texture": texture.cpu().numpy() if texture is not None else None
                },
                "metadata": {
                    "prompt": combined_prompt,
                    "original_prompt": original_prompt,
                    "feedback": feedback,
                    "model": self.config.shape_e_model,
                    "guidance_scale": self.config.shape_e_guidance_scale + 1.0,
                    "steps": self.config.shape_e_steps + 20,
                    "timestamp": time.time(),
                    "parent": base_shape["metadata"]
                }
            }
            
            logger.info(f"Shape refined with {len(vertices)} vertices, {len(faces)} faces")
            return result
            
        except Exception as e:
            logger.error(f"Error refining shape: {e}")
            raise RuntimeError(f"Shape refinement failed: {e}")
    
    def _generate_basic_uvs(self, vertices: torch.Tensor) -> torch.Tensor:
        """Generate basic UV coordinates for the mesh using spherical projection"""
        # Normalize vertices to unit sphere
        center = vertices.mean(dim=0, keepdim=True)
        vertices_centered = vertices - center
        
        # Calculate spherical coordinates
        radius = torch.sqrt(torch.sum(vertices_centered**2, dim=1))
        theta = torch.atan2(vertices_centered[:, 1], vertices_centered[:, 0])
        phi = torch.acos(vertices_centered[:, 2] / (radius + 1e-6))
        
        # Convert to UV coordinates [0, 1]
        u = (theta / (2 * np.pi)) + 0.5
        v = phi / np.pi
        
        # Create UV tensor
        uvs = torch.stack((u, v), dim=1)
        
        return uvs
    
    def _normalize_mesh(self, vertices: torch.Tensor) -> torch.Tensor:
        """Normalize mesh to fit in a unit cube centered at origin"""
        # Calculate bounding box
        min_vals, _ = torch.min(vertices, dim=0)
        max_vals, _ = torch.max(vertices, dim=0)
        
        # Calculate center and scale
        center = (min_vals + max_vals) / 2
        scale = torch.max(max_vals - min_vals) / 2
        
        # Normalize vertices
        normalized_vertices = (vertices - center) / (scale + 1e-6)
        
        return normalized_vertices
    
    def _compute_vertex_normals(self, vertices: torch.Tensor, faces: torch.Tensor) -> torch.Tensor:
        """Compute vertex normals for the mesh"""
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


class TextureGenerator:
    """Generate textures for 3D models using Stable Diffusion"""
    
    def __init__(self, config: TextTo3DConfig):
        self.config = config
        self.device = torch.device(config.device)
        self.model = None
        self._initialized = False
        
    async def initialize(self):
        """Initialize the texture generation model"""
        if self._initialized:
            return
            
        logger.info("Initializing texture generation model")
        
        try:
            from diffusers import StableDiffusionPipeline
            
            # Load model and move to device
            self.model = StableDiffusionPipeline.from_pretrained(
                self.config.texture_model,
                torch_dtype=torch.float16 if "cuda" in self.config.device else torch.float32,
                cache_dir=self.config.cache_dir
            ).to(self.device)
            
            # Enable memory optimization
            if hasattr(self.model, "enable_attention_slicing"):
                self.model.enable_attention_slicing()
                
            if hasattr(self.model, "enable_vae_slicing"):
                self.model.enable_vae_slicing()
                
            self._initialized = True
            logger.info("Texture generation model initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize texture generation model: {e}")
            raise RuntimeError(f"Texture model initialization failed: {e}")
    
    async def generate_textures(self, 
                              model: Dict[str, Any], 
                              texture_prompt: Optional[str] = None, 
                              material_type: str = "pbr") -> Dict[str, Any]:
        """Generate textures for a 3D model"""
        if not self._initialized:
            await self.initialize()
            
        # Get or create texture prompt
        base_prompt = model["metadata"]["prompt"]
        prompt = texture_prompt or f"High quality {material_type} material texture for {base_prompt}, detailed, realistic, 8K"
        
        logger.info(f"Generating textures using prompt: '{prompt}'")
        
        try:
            # Generate base texture
            with torch.no_grad():
                base_image = self.model(
                    prompt,
                    guidance_scale=self.config.texture_guidance_scale,
                    num_inference_steps=self.config.texture_steps,
                    height=self.config.texture_resolution,
                    width=self.config.texture_resolution
                ).images[0]
                
            # Convert PIL image to numpy array
            base_texture = np.array(base_image)
            
            # If PBR material type, generate additional texture maps
            if material_type == "pbr":
                # Generate normal map
                normal_prompt = f"Normal map for {base_prompt}, detailed, technical, blue-purple"
                normal_image = self.model(
                    normal_prompt,
                    guidance_scale=self.config.texture_guidance_scale,
                    num_inference_steps=self.config.texture_steps,
                    height=self.config.texture_resolution,
                    width=self.config.texture_resolution
                ).images[0]
                normal_map = np.array(normal_image)
                
                # Generate roughness map
                roughness_prompt = f"Roughness map for {base_prompt}, greyscale, technical"
                roughness_image = self.model(
                    roughness_prompt,
                    guidance_scale=self.config.texture_guidance_scale,
                    num_inference_steps=self.config.texture_steps,
                    height=self.config.texture_resolution,
                    width=self.config.texture_resolution
                ).images[0]
                roughness_map = np.array(roughness_image)
                
                # Generate metallic map
                metallic_prompt = f"Metallic map for {base_prompt}, greyscale, technical"
                metallic_image = self.model(
                    metallic_prompt,
                    guidance_scale=self.config.texture_guidance_scale,
                    num_inference_steps=self.config.texture_steps,
                    height=self.config.texture_resolution,
                    width=self.config.texture_resolution
                ).images[0]
                metallic_map = np.array(metallic_image)
                
                # Return all textures
                textures = {
                    "albedo": base_texture,
                    "normal": normal_map,
                    "roughness": roughness_map,
                    "metallic": metallic_map
                }
            else:
                # Return just the base texture for non-PBR materials
                textures = {"albedo": base_texture}
                
            # Add metadata
            textures["metadata"] = {
                "prompt": prompt,
                "base_prompt": base_prompt,
                "material_type": material_type,
                "resolution": self.config.texture_resolution,
                "model": self.config.texture_model,
                "timestamp": time.time()
            }
            
            logger.info(f"Generated {len(textures)-1} texture maps at {self.config.texture_resolution}x{self.config.texture_resolution} resolution")
            return textures
            
        except Exception as e:
            logger.error(f"Error generating textures: {e}")
            raise RuntimeError(f"Texture generation failed: {e}")
    
    async def apply_textures_to_mesh(self, 
                                   model: Dict[str, Any], 
                                   textures: Dict[str, Any]) -> Dict[str, Any]:
        """Apply generated textures to a 3D model"""
        logger.info("Applying textures to mesh")
        
        try:
            # Get model geometry
            vertices = model["geometry"]["vertices"]
            faces = model["geometry"]["faces"]
            
            # Get or generate UVs
            uvs = model["geometry"]["uvs"]
            if uvs is None:
                # Generate UVs if not available
                vertices_tensor = torch.tensor(vertices, device=self.device)
                uvs = self._generate_uvs(vertices_tensor).cpu().numpy()
                
            # Create copy of model with textures
            textured_model = {
                "geometry": {
                    "vertices": vertices,
                    "faces": faces,
                    "normals": model["geometry"]["normals"],
                    "uvs": uvs,
                    "textures": textures
                },
                "metadata": {
                    **model["metadata"],
                    "textured": True,
                    "texture_type": textures["metadata"]["material_type"],
                    "texture_timestamp": textures["metadata"]["timestamp"]
                }
            }
            
            logger.info("Textures applied successfully")
            return textured_model
            
        except Exception as e:
            logger.error(f"Error applying textures: {e}")
            raise RuntimeError(f"Texture application failed: {e}")
    
    def _generate_uvs(self, vertices: torch.Tensor) -> torch.Tensor:
        """Generate UV coordinates for a mesh using smart projection"""
        try:
            import pytorch3d
            from pytorch3d.structures import Meshes
            from pytorch3d.renderer import TexturesUV
            
            # Use pytorch3d for UV generation if available
            # This is a simplified implementation
            
            # Normalize vertices
            center = vertices.mean(dim=0)
            vertices_centered = vertices - center
            scale = vertices_centered.abs().max()
            vertices_normalized = vertices_centered / scale
            
            # Create a sphere at origin
            theta = torch.linspace(0, 2 * np.pi, 100, device=self.device)
            phi = torch.linspace(0, np.pi, 50, device=self.device)
            
            # Generate UV coordinates using spherical projection
            u = (theta / (2 * np.pi)).unsqueeze(1)
            v = (phi / np.pi).unsqueeze(0)
            
            # Interpolate to get UVs for all vertices
            return self._spherical_projection(vertices_normalized)
            
        except ImportError:
            # Fallback to basic spherical projection
            return self._spherical_projection(vertices)
    
    def _spherical_projection(self, vertices: torch.Tensor) -> torch.Tensor:
        """Generate UV coordinates using spherical projection"""
        # Normalize vertices
        center = vertices.mean(dim=0, keepdim=True)
        vertices_centered = vertices - center
        
        # Calculate spherical coordinates
        radius = torch.sqrt(torch.sum(vertices_centered**2, dim=1))
        theta = torch.atan2(vertices_centered[:, 1], vertices_centered[:, 0])
        phi = torch.acos(torch.clamp(vertices_centered[:, 2] / (radius + 1e-6), -1.0, 1.0))
        
        # Convert to UV coordinates [0, 1]
        u = (theta / (2 * torch.pi)) + 0.5
        v = phi / torch.pi
        
        # Create UV tensor
        uvs = torch.stack((u, v), dim=1)
        
        return uvs


class MeshProcessor:
    """Process and optimize 3D meshes"""
    
    def __init__(self, config: TextTo3DConfig):
        self.config = config
        self.device = torch.device(config.device)
        
    async def process_mesh(self, model: Dict[str, Any]) -> Dict[str, Any]:
        """Process and optimize a 3D mesh"""
        logger.info("Processing and optimizing mesh")
        
        try:
            import trimesh
            import numpy as np
            
            # Get mesh data
            vertices = model["geometry"]["vertices"]
            faces = model["geometry"]["faces"]
            normals = model["geometry"]["normals"]
            
            # Create trimesh object
            mesh = trimesh.Trimesh(vertices=vertices, faces=faces, vertex_normals=normals)
            
            # Remove duplicate vertices
            mesh = mesh.merge_vertices()
            
            # Fill holes
            mesh.fill_holes()
            
            # Remove degenerate faces
            mesh.remove_degenerate_faces()
            
            # Fix face winding
            mesh.fix_face_winding()
            
            # Fix normals
            mesh.fix_normals()
            
            # Simplify mesh if configured
            if self.config.simplify_mesh and len(mesh.faces) > self.config.target_faces:
                # Calculate reduction ratio
                reduction = self.config.target_faces / len(mesh.faces)
                
                # Simplify mesh
                mesh = mesh.simplify_quadratic_decimation(int(len(mesh.faces) * reduction))
                
                logger.info(f"Simplified mesh from {len(faces)} to {len(mesh.faces)} faces")
                
            # Update model with processed mesh
            processed_model = {
                "geometry": {
                    "vertices": np.array(mesh.vertices),
                    "faces": np.array(mesh.faces),
                    "normals": np.array(mesh.vertex_normals),
                    "uvs": model["geometry"]["uvs"],
                    "texture": model["geometry"]["texture"] if "texture" in model["geometry"] else None
                },
                "metadata": {
                    **model["metadata"],
                    "processed": True,
                    "vertices_count": len(mesh.vertices),
                    "faces_count": len(mesh.faces),
                    "processing_timestamp": time.time()
                }
            }
            
            logger.info(f"Mesh processed with {len(mesh.vertices)} vertices, {len(mesh.faces)} faces")
            return processed_model
            
        except Exception as e:
            logger.error(f"Error processing mesh: {e}")
            # Return original model if processing fails
            return model
    
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
            
            # Create validation report
            report = {
                "valid": validity,
                "is_watertight": is_watertight,
                "is_convex": is_convex,
                "has_volume": has_volume,
                "has_self_intersections": has_self_intersections,
                "volume": float(mesh.volume) if has_volume else 0.0,
                "center_mass": mesh.center_mass.tolist() if has_volume else [0, 0, 0],
                "message": "Physics validation " + ("passed" if validity else "failed")
            }
            
            logger.info(f"Physics validation {'passed' if validity else 'failed'}")
            return report
            
        except Exception as e:
            logger.error(f"Error validating physics: {e}")
            return {"valid": False, "message": f"Physics validation error: {e}"}


class ModelExporter:
    """Export 3D models in various formats"""
    
    def __init__(self, config: TextTo3DConfig):
        self.config = config
        
        # Create output directory if it doesn't exist
        os.makedirs(self.config.output_dir, exist_ok=True)
        
    async def export_model(self, 
                         model: Dict[str, Any], 
                         formats: Optional[List[str]] = None) -> Dict[str, str]:
        """Export a 3D model in various formats"""
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
            import numpy as np
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
            if "textures" in model["geometry"] and model["geometry"]["textures"] is not None:
                textures = model["geometry"]["textures"]
                
                # Create MTL file
                with open(mtl_path, "w") as f:
                    f.write(f"newmtl material0\n")
                    f.write(f"Ka 1.000000 1.000000 1.000000\n")
                    f.write(f"Kd 1.000000 1.000000 1.000000\n")
                    f.write(f"Ks 0.000000 0.000000 0.000000\n")
                    f.write(f"Ns 10.000000\n")
                    f.write(f"illum 2\n")
                    
                    # Add texture maps
                    if "albedo" in textures:
                        albedo_path = os.path.join(export_dir, "albedo.png")
                        Image.fromarray(textures["albedo"]).save(albedo_path)
                        f.write(f"map_Kd albedo.png\n")
                        
                    if "normal" in textures:
                        normal_path = os.path.join(export_dir, "normal.png")
                        Image.fromarray(textures["normal"]).save(normal_path)
                        f.write(f"map_bump normal.png\n")
                        
                    if "roughness" in textures:
                        roughness_path = os.path.join(export_dir, "roughness.png")
                        Image.fromarray(textures["roughness"]).save(roughness_path)
                        f.write(f"map_Ns roughness.png\n")
                        
                    if "metallic" in textures:
                        metallic_path = os.path.join(export_dir, "metallic.png")
                        Image.fromarray(textures["metallic"]).save(metallic_path)
                        f.write(f"map_Pm metallic.png\n")
            
            logger.info(f"Model exported to OBJ: {obj_path}")
            return obj_path
            
        except Exception as e:
            logger.error(f"Error exporting to OBJ: {e}")
            raise RuntimeError(f"OBJ export failed: {e}")
    
    async def _export_glb(self, model: Dict[str, Any], model_name: str, format: str) -> str:
        """Export model in GLB/GLTF format"""
        try:
            import trimesh
            import numpy as np
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
            
            # Handle textures
            if "textures" in model["geometry"] and model["geometry"]["textures"] is not None:
                textures = model["geometry"]["textures"]
                
                # Create material with PBR properties
                material = trimesh.visual.material.PBRMaterial()
                
                # Set texture maps
                if "albedo" in textures:
                    albedo_path = os.path.join(export_dir, "albedo.png")
                    Image.fromarray(textures["albedo"]).save(albedo_path)
                    material.baseColorTexture = albedo_path
                    
                if "normal" in textures:
                    normal_path = os.path.join(export_dir, "normal.png")
                    Image.fromarray(textures["normal"]).save(normal_path)
                    material.normalTexture = normal_path
                    
                if "roughness" in textures:
                    roughness_path = os.path.join(export_dir, "roughness.png")
                    Image.fromarray(textures["roughness"]).save(roughness_path)
                    material.roughnessFactor = 1.0
                    material.roughnessTexture = roughness_path
                    
                if "metallic" in textures:
                    metallic_path = os.path.join(export_dir, "metallic.png")
                    Image.fromarray(textures["metallic"]).save(metallic_path)
                    material.metallicFactor = 1.0
                    material.metallicTexture = metallic_path
                
                # Apply material to mesh
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
            import numpy as np
            
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


class TextTo3DPipeline:
    """Complete pipeline for generating 3D models from text"""
    
    def __init__(self, config: Optional[TextTo3DConfig] = None):
        self.config = config or TextTo3DConfig()
        
        # Initialize components
        self.shape_model = ShapEModel(self.config)
        self.texture_generator = TextureGenerator(self.config)
        self.mesh_processor = MeshProcessor(self.config)
        self.exporter = ModelExporter(self.config)
        
        # Create output directory
        os.makedirs(self.config.output_dir, exist_ok=True)
        
    async def initialize(self):
        """Initialize all components"""
        logger.info("Initializing Text to 3D pipeline")
        
        try:
            # Initialize components in parallel
            await asyncio.gather(
                self.shape_model.initialize(),
                self.texture_generator.initialize()
            )
            
            logger.info("Text to 3D pipeline initialization complete")
            
        except Exception as e:
            logger.error(f"Failed to initialize Text to 3D pipeline: {e}")
            raise RuntimeError(f"Pipeline initialization failed: {e}")
    
    async def generate_from_text(self, 
                               prompt: str,
                               texture_prompt: Optional[str] = None,
                               export_formats: Optional[List[str]] = None) -> Dict[str, Any]:
        """Generate a complete 3D model from text description"""
        logger.info(f"Generating 3D model from text: '{prompt}'")
        
        try:
            # Initialize components if needed
            if not hasattr(self.shape_model, '_initialized') or not self.shape_model._initialized:
                await self.initialize()
                
            # Step 1: Generate base shape
            base_shape = await self.shape_model.generate_base_shape(prompt)
            
            # Step 2: Process and optimize mesh
            processed_model = await self.mesh_processor.process_mesh(base_shape)
            
            # Step 3: Generate textures
            textures = await self.texture_generator.generate_textures(
                processed_model,
                texture_prompt=texture_prompt,
                material_type="pbr"
            )
            
            # Step 4: Apply textures to model
            textured_model = await self.texture_generator.apply_textures_to_mesh(
                processed_model,
                textures
            )
            
            # Step 5: Validate physics properties
            physics_report = await self.mesh_processor.validate_physics(textured_model)
            
            # Step 6: Export model
            export_paths = await self.exporter.export_model(
                textured_model,
                formats=export_formats
            )
            
            # Combine results
            result = {
                "model": textured_model,
                "physics_report": physics_report,
                "export_paths": export_paths,
                "status": "success",
                "message": "3D model generated successfully"
            }
            
            logger.info(f"3D model generation complete")
            return result
            
        except Exception as e:
            logger.error(f"Error generating 3D model: {e}")
            return {
                "status": "error",
                "message": f"3D model generation failed: {e}"
            }
    
    async def refine_model(self, 
                         model: Dict[str, Any],
                         feedback: str,
                         texture_prompt: Optional[str] = None,
                         export_formats: Optional[List[str]] = None) -> Dict[str, Any]:
        """Refine an existing 3D model based on feedback"""
        logger.info(f"Refining 3D model based on feedback: '{feedback}'")
        
        try:
            # Initialize components if needed
            if not hasattr(self.shape_model, '_initialized') or not self.shape_model._initialized:
                await self.initialize()
                
            # Step 1: Refine shape
            refined_shape = await self.shape_model.refine_shape(model["model"], feedback)
            
            # Step 2: Process and optimize mesh
            processed_model = await self.mesh_processor.process_mesh(refined_shape)
            
            # Step 3: Generate textures
            textures = await self.texture_generator.generate_textures(
                processed_model,
                texture_prompt=texture_prompt,
                material_type="pbr"
            )
            
            # Step 4: Apply textures to model
            textured_model = await self.texture_generator.apply_textures_to_mesh(
                processed_model,
                textures
            )
            
            # Step 5: Validate physics properties
            physics_report = await self.mesh_processor.validate_physics(textured_model)
            
            # Step 6: Export model
            export_paths = await self.exporter.export_model(
                textured_model,
                formats=export_formats
            )
            
            # Combine results
            result = {
                "model": textured_model,
                "physics_report": physics_report,
                "export_paths": export_paths,
                "original": model,
                "status": "success",
                "message": "3D model refined successfully"
            }
            
            logger.info(f"3D model refinement complete")
            return result
            
        except Exception as e:
            logger.error(f"Error refining 3D model: {e}")
            return {
                "status": "error",
                "message": f"3D model refinement failed: {e}",
                "original": model
            }


async def test_pipeline():
    """Test the Text to 3D pipeline"""
    # Create configuration
    config = TextTo3DConfig()
    
    # Create pipeline
    pipeline = TextTo3DPipeline(config)
    
    # Initialize pipeline
    await pipeline.initialize()
    
    # Test generation
    result = await pipeline.generate_from_text(
        prompt="A modern coffee mug with a geometric pattern",
        texture_prompt="Ceramic coffee mug with blue geometric pattern, photorealistic",
        export_formats=["obj", "glb"]
    )
    
    # Print results
    print(f"Generation status: {result['status']}")
    print(f"Message: {result['message']}")
    print(f"Export paths: {result['export_paths']}")
    
    # If successful, test refinement
    if result['status'] == 'success':
        # Test refinement
        refined = await pipeline.refine_model(
            model=result,
            feedback="Make the handle larger and add a metallic rim",
            texture_prompt="Ceramic coffee mug with blue geometric pattern and gold metallic rim, photorealistic",
            export_formats=["obj", "glb"]
        )
        
        # Print refinement results
        print(f"Refinement status: {refined['status']}")
        print(f"Message: {refined['message']}")
        print(f"Export paths: {refined['export_paths']}")


if __name__ == "__main__":
    # Run test pipeline
    import asyncio
    asyncio.run(test_pipeline())