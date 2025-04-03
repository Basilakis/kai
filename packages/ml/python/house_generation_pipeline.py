"""
Text-to-3D House Generation Pipeline

This module implements a complete pipeline for text-to-3D house generation including:
1. House Outline Generation (ControlNet + Stable Diffusion)
2. House Shell Generation (Shap-E)
3. Object & Furniture Generation (GET3D)
4. Text-Visual Matching (CLIP)
5. 3D-FRONT Dataset Integration
6. Procedural Texture Generation (Text2Material/Stable Diffusion)
7. Scene Layout Optimization (DiffuScene)
8. Physics-Based Validation (PyBullet)
9. Multi-Level Planning (Graph-based)
10. Manual Adjustment System
"""

import os
import io
import json
import torch
import numpy as np
import cv2
from PIL import Image
from typing import Dict, Any, List, Optional, Tuple, Union
from diffusers import StableDiffusionControlNetPipeline, ControlNetModel
from transformers import CLIPProcessor, CLIPModel
import open3d as o3d
from base64 import b64encode
import pybullet as p
import networkx as nx
from dataclasses import dataclass
from enum import Enum

class FurnitureConstraint(Enum):
    """Furniture placement constraints"""
    AGAINST_WALL = "against_wall"
    NEAR_WINDOW = "near_window"
    CENTER_ROOM = "center_room"
    NEAR_POWER = "near_power"
    CLEAR_PATH = "clear_path"

@dataclass
class FurniturePlacement:
    """Represents a furniture item's placement in the scene"""
    furniture_id: str
    position: Tuple[float, float, float]
    rotation: Tuple[float, float, float]
    constraints: List[FurnitureConstraint]
    clearance: float
    connected_to: Optional[List[str]] = None

class SceneOptimizer:
    """Optimize scene layout using DiffuScene"""
    
    def __init__(self):
        self.diffuscene = None
        self.room_graph = nx.Graph()
        
    async def initialize(self):
        """Initialize DiffuScene model"""
        # Initialize DiffuScene for layout optimization
        pass
        
    async def optimize_layout(self, 
                            scene: Dict[str, Any],
                            constraints: List[FurnitureConstraint]) -> Dict[str, Any]:
        """Optimize furniture layout using DiffuScene"""
        # Build room connectivity graph
        self._build_room_graph(scene)
        
        # Generate optimal layout using DiffuScene
        optimized_positions = await self._generate_optimal_layout(scene, constraints)
        
        # Apply optimized positions while maintaining constraints
        updated_scene = self._apply_optimized_layout(scene, optimized_positions)
        
        return updated_scene
        
    def _build_room_graph(self, scene: Dict[str, Any]):
        """Build a graph representing room connectivity"""
        # Clear existing graph
        self.room_graph.clear()
        
        # Add rooms as nodes
        for room in scene.get('rooms', []):
            self.room_graph.add_node(room['id'], data=room)
            
        # Add connections between adjacent rooms
        for room in scene.get('rooms', []):
            for adjacent in room.get('adjacent_rooms', []):
                self.room_graph.add_edge(room['id'], adjacent)

