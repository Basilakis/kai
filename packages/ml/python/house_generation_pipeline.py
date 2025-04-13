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
        try:
            import torch
            import diffusers
            from diffusers import DiffusionPipeline
            
            # Load DiffuScene model for layout optimization
            # This uses a conditional diffusion model specialized for scene arrangement
            self.diffuscene = DiffusionPipeline.from_pretrained(
                "diffusers/diffuscene-layout-v1",
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
            )
            
            # Move to appropriate device
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            self.diffuscene = self.diffuscene.to(device)
            
            # Initialize room graph for connectivity analysis
            self.room_graph = nx.Graph()
            
            # Initialize optimization parameters
            self.opt_params = {
                "num_inference_steps": 50,
                "guidance_scale": 7.5,
                "height": 512,
                "width": 512
            }
            
            print("SceneOptimizer initialized successfully")
            return True
        except ImportError as e:
            print(f"Failed to initialize SceneOptimizer: {e}")
            # Create minimal fallback implementation for environments without diffusers
            self.diffuscene = None
            return False
        
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
        initial_heights = {}
        for item in furniture:
            furniture_id = self._load_furniture(item)
            furniture_ids.append(furniture_id)
            # Store initial height for stability check
            pos, _ = p.getBasePositionAndOrientation(furniture_id)
            initial_heights[furniture_id] = pos[2]
            
        # Run physics simulation
        valid_placements = []
        for _ in range(100):  # Simulate for 100 steps
            p.stepSimulation()
            
        # Check stability for each furniture item
        for furniture_id in furniture_ids:
            position, orientation = p.getBasePositionAndOrientation(furniture_id)
            is_stable = self._check_stability(position, orientation, initial_heights[furniture_id])
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
        
    def _load_furniture(self, item: FurniturePlacement) -> int:
        """Load furniture item into physics simulation"""
        # Get furniture model path from ID
        model_path = f"assets/furniture/{item.furniture_id}.obj"
        
        # Create collision shape from furniture geometry
        try:
            # Try to load from OBJ file
            mesh_shape = p.createCollisionShape(
                p.GEOM_MESH,
                fileName=model_path
            )
        except p.error:
            # Fallback to primitive shape if model not available
            # Approximate furniture as a box based on typical dimensions
            furniture_types = {
                "chair": [0.5, 0.5, 0.9],     # width, depth, height
                "table": [1.2, 0.8, 0.75],
                "sofa": [2.0, 0.9, 0.8],
                "bed": [2.0, 1.6, 0.5],
                "cabinet": [1.0, 0.5, 1.8],
                "desk": [1.4, 0.7, 0.75],
                "bookshelf": [0.9, 0.35, 1.8],
                "lamp": [0.3, 0.3, 1.5]
            }
            
            # Extract type from furniture ID or use default dimensions
            furniture_type = next((t for t in furniture_types if t in item.furniture_id.lower()), "chair")
            dimensions = furniture_types.get(furniture_type, [0.6, 0.6, 0.6])
            
            mesh_shape = p.createCollisionShape(
                p.GEOM_BOX,
                halfExtents=[d/2 for d in dimensions]
            )
        
        # Create multibody for furniture
        furniture_mass = 10.0  # Standard mass in kg
        furniture_id = p.createMultiBody(
            baseMass=furniture_mass,
            baseCollisionShapeIndex=mesh_shape,
            basePosition=item.position,
            baseOrientation=p.getQuaternionFromEuler(item.rotation)
        )
        
        # Apply constraints if needed
        for constraint in item.constraints:
            if constraint == FurnitureConstraint.AGAINST_WALL:
                # Add a constraint to keep the furniture against a wall
                wall_normal = self._find_nearest_wall_normal(item.position)
                p.createConstraint(
                    furniture_id, -1, -1, -1,
                    p.JOINT_PRISMATIC,
                    jointAxis=wall_normal,
                    parentFramePosition=[0, 0, 0],
                    childFramePosition=item.position
                )
                
        return furniture_id
        
    def _find_nearest_wall_normal(self, position: Tuple[float, float, float]) -> List[float]:
        """Find normal vector of nearest wall"""
        # Simplified implementation - assumes walls are axis-aligned
        # In a real implementation, would compute from room geometry
        walls = [
            {"position": [0, 0, 0], "normal": [1, 0, 0]},
            {"position": [10, 0, 0], "normal": [-1, 0, 0]},
            {"position": [0, 0, 0], "normal": [0, 1, 0]},
            {"position": [0, 10, 0], "normal": [0, -1, 0]}
        ]
        
        # Find closest wall
        closest_wall = min(walls, key=lambda w: 
            ((w["position"][0] - position[0]) * w["normal"][0])**2 +
            ((w["position"][1] - position[1]) * w["normal"][1])**2
        )
        
        return closest_wall["normal"]
    
    def _check_stability(self, 
                        position: Tuple[float, float, float],
                        orientation: Tuple[float, float, float, float],
                        initial_height: float) -> bool:
        """Check if furniture placement is stable"""
        # Check if object has moved significantly from initial placement
        height_threshold = 0.05  # 5cm threshold
        tilt_threshold = 0.1  # ~5.7 degrees
        
        # Check height stability
        if abs(position[2] - initial_height) > height_threshold:
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
        layout_plan = await self._generate_layout_plan(requirements)
        
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
            
    async def _generate_layout_plan(self, requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Generate furniture layout plan based on requirements"""
        layout_plan = {
            'rooms': {},
            'furniture': []
        }
        
        # Get description and style from requirements
        description = requirements.get('description', '')
        style = requirements.get('style', {})
        
        # Generate layout for each room in the graph
        for room_id, room_data in nx.get_node_attributes(self.scene_graph, 'data').items():
            room_type = room_data.get('type', 'unknown')
            room_area = room_data.get('area', 0)
            
            # Generate room-specific layout
            room_layout = await self._generate_room_layout(
                room_id,
                room_type,
                room_area,
                description,
                style
            )
            
            layout_plan['rooms'][room_id] = room_layout
            
            # Add furniture to the global furniture list
            for furniture in room_layout.get('furniture', []):
                # Clone furniture and add room association
                furniture_copy = dict(furniture)
                furniture_copy['room_id'] = room_id
                layout_plan['furniture'].append(furniture_copy)
        
        # Add global furniture (shared between rooms)
        global_furniture = await self._add_global_furniture(layout_plan, requirements)
        for furniture in global_furniture:
            layout_plan['furniture'].append(furniture)
            
        return layout_plan
        
    async def _generate_room_layout(self, 
                                  room_id: str,
                                  room_type: str,
                                  room_area: float,
                                  description: str,
                                  style: Dict[str, Any]) -> Dict[str, Any]:
        """Generate layout for a specific room"""
        # Get furniture templates based on room type
        furniture_templates = self._get_furniture_templates(room_type)
        
        # Scale furniture count based on room area
        furniture_count = self._calculate_furniture_count(room_type, room_area)
        
        # Select furniture based on description and style
        selected_furniture = self._select_furniture(
            furniture_templates,
            furniture_count,
            description,
            style
        )
        
        # Position furniture in the room
        positioned_furniture = self._position_furniture(
            selected_furniture,
            room_id,
            room_area
        )
        
        return {
            'id': room_id,
            'type': room_type,
            'furniture': positioned_furniture
        }
        
    def _get_furniture_templates(self, room_type: str) -> List[Dict[str, Any]]:
        """Get furniture templates for a room type"""
        # Common furniture templates by room type
        templates = {
            'living_room': [
                {'type': 'sofa', 'priority': 1, 'count_range': [1, 2]},
                {'type': 'coffee_table', 'priority': 1, 'count_range': [1, 1]},
                {'type': 'tv_stand', 'priority': 2, 'count_range': [0, 1]},
                {'type': 'armchair', 'priority': 2, 'count_range': [0, 2]},
                {'type': 'bookshelf', 'priority': 3, 'count_range': [0, 2]},
                {'type': 'side_table', 'priority': 3, 'count_range': [0, 2]},
                {'type': 'lamp', 'priority': 3, 'count_range': [0, 3]}
            ],
            'bedroom': [
                {'type': 'bed', 'priority': 1, 'count_range': [1, 1]},
                {'type': 'nightstand', 'priority': 2, 'count_range': [0, 2]},
                {'type': 'dresser', 'priority': 2, 'count_range': [0, 1]},
                {'type': 'wardrobe', 'priority': 2, 'count_range': [0, 1]},
                {'type': 'desk', 'priority': 3, 'count_range': [0, 1]},
                {'type': 'chair', 'priority': 3, 'count_range': [0, 1]},
                {'type': 'lamp', 'priority': 3, 'count_range': [0, 2]}
            ],
            'kitchen': [
                {'type': 'kitchen_table', 'priority': 1, 'count_range': [0, 1]},
                {'type': 'kitchen_chair', 'priority': 1, 'count_range': [0, 4]},
                {'type': 'kitchen_island', 'priority': 2, 'count_range': [0, 1]},
                {'type': 'bar_stool', 'priority': 3, 'count_range': [0, 3]}
            ],
            'dining_room': [
                {'type': 'dining_table', 'priority': 1, 'count_range': [1, 1]},
                {'type': 'dining_chair', 'priority': 1, 'count_range': [4, 8]},
                {'type': 'buffet', 'priority': 2, 'count_range': [0, 1]},
                {'type': 'china_cabinet', 'priority': 3, 'count_range': [0, 1]}
            ],
            'bathroom': [
                {'type': 'vanity', 'priority': 1, 'count_range': [1, 1]},
                {'type': 'shower', 'priority': 1, 'count_range': [0, 1]},
                {'type': 'bathtub', 'priority': 2, 'count_range': [0, 1]},
                {'type': 'toilet', 'priority': 1, 'count_range': [1, 1]}
            ],
            'office': [
                {'type': 'desk', 'priority': 1, 'count_range': [1, 1]},
                {'type': 'office_chair', 'priority': 1, 'count_range': [1, 1]},
                {'type': 'bookshelf', 'priority': 2, 'count_range': [0, 3]},
                {'type': 'filing_cabinet', 'priority': 3, 'count_range': [0, 2]}
            ]
        }
        
        # Default to living room if room type not found
        return templates.get(room_type, templates['living_room'])
        
    def _calculate_furniture_count(self, room_type: str, room_area: float) -> int:
        """Calculate appropriate furniture count based on room area"""
        # Base counts by room type (furniture pieces per square meter)
        base_densities = {
            'living_room': 0.15,
            'bedroom': 0.12,
            'kitchen': 0.1,
            'dining_room': 0.15,
            'bathroom': 0.25,
            'office': 0.15
        }
        
        # Default to living room density if room type not found
        density = base_densities.get(room_type, 0.15)
        
        # Calculate base count and apply minimum/maximum constraints
        base_count = int(room_area * density)
        min_count = max(3, int(room_area * 0.05))  # At least 3 pieces or 0.05/m²
        max_count = min(15, int(room_area * 0.3))  # At most 15 pieces or 0.3/m²
        
        return max(min_count, min(base_count, max_count))
        
    def _select_furniture(self,
                        templates: List[Dict[str, Any]],
                        total_count: int,
                        description: str,
                        style: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Select furniture based on templates, description and style"""
        selected = []
        remaining_count = total_count
        
        # Sort templates by priority (lower number = higher priority)
        sorted_templates = sorted(templates, key=lambda x: x['priority'])
        
        # First pass: add minimum counts for high priority items
        for template in sorted_templates:
            min_count = template['count_range'][0]
            if min_count > 0 and remaining_count > 0:
                # Add minimum required furniture
                for i in range(min_count):
                    if remaining_count <= 0:
                        break
                    
                    furniture = {
                        'type': template['type'],
                        'id': f"{template['type']}_{len(selected)}",
                        'style': style.get('style', 'modern')
                    }
                    
                    selected.append(furniture)
                    remaining_count -= 1
        
        # Second pass: fill remaining slots with random selection
        if remaining_count > 0:
            import random
            
            # Create a weighted distribution based on priority
            weighted_templates = []
            for template in sorted_templates:
                max_additional = template['count_range'][1] - template['count_range'][0]
                if max_additional > 0:
                    # Add template multiple times inversely proportional to priority
                    weight = max(1, 4 - template['priority'])
                    weighted_templates.extend([template] * weight)
            
            # Randomly select remaining furniture
            while remaining_count > 0 and weighted_templates:
                template = random.choice(weighted_templates)
                
                # Check if we've reached the maximum for this type
                type_count = sum(1 for f in selected if f['type'] == template['type'])
                if type_count >= template['count_range'][1]:
                    # Remove all instances of this template
                    weighted_templates = [t for t in weighted_templates if t['type'] != template['type']]
                    continue
                
                furniture = {
                    'type': template['type'],
                    'id': f"{template['type']}_{len(selected)}",
                    'style': style.get('style', 'modern')
                }
                
                selected.append(furniture)
                remaining_count -= 1
        
        return selected
        
    def _position_furniture(self,
                          furniture: List[Dict[str, Any]],
                          room_id: str,
                          room_area: float) -> List[Dict[str, Any]]:
        """Position furniture within a room"""
        positioned_furniture = []
        
        # Get room dimensions (simplified rectangular approximation)
        room_width = (room_area ** 0.5) * 1.2  # Width is 20% larger than square root of area
        room_length = room_area / room_width
        
        # Define furniture dimensions and placement rules
        furniture_dimensions = {
            'sofa': {'width': 2.0, 'depth': 0.9, 'height': 0.8, 'wall': True},
            'coffee_table': {'width': 1.2, 'depth': 0.6, 'height': 0.4, 'wall': False},
            'tv_stand': {'width': 1.8, 'depth': 0.5, 'height': 0.5, 'wall': True},
            'armchair': {'width': 0.9, 'depth': 0.9, 'height': 0.8, 'wall': False},
            'bookshelf': {'width': 0.9, 'depth': 0.35, 'height': 1.8, 'wall': True},
            'side_table': {'width': 0.5, 'depth': 0.5, 'height': 0.6, 'wall': False},
            'lamp': {'width': 0.3, 'depth': 0.3, 'height': 1.5, 'wall': False},
            'bed': {'width': 2.0, 'depth': 1.6, 'height': 0.5, 'wall': True},
            'nightstand': {'width': 0.5, 'depth': 0.4, 'height': 0.6, 'wall': True},
            'dresser': {'width': 1.2, 'depth': 0.5, 'height': 0.8, 'wall': True},
            'wardrobe': {'width': 1.2, 'depth': 0.6, 'height': 2.0, 'wall': True},
            'desk': {'width': 1.4, 'depth': 0.7, 'height': 0.75, 'wall': True},
            'chair': {'width': 0.5, 'depth': 0.5, 'height': 0.9, 'wall': False},
            'dining_table': {'width': 1.8, 'depth': 1.0, 'height': 0.75, 'wall': False},
            'dining_chair': {'width': 0.5, 'depth': 0.5, 'height': 0.9, 'wall': False},
            'kitchen_table': {'width': 1.2, 'depth': 0.8, 'height': 0.75, 'wall': False},
            'kitchen_chair': {'width': 0.45, 'depth': 0.45, 'height': 0.9, 'wall': False}
        }
        
        # Default dimensions for unknown furniture
        default_dim = {'width': 0.6, 'depth': 0.6, 'height': 0.6, 'wall': False}
        
        # Wall positions (simplified rectangular room)
        walls = [
            {'x': 0, 'z': 0, 'width': room_width, 'direction': [0, 1, 0]},    # North wall
            {'x': room_width, 'z': 0, 'width': room_length, 'direction': [1, 0, 0]},  # East wall
            {'x': 0, 'z': room_length, 'width': room_width, 'direction': [0, -1, 0]}, # South wall
            {'x': 0, 'z': 0, 'width': room_length, 'direction': [-1, 0, 0]}   # West wall
        ]
        
        import random
        import math
        
        # First, place wall-anchored furniture
        wall_furniture = [f for f in furniture if furniture_dimensions.get(f['type'], default_dim)['wall']]
        for item in wall_furniture:
            dim = furniture_dimensions.get(item['type'], default_dim)
            
            # Choose a random wall
            wall = random.choice(walls)
            
            # Calculate position along the wall
            if wall['direction'][0] == 0:  # North or South wall
                x = random.uniform(dim['depth'], wall['width'] - dim['depth'])
                z = wall['z']
                rotation = [0, 0, 0] if wall['direction'][1] > 0 else [0, math.pi, 0]
            else:  # East or West wall
                x = wall['x']
                z = random.uniform(dim['depth'], wall['width'] - dim['depth'])
                rotation = [0, math.pi/2, 0] if wall['direction'][0] > 0 else [0, -math.pi/2, 0]
            
            # Add positioned furniture
            positioned_item = dict(item)
            positioned_item['position'] = [x, 0, z]
            positioned_item['rotation'] = rotation
            positioned_item['dimensions'] = [dim['width'], dim['height'], dim['depth']]
            
            # Add placement constraints
            positioned_item['constraints'] = [FurnitureConstraint.AGAINST_WALL]
            
            positioned_furniture.append(positioned_item)
        
        # Then, place central furniture
        central_furniture = [f for f in furniture if not furniture_dimensions.get(f['type'], default_dim)['wall']]
        for item in central_furniture:
            dim = furniture_dimensions.get(item['type'], default_dim)
            
            # Place in center area with random position
            x = random.uniform(dim['width']/2 + 0.5, room_width - dim['width']/2 - 0.5)
            z = random.uniform(dim['depth']/2 + 0.5, room_length - dim['depth']/2 - 0.5)
            rotation = [0, random.uniform(0, 2*math.pi), 0]
            
            # Add positioned furniture
            positioned_item = dict(item)
            positioned_item['position'] = [x, 0, z]
            positioned_item['rotation'] = rotation
            positioned_item['dimensions'] = [dim['width'], dim['height'], dim['depth']]
            
            # Add placement constraints
            positioned_item['constraints'] = [FurnitureConstraint.CENTER_ROOM]
            
            positioned_furniture.append(positioned_item)
        
        return positioned_furniture
        
    async def _add_global_furniture(self, 
                                  layout_plan: Dict[str, Any], 
                                  requirements: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Add global furniture items that span multiple rooms"""
        # In a real implementation, this would add items like:
        # - Hallway furniture
        # - Staircases
        # - Room dividers
        # - Accent pieces at room transitions
        
        # For now, just return an empty list
        return []
    
    def _optimize_traffic_flow(self, layout_plan: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize furniture placement for traffic flow"""
        # Find high-traffic paths
        paths = list(nx.all_pairs_shortest_path(self.scene_graph))
        
        # Adjust furniture placement to maintain clear paths
        optimized_plan = dict(layout_plan)
        for source, target_paths in paths:
            for target, path in target_paths.items():
                if source != target:  # Skip self-paths
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
            
    def _find_connection(self, room1_id: str, room2_id: str) -> Dict[str, Any]:
        """Find connection (door, opening) between two rooms"""
        # Get connection data from graph edge if it exists
        edge_data = self.scene_graph.get_edge_data(room1_id, room2_id) or {}
        
        # Get connection type
        conn_type = edge_data.get('type', 'door')
        
        # For a real implementation, we would extract the exact door position
        # and dimensions from the scene data. For now, estimate a position.
        
        # Get room node data
        room1_data = self.scene_graph.nodes[room1_id].get('data', {})
        room2_data = self.scene_graph.nodes[room2_id].get('data', {})
        
        # Simplistic calculation of door position (center of shared wall)
        room1_center = room1_data.get('center', [0, 0, 0])
        room2_center = room2_data.get('center', [0, 0, 0])
        
        # Calculate a point between the centers
        door_position = [
            (room1_center[0] + room2_center[0]) / 2,
            0,  # Door at floor level
            (room1_center[2] + room2_center[2]) / 2
        ]
        
        # Calculate normal direction (from room1 to room2)
        direction = [
            room2_center[0] - room1_center[0],
            0,  # No vertical component
            room2_center[2] - room1_center[2]
        ]
        
        # Normalize direction
        length = (direction[0]**2 + direction[2]**2)**0.5
        if length > 0:
            direction = [direction[0]/length, 0, direction[2]/length]
        
        # Create connection object
        connection = {
            'type': conn_type,
            'rooms': [room1_id, room2_id],
            'position': door_position,
            'direction': direction,
            'width': 1.0 if conn_type == 'door' else 2.0,  # Default widths
            'height': 2.0 if conn_type == 'door' else 2.4
        }
        
        return connection
    
    def _adjust_furniture_for_clearance(self,
                                      layout_plan: Dict[str, Any],
                                      connection: Dict[str, Any],
                                      min_clearance: float):
        """Adjust furniture placement to maintain clearance around connections"""
        if not connection:
            return
            
        # Connection details
        conn_pos = connection['position']
        conn_width = connection['width']
        
        # Calculate clearance zone around connection
        # This is a simplified rectangular clearance zone
        half_width = conn_width / 2 + min_clearance
        
        # Direction perpendicular to the connection
        perp_dir = [-connection['direction'][2], 0, connection['direction'][0]]
        
        # Calculate clearance zone corners
        zone_corners = [
            [
                conn_pos[0] + perp_dir[0] * half_width + connection['direction'][0] * min_clearance,
                0,
                conn_pos[2] + perp_dir[2] * half_width + connection['direction'][2] * min_clearance
            ],
            [
                conn_pos[0] - perp_dir[0] * half_width + connection['direction'][0] * min_clearance,
                0,
                conn_pos[2] - perp_dir[2] * half_width + connection['direction'][2] * min_clearance
            ],
            [
                conn_pos[0] + perp_dir[0] * half_width - connection['direction'][0] * min_clearance,
                0,
                conn_pos[2] + perp_dir[2] * half_width - connection['direction'][2] * min_clearance
            ],
            [
                conn_pos[0] - perp_dir[0] * half_width - connection['direction'][0] * min_clearance,
                0,
                conn_pos[2] - perp_dir[2] * half_width - connection['direction'][2] * min_clearance
            ]
        ]
        
        # Find min/max bounds of clearance zone
        min_x = min(c[0] for c in zone_corners)
        max_x = max(c[0] for c in zone_corners)
        min_z = min(c[2] for c in zone_corners)
        max_z = max(c[2] for c in zone_corners)
        
        # Check each furniture item in connected rooms
        for room_id in connection['rooms']:
            if room_id not in layout_plan['rooms']:
                continue
                
            room_furniture = layout_plan['furniture']
            for i, furniture in enumerate(room_furniture):
                if furniture.get('room_id') != room_id:
                    continue
                    
                # Get furniture position and dimensions
                pos = furniture.get('position', [0, 0, 0])
                dims = furniture.get('dimensions', [0.6, 0.6, 0.6])
                
                # Calculate furniture bounds
                f_min_x = pos[0] - dims[0]/2
                f_max_x = pos[0] + dims[0]/2
                f_min_z = pos[2] - dims[2]/2
                f_max_z = pos[2] + dims[2]/2
                
                # Check if furniture intersects with clearance zone
                if (f_min_x <= max_x and f_max_x >= min_x and
                    f_min_z <= max_z and f_max_z >= min_z):
                    # Add clearance constraint to furniture
                    if 'constraints' not in furniture:
                        furniture['constraints'] = []
                    
                    if FurnitureConstraint.CLEAR_PATH not in furniture['constraints']:
                        furniture['constraints'].append(FurnitureConstraint.CLEAR_PATH)
                        
                    # Set clearance value
                    furniture['clearance'] = min_clearance

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
        
    def _find_furniture(self, scene: Dict[str, Any], furniture_id: str) -> Optional[Dict[str, Any]]:
        """Find furniture item by ID in scene"""
        # Check in main furniture list
        for item in scene.get('furniture', []):
            if item.get('id') == furniture_id:
                return item
                
        # Check in room-specific furniture lists
        for room in scene.get('rooms', {}).values():
            for item in room.get('furniture', []):
                if item.get('id') == furniture_id:
                    return item
                    
        # Check in detailed scene
        for item in scene.get('detailed_scene', {}).get('furniture', []):
            if item.get('id') == furniture_id:
                return item
                
        return None
        
    def _restore_furniture_state(self, scene: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
        """Restore furniture to previous state"""
        if not state or 'furniture_id' not in state:
            return scene
            
        # Create a copy of the scene to modify
        updated_scene = dict(scene)
        
        # Find the furniture item
        furniture = self._find_furniture(updated_scene, state['furniture_id'])
        
        # If found, restore its state
        if furniture and 'transform' in state:
            furniture['transform'] = dict(state['transform'])
            
        return updated_scene
    
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
        try:
            import torch
            from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
            
            # Initialize Stable Diffusion with optimized scheduler for texture generation
            self.stable_diffusion = StableDiffusionPipeline.from_pretrained(
                "stabilityai/stable-diffusion-2-1-base",
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
            )
            
            # Use DPM-Solver++ for faster inference
            self.stable_diffusion.scheduler = DPMSolverMultistepScheduler.from_config(
                self.stable_diffusion.scheduler.config,
                algorithm_type="dpmsolver++",
                use_karras_sigmas=True
            )
            
            # Move to appropriate device
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            self.stable_diffusion = self.stable_diffusion.to(device)
            
            # Enable memory optimization if on GPU
            if torch.cuda.is_available():
                self.stable_diffusion.enable_attention_slicing()
                
            print("TextureGenerator initialized successfully")
            return True
        except ImportError as e:
            print(f"Failed to initialize TextureGenerator: {e}")
            # Create minimal fallback implementation
            self.stable_diffusion = None
            return False
        
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
        
    async def _adjust_invalid_placement(self,
                                      furniture: Dict[str, Any],
                                      scene: Dict[str, Any]) -> Dict[str, Any]:
        """Adjust furniture placement that failed physics validation"""
        # Get current position and dimensions
        position = furniture['transform']['position']
        rotation = furniture['transform']['rotation']
        furniture_id = furniture.get('id', 'unknown')
        
        print(f"Adjusting invalid placement for furniture {furniture_id}")
        
        # Check if there are specific constraints
        constraints = furniture.get('constraints', [])
        has_wall_constraint = any(c == FurnitureConstraint.AGAINST_WALL for c in constraints)
        
        # Get room dimensions from scene
        room_id = furniture.get('room_id')
        room_data = None
        
        for room in scene.get('rooms', {}).values():
            if room.get('id') == room_id:
                room_data = room
                break
                
        if not room_data:
            # Fallback to general scene dimensions
            room_dims = [10, 0, 10]  # Default 10x10 room
        else:
            room_dims = room_data.get('dimensions', [10, 0, 10])
            
        # Try alternate positions
        adjusted_furniture = dict(furniture)
        
        # If it should be against a wall but isn't properly placed
        if has_wall_constraint:
            # Find nearest wall
            walls = [
                {'position': [0, 0, 0], 'normal': [1, 0, 0]},
                {'position': [room_dims[0], 0, 0], 'normal': [-1, 0, 0]},
                {'position': [0, 0, 0], 'normal': [0, 0, 1]},
                {'position': [0, 0, room_dims[2]], 'normal': [0, 0, -1]}
            ]
            
            # Find closest wall
            closest_wall = min(walls, key=lambda w: 
                ((w['position'][0] - position[0]) * w['normal'][0])**2 +
                ((w['position'][2] - position[2]) * w['normal'][2])**2
            )
            
            # Move furniture against the wall
            new_position = list(position)
            if closest_wall['normal'][0] != 0:
                # Adjust x position
                new_position[0] = closest_wall['position'][0]
                if closest_wall['normal'][0] > 0:
                    # Add small offset
                    new_position[0] += 0.1
                else:
                    new_position[0] -= 0.1
            else:
                # Adjust z position
                new_position[2] = closest_wall['position'][2]
                if closest_wall['normal'][2] > 0:
                    new_position[2] += 0.1
                else:
                    new_position[2] -= 0.1
                    
            # Align rotation to face away from wall
            import math
            if closest_wall['normal'][0] != 0:
                new_rotation = [0, math.pi/2 if closest_wall['normal'][0] > 0 else -math.pi/2, 0]
            else:
                new_rotation = [0, 0 if closest_wall['normal'][2] > 0 else math.pi, 0]
                
            adjusted_furniture['transform']['position'] = new_position
            adjusted_furniture['transform']['rotation'] = new_rotation
        else:
            # For center room furniture, try adjusting height and tilt
            new_position = list(position)
            new_position[1] = 0  # Ensure it's on the ground
            
            # Move slightly away from center to avoid collision
            import random
            import math
            
            # Get room center
            center_x = room_dims[0] / 2
            center_z = room_dims[2] / 2
            
            # Vector from center to furniture
            vec_x = position[0] - center_x
            vec_z = position[2] - center_z
            
            # Normalize
            length = math.sqrt(vec_x**2 + vec_z**2)
            if length < 0.1:
                # If too close to center, pick random direction
                angle = random.uniform(0, 2*math.pi)
                vec_x = math.cos(angle)
                vec_z = math.sin(angle)
                length = 1.0
                
            # Move slightly away from current position
            move_distance = 0.5  # 0.5m
            new_position[0] = position[0] + (vec_x / length) * move_distance
            new_position[2] = position[2] + (vec_z / length) * move_distance
            
            # Level the rotation
            new_rotation = list(rotation)
            new_rotation[0] = 0  # No x tilt
            new_rotation[2] = 0  # No z tilt
            
            adjusted_furniture['transform']['position'] = new_position
            adjusted_furniture['transform']['rotation'] = new_rotation
            
        # Add adjustment marker
        if 'metadata' not in adjusted_furniture:
            adjusted_furniture['metadata'] = {}
        adjusted_furniture['metadata']['adjusted'] = True
        
        return adjusted_furniture
        
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