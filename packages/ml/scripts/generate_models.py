#!/usr/bin/env python3
"""
Generate Model Files Script

This script generates all the necessary model files for the Kai Material Recognition system:
1. Feature descriptors database
2. TensorFlow model
3. PyTorch model
4. Material metadata

Usage:
    python generate_models.py --dataset_dir /path/to/dataset --output_dir /path/to/output

Arguments:
    --dataset_dir: Directory containing the training dataset
    --output_dir: Directory to save the generated models
    --feature_size: Size of the feature descriptors (default: 128)
    --embedding_size: Size of the embeddings (default: 512)
    --batch_size: Batch size for training (default: 32)
    --epochs: Number of epochs for training (default: 20)
    --framework: ML framework to use (tensorflow, pytorch, or both) (default: both)
"""

import os
import sys
import json
import argparse
import numpy as np
from datetime import datetime
from pathlib import Path

# Add the parent directory to the path so we can import the Python modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the Python modules
from python.generate_feature_descriptors import extract_features_from_dataset
from python.train_neural_network import train_tensorflow_model, train_pytorch_model
from python.embedding_generator import generate_embeddings_for_dataset

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Generate model files for Kai Material Recognition')
    parser.add_argument('--dataset_dir', required=True, help='Directory containing the training dataset')
    parser.add_argument('--output_dir', required=True, help='Directory to save the generated models')
    parser.add_argument('--feature_size', type=int, default=128, help='Size of the feature descriptors')
    parser.add_argument('--embedding_size', type=int, default=512, help='Size of the embeddings')
    parser.add_argument('--batch_size', type=int, default=32, help='Batch size for training')
    parser.add_argument('--epochs', type=int, default=20, help='Number of epochs for training')
    parser.add_argument('--framework', choices=['tensorflow', 'pytorch', 'both'], default='both',
                        help='ML framework to use (tensorflow, pytorch, or both)')
    return parser.parse_args()

def create_material_metadata(dataset_dir, material_ids, output_dir):
    """Create material metadata JSON file"""
    metadata = {
        'materials': [],
        'created_at': datetime.now().isoformat(),
        'version': '1.0.0'
    }
    
    for material_id in material_ids:
        material_dir = os.path.join(dataset_dir, material_id)
        if not os.path.isdir(material_dir):
            continue
        
        # Count the number of images for this material
        image_files = []
        for ext in ['jpg', 'jpeg', 'png', 'webp']:
            image_files.extend([f for f in os.listdir(material_dir) if f.lower().endswith(f'.{ext}')])
        
        # Extract material properties from the directory name
        # In a real implementation, this would use more sophisticated methods
        material_type = 'unknown'
        for material_type_candidate in ['tile', 'stone', 'wood', 'ceramic', 'porcelain', 'glass', 'metal']:
            if material_type_candidate in material_id.lower():
                material_type = material_type_candidate
                break
        
        # Add material to metadata
        metadata['materials'].append({
            'id': material_id,
            'name': material_id.replace('_', ' ').title(),
            'type': material_type,
            'image_count': len(image_files),
            'has_feature_descriptors': True,
            'has_tensorflow_model': True,
            'has_pytorch_model': True,
            'has_embeddings': True
        })
    
    # Save metadata to file
    metadata_path = os.path.join(output_dir, 'material_metadata.json')
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"Material metadata saved to {metadata_path}")
    return metadata

def main():
    """Main function"""
    args = parse_args()
    
    # Create output directory if it doesn't exist
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Get material IDs from dataset directory
    material_ids = [d for d in os.listdir(args.dataset_dir) 
                   if os.path.isdir(os.path.join(args.dataset_dir, d))]
    
    if not material_ids:
        print(f"No material directories found in {args.dataset_dir}")
        sys.exit(1)
    
    print(f"Found {len(material_ids)} materials in dataset")
    
    # Generate feature descriptors
    print("\n=== Generating Feature Descriptors ===")
    feature_descriptors_path = os.path.join(args.output_dir, 'feature_descriptors.npz')
    extract_features_from_dataset(
        dataset_dir=args.dataset_dir,
        output_file=feature_descriptors_path,
        feature_size=args.feature_size
    )
    
    # Train TensorFlow model
    if args.framework in ['tensorflow', 'both']:
        print("\n=== Training TensorFlow Model ===")
        tf_model_dir = os.path.join(args.output_dir, 'material_classifier_tf')
        train_tensorflow_model(
            dataset_dir=args.dataset_dir,
            output_dir=tf_model_dir,
            batch_size=args.batch_size,
            epochs=args.epochs,
            embedding_size=args.embedding_size
        )
    
    # Train PyTorch model
    if args.framework in ['pytorch', 'both']:
        print("\n=== Training PyTorch Model ===")
        pt_model_path = os.path.join(args.output_dir, 'material_classifier_torch.pt')
        train_pytorch_model(
            dataset_dir=args.dataset_dir,
            output_path=pt_model_path,
            batch_size=args.batch_size,
            epochs=args.epochs,
            embedding_size=args.embedding_size
        )
    
    # Generate embeddings for the dataset
    print("\n=== Generating Embeddings ===")
    embeddings_path = os.path.join(args.output_dir, 'material_embeddings.npz')
    generate_embeddings_for_dataset(
        dataset_dir=args.dataset_dir,
        output_file=embeddings_path,
        embedding_size=args.embedding_size
    )
    
    # Create material metadata
    print("\n=== Creating Material Metadata ===")
    create_material_metadata(args.dataset_dir, material_ids, args.output_dir)
    
    print("\n=== Model Generation Complete ===")
    print(f"All model files have been saved to {args.output_dir}")

if __name__ == "__main__":
    main()