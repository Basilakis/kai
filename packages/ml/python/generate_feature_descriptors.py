#!/usr/bin/env python3
"""
Feature Descriptors Generator

This script generates a database of SIFT feature descriptors from a dataset of material images.
The descriptors are used for feature-based material recognition.

Usage:
    python generate_feature_descriptors.py <dataset_dir> <output_file>

Arguments:
    dataset_dir    Directory containing material images organized by material ID
    output_file    Path to save the feature descriptors database
"""

import os
import sys
import cv2
import numpy as np
import argparse
from tqdm import tqdm
import json
from pathlib import Path


def extract_features(image_path):
    """
    Extract SIFT features from an image
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Tuple of (keypoints, descriptors)
    """
    # Load image
    image = cv2.imread(image_path)
    if image is None:
        print(f"Warning: Failed to load image: {image_path}", file=sys.stderr)
        return None, None
    
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Create SIFT detector
    sift = cv2.SIFT_create()
    
    # Detect keypoints and compute descriptors
    keypoints, descriptors = sift.detectAndCompute(gray, None)
    
    return keypoints, descriptors


def generate_feature_descriptors(dataset_dir, output_file):
    """
    Generate feature descriptors database from a dataset of material images
    
    Args:
        dataset_dir: Directory containing material images organized by material ID
        output_file: Path to save the feature descriptors database
        
    Returns:
        Dictionary with generation results
    """
    # Check if dataset directory exists
    if not os.path.exists(dataset_dir):
        raise FileNotFoundError(f"Dataset directory not found: {dataset_dir}")
    
    # Get all material directories
    material_dirs = [d for d in os.listdir(dataset_dir) 
                    if os.path.isdir(os.path.join(dataset_dir, d))]
    
    if not material_dirs:
        raise ValueError(f"No material directories found in {dataset_dir}")
    
    print(f"Found {len(material_dirs)} material categories")
    
    material_ids = []
    all_descriptors = []
    material_metadata = {"materials": {}}
    
    # Process each material
    for material_id in tqdm(material_dirs, desc="Processing materials"):
        material_path = os.path.join(dataset_dir, material_id)
        material_descriptors = []
        
        # Get all images for this material
        image_files = []
        for ext in ['jpg', 'jpeg', 'png', 'webp']:
            image_files.extend([os.path.join(material_path, f) for f in os.listdir(material_path) 
                              if f.lower().endswith(f'.{ext}')])
        
        if not image_files:
            print(f"Warning: No images found for material {material_id}")
            continue
        
        print(f"Processing {len(image_files)} images for {material_id}")
        
        # Extract features from each image
        for image_file in tqdm(image_files, desc=f"Processing {material_id}", leave=False):
            keypoints, descriptors = extract_features(image_file)
            if descriptors is not None and len(descriptors) > 0:
                material_descriptors.append(descriptors)
        
        # Combine descriptors for this material
        if material_descriptors:
            combined_descriptors = np.vstack(material_descriptors)
            material_ids.append(material_id)
            all_descriptors.append(combined_descriptors)
            
            # Add material metadata
            material_metadata["materials"][material_id] = {
                "id": material_id,
                "name": material_id.replace("_", " ").title(),
                "imageCount": len(image_files),
                "featureCount": len(combined_descriptors)
            }
            
            print(f"Added {len(combined_descriptors)} descriptors for {material_id}")
        else:
            print(f"Warning: No valid descriptors for {material_id}")
    
    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    # Save the descriptors database
    np.savez_compressed(
        output_file,
        material_ids=material_ids,
        descriptors=all_descriptors
    )
    
    # Save material metadata
    metadata_file = os.path.join(os.path.dirname(output_file), "material_metadata.json")
    with open(metadata_file, "w") as f:
        json.dump(material_metadata, f, indent=2)
    
    return {
        "descriptors_file": output_file,
        "metadata_file": metadata_file,
        "material_count": len(material_ids),
        "total_descriptors": sum(len(desc) for desc in all_descriptors)
    }


def main():
    """Main function to parse arguments and generate feature descriptors"""
    parser = argparse.ArgumentParser(description="Generate feature descriptors database")
    parser.add_argument("dataset_dir", help="Directory containing material images organized by material ID")
    parser.add_argument("output_file", help="Path to save the feature descriptors database")
    
    args = parser.parse_args()
    
    try:
        result = generate_feature_descriptors(args.dataset_dir, args.output_file)
        
        print("\nFeature descriptors generation completed:")
        print(f"- Descriptors file: {result['descriptors_file']}")
        print(f"- Metadata file: {result['metadata_file']}")
        print(f"- Material count: {result['material_count']}")
        print(f"- Total descriptors: {result['total_descriptors']}")
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()