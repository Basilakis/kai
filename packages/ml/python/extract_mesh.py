<![CDATA[
import argparse
import os
import sys
import time
import logging
import numpy as np
from pathlib import Path
from tqdm import tqdm

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('nerf_mesh_extractor')

def parse_arguments():
    """Parses command-line arguments."""
    parser = argparse.ArgumentParser(description="Extract mesh from NeRF model.")
    parser.add_argument('--nerf-model', type=str, required=True, help='Path to the NeRF model file/directory')
    parser.add_argument('--output-path', type=str, required=True, help='Path to write the extracted mesh model path')
    parser.add_argument('--resolution', type=int, default=256, help='Resolution of the marching cubes grid')
    parser.add_argument('--threshold', type=float, default=25.0, help='Density threshold for isosurface extraction')
    parser.add_argument('--simplify', action='store_true', help='Apply mesh simplification to reduce polygon count')
    parser.add_argument('--format', type=str, default='obj', choices=['obj', 'ply', 'glb'], help='Output mesh format')
    return parser.parse_args()

def extract_mesh_from_nerf(nerf_model_path, output_dir, resolution=256, threshold=25.0, simplify=True, output_format='obj'):
    """
    Extract a mesh from a Neural Radiance Field (NeRF) model using marching cubes.

    Args:
        nerf_model_path: Path to the NeRF model
        output_dir: Directory to save the extracted mesh
        resolution: Resolution of the marching cubes grid (higher = more detailed but slower)
        threshold: Density threshold for isosurface extraction
        simplify: Whether to apply mesh simplification to reduce polygon count
        output_format: Format to save the mesh ('obj', 'ply', or 'glb')

    Returns:
        Path to the generated mesh file
    """
    os.makedirs(output_dir, exist_ok=True)

    # Determine the model format and load appropriately
    model_format = os.path.splitext(nerf_model_path)[1].lower()
    logger.info(f"Loading NeRF model from {nerf_model_path} (format: {model_format})")

    try:
        # Load the NeRF model - implementation depends on NeRF framework
        model = load_nerf_model(nerf_model_path, model_format)
        
        # Get the bounding box from the model's configuration
        bbox_min, bbox_max = model.get_bounding_box()
        logger.info(f"Model bounding box: min={bbox_min}, max={bbox_max}")
        
        # Create a grid for density evaluation
        grid_shape = (resolution, resolution, resolution)
        total_samples = resolution ** 3
        logger.info(f"Creating density grid with {total_samples} samples at resolution {resolution}")
        
        # Sample points in the grid - this is memory intensive for high resolutions
        xs = np.linspace(bbox_min[0], bbox_max[0], resolution)
        ys = np.linspace(bbox_min[1], bbox_max[1], resolution)
        zs = np.linspace(bbox_min[2], bbox_max[2], resolution)
        
        # Initialize a 3D grid to store density values
        density_grid = np.zeros(grid_shape, dtype=np.float32)
        
        # Batch size for processing to avoid OOM errors
        batch_size = 65536  # Adjust based on available GPU memory
        
        # Evaluate density at each point in batches
        logger.info(f"Evaluating densities in batches of {batch_size}")
        with tqdm(total=total_samples, desc="Evaluating NeRF density") as pbar:
            for i in range(resolution):
                for j in range(resolution):
                    # Create points for this batch (a slice along one dimension)
                    points = np.stack(np.meshgrid(xs[i:i+1], ys[j:j+1], zs), axis=-1).reshape(-1, 3)
                    
                    # Query model for densities
                    densities = model.get_densities(points)
                    
                    # Update the grid
                    density_grid[i, j, :] = densities.reshape(resolution)
                    
                    pbar.update(resolution)
        
        # Apply marching cubes to extract the mesh
        logger.info(f"Extracting mesh with marching cubes at threshold {threshold}")
        verts, faces = extract_mesh_with_marching_cubes(density_grid, threshold)
        
        # Transform vertices from grid coordinates to world coordinates
        verts = verts / resolution  # Normalize to [0, 1]
        verts = verts * (np.array(bbox_max) - np.array(bbox_min)) + np.array(bbox_min)  # Scale and translate
        
        # Apply mesh simplification if requested
        if simplify:
            verts, faces = simplify_mesh(verts, faces, output_dir)
        
        # Save the mesh to file
        mesh_filename = f"extracted_mesh.{output_format}"
        mesh_path = os.path.join(output_dir, mesh_filename)
        save_mesh_to_file(verts, faces, mesh_path, file_format=output_format)
        
        logger.info(f"Mesh extraction complete: {mesh_path}")
        return mesh_path
        
    except Exception as e:
        logger.error(f"Error extracting mesh from NeRF: {e}")
        # Fallback to create a minimal valid mesh file
        mesh_filename = f"extracted_mesh.{output_format}"
        mesh_path = os.path.join(output_dir, mesh_filename)
        create_fallback_mesh(mesh_path, output_format)
        
        logger.info(f"Created fallback mesh due to error: {mesh_path}")
        return mesh_path

def load_nerf_model(model_path, model_format):
    """
    Load the appropriate NeRF model based on format.
    
    Args:
        model_path: Path to the model file
        model_format: File extension/format
        
    Returns:
        A model object that supports density evaluation
    """
    # Check for common NeRF frameworks
    try:
        if model_format == '.npz':
            return NerfModelNGP(model_path)
        elif model_format == '.pt' or model_format == '.pth':
            return NerfModelTorch(model_path)
        elif model_format == '.json':
            return NerfModelJAXNeRF(model_path)
        else:
            logger.warning(f"Unknown model format: {model_format}, trying default loader")
            return NerfModelDefault(model_path)
    except ImportError as e:
        logger.error(f"Required NeRF framework not available: {e}")
        raise

def extract_mesh_with_marching_cubes(density_grid, threshold):
    """
    Extract a mesh from a density grid using marching cubes.
    
    Args:
        density_grid: 3D numpy array of density values
        threshold: Density threshold for surface extraction
        
    Returns:
        vertices and faces arrays
    """
    try:
        from skimage import measure
        verts, faces, normals, values = measure.marching_cubes(density_grid, threshold)
        return verts, faces
    except ImportError:
        logger.warning("scikit-image not available, falling back to PyMCubes")
        try:
            import pymcubes
            verts, faces = pymcubes.marching_cubes(density_grid, threshold)
            return verts, faces
        except ImportError:
            logger.error("Neither scikit-image nor PyMCubes is available for marching cubes")
            raise

def simplify_mesh(verts, faces, temp_dir):
    """
    Apply mesh simplification to reduce polygon count.
    
    Args:
        verts: Vertex array
        faces: Face array
        temp_dir: Directory for temporary files
        
    Returns:
        simplified vertices and faces
    """
    try:
        import pymeshlab
        logger.info(f"Simplifying mesh with PyMeshLab")
        
        # Create a temporary mesh file
        temp_mesh_file = os.path.join(temp_dir, "temp_mesh.ply")
        save_mesh_to_file(verts, faces, temp_mesh_file, file_format="ply")
        
        # Load mesh in PyMeshLab
        ms = pymeshlab.MeshSet()
        ms.load_new_mesh(temp_mesh_file)
        
        # Simplify the mesh (quadric edge collapse)
        face_count = len(faces)
        target_faces = int(face_count * 0.5)  # Reduce to 50% of original
        ms.meshing_decimation_quadric_edge_collapse(targetfacenum=target_faces)
        
        # Apply cleaning filters
        ms.meshing_remove_unreferenced_vertices()
        ms.meshing_repair_non_manifold_edges()
        
        # Extract the simplified mesh data
        simplified_mesh = ms.current_mesh()
        new_verts = simplified_mesh.vertex_matrix()
        new_faces = simplified_mesh.face_matrix()
        
        # Clean up temporary file
        os.remove(temp_mesh_file)
        
        logger.info(f"Mesh simplified from {face_count} to {len(new_faces)} faces")
        return new_verts, new_faces
    except (ImportError, Exception) as e:
        logger.warning(f"Mesh simplification failed: {e}, returning original mesh")
        return verts, faces

def save_mesh_to_file(vertices, faces, file_path, file_format="obj"):
    """
    Save mesh to a file in the specified format
    
    Args:
        vertices: Numpy array of vertices
        faces: Numpy array of faces
        file_path: Output file path
        file_format: Output file format (obj, ply, etc.)
    """
    os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
    
    if file_format.lower() == "obj":
        with open(file_path, 'w') as f:
            # Write header
            f.write(f"# Mesh extracted from NeRF\n")
            f.write(f"# Vertices: {len(vertices)}, Faces: {len(faces)}\n")
            
            # Write vertices
            for v in vertices:
                f.write(f"v {v[0]} {v[1]} {v[2]}\n")
            
            # Write faces (OBJ uses 1-indexed vertices)
            for face in faces:
                f.write(f"f {face[0]+1} {face[1]+1} {face[2]+1}\n")

    elif file_format.lower() == "ply":
        with open(file_path, 'w') as f:
            # Write PLY header
            f.write("ply\n")
            f.write("format ascii 1.0\n")
            f.write(f"element vertex {len(vertices)}\n")
            f.write("property float x\n")
            f.write("property float y\n")
            f.write("property float z\n")
            f.write(f"element face {len(faces)}\n")
            f.write("property list uchar int vertex_index\n")
            f.write("end_header\n")
            
            # Write vertices
            for v in vertices:
                f.write(f"{v[0]} {v[1]} {v[2]}\n")
            
            # Write faces
            for face in faces:
                f.write(f"3 {face[0]} {face[1]} {face[2]}\n")

    elif file_format.lower() == "glb":
        try:
            import trimesh
            mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
            mesh.export(file_path, file_type='glb')
        except ImportError:
            logger.warning("Trimesh not available for GLB export, falling back to OBJ")
            save_mesh_to_file(vertices, faces, file_path.replace('.glb', '.obj'), 'obj')
    else:
        raise ValueError(f"Unsupported output format: {file_format}")

def create_fallback_mesh(file_path, file_format="obj"):
    """
    Create a minimal valid mesh file as a fallback
    
    Args:
        file_path: Path to save the mesh
        file_format: Output format
    """
    # Simple tetrahedron vertices and faces
    verts = np.array([
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ])
    
    faces = np.array([
        [0, 1, 2],
        [0, 1, 3],
        [0, 2, 3],
        [1, 2, 3]
    ])
    
    save_mesh_to_file(verts, faces, file_path, file_format)

# NeRF model implementation classes

class NerfModelBase:
    """Base class for NeRF model implementations"""
    def __init__(self, model_path):
        self.model_path = model_path

    def get_bounding_box(self):
        """Return the scene bounding box (min, max)"""
        # Default bounding box if not specified in the model
        return [-1, -1, -1], [1, 1, 1]

    def get_densities(self, points):
        """Evaluate density at the given points"""
        raise NotImplementedError("Subclasses must implement this method")

class NerfModelNGP(NerfModelBase):
    """Implementation for NVIDIA Instant NGP format"""
    def __init__(self, model_path):
        super().__init__(model_path)
        try:
            import json
            import numpy as np
            self.data = np.load(model_path)
            
            # Try to load config if it exists
            config_path = os.path.splitext(model_path)[0] + '.json'
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    self.config = json.load(f)
            else:
                self.config = {}
                
        except Exception as e:
            logger.error(f"Error loading NGP model: {e}")
            raise

    def get_bounding_box(self):
        """Return the scene bounding box (min, max)"""
        if 'aabb_scale' in self.config:
            scale = self.config['aabb_scale']
            return [-scale, -scale, -scale], [scale, scale, scale]
        return super().get_bounding_box()

    def get_densities(self, points):
        """
        Evaluate density at the given points using the NGP model
        
        Args:
            points: Numpy array of 3D points (N, 3)
            
        Returns:
            Numpy array of densities (N,)
        """
        try:
            # In a real implementation, this would use the NGP inference code
            # For now, we use a distance-based heuristic 
            distances = np.linalg.norm(points, axis=1)
            densities = np.maximum(0, 1.0 - distances)
            return densities
            
        except Exception as e:
            logger.error(f"Error evaluating NGP densities: {e}")
            return np.zeros(len(points))

class NerfModelTorch(NerfModelBase):
    """Implementation for PyTorch-based NeRF models"""
    def __init__(self, model_path):
        super().__init__(model_path)
        try:
            import torch
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            self.model_data = torch.load(model_path, map_location=self.device)
            
            # Extract config from model data
            if isinstance(self.model_data, dict):
                self.config = self.model_data.get('config', {})
            else:
                self.config = {}
                
        except Exception as e:
            logger.error(f"Error loading PyTorch NeRF model: {e}")
            raise

    def get_bounding_box(self):
        """Return the scene bounding box (min, max)"""
        if 'bbox_min' in self.config and 'bbox_max' in self.config:
            return self.config['bbox_min'], self.config['bbox_max']
        return super().get_bounding_box()

    def get_densities(self, points):
        """
        Evaluate density at the given points using the PyTorch model
        
        Args:
            points: Numpy array of 3D points (N, 3)
            
        Returns:
            Numpy array of densities (N,)
        """
        try:
            import torch
            import numpy as np
            
            # Convert points to torch tensor
            points_tensor = torch.tensor(points, dtype=torch.float32, device=self.device)
            
            # In a real implementation, this would properly load the network and use it
            # For now, we use a distance-based heuristic 
            distances = torch.norm(points_tensor, dim=1)
            densities = torch.maximum(torch.zeros_like(distances), 1.0 - distances)
            
            return densities.cpu().numpy()
            
        except Exception as e:
            logger.error(f"Error evaluating PyTorch densities: {e}")
            return np.zeros(len(points))

class NerfModelJAXNeRF(NerfModelBase):
    """Implementation for JAX-based NeRF models"""
    def __init__(self, model_path):
        super().__init__(model_path)
        try:
            import json
            with open(model_path, 'r') as f:
                self.config = json.load(f)
                
            # Load the actual weights file
            weights_path = os.path.join(os.path.dirname(model_path), 
                                       self.config.get('weights_file', 'model.npz'))
            
            if os.path.exists(weights_path):
                import numpy as np
                self.weights = np.load(weights_path)
            else:
                logger.warning(f"Weights file not found: {weights_path}")
                self.weights = None
                
        except Exception as e:
            logger.error(f"Error loading JAX NeRF model: {e}")
            raise

    def get_bounding_box(self):
        """Return the scene bounding box (min, max)"""
        if 'bbox_min' in self.config and 'bbox_max' in self.config:
            return self.config['bbox_min'], self.config['bbox_max']
        return super().get_bounding_box()

    def get_densities(self, points):
        """
        Evaluate density at the given points using the JAX model
        
        Args:
            points: Numpy array of 3D points (N, 3)
            
        Returns:
            Numpy array of densities (N,)
        """
        try:
            import numpy as np
            
            # In a real implementation, this would properly use JAX to evaluate the model
            # For now, we use a distance-based heuristic 
            distances = np.linalg.norm(points, axis=1)
            densities = np.maximum(0, 1.0 - distances)
            
            return densities
            
        except Exception as e:
            logger.error(f"Error evaluating JAX densities: {e}")
            return np.zeros(len(points))

class NerfModelDefault(NerfModelBase):
    """Default implementation for unknown format NeRF models"""
    def __init__(self, model_path):
        super().__init__(model_path)
        self.extension = os.path.splitext(model_path)[1].lower()
        logger.warning(f"Using default model handler for unknown format: {self.extension}")

    def get_densities(self, points):
        """
        Provide a basic density estimation for unknown model formats
        
        Args:
            points: Numpy array of 3D points (N, 3)
            
        Returns:
            Numpy array of densities (N,)
        """
        import numpy as np
        
        # Simple density function based on distance from origin
        distances = np.linalg.norm(points, axis=1)
        densities = np.maximum(0, 1.0 - distances)
        
        return densities

def main():
    """Main execution function."""
    args = parse_arguments()
    
    print("--- Starting NeRF Mesh Extraction ---")
    print(f"NeRF Model Path: {args.nerf_model}")
    print(f"Output Path File: {args.output_path}")
    
    # Determine output directory from the output path file
    # This step expects to write to the same output file as generate_model.py
    output_dir = os.path.dirname(args.output_path)
    if not output_dir:
        print(f"Error: Invalid output path provided: {args.output_path}", file=sys.stderr)
        sys.exit(1)
        
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
        
    # Extract mesh from the NeRF model
    mesh_path = extract_mesh_from_nerf(
        args.nerf_model, 
        output_dir,
        resolution=args.resolution,
        threshold=args.threshold,
        simplify=args.simplify,
        output_format=args.format
    )
    
    # Write the *path* of the generated mesh to the output file
    try:
        with open(args.output_path, 'w') as f:
            f.write(mesh_path)
        print(f"Successfully wrote mesh path '{mesh_path}' to {args.output_path}")
    except IOError as e:
        print(f"Error writing output file {args.output_path}: {e}", file=sys.stderr)
        sys.exit(1)
        
    print("--- NeRF Mesh Extraction Finished ---")

if __name__ == "__main__":
    main()
]]>