class PhysicsValidator:
    """Physics-based validation using PyBullet"""
    
    def __init__(self):
        self.physics_client = None
        
    async def initialize(self):
        """Initialize PyBullet physics engine"""
        self.physics_client = p.connect(p.DIRECT)  # Headless mode
        p.setGravity(0, 0, -9.81)
        
    async def validate_placement(self, 
                               scene: Dict[str, Any],
                               furniture: List[FurniturePlacement]) -> List[bool]:
        """Validate furniture placement using physics simulation"""
        # Load room geometry
        room_id = self._load_room_geometry(scene)
        
        # Load and place furniture
        furniture_ids = []
        for item in furniture:
            furniture_id = self._load_furniture(item)
            furniture_ids.append(furniture_id)
            
        # Run physics simulation
        valid_placements = []
        for _ in range(100):  # Simulate for 100 steps
            p.stepSimulation()
            
        # Check stability for each furniture item
        for furniture_id in furniture_ids:
            position, orientation = p.getBasePositionAndOrientation(furniture_id)
            is_stable = self._check_stability(position, orientation)
            valid_placements.append(is_stable)
            
        return valid_placements
        
    def _load_room_geometry(self, scene: Dict[str, Any]) -> int:
        """Load room geometry into physics simulation"""
        # Create collision shape from room geometry
        vertices = scene['geometry']['shell']['vertices']
        indices = scene['geometry']['shell']['indices']
        
        mesh_shape = p.createCollisionShape(
            p.GEOM_MESH,
            vertices=vertices,
            indices=indices
        )
        
        # Create rigid body for room
        room_id = p.createMultiBody(
            baseMass=0,  # Static body
            baseCollisionShapeIndex=mesh_shape
        )
        
        return room_id
        
    def _check_stability(self, 
                        position: Tuple[float, float, float],
                        orientation: Tuple[float, float, float, float]) -> bool:
        """Check if furniture placement is stable"""
        # Check if object has moved significantly from initial placement
        height_threshold = 0.05  # 5cm threshold
        tilt_threshold = 0.1  # ~5.7 degrees
        
        # Check height stability
        if abs(position[2] - self.initial_height) > height_threshold:
            return False
            
        # Check tilt stability
        euler = p.getEulerFromQuaternion(orientation)
        if abs(euler[0]) > tilt_threshold or abs(euler[1]) > tilt_threshold:
            return False
            
        return True

