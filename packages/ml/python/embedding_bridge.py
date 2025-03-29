#!/usr/bin/env python3
"""
Embedding Bridge

This module provides a unified interface to both the traditional embedding generator
and the new adaptive hybrid embedding system. It allows for seamless integration of
the adaptive capabilities while maintaining backwards compatibility.
"""

import os
import sys
import json
import numpy as np
import logging
from typing import Dict, List, Any, Tuple, Optional, Union
import time

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('embedding_bridge')

# Import both embedding systems
from embedding_generator import (
    generate_embedding as generate_traditional_embedding,
    load_image
)

# Check if adaptive system is available
try:
    from adaptive_hybrid_embeddings import (
        generate_adaptive_embedding,
        AdaptiveEmbeddingGenerator
    )
    ADAPTIVE_AVAILABLE = True
except ImportError:
    logger.warning("Adaptive hybrid embedding system not available. Using traditional embeddings only.")
    ADAPTIVE_AVAILABLE = False


def generate_embedding(
    image_path: str,
    method: str = 'hybrid',
    model_path: Optional[str] = None,
    output_dimensions: int = 256,
    material_id: Optional[str] = None,
    adaptive: bool = True,
    reference_path: Optional[str] = None,
    cache_dir: Optional[str] = None,
    quality_threshold: float = 0.65
) -> Dict[str, Any]:
    """
    Unified embedding generation interface that supports both traditional
    and adaptive embedding generation.
    
    Args:
        image_path: Path to the image file
        method: Method to use for embedding generation (feature-based, ml-based, hybrid)
        model_path: Path to the pre-trained model (for ML-based method)
        output_dimensions: Dimensions of the output embedding vector
        material_id: Optional material ID for context (enables material-specific optimization)
        adaptive: Whether to use adaptive embedding generation
        reference_path: Optional path to reference embeddings (for adaptive system)
        cache_dir: Directory to cache quality scores and statistics (for adaptive system)
        quality_threshold: Threshold below which to switch methods (for adaptive system)
        
    Returns:
        Dictionary with embedding vector and metadata
    """
    # Check if adaptive is requested but not available
    if adaptive and not ADAPTIVE_AVAILABLE:
        logger.warning("Adaptive embedding requested but not available. Using traditional embedding.")
        adaptive = False
    
    start_time = time.time()
    
    # Generate embedding using the appropriate method
    if adaptive and ADAPTIVE_AVAILABLE:
        # Use adaptive system
        result = generate_adaptive_embedding(
            image_path=image_path,
            material_id=material_id,
            method=method,
            reference_path=reference_path,
            cache_dir=cache_dir,
            model_path=model_path,
            output_dimensions=output_dimensions,
            quality_threshold=quality_threshold,
            adaptive=True
        )
    else:
        # Use traditional system
        result = generate_traditional_embedding(
            image_path=image_path,
            method=method,
            model_path=model_path,
            output_dimensions=output_dimensions
        )
        
        # Add additional fields for consistency with adaptive output
        result["adaptive"] = False
        result["initial_method"] = method
        result["method_switches"] = 0
        
        if material_id:
            result["material_id"] = material_id
    
    # Add total processing time including bridge overhead
    result["total_time"] = time.time() - start_time
    
    return result


