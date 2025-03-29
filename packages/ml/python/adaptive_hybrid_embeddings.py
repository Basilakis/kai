#!/usr/bin/env python3
"""
Adaptive Hybrid Embedding System

This module provides an adaptive embedding generation system that dynamically
selects the optimal embedding method based on quality evaluation.

It extends the existing embedding generator with real-time quality assessment
and method switching capabilities.
"""

import os
import sys
import json
import numpy as np
import logging
import time
from typing import Dict, List, Any, Tuple, Optional, Union, Callable
from pathlib import Path
import threading
from datetime import datetime

# Import embedding generator components
from embedding_generator import (
    FeatureBasedEmbedding, 
    TensorFlowEmbedding, 
    PyTorchEmbedding, 
    HybridEmbedding,
    TF_AVAILABLE,
    TORCH_AVAILABLE
)

# Import quality evaluator
from embedding_quality_evaluator import (
    EmbeddingQualityEvaluator,
    evaluate_embedding_quality,
    quality_based_method_selector
)

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('adaptive_hybrid_embeddings')


class AdaptiveEmbeddingGenerator:
    """
    Adaptive embedding generator that dynamically selects the optimal method
    based on quality evaluation and material characteristics
    """
    
    def __init__(self, 
                reference_path: Optional[str] = None,
                cache_dir: Optional[str] = None,
                quality_threshold: float = 0.65,
                material_categories: Optional[Dict[str, str]] = None,
                model_path: Optional[str] = None,
                output_dimensions: int = 256,
                default_method: str = "hybrid"):
        """
        Initialize the adaptive embedding generator
        
        Args:
            reference_path: Optional path to reference embeddings
            cache_dir: Directory to cache quality scores and performance stats
            quality_threshold: Threshold below which to switch methods
            material_categories: Optional mapping of material IDs to categories
            model_path: Path to pre-trained model (for ML-based methods)
            output_dimensions: Dimensions of output embedding vectors
            default_method: Default embedding method to use initially
        """
        self.reference_path = reference_path
        self.cache_dir = cache_dir
        self.quality_threshold = quality_threshold
        self.material_categories = material_categories or {}
        self.model_path = model_path
        self.output_dimensions = output_dimensions
        self.default_method = default_method
        
        # Create cache directory if needed
        if self.cache_dir:
            os.makedirs(self.cache_dir, exist_ok=True)
        
        # Initialize embedding generators for each method
        self.embedding_generators = self._initialize_embedding_generators()
        
        # Initialize quality evaluator
        self.quality_evaluator = EmbeddingQualityEvaluator(
            reference_path=reference_path,
            quality_threshold=quality_threshold,
            material_categories=material_categories,
            cache_dir=cache_dir
        )
        
        # Performance tracking
        self.performance_stats: Dict[str, Dict[str, Any]] = {
            "method_switches": 0,
            "total_embeddings": 0,
            "method_usage": {"feature-based": 0, "ml-based": 0, "hybrid": 0},
            "average_quality": {"feature-based": 0, "ml-based": 0, "hybrid": 0},
            "material_performance": {},
            "time_performance": {"feature-based": [], "ml-based": [], "hybrid": []}
        }
        
        # Load cached performance data if available
        if self.cache_dir:
            self.quality_evaluator.load_performance_data()
            self._load_performance_stats()
        
        # Material-specific method mapping
        self.material_methods: Dict[str, str] = {}
        
        # Lock for thread safety
        self._lock = threading.RLock()
    
    def _initialize_embedding_generators(self) -> Dict[str, Any]:
        """
        Initialize embedding generators for each method
        
        Returns:
            Dictionary of embedding generators by method
        """
        generators = {}
        
        # Feature-based embedding generator
        generators["feature-based"] = FeatureBasedEmbedding(
            output_dimensions=self.output_dimensions
        )
        
        # ML-based embedding generator
        if TF_AVAILABLE:
            generators["ml-based"] = TensorFlowEmbedding(
                model_path=self.model_path,
                output_dimensions=self.output_dimensions
            )
        elif TORCH_AVAILABLE:
            generators["ml-based"] = PyTorchEmbedding(
                model_path=self.model_path,
                output_dimensions=self.output_dimensions
            )
        
        # Hybrid embedding generator
        generators["hybrid"] = HybridEmbedding(
            model_path=self.model_path,
            output_dimensions=self.output_dimensions
        )
        
        return generators
    
    def _load_performance_stats(self) -> None:
        """Load performance statistics from cache"""
        if not self.cache_dir:
            return
            
        stats_path = os.path.join(self.cache_dir, "adaptive_performance_stats.json")
        if os.path.exists(stats_path):
            try:
                with open(stats_path, "r") as f:
                    self.performance_stats = json.load(f)
                logger.info(f"Loaded performance stats from {stats_path}")
            except Exception as e:
                logger.error(f"Error loading performance stats: {e}")
    
    def _save_performance_stats(self) -> None:
        """Save performance statistics to cache"""
        if not self.cache_dir:
            return
            
        stats_path = os.path.join(self.cache_dir, "adaptive_performance_stats.json")
        try:
            with open(stats_path, "w") as f:
                json.dump(self.performance_stats, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving performance stats: {e}")
    
    def _update_performance_stats(self, 
                                method: str, 
                                material_id: Optional[str] = None,
                                quality: Optional[float] = None,
                                processing_time: Optional[float] = None) -> None:
        """
        Update performance statistics
        
        Args:
            method: Embedding method used
            material_id: Optional material ID
            quality: Optional quality score
            processing_time: Optional processing time
        """
        with self._lock:
            # Update method usage
            if method in self.performance_stats["method_usage"]:
                self.performance_stats["method_usage"][method] += 1
            
            # Update total embeddings
            self.performance_stats["total_embeddings"] += 1
            
            # Update average quality
            if quality is not None and method in self.performance_stats["average_quality"]:
                current_avg = self.performance_stats["average_quality"][method]
                current_count = self.performance_stats["method_usage"][method]
                
                if current_count > 1:
                    # Incremental average update
                    new_avg = current_avg + ((quality - current_avg) / current_count)
                else:
                    new_avg = quality
                
                self.performance_stats["average_quality"][method] = new_avg
            
            # Update time performance
            if processing_time is not None and method in self.performance_stats["time_performance"]:
                self.performance_stats["time_performance"][method].append(processing_time)
                
                # Keep only the last 100 measurements
                if len(self.performance_stats["time_performance"][method]) > 100:
                    self.performance_stats["time_performance"][method] = \
                        self.performance_stats["time_performance"][method][-100:]
            
            # Update material-specific performance
            if material_id is not None:
                if material_id not in self.performance_stats["material_performance"]:
                    self.performance_stats["material_performance"][material_id] = {
                        "methods": {},
                        "preferred_method": None,
                        "quality_history": []
                    }
                
                material_stats = self.performance_stats["material_performance"][material_id]
                
                # Update method statistics
                if method not in material_stats["methods"]:
                    material_stats["methods"][method] = {
                        "count": 1,
                        "quality": quality if quality is not None else 0.0,
                        "processing_time": processing_time if processing_time is not None else 0.0
                    }
                else:
                    material_stats["methods"][method]["count"] += 1
                    
                    if quality is not None:
                        current_quality = material_stats["methods"][method]["quality"]
                        current_count = material_stats["methods"][method]["count"]
                        
                        # Exponential moving average (favor recent scores)
                        alpha = 0.3  # Weight for new value
                        new_quality = (alpha * quality) + ((1 - alpha) * current_quality)
                        material_stats["methods"][method]["quality"] = new_quality
                    
                    if processing_time is not None:
                        current_time = material_stats["methods"][method]["processing_time"]
                        current_count = material_stats["methods"][method]["count"]
                        
                        # Exponential moving average (favor recent times)
                        alpha = 0.3  # Weight for new value
                        new_time = (alpha * processing_time) + ((1 - alpha) * current_time)
                        material_stats["methods"][method]["processing_time"] = new_time
                
                # Update quality history
                if quality is not None:
                    material_stats["quality_history"].append({
                        "method": method,
                        "quality": quality,
                        "timestamp": datetime.now().isoformat()
                    })
                    
                    # Keep only the last 10 quality scores
                    if len(material_stats["quality_history"]) > 10:
                        material_stats["quality_history"] = material_stats["quality_history"][-10:]
                
                # Determine preferred method based on quality
                if material_stats["methods"]:
                    # Find method with highest quality
                    best_method = max(
                        material_stats["methods"].items(),
                        key=lambda x: x[1]["quality"]
                    )[0]
                    
                    material_stats["preferred_method"] = best_method
            
            # Periodically save stats
            if self.performance_stats["total_embeddings"] % 10 == 0:
                self._save_performance_stats()
    
    def get_generator_for_method(self, method: str):
        """
        Get the appropriate embedding generator for a method
        
        Args:
            method: Embedding method
            
        Returns:
            Embedding generator
        """
        if method not in self.embedding_generators:
            if method == "ml-based" and not TF_AVAILABLE and not TORCH_AVAILABLE:
                logger.warning("ML-based embedding requested but not available, falling back to feature-based")
                return self.embedding_generators["feature-based"]
            else:
                logger.warning(f"Unknown method {method}, falling back to hybrid")
                return self.embedding_generators["hybrid"]
        
        return self.embedding_generators[method]
    
    def generate_embedding(self, 
                          image: np.ndarray, 
                          material_id: Optional[str] = None,
                          method: Optional[str] = None,
                          adaptive: bool = True) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Generate embedding for an image with adaptive method selection
        
        Args:
            image: Input image
            material_id: Optional material ID for context
            method: Optional method to use (adaptive will reevaluate)
            adaptive: Whether to adaptively select the method
            
        Returns:
            Tuple of (embedding vector, generation info)
        """
        with self._lock:
            start_time = time.time()
            info = {
                "material_id": material_id,
                "initial_method": method,
                "quality_scores": {},
                "method_switches": 0,
                "final_method": method,
                "processing_time": 0.0
            }
            
            # Determine initial method
            if method is None:
                if material_id and material_id in self.material_methods:
                    # Use previously determined method for this material
                    method = self.material_methods[material_id]
                else:
                    # Use default method
                    method = self.default_method
            
            info["initial_method"] = method
            
            # Get generator for the method
            generator = self.get_generator_for_method(method)
            
            # Generate initial embedding
            if generator:
                try:
                    embedding = generator.generate_embedding(image)
                    
                    # Calculate generation time
                    processing_time = time.time() - start_time
                    info["processing_time"] = processing_time
                    
                    # If not adaptive, return the result immediately
                    if not adaptive:
                        info["final_method"] = method
                        self._update_performance_stats(
                            method=method,
                            material_id=material_id,
                            processing_time=processing_time
                        )
                        return embedding, info
                    
                    # Evaluate embedding quality
                    quality_scores = self.quality_evaluator.evaluate_quality(
                        embedding=embedding,
                        material_id=material_id,
                        method=method
                    )
                    
                    info["quality_scores"][method] = quality_scores
                    
                    # Check if quality is below threshold
                    if quality_scores["overall"] < self.quality_threshold:
                        available_methods = ["feature-based", "ml-based", "hybrid"]
                        if not TF_AVAILABLE and not TORCH_AVAILABLE:
                            available_methods.remove("ml-based")
                        
                        # Get recommendations from quality evaluator
                        recommended_method = self.quality_evaluator.recommend_method(
                            material_id=material_id,
                            current_method=method,
                            current_quality=quality_scores["overall"],
                            available_methods=available_methods
                        )
                        
                        # Switch methods if recommendation differs
                        if recommended_method != method:
                            # Get generator for recommended method
                            new_generator = self.get_generator_for_method(recommended_method)
                            
                            # Generate new embedding with recommended method
                            new_embedding = new_generator.generate_embedding(image)
                            
                            # Evaluate new embedding quality
                            new_quality_scores = self.quality_evaluator.evaluate_quality(
                                embedding=new_embedding,
                                material_id=material_id,
                                method=recommended_method
                            )
                            
                            info["quality_scores"][recommended_method] = new_quality_scores
                            
                            # If new quality is better, use the new embedding
                            if new_quality_scores["overall"] > quality_scores["overall"]:
                                logger.info(f"Switching from {method} to {recommended_method} for better quality " +
                                           f"({quality_scores['overall']:.2f} -> {new_quality_scores['overall']:.2f})")
                                
                                embedding = new_embedding
                                method = recommended_method
                                info["method_switches"] += 1
                                self.performance_stats["method_switches"] += 1
                                
                                # Update material-specific method preference
                                if material_id:
                                    self.material_methods[material_id] = method
                    
                    # Update final method
                    info["final_method"] = method
                    
                    # Update total processing time
                    info["processing_time"] = time.time() - start_time
                    
                    # Update performance statistics
                    self._update_performance_stats(
                        method=method,
                        material_id=material_id,
                        quality=info["quality_scores"][method]["overall"] if method in info["quality_scores"] else None,
                        processing_time=info["processing_time"]
                    )
                    
                    return embedding, info
                    
                except Exception as e:
                    logger.error(f"Error generating embedding with {method}: {e}")
                    
                    # Fallback to feature-based in case of error with other methods
                    if method != "feature-based":
                        logger.info(f"Falling back to feature-based embedding")
                        generator = self.get_generator_for_method("feature-based")
                        embedding = generator.generate_embedding(image)
                        method = "feature-based"
                        info["method_switches"] += 1
                        self.performance_stats["method_switches"] += 1
                        
                        # Update material-specific method preference
                        if material_id:
                            self.material_methods[material_id] = method
                        
                        # Update final method
                        info["final_method"] = method
                        
                        # Update total processing time
                        info["processing_time"] = time.time() - start_time
                        
                        return embedding, info
                    else:
                        # If feature-based also failed, raise the error
                        raise
            else:
                raise ValueError(f"No embedding generator available for method: {method}")
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """
        Get current performance statistics
        
        Returns:
            Dictionary of performance statistics
        """
        with self._lock:
            # Compute additional statistics
            stats = self.performance_stats.copy()
            
            # Add average processing times
            stats["average_time"] = {}
            for method, times in self.performance_stats["time_performance"].items():
                if times:
                    stats["average_time"][method] = sum(times) / len(times)
                else:
                    stats["average_time"][method] = 0.0
            
            # Add overall best method
            if self.performance_stats["average_quality"]:
                stats["overall_best_method"] = max(
                    self.performance_stats["average_quality"].items(),
                    key=lambda x: x[1]
                )[0]
            else:
                stats["overall_best_method"] = self.default_method
            
            # Add timestamp
            stats["timestamp"] = datetime.now().isoformat()
            
            return stats
    
    def clear_performance_cache(self) -> None:
        """Clear performance statistics cache"""
        with self._lock:
            # Reset performance stats
            self.performance_stats = {
                "method_switches": 0,
                "total_embeddings": 0,
                "method_usage": {"feature-based": 0, "ml-based": 0, "hybrid": 0},
                "average_quality": {"feature-based": 0, "ml-based": 0, "hybrid": 0},
                "material_performance": {},
                "time_performance": {"feature-based": [], "ml-based": [], "hybrid": []}
            }
            
            # Clear material method mapping
            self.material_methods = {}
            
            # Save empty stats to cache
            if self.cache_dir:
                self._save_performance_stats()


# Primary function for generating embeddings with adaptive selection
def generate_adaptive_embedding(image_path: str, 
                               material_id: Optional[str] = None,
                               method: Optional[str] = None,
                               reference_path: Optional[str] = None,
                               cache_dir: Optional[str] = None,
                               model_path: Optional[str] = None,
                               output_dimensions: int = 256,
                               quality_threshold: float = 0.65,
                               adaptive: bool = True) -> Dict[str, Any]:
    """
    Generate embedding for an image with adaptive method selection
    
    Args:
        image_path: Path to the image file
        material_id: Optional material ID for context
        method: Optional method to use (adaptive will reevaluate)
        reference_path: Optional path to reference embeddings
        cache_dir: Directory to cache quality scores and statistics
        model_path: Path to pre-trained model (for ML-based methods)
        output_dimensions: Dimensions of output embedding vector
        quality_threshold: Threshold below which to switch methods
        adaptive: Whether to adaptively select the method
        
    Returns:
        Dictionary with embedding vector and metadata
    """
    # Import here to avoid circular import
    from embedding_generator import load_image
    
    # Load image
    image = load_image(image_path)
    
    # Initialize adaptive generator
    generator = AdaptiveEmbeddingGenerator(
        reference_path=reference_path,
        cache_dir=cache_dir,
        quality_threshold=quality_threshold,
        model_path=model_path,
        output_dimensions=output_dimensions,
        default_method=method or "hybrid"
    )
    
    # Generate embedding
    embedding, info = generator.generate_embedding(
        image=image,
        material_id=material_id,
        method=method,
        adaptive=adaptive
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
        "adaptive": adaptive,
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
    
    return result


if __name__ == "__main__":
    # Example usage when script is run directly
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate adaptive embeddings")
    parser.add_argument("image_path", help="Path to the image file")
    parser.add_argument("--material-id", help="Material ID")
    parser.add_argument("--method", choices=["feature-based", "ml-based", "hybrid"], 
                        help="Initial embedding method")
    parser.add_argument("--reference-path", help="Path to reference embeddings")
    parser.add_argument("--cache-dir", help="Cache directory")
    parser.add_argument("--model-path", help="Path to pre-trained model")
    parser.add_argument("--output-dimensions", type=int, default=256,
                        help="Dimensions of output embedding vector")
    parser.add_argument("--quality-threshold", type=float, default=0.65,
                        help="Quality threshold for method switching")
    parser.add_argument("--no-adaptive", action="store_true",
                        help="Disable adaptive method selection")
    
    args = parser.parse_args()
    
    try:
        # Generate embedding
        result = generate_adaptive_embedding(
            image_path=args.image_path,
            material_id=args.material_id,
            method=args.method,
            reference_path=args.reference_path,
            cache_dir=args.cache_dir,
            model_path=args.model_path,
            output_dimensions=args.output_dimensions,
            quality_threshold=args.quality_threshold,
            adaptive=not args.no_adaptive
        )
        
        # Print result as JSON
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)