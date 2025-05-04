#!/usr/bin/env python
"""
Material Data Preparer

This script prepares training data for material-specific models by organizing
and filtering data based on material type and metadata fields.
"""

import os
import sys
import json
import time
import argparse
import logging
import shutil
from typing import Dict, Any, List, Optional, Tuple
import uuid

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('material-data-preparer')

# Try to import image processing libraries
try:
    from PIL import Image
    import numpy as np
    PILLOW_AVAILABLE = True
except ImportError:
    logger.warning("Pillow not available. Image processing will be limited.")
    PILLOW_AVAILABLE = False


class MaterialDataPreparer:
    """Prepares training data for material-specific models"""
    
    def __init__(self, input_dir: str, output_dir: str, material_type: str, config_path: Optional[str] = None):
        """
        Initialize the data preparer
        
        Args:
            input_dir: Directory containing raw data
            output_dir: Directory to save prepared data
            material_type: Material type to prepare data for
            config_path: Optional path to configuration file
        """
        self.input_dir = input_dir
        self.output_dir = output_dir
        self.material_type = material_type
        self.config_path = config_path
        self.config = self._load_config()
        
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
    
    def _load_config(self) -> Dict[str, Any]:
        """
        Load configuration from file
        
        Returns:
            Configuration dictionary
        """
        if self.config_path and os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r') as f:
                    config = json.load(f)
                    logger.info(f"Loaded configuration from {self.config_path}")
                    return config
            except Exception as e:
                logger.warning(f"Error loading config from {self.config_path}: {e}")
        
        # Return default config
        return {
            "materialType": self.material_type,
            "fields": []
        }
    
    def prepare_data(self) -> Dict[str, Any]:
        """
        Prepare training data
        
        Returns:
            Dictionary with preparation results
        """
        logger.info(f"Preparing data for material type: {self.material_type}")
        start_time = time.time()
        
        # Get all materials in input directory
        materials = self._get_materials()
        
        # Filter materials by type
        filtered_materials = self._filter_materials_by_type(materials)
        
        logger.info(f"Found {len(filtered_materials)} materials of type {self.material_type}")
        
        # Process each material
        processed_count = 0
        for material_id, material_info in filtered_materials.items():
            try:
                self._process_material(material_id, material_info)
                processed_count += 1
            except Exception as e:
                logger.error(f"Error processing material {material_id}: {e}")
        
        # Compute preparation time
        preparation_time = time.time() - start_time
        
        # Save metadata fields
        self._save_metadata_fields()
        
        return {
            "materialType": self.material_type,
            "datasetPath": self.output_dir,
            "numSamples": processed_count,
            "preparationTime": preparation_time,
            "fields": self.config.get("fields", [])
        }
    
    def _get_materials(self) -> Dict[str, Dict[str, Any]]:
        """
        Get all materials in input directory
        
        Returns:
            Dictionary mapping material IDs to material info
        """
        materials = {}
        
        # Check if input directory exists
        if not os.path.exists(self.input_dir):
            logger.error(f"Input directory {self.input_dir} does not exist")
            return materials
        
        # Get all subdirectories (each represents a material)
        material_dirs = [d for d in os.listdir(self.input_dir) 
                        if os.path.isdir(os.path.join(self.input_dir, d))]
        
        for material_id in material_dirs:
            material_dir = os.path.join(self.input_dir, material_id)
            
            # Check for metadata.json
            metadata_path = os.path.join(material_dir, 'metadata.json')
            metadata = {}
            
            if os.path.exists(metadata_path):
                try:
                    with open(metadata_path, 'r') as f:
                        metadata = json.load(f)
                except Exception as e:
                    logger.warning(f"Error reading metadata for {material_id}: {e}")
            
            # Get all image files
            image_files = [f for f in os.listdir(material_dir) 
                          if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
            
            materials[material_id] = {
                "metadata": metadata,
                "images": image_files,
                "dir": material_dir
            }
        
        logger.info(f"Found {len(materials)} materials in input directory")
        return materials
    
    def _filter_materials_by_type(self, materials: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """
        Filter materials by type
        
        Args:
            materials: Dictionary mapping material IDs to material info
            
        Returns:
            Filtered dictionary
        """
        filtered_materials = {}
        
        for material_id, material_info in materials.items():
            metadata = material_info.get("metadata", {})
            
            # Check if material type matches
            material_type = metadata.get("materialType")
            
            if material_type == self.material_type:
                filtered_materials[material_id] = material_info
            elif not material_type and self._infer_material_type(metadata) == self.material_type:
                # If material type is not specified, try to infer it
                filtered_materials[material_id] = material_info
        
        return filtered_materials
    
    def _infer_material_type(self, metadata: Dict[str, Any]) -> Optional[str]:
        """
        Infer material type from metadata
        
        Args:
            metadata: Material metadata
            
        Returns:
            Inferred material type or None
        """
        # Check for type-specific fields
        if "thickness" in metadata and "size" in metadata:
            return "tile"
        elif "woodType" in metadata:
            return "wood"
        elif "lightingType" in metadata:
            return "lighting"
        elif "furnitureType" in metadata:
            return "furniture"
        elif "decorationType" in metadata:
            return "decoration"
        
        return None
    
    def _process_material(self, material_id: str, material_info: Dict[str, Any]):
        """
        Process a material
        
        Args:
            material_id: Material ID
            material_info: Material info
        """
        # Create output directory for this material
        material_output_dir = os.path.join(self.output_dir, material_id)
        os.makedirs(material_output_dir, exist_ok=True)
        
        # Copy metadata
        metadata = material_info.get("metadata", {})
        
        # Ensure material type is set
        metadata["materialType"] = self.material_type
        
        # Filter metadata to only include fields defined in config
        if "fields" in self.config:
            filtered_metadata = {"materialType": self.material_type}
            for field in self.config["fields"]:
                if field in metadata:
                    filtered_metadata[field] = metadata[field]
            metadata = filtered_metadata
        
        # Save metadata
        with open(os.path.join(material_output_dir, 'metadata.json'), 'w') as f:
            json.dump(metadata, f, indent=2)
        
        # Process images
        for image_file in material_info.get("images", []):
            src_path = os.path.join(material_info["dir"], image_file)
            dst_path = os.path.join(material_output_dir, image_file)
            
            # Copy image
            shutil.copy2(src_path, dst_path)
            
            # Process image if Pillow is available
            if PILLOW_AVAILABLE:
                self._process_image(dst_path)
    
    def _process_image(self, image_path: str):
        """
        Process an image
        
        Args:
            image_path: Path to image file
        """
        try:
            # Open image
            img = Image.open(image_path)
            
            # Resize if too large
            max_size = 1024
            if img.width > max_size or img.height > max_size:
                # Calculate new size while preserving aspect ratio
                if img.width > img.height:
                    new_width = max_size
                    new_height = int(img.height * max_size / img.width)
                else:
                    new_height = max_size
                    new_width = int(img.width * max_size / img.height)
                
                # Resize image
                img = img.resize((new_width, new_height), Image.LANCZOS)
                
                # Save resized image
                img.save(image_path)
        except Exception as e:
            logger.warning(f"Error processing image {image_path}: {e}")
    
    def _save_metadata_fields(self):
        """Save metadata fields to output directory"""
        if "fields" in self.config:
            fields_path = os.path.join(self.output_dir, 'metadata_fields.json')
            with open(fields_path, 'w') as f:
                json.dump(self.config["fields"], f, indent=2)


def main():
    """Main function to parse arguments and run the data preparation"""
    parser = argparse.ArgumentParser(description="Prepare training data for material-specific models")
    parser.add_argument("input_dir", help="Directory containing raw data")
    parser.add_argument("output_dir", help="Directory to save prepared data")
    parser.add_argument("--material-type", required=True, help="Material type to prepare data for")
    parser.add_argument("--config-path", help="Path to configuration file")
    
    args = parser.parse_args()
    
    try:
        # Create data preparer
        preparer = MaterialDataPreparer(
            args.input_dir,
            args.output_dir,
            args.material_type,
            args.config_path
        )
        
        # Prepare data
        result = preparer.prepare_data()
        
        # Print result as JSON
        print(json.dumps(result))
        
    except Exception as e:
        logger.error(f"Error in data preparation: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
