"""
COLMAP Structure-from-Motion (SfM) Service

This service provides camera pose estimation and Structure-from-Motion processing
using COLMAP for improving NeRF reconstructions with accurate camera positions.
"""

import os
import sys
import json
import shutil
import logging
import tempfile
from typing import Dict, List, Optional, Tuple, Union, Any

import numpy as np
import pycolmap
from pathlib import Path
from PIL import Image
import matplotlib.pyplot as plt

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("colmap_sfm")

class COLMAPService:
    """
    Service for camera pose estimation and Structure-from-Motion processing using COLMAP.
    Enhances NeRF training with accurate camera positions.
    """
    
    def __init__(self, 
                 work_dir: Optional[str] = None, 
                 feature_extractor: str = 'sift',
                 matcher: str = 'exhaustive',
                 quality: str = 'high'):
        """
        Initialize the COLMAP service.
        
        Args:
            work_dir: Working directory for COLMAP processing (default: temporary directory)
            feature_extractor: Feature extraction method ('sift', 'superpoint', etc.)
            matcher: Feature matching method ('exhaustive', 'sequential', etc.)
            quality: Quality setting ('low', 'medium', 'high')
        """
        self.work_dir = work_dir or tempfile.mkdtemp()
        self.feature_extractor = feature_extractor
        self.matcher = matcher
        self.quality = quality
        
        # Create necessary directories
        self.image_dir = os.path.join(self.work_dir, 'images')
        self.sparse_dir = os.path.join(self.work_dir, 'sparse')
        self.database_path = os.path.join(self.work_dir, 'database.db')
        
        os.makedirs(self.image_dir, exist_ok=True)
        os.makedirs(self.sparse_dir, exist_ok=True)
        
        logger.info(f"Initialized COLMAP service with work directory: {self.work_dir}")
        logger.info(f"Using feature extractor: {feature_extractor}, matcher: {matcher}, quality: {quality}")
        
        # Check if COLMAP is available
        try:
            self._check_colmap_installation()
            logger.info("COLMAP installation verified")
        except Exception as e:
            logger.error(f"COLMAP installation issue: {str(e)}")
            raise RuntimeError(f"COLMAP installation issue: {str(e)}")
    
    def _check_colmap_installation(self):
        """Verify COLMAP installation by checking if pycolmap is available."""
        try:
            # Just accessing a pycolmap function to check if it's available
            pycolmap.__version__
        except AttributeError:
            pass  # Version might not be available, but as long as import works, we're good
        except Exception as e:
            raise RuntimeError(f"Error verifying COLMAP installation: {str(e)}")
    
    def prepare_images(self, image_paths: List[str]) -> List[str]:
        """
        Copy images to the working directory and prepare for processing.
        
        Args:
            image_paths: List of paths to input images
            
        Returns:
            List of paths to prepared images in the working directory
        """
        prepared_paths = []
        
        # Clear existing images
        shutil.rmtree(self.image_dir, ignore_errors=True)
        os.makedirs(self.image_dir, exist_ok=True)
        
        # Copy images to working directory
        for i, img_path in enumerate(image_paths):
            try:
                # Open and verify image
                img = Image.open(img_path)
                # Save with numerical filename for consistent ordering
                new_path = os.path.join(self.image_dir, f"{i:06d}.jpg")
                img.save(new_path)
                prepared_paths.append(new_path)
                logger.info(f"Prepared image {i+1}/{len(image_paths)}")
            except Exception as e:
                logger.error(f"Error preparing image {img_path}: {str(e)}")
        
        return prepared_paths
    
    def extract_features(self) -> bool:
        """
        Extract features from prepared images.
        
        Returns:
            Success status
        """
        logger.info("Extracting features from images...")
        
        # Configure feature extraction options based on quality
        extraction_options = pycolmap.FeatureExtractorOptions()
        
        if self.quality == 'high':
            extraction_options.max_image_size = 3200
            extraction_options.max_num_features = 8192
        elif self.quality == 'medium':
            extraction_options.max_image_size = 2400
            extraction_options.max_num_features = 4096
        else:  # low
            extraction_options.max_image_size = 1600
            extraction_options.max_num_features = 2048
        
        try:
            # Extract features
            pycolmap.extract_features(
                database_path=self.database_path,
                image_path=self.image_dir,
                options=extraction_options
            )
            logger.info("Feature extraction completed successfully")
            return True
        except Exception as e:
            logger.error(f"Feature extraction failed: {str(e)}")
            return False
    
    def match_features(self) -> bool:
        """
        Match features between images.
        
        Returns:
            Success status
        """
        logger.info("Matching features between images...")
        
        # Configure matcher options based on selected matcher
        matcher_options = pycolmap.ExhaustiveMatcherOptions() if self.matcher == 'exhaustive' else pycolmap.SequentialMatcherOptions()
        
        try:
            # Match features
            if self.matcher == 'exhaustive':
                pycolmap.match_exhaustive(
                    database_path=self.database_path,
                    options=matcher_options
                )
            else:
                pycolmap.match_sequential(
                    database_path=self.database_path,
                    options=matcher_options
                )
            logger.info("Feature matching completed successfully")
            return True
        except Exception as e:
            logger.error(f"Feature matching failed: {str(e)}")
            return False
    
    def run_triangulation(self) -> bool:
        """
        Run triangulation to create a sparse 3D reconstruction.
        
        Returns:
            Success status
        """
        logger.info("Running triangulation...")
        
        try:
            # Configure mapper options
            mapper_options = pycolmap.IncrementalMapperOptions()
            mapper_options.min_model_size = 3  # Minimum number of images in the model
            
            # Run triangulation
            reconstruction = pycolmap.incremental_mapping(
                database_path=self.database_path,
                image_path=self.image_dir,
                output_path=self.sparse_dir,
                options=mapper_options
            )
            
            if reconstruction:
                logger.info(f"Triangulation completed successfully with {len(reconstruction)} images")
                return True
            else:
                logger.error("Triangulation failed to produce a reconstruction")
                return False
        except Exception as e:
            logger.error(f"Triangulation failed: {str(e)}")
            return False
    
    def run_sfm_pipeline(self, image_paths: List[str]) -> Dict[str, Any]:
        """
        Run the complete SfM pipeline from image input to camera pose estimation.
        
        Args:
            image_paths: List of paths to input images
            
        Returns:
            Dictionary with camera poses and reconstruction details
        """
        logger.info(f"Starting SfM pipeline with {len(image_paths)} images")
        
        try:
            # Prepare images
            self.prepare_images(image_paths)
            
            # Extract features
            if not self.extract_features():
                return {"success": False, "error": "Feature extraction failed"}
            
            # Match features
            if not self.match_features():
                return {"success": False, "error": "Feature matching failed"}
            
            # Run triangulation
            if not self.run_triangulation():
                return {"success": False, "error": "Triangulation failed"}
            
            # Get reconstruction results
            result = self.get_camera_poses()
            result["success"] = True
            logger.info("SfM pipeline completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"SfM pipeline failed: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def get_camera_poses(self) -> Dict[str, Any]:
        """
        Extract camera poses from the reconstruction.
        
        Returns:
            Dictionary with camera poses and intrinsics
        """
        logger.info("Extracting camera poses from reconstruction")
        
        try:
            # Load reconstruction
            reconstruction_path = os.path.join(self.sparse_dir, '0')
            reconstruction = pycolmap.Reconstruction(reconstruction_path)
            
            # Extract camera poses and intrinsics
            cameras = {}
            for camera_id, camera in reconstruction.cameras.items():
                cameras[camera_id] = {
                    "model": camera.model_name,
                    "width": camera.width,
                    "height": camera.height,
                    "params": camera.params.tolist()
                }
            
            # Extract poses (rotation matrices and translation vectors)
            poses = {}
            for image_id, image in reconstruction.images.items():
                rotation = image.rotation_matrix().tolist()
                translation = image.tvec.tolist()
                name = image.name
                
                poses[image_id] = {
                    "name": name,
                    "rotation": rotation,
                    "translation": translation,
                    "camera_id": image.camera_id
                }
            
            # Extract 3D points (sparse point cloud)
            points = {}
            for point3D_id, point3D in reconstruction.points3D.items():
                points[point3D_id] = {
                    "xyz": point3D.xyz.tolist(),
                    "rgb": point3D.rgb.tolist(),
                    "error": point3D.error
                }
            
            result = {
                "cameras": cameras,
                "poses": poses,
                "points": points,
                "num_cameras": len(cameras),
                "num_poses": len(poses),
                "num_points": len(points)
            }
            
            logger.info(f"Extracted {len(poses)} camera poses and {len(points)} 3D points")
            return result
            
        except Exception as e:
            logger.error(f"Failed to extract camera poses: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def visualize_reconstruction(self, output_path: str) -> str:
        """
        Visualize the reconstruction with camera poses and points.
        
        Args:
            output_path: Path to save the visualization
            
        Returns:
            Path to the saved visualization
        """
        logger.info("Visualizing reconstruction")
        
        try:
            # Load reconstruction
            reconstruction_path = os.path.join(self.sparse_dir, '0')
            reconstruction = pycolmap.Reconstruction(reconstruction_path)
            
            # Create figure
            fig = plt.figure(figsize=(10, 8))
            ax = fig.add_subplot(111, projection='3d')
            
            # Plot points
            points = np.array([point.xyz for point in reconstruction.points3D.values()])
            colors = np.array([point.rgb/255.0 for point in reconstruction.points3D.values()])
            
            ax.scatter(points[:, 0], points[:, 1], points[:, 2], c=colors, s=1)
            
            # Plot camera positions
            camera_positions = np.array([image.tvec for image in reconstruction.images.values()])
            ax.scatter(camera_positions[:, 0], camera_positions[:, 1], camera_positions[:, 2], 
                      c='red', marker='o', s=50, label='Cameras')
            
            # Set labels and title
            ax.set_xlabel('X')
            ax.set_ylabel('Y')
            ax.set_zlabel('Z')
            ax.set_title('COLMAP Reconstruction')
            ax.legend()
            
            # Save visualization
            plt.savefig(output_path)
            logger.info(f"Saved reconstruction visualization to {output_path}")
            
            return output_path
            
        except Exception as e:
            logger.error(f"Failed to visualize reconstruction: {str(e)}")
            return ""
    
    def convert_to_nerf_format(self) -> Dict[str, Any]:
        """
        Convert COLMAP output to NeRF-compatible format.
        
        Returns:
            Dictionary with camera parameters in NeRF format
        """
        logger.info("Converting COLMAP output to NeRF format")
        
        try:
            # Load reconstruction
            reconstruction_path = os.path.join(self.sparse_dir, '0')
            reconstruction = pycolmap.Reconstruction(reconstruction_path)
            
            # Extract camera parameters
            cameras = {}
            for camera_id, camera in reconstruction.cameras.items():
                # Convert to NeRF format (focal length, principal point)
                if camera.model_name in ['SIMPLE_PINHOLE', 'PINHOLE']:
                    # For pinhole models, extract focal length and principal point
                    if camera.model_name == 'SIMPLE_PINHOLE':  # fx, cx, cy
                        fx = camera.params[0]
                        fy = fx
                        cx = camera.params[1]
                        cy = camera.params[2]
                    else:  # PINHOLE: fx, fy, cx, cy
                        fx = camera.params[0]
                        fy = camera.params[1]
                        cx = camera.params[2]
                        cy = camera.params[3]
                    
                    cameras[camera_id] = {
                        "width": camera.width,
                        "height": camera.height,
                        "fx": fx,
                        "fy": fy,
                        "cx": cx,
                        "cy": cy
                    }
                else:
                    # For other models, store raw parameters and model name for custom handling
                    cameras[camera_id] = {
                        "width": camera.width,
                        "height": camera.height,
                        "model": camera.model_name,
                        "params": camera.params.tolist()
                    }
            
            # Extract transforms (camera-to-world transformations)
            transforms = []
            for image_id, image in reconstruction.images.items():
                # Get camera parameters
                camera = cameras[image.camera_id]
                
                # Get rotation matrix (COLMAP uses camera-to-world)
                rotation = image.rotation_matrix()
                
                # Get translation vector
                translation = image.tvec
                
                # Create 4x4 transformation matrix
                transform = np.eye(4)
                transform[:3, :3] = rotation
                transform[:3, 3] = translation
                
                # Add frame data
                frame = {
                    "file_path": image.name,
                    "transform_matrix": transform.tolist(),
                    "camera_id": image.camera_id
                }
                
                # Add camera parameters to frame
                for key, value in camera.items():
                    frame[key] = value
                
                transforms.append(frame)
            
            # Create NeRF-compatible format
            nerf_data = {
                "camera_angle_x": 0.0,  # Will be updated per frame
                "frames": transforms
            }
            
            # Calculate camera_angle_x from first camera (horizontal field of view)
            if len(transforms) > 0:
                first_camera = transforms[0]
                if "fx" in first_camera and "width" in first_camera:
                    # Calculate horizontal field of view
                    camera_angle_x = 2 * np.arctan(first_camera["width"] / (2 * first_camera["fx"]))
                    nerf_data["camera_angle_x"] = float(camera_angle_x)
            
            logger.info(f"Converted {len(transforms)} camera poses to NeRF format")
            return {"success": True, "nerf_data": nerf_data}
            
        except Exception as e:
            logger.error(f"Failed to convert to NeRF format: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def cleanup(self):
        """Clean up temporary files and directories."""
        logger.info(f"Cleaning up temporary files in {self.work_dir}")
        try:
            if self.work_dir and os.path.exists(self.work_dir) and tempfile.gettempdir() in self.work_dir:
                shutil.rmtree(self.work_dir)
                logger.info("Cleanup completed successfully")
        except Exception as e:
            logger.error(f"Cleanup failed: {str(e)}")


# Server endpoints handler
def handle_request(request):
    """
    Handle requests for COLMAP processing.
    
    Args:
        request: Dictionary with request parameters
        
    Returns:
        Dictionary with processing results
    """
    request_type = request.get("type", "")
    
    if request_type == "health_check":
        return {"status": "healthy", "service": "colmap_sfm"}
    
    elif request_type == "sfm_pipeline":
        image_paths = request.get("image_paths", [])
        work_dir = request.get("work_dir", None)
        feature_extractor = request.get("feature_extractor", "sift")
        matcher = request.get("matcher", "exhaustive")
        quality = request.get("quality", "high")
        
        # Create service instance
        service = COLMAPService(
            work_dir=work_dir,
            feature_extractor=feature_extractor,
            matcher=matcher,
            quality=quality
        )
        
        try:
            # Run pipeline
            result = service.run_sfm_pipeline(image_paths)
            
            # Clean up if requested
            if request.get("cleanup", True):
                service.cleanup()
                
            return result
        except Exception as e:
            logger.error(f"SfM pipeline request failed: {str(e)}")
            return {"success": False, "error": str(e)}
    
    elif request_type == "camera_poses":
        work_dir = request.get("work_dir", None)
        
        # Create service instance
        service = COLMAPService(work_dir=work_dir)
        
        try:
            # Get camera poses
            result = service.get_camera_poses()
            return result
        except Exception as e:
            logger.error(f"Camera poses request failed: {str(e)}")
            return {"success": False, "error": str(e)}
    
    elif request_type == "nerf_conversion":
        work_dir = request.get("work_dir", None)
        
        # Create service instance
        service = COLMAPService(work_dir=work_dir)
        
        try:
            # Convert to NeRF format
            result = service.convert_to_nerf_format()
            return result
        except Exception as e:
            logger.error(f"NeRF conversion request failed: {str(e)}")
            return {"success": False, "error": str(e)}
    
    elif request_type == "visualization":
        work_dir = request.get("work_dir", None)
        output_path = request.get("output_path", "reconstruction.png")
        
        # Create service instance
        service = COLMAPService(work_dir=work_dir)
        
        try:
            # Visualize reconstruction
            vis_path = service.visualize_reconstruction(output_path)
            return {"success": True, "visualization_path": vis_path}
        except Exception as e:
            logger.error(f"Visualization request failed: {str(e)}")
            return {"success": False, "error": str(e)}
    
    else:
        return {"success": False, "error": f"Unknown request type: {request_type}"}


# Command line interface
if __name__ == "__main__":
    # Process command line arguments as JSON request
    if len(sys.argv) > 1:
        try:
            request_json = sys.argv[1]
            request = json.loads(request_json)
            result = handle_request(request)
            print(json.dumps(result))
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}))
    else:
        print(json.dumps({"success": False, "error": "No request provided"}))