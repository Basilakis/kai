#!/usr/bin/env python
"""
Property Dataset Preparer

This script prepares datasets for property-specific training by organizing
and filtering data based on property values.
"""

import os
import sys
import json
import time
import argparse
import logging
import shutil
from typing import Dict, Any, List, Optional, Tuple, Union
import uuid

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('property-dataset-preparer')

# Try to import image processing libraries
try:
    from PIL import Image
    import numpy as np
    PILLOW_AVAILABLE = True
except ImportError:
    logger.warning("Pillow not available. Image processing will be limited.")
    PILLOW_AVAILABLE = False


class PropertyDatasetPreparer:
    """Prepares datasets for property-specific training"""
    
    def __init__(self, input_dir: str, output_dir: str, property_name: str, 
                 material_type: str, metadata_path: Optional[str] = None):
        """
        Initialize the dataset preparer
        
        Args:
            input_dir: Directory containing raw data
            output_dir: Directory to save prepared data
            property_name: Property name
            material_type: Material type
            metadata_path: Optional path to property metadata file
        """
        self.input_dir = input_dir
        self.output_dir = output_dir
        self.property_name = property_name
        self.material_type = material_type
        self.metadata_path = metadata_path
        self.metadata = self._load_metadata()
        
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
    
    def _load_metadata(self) -> Dict[str, Any]:
        """
        Load property metadata from file
        
        Returns:
            Property metadata dictionary
        """
        if self.metadata_path and os.path.exists(self.metadata_path):
            try:
                with open(self.metadata_path, 'r') as f:
                    metadata = json.load(f)
                    logger.info(f"Loaded property metadata from {self.metadata_path}")
                    return metadata
            except Exception as e:
                logger.warning(f"Error loading metadata from {self.metadata_path}: {e}")
        
        # Return default metadata
        return {
            "name": self.property_name,
            "materialType": self.material_type,
            "fieldType": "text"
        }
    
    def prepare_dataset(self) -> Dict[str, Any]:
        """
        Prepare the dataset
        
        Returns:
            Dictionary with preparation results
        """
        logger.info(f"Preparing dataset for property {self.property_name} of material type {self.material_type}")
        start_time = time.time()
        
        # Get all items in input directory
        items = self._get_items()
        
        # Filter items by material type
        filtered_items = self._filter_items_by_material_type(items)
        
        logger.info(f"Found {len(filtered_items)} items of material type {self.material_type}")
        
        # Organize items by property value
        organized_items = self._organize_items_by_property_value(filtered_items)
        
        # Process each property value
        processed_count = 0
        class_distribution = {}
        
        for value, items_info in organized_items.items():
            try:
                item_count = self._process_property_value(value, items_info)
                processed_count += item_count
                class_distribution[value] = item_count
            except Exception as e:
                logger.error(f"Error processing property value {value}: {e}")
        
        # Compute preparation time
        preparation_time = time.time() - start_time
        
        # Determine value range for numeric properties
        value_range = None
        if self.metadata.get('fieldType') == 'number':
            numeric_values = [float(v) for v in organized_items.keys() if self._is_numeric(v)]
            if numeric_values:
                value_range = {
                    'min': min(numeric_values),
                    'max': max(numeric_values)
                }
        
        return {
            "propertyName": self.property_name,
            "materialType": self.material_type,
            "datasetPath": self.output_dir,
            "numSamples": processed_count,
            "preparationTime": preparation_time,
            "classDistribution": class_distribution,
            "valueRange": value_range
        }
    
    def _get_items(self) -> Dict[str, Dict[str, Any]]:
        """
        Get all items in input directory
        
        Returns:
            Dictionary mapping item IDs to item info
        """
        items = {}
        
        # Check if input directory exists
        if not os.path.exists(self.input_dir):
            logger.error(f"Input directory {self.input_dir} does not exist")
            return items
        
        # Get all subdirectories (each represents an item)
        item_dirs = [d for d in os.listdir(self.input_dir) 
                    if os.path.isdir(os.path.join(self.input_dir, d))]
        
        for item_id in item_dirs:
            item_dir = os.path.join(self.input_dir, item_id)
            
            # Check for metadata.json
            metadata_path = os.path.join(item_dir, 'metadata.json')
            metadata = {}
            
            if os.path.exists(metadata_path):
                try:
                    with open(metadata_path, 'r') as f:
                        metadata = json.load(f)
                except Exception as e:
                    logger.warning(f"Error reading metadata for {item_id}: {e}")
            
            # Get all image files
            image_files = [f for f in os.listdir(item_dir) 
                          if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
            
            items[item_id] = {
                "metadata": metadata,
                "images": image_files,
                "dir": item_dir
            }
        
        logger.info(f"Found {len(items)} items in input directory")
        return items
    
    def _filter_items_by_material_type(self, items: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """
        Filter items by material type
        
        Args:
            items: Dictionary mapping item IDs to item info
            
        Returns:
            Filtered dictionary
        """
        filtered_items = {}
        
        for item_id, item_info in items.items():
            metadata = item_info.get("metadata", {})
            
            # Check if material type matches
            material_type = metadata.get("materialType")
            
            if material_type == self.material_type:
                filtered_items[item_id] = item_info
            elif not material_type and self._infer_material_type(metadata) == self.material_type:
                # If material type is not specified, try to infer it
                filtered_items[item_id] = item_info
        
        return filtered_items
    
    def _infer_material_type(self, metadata: Dict[str, Any]) -> Optional[str]:
        """
        Infer material type from metadata
        
        Args:
            metadata: Item metadata
            
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
    
    def _organize_items_by_property_value(self, items: Dict[str, Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """
        Organize items by property value
        
        Args:
            items: Dictionary mapping item IDs to item info
            
        Returns:
            Dictionary mapping property values to lists of item info
        """
        organized_items = {}
        
        for item_id, item_info in items.items():
            metadata = item_info.get("metadata", {})
            
            # Check if property exists in metadata
            if self.property_name in metadata:
                value = metadata[self.property_name]
                
                # Convert value to string for consistency
                value_str = str(value)
                
                # Initialize list for this value if it doesn't exist
                if value_str not in organized_items:
                    organized_items[value_str] = []
                
                # Add item to list
                organized_items[value_str].append(item_info)
        
        logger.info(f"Organized items into {len(organized_items)} property values")
        return organized_items
    
    def _process_property_value(self, value: str, items_info: List[Dict[str, Any]]) -> int:
        """
        Process items for a specific property value
        
        Args:
            value: Property value
            items_info: List of item info dictionaries
            
        Returns:
            Number of processed items
        """
        # Create output directory for this value
        value_dir = os.path.join(self.output_dir, self._sanitize_value(value))
        os.makedirs(value_dir, exist_ok=True)
        
        # Process each item
        processed_count = 0
        
        for item_info in items_info:
            item_dir = item_info["dir"]
            images = item_info["images"]
            
            # Process each image
            for image_file in images:
                src_path = os.path.join(item_dir, image_file)
                dst_path = os.path.join(value_dir, f"{uuid.uuid4()}{os.path.splitext(image_file)[1]}")
                
                # Copy and process image
                try:
                    if PILLOW_AVAILABLE:
                        # Open, process, and save image
                        img = Image.open(src_path)
                        img = self._process_image(img)
                        img.save(dst_path)
                    else:
                        # Just copy the image
                        shutil.copy2(src_path, dst_path)
                    
                    processed_count += 1
                except Exception as e:
                    logger.warning(f"Error processing image {src_path}: {e}")
        
        logger.info(f"Processed {processed_count} images for value '{value}'")
        return processed_count
    
    def _process_image(self, img: 'Image.Image') -> 'Image.Image':
        """
        Process an image for training
        
        Args:
            img: PIL Image
            
        Returns:
            Processed PIL Image
        """
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
        
        return img
    
    def _sanitize_value(self, value: str) -> str:
        """
        Sanitize property value for use as directory name
        
        Args:
            value: Property value
            
        Returns:
            Sanitized value
        """
        # Replace invalid characters
        sanitized = value.replace('/', '_').replace('\\', '_').replace(':', '_')
        sanitized = sanitized.replace('*', '_').replace('?', '_').replace('"', '_')
        sanitized = sanitized.replace('<', '_').replace('>', '_').replace('|', '_')
        
        # Limit length
        if len(sanitized) > 50:
            sanitized = sanitized[:50]
        
        return sanitized
    
    def _is_numeric(self, value: str) -> bool:
        """
        Check if a value is numeric
        
        Args:
            value: Value to check
            
        Returns:
            True if numeric, False otherwise
        """
        try:
            float(value)
            return True
        except ValueError:
            return False


def main():
    """Main function to parse arguments and run the dataset preparation"""
    parser = argparse.ArgumentParser(description="Prepare datasets for property-specific training")
    parser.add_argument("--property", required=True, help="Property name")
    parser.add_argument("--material-type", required=True, help="Material type")
    parser.add_argument("--input-dir", required=True, help="Directory containing raw data")
    parser.add_argument("--output-dir", required=True, help="Directory to save prepared data")
    parser.add_argument("--metadata-path", help="Path to property metadata file")
    
    args = parser.parse_args()
    
    try:
        # Create dataset preparer
        preparer = PropertyDatasetPreparer(
            args.input_dir,
            args.output_dir,
            args.property,
            args.material_type,
            args.metadata_path
        )
        
        # Prepare dataset
        result = preparer.prepare_dataset()
        
        # Print result as JSON
        print(json.dumps(result))
        
    except Exception as e:
        logger.error(f"Error in dataset preparation: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
