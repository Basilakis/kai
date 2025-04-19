"""
Enhanced Material Processor with MaterialX Support

This module extends the material_svbrdf_processor with:
1. MaterialX standard support for richer material definitions
2. Procedural material generation capabilities 
3. Improved texture resolution using super-resolution techniques
"""

import os
import json
import numpy as np
import cv2
from PIL import Image
import torch
from typing import Dict, List, Union, Tuple, Optional, Any, Callable

# Import ESRGAN processor for high-quality texture upscaling
try:
    from esrgan_processor import ESRGANProcessor, upscale_image
    ESRGAN_AVAILABLE = True
except ImportError:
    print("Warning: ESRGAN processor not available, falling back to traditional upscaling")
    ESRGAN_AVAILABLE = False

# Import original processor for extension
from material_svbrdf_processor import MaterialSVBRDFProcessor

# Import custom shader library for specialized materials
try:
    from blenderproc_custom_shaders import (
        CustomShaderLibrary,
        create_specialized_shader,
        materialx_to_blenderproc_specialized,
        register_specialized_shaders
    )
    CUSTOM_SHADERS_AVAILABLE = True
except ImportError:
    print("Warning: Custom shader library not available, falling back to standard shaders")
    CUSTOM_SHADERS_AVAILABLE = False

