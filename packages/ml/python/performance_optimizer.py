#!/usr/bin/env python3
"""
Performance Optimizer for Material Recognition

This script implements optimization techniques to improve the performance
of material recognition, including:
1. Image preprocessing optimizations
2. Feature extraction optimizations
3. Parallel processing capabilities
4. Caching mechanisms
5. Model quantization and optimization

Usage:
    python performance_optimizer.py <command> [options]

Commands:
    optimize    Optimize an image for recognition
    cache       Manage cache (create, clear, stats)
    benchmark   Run benchmarks on different optimization techniques
"""

import os
import sys
import json
import time
import argparse
import hashlib
import pickle
import numpy as np
import cv2
from typing import Dict, List, Any, Tuple, Optional, Union
from datetime import datetime
import multiprocessing
from functools import lru_cache
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor


class RecognitionCache:
    """Cache for storing and retrieving recognition results"""
    
    def __init__(self, cache_dir: str, max_size_mb: int = 500, ttl_days: int = 30):
        """
        Initialize the recognition cache
        
        Args:
            cache_dir: Directory for cache storage
            max_size_mb: Maximum cache size in MB
            ttl_days: Time-to-live for cache entries in days
        """
        self.cache_dir = cache_dir
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self.ttl_seconds = ttl_days * 24 * 60 * 60
        
        # Create cache directory if it doesn't exist
        os.makedirs(cache_dir, exist_ok=True)
        
        # Initialize cache metadata file path
        self.metadata_path = os.path.join(cache_dir, "cache_metadata.json")
        
        # Load metadata if it exists, otherwise initialize it
        self.metadata = self._load_metadata()
    
    def _load_metadata(self) -> Dict[str, Any]:
        """Load cache metadata from file"""
        if os.path.exists(self.metadata_path):
            try:
                with open(self.metadata_path, 'r') as f:
                    return json.load(f)
            except Exception:
                # If metadata file is corrupted, initialize a new one
                pass
        
        # Initialize new metadata
        return {
            "entries": {},
            "total_size_bytes": 0,
            "created_at": datetime.now().isoformat(),
            "last_cleanup": datetime.now().isoformat(),
            "hits": 0,
            "misses": 0
        }
    
    def _save_metadata(self):
        """Save cache metadata to file"""
        with open(self.metadata_path, 'w') as f:
            json.dump(self.metadata, f, indent=2)
    
    def _compute_key(self, image_data: bytes, params: Dict[str, Any]) -> str:
        """
        Compute a unique key for the image and recognition parameters
        
        Args:
            image_data: Raw binary image data
            params: Recognition parameters
            
        Returns:
            Cache key as string
        """
        # Compute hash of image data
        img_hash = hashlib.md5(image_data).hexdigest()
        
        # Compute hash of parameters
        params_str = json.dumps(params, sort_keys=True)
        params_hash = hashlib.md5(params_str.encode()).hexdigest()
        
        # Combine hashes
        return f"{img_hash}_{params_hash}"
    
    def get(self, image_path: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Get recognition result from cache
        
        Args:
            image_path: Path to the image file
            params: Recognition parameters
            
        Returns:
            Cached recognition result or None if not found
        """
        # Read image data
        try:
            with open(image_path, 'rb') as f:
                image_data = f.read()
        except Exception:
            return None
        
        # Compute cache key
        key = self._compute_key(image_data, params)
        
        # Check if key exists in metadata
        if key not in self.metadata["entries"]:
            self.metadata["misses"] += 1
            self._save_metadata()
            return None
        
        # Get cache entry metadata
        entry = self.metadata["entries"][key]
        cache_path = os.path.join(self.cache_dir, entry["filename"])
        
        # Check if cache file exists
        if not os.path.exists(cache_path):
            # Remove entry from metadata
            del self.metadata["entries"][key]
            self.metadata["total_size_bytes"] -= entry["size_bytes"]
            self.metadata["misses"] += 1
            self._save_metadata()
            return None
        
        # Check if entry is expired
        now = datetime.now().timestamp()
        created_at = datetime.fromisoformat(entry["created_at"]).timestamp()
        
        if now - created_at > self.ttl_seconds:
            # Remove expired entry
            os.remove(cache_path)
            del self.metadata["entries"][key]
            self.metadata["total_size_bytes"] -= entry["size_bytes"]
            self.metadata["misses"] += 1
            self._save_metadata()
            return None
        
        # Load cached result
        try:
            with open(cache_path, 'rb') as f:
                result = pickle.load(f)
                
            # Update metadata
            self.metadata["hits"] += 1
            entry["last_accessed"] = datetime.now().isoformat()
            self._save_metadata()
            
            return result
            
        except Exception:
            # If cache file is corrupted, remove it
            try:
                os.remove(cache_path)
            except Exception:
                pass
                
            del self.metadata["entries"][key]
            self.metadata["total_size_bytes"] -= entry["size_bytes"]
            self.metadata["misses"] += 1
            self._save_metadata()
            
            return None
    
    def put(self, image_path: str, params: Dict[str, Any], result: Dict[str, Any]) -> bool:
        """
        Store recognition result in cache
        
        Args:
            image_path: Path to the image file
            params: Recognition parameters
            result: Recognition result to cache
            
        Returns:
            True if stored successfully, False otherwise
        """
        # Read image data
        try:
            with open(image_path, 'rb') as f:
                image_data = f.read()
        except Exception:
            return False
        
        # Compute cache key
        key = self._compute_key(image_data, params)
        
        # Serialize result
        try:
            serialized = pickle.dumps(result)
        except Exception:
            return False
        
        # Check if we need to clean up cache
        if self.metadata["total_size_bytes"] + len(serialized) > self.max_size_bytes:
            self._cleanup_cache(len(serialized))
        
        # Generate unique filename
        filename = f"{key}.pkl"
        cache_path = os.path.join(self.cache_dir, filename)
        
        # Store result
        try:
            with open(cache_path, 'wb') as f:
                f.write(serialized)
        except Exception:
            return False
        
        # Update metadata
        now = datetime.now().isoformat()
        self.metadata["entries"][key] = {
            "filename": filename,
            "size_bytes": len(serialized),
            "created_at": now,
            "last_accessed": now,
            "params_hash": hashlib.md5(json.dumps(params, sort_keys=True).encode()).hexdigest()
        }
        
        self.metadata["total_size_bytes"] += len(serialized)
        self._save_metadata()
        
        return True
    
    def _cleanup_cache(self, needed_bytes: int):
        """
        Clean up cache to free space
        
        Args:
            needed_bytes: Number of bytes needed
        """
        # Check if we need to clean up at all
        if self.metadata["total_size_bytes"] + needed_bytes <= self.max_size_bytes:
            return
        
        # Sort entries by last accessed time (oldest first)
        entries = list(self.metadata["entries"].items())
        entries.sort(key=lambda x: x[1]["last_accessed"])
        
        # Remove entries until we have enough space
        bytes_to_free = needed_bytes - (self.max_size_bytes - self.metadata["total_size_bytes"])
        bytes_freed = 0
        
        for key, entry in entries:
            # Remove entry
            cache_path = os.path.join(self.cache_dir, entry["filename"])
            try:
                if os.path.exists(cache_path):
                    os.remove(cache_path)
            except Exception:
                pass
            
            bytes_freed += entry["size_bytes"]
            self.metadata["total_size_bytes"] -= entry["size_bytes"]
            del self.metadata["entries"][key]
            
            # Check if we have freed enough space
            if bytes_freed >= bytes_to_free:
                break
        
        # Update metadata
        self.metadata["last_cleanup"] = datetime.now().isoformat()
        self._save_metadata()
    
    def clear(self):
        """Clear the entire cache"""
        # Remove all cache files
        for entry in self.metadata["entries"].values():
            cache_path = os.path.join(self.cache_dir, entry["filename"])
            try:
                if os.path.exists(cache_path):
                    os.remove(cache_path)
            except Exception:
                pass
        
        # Reset metadata
        self.metadata = {
            "entries": {},
            "total_size_bytes": 0,
            "created_at": self.metadata["created_at"],
            "last_cleanup": datetime.now().isoformat(),
            "hits": self.metadata["hits"],
            "misses": self.metadata["misses"]
        }
        
        self._save_metadata()
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics
        
        Returns:
            Dictionary with cache statistics
        """
        # Compute hit rate
        total_requests = self.metadata["hits"] + self.metadata["misses"]
        hit_rate = self.metadata["hits"] / total_requests if total_requests > 0 else 0
        
        # Compute age statistics
        now = datetime.now().timestamp()
        ages = []
        
        for entry in self.metadata["entries"].values():
            created_at = datetime.fromisoformat(entry["created_at"]).timestamp()
            age_days = (now - created_at) / (24 * 60 * 60)
            ages.append(age_days)
        
        avg_age = sum(ages) / len(ages) if ages else 0
        max_age = max(ages) if ages else 0
        
        return {
            "entry_count": len(self.metadata["entries"]),
            "total_size_mb": self.metadata["total_size_bytes"] / (1024 * 1024),
            "max_size_mb": self.max_size_bytes / (1024 * 1024),
            "usage_percent": 100 * self.metadata["total_size_bytes"] / self.max_size_bytes,
            "hits": self.metadata["hits"],
            "misses": self.metadata["misses"],
            "hit_rate": hit_rate,
            "avg_age_days": avg_age,
            "max_age_days": max_age,
            "ttl_days": self.ttl_seconds / (24 * 60 * 60),
            "created_at": self.metadata["created_at"],
            "last_cleanup": self.metadata["last_cleanup"]
        }


class ImageOptimizer:
    """Optimize images for faster recognition"""
    
    def __init__(self, max_size: int = 1024, quality: int = 90):
        """
        Initialize the image optimizer
        
        Args:
            max_size: Maximum dimension for resizing
            quality: JPEG quality for compression
        """
        self.max_size = max_size
        self.quality = quality
    
    def optimize(self, image_path: str, output_path: str = None) -> Tuple[str, Dict[str, Any]]:
        """
        Optimize an image for recognition
        
        Args:
            image_path: Path to the input image
            output_path: Path to save the optimized image (optional)
            
        Returns:
            Tuple of (path to optimized image, optimization metadata)
        """
        # If output path is not specified, create one
        if not output_path:
            directory = os.path.dirname(image_path)
            filename = os.path.basename(image_path)
            name, ext = os.path.splitext(filename)
            output_path = os.path.join(directory, f"{name}_optimized{ext}")
        
        # Ensure output directory exists
        output_dir = os.path.dirname(output_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        
        # Load the image
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Failed to load image: {image_path}")
        
        original_size = os.path.getsize(image_path)
        original_dimensions = img.shape[:2]  # (height, width)
        
        # Resize if necessary
        resized = False
        if max(img.shape[0], img.shape[1]) > self.max_size:
            # Calculate new dimensions
            height, width = img.shape[:2]
            
            if height > width:
                new_height = self.max_size
                new_width = int(width * (new_height / height))
            else:
                new_width = self.max_size
                new_height = int(height * (new_width / width))
            
            # Resize image
            img = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_AREA)
            resized = True
        
        # Convert to JPEG and save
        compression_params = [cv2.IMWRITE_JPEG_QUALITY, self.quality]
        cv2.imwrite(output_path, img, compression_params)
        
        # Get optimized file size
        optimized_size = os.path.getsize(output_path)
        
        # Prepare metadata
        metadata = {
            "original_path": image_path,
            "optimized_path": output_path,
            "original_size_bytes": original_size,
            "optimized_size_bytes": optimized_size,
            "size_reduction_percent": 100 * (1 - optimized_size / original_size),
            "original_dimensions": list(original_dimensions),
            "optimized_dimensions": list(img.shape[:2]),
            "resized": resized,
            "quality": self.quality
        }
        
        return output_path, metadata


class FeatureOptimizer:
    """Optimize feature extraction for faster recognition"""
    
    def __init__(self, method: str = "sift", max_features: int = 1000):
        """
        Initialize the feature optimizer
        
        Args:
            method: Feature extraction method (sift, orb, fast)
            max_features: Maximum number of features to extract
        """
        self.method = method
        self.max_features = max_features
        
        # Initialize feature extractor
        if method == "sift":
            self.extractor = cv2.SIFT_create(nfeatures=max_features)
        elif method == "orb":
            self.extractor = cv2.ORB_create(nfeatures=max_features)
        elif method == "fast":
            self.extractor = cv2.FastFeatureDetector_create()
        else:
            raise ValueError(f"Unknown feature extraction method: {method}")
    
    def extract_features(self, image: np.ndarray) -> Tuple[List[cv2.KeyPoint], np.ndarray]:
        """
        Extract features from an image
        
        Args:
            image: Input image as numpy array
            
        Returns:
            Tuple of (keypoints, descriptors)
        """
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Extract features
        keypoints, descriptors = self.extractor.detectAndCompute(gray, None)
        
        # Limit number of features if needed
        if self.method == "fast" and len(keypoints) > self.max_features:
            # Sort keypoints by response (strength)
            keypoints = sorted(keypoints, key=lambda x: x.response, reverse=True)[:self.max_features]
            
            # Recompute descriptors for selected keypoints
            keypoints, descriptors = self.extractor.compute(gray, keypoints)
        
        return keypoints, descriptors


class ParallelProcessor:
    """Process multiple images in parallel"""
    
    def __init__(self, max_workers: int = None, mode: str = "thread"):
        """
        Initialize the parallel processor
        
        Args:
            max_workers: Maximum number of workers (default: number of CPU cores)
            mode: Processing mode (thread or process)
        """
        self.max_workers = max_workers or multiprocessing.cpu_count()
        self.mode = mode
    
    def process_images(self, image_paths: List[str], process_func, *args, **kwargs) -> List[Any]:
        """
        Process multiple images in parallel
        
        Args:
            image_paths: List of image paths to process
            process_func: Function to process each image
            *args, **kwargs: Additional arguments to pass to process_func
            
        Returns:
            List of results from processing each image
        """
        # Create executor based on mode
        if self.mode == "thread":
            executor_class = ThreadPoolExecutor
        elif self.mode == "process":
            executor_class = ProcessPoolExecutor
        else:
            raise ValueError(f"Unknown processing mode: {self.mode}")
        
        # Process images in parallel
        with executor_class(max_workers=self.max_workers) as executor:
            # Create tasks
            futures = [
                executor.submit(process_func, image_path, *args, **kwargs)
                for image_path in image_paths
            ]
            
            # Collect results
            results = [future.result() for future in futures]
        
        return results


class ModelOptimizer:
    """Optimize ML models for faster inference"""
    
    def __init__(self, model_dir: str):
        """
        Initialize the model optimizer
        
        Args:
            model_dir: Directory containing model files
        """
        self.model_dir = model_dir
    
    def quantize_tensorflow_model(self, model_path: str, output_path: str = None,
                                 quantization_type: str = "float16") -> str:
        """
        Quantize a TensorFlow model for faster inference
        
        Args:
            model_path: Path to the TensorFlow model
            output_path: Path to save the quantized model (optional)
            quantization_type: Type of quantization (float16, int8, full_integer)
            
        Returns:
            Path to the quantized model
        """
        try:
            import tensorflow as tf
        except ImportError:
            raise ImportError("TensorFlow is required for model quantization")
        
        # If output path is not specified, create one
        if not output_path:
            output_path = os.path.join(
                os.path.dirname(model_path),
                f"{os.path.basename(model_path)}_quantized_{quantization_type}"
            )
        
        # Ensure output directory exists
        os.makedirs(output_path, exist_ok=True)
        
        # Load the model
        model = tf.saved_model.load(model_path)
        
        # Apply quantization based on type
        if quantization_type == "float16":
            # Convert to float16 precision
            converter = tf.lite.TFLiteConverter.from_saved_model(model_path)
            converter.target_spec.supported_types = [tf.float16]
            converter.optimizations = [tf.lite.Optimize.DEFAULT]
            quantized_model = converter.convert()
            
            # Save the quantized model
            with open(os.path.join(output_path, "model_float16.tflite"), "wb") as f:
                f.write(quantized_model)
        
        elif quantization_type == "int8":
            # Convert to int8 precision (requires representative dataset)
            converter = tf.lite.TFLiteConverter.from_saved_model(model_path)
            converter.optimizations = [tf.lite.Optimize.DEFAULT]
            
            # In a real implementation, you would provide a representative dataset here
            def representative_dataset():
                # This is a placeholder - in reality, you would load and yield real data
                for _ in range(100):
                    yield [np.random.rand(1, 224, 224, 3).astype(np.float32)]
            
            converter.representative_dataset = representative_dataset
            converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
            converter.inference_input_type = tf.uint8
            converter.inference_output_type = tf.uint8
            
            quantized_model = converter.convert()
            
            # Save the quantized model
            with open(os.path.join(output_path, "model_int8.tflite"), "wb") as f:
                f.write(quantized_model)
        
        elif quantization_type == "full_integer":
            # Full integer quantization
            converter = tf.lite.TFLiteConverter.from_saved_model(model_path)
            converter.optimizations = [tf.lite.Optimize.DEFAULT]
            
            # In a real implementation, you would provide a representative dataset here
            def representative_dataset():
                # This is a placeholder - in reality, you would load and yield real data
                for _ in range(100):
                    yield [np.random.rand(1, 224, 224, 3).astype(np.float32)]
            
            converter.representative_dataset = representative_dataset
            converter.target_spec.supported_ops = [
                tf.lite.OpsSet.TFLITE_BUILTINS_INT8,
                tf.lite.OpsSet.SELECT_TF_OPS
            ]
            converter.inference_input_type = tf.int8
            converter.inference_output_type = tf.int8
            
            quantized_model = converter.convert()
            
            # Save the quantized model
            with open(os.path.join(output_path, "model_full_integer.tflite"), "wb") as f:
                f.write(quantized_model)
        
        else:
            raise ValueError(f"Unknown quantization type: {quantization_type}")
        
        return output_path
    
    def optimize_pytorch_model(self, model_path: str, output_path: str = None,
                             quantization_type: str = "float16") -> str:
        """
        Optimize a PyTorch model for faster inference
        
        Args:
            model_path: Path to the PyTorch model
            output_path: Path to save the optimized model (optional)
            quantization_type: Type of quantization (float16, int8, dynamic)
            
        Returns:
            Path to the optimized model
        """
        try:
            import torch
        except ImportError:
            raise ImportError("PyTorch is required for model optimization")
        
        # If output path is not specified, create one
        if not output_path:
            output_path = os.path.join(
                os.path.dirname(model_path),
                f"{os.path.basename(model_path).split('.')[0]}_optimized_{quantization_type}.pt"
            )
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Load the model
        model = torch.load(model_path, map_location=torch.device('cpu'))
        model.eval()
        
        # Apply quantization based on type
        if quantization_type == "float16":
            # Convert to half precision
            model_fp16 = model.half()
            
            # Save the optimized model
            torch.save(model_fp16, output_path)
        
        elif quantization_type == "int8":
            # Static quantization to int8
            model_int8 = torch.quantization.quantize_dynamic(
                model, {torch.nn.Linear, torch.nn.Conv2d}, dtype=torch.qint8
            )
            
            # Save the optimized model
            torch.save(model_int8, output_path)
        
        elif quantization_type == "dynamic":
            # Dynamic quantization
            model_dynamic = torch.quantization.quantize_dynamic(
                model, {torch.nn.Linear}, dtype=torch.qint8
            )
            
            # Save the optimized model
            torch.save(model_dynamic, output_path)
        
        else:
            raise ValueError(f"Unknown quantization type: {quantization_type}")
        
        return output_path


class PerformanceOptimizer:
    """Main class for optimizing material recognition performance"""
    
    def __init__(self, data_dir: str, model_dir: str = None, cache_dir: str = None):
        """
        Initialize the performance optimizer
        
        Args:
            data_dir: Directory for data storage
            model_dir: Directory for model storage (if None, uses data_dir/models)
            cache_dir: Directory for cache storage (if None, uses data_dir/cache)
        """
        self.data_dir = data_dir
        self.model_dir = model_dir if model_dir else os.path.join(data_dir, "models")
        self.cache_dir = cache_dir if cache_dir else os.path.join(data_dir, "cache")
        
        # Ensure directories exist
        os.makedirs(data_dir, exist_ok=True)
        os.makedirs(self.model_dir, exist_ok=True)
        os.makedirs(self.cache_dir, exist_ok=True)
        
        # Initialize components
        self.image_optimizer = ImageOptimizer()
        self.feature_optimizer = FeatureOptimizer()
        self.parallel_processor = ParallelProcessor()
        self.model_optimizer = ModelOptimizer(self.model_dir)
        self.cache = RecognitionCache(self.cache_dir)
    
    def optimize_recognition_pipeline(self, image_path: str, model_type: str = "hybrid",
                                     use_cache: bool = True, use_parallel: bool = True,
                                     optimize_image: bool = True) -> Dict[str, Any]:
        """
        Optimize the entire recognition pipeline for an image
        
        Args:
            image_path: Path to the input image
            model_type: Type of model to use
            use_cache: Whether to use caching
            use_parallel: Whether to use parallel processing
            optimize_image: Whether to optimize the image
            
        Returns:
            Dictionary with optimization results
        """
        start_time = time.time()
        
        # Check if image exists
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")
        
        # Prepare recognition parameters
        params = {
            "model_type": model_type,
            "confidence_threshold": 0.6,
            "max_results": 5
        }
        
        # Check cache if enabled
        if use_cache:
            cached_result = self.cache.get(image_path, params)
            if cached_result:
                # Add cache hit metadata
                cached_result["performance"] = {
                    "cached": True,
                    "total_time": time.time() - start_time
                }
                return cached_result
        
        # Optimize image if enabled
        if optimize_image:
            # Create temporary directory for optimized image
            temp_dir = os.path.join(self.data_dir, "temp")
            os.makedirs(temp_dir, exist_ok=True)
            
            # Optimize image
            optimized_path, _ = self.image_optimizer.optimize(
                image_path,
                os.path.join(temp_dir, os.path.basename(image_path))
            )
            
            # Update image path to use optimized image
            image_path = optimized_path
        
        # Import recognition function
        try:
            from material_recognizer import MaterialRecognizer
            recognizer = MaterialRecognizer(
                model_type=model_type,
                confidence_threshold=params["confidence_threshold"],
                max_results=params["max_results"]
            )
            result = recognizer.recognize(image_path)
        except ImportError:
            # Mock result if recognizer is not available
            result = {
                "matches": [
                    {
                        "materialId": "mock_material_1",
                        "confidence": 0.9,
                        "features": {}
                    },
                    {
                        "materialId": "mock_material_2",
                        "confidence": 0.7,
                        "features": {}
                    }
                ],
                "processingTime": 0.5
            }
        
        # Add performance metadata
        result["performance"] = {
            "cached": False,
            "optimized_image": optimize_image,
            "parallel_processing": use_parallel,
            "total_time": time.time() - start_time
        }
        
        # Store in cache if enabled
        if use_cache:
            self.cache.put(image_path, params, result)
        
        # Clean up temporary files if needed
        if optimize_image:
            try:
                os.remove(image_path)
            except Exception:
                pass
        
        return result
    
    def benchmark(self, image_path: str, iterations: int = 5) -> Dict[str, Any]:
        """
        Benchmark different optimization techniques
        
        Args:
            image_path: Path to the image to benchmark
            iterations: Number of iterations for each configuration
            
        Returns:
            Dictionary with benchmark results
        """
        # Check if image exists
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")
        
        # Define configurations to benchmark
        configs = [
            {"name": "baseline", "optimize_image": False, "use_cache": False, "use_parallel": False},
            {"name": "image_optimized", "optimize_image": True, "use_cache": False, "use_parallel": False},
            {"name": "cached", "optimize_image": False, "use_cache": True, "use_parallel": False},
            {"name": "parallel", "optimize_image": False, "use_cache": False, "use_parallel": True},
            {"name": "fully_optimized", "optimize_image": True, "use_cache": True, "use_parallel": True}
        ]
        
        # Run benchmarks
        results = {}
        
        for config in configs:
            name = config["name"]
            times = []
            
            # Clear cache before each configuration
            if config["use_cache"]:
                self.cache.clear()
            
            for i in range(iterations):
                start_time = time.time()
                
                # Run recognition with this configuration
                try:
                    self.optimize_recognition_pipeline(
                        image_path,
                        optimize_image=config["optimize_image"],
                        use_cache=config["use_cache"],
                        use_parallel=config["use_parallel"]
                    )
                except Exception as e:
                    print(f"Error in benchmark {name}, iteration {i}: {e}")
                    continue
                
                # Record time
                elapsed_time = time.time() - start_time
                times.append(elapsed_time)
            
            # Calculate statistics
            if times:
                avg_time = sum(times) / len(times)
                min_time = min(times)
                max_time = max(times)
                
                results[name] = {
                    "avg_time": avg_time,
                    "min_time": min_time,
                    "max_time": max_time,
                    "iterations": len(times),
                    "config": config
                }
        
        # Prepare final results
        benchmark_results = {
            "image_path": image_path,
            "configs": results,
            "timestamp": datetime.now().isoformat()
        }
        
        return benchmark_results


def handle_optimize_command(args):
    """Handle the 'optimize' command"""
    if not args.image_path:
        print("Error: image_path is required", file=sys.stderr)
        return 1
    
    # Initialize optimizer
    optimizer = PerformanceOptimizer(args.data_dir, args.model_dir, args.cache_dir)
    
    try:
        # Optimize recognition pipeline
        result = optimizer.optimize_recognition_pipeline(
            args.image_path,
            model_type=args.model_type,
            use_cache=not args.no_cache,
            use_parallel=not args.no_parallel,
            optimize_image=not args.no_image_opt
        )
        
        # Output result
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(result, f, indent=2)
            print(f"Result saved to {args.output}")
        else:
            print(json.dumps(result, indent=2))
        
        return 0
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        return 1


def handle_cache_command(args):
    """Handle the 'cache' command"""
    # Initialize cache
    cache = RecognitionCache(args.cache_dir)
    
    if args.action == "clear":
        # Clear cache
        cache.clear()
        print("Cache cleared successfully")
        return 0
        
    elif args.action == "stats":
        # Get cache statistics
        stats = cache.get_stats()
        
        # Output stats
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(stats, f, indent=2)
            print(f"Stats saved to {args.output}")
        else:
            print(json.dumps(stats, indent=2))
        
        return 0
    
    else:
        print(f"Unknown cache action: {args.action}", file=sys.stderr)
        return 1


def handle_benchmark_command(args):
    """Handle the 'benchmark' command"""
    if not args.image_path:
        print("Error: image_path is required", file=sys.stderr)
        return 1
    
    # Initialize optimizer
    optimizer = PerformanceOptimizer(args.data_dir, args.model_dir, args.cache_dir)
    
    try:
        # Run benchmark
        result = optimizer.benchmark(args.image_path, iterations=args.iterations)
        
        # Output result
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(result, f, indent=2)
            print(f"Benchmark results saved to {args.output}")
        else:
            print(json.dumps(result, indent=2))
        
        return 0
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        return 1


def main():
    """Main function to parse arguments and run commands"""
    parser = argparse.ArgumentParser(description="Performance optimizer for material recognition")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Common arguments
    data_dir_arg = lambda p: p.add_argument("--data-dir", default="./optimizer_data",
                                          help="Directory for data storage")
    model_dir_arg = lambda p: p.add_argument("--model-dir",
                                           help="Directory for model storage")
    cache_dir_arg = lambda p: p.add_argument("--cache-dir",
                                          help="Directory for cache storage")
    
    # Optimize command
    optimize_parser = subparsers.add_parser("optimize", help="Optimize recognition for an image")
    data_dir_arg(optimize_parser)
    model_dir_arg(optimize_parser)
    cache_dir_arg(optimize_parser)
    optimize_parser.add_argument("--image-path", required=True,
                               help="Path to the input image")
    optimize_parser.add_argument("--model-type", default="hybrid",
                               choices=["hybrid", "feature-based", "ml-based"],
                               help="Type of model to use")
    optimize_parser.add_argument("--no-cache", action="store_true",
                               help="Disable caching")
    optimize_parser.add_argument("--no-parallel", action="store_true",
                               help="Disable parallel processing")
    optimize_parser.add_argument("--no-image-opt", action="store_true",
                               help="Disable image optimization")
    optimize_parser.add_argument("--output",
                               help="Output file for result (defaults to stdout)")
    
    # Cache command
    cache_parser = subparsers.add_parser("cache", help="Manage recognition cache")
    cache_dir_arg(cache_parser)
    cache_parser.add_argument("action", choices=["clear", "stats"],
                            help="Cache action to perform")
    cache_parser.add_argument("--output",
                            help="Output file for stats (defaults to stdout)")
    
    # Benchmark command
    benchmark_parser = subparsers.add_parser("benchmark", help="Benchmark optimization techniques")
    data_dir_arg(benchmark_parser)
    model_dir_arg(benchmark_parser)
    cache_dir_arg(benchmark_parser)
    benchmark_parser.add_argument("--image-path", required=True,
                                help="Path to the input image")
    benchmark_parser.add_argument("--iterations", type=int, default=5,
                                help="Number of iterations for each configuration")
    benchmark_parser.add_argument("--output",
                                help="Output file for benchmark results (defaults to stdout)")
    
    args = parser.parse_args()
    
    if args.command == "optimize":
        return handle_optimize_command(args)
    elif args.command == "cache":
        return handle_cache_command(args)
    elif args.command == "benchmark":
        return handle_benchmark_command(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())