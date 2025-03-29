#!/usr/bin/env python3
"""
Adaptive Embedding Example

This script demonstrates how to use the adaptive hybrid embedding system
for material recognition. It shows both the direct embedding generation
and the material recognition using the adaptive approach.
"""

import os
import sys
import json
import argparse
from typing import Dict, Any

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Try to import embedding bridge and material recognizer
try:
    from embedding_bridge import generate_embedding
    from material_recognizer import MaterialRecognizer
    
    # Check if adaptive system is available
    ADAPTIVE_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Could not import required modules: {e}")
    print("Make sure embedding_bridge.py and material_recognizer.py are available.")
    ADAPTIVE_AVAILABLE = False


def example_generate_embedding(image_path: str, material_id: str = None, quality_threshold: float = 0.65) -> Dict[str, Any]:
    """
    Generate an embedding using the adaptive system
    
    Args:
        image_path: Path to the image file
        material_id: Optional material ID for context (enables material-specific adaptation)
        quality_threshold: Quality threshold below which to switch methods
        
    Returns:
        Dictionary with embedding vector and metadata
    """
    if not ADAPTIVE_AVAILABLE:
        print("Adaptive embedding system not available.")
        return {}
    
    print(f"Generating adaptive embedding for: {image_path}")
    
    # Generate embedding with adaptive method selection
    result = generate_embedding(
        image_path=image_path,
        method='hybrid',  # Start with hybrid approach
        material_id=material_id,  # Context for material-specific optimization
        adaptive=True,  # Enable adaptive selection
        quality_threshold=quality_threshold  # Set quality threshold
    )
    
    # Print embedding metadata
    print(f"Embedding generated using method: {result.get('method', 'unknown')}")
    print(f"Initial method: {result.get('initial_method', 'unknown')}")
    print(f"Method switches: {result.get('method_switches', 0)}")
    print(f"Quality scores: {result.get('quality_scores', {})}")
    print(f"Vector dimensions: {result.get('dimensions', 0)}")
    
    return result


def example_recognize_material(image_path: str, material_id: str = None, quality_threshold: float = 0.65) -> Dict[str, Any]:
    """
    Recognize materials in an image using the adaptive system
    
    Args:
        image_path: Path to the image file
        material_id: Optional material ID for context (enables material-specific adaptation)
        quality_threshold: Quality threshold below which to switch methods
        
    Returns:
        Dictionary with recognition results
    """
    if not ADAPTIVE_AVAILABLE:
        print("Adaptive recognition system not available.")
        return {}
    
    print(f"Recognizing materials in: {image_path}")
    
    # Initialize the recognizer with adaptive capability
    recognizer = MaterialRecognizer(
        model_type='hybrid',
        confidence_threshold=0.6,
        max_results=5,
        adaptive=True,
        quality_threshold=quality_threshold,
        material_id=material_id
    )
    
    # Perform recognition
    result = recognizer.recognize(image_path)
    
    # Print recognition metadata
    print(f"Recognition completed in {result.get('processingTime', 0):.2f} seconds")
    print(f"Adaptive mode: {'enabled' if result.get('adaptiveEnabled', False) else 'disabled'}")
    print(f"Found {len(result.get('matches', []))} matching materials")
    
    # Print top matches
    if result.get('matches'):
        print("\nTop matches:")
        for i, match in enumerate(result.get('matches', [])):
            print(f"{i+1}. Material ID: {match.get('materialId')}")
            print(f"   Confidence: {match.get('confidence', 0):.4f}")
            
            # Print embedding method if available
            if 'embeddingMethod' in match.get('features', {}):
                print(f"   Method: {match['features']['embeddingMethod']}")
                print(f"   Initial method: {match['features'].get('initialMethod', 'unknown')}")
                print(f"   Method switches: {match['features'].get('methodSwitches', 0)}")
    
    return result


def main():
    """Main function to run the example"""
    parser = argparse.ArgumentParser(description="Adaptive embedding example")
    parser.add_argument("image_path", help="Path to the image file")
    parser.add_argument("--material-id", help="Optional material ID for context")
    parser.add_argument("--quality-threshold", type=float, default=0.65,
                        help="Quality threshold for method switching")
    parser.add_argument("--embedding-only", action="store_true",
                        help="Only generate embedding, skip recognition")
    parser.add_argument("--recognition-only", action="store_true",
                        help="Only perform recognition, skip embedding generation")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.image_path):
        print(f"Error: Image file not found: {args.image_path}")
        sys.exit(1)
    
    try:
        # Run the examples
        if not args.recognition_only:
            print("\n=== Embedding Generation Example ===\n")
            example_generate_embedding(
                args.image_path,
                args.material_id,
                args.quality_threshold
            )
        
        if not args.embedding_only:
            print("\n=== Material Recognition Example ===\n")
            example_recognize_material(
                args.image_path,
                args.material_id,
                args.quality_threshold
            )
        
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()