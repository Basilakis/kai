"""
BlenderProc Custom Shaders Module

This module provides specialized shaders for materials that require custom implementations
when converting from MaterialX to BlenderProc. These materials include anisotropic surfaces,
subsurface scattering, thin film effects, complex procedural textures, and layered materials.
"""

import os
import numpy as np
import json
from typing import Dict, Any, List, Optional, Tuple, Union

# Import if available, otherwise set to None for compatibility
try:
    import bpy
    import blenderproc as bproc
    from mathutils import Vector, Matrix
except ImportError:
    bpy = None
    bproc = None

class CustomShaderLibrary:
    """
    Library of specialized material shaders for BlenderProc that don't have
    direct equivalents in the standard MaterialX conversion process.
    """
    
    @staticmethod
    def create_anisotropic_shader(
        material_data: Dict[str, Any],
        base_color: Tuple[float, float, float] = (0.8, 0.8, 0.8),
        roughness: float = 0.2,
        anisotropy: float = 0.5,
        rotation: float = 0.0,
        metallic: float = 0.0
    ) -> Any:
        """
        Create an anisotropic shader for materials like brushed metal, hair, etc.
        
        Args:
            material_data: MaterialX data for the material
            base_color: Base color of the material (RGB)
            roughness: Surface roughness value
            anisotropy: Anisotropy factor (0.0-1.0)
            rotation: Anisotropic rotation angle
            metallic: Metallic factor
            
        Returns:
            Configured BlenderProc material
        """
        if bproc is None:
            raise ImportError("BlenderProc is required but not available")
            
        # Extract parameters from MaterialX data if available
        if 'baseColor' in material_data:
            base_color = material_data['baseColor']
        if 'roughness' in material_data:
            roughness = material_data['roughness']
        if 'anisotropy' in material_data:
            anisotropy = material_data['anisotropy']
        if 'anisotropyRotation' in material_data:
            rotation = material_data['anisotropyRotation']
        if 'metallic' in material_data:
            metallic = material_data['metallic']
            
        # Create material
        material = bproc.material.create('anisotropic_material')
        
        # Set up nodes for anisotropic material
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
        
        # Set material properties
        bsdf.inputs['Base Color'].default_value = (*base_color, 1.0)
        bsdf.inputs['Metallic'].default_value = metallic
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Anisotropic'].default_value = anisotropy
        bsdf.inputs['Anisotropic Rotation'].default_value = rotation

        return material
    
    @staticmethod
    def create_subsurface_shader(
        material_data: Dict[str, Any],
        base_color: Tuple[float, float, float] = (0.8, 0.8, 0.8),
        subsurface_color: Tuple[float, float, float] = (0.9, 0.3, 0.3),
        subsurface_radius: Tuple[float, float, float] = (1.0, 0.2, 0.1),
        subsurface_scale: float = 0.1
    ) -> Any:
        """
        Create a subsurface scattering shader for materials like skin, wax, marble, etc.
        
        Args:
            material_data: MaterialX data for the material
            base_color: Base color of the material (RGB)
            subsurface_color: Color for subsurface scattering
            subsurface_radius: Radius of subsurface scattering (RGB channels)
            subsurface_scale: Scale of subsurface scattering effect
            
        Returns:
            Configured BlenderProc material
        """
        if bproc is None:
            raise ImportError("BlenderProc is required but not available")
        
        # Extract parameters from MaterialX data if available
        if 'baseColor' in material_data:
            base_color = material_data['baseColor']
        if 'subsurfaceColor' in material_data:
            subsurface_color = material_data['subsurfaceColor']
        if 'subsurfaceRadius' in material_data:
            subsurface_radius = material_data['subsurfaceRadius']
        if 'subsurfaceScale' in material_data:
            subsurface_scale = material_data['subsurfaceScale']
            
        # Create material
        material = bproc.material.create('subsurface_material')
        
        # Set up nodes for subsurface material
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
        
        # Set material properties
        bsdf.inputs['Base Color'].default_value = (*base_color, 1.0)
        bsdf.inputs['Subsurface'].default_value = subsurface_scale
        bsdf.inputs['Subsurface Color'].default_value = (*subsurface_color, 1.0)
        
        # Set radius if using Blender 2.8+ with separate radius channels
        if 'Subsurface Radius' in bsdf.inputs:
            bsdf.inputs['Subsurface Radius'].default_value = subsurface_radius
        
        return material
    
    @staticmethod
    def create_thin_film_shader(
        material_data: Dict[str, Any],
        base_color: Tuple[float, float, float] = (0.8, 0.8, 0.8),
        film_thickness: float = 500.0,  # nanometers
        film_ior: float = 1.5,
        roughness: float = 0.1
    ) -> Any:
        """
        Create a thin film shader for iridescent materials like soap bubbles, oil slicks, etc.
        
        Args:
            material_data: MaterialX data for the material
            base_color: Base color of the material (RGB)
            film_thickness: Thickness of thin film layer in nanometers
            film_ior: Index of refraction of thin film
            roughness: Surface roughness
            
        Returns:
            Configured BlenderProc material
        """
        if bproc is None:
            raise ImportError("BlenderProc is required but not available")
        
        # Extract parameters from MaterialX data if available
        if 'baseColor' in material_data:
            base_color = material_data['baseColor']
        if 'filmThickness' in material_data:
            film_thickness = material_data['filmThickness']
        if 'filmIOR' in material_data:
            film_ior = material_data['filmIOR']
        if 'roughness' in material_data:
            roughness = material_data['roughness']
            
        # Create material
        material = bproc.material.create('thin_film_material')
        
        # Set up nodes for thin film material
        nodes = material.node_tree.nodes
        links = material.node_tree.links
        
        # Clear default nodes
        for node in nodes:
            nodes.remove(node)
            
        # Create shader nodes
        output = nodes.new('ShaderNodeOutputMaterial')
        output.location = (600, 0)
        
        # Creating a thin film effect requires custom node setup
        # First, create the glass BSDF for the outer layer
        glass = nodes.new('ShaderNodeBsdfGlass')
        glass.location = (0, 100)
        glass.inputs['Color'].default_value = (1.0, 1.0, 1.0, 1.0)
        glass.inputs['Roughness'].default_value = roughness
        glass.inputs['IOR'].default_value = film_ior
        
        # Create the principled BSDF for the base layer
        principled = nodes.new('ShaderNodeBsdfPrincipled')
        principled.location = (0, -100)
        principled.inputs['Base Color'].default_value = (*base_color, 1.0)
        principled.inputs['Metallic'].default_value = 0.0
        principled.inputs['Roughness'].default_value = roughness
        
        # Create a Fresnel node to blend based on viewing angle
        fresnel = nodes.new('ShaderNodeFresnel')
        fresnel.location = (200, 200)
        fresnel.inputs['IOR'].default_value = film_ior
        
        # Create a Color Ramp node to simulate thin film interference
        color_ramp = nodes.new('ShaderNodeValToRGB')
        color_ramp.location = (200, 300)
        
        # Set up the color ramp with iridescent colors
        # This is a simplified approximation of thin film interference
        color_ramp.color_ramp.elements[0].position = 0.0
        color_ramp.color_ramp.elements[0].color = (1.0, 0.0, 0.0, 1.0)  # Red
        
        # Add more elements
        color_ramp.color_ramp.elements.new(0.2)
        color_ramp.color_ramp.elements[1].color = (1.0, 1.0, 0.0, 1.0)  # Yellow
        
        color_ramp.color_ramp.elements.new(0.4)
        color_ramp.color_ramp.elements[2].color = (0.0, 1.0, 0.0, 1.0)  # Green
        
        color_ramp.color_ramp.elements.new(0.6)
        color_ramp.color_ramp.elements[3].color = (0.0, 1.0, 1.0, 1.0)  # Cyan
        
        color_ramp.color_ramp.elements.new(0.8)
        color_ramp.color_ramp.elements[4].color = (0.0, 0.0, 1.0, 1.0)  # Blue
        
        color_ramp.color_ramp.elements.new(1.0)
        color_ramp.color_ramp.elements[5].color = (1.0, 0.0, 1.0, 1.0)  # Magenta
        
        # Layer Shader node to combine the two BSDFs
        mix = nodes.new('ShaderNodeMixShader')
        mix.location = (400, 0)
        
        # Connect all nodes
        links.new(fresnel.outputs['Fac'], color_ramp.inputs['Fac'])
        links.new(color_ramp.outputs['Color'], glass.inputs['Color'])
        links.new(fresnel.outputs['Fac'], mix.inputs['Fac'])
        links.new(glass.outputs['BSDF'], mix.inputs[1])
        links.new(principled.outputs['BSDF'], mix.inputs[2])
        links.new(mix.outputs['Shader'], output.inputs['Surface'])
        
        return material
    
    @staticmethod
    def create_procedural_texture_shader(
        material_data: Dict[str, Any],
        texture_type: str = 'noise',
        base_color: Tuple[float, float, float] = (0.8, 0.8, 0.8),
        scale: float = 5.0,
        detail: float = 2.0,
        roughness: float = 0.5,
        distortion: float = 0.0
    ) -> Any:
        """
        Create a procedural texture shader for generated materials.
        
        Args:
            material_data: MaterialX data for the material
            texture_type: Type of procedural texture ('noise', 'voronoi', 'musgrave', etc.)
            base_color: Base color of the material (RGB)
            scale: Scale of the procedural texture
            detail: Detail level of the texture
            roughness: Surface roughness
            distortion: Distortion factor
            
        Returns:
            Configured BlenderProc material
        """
        if bproc is None:
            raise ImportError("BlenderProc is required but not available")
        
        # Extract parameters from MaterialX data if available
        if 'baseColor' in material_data:
            base_color = material_data['baseColor']
        if 'textureType' in material_data:
            texture_type = material_data['textureType']
        if 'scale' in material_data:
            scale = material_data['scale']
        if 'detail' in material_data:
            detail = material_data['detail']
        if 'roughness' in material_data:
            roughness = material_data['roughness']
        if 'distortion' in material_data:
            distortion = material_data['distortion']
            
        # Create material
        material = bproc.material.create('procedural_material')
        
        # Set up nodes for procedural material
        nodes = material.node_tree.nodes
        links = material.node_tree.links
        
        # Clear default nodes
        for node in nodes:
            nodes.remove(node)
            
        # Create Principled BSDF shader
        bsdf = nodes.new('ShaderNodeBsdfPrincipled')
        bsdf.location = (400, 0)
        
        # Create output node
        output = nodes.new('ShaderNodeOutputMaterial')
        output.location = (600, 0)
        
        # Create texture coordinate node
        tex_coord = nodes.new('ShaderNodeTexCoord')
        tex_coord.location = (-400, 0)
        
        # Create mapping node for scale control
        mapping = nodes.new('ShaderNodeMapping')
        mapping.location = (-200, 0)
        mapping.inputs['Scale'].default_value = (scale, scale, scale)
        
        # Create procedural texture node based on type
        if texture_type == 'noise':
            tex_node = nodes.new('ShaderNodeTexNoise')
            tex_node.location = (0, 0)
            tex_node.inputs['Scale'].default_value = 1.0  # Using mapping for scale
            tex_node.inputs['Detail'].default_value = detail
            tex_node.inputs['Roughness'].default_value = roughness
            tex_node.inputs['Distortion'].default_value = distortion
        elif texture_type == 'voronoi':
            tex_node = nodes.new('ShaderNodeTexVoronoi')
            tex_node.location = (0, 0)
            tex_node.inputs['Scale'].default_value = 1.0  # Using mapping for scale
            tex_node.inputs['Randomness'].default_value = roughness
        elif texture_type == 'musgrave':
            tex_node = nodes.new('ShaderNodeTexMusgrave')
            tex_node.location = (0, 0)
            tex_node.inputs['Scale'].default_value = 1.0  # Using mapping for scale
            tex_node.inputs['Detail'].default_value = detail
            tex_node.inputs['Dimension'].default_value = 2.0
            tex_node.inputs['Lacunarity'].default_value = 2.0
        else:
            # Default to noise if type not supported
            tex_node = nodes.new('ShaderNodeTexNoise')
            tex_node.location = (0, 0)
            tex_node.inputs['Scale'].default_value = 1.0
            tex_node.inputs['Detail'].default_value = detail
            tex_node.inputs['Roughness'].default_value = roughness
            tex_node.inputs['Distortion'].default_value = distortion
        
        # Create ColorRamp node to map texture values to colors
        color_ramp = nodes.new('ShaderNodeValToRGB')
        color_ramp.location = (200, 0)
        
        # Set color ramp colors
        color_ramp.color_ramp.elements[0].position = 0.0
        color_ramp.color_ramp.elements[0].color = (
            base_color[0] * 0.5, 
            base_color[1] * 0.5, 
            base_color[2] * 0.5, 
            1.0
        )
        
        # Keep second element at position 1.0
        color_ramp.color_ramp.elements[1].position = 1.0
        color_ramp.color_ramp.elements[1].color = (
            min(base_color[0] * 1.5, 1.0), 
            min(base_color[1] * 1.5, 1.0), 
            min(base_color[2] * 1.5, 1.0), 
            1.0
        )
        
        # Connect all nodes
        links.new(tex_coord.outputs['Generated'], mapping.inputs['Vector'])
        links.new(mapping.outputs['Vector'], tex_node.inputs['Vector'])
        
        # Connect texture output to color ramp
        if texture_type == 'voronoi':
            links.new(tex_node.outputs['Distance'], color_ramp.inputs['Fac'])
        else:
            links.new(tex_node.outputs['Fac'], color_ramp.inputs['Fac'])
            
        # Connect color ramp to BSDF and BSDF to output
        links.new(color_ramp.outputs['Color'], bsdf.inputs['Base Color'])
        links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
        
        return material
    
    @staticmethod
    def create_layered_material(
        material_data: Dict[str, Any],
        base_material: Dict[str, Any],
        top_material: Dict[str, Any],
        blend_factor: float = 0.5,
        blend_type: str = 'mix'  # 'mix', 'add', 'multiply'
    ) -> Any:
        """
        Create a layered material by combining two materials.
        
        Args:
            material_data: MaterialX data for the combined material
            base_material: Data for the base material layer
            top_material: Data for the top material layer
            blend_factor: Blending factor between the two materials
            blend_type: Type of blending to use
            
        Returns:
            Configured BlenderProc material
        """
        if bproc is None:
            raise ImportError("BlenderProc is required but not available")
        
        # Extract parameters from MaterialX data if available
        if 'blendFactor' in material_data:
            blend_factor = material_data['blendFactor']
        if 'blendType' in material_data:
            blend_type = material_data['blendType']
            
        # Create base and top materials using appropriate shader types
        base_mat = bproc.material.create('base_layer')
        top_mat = bproc.material.create('top_layer')
        
        # Determine shader types from material data and create both materials
        base_shader_type = base_material.get('shader_type', 'principled')
        top_shader_type = top_material.get('shader_type', 'principled')
        
        # Logic for creating individual material layers
        # For simplicity, just create standard materials here, but in practice
        # you would use the right specialized shader based on type
        
        # Create the final layered material
        layered_mat = bproc.material.create('layered_material')
        
        # Set up nodes for layered material
        nodes = layered_mat.node_tree.nodes
        links = layered_mat.node_tree.links
        
        # Clear default nodes
        for node in nodes:
            nodes.remove(node)
            
        # Create Material Output node
        output = nodes.new('ShaderNodeOutputMaterial')
        output.location = (600, 0)
        
        # Create the two shader nodes
        # In practice, these would be the complete node setups from base and top materials
        base_shader = nodes.new('ShaderNodeBsdfPrincipled')
        base_shader.location = (0, 100)
        base_shader.inputs['Base Color'].default_value = (*base_material.get('baseColor', (0.8, 0.8, 0.8)), 1.0)
        base_shader.inputs['Roughness'].default_value = base_material.get('roughness', 0.5)
        base_shader.inputs['Metallic'].default_value = base_material.get('metallic', 0.0)
        
        top_shader = nodes.new('ShaderNodeBsdfPrincipled')
        top_shader.location = (0, -100)
        top_shader.inputs['Base Color'].default_value = (*top_material.get('baseColor', (0.8, 0.8, 0.8)), 1.0)
        top_shader.inputs['Roughness'].default_value = top_material.get('roughness', 0.5)
        top_shader.inputs['Metallic'].default_value = top_material.get('metallic', 0.0)
        
        # Create mix shader node
        if blend_type == 'mix':
            mix = nodes.new('ShaderNodeMixShader')
            mix.location = (400, 0)
            mix.inputs['Fac'].default_value = blend_factor
            
            # Connect nodes
            links.new(base_shader.outputs['BSDF'], mix.inputs[1])
            links.new(top_shader.outputs['BSDF'], mix.inputs[2])
            links.new(mix.outputs['Shader'], output.inputs['Surface'])
        elif blend_type == 'add':
            # For additive blending, use AddShader
            add = nodes.new('ShaderNodeAddShader')
            add.location = (400, 0)
            
            # Connect nodes
            links.new(base_shader.outputs['BSDF'], add.inputs[0])
            links.new(top_shader.outputs['BSDF'], add.inputs[1])
            links.new(add.outputs['Shader'], output.inputs['Surface'])
        else:  # Use mix as default for other blend types
            mix = nodes.new('ShaderNodeMixShader')
            mix.location = (400, 0)
            mix.inputs['Fac'].default_value = blend_factor
            
            # Connect nodes
            links.new(base_shader.outputs['BSDF'], mix.inputs[1])
            links.new(top_shader.outputs['BSDF'], mix.inputs[2])
            links.new(mix.outputs['Shader'], output.inputs['Surface'])
        
        return layered_mat

