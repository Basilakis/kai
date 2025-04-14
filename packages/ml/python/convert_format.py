<![CDATA[
import argparse
import os
import sys
import time
import uuid
import logging
import tempfile
import subprocess
from pathlib import Path
from typing import Optional, Dict, List, Tuple, Union

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('model_converter')

# Try to import S3 libraries - boto3 for AWS S3
try:
    import boto3
    from botocore.exceptions import ClientError
    S3_AVAILABLE = True
except ImportError:
    logger.warning("boto3 not available, S3 upload will be disabled unless s3fs is available")
    S3_AVAILABLE = False

# Try alternative S3 library - s3fs
if not S3_AVAILABLE:
    try:
        import s3fs
        S3_AVAILABLE = True
    except ImportError:
        logger.warning("Neither boto3 nor s3fs is available, S3 upload will be simulated")

# Try to import conversion libraries
try:
    import trimesh
    TRIMESH_AVAILABLE = True
except ImportError:
    logger.warning("trimesh not available, some conversions will be limited")
    TRIMESH_AVAILABLE = False

try:
    import pymeshlab
    MESHLAB_AVAILABLE = True
except ImportError:
    logger.warning("pymeshlab not available, some conversions will be limited")
    MESHLAB_AVAILABLE = False

def parse_arguments():
    """Parses command-line arguments."""
    parser = argparse.ArgumentParser(description="Convert 3D model format and upload.")
    parser.add_argument('--input-model', type=str, required=True, help='Path to the input model file')
    parser.add_argument('--output-format', type=str, required=True, help='Desired output format (e.g., gltf, obj, usdz)')
    parser.add_argument('--output-url-path', type=str, required=True, help='Path to write the final model URL')
    parser.add_argument('--s3-bucket', type=str, help='S3 bucket name (overrides environment variable)')
    parser.add_argument('--s3-prefix', type=str, default="models", help='S3 path prefix')
    parser.add_argument('--optimize', action='store_true', help='Apply optimization to the converted model')
    parser.add_argument('--conversion-quality', type=str, default='medium', 
                      choices=['low', 'medium', 'high'], help='Quality level for conversion')
    return parser.parse_args()

def convert_3d_model(input_path: str, output_format: str, output_dir: str, 
                    quality: str = 'medium', optimize: bool = False) -> str:
    """
    Convert a 3D model to the specified format.
    
    Args:
        input_path: Path to the input model file
        output_format: Desired output format
        output_dir: Directory to save the converted model
        quality: Quality level for conversion (low, medium, high)
        optimize: Whether to apply optimization to the model
        
    Returns:
        Path to the converted model file
    """
    input_format = os.path.splitext(input_path)[1].lower().lstrip('.')
    if not input_format:
        raise ValueError(f"Could not determine input format from file: {input_path}")
    
    logger.info(f"Converting model from {input_format} to {output_format} (quality: {quality}, optimize: {optimize})")
    
    # Create a unique filename for the output
    base_name = os.path.basename(input_path).split('.')[0]
    unique_id = str(uuid.uuid4())[:8]
    converted_filename = f"{base_name}_{unique_id}.{output_format}"
    output_path = os.path.join(output_dir, converted_filename)
    
    # Make sure the output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Normalize format names (some tools use different names for the same format)
    norm_input_format = normalize_format_name(input_format)
    norm_output_format = normalize_format_name(output_format)
    
    # Try conversion with available libraries
    converted = False
    
    # Try trimesh first if available (good for many common formats)
    if TRIMESH_AVAILABLE and not converted:
        converted = try_trimesh_conversion(input_path, output_path, norm_input_format, norm_output_format)
    
    # Try pymeshlab if available (good for more complex operations and many formats)
    if MESHLAB_AVAILABLE and not converted:
        converted = try_meshlab_conversion(input_path, output_path, norm_input_format, norm_output_format, quality)
    
    # Try Blender as a fallback for more complex conversions
    if not converted:
        converted = try_blender_conversion(input_path, output_path, norm_input_format, norm_output_format)
    
    # Try specialized USDZ conversion for Apple AR
    if norm_output_format == 'usdz' and not converted:
        converted = try_usdz_conversion(input_path, output_path, norm_input_format)
    
    # If we still haven't converted, try custom command-line tools
    if not converted:
        converted = try_command_line_conversion(input_path, output_path, norm_input_format, norm_output_format)
    
    # Apply optimization if requested and available
    if converted and optimize:
        optimized_path = apply_optimization(output_path, norm_output_format, quality)
        if optimized_path:
            output_path = optimized_path
    
    # If all conversion methods failed, raise an error
    if not converted:
        raise RuntimeError(f"Failed to convert {input_path} from {input_format} to {output_format}")
    
    logger.info(f"Successfully converted model to {output_path}")
    return output_path

def normalize_format_name(format_name: str) -> str:
    """
    Normalize format names to account for variations
    """
    format_name = format_name.lower()
    
    # GLTF/GLB variants
    if format_name in ('gltf', 'glb', 'gltf2'):
        return 'gltf'
    
    # USD/USDA/USDC/USDZ variants
    if format_name in ('usd', 'usda', 'usdc', 'usdz'):
        return 'usd'
    
    # OBJ/MTL/Wavefront variants
    if format_name in ('obj', 'wavefront'):
        return 'obj'
    
    # FBX variants
    if format_name in ('fbx', 'autodesk'):
        return 'fbx'
    
    # STL variants (ascii/binary)
    if format_name in ('stl', 'stereolithography'):
        return 'stl'
    
    # PLY variants (ascii/binary)
    if format_name in ('ply', 'stanford'):
        return 'ply'
    
    return format_name

def try_trimesh_conversion(input_path: str, output_path: str, 
                          input_format: str, output_format: str) -> bool:
    """
    Try to convert the model using trimesh
    
    Returns:
        True if conversion was successful, False otherwise
    """
    try:
        # Check if this conversion is supported by trimesh
        supported_formats = ['obj', 'stl', 'ply', 'gltf', 'glb', 'off', '3mf', 'xaml', 'dae']
        if input_format not in supported_formats or output_format not in supported_formats:
            logger.info(f"Trimesh doesn't support {input_format} to {output_format} conversion")
            return False
        
        # Load the model with trimesh
        mesh = trimesh.load(input_path)
        
        # Handle special case for glTF/GLB
        if output_format == 'gltf':
            # Check if we want .gltf or .glb
            if output_path.endswith('.glb'):
                mesh.export(output_path, file_type='glb')
            else:
                mesh.export(output_path, file_type='gltf')
        else:
            mesh.export(output_path, file_type=output_format)
        
        return os.path.exists(output_path)
    
    except Exception as e:
        logger.warning(f"Trimesh conversion failed: {e}")
        return False

def try_meshlab_conversion(input_path: str, output_path: str, 
                          input_format: str, output_format: str, quality: str) -> bool:
    """
    Try to convert the model using pymeshlab
    
    Returns:
        True if conversion was successful, False otherwise
    """
    try:
        # Create a MeshSet
        ms = pymeshlab.MeshSet()
        
        # Load the mesh
        ms.load_new_mesh(input_path)
        
        # Apply some processing based on quality
        if quality == 'high':
            # High quality: More detailed processing
            ms.meshing_repair_non_manifold_edges()
            ms.meshing_close_holes()
            ms.meshing_isotropic_explicit_remeshing()
        elif quality == 'medium':
            # Medium quality: Basic cleanup
            ms.meshing_repair_non_manifold_edges()
            ms.meshing_remove_unreferenced_vertices()
        
        # Save the processed mesh
        ms.save_current_mesh(output_path)
        
        return os.path.exists(output_path)
    
    except Exception as e:
        logger.warning(f"PyMeshLab conversion failed: {e}")
        return False

def try_blender_conversion(input_path: str, output_path: str, 
                          input_format: str, output_format: str) -> bool:
    """
    Try to convert the model using Blender's Python API via subprocess
    
    Returns:
        True if conversion was successful, False otherwise
    """
    try:
        # Check if Blender is available
        try:
            result = subprocess.run(['blender', '--version'], 
                                  stdout=subprocess.PIPE, 
                                  stderr=subprocess.PIPE,
                                  text=True)
            if result.returncode != 0:
                logger.warning("Blender not found in PATH")
                return False
        except Exception:
            logger.warning("Blender not available")
            return False
        
        # Create a temporary Python script for Blender
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as script_file:
            script_path = script_file.name
            script_file.write(f"""
import bpy
import os
import sys

# Clear default scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import the model
if "{input_format}" == "obj":
    bpy.ops.import_scene.obj(filepath="{input_path}")
elif "{input_format}" == "fbx":
    bpy.ops.import_scene.fbx(filepath="{input_path}")
elif "{input_format}" == "gltf" or "{input_format}" == "glb":
    bpy.ops.import_scene.gltf(filepath="{input_path}")
elif "{input_format}" == "stl":
    bpy.ops.import_mesh.stl(filepath="{input_path}")
elif "{input_format}" == "ply":
    bpy.ops.import_mesh.ply(filepath="{input_path}")
elif "{input_format}" == "dae":
    bpy.ops.wm.collada_import(filepath="{input_path}")
else:
    print(f"Unsupported input format: {input_format}")
    sys.exit(1)

# Export the model
if "{output_format}" == "obj":
    bpy.ops.export_scene.obj(filepath="{output_path}")
elif "{output_format}" == "fbx":
    bpy.ops.export_scene.fbx(filepath="{output_path}")
elif "{output_format}" == "gltf" or "{output_format}" == "glb":
    bpy.ops.export_scene.gltf(filepath="{output_path}")
elif "{output_format}" == "stl":
    bpy.ops.export_mesh.stl(filepath="{output_path}")
elif "{output_format}" == "ply":
    bpy.ops.export_mesh.ply(filepath="{output_path}")
elif "{output_format}" == "dae":
    bpy.ops.wm.collada_export(filepath="{output_path}")
elif "{output_format}" == "usd" or "{output_format}" == "usdc" or "{output_format}" == "usdz":
    bpy.ops.wm.usd_export(filepath="{output_path}")
else:
    print(f"Unsupported output format: {output_format}")
    sys.exit(1)

print(f"Conversion completed: {input_path} -> {output_path}")
""")
        
        # Run Blender with the script
        result = subprocess.run(
            ['blender', '--background', '--python', script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Clean up the temporary script
        os.unlink(script_path)
        
        # Check if the conversion was successful
        if result.returncode != 0:
            logger.warning(f"Blender conversion failed: {result.stderr}")
            return False
        
        return os.path.exists(output_path)
    
    except Exception as e:
        logger.warning(f"Blender conversion failed: {e}")
        return False

def try_usdz_conversion(input_path: str, output_path: str, input_format: str) -> bool:
    """
    Try to convert the model to USDZ format using Apple's usdz_converter tool
    
    Returns:
        True if conversion was successful, False otherwise
    """
    try:
        # Check if usdz_converter is available
        try:
            result = subprocess.run(['usdz_converter', '--help'], 
                                  stdout=subprocess.PIPE, 
                                  stderr=subprocess.PIPE,
                                  text=True)
            if result.returncode != 0:
                logger.warning("usdz_converter not found in PATH")
                return False
        except Exception:
            logger.warning("usdz_converter not available")
            return False
        
        # Run the conversion
        result = subprocess.run(
            ['usdz_converter', input_path, output_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Check if the conversion was successful
        if result.returncode != 0:
            logger.warning(f"USDZ conversion failed: {result.stderr}")
            return False
        
        return os.path.exists(output_path)
    
    except Exception as e:
        logger.warning(f"USDZ conversion failed: {e}")
        return False

def try_command_line_conversion(input_path: str, output_path: str, 
                               input_format: str, output_format: str) -> bool:
    """
    Try to convert the model using various command-line tools
    
    Returns:
        True if conversion was successful, False otherwise
    """
    # Try assimp if available
    try:
        result = subprocess.run(
            ['assimp', 'export', input_path, output_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        if result.returncode == 0 and os.path.exists(output_path):
            logger.info("Successfully converted using assimp")
            return True
    except Exception:
        logger.debug("assimp not available")
    
    # Try meshconv if available
    try:
        result = subprocess.run(
            ['meshconv', '-c', output_format, input_path, '-o', output_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        if result.returncode == 0 and os.path.exists(output_path):
            logger.info("Successfully converted using meshconv")
            return True
    except Exception:
        logger.debug("meshconv not available")
    
    return False

def apply_optimization(model_path: str, format_name: str, quality: str) -> Optional[str]:
    """
    Apply optimization to the model
    
    Args:
        model_path: Path to the model file
        format_name: Format of the model
        quality: Quality level for optimization
        
    Returns:
        Path to the optimized model, or None if optimization failed
    """
    optimized_path = model_path
    
    # Apply draco compression for glTF/GLB
    if format_name == 'gltf' and TRIMESH_AVAILABLE:
        try:
            # Load the model
            mesh = trimesh.load(model_path)
            
            # Create a path for the optimized model
            optimized_path = os.path.splitext(model_path)[0] + '_optimized' + os.path.splitext(model_path)[1]
            
            # Set compression options based on quality
            compression_level = 7 if quality == 'high' else 5 if quality == 'medium' else 3
            
            # Export with draco compression
            mesh.export(
                optimized_path,
                file_type='gltf' if optimized_path.endswith('.gltf') else 'glb',
                draco_compression_level=compression_level
            )
            
            logger.info(f"Applied Draco compression to model (level {compression_level})")
            return optimized_path
        except Exception as e:
            logger.warning(f"Failed to apply Draco compression: {e}")
    
    # For other formats, we need specialized tools
    if format_name == 'obj' and MESHLAB_AVAILABLE:
        try:
            # Create a MeshSet
            ms = pymeshlab.MeshSet()
            
            # Load the mesh
            ms.load_new_mesh(model_path)
            
            # Apply optimization
            if quality == 'low':
                ms.meshing_decimation_quadric_edge_collapse(targetfacenum=int(ms.current_mesh().face_number() * 0.3))
            elif quality == 'medium':
                ms.meshing_decimation_quadric_edge_collapse(targetfacenum=int(ms.current_mesh().face_number() * 0.5))
            
            # Create a path for the optimized model
            optimized_path = os.path.splitext(model_path)[0] + '_optimized' + os.path.splitext(model_path)[1]
            
            # Save the optimized mesh
            ms.save_current_mesh(optimized_path)
            
            logger.info(f"Applied mesh optimization (quality: {quality})")
            return optimized_path
        except Exception as e:
            logger.warning(f"Failed to apply mesh optimization: {e}")
    
    return None

def upload_to_s3(file_path: str, bucket_name: str, prefix: str = "models") -> Optional[str]:
    """
    Upload a file to S3
    
    Args:
        file_path: Path to the file to upload
        bucket_name: S3 bucket name
        prefix: S3 path prefix
        
    Returns:
        S3 URL of the uploaded file, or None if upload failed
    """
    if not S3_AVAILABLE:
        logger.warning("S3 upload not available. Using simulated S3 URL.")
        return f"s3://{bucket_name}/{prefix}/{os.path.basename(file_path)}"
    
    try:
        filename = os.path.basename(file_path)
        s3_key = f"{prefix}/{filename}"
        
        # Create S3 client
        s3_client = boto3.client('s3')
        
        # Upload the file
        logger.info(f"Uploading {file_path} to S3 bucket {bucket_name}, key {s3_key}")
        s3_client.upload_file(file_path, bucket_name, s3_key)
        
        # Generate the S3 URL
        s3_url = f"s3://{bucket_name}/{s3_key}"
        logger.info(f"Successfully uploaded to {s3_url}")
        
        return s3_url
    
    except ClientError as e:
        logger.error(f"S3 upload failed: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error during S3 upload: {e}")
        return None

def convert_and_upload(input_model_path: str, output_format: str, output_dir: str, 
                      bucket_name: str, prefix: str = "models", 
                      quality: str = 'medium', optimize: bool = False) -> Optional[str]:
    """
    Convert a 3D model to the specified format and upload it to S3
    
    Args:
        input_model_path: Path to the input model file
        output_format: Desired output format
        output_dir: Directory for temporary files
        bucket_name: S3 bucket name
        prefix: S3 path prefix
        quality: Quality level for conversion
        optimize: Whether to apply optimization
        
    Returns:
        S3 URL of the uploaded file, or None if the operation failed
    """
    try:
        # Convert the model
        converted_path = convert_3d_model(
            input_model_path, 
            output_format, 
            output_dir, 
            quality=quality, 
            optimize=optimize
        )
        
        # Upload to S3
        s3_url = upload_to_s3(converted_path, bucket_name, prefix)
        
        return s3_url
    
    except Exception as e:
        logger.error(f"Failed to convert and upload model: {e}")
        return None

def main():
    """Main execution function."""
    args = parse_arguments()
    
    print("--- Starting Format Conversion ---")
    print(f"Input Model Path: {args.input_model}")
    print(f"Output Format: {args.output_format}")
    print(f"Output URL Path File: {args.output_url_path}")
    
    # Determine output directory from the output path file for temporary files
    output_dir = os.path.dirname(args.output_url_path)
    if not output_dir:
        print(f"Error: Invalid output path provided: {args.output_url_path}", file=sys.stderr)
        sys.exit(1)
        
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
        
    # Get S3 bucket name from args or environment
    bucket_name = args.s3_bucket or os.environ.get("S3_BUCKET_NAME", "kai-output-bucket")
    
    # Convert the model and upload to S3
    output_url = convert_and_upload(
        args.input_model,
        args.output_format,
        output_dir,
        bucket_name,
        prefix=args.s3_prefix,
        quality=args.conversion_quality,
        optimize=args.optimize
    )
    
    if not output_url:
        print(f"Error: Failed to convert and upload model", file=sys.stderr)
        sys.exit(1)
    
    # Write the final URL to the output file
    try:
        with open(args.output_url_path, 'w') as f:
            f.write(output_url)
        print(f"Successfully wrote output URL '{output_url}' to {args.output_url_path}")
    except IOError as e:
        print(f"Error writing output file {args.output_url_path}: {e}", file=sys.stderr)
        sys.exit(1)
        
    print("--- Format Conversion Finished ---")

if __name__ == "__main__":
    main()
]]>