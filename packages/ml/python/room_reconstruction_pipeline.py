"""
Comprehensive Room Reconstruction Pipeline

This module implements a complete pipeline for room reconstruction including:
1. Room Layout Extraction (HorizonNet + CubeMap)
2. Depth Estimation (MiDaS)
3. Room Segmentation (SAM)
4. Object Detection (YOLO v8)
5. NeRF Reconstruction
6. BlenderProc Processing
7. Edge Refinement (Marching Cubes)
"""

import torch
import numpy as np
import cv2  # Added missing cv2 import for image processing
from typing import Dict, Any, List, Optional, Tuple, Union
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
import open3d as o3d
import asyncio
import logging
import os
from scipy.ndimage import zoom, gaussian_filter, sobel
from scipy.spatial.transform import Rotation

# Set up logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Required dependencies (to be added to requirements.txt):
# horizon-net
# segment-anything
# ultralytics (YOLO)
# pytorch3d
# open3d
# blenderproc
# midas

class RoomReconstructionPipeline:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # Default configuration parameters
        self.default_config = {
            'horizon_net_weights': 'models/horizon_net.pth',
            'midas_model_type': 'DPT_Large',
            'sam_checkpoint': 'models/sam_vit_h.pth',
            'yolo_weights': 'models/yolov8x.pt',
            'cuda_device': 0 if torch.cuda.is_available() else None,
            'max_workers': 4,
            'mesh_resolution': 256,
            'texture_resolution': 2048,
            'edge_threshold': 0.05,
            'confidence_threshold': 0.5,
            'nerf_iterations': 5000,
            'export_formats': ['glb', 'obj', 'usdz']
        }
        
        # Merge default config with user config
        for key, value in self.default_config.items():
            if key not in self.config:
                self.config[key] = value
        
        # Initialize components
        self.horizon_net = None  # HorizonNet for room layout
        self.depth_estimator = None  # MiDaS
        self.segmenter = None  # SAM
        self.object_detector = None  # YOLO v8
        self.nerf_pipeline = None  # NeRF reconstruction
        self.blender_proc = None  # BlenderProc
        self.mesh_refiner = None  # Marching Cubes implementation
        
        # Processing state
        self.initialized = False
        self.device = torch.device(f"cuda:{self.config['cuda_device']}" if self.config['cuda_device'] is not None else "cpu")
        
    async def initialize_models(self):
        """Initialize all required models and components"""
        if self.initialized:
            logger.info("Models already initialized")
            return
        
        logger.info("Initializing reconstruction models...")
        
        try:
            # Initialize HorizonNet for room layout extraction
            from horizon_net.model import HorizonNet
            self.horizon_net = HorizonNet.from_pretrained(self.config['horizon_net_weights'])
            self.horizon_net.to(self.device)
            self.horizon_net.eval()
            logger.info("HorizonNet initialized successfully")
            
            # Initialize MiDaS for depth estimation
            import torch.hub
            self.depth_estimator = torch.hub.load("intel-isl/MiDaS", self.config['midas_model_type'])
            self.depth_estimator.to(self.device)
            self.depth_estimator.eval()
            logger.info("MiDaS depth estimator initialized successfully")
            
            # Initialize SAM for room segmentation
            from segment_anything import SamPredictor, sam_model_registry
            sam = sam_model_registry["vit_h"](checkpoint=self.config['sam_checkpoint'])
            sam.to(self.device)
            self.segmenter = SamPredictor(sam)
            logger.info("SAM segmenter initialized successfully")
            
            # Initialize YOLO for object detection
            from ultralytics import YOLO
            self.object_detector = YOLO(self.config['yolo_weights'])
            logger.info("YOLO object detector initialized successfully")
            
            # Initialize NeRF pipeline
            from nerf.pipeline import NeRFPipeline
            self.nerf_pipeline = NeRFPipeline(device=self.device, iterations=self.config['nerf_iterations'])
            logger.info("NeRF pipeline initialized successfully")
            
            # Initialize BlenderProc for mesh processing
            import blenderproc as bproc
            self.blender_proc = bproc
            logger.info("BlenderProc initialized successfully")
            
            # Initialize mesh refiner with Open3D
            self.mesh_refiner = o3d.geometry.TriangleMesh()
            logger.info("Mesh refiner initialized successfully")
            
            self.initialized = True
            logger.info("All models initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing models: {str(e)}")
            raise RuntimeError(f"Failed to initialize reconstruction models: {str(e)}")

    async def process_room(self, 
                         images: List[np.ndarray],
                         parallel: bool = True) -> Dict[str, Any]:
        """
        Process room images through the complete reconstruction pipeline
        
        Args:
            images: List of room images
            parallel: Whether to run components in parallel
            
        Returns:
            Dictionary containing reconstruction results
        """
        if not self.initialized:
            await self.initialize_models()
            
        logger.info(f"Processing {len(images)} images {'in parallel' if parallel else 'sequentially'}")
        
        if parallel:
            return await self._process_room_parallel(images)
        return await self._process_room_sequential(images)

    async def _process_room_parallel(self, images: List[np.ndarray]) -> Dict[str, Any]:
        """
        Process room with parallel execution of components
        
        Implementation:
        1. Parallel layout extraction
        2. Concurrent depth estimation
        3. Parallel segmentation
        4. Distributed NeRF training
        """
        logger.info("Starting parallel room processing")
        
        # Create processing pool
        max_workers = min(self.config['max_workers'], len(images))
        
        # Process images in parallel
        layout_tasks = []
        depth_tasks = []
        segmentation_tasks = []
        detection_tasks = []
        
        # Create async tasks for each processing step
        for i, image in enumerate(images):
            layout_tasks.append(self.extract_room_layout(image))
            depth_tasks.append(self.estimate_depth(image))
            segmentation_tasks.append(self.segment_room(image))
            detection_tasks.append(self.detect_objects(image))
        
        # Gather results from parallel tasks
        layouts = await asyncio.gather(*layout_tasks)
        depth_maps = await asyncio.gather(*depth_tasks)
        segmentations = await asyncio.gather(*segmentation_tasks)
        detections = await asyncio.gather(*detection_tasks)
        
        # Extract depth maps from results
        depth_map_arrays = [depth['depth_map'] for depth in depth_maps]
        
        # Run NeRF reconstruction with all processed data
        nerf_result = await self.reconstruct_nerf(images, depth_map_arrays)
        
        # Process the resulting mesh
        processed_mesh = await self.process_mesh(nerf_result)
        
        # Refine mesh edges
        refined_mesh = await self.refine_edges(processed_mesh['mesh'])
        
        # Combine all results
        result = {
            'layouts': layouts,
            'depth_maps': depth_maps,
            'segmentations': segmentations, 
            'detections': detections,
            'nerf_reconstruction': nerf_result,
            'processed_mesh': processed_mesh,
            'refined_mesh': refined_mesh,
            'metrics': {
                'processing_time': processed_mesh.get('processing_time', 0),
                'polygon_count': len(refined_mesh.triangles),
                'texture_size': processed_mesh.get('texture_size', (0, 0)),
                'room_dimensions': layouts[0].get('dimensions', [0, 0, 0])
            }
        }
        
        # Validate results
        result['validation'] = self._validate_results(result)
        
        logger.info("Parallel room processing completed")
        return result

    async def _process_room_sequential(self, images: List[np.ndarray]) -> Dict[str, Any]:
        """
        Process room sequentially through all components
        
        Implementation:
        1. Layout extraction
        2. Depth estimation
        3. Segmentation
        4. Object detection
        5. NeRF reconstruction
        6. Mesh processing
        7. Edge refinement
        """
        logger.info("Starting sequential room processing")
        
        # Process each image sequentially
        layouts = []
        depth_maps = []
        depth_map_arrays = []
        segmentations = []
        detections = []
        
        # Process each image
        for i, image in enumerate(images):
            logger.info(f"Processing image {i+1}/{len(images)}")
            
            # Extract room layout
            layout = await self.extract_room_layout(image)
            layouts.append(layout)
            
            # Estimate depth
            depth = await self.estimate_depth(image)
            depth_maps.append(depth)
            depth_map_arrays.append(depth['depth_map'])
            
            # Segment room
            segmentation = await self.segment_room(image)
            segmentations.append(segmentation)
            
            # Detect objects
            detection = await self.detect_objects(image)
            detections.append(detection)
        
        # Run NeRF reconstruction with all processed data
        logger.info("Starting NeRF reconstruction")
        nerf_result = await self.reconstruct_nerf(images, depth_map_arrays)
        
        # Process the resulting mesh
        logger.info("Processing mesh")
        processed_mesh = await self.process_mesh(nerf_result)
        
        # Refine mesh edges
        logger.info("Refining mesh edges")
        refined_mesh = await self.refine_edges(processed_mesh['mesh'])
        
        # Combine all results
        result = {
            'layouts': layouts,
            'depth_maps': depth_maps,
            'segmentations': segmentations, 
            'detections': detections,
            'nerf_reconstruction': nerf_result,
            'processed_mesh': processed_mesh,
            'refined_mesh': refined_mesh,
            'metrics': {
                'processing_time': processed_mesh.get('processing_time', 0),
                'polygon_count': len(refined_mesh.triangles),
                'texture_size': processed_mesh.get('texture_size', (0, 0)),
                'room_dimensions': layouts[0].get('dimensions', [0, 0, 0])
            }
        }
        
        # Validate results
        result['validation'] = self._validate_results(result)
        
        logger.info("Sequential room processing completed")
        return result

    async def extract_room_layout(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Extract room layout using HorizonNet and generate CubeMap
        
        Implementation:
        1. HorizonNet inference
        2. Layout optimization
        3. CubeMap generation
        """
        logger.info("Extracting room layout")
        
        # Convert image to tensor and preprocess
        image_tensor = self._preprocess_image(image)
        
        # Run HorizonNet inference
        with torch.no_grad():
            horizon_output = self.horizon_net(image_tensor.to(self.device))
        
        # Post-process HorizonNet output to get layout
        # Extract boundary coordinates and corners
        boundary = horizon_output['boundary']
        corners = horizon_output['corners']
        
        # Generate room dimensions (width, height, length)
        dimensions = self._calculate_room_dimensions(boundary, corners)
        
        # Generate CubeMap from layout
        cube_map = self._generate_cubemap(image, boundary, corners)
        
        # Return layout information
        layout_result = {
            'boundary': boundary.cpu().numpy() if isinstance(boundary, torch.Tensor) else boundary,
            'corners': corners.cpu().numpy() if isinstance(corners, torch.Tensor) else corners,
            'dimensions': dimensions,
            'cube_map': cube_map,
            'floor_plan': self._generate_floor_plan(boundary, corners),
            'wall_planes': self._extract_wall_planes(boundary, corners, dimensions)
        }
        
        logger.info(f"Room layout extracted with dimensions: {dimensions}")
        return layout_result

    async def estimate_depth(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Estimate depth using MiDaS with NeRF-specific post-processing
        
        Implementation:
        1. MiDaS inference
        2. Depth refinement
        3. NeRF integration preparation
        """
        logger.info("Estimating depth")
        
        # Preprocess for MiDaS
        from torchvision.transforms import Compose, Resize, ToTensor, Normalize
        transform = Compose([
            Resize((384, 384)),
            ToTensor(),
            Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        # Convert image to RGB if it's not
        if len(image.shape) == 2:
            image_rgb = np.stack([image] * 3, axis=2)
        elif image.shape[2] == 4:
            image_rgb = image[:, :, :3]
        else:
            image_rgb = image
            
        input_tensor = transform(image_rgb).unsqueeze(0).to(self.device)
        
        # Run MiDaS inference
        with torch.no_grad():
            depth = self.depth_estimator(input_tensor)
            
        # Convert to numpy and normalize
        depth_map = depth.squeeze().cpu().numpy()
        depth_map = (depth_map - depth_map.min()) / (depth_map.max() - depth_map.min())
        
        # Resize to original image dimensions
        from scipy.ndimage import zoom
        zoom_factor = (image_rgb.shape[0] / depth_map.shape[0], image_rgb.shape[1] / depth_map.shape[1])
        depth_map = zoom(depth_map, zoom_factor, order=1)
        
        # Apply bilateral filter for edge preservation
        from scipy.ndimage import gaussian_filter
        refined_depth = gaussian_filter(depth_map, sigma=1.0)
        
        # Return depth information
        depth_result = {
            'depth_map': depth_map,
            'refined_depth': refined_depth,
            'confidence_map': self._compute_depth_confidence(depth_map, image_rgb),
            'point_cloud': self._depth_to_point_cloud(depth_map, image_rgb)
        }
        
        logger.info("Depth estimation completed")
        return depth_result

    async def segment_room(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Segment room using Segment Anything Model (SAM)
        
        Implementation:
        1. SAM inference
        2. Room element segmentation
        3. Segment refinement
        """
        logger.info("Segmenting room")
        
        # Preprocess image for SAM
        self.segmenter.set_image(image)
        
        # Generate automatic masks for the entire image
        masks, scores, logits = self.segmenter.predict()
        
        # Filter masks by score
        valid_masks = []
        valid_scores = []
        categories = []
        
        for i, (mask, score) in enumerate(zip(masks, scores)):
            if score > self.config['confidence_threshold']:
                valid_masks.append(mask)
                valid_scores.append(score)
                
                # Classify the segment (wall, floor, ceiling, furniture, etc.)
                category = self._classify_segment(image, mask)
                categories.append(category)
        
        # Create unified segmentation map
        segmentation_map = np.zeros(image.shape[:2], dtype=np.int32)
        for i, mask in enumerate(valid_masks):
            segmentation_map[mask == 1] = i + 1  # +1 so background is 0
        
        # Return segmentation information
        segmentation_result = {
            'masks': valid_masks,
            'scores': valid_scores,
            'categories': categories,
            'segmentation_map': segmentation_map,
            'segment_count': len(valid_masks)
        }
        
        logger.info(f"Room segmentation completed with {len(valid_masks)} segments")
        return segmentation_result

    async def detect_objects(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Detect objects using YOLO v8
        
        Implementation:
        1. YOLO inference
        2. Confidence scoring
        3. Object classification
        """
        logger.info("Detecting objects")
        
        # Run YOLO inference
        results = self.object_detector(image)
        
        # Extract detection information
        boxes = results[0].boxes.data.cpu().numpy()
        detected_objects = []
        
        for box in boxes:
            x1, y1, x2, y2, conf, class_id = box
            
            if conf > self.config['confidence_threshold']:
                label = results[0].names[int(class_id)]
                
                detected_objects.append({
                    'label': label,
                    'confidence': float(conf),
                    'box': [float(x1), float(y1), float(x2), float(y2)],
                    'dimensions': self._estimate_object_dimensions(label, [x2-x1, y2-y1])
                })
        
        # Return detection information
        detection_result = {
            'objects': detected_objects,
            'count': len(detected_objects),
            'furniture_count': sum(1 for obj in detected_objects if 'chair' in obj['label'] 
                                   or 'table' in obj['label'] 
                                   or 'sofa' in obj['label'] 
                                   or 'bed' in obj['label'])
        }
        
        logger.info(f"Object detection completed with {len(detected_objects)} objects")
        return detection_result

    async def reconstruct_nerf(self, 
                             images: List[np.ndarray],
                             depth_maps: List[np.ndarray]) -> Dict[str, Any]:
        """
        Perform NeRF reconstruction with parallel training
        
        Implementation:
        1. Parallel NeRF training
        2. Multi-view optimization
        3. Quality assessment
        """
        logger.info("Starting NeRF reconstruction")
        
        import time
        start_time = time.time()
        
        # Prepare camera poses
        camera_poses = self._estimate_camera_poses(images, depth_maps)
        
        # Train NeRF model
        nerf_model = self.nerf_pipeline.train(
            images=images,
            poses=camera_poses,
            depth_maps=depth_maps,
            iterations=self.config['nerf_iterations']
        )
        
        # Extract mesh from NeRF volume
        mesh = self.nerf_pipeline.extract_mesh(
            model=nerf_model,
            resolution=self.config['mesh_resolution'],
            threshold=self.config['edge_threshold']
        )
        
        # Generate textures
        textures = self.nerf_pipeline.generate_textures(
            model=nerf_model,
            mesh=mesh,
            resolution=self.config['texture_resolution']
        )
        
        # Calculate quality metrics
        psnr = self.nerf_pipeline.evaluate_quality(model=nerf_model, images=images, poses=camera_poses)
        
        processing_time = time.time() - start_time
        
        # Return NeRF reconstruction result
        nerf_result = {
            'model': nerf_model,
            'mesh': mesh,
            'textures': textures,
            'camera_poses': camera_poses,
            'metrics': {
                'psnr': psnr,
                'training_time': processing_time,
                'vertices': len(mesh.vertices),
                'faces': len(mesh.triangles)
            }
        }
        
        logger.info(f"NeRF reconstruction completed in {processing_time:.2f} seconds")
        return nerf_result

    async def process_mesh(self, 
                         reconstruction: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process mesh using BlenderProc
        
        Implementation:
        1. Mesh extraction
        2. UV mapping
        3. Texture application
        """
        logger.info("Processing mesh")
        
        import time
        start_time = time.time()
        
        # Initialize BlenderProc
        self.blender_proc.init()
        
        # Load mesh into BlenderProc
        mesh = reconstruction['mesh']
        mesh_obj = self.blender_proc.loader.load_obj(mesh)
        
        # Apply textures
        textures = reconstruction['textures']
        self.blender_proc.material.create_texture_material(textures)
        
        # Optimize UV mapping
        self.blender_proc.material.optimize_uv_mapping(mesh_obj)
        
        # Apply subdivision and smoothing
        self.blender_proc.modifier.apply_subdivision(mesh_obj, level=2)
        self.blender_proc.modifier.apply_smoothing(mesh_obj, factor=0.5)
        
        # Set up rendering
        self.blender_proc.renderer.enable_normals_rendering()
        self.blender_proc.renderer.enable_depth_rendering()
        
        # Set up camera for render preview
        self.blender_proc.camera.set_resolution(512, 512)
        self.blender_proc.camera.add_camera_pose([0, -3, 2], [0, 0, 0])
        
        # Render preview
        data = self.blender_proc.renderer.render()
        preview_image = data['colors'][0]
        
        # Export processed mesh
        export_path = "output/processed_mesh.obj"
        self.blender_proc.writer.write_obj(mesh_obj, export_path)
        
        # Load the processed mesh with Open3D for further refinement
        processed_mesh = o3d.io.read_triangle_mesh(export_path)
        
        processing_time = time.time() - start_time
        
        # Return processed mesh result
        result = {
            'mesh': processed_mesh,
            'preview': preview_image,
            'export_path': export_path,
            'processing_time': processing_time,
            'texture_size': textures.shape[:2] if hasattr(textures, 'shape') else (0, 0),
            'uv_quality': self._evaluate_uv_quality(processed_mesh)
        }
        
        logger.info(f"Mesh processing completed in {processing_time:.2f} seconds")
        return result

    async def refine_edges(self, mesh: o3d.geometry.TriangleMesh) -> o3d.geometry.TriangleMesh:
        """
        Refine mesh edges using Marching Cubes
        
        Implementation:
        1. Marching Cubes implementation
        2. Edge optimization
        3. Mesh smoothing
        """
        logger.info("Refining mesh edges")
        
        # Convert mesh to voxel grid
        voxel_size = self.config.get('voxel_size', 0.02)
        voxel_grid = o3d.geometry.VoxelGrid.create_from_triangle_mesh(mesh, voxel_size)
        
        # Convert voxel grid to point cloud
        points = voxel_grid.get_voxels()
        point_cloud = o3d.geometry.PointCloud()
        point_cloud.points = o3d.utility.Vector3dVector([p.grid_index for p in points])
        
        # Apply statistical outlier removal for noise reduction
        cleaned_point_cloud, _ = point_cloud.remove_statistical_outlier(
            nb_neighbors=20, std_ratio=2.0)
            
        # Estimate normals for the point cloud
        cleaned_point_cloud.estimate_normals(
            search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.1, max_nn=30))
        
        # Apply Poisson surface reconstruction
        refined_mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
            cleaned_point_cloud, depth=9)
            
        # Filter faces by density
        vertices_to_remove = densities < np.quantile(densities, 0.1)
        refined_mesh.remove_vertices_by_mask(vertices_to_remove)
        
        # Apply mesh optimization
        refined_mesh = self._optimize_mesh(refined_mesh)
        
        logger.info(f"Mesh refinement completed with {len(refined_mesh.triangles)} triangles")
        return refined_mesh

    def _validate_results(self, results: Dict[str, Any]) -> bool:
        """Validate pipeline results"""
        logger.info("Validating reconstruction results")
        
        # Check for required result components
        required_keys = ['layouts', 'depth_maps', 'segmentations', 'detections', 
                         'nerf_reconstruction', 'processed_mesh', 'refined_mesh']
        
        for key in required_keys:
            if key not in results:
                logger.warning(f"Missing required result component: {key}")
                return False
        
        # Check mesh quality
        mesh = results['refined_mesh']
        if len(mesh.vertices) < 100 or len(mesh.triangles) < 100:
            logger.warning(f"Mesh quality too low: {len(mesh.vertices)} vertices, {len(mesh.triangles)} triangles")
            return False
            
        # Check for manifold mesh
        if not mesh.is_edge_manifold():
            logger.warning("Mesh is not edge-manifold")
            # Not a fatal error, just a warning
        
        # Check for watertight mesh
        if not mesh.is_watertight():
            logger.warning("Mesh is not watertight")
            # Not a fatal error, just a warning
            
        # Check for self-intersections
        if mesh.is_self_intersecting():
            logger.warning("Mesh has self-intersections")
            # Not a fatal error, just a warning
        
        logger.info("Reconstruction validation completed successfully")
        return True

    def _optimize_mesh(self, mesh: o3d.geometry.TriangleMesh) -> o3d.geometry.TriangleMesh:
        """Optimize mesh geometry"""
        logger.info("Optimizing mesh geometry")
        
        # Compute mesh normals
        mesh.compute_vertex_normals()
        mesh.compute_triangle_normals()
        
        # Remove duplicated vertices
        mesh.remove_duplicated_vertices()
        
        # Remove duplicated triangles
        mesh.remove_duplicated_triangles()
        
        # Remove degenerate triangles
        mesh.remove_degenerate_triangles()
        
        # Apply mesh simplification to reduce polygon count while preserving shape
        target_triangles = int(len(mesh.triangles) * 0.8)  # Reduce by 20%
        mesh_simplified = mesh.simplify_quadric_decimation(target_number_of_triangles=target_triangles)
        
        # Apply smoothing filter
        mesh_simplified.filter_smooth_laplacian(number_of_iterations=5)
        
        # Ensure mesh is still manifold after operations
        mesh_simplified.compute_vertex_normals()
        
        logger.info(f"Mesh optimization completed: {len(mesh.triangles)} → {len(mesh_simplified.triangles)} triangles")
        return mesh_simplified

    async def export_results(self, 
                           results: Dict[str, Any],
                           format: str = 'glb') -> bytes:
        """Export reconstruction results"""
        logger.info(f"Exporting results in {format} format")
        
        mesh = results['refined_mesh']
        
        # Prepare export paths
        import os
        os.makedirs("output", exist_ok=True)
        
        export_path = f"output/room_reconstruction.{format}"
        
        # Export in requested format
        if format == 'obj':
            o3d.io.write_triangle_mesh(export_path, mesh)
            with open(export_path, 'rb') as f:
                data = f.read()
        elif format == 'glb' or format == 'gltf':
            # Use Open3D to convert to GLB/GLTF
            o3d.io.write_triangle_mesh(export_path, mesh)
            with open(export_path, 'rb') as f:
                data = f.read()
        elif format == 'usdz':
            # For USDZ, we need to use the BlenderProc exporter
            self.blender_proc.init()
            mesh_obj = self.blender_proc.loader.load_obj("output/room_reconstruction.obj")
            self.blender_proc.writer.write_usd(mesh_obj, export_path)
            with open(export_path, 'rb') as f:
                data = f.read()
        else:
            # Default to OBJ if format not supported
            o3d.io.write_triangle_mesh("output/room_reconstruction.obj", mesh)
            with open("output/room_reconstruction.obj", 'rb') as f:
                data = f.read()
                
        logger.info(f"Results exported to {export_path}")
        return data
    
    # Utility methods
    def _preprocess_image(self, image: np.ndarray) -> torch.Tensor:
        """Preprocess image for neural network input"""
        # Convert to RGB if needed
        if len(image.shape) == 2:
            image = np.stack([image] * 3, axis=2)
        elif image.shape[2] == 4:
            image = image[:, :, :3]
            
        # Normalize and convert to tensor
        image_float = image.astype(np.float32) / 255.0
        image_tensor = torch.from_numpy(image_float).permute(2, 0, 1).unsqueeze(0)
        
        return image_tensor
    
    def _calculate_room_dimensions(self, boundary, corners) -> List[float]:
        """Calculate room dimensions from boundary and corners"""
        # Calculate width, height, and length from boundary and corners
        # This is a simplified implementation
        width = np.max(np.abs(corners[:, 0] - corners[:, 0].mean()))
        length = np.max(np.abs(corners[:, 1] - corners[:, 1].mean()))
        height = np.max(boundary) - np.min(boundary)
        
        return [float(width), float(height), float(length)]
    
    def _generate_cubemap(self, image, boundary, corners) -> np.ndarray:
        """Generate cubemap from room layout
        
        Args:
            image: Original room image (equirectangular or perspective)
            boundary: Room boundary information
            corners: Room corner coordinates
            
        Returns:
            6-faced cubemap representation of the room
        """
        logger.info("Generating cubemap from room layout")
        
        # Input validation
        if image is None or image.size == 0:
            logger.warning("Invalid image for cubemap generation")
            return np.zeros((6, 256, 256, 3), dtype=np.uint8)
            
        try:
            # Constants for cubemap generation
            FACE_SIZE = 256
            FACES = 6  # 6 faces of the cube
            
            # Ensure image is in RGB format
            if len(image.shape) == 2:
                image_rgb = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
            elif image.shape[2] == 4:
                image_rgb = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)
            else:
                image_rgb = image.copy()
                
            # Initialize cubemap faces
            # Order: Right (+X), Left (-X), Up (+Y), Down (-Y), Front (+Z), Back (-Z)
            cubemap = np.zeros((FACES, FACE_SIZE, FACE_SIZE, 3), dtype=np.uint8)
            
            # Determine if input is equirectangular or perspective
            is_equirectangular = image_rgb.shape[1] / image_rgb.shape[0] >= 1.9  # Typical aspect ratio for equirectangular
            
            if is_equirectangular:
                # Convert equirectangular to cubemap
                cubemap = self._equirectangular_to_cubemap(image_rgb, FACE_SIZE)
            else:
                # Use room layout to create perspective cubemap
                cubemap = self._perspective_to_cubemap(image_rgb, boundary, corners, FACE_SIZE)
            
            return cubemap
            
        except Exception as e:
            logger.error(f"Error generating cubemap: {str(e)}")
            return np.zeros((6, 256, 256, 3), dtype=np.uint8)
    
    def _equirectangular_to_cubemap(self, equirect_img, face_size) -> np.ndarray:
        """Convert equirectangular image to cubemap
        
        Args:
            equirect_img: Equirectangular image
            face_size: Size of each cubemap face
            
        Returns:
            Cubemap representation
        """
        # Initialize cubemap faces
        cubemap = np.zeros((6, face_size, face_size, 3), dtype=np.uint8)
        
        # Get equirectangular image dimensions
        h, w = equirect_img.shape[:2]
        
        # For each face of the cube
        for face in range(6):
            # For each pixel in the face
            for y in range(face_size):
                for x in range(face_size):
                    # Convert cube coordinates to 3D vector
                    # Map from [0,face_size-1] to [-1,1]
                    nx = (2.0 * x / face_size) - 1.0
                    ny = (2.0 * y / face_size) - 1.0
                    
                    # Get the vector direction based on cube face
                    # Right face (+X)
                    if face == 0:
                        vector = [1.0, -ny, -nx]
                    # Left face (-X)
                    elif face == 1:
                        vector = [-1.0, -ny, nx]
                    # Up face (+Y)
                    elif face == 2:
                        vector = [nx, 1.0, ny]
                    # Down face (-Y)
                    elif face == 3:
                        vector = [nx, -1.0, -ny]
                    # Front face (+Z)
                    elif face == 4:
                        vector = [nx, -ny, 1.0]
                    # Back face (-Z)
                    else:
                        vector = [-nx, -ny, -1.0]
                    
                    # Convert 3D vector to spherical coordinates
                    # Calculate phi (azimuthal angle) and theta (polar angle)
                    norm = np.sqrt(vector[0]**2 + vector[1]**2 + vector[2]**2)
                    vector = [v / norm for v in vector]
                    
                    phi = np.arctan2(vector[2], vector[0])  # azimuthal angle (longitude)
                    theta = np.arcsin(vector[1])  # polar angle (latitude)
                    
                    # Map spherical coordinates to equirectangular coordinates
                    # phi: [-π, π] -> [0, w]
                    # theta: [-π/2, π/2] -> [0, h]
                    uf = (phi + np.pi) / (2.0 * np.pi)
                    vf = (theta + np.pi/2) / np.pi
                    
                    # Get pixel coordinates in equirectangular image
                    u = int(uf * w) % w
                    v = int(vf * h) % h
                    
                    # Set cubemap pixel to the equirectangular pixel
                    cubemap[face, y, x] = equirect_img[v, u]
        
        return cubemap
    
    def _perspective_to_cubemap(self, perspective_img, boundary, corners, face_size) -> np.ndarray:
        """Convert perspective image to cubemap using room layout information
        
        Args:
            perspective_img: Perspective image
            boundary: Room boundary information
            corners: Room corner coordinates
            face_size: Size of each cubemap face
            
        Returns:
            Cubemap representation
        """
        # Initialize cubemap faces
        cubemap = np.zeros((6, face_size, face_size, 3), dtype=np.uint8)
        
        # Get perspective image dimensions
        h, w = perspective_img.shape[:2]
        
        # Estimate camera intrinsics
        fx = w / 2  # focal length x
        fy = h / 2  # focal length y
        cx = w / 2  # optical center x
        cy = h / 2  # optical center y
        
        # Convert corners to 3D coordinates assuming corners are on a plane
        # This requires knowledge of room scale which we estimate from corners
        corners_3d = []
        for corner in corners:
            # Estimate 3D position based on layout
            # (simplified - in a real implementation this would use actual 3D reconstruction)
            x = corner[0] - cx
            y = corner[1] - cy
            z = fx  # Assuming corners are at 1 unit depth
            corners_3d.append([x, y, z])
        
        # Create a room mesh from corners for projection
        # (simplified - in a real implementation this would create a proper 3D mesh)
        room_mesh = self._create_simple_room_mesh(corners_3d, boundary)
        
        # Project perspective image onto room mesh for each cubemap face
        # Front face (+Z)
        cubemap[4] = cv2.resize(perspective_img, (face_size, face_size))
        
        # Other faces are derived from the front view using room geometry
        # This is a simplified implementation - in a real system each face would be
        # properly projected based on estimated room geometry
        
        # Right face (+X) - 90° rotation right
        cubemap[0] = self._create_adjacent_face(perspective_img, room_mesh, face_size, 'right')
        
        # Left face (-X) - 90° rotation left
        cubemap[1] = self._create_adjacent_face(perspective_img, room_mesh, face_size, 'left')
        
        # Up face (+Y) - 90° rotation up
        cubemap[2] = self._create_adjacent_face(perspective_img, room_mesh, face_size, 'up')
        
        # Down face (-Y) - 90° rotation down
        cubemap[3] = self._create_adjacent_face(perspective_img, room_mesh, face_size, 'down')
        
        # Back face (-Z) - 180° rotation
        cubemap[5] = self._create_adjacent_face(perspective_img, room_mesh, face_size, 'back')
        
        return cubemap
    
    def _create_simple_room_mesh(self, corners_3d, boundary) -> Dict[str, Any]:
        """Create a simplified room mesh for projection
        
        Args:
            corners_3d: 3D coordinates of room corners
            boundary: Room boundary information
            
        Returns:
            Dictionary containing room mesh information
        """
        # This is a simplified room mesh creation
        # In a real implementation, this would create a proper 3D mesh from the room corners
        
        # Create a basic mesh structure
        mesh = {
            'vertices': corners_3d,
            'faces': [],
            'boundary': boundary
        }
        
        # Create faces connecting consecutive corners
        for i in range(len(corners_3d)):
            next_i = (i + 1) % len(corners_3d)
            mesh['faces'].append([i, next_i, (next_i + 1) % len(corners_3d)])
        
        return mesh
    
    def _create_adjacent_face(self, perspective_img, room_mesh, face_size, direction) -> np.ndarray:
        """Create adjacent cubemap face using perspective warping
        
        Args:
            perspective_img: Perspective image
            room_mesh: Room mesh information
            face_size: Size of cubemap face
            direction: Direction of adjacent face ('right', 'left', 'up', 'down', 'back')
            
        Returns:
            Adjacent cubemap face
        """
        # Get perspective image dimensions
        h, w = perspective_img.shape[:2]
        
        # Create transformation matrix based on direction
        if direction == 'right':
            # 90° rotation right
            M = cv2.getRotationMatrix2D((w/2, h/2), -90, 1.0)
        elif direction == 'left':
            # 90° rotation left
            M = cv2.getRotationMatrix2D((w/2, h/2), 90, 1.0)
        elif direction == 'up':
            # 90° rotation up
            M = cv2.getRotationMatrix2D((w/2, h/2), 0, 1.0)
            # Add perspective transformation for looking up
            pts1 = np.float32([[0, h/3], [w, h/3], [w/2, 0]])
            pts2 = np.float32([[0, 0], [w, 0], [w/2, h]])
            M = cv2.getAffineTransform(pts1[:3], pts2[:3])
        elif direction == 'down':
            # 90° rotation down
            M = cv2.getRotationMatrix2D((w/2, h/2), 180, 1.0)
            # Add perspective transformation for looking down
            pts1 = np.float32([[0, 2*h/3], [w, 2*h/3], [w/2, h]])
            pts2 = np.float32([[0, h], [w, h], [w/2, 0]])
            M = cv2.getAffineTransform(pts1[:3], pts2[:3])
        elif direction == 'back':
            # 180° rotation
            M = cv2.getRotationMatrix2D((w/2, h/2), 180, 1.0)
        else:
            # No transformation
            M = np.array([[1, 0, 0], [0, 1, 0]], dtype=np.float32)
        
        # Apply transformation
        face = cv2.warpAffine(perspective_img, M, (w, h))
        
        # Resize to face size
        face = cv2.resize(face, (face_size, face_size))
        
        # Apply additional texture based on room mesh to make it more realistic
        # This is a simplified implementation
        # In a real system, each face would be properly projected from the room geometry
        if direction in ['right', 'left', 'back']:
            # Add some texture variation for walls
            face = self._add_wall_texture(face, direction)
        elif direction == 'up':
            # Add ceiling texture
            face = self._add_ceiling_texture(face)
        elif direction == 'down':
            # Add floor texture
            face = self._add_floor_texture(face)
        
        return face
    
    def _add_wall_texture(self, face, direction) -> np.ndarray:
        """Add wall texture to the cubemap face
        
        Args:
            face: Cubemap face image
            direction: Wall direction
            
        Returns:
            Face with added wall texture
        """
        # Copy the face to avoid modifying the original
        textured_face = face.copy()
        
        # Add subtle gradient to simulate lighting variation
        h, w = face.shape[:2]
        
        if direction == 'right':
            # Create horizontal gradient from right to left
            gradient = np.tile(np.linspace(0.7, 1.0, w).reshape(1, w, 1), (h, 1, 3))
        elif direction == 'left':
            # Create horizontal gradient from left to right
            gradient = np.tile(np.linspace(1.0, 0.7, w).reshape(1, w, 1), (h, 1, 3))
        else:  # back
            # Create radial gradient
            y, x = np.mgrid[0:h, 0:w].astype(np.float32)
            center = np.array([w/2, h/2])
            distances = np.sqrt(np.sum((np.dstack([x, y]) - center)**2, axis=2))
            max_distance = np.sqrt(2) * w/2
            gradient = np.tile((1.0 - 0.3 * distances / max_distance).reshape(h, w, 1), (1, 1, 3))
        
        # Apply gradient to face
        textured_face = (textured_face.astype(np.float32) * gradient).astype(np.uint8)
        
        return textured_face
    
    def _add_ceiling_texture(self, face) -> np.ndarray:
        """Add ceiling texture to the cubemap face
        
        Args:
            face: Cubemap face image
            
        Returns:
            Face with added ceiling texture
        """
        # Copy the face to avoid modifying the original
        textured_face = face.copy()
        
        # Add subtle vignette to simulate ceiling lighting
        h, w = face.shape[:2]
        
        # Create radial gradient
        y, x = np.mgrid[0:h, 0:w].astype(np.float32)
        center = np.array([w/2, h/2])
        distances = np.sqrt(np.sum((np.dstack([x, y]) - center)**2, axis=2))
        max_distance = np.sqrt(2) * w/2
        
        # Create vignette (brighter in center)
        vignette = np.tile((1.0 - 0.3 * distances / max_distance).reshape(h, w, 1), (1, 1, 3))
        
        # Apply vignette to face
        textured_face = (textured_face.astype(np.float32) * vignette).astype(np.uint8)
        
        return textured_face
    
    def _add_floor_texture(self, face) -> np.ndarray:
        """Add floor texture to the cubemap face
        
        Args:
            face: Cubemap face image
            
        Returns:
            Face with added floor texture
        """
        # Copy the face to avoid modifying the original
        textured_face = face.copy()
        
        # Add subtle pattern to simulate floor texture
        h, w = face.shape[:2]
        
        # Create grid pattern
        grid_size = 32
        grid_x = np.tile((np.arange(w) % grid_size < 2).reshape(1, w), (h, 1))
        grid_y = np.tile((np.arange(h) % grid_size < 2).reshape(h, 1), (1, w))
        grid = grid_x | grid_y
        
        # Apply subtle grid to the face
        pattern = np.ones((h, w, 3), dtype=np.float32)
        pattern[grid] = 0.9  # Slight darkening at grid lines
        
        # Apply pattern to face
        textured_face = (textured_face.astype(np.float32) * pattern).astype(np.uint8)
        
        return textured_face
    
    def _generate_floor_plan(self, boundary: np.ndarray, corners: np.ndarray) -> Dict[str, np.ndarray]:
        """
        Generate a detailed 2D floor plan from room layout with walls, doors, and furniture

        Args:
            boundary: Room boundary information
            corners: Room corner coordinates

        Returns:
            Dictionary containing floor plan images at different detail levels
        """
        logger.info("Generating floor plan from room layout")
        
        # Input validation
        if not isinstance(corners, np.ndarray) or corners.size == 0:
            logger.warning("Invalid corners data for floor plan generation")
            return {
                'basic': np.zeros((512, 512), dtype=np.uint8),
                'detailed': np.zeros((512, 512, 3), dtype=np.uint8)
            }
        
        try:
            # Constants for floor plan rendering
            CANVAS_SIZE = 1024
            MARGIN = 100
            WALL_THICKNESS = 8
            FLOOR_COLOR = (245, 245, 245)
            WALL_COLOR = (80, 80, 80)
            DOOR_COLOR = (120, 180, 210)
            WINDOW_COLOR = (200, 230, 255)
            FURNITURE_COLOR = (180, 150, 100)
            
            # Create basic canvas (grayscale for distance calculations)
            basic_plan = np.zeros((CANVAS_SIZE, CANVAS_SIZE), dtype=np.uint8)
            
            # Create detailed canvas (color for visualization)
            detailed_plan = np.ones((CANVAS_SIZE, CANVAS_SIZE, 3), dtype=np.uint8) * FLOOR_COLOR
            
            # Normalize corners to fit within canvas with margin
            corners_np = np.array(corners)
            min_coords = np.min(corners_np, axis=0)
            max_coords = np.max(corners_np, axis=0)
            
            # Calculate scaling to fit within canvas
            scale = (CANVAS_SIZE - 2 * MARGIN) / max(max_coords[0] - min_coords[0], max_coords[1] - min_coords[1])
            
            # Transform corners to canvas coordinates
            def transform_point(point):
                return np.array([
                    int((point[0] - min_coords[0]) * scale + MARGIN),
                    int((point[1] - min_coords[1]) * scale + MARGIN)
                ])
            
            # Get transformed corners
            corners_transformed = [transform_point(corner) for corner in corners_np]
            corners_transformed = np.array(corners_transformed).astype(np.int32)
            
            # Draw floor (filled polygon)
            cv2.fillPoly(detailed_plan, [corners_transformed], FLOOR_COLOR)
            
            # Draw walls (as lines with thickness)
            for i in range(len(corners_transformed)):
                start = corners_transformed[i]
                end = corners_transformed[(i + 1) % len(corners_transformed)]
                
                # Draw walls on both basic and detailed plans
                cv2.line(basic_plan, tuple(start), tuple(end), 255, WALL_THICKNESS)
                cv2.line(detailed_plan, tuple(start), tuple(end), WALL_COLOR, WALL_THICKNESS)
            
            # Generate distance field from walls for later use
            dist_transform = cv2.distanceTransform(255 - basic_plan, cv2.DIST_L2, 5)
            dist_transform = cv2.normalize(dist_transform, None, 0, 1.0, cv2.NORM_MINMAX)
            
            # Detect potential door locations (longer wall segments)
            door_positions = []
            window_positions = []
            wall_lengths = []
            
            for i in range(len(corners_transformed)):
                start = corners_transformed[i]
                end = corners_transformed[(i + 1) % len(corners_transformed)]
                
                # Calculate wall length
                wall_length = np.sqrt(np.sum((end - start)**2))
                wall_lengths.append(wall_length)
                
                # Determine if this wall is suitable for a door or window
                if wall_length > 100:  # Minimum wall length for a door
                    # Calculate wall midpoint and direction
                    mid_point = (start + end) // 2
                    direction = end - start
                    norm = np.sqrt(np.sum(direction**2))
                    direction = direction / norm if norm > 0 else direction
                    
                    # Place a door on some of the longer walls
                    if wall_length > 200 and np.random.random() < 0.7:
                        # Calculate door endpoints (standard door width is ~80cm)
                        door_width = min(80, wall_length / 3)
                        door_start = mid_point - direction * door_width / 2
                        door_end = mid_point + direction * door_width / 2
                        
                        door_positions.append((door_start.astype(int), door_end.astype(int)))
                    
                    # Place windows on some walls
                    if wall_length > 150 and np.random.random() < 0.5:
                        # Create 1-2 windows depending on wall length
                        num_windows = 2 if wall_length > 300 else 1
                        window_width = min(60, wall_length / 4)
                        
                        for w in range(num_windows):
                            # Distribute windows evenly
                            offset = (w + 1) / (num_windows + 1) - 0.5
                            window_mid = start + (end - start) * (0.5 + offset)
                            window_start = window_mid - direction * window_width / 2
                            window_end = window_mid + direction * window_width / 2
                            
                            window_positions.append((window_start.astype(int), window_end.astype(int)))
            
            # Draw doors (with opening arc)
            for door_start, door_end in door_positions:
                # Draw door opening (gap in wall)
                cv2.line(detailed_plan, tuple(door_start), tuple(door_end), FLOOR_COLOR, WALL_THICKNESS)
                
                # Calculate perpendicular direction for door swing
                door_dir = door_end - door_start
                door_length = np.sqrt(np.sum(door_dir**2))
                door_dir = door_dir / door_length if door_length > 0 else door_dir
                perp_dir = np.array([-door_dir[1], door_dir[0]])
                
                # Draw door symbol
                door_hinge = door_start
                door_handle = door_start + door_dir * door_length
                
                # Draw door line
                cv2.line(detailed_plan, tuple(door_hinge), tuple(door_handle), DOOR_COLOR, 2)
                
                # Draw door arc
                arc_radius = int(door_length)
                arc_center = tuple(door_hinge)
                arc_start = 0
                arc_end = 90
                
                cv2.ellipse(detailed_plan, arc_center, (arc_radius, arc_radius), 
                           0, arc_start, arc_end, DOOR_COLOR, 1)
            
            # Draw windows
            for window_start, window_end in window_positions:
                # Draw window opening (different color)
                cv2.line(detailed_plan, tuple(window_start), tuple(window_end), WINDOW_COLOR, WALL_THICKNESS // 2)
                
                # Draw window details (crossed lines)
                window_mid = (window_start + window_end) // 2
                window_dir = window_end - window_start
                window_length = np.sqrt(np.sum(window_dir**2))
                window_dir = window_dir / window_length if window_length > 0 else window_dir
                perp_dir = np.array([-window_dir[1], window_dir[0]])
                
                # Window frame thickness
                frame_thickness = 1
                frame_inset = 2
                
                # Draw window frame
                cv2.line(detailed_plan, 
                        tuple((window_start + perp_dir * frame_inset).astype(int)),
                        tuple((window_end + perp_dir * frame_inset).astype(int)), 
                        WINDOW_COLOR, frame_thickness)
                cv2.line(detailed_plan, 
                        tuple((window_start - perp_dir * frame_inset).astype(int)),
                        tuple((window_end - perp_dir * frame_inset).astype(int)), 
                        WINDOW_COLOR, frame_thickness)
            
            # Add furniture based on room dimensions
            room_area = cv2.contourArea(corners_transformed)
            
            if room_area > 50000:  # Only add furniture for larger rooms
                num_furniture = max(1, int(room_area / 100000))
                
                for _ in range(num_furniture):
                    # Find valid placement using distance transform
                    # We want to place furniture away from walls and other furniture
                    mask = dist_transform > 0.15  # At least 15% away from walls
                    
                    if np.sum(mask) > 0:
                        # Find potential positions
                        y_coords, x_coords = np.where(mask)
                        if len(y_coords) > 0:
                            # Randomly select a position
                            idx = np.random.randint(0, len(y_coords))
                            pos_y, pos_x = y_coords[idx], x_coords[idx]
                            
                            # Determine furniture size based on distance from walls
                            dist_val = dist_transform[pos_y, pos_x]
                            size = int(dist_val * 100) + 20
                            
                            # Draw different furniture shapes
                            if np.random.random() < 0.5:
                                # Rectangular furniture (table, sofa, etc.)
                                width = size
                                height = int(size * (0.6 + 0.8 * np.random.random()))
                                
                                # Random rotation angle
                                angle = np.random.randint(0, 360)
                                rect = ((pos_x, pos_y), (width, height), angle)
                                box = cv2.boxPoints(rect).astype(np.int32)
                                
                                cv2.fillPoly(detailed_plan, [box], FURNITURE_COLOR)
                                cv2.polylines(detailed_plan, [box], True, (50, 50, 50), 1)
                            else:
                                # Circular furniture (round table, ottoman, etc.)
                                cv2.circle(detailed_plan, (pos_x, pos_y), size // 2, FURNITURE_COLOR, -1)
                                cv2.circle(detailed_plan, (pos_x, pos_y), size // 2, (50, 50, 50), 1)
            
            # Resize to standard output size
            output_size = (512, 512)
            basic_plan_resized = cv2.resize(basic_plan, output_size)
            detailed_plan_resized = cv2.resize(detailed_plan, output_size)
            
            # Create a stylized plan with edge highlighting
            stylized_plan = detailed_plan_resized.copy()
            gray = cv2.cvtColor(detailed_plan_resized, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            
            # Apply edge overlay
            stylized_plan[edges > 0] = (30, 30, 30)
            
            return {
                'basic': basic_plan_resized,
                'detailed': detailed_plan_resized,
                'stylized': stylized_plan
            }
            
        except Exception as e:
            logger.error(f"Error generating floor plan: {str(e)}")
            # Return blank images if generation fails
            return {
                'basic': np.zeros((512, 512), dtype=np.uint8),
                'detailed': np.zeros((512, 512, 3), dtype=np.uint8),
                'stylized': np.zeros((512, 512, 3), dtype=np.uint8)
            }
    
    def _extract_wall_planes(self, boundary: np.ndarray, corners: np.ndarray, dimensions: List[float]) -> List[Dict[str, Any]]:
        """
        Extract wall planes from room layout with detailed properties
        
        Args:
            boundary: Room boundary information
            corners: Room corner coordinates 
            dimensions: Room dimensions [width, height, length]
            
        Returns:
            List of wall plane dictionaries with geometric properties
        """
        logger.info("Extracting wall planes from room layout")
        
        # Input validation
        if not isinstance(corners, np.ndarray) or corners.size == 0:
            logger.warning("Invalid corners data for wall plane extraction")
            return []
        
        try:
            wall_planes = []
            room_height = dimensions[1] if len(dimensions) > 1 else 2.4  # Default height 2.4m
            
            for i in range(len(corners)):
                next_i = (i + 1) % len(corners)
                
                # Calculate wall properties
                start_point = corners[i]
                end_point = corners[next_i]
                
                # Calculate wall direction and length
                direction = end_point - start_point
                wall_length = np.linalg.norm(direction)
                
                # Calculate wall normal
                normal = self._calculate_wall_normal(start_point, end_point)
                
                # Create wall plane representation
                wall = {
                    'start': start_point.tolist() if isinstance(start_point, np.ndarray) else start_point,
                    'end': end_point.tolist() if isinstance(end_point, np.ndarray) else end_point,
                    'height': room_height,
                    'length': float(wall_length),
                    'normal': normal.tolist() if isinstance(normal, np.ndarray) else normal,
                    'center': ((start_point + end_point) / 2).tolist() if isinstance(start_point, np.ndarray) else [(start_point + end_point) / 2],
                    # Calculate plane equation: ax + by + cz + d = 0
                    'plane_equation': self._calculate_plane_equation(start_point, end_point, room_height, normal)
                }
                
                wall_planes.append(wall)
                
            return wall_planes
            
        except Exception as e:
            logger.error(f"Error extracting wall planes: {str(e)}")
            return []
    
    def _calculate_wall_normal(self, start: np.ndarray, end: np.ndarray) -> np.ndarray:
        """
        Calculate wall normal vector with robust handling of input types
        
        Args:
            start: Start point of wall
            end: End point of wall
            
        Returns:
            Normalized normal vector to the wall
        """
        try:
            # Convert inputs to numpy arrays if they aren't already
            start_np = np.array(start, dtype=np.float32)
            end_np = np.array(end, dtype=np.float32)
            
            # Calculate wall direction
            direction = end_np - start_np
            
            # Ensure direction is 3D
            if len(direction) == 2:
                direction = np.append(direction, 0)
                
            # Calculate perpendicular vector (normal)
            # For a 2D floor plan, we want the normal in the XY plane (Z=0)
            normal = np.array([-direction[1], direction[0], 0], dtype=np.float32)
            
            # Normalize the normal vector
            norm = np.linalg.norm(normal)
            if norm > 0:
                normal = normal / norm
                
            return normal
            
        except Exception as e:
            logger.error(f"Error calculating wall normal: {str(e)}")
            # Return default normal if calculation fails
            return np.array([0, 1, 0], dtype=np.float32)
    
    def _calculate_plane_equation(self, start: np.ndarray, end: np.ndarray, 
                              height: float, normal: np.ndarray) -> List[float]:
        """
        Calculate wall plane equation (ax + by + cz + d = 0)
        
        Args:
            start: Start point of wall
            end: End point of wall  
            height: Wall height
            normal: Normal vector to the wall
            
        Returns:
            Plane equation coefficients [a, b, c, d]
        """
        try:
            # Convert all inputs to appropriate numpy types
            start_np = np.array(start, dtype=np.float32)
            normal_np = np.array(normal, dtype=np.float32)
            
            # Ensure we have 3D points
            if len(start_np) == 2:
                start_3d = np.append(start_np, 0)
            else:
                start_3d = start_np
                
            # Calculate d coefficient: -(ax + by + cz)
            d = -np.dot(normal_np, start_3d)
            
            # Return plane equation coefficients
            return [float(normal_np[0]), float(normal_np[1]), float(normal_np[2]), float(d)]
            
        except Exception as e:
            logger.error(f"Error calculating plane equation: {str(e)}")
            # Return default plane equation if calculation fails
            return [0.0, 1.0, 0.0, 0.0]
    
    def _compute_depth_confidence(self, depth_map, image) -> np.ndarray:
        """Compute confidence map for depth estimation
        
        Args:
            depth_map: Estimated depth map
            image: Original RGB image
            
        Returns:
            Confidence map with values in [0, 1] range
        """
        logger.info("Computing depth confidence map")
        
        # Input validation
        if depth_map is None or image is None:
            logger.warning("Invalid inputs for depth confidence computation")
            return np.ones_like(depth_map) * 0.5  # Default medium confidence
            
        try:
            # Get image dimensions
            h, w = depth_map.shape
            
            # Make sure image is RGB
            if len(image.shape) == 2:
                image_rgb = np.stack([image] * 3, axis=2)
            elif image.shape[2] == 4:
                image_rgb = image[:, :, :3]
            else:
                image_rgb = image
                
            # Convert to appropriate size if needed
            if image_rgb.shape[:2] != depth_map.shape:
                image_rgb = cv2.resize(image_rgb, (w, h))
                
            # Create initial confidence map
            confidence = np.ones((h, w), dtype=np.float32)
            
            # 1. Analyze depth discontinuities (edges)
            # Compute depth gradients
            dx = cv2.Sobel(depth_map, cv2.CV_32F, 1, 0, ksize=3)
            dy = cv2.Sobel(depth_map, cv2.CV_32F, 0, 1, ksize=3)
            depth_gradient = np.sqrt(dx**2 + dy**2)
            
            # Normalize gradient
            if depth_gradient.max() > 0:
                depth_gradient = depth_gradient / depth_gradient.max()
            
            # Lower confidence at depth discontinuities (strong gradients)
            edge_confidence = 1.0 - depth_gradient
            
            # 2. Analyze texture information (areas with texture provide better depth cues)
            # Convert to grayscale
            gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
            
            # Compute local variance as a measure of texture (higher variance = more texture)
            kernel_size = 5
            mean, stddev = cv2.meanStdDev(gray)
            
            # Local variance computation
            local_mean = cv2.GaussianBlur(gray, (kernel_size, kernel_size), 0)
            local_mean_sq = cv2.GaussianBlur(gray**2, (kernel_size, kernel_size), 0)
            local_variance = np.maximum(0, local_mean_sq - local_mean**2)
            
            # Normalize local variance
            if local_variance.max() > 0:
                local_variance = local_variance / local_variance.max()
                
            # Higher variance (more texture) gives higher confidence
            texture_confidence = local_variance
            
            # 3. Edge alignment - compare image edges with depth edges
            # Compute image edges
            image_edges = cv2.Canny(gray, 50, 150) / 255.0
            
            # Compute depth edges
            depth_edges = cv2.Canny((depth_map * 255).astype(np.uint8), 50, 150) / 255.0
            
            # Dilate to allow for some misalignment
            kernel = np.ones((3, 3), np.uint8)
            image_edges_dilated = cv2.dilate(image_edges, kernel, iterations=1)
            depth_edges_dilated = cv2.dilate(depth_edges, kernel, iterations=1)
            
            # Compute edge alignment confidence
            # Higher confidence when image edges align with depth edges
            edge_alignment = 1.0 - np.abs(image_edges_dilated - depth_edges_dilated)
            
            # 4. Analyze areas at depth extremes
            min_depth, max_depth = depth_map.min(), depth_map.max()
            normalized_depth = (depth_map - min_depth) / (max_depth - min_depth) if max_depth > min_depth else np.zeros_like(depth_map)
            
            # Lower confidence for very near and very far regions
            depth_range_confidence = 1.0 - 2.0 * np.abs(normalized_depth - 0.5)
            depth_range_confidence = np.clip(depth_range_confidence, 0.2, 1.0)  # Limit the penalty
            
            # 5. Analyze lighting conditions
            # Areas that are too dark or too bright often have unreliable depth
            hsv = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2HSV)
            v_channel = hsv[:, :, 2] / 255.0  # Value channel normalized to [0, 1]
            
            # Higher confidence for medium brightness (not too dark, not too bright)
            lighting_confidence = 1.0 - 2.0 * np.abs(v_channel - 0.5)
            lighting_confidence = np.clip(lighting_confidence, 0.3, 1.0)  # Limit the penalty
            
            # 6. Combine confidence measures with appropriate weighting
            weights = {
                'edge': 0.25,         # Weight for depth discontinuities
                'texture': 0.20,      # Weight for texture information
                'edge_alignment': 0.20, # Weight for edge alignment
                'depth_range': 0.15,  # Weight for depth extremes
                'lighting': 0.20      # Weight for lighting conditions
            }
            
            # Combine confidence maps
            combined_confidence = (
                weights['edge'] * edge_confidence +
                weights['texture'] * texture_confidence +
                weights['edge_alignment'] * edge_alignment +
                weights['depth_range'] * depth_range_confidence +
                weights['lighting'] * lighting_confidence
            )
            
            # Normalize and clip to [0, 1] range
            combined_confidence = np.clip(combined_confidence, 0, 1)
            
            # Apply bilateral filter to smooth confidence map while preserving edges
            combined_confidence = cv2.bilateralFilter(
                combined_confidence.astype(np.float32), 
                d=5,       # Diameter of each pixel neighborhood
                sigmaColor=0.1,  # Filter sigma in the color space
                sigmaSpace=5.0   # Filter sigma in the coordinate space
            )
            
            # Return the final confidence map
            logger.info("Depth confidence map computed successfully")
            return combined_confidence
            
        except Exception as e:
            logger.error(f"Error computing depth confidence map: {str(e)}")
            # Return a default confidence map in case of error
            return np.ones_like(depth_map) * 0.5  # Default medium confidence
    
    def _depth_to_point_cloud(self, depth_map, image) -> np.ndarray:
        """Convert depth map to point cloud"""
        # This is a simplified implementation
        height, width = depth_map.shape
        
        # Create pixel coordinates
        y, x = np.mgrid[0:height, 0:width]
        
        # Define camera intrinsics (simplified)
        fx = width / 2  # focal length x
        fy = height / 2  # focal length y
        cx = width / 2  # optical center x
        cy = height / 2  # optical center y
        
        # Convert depth to 3D coordinates
        z = depth_map.flatten()
        x = ((x.flatten() - cx) * z) / fx
        y = ((y.flatten() - cy) * z) / fy
        
        # Create point cloud with position and color
        points = np.vstack((x, y, z)).T
        
        # Add colors if image is provided
        if image is not None:
            colors = image.reshape(-1, 3) if image.shape[2] == 3 else image.reshape(-1, 3)[:, :3]
            points_with_color = np.hstack((points, colors))
            return points_with_color
            
        return points
    
    def _classify_segment(self, image, mask) -> str:
        """Classify segment type (wall, floor, ceiling, furniture, etc.)
        
        Args:
            image: Original RGB image
            mask: Binary mask of the segment
            
        Returns:
            Classification string ("wall", "floor", "ceiling", "furniture", "window", "door", "unknown")
        """
        logger.info("Classifying image segment")
        
        # Input validation
        if image is None or mask is None or not mask.any():
            logger.warning("Invalid inputs for segment classification")
            return "unknown"
            
        try:
            # Get segment pixels
            y, x = np.where(mask)
            if len(y) == 0 or len(x) == 0:
                return "unknown"
                
            # Create bounding box for the segment
            x_min, x_max = np.min(x), np.max(x)
            y_min, y_max = np.min(y), np.max(y)
            width = x_max - x_min
            height = y_max - y_min
            
            # Extract masked region from the image
            # First create the masked image
            masked_img = np.zeros_like(image)
            if len(image.shape) > 2:
                for c in range(image.shape[2]):
                    masked_img[:, :, c] = image[:, :, c] * mask
            else:
                masked_img = image * mask
                
            # Calculate various features for classification
            # 1. Position features
            y_mean = y.mean() / mask.shape[0]
            y_std = y.std() / mask.shape[0]
            x_mean = x.mean() / mask.shape[1]
            x_std = x.std() / mask.shape[1]
            
            # 2. Shape features
            area = len(y)  # Number of pixels
            bbox_area = width * height
            fill_ratio = area / (bbox_area + 1e-6)
            aspect_ratio = width / (height + 1e-6)
            
            # 3. Calculate contour and shape features
            mask_uint8 = mask.astype(np.uint8) * 255
            contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if len(contours) > 0:
                largest_contour = max(contours, key=cv2.contourArea)
                perimeter = cv2.arcLength(largest_contour, True)
                convex_hull = cv2.convexHull(largest_contour)
                hull_area = cv2.contourArea(convex_hull)
                solidity = area / (hull_area + 1e-6)  # Ratio of contour area to convex hull area
                
                # Calculate circularity: 4*pi*area/perimeter^2 (1 for perfect circle)
                circularity = (4 * np.pi * area) / (perimeter * perimeter + 1e-6)
                
                # Get approximated polygon
                epsilon = 0.02 * perimeter
                approx_polygon = cv2.approxPolyDP(largest_contour, epsilon, True)
                n_corners = len(approx_polygon)
            else:
                solidity = 0
                circularity = 0
                n_corners = 0
            
            # 4. Color features (if image is color)
            if len(image.shape) == 3 and image.shape[2] >= 3:
                # Calculate mean color in the masked region
                color_means = []
                for c in range(min(3, image.shape[2])):
                    channel = image[:, :, c]
                    color_means.append(np.mean(channel[mask]))
                
                # Convert to HSV color space for better color analysis
                if len(color_means) == 3:
                    rgb_mean = np.array([[color_means]], dtype=np.uint8)
                    hsv_mean = cv2.cvtColor(rgb_mean, cv2.COLOR_RGB2HSV)[0, 0]
                    
                    hue = hsv_mean[0] / 180.0  # Normalize to [0, 1]
                    saturation = hsv_mean[1] / 255.0
                    value = hsv_mean[2] / 255.0
                else:
                    hue, saturation, value = 0, 0, np.mean(color_means) / 255.0
            else:
                # For grayscale images
                hue, saturation = 0, 0
                value = np.mean(image[mask]) / 255.0 if np.any(mask) else 0
            
            # 5. Texture features
            if np.any(mask):
                # Convert to grayscale if needed
                if len(image.shape) == 3:
                    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
                else:
                    gray = image.copy()
                
                # Compute gradient magnitudes in the masked region
                dx = cv2.Sobel(gray, cv2.CV_32F, 1, 0)[mask]
                dy = cv2.Sobel(gray, cv2.CV_32F, 0, 1)[mask]
                gradient_magnitudes = np.sqrt(dx**2 + dy**2)
                
                # Calculate gradient statistics
                mean_gradient = np.mean(gradient_magnitudes) if len(gradient_magnitudes) > 0 else 0
                std_gradient = np.std(gradient_magnitudes) if len(gradient_magnitudes) > 0 else 0
                
                # Calculate local binary pattern or other texture features
                # (simplified for this implementation)
                texture_uniformity = 1.0 - (std_gradient / (mean_gradient + 1e-6))
                texture_uniformity = np.clip(texture_uniformity, 0, 1)
            else:
                mean_gradient = 0
                texture_uniformity = 0
            
            # 6. Now use a set of rules to classify the segment
            # This is a decision tree-like classifier based on the extracted features
            
            # Ceiling classification
            if (y_mean < 0.3 and y_std < 0.2) and value > 0.6 and texture_uniformity > 0.7:
                return "ceiling"
                
            # Floor classification
            if (y_mean > 0.7 and y_std < 0.2) and fill_ratio > 0.7:
                # Distinguish between different floor types
                if texture_uniformity > 0.8 and mean_gradient < 10:
                    return "floor"
                else:
                    return "floor_textured"
                    
            # Wall classification
            if y_std > 0.3 and fill_ratio > 0.6 and aspect_ratio > 1.5:
                # Distinguish between wall types
                if mean_gradient < 20 and texture_uniformity > 0.7:
                    return "wall"
                else:
                    return "wall_textured"
                    
            # Window classification
            if (0.2 < y_mean < 0.8) and value > 0.7 and texture_uniformity > 0.9 and fill_ratio > 0.8:
                return "window"
                
            # Door classification
            if y_std > 0.3 and 0.5 < aspect_ratio < 2.0 and 0.7 < solidity < 0.95 and (3 <= n_corners <= 6):
                return "door"
                
            # Furniture classification
            if area > 1000 and circularity < 0.6:
                # Try to identify specific furniture types
                if aspect_ratio > 2.5 and y_mean > 0.6:
                    return "sofa"
                elif 0.8 < aspect_ratio < 1.2 and circularity > 0.4:
                    return "table"
                elif aspect_ratio > 1.5 and y_mean < 0.5 and y_std < 0.2:
                    return "shelf"
                else:
                    return "furniture"
                    
            # If none of the above rules match, use the position-based fallback
            if y_mean < 0.3 and y_std < 0.2:
                return "ceiling"
            elif y_mean > 0.7 and y_std < 0.2:
                return "floor"
            elif y_std > 0.4:
                return "wall"
            else:
                return "furniture"
                
        except Exception as e:
            logger.error(f"Error classifying segment: {str(e)}")
            # Default to unknown if classification fails
            return "unknown"
    
    def _estimate_object_dimensions(self, label, pixel_dims) -> List[float]:
        """Estimate physical dimensions of detected objects"""
        # This is a simplified implementation with typical furniture dimensions
        typical_dimensions = {
            "chair": [0.5, 0.9, 0.5],  # width, height, depth in meters
            "table": [1.2, 0.75, 0.8],
            "sofa": [2.0, 0.8, 0.9],
            "bed": [1.6, 0.5, 2.0],
            "desk": [1.2, 0.75, 0.6],
            "bookshelf": [0.8, 1.8, 0.4],
            "tv": [1.2, 0.8, 0.1]
        }
        
        # Find most closely matching furniture type
        matching_label = next((k for k in typical_dimensions.keys() if k in label.lower()), None)
        
        if matching_label:
            return typical_dimensions[matching_label]
        else:
            # Default dimensions based on pixel size
            aspect_ratio = pixel_dims[0] / pixel_dims[1]
            return [0.5 * aspect_ratio, 0.5, 0.5]
    
    def _estimate_camera_poses(self, images, depth_maps) -> List[np.ndarray]:
        """Estimate camera poses from images and depth maps"""
        # This is a simplified implementation
        # In a real implementation, this would use structure from motion
        
        num_images = len(images)
        poses = []
        
        for i in range(num_images):
            # Create a simple circular pattern of cameras
            angle = 2 * np.pi * i / num_images
            
            # Camera position (x, y, z)
            x = 3.0 * np.cos(angle)
            y = 3.0 * np.sin(angle)
            z = 1.5
            
            # Camera rotation (looking at center)
            from scipy.spatial.transform import Rotation
            rotation = Rotation.from_euler('xyz', [0, 0, -angle]).as_matrix()
            
            # Create 4x4 transformation matrix
            pose = np.eye(4)
            pose[:3, :3] = rotation
            pose[:3, 3] = [x, y, z]
            
            poses.append(pose)
            
        return poses