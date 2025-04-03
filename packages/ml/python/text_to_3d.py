import torch
import numpy as np
from typing import Dict, Any, Optional, List, Union

class ShapEModel:
    """Integration with Shap-E for base structure generation"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.tokenizer = None
        
    async def initialize(self):
        """Initialize Shap-E model and tokenizer"""
        # Load Shap-E model and tokenizer
        self.model = ShapEForGeneration.from_pretrained(
            "openai/shap-e-base",
            torch_dtype=torch.float16,
            device_map="auto"
        )
        self.tokenizer = AutoTokenizer.from_pretrained("openai/shap-e-base")
        
    async def generate_base_structure(self, prompt: str) -> Dict[str, Any]:
        """Generate base 3D structure from text prompt"""
        if not self.model or not self.tokenizer:
            await self.initialize()
            
        # Encode text prompt
        inputs = self.tokenizer(
            prompt,
            padding=True,
            truncation=True,
            return_tensors="pt"
        ).to(self.device)
        
        # Generate 3D structure
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                num_inference_steps=64,
                guidance_scale=7.5,
                height=256,
                width=256
            )
            
        # Convert to mesh format
        mesh = self._convert_to_mesh(outputs[0])
        
        # Add metadata
        return {
            'geometry': mesh,
            'prompt': prompt,
            'parameters': {
                'guidance_scale': 7.5,
                'inference_steps': 64
            }
        }
    
    async def refine_structure(self, 
                             base_structure: Dict[str, Any], 
                             feedback: str) -> Dict[str, Any]:
        """Refine generated structure based on feedback"""
        if not self.model or not self.tokenizer:
            await self.initialize()
            
        # Combine original prompt with feedback
        combined_prompt = f"{base_structure['prompt']} {feedback}"
        
        # Generate refined structure with higher guidance
        inputs = self.tokenizer(
            combined_prompt,
            padding=True,
            truncation=True,
            return_tensors="pt"
        ).to(self.device)
        
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                num_inference_steps=128,  # More steps for refinement
                guidance_scale=9.0,  # Higher guidance for more control
                height=256,
                width=256,
                initial_mesh=base_structure['geometry']  # Use previous as starting point
            )
            
        # Convert to mesh format
        refined_mesh = self._convert_to_mesh(outputs[0])
        
        return {
            'geometry': refined_mesh,
            'prompt': combined_prompt,
            'parameters': {
                'guidance_scale': 9.0,
                'inference_steps': 128
            },
            'original': base_structure
        }
        
    def _convert_to_mesh(self, model_output: torch.Tensor) -> Dict[str, Any]:
        """Convert model output to mesh format"""
        # Extract mesh data
        vertices = model_output.vertices.cpu().numpy()
        faces = model_output.faces.cpu().numpy()
        
        # Compute normals
        normals = self._compute_normals(vertices, faces)
        
        return {
            'vertices': vertices,
            'faces': faces,
            'normals': normals
        }
        
    def _compute_normals(self, 
                        vertices: np.ndarray, 
                        faces: np.ndarray) -> np.ndarray:
        """Compute vertex normals for the mesh"""
        normals = np.zeros_like(vertices)
        
        # Compute face normals and accumulate on vertices
        for face in faces:
            v0, v1, v2 = vertices[face]
            normal = np.cross(v1 - v0, v2 - v0)
            normals[face] += normal
            
        # Normalize
        norms = np.linalg.norm(normals, axis=1, keepdims=True)
        norms[norms == 0] = 1
        normals /= norms
        
        return normals

class GET3DModel:
    """Integration with GET3D for detailed scene generation"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.dataset = None
        
    async def initialize(self):
        """Initialize GET3D model and dataset"""
        # Load GET3D model
        self.model = GET3DForGeneration.from_pretrained(
            "nvidia/get3d-base",
            torch_dtype=torch.float16,
            device_map="auto"
        )
        
        # Load 3D-FRONT dataset for reference
        self.dataset = ThreeDFrontDataset(self.config.get('dataset_path', ''))
        await self.dataset.initialize()
        
    async def generate_scene_details(self, 
                                   base_structure: Dict[str, Any],
                                   prompt: str,
                                   style_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate detailed scene from base structure"""
        if not self.model or not self.dataset:
            await self.initialize()
            
        # Get style reference from dataset
        style_reference = await self.dataset.get_style_reference(style_params or {})
        
        # Generate scene details
        with torch.no_grad():
            scene_details = self.model.generate(
                base_geometry=base_structure['geometry'],
                text_prompt=prompt,
                style_reference=style_reference,
                num_inference_steps=64,
                guidance_scale=7.5
            )
            
        # Process and enhance details
        enhanced_details = await self._enhance_scene_details(
            scene_details,
            prompt,
            style_params
        )
        
        return {
            'geometry': enhanced_details,
            'prompt': prompt,
            'style': style_params,
            'parameters': {
                'guidance_scale': 7.5,
                'inference_steps': 64
            }
        }
    
    async def add_furniture(self, 
                          furniture_type: str,
                          description: str,
                          style_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate and add furniture based on description"""
        if not self.model or not self.dataset:
            await self.initialize()
            
        # Get furniture reference from dataset
        furniture_reference = await self.dataset.get_furniture_reference(
            furniture_type,
            style_params or {}
        )
        
        # Generate furniture
        with torch.no_grad():
            furniture = self.model.generate_furniture(
                text_prompt=description,
                furniture_type=furniture_type,
                reference=furniture_reference,
                num_inference_steps=32,
                guidance_scale=7.0
            )
            
        # Process and optimize furniture
        optimized_furniture = await self._optimize_furniture(
            furniture,
            description,
            style_params
        )
        
        return {
            'model': optimized_furniture,
            'type': furniture_type,
            'description': description,
            'style': style_params
        }
        
    async def _enhance_scene_details(self,
                                   scene_details: torch.Tensor,
                                   prompt: str,
                                   style_params: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Enhance generated scene details"""
        # Convert to mesh format
        mesh = self._convert_to_mesh(scene_details)
        
        # Apply style-specific enhancements
        if style_params and style_params.get('style'):
            mesh = await self._apply_style_enhancements(
                mesh,
                style_params['style']
            )
            
        return mesh
        
    async def _optimize_furniture(self,
                                furniture: torch.Tensor,
                                description: str,
                                style_params: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Optimize generated furniture"""
        # Convert to mesh format
        mesh = self._convert_to_mesh(furniture)
        
        # Optimize geometry
        mesh = self._optimize_geometry(mesh)
        
        # Apply style-specific optimizations
        if style_params and style_params.get('style'):
            mesh = await self._apply_style_optimizations(
                mesh,
                style_params['style']
            )
            
        return mesh
        
    def _convert_to_mesh(self, model_output: torch.Tensor) -> Dict[str, Any]:
        """Convert model output to mesh format"""
        vertices = model_output.vertices.cpu().numpy()
        faces = model_output.faces.cpu().numpy()
        
        # Compute additional attributes
        normals = self._compute_normals(vertices, faces)
        uvs = self._generate_uvs(vertices)
        
        return {
            'vertices': vertices,
            'faces': faces,
            'normals': normals,
            'uvs': uvs
        }
        
    def _generate_uvs(self, vertices: np.ndarray) -> np.ndarray:
        """Generate UV coordinates for the mesh"""
        # Calculate bounding box
        min_coords = np.min(vertices, axis=0)
        max_coords = np.max(vertices, axis=0)
        size = max_coords - min_coords
        
        # Project vertices onto dominant planes
        xy_size = size[0] * size[1]
        yz_size = size[1] * size[2]
        xz_size = size[0] * size[2]
        
        if xy_size >= yz_size and xy_size >= xz_size:
            # Use XY projection
            uvs = vertices[:, [0, 1]]
        elif yz_size >= xy_size and yz_size >= xz_size:
            # Use YZ projection
            uvs = vertices[:, [1, 2]]
        else:
            # Use XZ projection
            uvs = vertices[:, [0, 2]]
            
        # Normalize to [0, 1] range
        uvs = (uvs - np.min(uvs, axis=0)) / (np.max(uvs, axis=0) - np.min(uvs, axis=0))
        
        return uvs
    
    async def _apply_style_enhancements(self,
                                      mesh: Dict[str, Any],
                                      style: str) -> Dict[str, Any]:
        """Apply style-specific enhancements to the mesh"""
        # Get style reference from dataset
        style_ref = await self.dataset.get_style_reference({'style': style})
        
        # Extract style features
        style_features = self._extract_style_features(style_ref)
        
        # Apply style transformations
        enhanced_mesh = dict(mesh)
        
        # Modify geometry based on style
        if 'geometric_features' in style_features:
            enhanced_mesh['vertices'] = self._apply_geometric_style(
                mesh['vertices'],
                style_features['geometric_features']
            )
            
        # Update normals if geometry changed
        if 'vertices' in enhanced_mesh:
            enhanced_mesh['normals'] = self._compute_normals(
                enhanced_mesh['vertices'],
                mesh['faces']
            )
            
        return enhanced_mesh
    
    async def _apply_style_optimizations(self,
                                       mesh: Dict[str, Any],
                                       style: str) -> Dict[str, Any]:
        """Apply style-specific optimizations to furniture"""
        # Get style-specific parameters
        style_params = await self.dataset.get_style_parameters(style)
        
        # Apply style-specific optimizations
        optimized_mesh = dict(mesh)
        
        # Optimize geometry for style
        if 'detail_level' in style_params:
            optimized_mesh = self._adjust_detail_level(
                optimized_mesh,
                style_params['detail_level']
            )
            
        # Apply style-specific deformations
        if 'deformations' in style_params:
            optimized_mesh['vertices'] = self._apply_style_deformations(
                optimized_mesh['vertices'],
                style_params['deformations']
            )
            
        # Update dependent attributes
        if 'vertices' in optimized_mesh:
            optimized_mesh['normals'] = self._compute_normals(
                optimized_mesh['vertices'],
                optimized_mesh['faces']
            )
            optimized_mesh['uvs'] = self._generate_uvs(optimized_mesh['vertices'])
            
        return optimized_mesh
    
    def _optimize_geometry(self, mesh: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize mesh geometry"""
        # Simplify mesh while preserving features
        vertices = mesh['vertices']
        faces = mesh['faces']
        
        # Compute mesh complexity
        vertex_count = len(vertices)
        target_count = min(vertex_count, 10000)  # Limit vertex count
        
        if vertex_count > target_count:
            # Implement mesh decimation
            decimation_ratio = target_count / vertex_count
            vertices, faces = self._decimate_mesh(vertices, faces, decimation_ratio)
            
        # Remove duplicate vertices
        vertices, faces = self._remove_duplicates(vertices, faces)
        
        # Optimize vertex cache
        faces = self._optimize_vertex_cache(faces)
        
        return {
            **mesh,
            'vertices': vertices,
            'faces': faces
        }
    
    def _compute_edges(self, faces: np.ndarray) -> List[Tuple[int, int]]:
        """Compute unique edges from faces"""
        edges = set()
        for face in faces:
            for i in range(3):
                v1, v2 = sorted([face[i], face[(i + 1) % 3]])
                edges.add((v1, v2))
        return list(edges)
    
    def _compute_edge_costs(self,
                          vertices: np.ndarray,
                          edges: List[Tuple[int, int]]) -> np.ndarray:
        """Compute cost of collapsing each edge"""
        costs = np.zeros(len(edges))
        for i, (v1, v2) in enumerate(edges):
            # Compute edge length
            length = np.linalg.norm(vertices[v1] - vertices[v2])
            
            # Compute feature preservation cost
            feature_cost = self._compute_feature_cost(vertices, v1, v2)
            
            # Combine costs
            costs[i] = length + feature_cost
            
        return costs
    
    def _compute_feature_cost(self,
                            vertices: np.ndarray,
                            v1: int,
                            v2: int) -> float:
        """Compute cost of preserving features when collapsing edge"""
        # Get vertex normals
        n1 = self._compute_vertex_normal(vertices, v1)
        n2 = self._compute_vertex_normal(vertices, v2)
        
        # Cost increases if normals differ significantly
        normal_diff = 1 - np.dot(n1, n2)
        
        return normal_diff * 10.0  # Weight normal difference heavily
    
    def _collapse_edge(self,
                      vertices: np.ndarray,
                      faces: np.ndarray,
                      v1: int,
                      v2: int) -> Tuple[np.ndarray, np.ndarray]:
        """Collapse edge by merging v2 into v1"""
        # Compute new vertex position
        new_pos = (vertices[v1] + vertices[v2]) / 2
        vertices[v1] = new_pos
        
        # Update faces
        faces = faces[faces != v2]  # Remove faces using v2
        faces[faces > v2] -= 1  # Update indices
        
        # Remove v2
        vertices = np.delete(vertices, v2, axis=0)
        
        return vertices, faces
    
    def _remove_duplicates(self,
                         vertices: np.ndarray,
                         faces: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Remove duplicate vertices"""
        # Round vertices to remove near-duplicates
        rounded = np.round(vertices, decimals=6)
        
        # Find unique vertices and get mapping
        unique_vertices, inverse = np.unique(rounded, axis=0, return_inverse=True)
        
        # Update face indices
        new_faces = inverse[faces]
        
        return unique_vertices, new_faces
    
    def _optimize_vertex_cache(self, faces: np.ndarray) -> np.ndarray:
        """Optimize face order for vertex cache efficiency"""
        # Compute vertex usage frequency
        vertex_count = np.max(faces) + 1
        frequency = np.zeros(vertex_count)
        for face in faces:
            frequency[face] += 1
            
        # Sort faces by most frequent vertex
        face_scores = np.zeros(len(faces))
        for i, face in enumerate(faces):
            face_scores[i] = np.max(frequency[face])
            
        sorted_indices = np.argsort(-face_scores)
        
        return faces[sorted_indices]
    
    def _extract_style_features(self, style_ref: Dict[str, Any]) -> Dict[str, Any]:
        """Extract geometric features from style reference"""
        features = {}
        
        if 'geometric_patterns' in style_ref:
            features['geometric_features'] = {
                'patterns': style_ref['geometric_patterns'],
                'scale': style_ref.get('pattern_scale', 1.0),
                'strength': style_ref.get('pattern_strength', 0.5)
            }
            
        if 'deformations' in style_ref:
            features['deformations'] = {
                'type': style_ref['deformations']['type'],
                'parameters': style_ref['deformations']['parameters']
            }
            
        return features
    
    def _apply_geometric_style(self,
                             vertices: np.ndarray,
                             style_features: Dict[str, Any]) -> np.ndarray:
        """Apply geometric style features to vertices"""
        modified_vertices = vertices.copy()
        
        if 'patterns' in style_features:
            for pattern in style_features['patterns']:
                if pattern['type'] == 'wave':
                    modified_vertices = self._apply_wave_pattern(
                        modified_vertices,
                        pattern['axis'],
                        pattern['frequency'],
                        pattern['amplitude'] * style_features['strength']
                    )
                elif pattern['type'] == 'noise':
                    modified_vertices = self._apply_noise_pattern(
                        modified_vertices,
                        pattern['scale'],
                        pattern['strength'] * style_features['strength']
                    )
                    
        return modified_vertices
    
    def _apply_wave_pattern(self,
                          vertices: np.ndarray,
                          axis: int,
                          frequency: float,
                          amplitude: float) -> np.ndarray:
        """Apply wave pattern deformation"""
        modified = vertices.copy()
        
        # Apply sinusoidal wave along specified axis
        pos = vertices[:, axis]
        wave = np.sin(pos * frequency) * amplitude
        
        # Apply deformation perpendicular to axis
        perp_axis = (axis + 1) % 3
        modified[:, perp_axis] += wave
        
        return modified
    
    def _apply_noise_pattern(self,
                           vertices: np.ndarray,
                           scale: float,
                           strength: float) -> np.ndarray:
        """Apply noise pattern deformation"""
        modified = vertices.copy()
        
        # Generate 3D Perlin noise
        noise = np.random.rand(len(vertices), 3)  # Placeholder for actual Perlin noise
        
        # Apply noise with scale and strength
        modified += noise * strength * scale
        
        return modified

class DiffuSceneOptimizer:
    """Scene optimization using DiffuScene/SceneDiffuser"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.physics_client = None
        self.planner = None
        
    async def initialize(self):
        """Initialize DiffuScene model and physics engine"""
        # Initialize DiffuScene
        self.model = DiffuSceneModel.from_pretrained(
            "scene-diffuser/diffuscene-base",
            torch_dtype=torch.float16,
            device_map="auto"
        )
        
        # Initialize PyBullet physics
        self.physics_client = p.connect(p.DIRECT)
        p.setGravity(0, 0, -9.81)
        p.setPhysicsEngineParameter(
            numSolverIterations=50,
            enableConeFriction=1,
            contactBreakingThreshold=0.001
        )
        
        # Initialize graph-based planner
        self.planner = MultiLevelPlanner()
        
    async def optimize_scene(self, 
                           scene: Dict[str, Any],
                           constraints: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Optimize scene layout using DiffuScene"""
        if not self.model:
            await self.initialize()
            
        # Extract room layout and furniture
        layout = self._extract_layout(scene)
        furniture = self._extract_furniture(scene)
        
        # Generate optimal layout using DiffuScene
        with torch.no_grad():
            optimized_layout = self.model.optimize(
                room_layout=layout,
                furniture=furniture,
                constraints=constraints,
                num_iterations=100,
                learning_rate=0.01
            )
            
        # Apply physics-based validation
        physics_valid = await self._validate_physics(optimized_layout)
        
        if not physics_valid:
            # Adjust layout to satisfy physics constraints
            optimized_layout = await self._adjust_for_physics(optimized_layout)
            
        return self._apply_optimized_layout(scene, optimized_layout)
        
    async def optimize_multi_level(self,
                                 scene: Dict[str, Any],
                                 requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize multi-level home layout"""
        if not self.planner:
            await self.initialize()
            
        # Generate initial layout plan
        layout_plan = await self.planner.plan_layout(scene, requirements)
        
        # Optimize each level
        optimized_levels = {}
        for level, level_scene in layout_plan.items():
            optimized_level = await self.optimize_scene(
                level_scene,
                requirements.get(f'level_{level}', {})
            )
            optimized_levels[level] = optimized_level
            
        # Ensure connectivity between levels
        connected_layout = self.planner.ensure_level_connectivity(optimized_levels)
        
        return connected_layout
        
    async def _validate_physics(self, layout: Dict[str, Any]) -> bool:
        """Validate layout using PyBullet physics simulation"""
        # Load room geometry
        room_id = self._load_room_collision(layout['room'])
        
        # Load and place furniture
        furniture_bodies = []
        for furniture in layout['furniture']:
            body_id = self._load_furniture_collision(furniture)
            furniture_bodies.append(body_id)
            
        # Run physics simulation
        stable = True
        for _ in range(240):  # Simulate 4 seconds at 60Hz
            p.stepSimulation()
            
            # Check stability of each furniture piece
            for body_id in furniture_bodies:
                pos, orn = p.getBasePositionAndOrientation(body_id)
                if not self._is_stable(pos, orn):
                    stable = False
                    break
                    
        return stable
        
    def _is_stable(self, 
                   position: Tuple[float, float, float],
                   orientation: Tuple[float, float, float, float],
                   threshold: float = 0.05) -> bool:
        """Check if object is stable"""
        # Check if object has moved significantly from initial placement
        if abs(position[2]) > threshold:  # Check vertical movement
            return False
            
        # Check if object has tilted
        euler = p.getEulerFromQuaternion(orientation)
        if abs(euler[0]) > threshold or abs(euler[1]) > threshold:
            return False
            
        return True
        
    async def _adjust_for_physics(self, layout: Dict[str, Any]) -> Dict[str, Any]:
        """Adjust layout to satisfy physics constraints"""
        adjusted_layout = dict(layout)
        
        # Adjust furniture positions and orientations
        for furniture in adjusted_layout['furniture']:
            # Find stable position
            stable_pos = await self._find_stable_position(
                furniture,
                adjusted_layout['room']
            )
            furniture['position'] = stable_pos
            
            # Ensure proper floor contact
            furniture['position'][2] = self._compute_floor_height(
                furniture,
                adjusted_layout['room']
            )
            
        return adjusted_layout
        
    async def _find_stable_position(self,
                                  furniture: Dict[str, Any],
                                  room: Dict[str, Any]) -> List[float]:
        """Find stable position for furniture piece"""
        # Start from current position
        current_pos = furniture['position']
        
        # Sample positions in increasing radius
        for radius in [0.1, 0.2, 0.5, 1.0]:
            positions = self._sample_positions(current_pos, radius)
            
            # Test each position
            for pos in positions:
                if await self._test_position_stability(pos, furniture, room):
                    return pos
                    
        # Return original position if no stable position found
        return current_pos
        
    def _sample_positions(self,
                         center: List[float],
                         radius: float,
                         num_samples: int = 8) -> List[List[float]]:
        """Sample positions in a circle around center"""
        positions = []
        for i in range(num_samples):
            angle = 2 * np.pi * i / num_samples
            pos = [
                center[0] + radius * np.cos(angle),
                center[1] + radius * np.sin(angle),
                center[2]
            ]
            positions.append(pos)
        return positions
        
    async def _test_position_stability(self,
                                     position: List[float],
                                     furniture: Dict[str, Any],
                                     room: Dict[str, Any]) -> bool:
        """Test if furniture is stable at given position"""
        # Load furniture at position
        body_id = self._load_furniture_collision(furniture)
        p.resetBasePositionAndOrientation(
            body_id,
            position,
            p.getQuaternionFromEuler([0, 0, 0])
        )
        
        # Run short simulation
        stable = True
        for _ in range(60):  # 1 second at 60Hz
            p.stepSimulation()
            pos, orn = p.getBasePositionAndOrientation(body_id)
            if not self._is_stable(pos, orn):
                stable = False
                break
                
        # Remove test body
        p.removeBody(body_id)
        
        return stable
        
    def _compute_floor_height(self,
                            furniture: Dict[str, Any],
                            room: Dict[str, Any]) -> float:
        """Compute proper floor height for furniture"""
        # Get furniture bounds
        bounds = self._compute_bounds(furniture['geometry'])
        
        # Align bottom of bounds with floor
        return -bounds['min'][2]
        
    def _compute_bounds(self, geometry: Dict[str, Any]) -> Dict[str, List[float]]:
        """Compute bounding box of geometry"""
        vertices = geometry['vertices']
        return {
            'min': vertices.min(axis=0).tolist(),
            'max': vertices.max(axis=0).tolist()
        }
        
    def _extract_layout(self, scene: Dict[str, Any]) -> Dict[str, Any]:
        """Extract room layout from scene"""
        return {
            'bounds': scene['room']['bounds'],
            'walls': scene['room']['walls'],
            'openings': scene['room'].get('openings', []),
            'floor_plan': scene['room'].get('floor_plan', None)
        }
        
    def _extract_furniture(self, scene: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract furniture from scene"""
        return [
            {
                'type': item['type'],
                'geometry': item['geometry'],
                'position': item.get('position', [0, 0, 0]),
                'rotation': item.get('rotation', [0, 0, 0]),
                'constraints': item.get('constraints', [])
            }
            for item in scene.get('furniture', [])
        ]
        
    def _apply_optimized_layout(self,
                              scene: Dict[str, Any],
                              layout: Dict[str, Any]) -> Dict[str, Any]:
        """Apply optimized layout back to scene"""
        updated_scene = dict(scene)
        
        # Update furniture positions
        for i, furniture in enumerate(layout['furniture']):
            if i < len(updated_scene['furniture']):
                updated_scene['furniture'][i].update({
                    'position': furniture['position'],
                    'rotation': furniture['rotation']
                })
                
        return updated_scene

class MultiLevelPlanner:
    """Graph-based planning for multi-level homes"""
    
    def __init__(self):
        self.graph = nx.Graph()
        
    async def plan_layout(self,
                         scene: Dict[str, Any],
                         requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Plan layout for multi-level home"""
        # Build connectivity graph
        self._build_graph(scene)
        
        # Plan each level
        layout_plan = {}
        for level in sorted(self._get_levels(scene)):
            level_plan = await self._plan_level(
                scene,
                level,
                requirements.get(f'level_{level}', {})
            )
            layout_plan[level] = level_plan
            
        return layout_plan
        
    def ensure_level_connectivity(self,
                                levels: Dict[int, Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
        """Ensure proper connectivity between levels"""
        connected_levels = dict(levels)
        
        # Find connections between levels
        connections = self._find_level_connections()
        
        # Adjust layouts to maintain connections
        for level_a, level_b, connection in connections:
            self._align_connection(
                connected_levels[level_a],
                connected_levels[level_b],
                connection
            )
            
        return connected_levels
        
    def _build_graph(self, scene: Dict[str, Any]):
        """Build connectivity graph from scene"""
        self.graph.clear()
        
        # Add rooms as nodes
        for room in scene['rooms']:
            self.graph.add_node(
                room['id'],
                level=room['level'],
                type=room['type']
            )
            
        # Add connections
        for connection in scene['connections']:
            self.graph.add_edge(
                connection['from'],
                connection['to'],
                type=connection['type']
            )
            
    def _get_levels(self, scene: Dict[str, Any]) -> List[int]:
        """Get list of levels in scene"""
        levels = set()
        for room in scene['rooms']:
            levels.add(room['level'])
        return sorted(list(levels))
        
    async def _plan_level(self,
                         scene: Dict[str, Any],
                         level: int,
                         requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Plan layout for single level"""
        # Extract level-specific elements
        level_rooms = self._get_level_rooms(scene, level)
        level_furniture = self._get_level_furniture(scene, level)
        
        # Generate initial layout
        layout = {
            'rooms': level_rooms,
            'furniture': level_furniture
        }
        
        # Optimize room connectivity
        layout = self._optimize_room_connectivity(layout)
        
        # Place furniture according to requirements
        layout = await self._place_furniture(layout, requirements)
        
        return layout
        
    def _find_level_connections(self) -> List[Tuple[int, int, Dict[str, Any]]]:
        """Find connections between levels"""
        connections = []
        for u, v, data in self.graph.edges(data=True):
            if data['type'] in ['stairs', 'elevator']:
                level_u = self.graph.nodes[u]['level']
                level_v = self.graph.nodes[v]['level']
                if level_u != level_v:
                    connections.append((level_u, level_v, data))
        return connections
        
    def _align_connection(self,
                         level_a: Dict[str, Any],
                         level_b: Dict[str, Any],
                         connection: Dict[str, Any]):
        """Align connection points between levels"""
        # Find connection points
        point_a = self._find_connection_point(level_a, connection)
        point_b = self._find_connection_point(level_b, connection)
        
        # Compute alignment transform
        transform = self._compute_alignment_transform(point_a, point_b)
        
        # Apply transform to maintain alignment
        self._apply_transform(level_b, transform)

class TextTo3DPipeline:
    """Backend implementation for ThreeDDesignerAgent's text-to-3D generation"""
    
    def __init__(self):
        self.shap_e = ShapEModel()
        self.get3d = GET3DModel()
        self.diffuscene = DiffuSceneOptimizer()
        
    async def initialize(self):
        """Initialize all models"""
        await self.shap_e.initialize()
        await self.get3d.initialize()
        await self.diffuscene.initialize()
        
    async def generate_from_text(self,
                               prompt: str,
                               style_params: Optional[Dict[str, Any]] = None,
                               furniture_prompts: Optional[List[str]] = None) -> Dict[str, Any]:
        """Backend implementation for ThreeDDesignerAgent.generateRoomFromText"""
        # Generate base structure
        base_structure = await self.shap_e.generate_base_structure(prompt)
        
        # Generate detailed scene
        detailed_scene = await self.get3d.generate_scene_details(
            base_structure,
            prompt,
            style_params
        )
        
        # Add furniture if requested
        if furniture_prompts:
            for prompt in furniture_prompts:
                furniture = await self.get3d.add_furniture(
                    prompt,
                    style_params
                )
                detailed_scene['furniture'].append(furniture)
        
        # Optimize scene layout
        optimized_scene = await self.diffuscene.optimize_scene(
            detailed_scene,
            style_params
        )
        
        return {
            'base_structure': base_structure,
            'detailed_scene': detailed_scene,
            'final_scene': optimized_scene,
            'metadata': {
                'prompt': prompt,
                'style': style_params,
                'furniture_prompts': furniture_prompts
            }
        }
        
    async def refine_scene(self,
                          scene: Dict[str, Any],
                          feedback: str,
                          style_updates: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Refine existing scene based on feedback"""
        # Refine base structure if needed
        if 'structure' in feedback.lower():
            scene['base_structure'] = await self.shap_e.refine_structure(
                scene['base_structure'],
                feedback
            )
            
        # Refine scene details
        if 'detail' in feedback.lower() or 'style' in feedback.lower():
            scene['detailed_scene'] = await self.get3d.generate_scene_details(
                scene['base_structure'],
                feedback,
                style_updates
            )
            
        # Refine furniture if needed
        if 'furniture' in feedback.lower():
            for furniture in scene['detailed_scene'].get('furniture', []):
                refined_furniture = await self.get3d.add_furniture(
                    furniture['type'],
                    f"{feedback} {furniture['description']}",
                    style_updates
                )
                furniture.update(refined_furniture)
                
        # Re-optimize scene
        scene['final_scene'] = await self.diffuscene.optimize_scene(
            scene['detailed_scene'],
            style_updates
        )
        
        return scene
    
    async def refine_scene(self,
                          scene: Dict[str, Any],
                          feedback: str,
                          style_updates: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Refine existing scene based on feedback"""
        # Implementation would handle scene refinement
        pass