# Function to select appropriate shader based on material type
def create_specialized_shader(
    material_data: Dict[str, Any],
    material_type: str
) -> Any:
    """
    Factory function to create an appropriate specialized shader based on material type.
    
    Args:
        material_data: MaterialX data for the material
        material_type: Type of material to create
        
    Returns:
        Configured BlenderProc material or None if type not supported
    """
    shader_library = CustomShaderLibrary()
    
    if material_type == 'anisotropic':
        return shader_library.create_anisotropic_shader(material_data)
    elif material_type == 'subsurface':
        return shader_library.create_subsurface_shader(material_data)
    elif material_type == 'thin_film':
        return shader_library.create_thin_film_shader(material_data)
    elif material_type == 'procedural':
        return shader_library.create_procedural_texture_shader(material_data)
    elif material_type == 'layered':
        # For layered materials, we need base and top material definitions
        base_material = material_data.get('base', {})
        top_material = material_data.get('top', {})
        return shader_library.create_layered_material(material_data, base_material, top_material)
    else:
        # For unsupported types, return None
        print(f"Warning: Material type '{material_type}' not supported by specialized shaders")
        return None

# Utility function to convert MaterialX to specialized BlenderProc shader
def materialx_to_blenderproc_specialized(
    materialx_doc: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Convert a MaterialX document to specialized BlenderProc shaders where needed.
    
    Args:
        materialx_doc: MaterialX document as dictionary
        
    Returns:
        Dictionary mapping material names to BlenderProc materials
    """
    if bproc is None:
        raise ImportError("BlenderProc is required but not available")
    
    materials = {}
    
    # Process each material in the MaterialX document
    for material_node in materialx_doc.get('materialx', {}).get('materials', []):
        material_name = material_node.get('name', 'unnamed_material')
        material_type = material_node.get('type', 'standard')
        
        # Check if this material needs a specialized shader
        if material_type in ['anisotropic', 'subsurface', 'thin_film', 'procedural', 'layered']:
            # Create specialized shader
            material = create_specialized_shader(material_node, material_type)
            if material is not None:
                materials[material_name] = material
        
    return materials

# Integration with the main enhanced_material_processor module
def register_specialized_shaders(processor: Any) -> None:
    """
    Register specialized shader functions with the main material processor.
    
    Args:
        processor: The EnhancedMaterialProcessor instance
    """
    if hasattr(processor, 'register_shader_creator'):
        processor.register_shader_creator('anisotropic', 
                                         CustomShaderLibrary.create_anisotropic_shader)
        processor.register_shader_creator('subsurface', 
                                         CustomShaderLibrary.create_subsurface_shader)
        processor.register_shader_creator('thin_film', 
                                         CustomShaderLibrary.create_thin_film_shader)
        processor.register_shader_creator('procedural', 
                                         CustomShaderLibrary.create_procedural_texture_shader)
        processor.register_shader_creator('layered', 
                                         CustomShaderLibrary.create_layered_material)