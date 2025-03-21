#!/usr/bin/env python3
"""
Crawler Data Adapter for Training

This module processes and adapts crawler data for use in the material recognition
training pipeline. It handles:
1. Extracting relevant images from crawler results
2. Organizing data into a format suitable for training
3. Adding metadata about data provenance
4. Pre-processing images for optimal training

Usage:
    python crawler_adapter.py <command> [options]

Commands:
    prepare      Prepare crawler data for training
    validate     Validate crawler data for training suitability
    metadata     Extract metadata from crawler dataset
"""

import os
import sys
import json
import argparse
import shutil
import hashlib
import urllib.request
from typing import Dict, List, Any, Tuple, Optional, Union
from datetime import datetime
import random
import cv2
import numpy as np
from pathlib import Path

# Import shared utility functions if available
try:
    from preprocess_image import preprocess_image_for_training
except ImportError:
    # Basic implementation if the module is not available
    def preprocess_image_for_training(image_path, output_path=None, target_size=(224, 224)):
        """Simple image preprocessing function"""
        img = cv2.imread(image_path)
        if img is None:
            return None
            
        # Resize image
        img_resized = cv2.resize(img, target_size, interpolation=cv2.INTER_AREA)
        
        # Save if output path is provided
        if output_path:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            cv2.imwrite(output_path, img_resized)
            
        return img_resized