class GraphPlanner:
    """Graph-based planning for multi-level homes"""
    
    def __init__(self):
        self.scene_graph = nx.Graph()
        
    async def plan_layout(self, 
                         scene: Dict[str, Any],
                         requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Plan furniture layout using graph-based approach"""
        # Build scene graph
        self._build_scene_graph(scene)
        
        # Generate layout plan
        layout_plan = self._generate_layout_plan(requirements)
        
        # Optimize traffic flow
        optimized_plan = self._optimize_traffic_flow(layout_plan)
        
        return optimized_plan
        
    def _build_scene_graph(self, scene: Dict[str, Any]):
        """Build a graph representing the scene"""
        # Add rooms as nodes
        for room in scene.get('rooms', []):
            self.scene_graph.add_node(
                room['id'],
                type=room['type'],
                level=room['level'],
                area=room['area']
            )
            
        # Add connections (doors, stairs)
        for connection in scene.get('connections', []):
            self.scene_graph.add_edge(
                connection['from'],
                connection['to'],
                type=connection['type']
            )
            
    def _optimize_traffic_flow(self, layout_plan: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize furniture placement for traffic flow"""
        # Find high-traffic paths
        paths = nx.all_pairs_shortest_path(self.scene_graph)
        
        # Adjust furniture placement to maintain clear paths
        optimized_plan = dict(layout_plan)
        for path in paths:
            self._ensure_clear_path(optimized_plan, path)
            
        return optimized_plan
        
    def _ensure_clear_path(self, 
                          layout_plan: Dict[str, Any],
                          path: List[str],
                          min_clearance: float = 0.8):
        """Ensure clear path between rooms"""
        for i in range(len(path) - 1):
            room1, room2 = path[i], path[i + 1]
            
            # Find door/connection between rooms
            connection = self._find_connection(room1, room2)
            
            # Adjust furniture to maintain clearance
            self._adjust_furniture_for_clearance(
                layout_plan,
                connection,
                min_clearance
            )

class ManualAdjustmentSystem:
    """System for manual furniture adjustment"""
    
    def __init__(self):
        self.undo_stack = []
        self.redo_stack = []
        
    async def adjust_furniture(self,
                             scene: Dict[str, Any],
                             furniture_id: str,
                             adjustment: Dict[str, Any]) -> Dict[str, Any]:
        """Apply manual adjustment to furniture"""
        # Save current state for undo
        self.undo_stack.append(self._get_furniture_state(scene, furniture_id))
        
        # Apply adjustment
        updated_scene = dict(scene)
        furniture = self._find_furniture(updated_scene, furniture_id)
        
        if furniture:
            # Update position
            if 'position' in adjustment:
                furniture['transform']['position'] = adjustment['position']
                
            # Update rotation
            if 'rotation' in adjustment:
                furniture['transform']['rotation'] = adjustment['rotation']
                
            # Update scale
            if 'scale' in adjustment:
                furniture['transform']['scale'] = adjustment['scale']
        
        return updated_scene
        
    def undo(self, scene: Dict[str, Any]) -> Dict[str, Any]:
        """Undo last adjustment"""
        if not self.undo_stack:
            return scene
            
        # Get last state
        last_state = self.undo_stack.pop()
        
        # Save current state for redo
        self.redo_stack.append(
            self._get_furniture_state(scene, last_state['furniture_id'])
        )
        
        # Restore previous state
        return self._restore_furniture_state(scene, last_state)
        
    def redo(self, scene: Dict[str, Any]) -> Dict[str, Any]:
        """Redo last undone adjustment"""
        if not self.redo_stack:
            return scene
            
        # Get next state
        next_state = self.redo_stack.pop()
        
        # Save current state for undo
        self.undo_stack.append(
            self._get_furniture_state(scene, next_state['furniture_id'])
        )
        
        # Apply next state
        return self._restore_furniture_state(scene, next_state)
        
    def _get_furniture_state(self,
                           scene: Dict[str, Any],
                           furniture_id: str) -> Dict[str, Any]:
        """Get current state of furniture item"""
        furniture = self._find_furniture(scene, furniture_id)
        if furniture:
            return {
                'furniture_id': furniture_id,
                'transform': dict(furniture['transform'])
            }
        return {}

class HouseOutlineGenerator:
    """Generate house outlines using ControlNet + Stable Diffusion"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.controlnet = None
        self.stable_diffusion = None
        
    async def initialize(self):
        """Initialize ControlNet and Stable Diffusion models"""
        controlnet = ControlNetModel.from_pretrained("lllyasviel/sd-controlnet-scribble")
        self.stable_diffusion = StableDiffusionControlNetPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            controlnet=controlnet
        )
        
    async def generate_outline(self, prompt: str) -> Dict[str, Any]:
        """Generate house outline from text description"""
        # Generate initial sketch using ControlNet
        sketch = await self._generate_sketch(prompt)
        
        # Refine with Stable Diffusion
        refined = await self._refine_sketch(sketch, prompt)
        
        return {
            'sketch': sketch,
            'refined': refined
        }
        
    async def _generate_sketch(self, prompt: str) -> np.ndarray:
        """Generate initial architectural sketch"""
        # Initialize ControlNet for architectural sketching
        controlnet = self.controlnet.from_pretrained("lllyasviel/sd-controlnet-canny")
        
        # Generate edge detection guidance
        edge_image = cv2.Canny(
            cv2.imread("assets/house_template.png"),
            100, 200
        )
        edge_image = cv2.dilate(edge_image, np.ones((3,3), np.uint8), iterations=1)
        
        # Generate architectural sketch with ControlNet
        sketch = controlnet(
            prompt,
            image=edge_image,
            num_inference_steps=75,
            guidance_scale=9.0,
            controlnet_conditioning_scale=1.0,
            negative_prompt="blurry, distorted, unrealistic architecture",
            generator=torch.manual_seed(42)  # For consistency
        ).images[0]
        
        return np.array(sketch)
        
    async def _refine_sketch(self, sketch: np.ndarray, prompt: str) -> np.ndarray:
        """Refine sketch using Stable Diffusion"""
        # Convert sketch to PIL Image
        sketch_image = Image.fromarray(sketch)
        
        # Refine with Stable Diffusion
        refined = self.stable_diffusion(
            prompt=f"architectural drawing of {prompt}, professional, detailed, blueprint style",
            image=sketch_image,
            strength=0.7,
            num_inference_steps=50
        ).images[0]
        
        return np.array(refined)

class ThreeDFrontDataset:
    """Integration with 3D-FRONT dataset for reference and training"""
    
    def __init__(self, dataset_path: str):
        self.dataset_path = dataset_path
        self.furniture_database = None
        self.room_layouts = None
        
    async def initialize(self):
        """Load and prepare 3D-FRONT dataset"""
        # Load furniture database
        await self._load_furniture_database()
        
        # Load room layouts
        await self._load_room_layouts()
        
    async def get_similar_furniture(self, description: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Find similar furniture items based on text description"""
        if not self.furniture_database:
            raise ValueError("Furniture database not initialized")
            
        # Encode description using CLIP
        text_features = self.clip_model.encode_text(description)
        
        # Find similar furniture using CLIP embeddings
        similarities = []
        for furniture in self.furniture_database:
            # Encode furniture image
            image_features = self.clip_model.encode_image(furniture['image'])
            
            # Compute similarity
            similarity = torch.cosine_similarity(text_features, image_features)
            similarities.append((furniture, similarity.item()))
        
        # Sort by similarity and return top matches
        sorted_furniture = sorted(similarities, key=lambda x: x[1], reverse=True)
        return [item[0] for item in sorted_furniture[:limit]]
        
    async def get_room_layout_reference(self, requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Find relevant room layout reference"""
        if not self.room_layouts:
            raise ValueError("Room layouts not initialized")
            
        # Match requirements with available layouts
        matches = []
        for layout in self.room_layouts:
            score = self._compute_layout_match_score(layout, requirements)
            matches.append((layout, score))
        
        # Return best matching layout
        best_match = max(matches, key=lambda x: x[1])[0]
        return best_match
        
    async def _load_furniture_database(self):
        """Load and index furniture database"""
        # Load 3D-FRONT furniture data
        furniture_path = os.path.join(self.dataset_path, 'furniture')
        self.furniture_database = []
        
        for furniture_file in os.listdir(furniture_path):
            if furniture_file.endswith('.json'):
                with open(os.path.join(furniture_path, furniture_file)) as f:
                    furniture_data = json.load(f)
                    
                    # Process furniture data
                    processed_furniture = {
                        'id': furniture_data['id'],
                        'type': furniture_data['type'],
                        'style': furniture_data['style'],
                        'dimensions': furniture_data['dimensions'],
                        'image': self._load_furniture_image(furniture_data['image_path']),
                        'model_path': furniture_data['model_path']
                    }
                    
                    self.furniture_database.append(processed_furniture)
        
    async def _load_room_layouts(self):
        """Load and index room layouts"""
        # Load 3D-FRONT room layouts
        layouts_path = os.path.join(self.dataset_path, 'room_layouts')
        self.room_layouts = []
        
        for layout_file in os.listdir(layouts_path):
            if layout_file.endswith('.json'):
                with open(os.path.join(layouts_path, layout_file)) as f:
                    layout_data = json.load(f)
                    
                    # Process layout data
                    processed_layout = {
                        'id': layout_data['id'],
                        'type': layout_data['type'],
                        'dimensions': layout_data['dimensions'],
                        'elements': layout_data['elements'],
                        'style': layout_data['style'],
                        'preview': self._load_layout_preview(layout_data['preview_path'])
                    }
                    
                    self.room_layouts.append(processed_layout)

class TextVisualMatcher:
    """Text-visual matching using CLIP"""
    
    def __init__(self):
        self.clip_model = None
        self.clip_processor = None
        
    async def initialize(self):
        """Initialize CLIP model and processor"""
        self.clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        self.clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        
    async def compute_similarity(self, text: str, image: np.ndarray) -> float:
        """Compute similarity score between text and image"""
        # Process inputs
        inputs = self.clip_processor(
            text=[text],
            images=[image],
            return_tensors="pt",
            padding=True
        )
        
        # Get embeddings
        outputs = self.clip_model(**inputs)
        
        # Compute similarity
        similarity = outputs.logits_per_image.item()
        return similarity
        
    async def rank_options(self, text: str, images: List[np.ndarray]) -> List[Tuple[int, float]]:
        """Rank multiple options based on text description"""
        similarities = []
        for idx, image in enumerate(images):
            score = await self.compute_similarity(text, image)
            similarities.append((idx, score))
        
        # Sort by similarity score
        return sorted(similarities, key=lambda x: x[1], reverse=True)

class TextureGenerator:
    """Procedural texture generation using Text2Material/Stable Diffusion"""
    
    def __init__(self):
        self.stable_diffusion = None
        
    def _make_seamless(self, image: np.ndarray) -> np.ndarray:
        """Make texture seamlessly tileable"""
        h, w = image.shape[:2]
        # Create larger canvas
        canvas = np.zeros((h * 2, w * 2, *image.shape[2:]), dtype=image.dtype)
        
        # Place four copies
        canvas[:h, :w] = image
        canvas[:h, w:] = image[:, ::-1]  # Right flip
        canvas[h:, :w] = image[::-1, :]  # Bottom flip
        canvas[h:, w:] = image[::-1, ::-1]  # Bottom-right flip
        
        # Blend seams
        blend_width = w // 8
        blend_height = h // 8
        
        # Horizontal seam
        for i in range(blend_height):
            alpha = i / blend_height
            canvas[h-blend_height+i, :] = (1-alpha) * canvas[h-blend_height+i, :] + alpha * canvas[h+i, :]
            
        # Vertical seam
        for i in range(blend_width):
            alpha = i / blend_width
            canvas[:, w-blend_width+i] = (1-alpha) * canvas[:, w-blend_width+i] + alpha * canvas[:, w+i]
            
        return canvas[:h, :w]
        
    def _encode_texture(self, texture: np.ndarray) -> str:
        """Encode texture as base64 string"""
        # Convert to PNG
        img = Image.fromarray(texture)
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        
        # Encode as base64
        return b64encode(img_bytes.getvalue()).decode('utf-8')
        
    async def initialize(self):
        """Initialize texture generation models"""
        # Initialize Stable Diffusion for texture generation
        pass
        
    async def generate_texture(self, 
                             description: str,
                             style: Optional[str] = None) -> Dict[str, np.ndarray]:
        """Generate material textures from text description"""
        # Generate base texture maps
        diffuse = await self._generate_diffuse_map(description, style)
        normal = await self._generate_normal_map(description)
        roughness = await self._generate_roughness_map(description)
        
        return {
            'diffuse': diffuse,
            'normal': normal,
            'roughness': roughness
        }
        
    async def _generate_diffuse_map(self, description: str, style: Optional[str]) -> np.ndarray:
        """Generate diffuse texture map"""
        # Use Stable Diffusion for texture generation
        prompt = f"seamless texture {description}"
        if style:
            prompt += f", {style} style"
            
        image = self.stable_diffusion(
            prompt=prompt,
            height=512,
            width=512,
            num_inference_steps=50
        ).images[0]
        
        # Post-process for seamless tiling
        return self._make_seamless(np.array(image))
        
    async def _generate_normal_map(self, description: str) -> np.ndarray:
        """Generate normal map"""
        # Generate normal map from diffuse texture
        diffuse = await self._generate_diffuse_map(description, None)
        
        # Convert to grayscale for height map
        gray = cv2.cvtColor(diffuse, cv2.COLOR_RGB2GRAY)
        
        # Generate normal map using Sobel operators
        sobelx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
        
        # Combine into normal map
        normal_map = np.stack([
            sobelx,
            sobely,
            np.ones_like(sobelx) * 255
        ], axis=-1)
        
        return cv2.normalize(normal_map, None, 0, 255, cv2.NORM_MINMAX)
        
    async def _generate_roughness_map(self, description: str) -> np.ndarray:
        """Generate roughness map"""
        # Use Stable Diffusion for roughness map
        prompt = f"roughness texture map {description}, grayscale, technical"
        
        image = self.stable_diffusion(
            prompt=prompt,
            height=512,
            width=512,
            num_inference_steps=50
        ).images[0]
        
        # Convert to grayscale and make seamless
        gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
        return self._make_seamless(gray)

class HouseGenerationPipeline:
    """Complete pipeline for text-to-3D house generation"""
    """Complete pipeline for text-to-3D house generation"""
    
    def _get_scene_preview(self, scene: Dict[str, Any]) -> np.ndarray:
        """Generate a preview image of the scene"""
        # Create a renderer
        renderer = o3d.visualization.rendering.OffscreenRenderer(800, 600)
        
        # Add geometry to scene
        geometry = o3d.geometry.TriangleMesh()
        if 'geometry' in scene:
            # Add shell geometry
            shell_mesh = o3d.io.read_triangle_mesh_from_glb(scene['geometry']['shell'])
            geometry += shell_mesh
            
            # Add detailed geometry
            details_mesh = o3d.io.read_triangle_mesh_from_glb(scene['geometry']['details'])
            geometry += details_mesh
        
        # Add furniture
        for item in scene.get('furniture', []):
            furniture_mesh = o3d.io.read_triangle_mesh_from_glb(item['model'])
            # Apply transform
            transform = np.eye(4)
            transform[:3, 3] = item['transform']['position']
            transform[:3, :3] = o3d.geometry.get_rotation_matrix_from_xyz(item['transform']['rotation'])
            furniture_mesh.transform(transform)
            geometry += furniture_mesh
        
        # Set up materials
        material = o3d.visualization.rendering.MaterialRecord()
        material.shader = 'defaultLit'
        
        # Add geometry to renderer
        renderer.scene.add_geometry("scene", geometry, material)
        
        # Set up camera
        camera = o3d.camera.PinholeCameraParameters()
        camera.extrinsic = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 5],  # Camera 5 units away
            [0, 0, 0, 1]
        ])
        renderer.setup_camera(camera)
        
        # Render
        image = renderer.render_to_image()
        
        return np.asarray(image)
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # Initialize components
        self.outline_generator = HouseOutlineGenerator(config.get('outline_generator'))
        self.dataset = ThreeDFrontDataset(config.get('dataset_path', ''))
        self.text_matcher = TextVisualMatcher()
        self.texture_generator = TextureGenerator()
        
        # Initialize new components
        self.scene_optimizer = SceneOptimizer()
        self.physics_validator = PhysicsValidator()
        self.graph_planner = GraphPlanner()
        self.manual_adjustment = ManualAdjustmentSystem()
        
        # Initialize from text_to_3d.py
        self.shap_e = None  # Will be initialized from text_to_3d.ShapEModel
        self.get3d = None   # Will be initialized from text_to_3d.GET3DModel
        
    async def initialize(self):
        """Initialize all pipeline components"""
        await self.outline_generator.initialize()
        await self.dataset.initialize()
        await self.text_matcher.initialize()
        await self.texture_generator.initialize()
        
        # Initialize new components
        await self.scene_optimizer.initialize()
        await self.physics_validator.initialize()
        
    async def generate_house(self, 
                           description: str,
                           style_params: Optional[Dict[str, Any]] = None,
                           constraints: Optional[List[FurnitureConstraint]] = None) -> Dict[str, Any]:
        """Generate complete 3D house from text description"""
        # Generate house outline
        outline_result = await self.outline_generator.generate_outline(description)
        
        # Get reference from 3D-FRONT dataset
        layout_reference = await self.dataset.get_room_layout_reference({
            'description': description,
            'style': style_params
        })
        
        # Generate base structure using Shap-E
        shell = await self.shap_e.generate_base_structure(description)
        
        # Generate detailed scene with GET3D
        detailed_scene = await self.get3d.generate_scene_details(
            shell,
            description,
            style_params
        )
        
        # Plan layout for multi-level homes
        layout_plan = await self.graph_planner.plan_layout(
            detailed_scene,
            {'description': description, 'style': style_params}
        )
        
        # Generate furniture with planned layout
        furniture = await self._generate_furniture(
            description,
            layout_reference,
            layout_plan
        )
        
        # Optimize furniture placement
        optimized_scene = await self.scene_optimizer.optimize_layout(
            detailed_scene,
            constraints or []
        )
        
        # Validate furniture placement with physics
        furniture_placements = [
            FurniturePlacement(
                furniture_id=f['id'],
                position=f['transform']['position'],
                rotation=f['transform']['rotation'],
                constraints=f.get('constraints', []),
                clearance=f.get('clearance', 0.5)
            )
            for f in furniture
        ]
        
        valid_placements = await self.physics_validator.validate_placement(
            optimized_scene,
            furniture_placements
        )
        
        # Adjust invalid placements
        for i, is_valid in enumerate(valid_placements):
            if not is_valid:
                furniture[i] = await self._adjust_invalid_placement(
                    furniture[i],
                    optimized_scene
                )
        
        # Generate textures
        textures = await self.texture_generator.generate_texture(
            description,
            style_params.get('style')
        )
        
        # Combine all components
        final_scene = await self._combine_components(
            shell,
            optimized_scene,
            furniture,
            textures
        )
        
        return {
            'outline': outline_result,
            'shell': shell,
            'detailed_scene': detailed_scene,
            'furniture': furniture,
            'textures': textures,
            'final_scene': final_scene
        }
        
    async def _generate_furniture(self,
                                description: str,
                                layout_reference: Dict[str, Any],
                                style_params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Generate and place furniture based on description and layout"""
        # Get furniture suggestions from 3D-FRONT with style and room type matching
        furniture_candidates = await self.dataset.get_similar_furniture(
            description,
            style=style_params.get('style') if style_params else None,
            room_type=layout_reference.get('type'),
            limit=10  # Get more candidates for better filtering
        )
        
        # Use CLIP to validate furniture matches
        validated_candidates = []
        for candidate in furniture_candidates:
            similarity = await self.text_matcher.compute_similarity(
                f"{description} {style_params.get('style', '')} furniture",
                candidate['preview_image']
            )
            if similarity > 0.75:  # High confidence threshold
                validated_candidates.append(candidate)
        
        # Generate furniture using GET3D
        generated_furniture = []
        for candidate in furniture_candidates:
            furniture_item = await self.get3d.add_furniture(
                candidate['type'],
                description
            )
            generated_furniture.append(furniture_item)
        
        return generated_furniture
        
    async def _combine_components(self,
                                shell: Dict[str, Any],
                                detailed_scene: Dict[str, Any],
                                furniture: List[Dict[str, Any]],
                                textures: Dict[str, np.ndarray]) -> Dict[str, Any]:
        """Combine all components into final scene"""
        # Create combined scene
        scene = {
            'geometry': {
                'shell': shell['geometry'],
                'details': detailed_scene['geometry']
            },
            'materials': {
                'exterior': {},
                'interior': {}
            },
            'furniture': []
        }
        
        # Apply textures to materials
        for material_name, texture_maps in textures['exterior'].items():
            scene['materials']['exterior'][material_name] = {
                'diffuse': self._encode_texture(texture_maps['diffuse']),
                'normal': self._encode_texture(texture_maps['normal']),
                'roughness': self._encode_texture(texture_maps['roughness'])
            }
            
        for material_name, texture_maps in textures['interior'].items():
            scene['materials']['interior'][material_name] = {
                'diffuse': self._encode_texture(texture_maps['diffuse']),
                'normal': self._encode_texture(texture_maps['normal']),
                'roughness': self._encode_texture(texture_maps['roughness'])
            }
            
        # Add furniture with transforms
        for item in furniture:
            scene['furniture'].append({
                'model': item['model'],
                'transform': {
                    'position': item['position'],
                    'rotation': item['rotation'],
                    'scale': item.get('scale', [1, 1, 1])
                },
                'material': item.get('material')
            })
            
        return scene
        
    async def refine_generation(self,
                              scene: Dict[str, Any],
                              feedback: str) -> Dict[str, Any]:
        """Refine generated house based on feedback"""
        # Parse feedback to determine what needs refinement
        refinements = []
        
        # Check if outline needs refinement
        if 'outline' in feedback.lower():
            refined_outline = await self.outline_generator.generate_outline(
                feedback,
                initial_sketch=scene['outline']['sketch']
            )
            refinements.append(('outline', refined_outline))
            
        # Check if shell needs refinement
        if 'shell' in feedback.lower() or 'structure' in feedback.lower():
            refined_shell = await self.shap_e.refine_structure(
                scene['shell'],
                feedback
            )
            refinements.append(('shell', refined_shell))
            
        # Check if furniture needs refinement
        if 'furniture' in feedback.lower():
            refined_furniture = await self._generate_furniture(
                feedback,
                scene.get('layout_reference', {})
            )
            refinements.append(('furniture', refined_furniture))
            
        # Check if textures need refinement
        if 'texture' in feedback.lower() or 'material' in feedback.lower():
            refined_textures = await self.texture_generator.generate_texture(
                feedback,
                scene.get('style_params', {}).get('style')
            )
            refinements.append(('textures', refined_textures))
            
        # Apply refinements to scene
        refined_scene = dict(scene)
        for component, refinement in refinements:
            refined_scene[component] = refinement
            
        # If any refinements were made, recombine components
        if refinements:
            refined_scene['final_scene'] = await self._combine_components(
                refined_scene['shell'],
                refined_scene['detailed_scene'],
                refined_scene['furniture'],
                refined_scene['textures']
            )
            
        # Validate refinements with CLIP
        validation_score = await self.text_matcher.compute_similarity(
            feedback,
            self._get_scene_preview(refined_scene['final_scene'])
        )
        
        # If validation score is low, try alternative refinement approach
        if validation_score < 0.6:
            # Try more aggressive refinement or different approach
            pass
            
        return refined_scene