def batch_generate_embeddings(
    image_paths: List[str],
    methods: Optional[Union[str, List[str]]] = 'hybrid',
    model_path: Optional[str] = None,
    output_dimensions: int = 256,
    material_ids: Optional[List[str]] = None,
    adaptive: bool = True,
    reference_path: Optional[str] = None,
    cache_dir: Optional[str] = None,
    quality_threshold: float = 0.65
) -> List[Dict[str, Any]]:
    """
    Generate embeddings for multiple images in batch mode
    
    Args:
        image_paths: List of paths to image files
        methods: Method(s) to use for embedding generation (single string or list matching image_paths)
        model_path: Path to the pre-trained model (for ML-based method)
        output_dimensions: Dimensions of the output embedding vector
        material_ids: Optional list of material IDs matching image_paths
        adaptive: Whether to use adaptive embedding generation
        reference_path: Optional path to reference embeddings (for adaptive system)
        cache_dir: Directory to cache quality scores and statistics (for adaptive system)
        quality_threshold: Threshold below which to switch methods (for adaptive system)
        
    Returns:
        List of dictionaries with embedding vectors and metadata
    """
    # Check if adaptive is requested but not available
    if adaptive and not ADAPTIVE_AVAILABLE:
        logger.warning("Adaptive embedding requested but not available. Using traditional embedding.")
        adaptive = False
    
    # Initialize adaptive generator once if using adaptive mode
    # This allows sharing reference data and performance history across calls
    adaptive_generator = None
    if adaptive and ADAPTIVE_AVAILABLE:
        adaptive_generator = AdaptiveEmbeddingGenerator(
            reference_path=reference_path,
            cache_dir=cache_dir,
            quality_threshold=quality_threshold,
            model_path=model_path,
            output_dimensions=output_dimensions,
            default_method='hybrid'
        )
    
    # Normalize methods to list
    if isinstance(methods, str):
        methods = [methods] * len(image_paths)
    elif len(methods) != len(image_paths):
        raise ValueError("If methods is a list, it must have the same length as image_paths")
    
    # Normalize material_ids to list
    if material_ids is None:
        material_ids = [None] * len(image_paths)
    elif len(material_ids) != len(image_paths):
        raise ValueError("If material_ids is provided, it must have the same length as image_paths")
    
    results = []
    
    # Process each image
    for i, image_path in enumerate(image_paths):
        try:
            # Get method and material_id for this image
            method = methods[i]
            material_id = material_ids[i]
            
            # Generate embedding
            if adaptive and ADAPTIVE_AVAILABLE and adaptive_generator:
                # Load image
                image = load_image(image_path)
                
                # Generate embedding with reused generator
                embedding, info = adaptive_generator.generate_embedding(
                    image=image,
                    material_id=material_id,
                    method=method,
                    adaptive=True
                )
                
                # Extract image metadata
                height, width = image.shape[:2]
                
                # Prepare result
                result = {
                    "vector": embedding.tolist(),
                    "dimensions": output_dimensions,
                    "method": info["final_method"],
                    "initial_method": info["initial_method"],
                    "processing_time": info["processing_time"],
                    "quality_scores": info["quality_scores"],
                    "method_switches": info["method_switches"],
                    "adaptive": True,
                    "image_metadata": {
                        "width": width,
                        "height": height,
                        "channels": image.shape[2] if len(image.shape) > 2 else 1,
                        "path": image_path
                    }
                }
                
                # Add material ID if provided
                if material_id:
                    result["material_id"] = material_id
                    
            else:
                # Use traditional system
                result = generate_traditional_embedding(
                    image_path=image_path,
                    method=method,
                    model_path=model_path,
                    output_dimensions=output_dimensions
                )
                
                # Add additional fields for consistency with adaptive output
                result["adaptive"] = False
                result["initial_method"] = method
                result["method_switches"] = 0
                
                if material_id:
                    result["material_id"] = material_id
            
            results.append(result)
            
        except Exception as e:
            logger.error(f"Error generating embedding for {image_path}: {e}")
            # Add error result
            results.append({
                "error": str(e),
                "path": image_path,
                "success": False
            })
    
    # If using adaptive, save performance stats
    if adaptive and ADAPTIVE_AVAILABLE and adaptive_generator and cache_dir:
        stats = adaptive_generator.get_performance_stats()
        stats_path = os.path.join(cache_dir, "batch_performance_stats.json")
        try:
            with open(stats_path, "w") as f:
                json.dump(stats, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving performance stats: {e}")
    
    return results


if __name__ == "__main__":
    # Example usage when script is run directly
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate embeddings")
    parser.add_argument("image_path", help="Path to the image file")
    parser.add_argument("--method", choices=["feature-based", "ml-based", "hybrid"], 
                        default="hybrid", help="Method to use for embedding generation")
    parser.add_argument("--model-path", help="Path to the pre-trained model")
    parser.add_argument("--output-dimensions", type=int, default=256,
                        help="Dimensions of the output embedding vector")
    parser.add_argument("--material-id", help="Material ID")
    parser.add_argument("--adaptive", action="store_true", help="Use adaptive embedding")
    parser.add_argument("--reference-path", help="Path to reference embeddings")
    parser.add_argument("--cache-dir", help="Cache directory")
    parser.add_argument("--quality-threshold", type=float, default=0.65,
                        help="Quality threshold for method switching")
    parser.add_argument("--batch-file", help="Path to JSON file with batch processing info")
    
    args = parser.parse_args()
    
    try:
        # Check for batch processing
        if args.batch_file and os.path.exists(args.batch_file):
            with open(args.batch_file, "r") as f:
                batch_data = json.load(f)
            
            # Process batch
            results = batch_generate_embeddings(
                image_paths=batch_data.get("image_paths", []),
                methods=batch_data.get("methods", args.method),
                model_path=args.model_path,
                output_dimensions=args.output_dimensions,
                material_ids=batch_data.get("material_ids", []),
                adaptive=args.adaptive,
                reference_path=args.reference_path,
                cache_dir=args.cache_dir,
                quality_threshold=args.quality_threshold
            )
            
            # Print results
            print(json.dumps(results, indent=2))
            
        else:
            # Process single image
            result = generate_embedding(
                image_path=args.image_path,
                method=args.method,
                model_path=args.model_path,
                output_dimensions=args.output_dimensions,
                material_id=args.material_id,
                adaptive=args.adaptive,
                reference_path=args.reference_path,
                cache_dir=args.cache_dir,
                quality_threshold=args.quality_threshold
            )
            
            # Print result
            print(json.dumps(result, indent=2))
            
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)