class CrawlerDataAdapter:
    """Class for adapting crawler data for material recognition training"""
    
    def __init__(self, data_dir: str = None, output_dir: str = None, target_size: Tuple[int, int] = (224, 224)):
        """
        Initialize the crawler data adapter
        
        Args:
            data_dir: Directory containing crawler data
            output_dir: Directory to save adapted data for training
            target_size: Target image size for training (width, height)
        """
        self.data_dir = data_dir
        self.output_dir = output_dir or os.path.join(os.getcwd(), "training_data")
        self.target_size = target_size
        
        # Create output directory if it doesn't exist
        if self.output_dir:
            os.makedirs(self.output_dir, exist_ok=True)
    
    def prepare_dataset(self, manifest_path: str, min_images_per_class: int = 5) -> Dict[str, Any]:
        """
        Prepare crawler data for training
        
        Args:
            manifest_path: Path to the crawler dataset manifest file
            min_images_per_class: Minimum number of images required per class
            
        Returns:
            Dictionary with preparation results
        """
        # Load the manifest file
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
        
        # Create dataset-specific output directory
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        dataset_name = f"crawler_dataset_{timestamp}"
        dataset_dir = os.path.join(self.output_dir, dataset_name)
        os.makedirs(dataset_dir, exist_ok=True)
        
        # Get source directory (where the manifest file is located)
        source_dir = os.path.dirname(manifest_path)
        
        # Process images directory
        images_dir = os.path.join(source_dir, "images")
        if not os.path.exists(images_dir):
            return {
                "status": "error",
                "message": f"Images directory not found: {images_dir}",
                "dataset_path": None
            }
        
        # Find image manifests
        image_manifests = []
        for root, _, files in os.walk(images_dir):
            for file in files:
                if file.endswith("_manifest.json"):
                    image_manifests.append(os.path.join(root, file))
        
        if not image_manifests:
            return {
                "status": "error",
                "message": "No image manifests found in crawler data",
                "dataset_path": None
            }
        
        # Process image manifests and organize by domain (as proxy for material/class)
        domain_images = {}
        total_images = 0
        
        for manifest_file in image_manifests:
            with open(manifest_file, 'r') as f:
                images = json.load(f)
                
                for img in images:
                    domain = img.get("domain", "unknown")
                    url = img.get("url")
                    
                    if not url:
                        continue
                    
                    if domain not in domain_images:
                        domain_images[domain] = []
                    
                    domain_images[domain].append({
                        "url": url,
                        "source_page": img.get("source_page"),
                        "title": img.get("title")
                    })
                    total_images += 1
        
        # Filter domains with too few images
        valid_domains = {domain: images for domain, images in domain_images.items() 
                        if len(images) >= min_images_per_class}
        
        if not valid_domains:
            return {
                "status": "error",
                "message": f"No domains with at least {min_images_per_class} images",
                "dataset_path": None
            }
        
        # Download and organize images by domain
        processed_images = 0
        classes_created = 0
        download_errors = 0
        
        for domain, images in valid_domains.items():
            # Create domain directory
            domain_dir = os.path.join(dataset_dir, self._sanitize_filename(domain))
            os.makedirs(domain_dir, exist_ok=True)
            classes_created += 1
            
            # Process images for this domain
            for i, img in enumerate(images):
                try:
                    # Generate a filename based on URL
                    url = img["url"]
                    url_hash = hashlib.md5(url.encode()).hexdigest()[:10]
                    filename = f"{domain}_{url_hash}_{i}.jpg"
                    output_path = os.path.join(domain_dir, filename)
                    
                    # Download image
                    temp_path = output_path + ".temp"
                    try:
                        urllib.request.urlretrieve(url, temp_path)
                        
                        # Preprocess for training
                        preprocess_image_for_training(temp_path, output_path, target_size=self.target_size)
                        
                        # Clean up temporary file
                        if os.path.exists(temp_path):
                            os.remove(temp_path)
                        
                        processed_images += 1
                    except Exception as e:
                        download_errors += 1
                        print(f"Error downloading {url}: {e}")
                        continue
                except Exception as e:
                    print(f"Error processing image {i} for domain {domain}: {e}")
        
        # Create a metadata file with information about the dataset
        metadata = {
            "dataset_name": dataset_name,
            "created_at": datetime.now().isoformat(),
            "source": manifest.get("source", "crawler"),
            "job_id": manifest.get("job_id"),
            "config_id": manifest.get("config_id"),
            "original_total_images": total_images,
            "processed_images": processed_images,
            "classes": list(valid_domains.keys()),
            "classes_count": classes_created,
            "download_errors": download_errors,
            "data_provenance": "crawler",
            "min_images_per_class": min_images_per_class,
            "target_size": list(self.target_size)
        }
        
        with open(os.path.join(dataset_dir, "metadata.json"), 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return {
            "status": "success",
            "dataset_path": dataset_dir,
            "classes": list(valid_domains.keys()),
            "classes_count": classes_created,
            "processed_images": processed_images,
            "download_errors": download_errors
        }
    
    def validate_dataset(self, dataset_path: str) -> Dict[str, Any]:
        """
        Validate a crawler dataset for training suitability
        
        Args:
            dataset_path: Path to the crawler dataset
            
        Returns:
            Dictionary with validation results
        """
        if not os.path.exists(dataset_path):
            return {
                "status": "error",
                "message": f"Dataset path not found: {dataset_path}",
                "valid": False
            }
        
        # Check for metadata.json
        metadata_path = os.path.join(dataset_path, "metadata.json")
        if not os.path.exists(metadata_path):
            return {
                "status": "error",
                "message": "Metadata file not found in dataset",
                "valid": False
            }
        
        # Load metadata
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        
        # Check if dataset was created by crawler_adapter
        if metadata.get("data_provenance") != "crawler":
            return {
                "status": "warning",
                "message": "Dataset was not created by crawler_adapter",
                "valid": True,  # Still valid, but may not be optimal
                "warnings": ["Dataset was not created by crawler_adapter"]
            }
        
        # Check class directories
        class_dirs = [d for d in os.listdir(dataset_path) 
                     if os.path.isdir(os.path.join(dataset_path, d)) and not d.startswith(".")]
        
        if not class_dirs:
            return {
                "status": "error",
                "message": "No class directories found in dataset",
                "valid": False
            }
        
        # Count images in each class
        class_counts = {}
        warnings = []
        min_count = float('inf')
        max_count = 0
        
        for class_dir in class_dirs:
            class_path = os.path.join(dataset_path, class_dir)
            images = [f for f in os.listdir(class_path) 
                     if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp'))]
            
            count = len(images)
            class_counts[class_dir] = count
            
            min_count = min(min_count, count)
            max_count = max(max_count, count)
            
            if count < 5:
                warnings.append(f"Class '{class_dir}' has only {count} images (minimum recommended: 5)")
        
        # Check class balance
        if max_count > min_count * 5:
            warnings.append(f"Dataset is imbalanced: max class has {max_count} images, min class has {min_count} images")
        
        # Validate a sample of images
        sample_size = min(50, sum(class_counts.values()))
        valid_images = 0
        invalid_images = 0
        
        # Randomly select images to validate
        all_images = []
        for class_dir in class_dirs:
            class_path = os.path.join(dataset_path, class_dir)
            images = [os.path.join(class_path, f) for f in os.listdir(class_path) 
                     if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp'))]
            all_images.extend(images)
        
        if all_images:
            sample_images = random.sample(all_images, min(sample_size, len(all_images)))
            
            for img_path in sample_images:
                try:
                    img = cv2.imread(img_path)
                    if img is None or img.size == 0:
                        invalid_images += 1
                    else:
                        valid_images += 1
                except Exception:
                    invalid_images += 1
            
            if invalid_images > 0:
                warnings.append(f"{invalid_images} out of {sample_size} sampled images are invalid")
        
        return {
            "status": "success" if not warnings else "warning",
            "valid": True,
            "class_count": len(class_dirs),
            "class_distribution": class_counts,
            "total_images": sum(class_counts.values()),
            "min_class_size": min_count,
            "max_class_size": max_count,
            "image_sample_valid_ratio": valid_images / (valid_images + invalid_images) if (valid_images + invalid_images) > 0 else 0,
            "warnings": warnings if warnings else None
        }
    
    def extract_metadata(self, dataset_path: str) -> Dict[str, Any]:
        """
        Extract metadata from a crawler dataset
        
        Args:
            dataset_path: Path to the crawler dataset
            
        Returns:
            Dictionary with dataset metadata
        """
        if not os.path.exists(dataset_path):
            return {
                "status": "error",
                "message": f"Dataset path not found: {dataset_path}"
            }
        
        # Check for metadata.json
        metadata_path = os.path.join(dataset_path, "metadata.json")
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
                return {
                    "status": "success",
                    "metadata": metadata
                }
        
        # If no metadata.json, extract information from directory structure
        class_dirs = [d for d in os.listdir(dataset_path) 
                     if os.path.isdir(os.path.join(dataset_path, d)) and not d.startswith(".")]
        
        if not class_dirs:
            return {
                "status": "error",
                "message": "No class directories found in dataset"
            }
        
        # Count images in each class
        class_counts = {}
        total_images = 0
        
        for class_dir in class_dirs:
            class_path = os.path.join(dataset_path, class_dir)
            images = [f for f in os.listdir(class_path) 
                     if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp'))]
            
            count = len(images)
            class_counts[class_dir] = count
            total_images += count
        
        # Generate metadata
        generated_metadata = {
            "dataset_name": os.path.basename(dataset_path),
            "created_at": datetime.now().isoformat(),
            "source": "crawler",
            "data_provenance": "crawler",
            "classes": class_dirs,
            "classes_count": len(class_dirs),
            "total_images": total_images,
            "class_distribution": class_counts,
            "is_generated_metadata": True
        }
        
        # Save generated metadata
        with open(os.path.join(dataset_path, "metadata.json"), 'w') as f:
            json.dump(generated_metadata, f, indent=2)
        
        return {
            "status": "success",
            "metadata": generated_metadata,
            "message": "Generated metadata from directory structure"
        }
    
    def _sanitize_filename(self, name: str) -> str:
        """
        Sanitize a string to be used as a filename
        
        Args:
            name: String to sanitize
            
        Returns:
            Sanitized string
        """
        # Remove invalid characters
        invalid_chars = '<>:"/\\|?*'
        for char in invalid_chars:
            name = name.replace(char, '_')
        
        # Trim spaces and dots
        name = name.strip(" .")
        
        # Ensure it's not empty
        if not name:
            name = "unknown"
        
        return name


def handle_prepare_command(args):
    """Handle the 'prepare' command"""
    if not args.manifest_path:
        print("Error: manifest_path is required", file=sys.stderr)
        return 1
    
    adapter = CrawlerDataAdapter(
        output_dir=args.output_dir,
        target_size=(args.target_width, args.target_height)
    )
    
    try:
        result = adapter.prepare_dataset(
            args.manifest_path,
            min_images_per_class=args.min_images
        )
        
        print(json.dumps(result, indent=2))
        return 0 if result["status"] == "success" else 1
    except Exception as e:
        print(f"Error preparing dataset: {e}", file=sys.stderr)
        return 1


def handle_validate_command(args):
    """Handle the 'validate' command"""
    if not args.dataset_path:
        print("Error: dataset_path is required", file=sys.stderr)
        return 1
    
    adapter = CrawlerDataAdapter()
    
    try:
        result = adapter.validate_dataset(args.dataset_path)
        
        print(json.dumps(result, indent=2))
        return 0 if result["valid"] else 1
    except Exception as e:
        print(f"Error validating dataset: {e}", file=sys.stderr)
        return 1


def handle_metadata_command(args):
    """Handle the 'metadata' command"""
    if not args.dataset_path:
        print("Error: dataset_path is required", file=sys.stderr)
        return 1
    
    adapter = CrawlerDataAdapter()
    
    try:
        result = adapter.extract_metadata(args.dataset_path)
        
        print(json.dumps(result, indent=2))
        return 0 if result["status"] == "success" else 1
    except Exception as e:
        print(f"Error extracting metadata: {e}", file=sys.stderr)
        return 1


def main():
    """Main function to parse arguments and run commands"""
    parser = argparse.ArgumentParser(description="Crawler data adapter for training")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Prepare command
    prepare_parser = subparsers.add_parser("prepare", help="Prepare crawler data for training")
    prepare_parser.add_argument("--manifest-path", required=True,
                              help="Path to the crawler dataset manifest file")
    prepare_parser.add_argument("--output-dir",
                              help="Directory to save adapted data for training")
    prepare_parser.add_argument("--min-images", type=int, default=5,
                              help="Minimum number of images required per class")
    prepare_parser.add_argument("--target-width", type=int, default=224,
                              help="Target image width for training")
    prepare_parser.add_argument("--target-height", type=int, default=224,
                              help="Target image height for training")
    
    # Validate command
    validate_parser = subparsers.add_parser("validate", help="Validate crawler data for training suitability")
    validate_parser.add_argument("--dataset-path", required=True,
                               help="Path to the crawler dataset")
    
    # Metadata command
    metadata_parser = subparsers.add_parser("metadata", help="Extract metadata from crawler dataset")
    metadata_parser.add_argument("--dataset-path", required=True,
                               help="Path to the crawler dataset")
    metadata_parser.add_argument("--output",
                               help="Output file for metadata (defaults to stdout)")
    
    args = parser.parse_args()
    
    if args.command == "prepare":
        return handle_prepare_command(args)
    elif args.command == "validate":
        return handle_validate_command(args)
    elif args.command == "metadata":
        return handle_metadata_command(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())