class EnhancedMaterialProcessor(MaterialSVBRDFProcessor):
    """
    Enhanced material processor with MaterialX support, procedural generation,
    and texture upscaling capabilities.
    """
    
    def __init__(self, config=None):
        """
        Initialize the enhanced material processor.
        
        Args:
            config: Configuration dictionary with processing parameters
        """
        super().__init__(config)
        self.materialx_enabled = True
        self.load_super_resolution_model()
        self.procedural_generators = self._initialize_procedural_generators()
        
        # Initialize shader registry for specialized materials
        self.shader_creators = {}
        self._register_default_shader_creators()
        
        # Register custom shaders if available
        if CUSTOM_SHADERS_AVAILABLE:
            register_specialized_shaders(self)
        
    def load_super_resolution_model(self):
        """Load super-resolution model for texture upscaling"""
        try:
            # Load ESRGAN model if available
            if ESRGAN_AVAILABLE:
                self.sr_model = ESRGANProcessor()
                self.sr_device = self.sr_model.device
                print(f"ESRGAN super-resolution model loaded successfully on {self.sr_device}")
            else:
                # Fallback to placeholder
                self.sr_model = None
                self.sr_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
                print("Super-resolution model not available, using traditional upscaling")
        except Exception as e:
            print(f"Warning: Super-resolution model couldn't be loaded: {e}")
            self.sr_model = None
    
    def _initialize_procedural_generators(self):
        """Initialize procedural texture generators"""
        generators = {
            "wood": self._generate_wood_texture,
            "metal": self._generate_metal_texture,
            "fabric": self._generate_fabric_texture,
            "stone": self._generate_stone_texture,
            "plastic": self._generate_plastic_texture,
        }
        return generators
    
    def upscale_texture(self, texture: np.ndarray, scale_factor: int = 2, material_type: Optional[str] = None) -> np.ndarray:
        """
        Upscale texture using super-resolution model
        
        Args:
            texture: Input texture image as numpy array
            scale_factor: Scaling factor (2x, 4x)
            material_type: Type of material for catalog-specific processing
            
        Returns:
            Upscaled texture as numpy array
        """
        # Use ESRGAN if available
        if ESRGAN_AVAILABLE and self.sr_model is not None:
            try:
                # Determine appropriate scale factor (ESRGAN works best with 4x)
                esrgan_scale = 4 if scale_factor > 2 else 2
                
                # Use the ESRGAN processor with material-specific optimizations
                upscaled = self.sr_model.upscale_image(
                    texture, 
                    scale_factor=esrgan_scale,
                    material_type=material_type
                )
                
                # If the requested scale_factor is not what ESRGAN provides,
                # do additional scaling
                if scale_factor != esrgan_scale:
                    additional_scale = scale_factor / esrgan_scale
                    upscaled = cv2.resize(
                        upscaled, 
                        (int(upscaled.shape[1] * additional_scale), 
                         int(upscaled.shape[0] * additional_scale)),
                        interpolation=cv2.INTER_CUBIC
                    )
                
                return upscaled
                
            except Exception as e:
                print(f"Warning: Error during ESRGAN upscaling: {e}. Falling back to traditional upscaling.")
                # Fall back to traditional upscaling on error
        
        # Traditional upscaling fallback
        h, w = texture.shape[:2]
        upscaled = cv2.resize(texture, (w * scale_factor, h * scale_factor), 
                             interpolation=cv2.INTER_CUBIC)
        
        # Apply post-processing to enhance details
        if len(texture.shape) == 3:  # Color image
            upscaled = cv2.detailEnhance(upscaled, sigma_s=10, sigma_r=0.15)
        
        return upscaled
    def _register_default_shader_creators(self):
        """Register default shader creators for common material types"""
        # Standard/default material creators
        self.shader_creators["standard"] = self._create_standard_material
        self.shader_creators["pbr"] = self._create_standard_material
        self.shader_creators["glass"] = self._create_glass_material
        
    def register_shader_creator(self, material_type: str, creator_func: Callable):
        """
        Register a custom shader creator function for a specific material type
        
        Args:
            material_type: Type of material this creator handles
            creator_func: Function that creates the shader material
        """
        self.shader_creators[material_type] = creator_func
        print(f"Registered custom shader creator for '{material_type}' materials")
    
    def _create_standard_material(self, material_data: Dict[str, Any]) -> Any:
        """
        Create a standard PBR material in BlenderProc (fallback method)
        
        Args:
            material_data: Material data dictionary
            
        Returns:
            BlenderProc material object or None if BlenderProc is not available
        """
        try:
            import blenderproc as bproc
        except ImportError:
            print("BlenderProc not available for material creation")
            return None
        
        # Create a standard material
        material = bproc.material.create('standard_material')
        return material
        
    def _create_glass_material(self, material_data: Dict[str, Any]) -> Any:
        """
        Create a glass material in BlenderProc
        
        Args:
            material_data: Material data dictionary
            
        Returns:
            BlenderProc material object or None if BlenderProc is not available
        """
        try:
            import blenderproc as bproc
        except ImportError:
            print("BlenderProc not available for material creation")
            return None
        
        # Create glass material
        material = bproc.material.create('glass_material')
        
        # Set up nodes for glass material if bpy is available
        try:
            import bpy
            
            # Set up nodes for glass material
            nodes = material.node_tree.nodes
            links = material.node_tree.links
            
            # Clear default nodes
            for node in nodes:
                nodes.remove(node)
                
            # Create Principled BSDF shader
            bsdf = nodes.new('ShaderNodeBsdfPrincipled')
            bsdf.location = (0, 0)
            
            # Create output node
            output = nodes.new('ShaderNodeOutputMaterial')
            output.location = (300, 0)
            
            # Connect nodes
            links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
            
            # Set glass material properties
            bsdf.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 0.0)  # Nearly white
            bsdf.inputs['Metallic'].default_value = 0.0
            bsdf.inputs['Roughness'].default_value = 0.0  # Very smooth
            bsdf.inputs['Transmission'].default_value = 1.0  # Fully transparent
            bsdf.inputs['IOR'].default_value = 1.45  # Glass IOR
            
        except ImportError:
            # If bpy is not available, skip node setup
            pass
            
        return material
    def process_svbrdf_to_materialx(self, 
                               albedo: np.ndarray,
                               normal: np.ndarray,
                               roughness: np.ndarray,
                               metallic: np.ndarray = None,
                               displacement: np.ndarray = None,
                               material_type: str = "standard") -> Dict[str, Any]:
        """
        Process SVBRDF maps to MaterialX format
        
        Args:
            albedo: Albedo/base color texture
            normal: Normal map texture
            roughness: Roughness map texture
            metallic: Metallic map texture (optional)
            displacement: Displacement map texture (optional)
            material_type: Type of material definition to generate
            
        Returns:
            MaterialX definition as a dictionary
        """
        # Upscale all textures
        # Determine material type based on textures or provided type
        derived_material_type = material_type
        if derived_material_type is None:
            # Simple heuristic to guess material type from textures
            # In production, this would use a more sophisticated analysis
            if albedo is not None:
                # Check color patterns to guess material type
                mean_color = np.mean(albedo, axis=(0, 1))
                if len(mean_color) >= 3:
                    r, g, b = mean_color[:3]
                    # Brownish tones might be wood
                    if r > g > b and r > 120/255 and g > 60/255 and b < 100/255:
                        derived_material_type = "wood"
                    # Grayish tones might be stone or metal
                    elif abs(r - g) < 0.1 and abs(g - b) < 0.1 and abs(r - b) < 0.1:
                        if np.mean(mean_color) < 0.5:  # Darker
                            derived_material_type = "stone"
                        else:  # Lighter
                            derived_material_type = "metal"
        
        # Upscale all textures using the identified material type
        albedo_hires = self.upscale_texture(albedo, scale_factor=2, material_type=derived_material_type)
        normal_hires = self.upscale_texture(normal, scale_factor=2, material_type=derived_material_type)
        roughness_hires = self.upscale_texture(roughness, scale_factor=2, material_type=derived_material_type)
        
        if metallic is not None:
            metallic_hires = self.upscale_texture(metallic, scale_factor=2, material_type=derived_material_type)
        else:
            metallic_hires = None
            
        if displacement is not None:
            displacement_hires = self.upscale_texture(displacement, scale_factor=2, material_type=derived_material_type)
        else:
            displacement_hires = None
        
        # Save upscaled textures to file
        texture_paths = self._save_textures(
            albedo_hires, normal_hires, roughness_hires, 
            metallic_hires, displacement_hires
        )
        
        # Generate MaterialX document
        materialx_doc = self._generate_materialx_document(
            texture_paths, material_type=material_type
        )
        
        return materialx_doc
    
    def _save_textures(self, 
                      albedo: np.ndarray, 
                      normal: np.ndarray, 
                      roughness: np.ndarray,
                      metallic: Optional[np.ndarray] = None,
                      displacement: Optional[np.ndarray] = None,
                      output_dir: str = "textures") -> Dict[str, str]:
        """
        Save textures to files and return paths
        
        Args:
            albedo: Albedo texture array
            normal: Normal map array
            roughness: Roughness map array
            metallic: Metallic map array (optional)
            displacement: Displacement map array (optional)
            output_dir: Directory to save textures
            
        Returns:
            Dictionary of texture paths
        """
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate a unique ID for this texture set
        import uuid
        texture_id = str(uuid.uuid4())[:8]
        
        paths = {}
        
        # Save albedo
        albedo_path = os.path.join(output_dir, f"{texture_id}_albedo.png")
        cv2.imwrite(albedo_path, cv2.cvtColor(albedo, cv2.COLOR_RGB2BGR))
        paths["albedo"] = albedo_path
        
        # Save normal
        normal_path = os.path.join(output_dir, f"{texture_id}_normal.png")
        cv2.imwrite(normal_path, cv2.cvtColor(normal, cv2.COLOR_RGB2BGR))
        paths["normal"] = normal_path
        
        # Save roughness
        roughness_path = os.path.join(output_dir, f"{texture_id}_roughness.png")
        cv2.imwrite(roughness_path, roughness)
        paths["roughness"] = roughness_path
        
        # Save metallic if provided
        if metallic is not None:
            metallic_path = os.path.join(output_dir, f"{texture_id}_metallic.png")
            cv2.imwrite(metallic_path, metallic)
            paths["metallic"] = metallic_path
        
        # Save displacement if provided
        if displacement is not None:
            displacement_path = os.path.join(output_dir, f"{texture_id}_displacement.png")
            cv2.imwrite(displacement_path, displacement)
            paths["displacement"] = displacement_path
        
        return paths
    
    def _generate_materialx_document(self, 
                                    texture_paths: Dict[str, str],
                                    material_type: str = "standard") -> Dict[str, Any]:
        """
        Generate MaterialX document from texture paths
        
        Args:
            texture_paths: Dictionary of texture file paths
            material_type: Type of material to generate
            
        Returns:
            MaterialX document as dictionary
        """
        # Create a basic MaterialX document structure
        materialx_doc = {
            "materialx": {
                "version": "1.38",
                "materials": [],
                "nodes": []
            }
        }
        
        # Create a unique material name
        material_name = f"material_{os.path.basename(texture_paths['albedo']).split('_')[0]}"
        
        # Create standard physically based material
        if material_type == "standard":
            # Create material node
            material_node = {
                "name": material_name,
                "type": "material",
                "nodedef": "ND_standard_surface",
                "parameters": {
                    "base": 1.0,
                    "specular": 1.0,
                    "roughness": 0.5,
                }
            }
            
            # Add texture connections
            texture_nodes = []
            
            # Albedo texture
            albedo_node = {
                "name": f"{material_name}_albedo",
                "type": "image",
                "parameters": {
                    "file": texture_paths["albedo"],
                    "uaddressmode": "periodic",
                    "vaddressmode": "periodic"
                }
            }
            texture_nodes.append(albedo_node)
            
            # Normal texture
            normal_node = {
                "name": f"{material_name}_normal",
                "type": "normalmap",
                "parameters": {
                    "file": texture_paths["normal"],
                    "scale": 1.0
                }
            }
            texture_nodes.append(normal_node)
            
            # Roughness texture
            roughness_node = {
                "name": f"{material_name}_roughness",
                "type": "image",
                "parameters": {
                    "file": texture_paths["roughness"],
                    "uaddressmode": "periodic",
                    "vaddressmode": "periodic"
                }
            }
            texture_nodes.append(roughness_node)
            
            # Metallic texture if available
            if "metallic" in texture_paths:
                metallic_node = {
                    "name": f"{material_name}_metallic",
                    "type": "image",
                    "parameters": {
                        "file": texture_paths["metallic"],
                        "uaddressmode": "periodic",
                        "vaddressmode": "periodic"
                    }
                }
                texture_nodes.append(metallic_node)
            
            # Displacement texture if available
            if "displacement" in texture_paths:
                displacement_node = {
                    "name": f"{material_name}_displacement",
                    "type": "displacement",
                    "parameters": {
                        "file": texture_paths["displacement"],
                        "scale": 0.1
                    }
                }
                texture_nodes.append(displacement_node)
            
            # Add connections
            connections = [
                {
                    "from": f"{material_name}_albedo.out",
                    "to": f"{material_name}.base_color"
                },
                {
                    "from": f"{material_name}_normal.out",
                    "to": f"{material_name}.normal"
                },
                {
                    "from": f"{material_name}_roughness.out",
                    "to": f"{material_name}.roughness"
                }
            ]
            
            if "metallic" in texture_paths:
                connections.append({
                    "from": f"{material_name}_metallic.out",
                    "to": f"{material_name}.metallic"
                })
            
            if "displacement" in texture_paths:
                connections.append({
                    "from": f"{material_name}_displacement.out",
                    "to": f"{material_name}.displacement"
                })
            
            # Add nodes and connections to document
            materialx_doc["materialx"]["materials"].append(material_node)
            materialx_doc["materialx"]["nodes"].extend(texture_nodes)
            materialx_doc["materialx"]["connections"] = connections
        
        return materialx_doc
    
    def generate_procedural_material(self, 
                                    material_type: str, 
                                    resolution: Tuple[int, int] = (1024, 1024),
                                    parameters: Dict[str, Any] = None) -> Dict[str, np.ndarray]:
        """
        Generate procedural material textures
        
        Args:
            material_type: Type of material to generate (wood, metal, fabric, stone, plastic)
            resolution: Texture resolution as (width, height)
            parameters: Material-specific parameters
            
        Returns:
            Dictionary of generated texture maps
        """
        if material_type not in self.procedural_generators:
            raise ValueError(f"Unsupported material type: {material_type}")
        
        if parameters is None:
            parameters = {}
        
        # Call the appropriate generator
        generator_func = self.procedural_generators[material_type]
        textures = generator_func(resolution, parameters)
        
        return textures
    
    def _generate_wood_texture(self, 
                             resolution: Tuple[int, int],
                             parameters: Dict[str, Any]) -> Dict[str, np.ndarray]:
        """Generate procedural wood material textures"""
        # Get parameters with defaults
        wood_color = parameters.get('color', [0.6, 0.4, 0.2])
        grain_frequency = parameters.get('grain_frequency', 20)
        grain_turbulence = parameters.get('turbulence', 0.2)
        
        width, height = resolution
        
        # Create base noise
        x = np.linspace(0, 1, width)
        y = np.linspace(0, 1, height)
        xx, yy = np.meshgrid(x, y)
        
        # Wood grain pattern
        noise = np.sin(xx * grain_frequency + 
                      grain_turbulence * self._perlin_noise(xx * 3, yy * 3)) * 0.5 + 0.5
        
        # Create textures
        albedo = np.zeros((height, width, 3), dtype=np.uint8)
        roughness = np.zeros((height, width), dtype=np.uint8)
        normal = np.zeros((height, width, 3), dtype=np.uint8)
        
        # Color mapping for albedo
        for c in range(3):
            color_val = int(wood_color[c] * 255)
            color_variation = noise * 80  # Color variation based on noise
            channel = np.clip(color_val - color_variation, 0, 255).astype(np.uint8)
            albedo[:, :, c] = channel
        
        # Roughness varies with grain
        roughness = (0.7 - noise * 0.3) * 255
        roughness = roughness.astype(np.uint8)
        
        # Simple normal map
        normal[:, :, 0] = 128  # Red channel centered at 128
        normal[:, :, 1] = 128  # Green channel centered at 128
        
        # Blue channel is always 255 for flat normal
        normal_z = np.ones((height, width)) * 255
        
        # Apply some grain variation to normal
        dx = np.zeros((height, width))
        dy = np.zeros((height, width))
        
        # Compute gradient of noise for normal map
        dx[1:-1, 1:-1] = (noise[1:-1, 2:] - noise[1:-1, :-2]) * 5
        dy[1:-1, 1:-1] = (noise[2:, 1:-1] - noise[:-2, 1:-1]) * 5
        
        # Convert to normal map
        normal[:, :, 0] = np.clip(128 + dx * 127, 0, 255).astype(np.uint8)
        normal[:, :, 1] = np.clip(128 + dy * 127, 0, 255).astype(np.uint8)
        normal[:, :, 2] = np.clip(255 - np.sqrt(dx**2 + dy**2) * 127, 0, 255).astype(np.uint8)
        
        return {
            "albedo": albedo,
            "roughness": roughness,
            "normal": normal
        }
    
    def _generate_metal_texture(self, 
                              resolution: Tuple[int, int],
                              parameters: Dict[str, Any]) -> Dict[str, np.ndarray]:
        """Generate procedural metal material textures"""
        # Get parameters with defaults
        metal_color = parameters.get('color', [0.8, 0.8, 0.9])
        scratch_density = parameters.get('scratch_density', 0.2)
        roughness_value = parameters.get('roughness', 0.1)
        
        width, height = resolution
        
        # Create base noise for metal pattern
        x = np.linspace(0, 5, width)
        y = np.linspace(0, 5, height)
        xx, yy = np.meshgrid(x, y)
        
        # Metal base pattern
        base_noise = self._perlin_noise(xx, yy) * 0.1 + 0.9
        
        # Scratches
        scratch_mask = np.random.random((height, width)) > (1.0 - scratch_density)
        scratch_angles = np.random.random((height, width)) * np.pi
        scratch_length = np.random.randint(5, 20, (height, width))
        
        # Create scratch pattern
        scratches = np.zeros((height, width))
        for y in range(height):
            for x in range(width):
                if scratch_mask[y, x]:
                    angle = scratch_angles[y, x]
                    length = scratch_length[y, x]
                    dx = int(np.cos(angle) * length)
                    dy = int(np.sin(angle) * length)
                    
                    # Draw scratch line
                    for i in range(length):
                        t = i / length
                        px = int(x + dx * t)
                        py = int(y + dy * t)
                        
                        if 0 <= px < width and 0 <= py < height:
                            scratches[py, px] = 1.0
        
        # Blur scratches slightly
        scratches = cv2.GaussianBlur(scratches, (3, 3), 0)
        
        # Create textures
        albedo = np.zeros((height, width, 3), dtype=np.uint8)
        roughness = np.zeros((height, width), dtype=np.uint8)
        normal = np.zeros((height, width, 3), dtype=np.uint8)
        metallic = np.ones((height, width), dtype=np.uint8) * 255  # Fully metallic
        
        # Color mapping for albedo with minor variations
        for c in range(3):
            color_val = int(metal_color[c] * 255)
            albedo[:, :, c] = np.clip(color_val * base_noise, 0, 255).astype(np.uint8)
        
        # Roughness: scratches increase roughness
        roughness = np.clip((roughness_value + scratches * 0.5) * 255, 0, 255).astype(np.uint8)
        
        # Normal map: scratches affect normal
        normal[:, :, 0] = 128  # Red channel centered at 128
        normal[:, :, 1] = 128  # Green channel centered at 128
        normal[:, :, 2] = 255  # Blue channel is 255 for flat surface
        
        # Apply some variation to normal based on scratches
        normal_strength = 0.3
        for y in range(1, height-1):
            for x in range(1, width-1):
                if scratches[y, x] > 0.1:
                    # Compute simple gradient for normal
                    dx = scratches[y, x+1] - scratches[y, x-1]
                    dy = scratches[y+1, x] - scratches[y-1, x]
                    
                    normal[y, x, 0] = np.clip(128 + dx * 127 * normal_strength, 0, 255).astype(np.uint8)
                    normal[y, x, 1] = np.clip(128 + dy * 127 * normal_strength, 0, 255).astype(np.uint8)
        
        return {
            "albedo": albedo,
            "roughness": roughness,
            "normal": normal,
            "metallic": metallic
        }
    
    def _generate_fabric_texture(self, 
                               resolution: Tuple[int, int],
                               parameters: Dict[str, Any]) -> Dict[str, np.ndarray]:
        """Generate procedural fabric material textures"""
        # Placeholder implementation - would be more complex in production
        # Implement a basic woven pattern for fabric
        
        # Get parameters with defaults
        fabric_color = parameters.get('color', [0.7, 0.7, 0.9])
        weave_scale = parameters.get('weave_scale', 10)
        roughness_value = parameters.get('roughness', 0.7)
        
        width, height = resolution
        
        # Create weave pattern
        x = np.arange(width)
        y = np.arange(height)
        xx, yy = np.meshgrid(x, y)
        
        # Create two different thread patterns
        pattern1 = np.sin(xx * np.pi / weave_scale) > 0
        pattern2 = np.sin(yy * np.pi / weave_scale) > 0
        
        # Combine patterns to create weave
        weave = np.logical_xor(pattern1, pattern2).astype(np.float32) * 0.2 + 0.8
        
        # Add some noise for realism
        noise = np.random.random((height, width)) * 0.1
        weave = np.clip(weave + noise, 0, 1)
        
        # Create textures
        albedo = np.zeros((height, width, 3), dtype=np.uint8)
        roughness = np.zeros((height, width), dtype=np.uint8)
        normal = np.zeros((height, width, 3), dtype=np.uint8)
        
        # Color mapping for albedo
        for c in range(3):
            color_val = int(fabric_color[c] * 255)
            albedo[:, :, c] = np.clip(color_val * weave, 0, 255).astype(np.uint8)
        
        # Roughness: fabric is generally rough
        roughness_map = (roughness_value - (1 - weave) * 0.1) * 255
        roughness = np.clip(roughness_map, 0, 255).astype(np.uint8)
        
        # Normal map: weave pattern creates height variation
        normal[:, :, 0] = 128  # Red channel centered at 128
        normal[:, :, 1] = 128  # Green channel centered at 128
        normal[:, :, 2] = 255  # Blue channel is 255 for flat surface
        
        # Create normal map from weave height
        dx = np.zeros((height, width))
        dy = np.zeros((height, width))
        
        # Compute gradient of weave for normal map
        dx[1:-1, 1:-1] = (weave[1:-1, 2:] - weave[1:-1, :-2]) * 2
        dy[1:-1, 1:-1] = (weave[2:, 1:-1] - weave[:-2, 1:-1]) * 2
        
        # Convert to normal map
        normal[:, :, 0] = np.clip(128 + dx * 127, 0, 255).astype(np.uint8)
        normal[:, :, 1] = np.clip(128 + dy * 127, 0, 255).astype(np.uint8)
        normal[:, :, 2] = np.clip(255 - np.sqrt(dx**2 + dy**2) * 127, 0, 255).astype(np.uint8)
        
        return {
            "albedo": albedo,
            "roughness": roughness,
            "normal": normal
        }
    
    def _generate_stone_texture(self, 
                              resolution: Tuple[int, int],
                              parameters: Dict[str, Any]) -> Dict[str, np.ndarray]:
        """Generate procedural stone material textures"""
        # Get parameters with defaults
        stone_color = parameters.get('color', [0.5, 0.5, 0.5])
        noise_scale = parameters.get('noise_scale', 5)
        roughness_value = parameters.get('roughness', 0.8)
        
        width, height = resolution
        
        # Create base noise for stone pattern
        x = np.linspace(0, noise_scale, width)
        y = np.linspace(0, noise_scale, height)
        xx, yy = np.meshgrid(x, y)
        
        # Combine multiple noise layers for realistic stone
        noise1 = self._perlin_noise(xx, yy)
        noise2 = self._perlin_noise(xx * 2, yy * 2) * 0.5
        noise3 = self._perlin_noise(xx * 4, yy * 4) * 0.25
        
        stone_noise = (noise1 + noise2 + noise3) / 1.75
        stone_noise = np.clip(stone_noise, 0, 1)
        
        # Create some cracks
        crack_threshold = parameters.get('crack_density', 0.7)
        cracks = (self._perlin_noise(xx * 8, yy * 8) > crack_threshold).astype(np.float32) * 0.3
        
        # Combine stone noise with cracks
        stone_pattern = np.clip(stone_noise - cracks, 0, 1)
        
        # Create textures
        albedo = np.zeros((height, width, 3), dtype=np.uint8)
        roughness = np.zeros((height, width), dtype=np.uint8)
        normal = np.zeros((height, width, 3), dtype=np.uint8)
        
        # Color mapping for albedo with variations
        base_color = np.array(stone_color) * 255
        color_variation = stone_pattern * 0.4 + 0.8  # 0.8 to 1.2 multiplier
        
        for c in range(3):
            color_val = base_color[c]
            albedo[:, :, c] = np.clip(color_val * color_variation, 0, 255).astype(np.uint8)
        
        # Add slight color variation for realism
        color_noise = np.random.random((height, width, 3)) * 10
        albedo = np.clip(albedo + color_noise, 0, 255).astype(np.uint8)
        
        # Roughness: stone is rough, cracks are rougher
        roughness_map = (roughness_value + cracks) * 255
        roughness = np.clip(roughness_map, 0, 255).astype(np.uint8)
        
        # Normal map: stone pattern and cracks create height variation
        normal[:, :, 0] = 128  # Red channel centered at 128
        normal[:, :, 1] = 128  # Green channel centered at 128
        normal[:, :, 2] = 255  # Blue channel is 255 for flat surface
        
        # Create displacement for height
        displacement = stone_pattern * 0.95 + 0.05  # 0.05 to 1.0 range
        
        # Create normal map from displacement
        dx = np.zeros((height, width))
        dy = np.zeros((height, width))
        
        # Compute gradient of displacement for normal map
        dx[1:-1, 1:-1] = (displacement[1:-1, 2:] - displacement[1:-1, :-2]) * 5
        dy[1:-1, 1:-1] = (displacement[2:, 1:-1] - displacement[:-2, 1:-1]) * 5
        
        # Convert to normal map
        normal[:, :, 0] = np.clip(128 + dx * 127, 0, 255).astype(np.uint8)
        normal[:, :, 1] = np.clip(128 + dy * 127, 0, 255).astype(np.uint8)
        normal[:, :, 2] = np.clip(255 - np.sqrt(dx**2 + dy**2) * 127, 0, 255).astype(np.uint8)
        
        # Create displacement map
        displacement_map = (displacement * 255).astype(np.uint8)
        
        return {
            "albedo": albedo,
            "roughness": roughness,
            "normal": normal,
            "displacement": displacement_map
        }
    
    def _generate_plastic_texture(self, 
                                resolution: Tuple[int, int],
                                parameters: Dict[str, Any]) -> Dict[str, np.ndarray]:
        """Generate procedural plastic material textures"""
        # Get parameters with defaults
        plastic_color = parameters.get('color', [0.2, 0.4, 0.8])
        specular = parameters.get('specular', 0.5)
        roughness_value = parameters.get('roughness', 0.2)
        
        width, height = resolution
        
        # Create subtle noise for plastic surface
        x = np.linspace(0, 3, width)
        y = np.linspace(0, 3, height)
        xx, yy = np.meshgrid(x, y)
        
        # Very subtle noise for plastic
        noise = self._perlin_noise(xx, yy) * 0.05 + 0.95
        
        # Fingerprints and smudges
        num_smudges = int(parameters.get('smudge_density', 0.1) * 10)
        smudges = np.zeros((height, width))
        
        for _ in range(num_smudges):
            # Random position for smudge
            cx = np.random.randint(0, width)
            cy = np.random.randint(0, height)
            
            # Random size and opacity
            size = np.random.randint(20, 100)
            opacity = np.random.random() * 0.2
            
            # Create circular smudge
            for y in range(max(0, cy-size), min(height, cy+size)):
                for x in range(max(0, cx-size), min(width, cx+size)):
                    dist = np.sqrt((x - cx)**2 + (y - cy)**2)
                    if dist < size:
                        # Falloff from center
                        falloff = 1 - (dist / size)
                        smudges[y, x] = max(smudges[y, x], falloff * opacity)
        
        # Create textures
        albedo = np.zeros((height, width, 3), dtype=np.uint8)
        roughness = np.zeros((height, width), dtype=np.uint8)
        normal = np.zeros((height, width, 3), dtype=np.uint8)
        
        # Color mapping for albedo (solid color with subtle noise)
        for c in range(3):
            color_val = int(plastic_color[c] * 255)
            albedo[:, :, c] = np.clip(color_val * noise, 0, 255).astype(np.uint8)
        
        # Roughness: plastic is smooth but smudges add roughness
        roughness_map = (roughness_value + smudges * 0.8) * 255
        roughness = np.clip(roughness_map, 0, 255).astype(np.uint8)
        
        # Normal map: mostly flat with very subtle variation
        normal[:, :, 0] = 128  # Red channel centered at 128
        normal[:, :, 1] = 128  # Green channel centered at 128
        normal[:, :, 2] = 255  # Blue channel is 255 for flat surface
        
        # Subtle normal map variation from noise
        dx = np.zeros((height, width))
        dy = np.zeros((height, width))
        
        # Compute subtle gradient for normal map
        noise_for_normal = noise * smudges * 10  # Amplify effect in smudged areas
        dx[1:-1, 1:-1] = (noise_for_normal[1:-1, 2:] - noise_for_normal[1:-1, :-2])
        dy[1:-1, 1:-1] = (noise_for_normal[2:, 1:-1] - noise_for_normal[:-2, 1:-1])
        
        # Convert to normal map
        normal[:, :, 0] = np.clip(128 + dx * 127, 0, 255).astype(np.uint8)
        normal[:, :, 1] = np.clip(128 + dy * 127, 0, 255).astype(np.uint8)
        normal[:, :, 2] = np.clip(255 - np.sqrt(dx**2 + dy**2) * 127, 0, 255).astype(np.uint8)
        
        return {
            "albedo": albedo,
            "roughness": roughness,
            "normal": normal
        }
    
    def _perlin_noise(self, x, y, seed=0):
        """Simple Perlin noise implementation for procedural textures"""
        # This is a simplified version - actual implementation would use a proper
        # Perlin noise library or more efficient algorithm
        
        import numpy as np
        
        # Set random seed for reproducibility
        np.random.seed(seed)
        
        # Create grid of random gradient vectors
        def generate_gradients(shape):
            angles = 2 * np.pi * np.random.random(shape)
            return np.stack([np.cos(angles), np.sin(angles)], axis=-1)
        
        x_int = x.astype(int)
        y_int = y.astype(int)
        
        grid_shape = (int(np.max(y_int)) + 2, int(np.max(x_int)) + 2, 2)
        gradients = generate_gradients(grid_shape[:2])
        
        x_frac = x - x_int
        y_frac = y - y_int
        
        n00 = np.sum(np.stack([x_frac, y_frac], axis=-1) * 
                   gradients[y_int, x_int], axis=-1)
        n01 = np.sum(np.stack([x_frac, y_frac - 1], axis=-1) * 
                   gradients[y_int + 1, x_int], axis=-1)
        n10 = np.sum(np.stack([x_frac - 1, y_frac], axis=-1) * 
                   gradients[y_int, x_int + 1], axis=-1)
        n11 = np.sum(np.stack([x_frac - 1, y_frac - 1], axis=-1) * 
                   gradients[y_int + 1, x_int + 1], axis=-1)
        
        # Smooth interpolation
        def fade(t):
            return t * t * t * (t * (t * 6 - 15) + 10)
        
        x_fade = fade(x_frac)
        y_fade = fade(y_frac)
        
        nx0 = n00 * (1 - x_fade) + n10 * x_fade
        nx1 = n01 * (1 - x_fade) + n11 * x_fade
        
        noise = nx0 * (1 - y_fade) + nx1 * y_fade
        
        # Normalize to 0-1 range
        noise = noise * 0.5 + 0.5
        
        return noise
    
    def suggest_material_for_object(self, object_type: str, style: str = "modern") -> Dict[str, Any]:
        """
        Suggest appropriate material for an object based on its type and style
        
        Args:
            object_type: Type of object (table, chair, wall, floor, etc.)
            style: Design style (modern, rustic, industrial, etc.)
            
        Returns:
            Dictionary with suggested material parameters
        """
        # Material suggestion lookup table (would be more sophisticated with ML)
        material_suggestions = {
            "table": {
                "modern": {
                    "type": "wood",
                    "parameters": {
                        "color": [0.8, 0.7, 0.6],
                        "grain_frequency": 15,
                        "turbulence": 0.1
                    }
                },
                "rustic": {
                    "type": "wood",
                    "parameters": {
                        "color": [0.6, 0.4, 0.2],
                        "grain_frequency": 25,
                        "turbulence": 0.3
                    }
                },
                "industrial": {
                    "type": "metal",
                    "parameters": {
                        "color": [0.7, 0.7, 0.7],
                        "scratch_density": 0.3,
                        "roughness": 0.2
                    }
                }
            },
            "floor": {
                "modern": {
                    "type": "wood",
                    "parameters": {
                        "color": [0.9, 0.8, 0.7],
                        "grain_frequency": 10,
                        "turbulence": 0.1
                    }
                },
                "rustic": {
                    "type": "wood",
                    "parameters": {
                        "color": [0.5, 0.4, 0.3],
                        "grain_frequency": 20,
                        "turbulence": 0.4
                    }
                },
                "industrial": {
                    "type": "stone",
                    "parameters": {
                        "color": [0.6, 0.6, 0.6],
                        "noise_scale": 3,
                        "crack_density": 0.8
                    }
                }
            },
            "wall": {
                "modern": {
                    "type": "plastic",
                    "parameters": {
                        "color": [0.95, 0.95, 0.95],
                        "roughness": 0.1,
                        "smudge_density": 0.05
                    }
                },
                "rustic": {
                    "type": "stone",
                    "parameters": {
                        "color": [0.8, 0.75, 0.7],
                        "noise_scale": 4,
                        "crack_density": 0.6
                    }
                },
                "industrial": {
                    "type": "metal",
                    "parameters": {
                        "color": [0.5, 0.5, 0.55],
                        "scratch_density": 0.1,
                        "roughness": 0.3
                    }
                }
            }
        }
        
        # Default material if no match
        default_material = {
            "type": "plastic",
            "parameters": {
                "color": [0.8, 0.8, 0.8],
                "roughness": 0.2,
                "smudge_density": 0.1
            }
        }
        
        # Get material suggestion
        object_materials = material_suggestions.get(object_type, {})
        material = object_materials.get(style, default_material)
        
        return material
    
    def convert_to_three_js_material(self, materialx_doc: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert MaterialX document to Three.js compatible material definition
        
        Args:
            materialx_doc: MaterialX document
            
        Returns:
            Three.js material definition
        """
        # Extract material properties and textures from MaterialX
        material_props = {}
        texture_paths = {}
        
        # Find material node
        material_node = None
        for node in materialx_doc.get("materialx", {}).get("materials", []):
            material_node = node
            break
        
        if not material_node:
            return {"type": "MeshStandardMaterial"}
        
        # Get texture nodes
        texture_nodes = materialx_doc.get("materialx", {}).get("nodes", [])
        
        # Extract texture paths
        for node in texture_nodes:
            if "file" in node.get("parameters", {}):
                node_type = node["type"]
                if node_type == "image":
                    if "albedo" in node["name"]:
                        texture_paths["map"] = node["parameters"]["file"]
                    elif "roughness" in node["name"]:
                        texture_paths["roughnessMap"] = node["parameters"]["file"]
                    elif "metallic" in node["name"]:
                        texture_paths["metalnessMap"] = node["parameters"]["file"]
                elif node_type == "normalmap":
                    texture_paths["normalMap"] = node["parameters"]["file"]
                elif node_type == "displacement":
                    texture_paths["displacementMap"] = node["parameters"]["file"]
        
        # Create Three.js material
        three_material = {
            "type": "MeshStandardMaterial",
            "parameters": {
                "color": "#ffffff",  # Will be multiplied by the albedo texture
                "roughness": material_node.get("parameters", {}).get("roughness", 0.5),
                "metalness": 0.0  # Will be overridden by metalness texture if present
            },
            "textures": texture_paths
        }
        
        return three_material
        
    def convert_to_blenderproc_material(self, materialx_doc: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert MaterialX document to BlenderProc compatible material definition
        
        Args:
            materialx_doc: MaterialX document
            
        Returns:
            BlenderProc compatible material definition
        """
        # Extract material properties and textures from MaterialX
        material_props = {}
        material_node = None
        
        for node in materialx_doc.get("materialx", {}).get("materials", []):
            material_node = node
            break
            
        if not material_node:
            raise ValueError("No material found in MaterialX document")
            
        # Get shader type (e.g., standard_surface, pbr, etc.)
        shader_type = material_node.get("nodedef", "ND_standard_surface").replace("ND_", "")
        
        # Check if this is a specialized material type that needs custom shader
        # These types come from material_type parameter
        specialized_types = [
            "anisotropic", "subsurface", "thin_film", "procedural", "layered"
        ]
        
        if "type" in material_node and material_node["type"] in specialized_types:
            # Mark for specialized shader processing
            shader_type = material_node["type"]
            material_props["requires_specialized_shader"] = True

            # Extract specialized material parameters
            if shader_type == "anisotropic":
                if "anisotropy" in params:
                    material_props["anisotropy"] = params["anisotropy"]
                if "anisotropyRotation" in params:
                    material_props["anisotropyRotation"] = params["anisotropyRotation"]
            elif shader_type == "subsurface":
                if "subsurfaceColor" in params:
                    material_props["subsurfaceColor"] = params["subsurfaceColor"]
                if "subsurfaceRadius" in params:
                    material_props["subsurfaceRadius"] = params["subsurfaceRadius"]
                if "subsurfaceScale" in params:
                    material_props["subsurfaceScale"] = params["subsurfaceScale"]
            elif shader_type == "thin_film":
                if "filmThickness" in params:
                    material_props["filmThickness"] = params["filmThickness"]
                if "filmIOR" in params:
                    material_props["filmIOR"] = params["filmIOR"]
            elif shader_type == "procedural":
                if "textureType" in params:
                    material_props["textureType"] = params["textureType"]
                if "scale" in params:
                    material_props["scale"] = params["scale"]
                if "detail" in params:
                    material_props["detail"] = params["detail"]
                if "distortion" in params:
                    material_props["distortion"] = params["distortion"]
            elif shader_type == "layered":
                if "blendFactor" in params:
                    material_props["blendFactor"] = params["blendFactor"]
                if "blendType" in params:
                    material_props["blendType"] = params["blendType"]
                # Base and top materials would be extracted separately
        # Get texture nodes
        texture_nodes = materialx_doc.get("materialx", {}).get("nodes", [])
        texture_paths = {}
        
        for node in texture_nodes:
            if "parameters" in node and "file" in node["parameters"]:
                if "albedo" in node["name"]:
                    texture_paths["baseColor"] = node["parameters"]["file"]
                elif "roughness" in node["name"]:
                    texture_paths["roughness"] = node["parameters"]["file"]
                elif "metallic" in node["name"]:
                    texture_paths["metallic"] = node["parameters"]["file"]
                elif "normal" in node["name"]:
                    texture_paths["normal"] = node["parameters"]["file"]
                elif "displacement" in node["name"]:
                    texture_paths["displacement"] = node["parameters"]["file"]
                elif "emissive" in node["name"]:
                    texture_paths["emission"] = node["parameters"]["file"]
                
        # Extract basic properties from parameters
        if "parameters" in material_node:
            params = material_node["parameters"]
            
            if "base" in params:
                material_props["base_factor"] = params["base"]
            if "base_color" in params:
                material_props["base_color"] = params["base_color"]
            if "roughness" in params:
                material_props["roughness"] = params["roughness"]
            if "metallic" in params:
                material_props["metallic"] = params["metallic"]
            if "specular" in params:
                material_props["specular"] = params["specular"]
            if "normal_scale" in params:
                material_props["normal_scale"] = params["normal_scale"]
            if "emissive" in params:
                material_props["emission_color"] = params["emissive"]
            if "emissive_strength" in params:
                material_props["emission_strength"] = params["emissive_strength"]
            
        # Create BlenderProc compatible material definition
        blenderproc_material = {
            "name": material_node.get("name", "MaterialX_Material"),
            "shader_type": shader_type,
            "properties": material_props,
            "texture_paths": texture_paths
        }
        
        return blenderproc_material
        
    def apply_to_blenderproc(self, materialx_doc: Dict[str, Any], blenderproc_instance) -> Any:
        """
        Apply MaterialX document to a BlenderProc material
        
        Args:
            materialx_doc: MaterialX document
            blenderproc_instance: Instance of BlenderProc
            
        Returns:
            The created Blender material object
        """
        try:
            # Create logger if it doesn't exist
            import logging
            logger = logging.getLogger("EnhancedMaterialProcessor")
            
            # Convert MaterialX to BlenderProc compatible format
            bp_material = self.convert_to_blenderproc_material(materialx_doc)
            
            # Check if this material requires a specialized shader
            if (bp_material["properties"].get("requires_specialized_shader", False) and 
                CUSTOM_SHADERS_AVAILABLE):
                # Use specialized shader creator if available
                shader_type = bp_material["shader_type"]
                
                if shader_type in self.shader_creators:
                    # Use registered shader creator
                    logger.info(f"Using specialized shader for material type: {shader_type}")
                    bpy_material = self.shader_creators[shader_type](bp_material["properties"])
                    
                    # Apply specialized material
                    return bpy_material
                elif CUSTOM_SHADERS_AVAILABLE:
                    # Fall back to custom shader library's create_specialized_shader
                    logger.info(f"Using custom shader library for material type: {shader_type}")
                    bpy_material = create_specialized_shader(bp_material["properties"], shader_type)
                    if bpy_material:
                        return bpy_material
            
            # If no specialized shader was used, create standard material
            bpy_material = blenderproc_instance.material.create(bp_material["name"])
            
    def process_materialx_to_blenderproc_all(self, materialx_doc: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process all materials in a MaterialX document to BlenderProc materials,
        including specialized materials with custom shaders
        
        Args:
            materialx_doc: MaterialX document with multiple materials
            
        Returns:
            Dictionary mapping material names to BlenderProc materials
        """
        if not CUSTOM_SHADERS_AVAILABLE:
            print("Warning: Custom shader library not available, some materials may not render correctly")
            
        # Convert standard materials
        standard_materials = self.convert_standard_materials(materialx_doc)
        
        # If custom shaders are available, process specialized materials
        specialized_materials = {}
        if CUSTOM_SHADERS_AVAILABLE:
            specialized_materials = materialx_to_blenderproc_specialized(materialx_doc)
            
        # Combine results
        all_materials = {**standard_materials, **specialized_materials}
        
        return all_materials
            
    def convert_standard_materials(self, materialx_doc: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert standard (non-specialized) materials from MaterialX to BlenderProc
        
        Args:
            materialx_doc: MaterialX document
            
        Returns:
            Dictionary mapping material names to BlenderProc materials
        """
        materials = {}
        
        try:
            import blenderproc as bproc
        except ImportError:
            print("BlenderProc not available, cannot convert materials")
            return materials
            
        # Process each material in the MaterialX document
        for material_node in materialx_doc.get("materialx", {}).get("materials", []):
            material_name = material_node.get("name", "unnamed_material")
            
            # Skip specialized materials (they're handled separately)
            if material_node.get("type") in ["anisotropic", "subsurface", "thin_film", "procedural", "layered"]:
                continue
                
            # Create a temporary document with just this material
            single_material_doc = {
                "materialx": {
                    "version": materialx_doc.get("materialx", {}).get("version", "1.38"),
                    "materials": [material_node],
                    "nodes": materialx_doc.get("materialx", {}).get("nodes", []),
                    "connections": materialx_doc.get("materialx", {}).get("connections", [])
                }
            }
            
            # Convert to BlenderProc material
            bp_material = self.convert_to_blenderproc_material(single_material_doc)
            
            # Create material in BlenderProc
            material = bproc.material.create(material_name)
            
            # Apply basic properties and textures
            self.apply_standard_properties(material, bp_material, bproc)
            
            materials[material_name] = material
            
        return materials
        
    def apply_standard_properties(self, material, bp_material: Dict[str, Any], bproc_instance) -> None:
        """
        Apply standard material properties to a BlenderProc material
        
        Args:
            material: BlenderProc material object
            bp_material: BlenderProc material definition
            bproc_instance: BlenderProc instance
        """
        # Set basic properties
        for prop_name, prop_value in bp_material["properties"].items():
            if prop_name == "base_color" and isinstance(prop_value, list):
                r, g, b = prop_value[0:3] if len(prop_value) >= 3 else (prop_value[0], prop_value[0], prop_value[0])
                bproc_instance.material.set_principled_shader_value(material, "Base Color", [r, g, b, 1.0])
            elif prop_name == "roughness":
                bproc_instance.material.set_principled_shader_value(material, "Roughness", prop_value)
            elif prop_name == "metallic":
                bproc_instance.material.set_principled_shader_value(material, "Metallic", prop_value)
            elif prop_name == "specular":
                bproc_instance.material.set_principled_shader_value(material, "Specular", prop_value)
                
        # Apply textures
        for tex_name, tex_path in bp_material["texture_paths"].items():
            if tex_name == "baseColor":
                bproc_instance.material.set_principled_shader_texture(material, "Base Color", tex_path)
            elif tex_name == "roughness":
                bproc_instance.material.set_principled_shader_texture(material, "Roughness", tex_path)
            elif tex_name == "metallic":
                bproc_instance.material.set_principled_shader_texture(material, "Metallic", tex_path)
            elif tex_name == "normal":
                bproc_instance.material.set_principled_shader_texture(material, "Normal", tex_path)
            # Set basic properties
            for prop_name, prop_value in bp_material["properties"].items():
                if prop_name == "base_color" and isinstance(prop_value, list):
                    r, g, b = prop_value[0:3] if len(prop_value) >= 3 else (prop_value[0], prop_value[0], prop_value[0])
                    blenderproc_instance.material.set_principled_shader_value(bpy_material, "Base Color", [r, g, b, 1.0])
                elif prop_name == "roughness":
                    blenderproc_instance.material.set_principled_shader_value(bpy_material, "Roughness", prop_value)
                elif prop_name == "metallic":
                    blenderproc_instance.material.set_principled_shader_value(bpy_material, "Metallic", prop_value)
                elif prop_name == "specular":
                    blenderproc_instance.material.set_principled_shader_value(bpy_material, "Specular", prop_value)
                elif prop_name == "emission_color" and isinstance(prop_value, list):
                    r, g, b = prop_value[0:3] if len(prop_value) >= 3 else (prop_value[0], prop_value[0], prop_value[0])
                    blenderproc_instance.material.set_principled_shader_value(bpy_material, "Emission", [r, g, b, 1.0])
                elif prop_name == "emission_strength":
                    blenderproc_instance.material.set_principled_shader_value(bpy_material, "Emission Strength", prop_value)
                elif prop_name == "normal_scale":
                    # Handle normal scale in texture application
                    pass
                    
            # Apply textures
            for tex_name, tex_path in bp_material["texture_paths"].items():
                if tex_name == "baseColor":
                    blenderproc_instance.material.set_principled_shader_texture(bpy_material, "Base Color", tex_path)
                elif tex_name == "roughness":
                    blenderproc_instance.material.set_principled_shader_texture(bpy_material, "Roughness", tex_path)
                elif tex_name == "metallic":
                    blenderproc_instance.material.set_principled_shader_texture(bpy_material, "Metallic", tex_path)
                elif tex_name == "normal":
                    # Get normal scale value if available
                    normal_scale = bp_material["properties"].get("normal_scale", 1.0)
                    # Set texture and scale
                    blenderproc_instance.material.set_principled_shader_texture(bpy_material, "Normal", tex_path)
                    # Update normal scale if the API supports it
                    if hasattr(blenderproc_instance.material, "set_normal_map_strength"):
                        blenderproc_instance.material.set_normal_map_strength(bpy_material, normal_scale)
                elif tex_name == "displacement":
                    # Handle displacement maps differently in BlenderProc
                    if hasattr(blenderproc_instance.material, "set_displacement_texture"):
                        blenderproc_instance.material.set_displacement_texture(bpy_material, tex_path)
                elif tex_name == "emission":
                    blenderproc_instance.material.set_principled_shader_texture(bpy_material, "Emission", tex_path)
            
            logger.info(f"Successfully applied MaterialX to BlenderProc material: {bp_material['name']}")
            return bpy_material
        except Exception as e:
            # Handle errors during material application
            if 'logger' in locals():
                logger.error(f"Error applying MaterialX to BlenderProc: {e}")
            print(f"Error applying MaterialX to BlenderProc: {e}")
            raise RuntimeError(f"Failed to apply MaterialX to BlenderProc: {e}")