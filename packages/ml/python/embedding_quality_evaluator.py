#!/usr/bin/env python3
"""
Embedding Quality Evaluator

This module provides functionality to evaluate the quality of embeddings and
determine when to switch between different embedding generation methods.

It implements multiple quality metrics and evaluation strategies to 
dynamically adapt embedding generation based on observed quality.
"""

import os
import numpy as np
import json
import time
import logging
from typing import Dict, List, Any, Tuple, Optional, Union, Callable
from pathlib import Path
import threading
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('embedding_quality_evaluator')


class EmbeddingQualityMetrics:
    """
    Implements various metrics to evaluate embedding quality
    """
    
    @staticmethod
    def vector_coherence(embedding: np.ndarray) -> float:
        """
        Measures the internal coherence of a vector
        Higher values indicate more structured embeddings
        
        Args:
            embedding: The embedding vector to evaluate
            
        Returns:
            Coherence score between 0 and 1
        """
        if embedding is None or embedding.size == 0:
            return 0.0
            
        # Normalize the vector if it's not already
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
            
        # Measure standard deviation of vector components
        # More even distribution = higher quality 
        std_dev = np.std(embedding)
        
        # Calculate entropy as a measure of information content
        # Add small epsilon to avoid log(0)
        eps = 1e-10
        abs_vals = np.abs(embedding) + eps
        normalized = abs_vals / np.sum(abs_vals)
        entropy = -np.sum(normalized * np.log2(normalized))
        max_entropy = np.log2(embedding.size)
        
        # Normalize entropy to [0, 1]
        norm_entropy = entropy / max_entropy if max_entropy > 0 else 0
        
        # Combined score: we want moderate std_dev (not too uniform, not too sparse)
        # and high entropy (more information)
        optimal_std = 0.3  # This is a heuristic value that can be tuned
        std_score = 1.0 - abs(std_dev - optimal_std) * 2  # Penalize deviation from optimal
        std_score = max(0, min(1, std_score))  # Clamp to [0, 1]
        
        # Final coherence score is weighted combination
        coherence = 0.4 * std_score + 0.6 * norm_entropy
        
        return coherence
    
    @staticmethod
    def discrimination_power(embedding: np.ndarray, reference_embeddings: Optional[Dict[str, np.ndarray]] = None) -> float:
        """
        Evaluates how well an embedding can discriminate between different materials
        
        Args:
            embedding: The embedding vector to evaluate
            reference_embeddings: Optional dictionary of reference embeddings by category
            
        Returns:
            Discrimination score between 0 and 1
        """
        if embedding is None or embedding.size == 0:
            return 0.0
            
        if reference_embeddings is None or len(reference_embeddings) < 2:
            # Without references, estimate based on vector properties
            # Well-distributed vectors typically have better discrimination
            
            # Calculate coefficient of variation (normalized spread)
            mean = np.mean(np.abs(embedding))
            std = np.std(np.abs(embedding))
            
            if mean > 0:
                cv = std / mean
                # Moderate CV (not too uniform, not too random) is better
                optimal_cv = 0.7  # This is a heuristic value that can be tuned
                cv_score = 1.0 - abs(cv - optimal_cv)
                return max(0, min(1, cv_score))
            else:
                return 0.0
        
        # With reference embeddings, measure separation between categories
        distances = {}
        for category, refs in reference_embeddings.items():
            if not isinstance(refs, list):
                refs = [refs]
                
            # Calculate average distance to this category
            category_distances = []
            for ref in refs:
                # Ensure vectors are normalized
                norm_embedding = embedding / np.linalg.norm(embedding)
                norm_ref = ref / np.linalg.norm(ref)
                
                # Calculate cosine distance (1 - cosine similarity)
                distance = 1.0 - np.dot(norm_embedding, norm_ref)
                category_distances.append(distance)
                
            if category_distances:
                distances[category] = np.mean(category_distances)
        
        if not distances:
            return 0.5  # Default middle score if no distances computed
        
        # Calculate discrimination power based on distance variance
        # High variance means some categories are close and others far (good discrimination)
        distance_values = list(distances.values())
        variance = np.var(distance_values)
        
        # Scale variance to a reasonable range (empirically determined)
        scaled_variance = min(1.0, variance * 10)
        
        return scaled_variance

    @staticmethod
    def anomaly_detection(embedding: np.ndarray, reference_distribution: Optional[Dict[str, Any]] = None) -> float:
        """
        Detects if an embedding is anomalous compared to expected patterns
        
        Args:
            embedding: The embedding vector to evaluate
            reference_distribution: Optional reference distribution statistics
            
        Returns:
            Normalcy score between 0 and 1 (higher = more normal, lower = more anomalous)
        """
        if embedding is None or embedding.size == 0:
            return 0.0
            
        # If no reference distribution provided, use basic statistical properties
        if reference_distribution is None:
            # Check for NaN or inf values
            if np.isnan(embedding).any() or np.isinf(embedding).any():
                return 0.0
                
            # Check for zero vectors
            if np.all(embedding == 0):
                return 0.0
                
            # Check for reasonable magnitude
            norm = np.linalg.norm(embedding)
            if norm < 1e-6 or norm > 1e3:
                return 0.2  # Very small or large norms are suspicious
                
            # Basic distribution checks - near-uniform is suspicious
            uniformity = 1.0 - np.std(embedding) * 2
            if uniformity > 0.9:  # Very uniform vectors are suspicious
                return 0.3
                
            # If passed all basic checks, assign reasonable default
            return 0.8
        
        # With reference distribution, perform more sophisticated anomaly detection
        try:
            # Extract reference statistics
            mean = np.array(reference_distribution.get("mean", np.zeros_like(embedding)))
            std = np.array(reference_distribution.get("std", np.ones_like(embedding)))
            min_vals = np.array(reference_distribution.get("min", np.full_like(embedding, -np.inf)))
            max_vals = np.array(reference_distribution.get("max", np.full_like(embedding, np.inf)))
            
            # Z-score calculation (how many standard deviations from mean)
            z_scores = np.abs((embedding - mean) / np.maximum(std, 1e-10))
            mean_z_score = np.mean(z_scores)
            max_z_score = np.max(z_scores)
            
            # Out-of-range check
            out_of_range = np.sum((embedding < min_vals) | (embedding > max_vals))
            out_of_range_ratio = out_of_range / embedding.size if embedding.size > 0 else 0
            
            # Combined anomaly score
            z_score_penalty = np.clip(mean_z_score / 3.0, 0, 1)  # 3 sigma rule
            range_penalty = out_of_range_ratio
            
            # Final normalcy score (inverse of anomaly)
            normalcy = 1.0 - (0.7 * z_score_penalty + 0.3 * range_penalty)
            
            return max(0, min(1, normalcy))
            
        except Exception as e:
            logger.warning(f"Error in anomaly detection: {e}")
            return 0.5  # Return middle score on error
    
    @staticmethod
    def clustering_alignment(embedding: np.ndarray, 
                            material_category: Optional[str] = None,
                            reference_embeddings: Optional[Dict[str, List[np.ndarray]]] = None) -> float:
        """
        Evaluates how well an embedding aligns with clustering expectations
        
        Args:
            embedding: The embedding vector to evaluate
            material_category: Optional category of the material
            reference_embeddings: Optional dictionary of reference embeddings by category
            
        Returns:
            Alignment score between 0 and 1
        """
        if embedding is None or embedding.size == 0 or reference_embeddings is None:
            return 0.5  # Default middle score without references
            
        if material_category is None or material_category not in reference_embeddings:
            # Without known category, evaluate general clustering tendency
            all_distances = []
            all_embeddings = []
            
            # Flatten all reference embeddings into a single list
            for category, embeddings in reference_embeddings.items():
                for ref in embeddings:
                    all_embeddings.append(ref)
            
            if not all_embeddings:
                return 0.5
                
            # Calculate distances to all reference embeddings
            for ref in all_embeddings:
                # Ensure vectors are normalized
                norm_embedding = embedding / np.linalg.norm(embedding)
                norm_ref = ref / np.linalg.norm(ref)
                
                # Calculate cosine distance
                distance = 1.0 - np.dot(norm_embedding, norm_ref)
                all_distances.append(distance)
                
            if not all_distances:
                return 0.5
                
            # Check if there are clear clusters in the distances
            # (indicating the embedding falls clearly into a group)
            distances = np.array(all_distances)
            sorted_distances = np.sort(distances)
            
            # Look for an elbow in the sorted distances
            # Significant jump indicates good clustering
            if len(sorted_distances) > 5:
                # Calculate differences between adjacent sorted distances
                diffs = np.diff(sorted_distances)
                
                # Find largest jump (indicating potential cluster boundary)
                max_jump = np.max(diffs)
                mean_diff = np.mean(diffs)
                
                # Ratio of max jump to mean diff indicates clustering clarity
                if mean_diff > 0:
                    clarity = min(1.0, max_jump / (mean_diff * 5))
                    return clarity
            
            # Fallback: are there any close matches?
            closest_distance = np.min(distances) if distances.size > 0 else 1.0
            if closest_distance < 0.2:  # Empirical threshold
                return 0.8
            else:
                return 0.4
        
        # With known category, measure in-group vs. out-group distances
        try:
            # Get in-group references
            in_group_refs = reference_embeddings.get(material_category, [])
            
            # Calculate in-group distances
            in_group_distances = []
            for ref in in_group_refs:
                # Ensure vectors are normalized
                norm_embedding = embedding / np.linalg.norm(embedding)
                norm_ref = ref / np.linalg.norm(ref)
                
                # Calculate cosine distance
                distance = 1.0 - np.dot(norm_embedding, norm_ref)
                in_group_distances.append(distance)
                
            # Calculate out-group distances
            out_group_distances = []
            for category, refs in reference_embeddings.items():
                if category != material_category:
                    for ref in refs:
                        # Ensure vectors are normalized
                        norm_embedding = embedding / np.linalg.norm(embedding)
                        norm_ref = ref / np.linalg.norm(ref)
                        
                        # Calculate cosine distance
                        distance = 1.0 - np.dot(norm_embedding, norm_ref)
                        out_group_distances.append(distance)
            
            # If no reference points, return middle score
            if not in_group_distances or not out_group_distances:
                return 0.5
                
            # Calculate statistics
            avg_in_group = np.mean(in_group_distances)
            avg_out_group = np.mean(out_group_distances)
            
            # Ideal: small in-group distances, large out-group distances
            if avg_in_group < avg_out_group:
                # Calculate separation ratio
                separation = (avg_out_group - avg_in_group) / avg_out_group
                # Scale to [0, 1]
                return min(1.0, separation * 2)  # Scale by 2 to reward good separation
            else:
                # In-group distance larger than out-group: poor clustering
                return 0.1
        
        except Exception as e:
            logger.warning(f"Error in clustering alignment: {e}")
            return 0.5  # Return middle score on error


class EmbeddingQualityEvaluator:
    """
    Evaluates embedding quality and provides recommendations for embedding method selection
    """
    
    def __init__(self, 
                reference_path: Optional[str] = None, 
                quality_threshold: float = 0.65,
                material_categories: Optional[Dict[str, str]] = None,
                cache_dir: Optional[str] = None):
        """
        Initialize the embedding quality evaluator
        
        Args:
            reference_path: Optional path to load reference embeddings
            quality_threshold: Threshold below which to recommend switching methods
            material_categories: Optional mapping of material IDs to categories
            cache_dir: Directory to cache quality scores and statistics
        """
        self.quality_threshold = quality_threshold
        self.material_categories = material_categories or {}
        self.cache_dir = cache_dir
        
        # Create cache directory if it doesn't exist
        if self.cache_dir:
            os.makedirs(self.cache_dir, exist_ok=True)
        
        # Reference data
        self.reference_embeddings: Dict[str, List[np.ndarray]] = {}
        self.reference_distributions: Dict[str, Dict[str, Any]] = {}
        
        # Quality history for adaptation
        self.quality_history: Dict[str, List[Tuple[str, float]]] = {}
        self.method_performance: Dict[str, Dict[str, float]] = {}
        
        # Load reference data if provided
        if reference_path and os.path.exists(reference_path):
            self.load_references(reference_path)
        
        # Metrics
        self.metrics = EmbeddingQualityMetrics()
        
        # Lock for thread safety
        self._lock = threading.RLock()
    
    def load_references(self, reference_path: str) -> None:
        """
        Load reference embeddings from a directory or file
        
        Args:
            reference_path: Path to reference embeddings
        """
        try:
            if os.path.isdir(reference_path):
                # Load all reference files in the directory
                for file_path in Path(reference_path).glob("**/*.json"):
                    with open(file_path, "r") as f:
                        data = json.load(f)
                        
                        # Process based on file structure
                        if "embeddings" in data:
                            # Multi-embedding reference file
                            for material_id, embedding_data in data["embeddings"].items():
                                category = self._get_category(material_id)
                                
                                # Add to reference embeddings by category
                                if category not in self.reference_embeddings:
                                    self.reference_embeddings[category] = []
                                
                                # Convert vector to numpy array and add to references
                                vector = np.array(embedding_data["vector"], dtype=np.float32)
                                self.reference_embeddings[category].append(vector)
                        
                        elif "distributions" in data:
                            # Distribution statistics file
                            for category, distribution in data["distributions"].items():
                                self.reference_distributions[category] = distribution
                        
                        elif "vector" in data:
                            # Single embedding file
                            material_id = data.get("materialId", os.path.splitext(file_path.name)[0])
                            category = self._get_category(material_id)
                            
                            # Add to reference embeddings by category
                            if category not in self.reference_embeddings:
                                self.reference_embeddings[category] = []
                            
                            # Convert vector to numpy array and add to references
                            vector = np.array(data["vector"], dtype=np.float32)
                            self.reference_embeddings[category].append(vector)
            
            elif os.path.isfile(reference_path) and reference_path.endswith(".json"):
                # Load single reference file
                with open(reference_path, "r") as f:
                    data = json.load(f)
                    
                    # Process based on file structure
                    if "embeddings" in data:
                        # Multi-embedding reference file
                        for material_id, embedding_data in data["embeddings"].items():
                            category = self._get_category(material_id)
                            
                            # Add to reference embeddings by category
                            if category not in self.reference_embeddings:
                                self.reference_embeddings[category] = []
                            
                            # Convert vector to numpy array and add to references
                            vector = np.array(embedding_data["vector"], dtype=np.float32)
                            self.reference_embeddings[category].append(vector)
                    
                    elif "distributions" in data:
                        # Distribution statistics file
                        for category, distribution in data["distributions"].items():
                            self.reference_distributions[category] = distribution
                    
                    elif "categories" in data:
                        # Material category mapping
                        self.material_categories.update(data["categories"])
            
            # Generate distribution statistics if not loaded but references are available
            if self.reference_embeddings and not self.reference_distributions:
                self._generate_distribution_statistics()
                
            logger.info(f"Loaded references for {len(self.reference_embeddings)} categories")
            
        except Exception as e:
            logger.error(f"Error loading references: {e}")
    
    def _generate_distribution_statistics(self) -> None:
        """Generate statistical distributions from reference embeddings"""
        for category, embeddings in self.reference_embeddings.items():
            if not embeddings:
                continue
                
            # Convert to numpy array
            embedding_array = np.array(embeddings)
            
            # Calculate statistics
            distribution = {
                "mean": np.mean(embedding_array, axis=0).tolist(),
                "std": np.std(embedding_array, axis=0).tolist(),
                "min": np.min(embedding_array, axis=0).tolist(),
                "max": np.max(embedding_array, axis=0).tolist(),
                "count": len(embeddings)
            }
            
            self.reference_distributions[category] = distribution
    
    def _get_category(self, material_id: str) -> str:
        """Get the category for a material ID, falling back to 'unknown' if not mapped"""
        return self.material_categories.get(material_id, "unknown")
    
    def evaluate_quality(self, 
                        embedding: np.ndarray, 
                        material_id: Optional[str] = None,
                        method: Optional[str] = None) -> Dict[str, float]:
        """
        Evaluate the quality of an embedding using multiple metrics
        
        Args:
            embedding: The embedding vector to evaluate
            material_id: Optional material ID for context
            method: Optional method used to generate the embedding
            
        Returns:
            Dictionary of quality scores by metric and overall score
        """
        with self._lock:
            if embedding is None or embedding.size == 0:
                return {
                    "coherence": 0.0,
                    "discrimination": 0.0,
                    "anomaly_detection": 0.0,
                    "clustering": 0.0,
                    "overall": 0.0
                }
            
            # Get category for material if ID provided
            category = None
            if material_id:
                category = self._get_category(material_id)
            
            # Get reference distribution for this category if available
            reference_distribution = None
            if category and category in self.reference_distributions:
                reference_distribution = self.reference_distributions[category]
            
            # Apply metrics
            coherence = self.metrics.vector_coherence(embedding)
            
            # Get reference embeddings for this category if available
            category_embeddings = None
            if category and category in self.reference_embeddings:
                category_embeddings = {category: self.reference_embeddings[category]}
            
            discrimination = self.metrics.discrimination_power(embedding, category_embeddings)
            anomaly_score = self.metrics.anomaly_detection(embedding, reference_distribution)
            
            # Clustering alignment needs references across categories
            clustering_score = 0.5  # Default middle score
            if self.reference_embeddings:
                clustering_score = self.metrics.clustering_alignment(
                    embedding, category, self.reference_embeddings
                )
            
            # Weighted overall score
            overall = (
                0.25 * coherence +         # 25% weight to coherence
                0.3 * discrimination +      # 30% weight to discrimination
                0.2 * anomaly_score +       # 20% weight to anomaly detection
                0.25 * clustering_score     # 25% weight to clustering
            )
            
            # Compile results
            quality_scores = {
                "coherence": coherence,
                "discrimination": discrimination,
                "anomaly_detection": anomaly_score,
                "clustering": clustering_score,
                "overall": overall
            }
            
            # Record quality for this method if provided
            if method and material_id:
                self._record_quality(material_id, method, overall)
            
            return quality_scores
    
    def _record_quality(self, material_id: str, method: str, quality: float) -> None:
        """
        Record quality score for a method and material
        
        Args:
            material_id: ID of the material
            method: Method used to generate the embedding
            quality: Quality score
        """
        # Get category for material
        category = self._get_category(material_id)
        
        # Initialize history for material if not exists
        if material_id not in self.quality_history:
            self.quality_history[material_id] = []
        
        # Add to history with timestamp
        timestamp = datetime.now().isoformat()
        self.quality_history[material_id].append((method, quality))
        
        # Keep history limited to recent entries
        max_history = 10
        if len(self.quality_history[material_id]) > max_history:
            self.quality_history[material_id] = self.quality_history[material_id][-max_history:]
        
        # Update method performance statistics
        if method not in self.method_performance:
            self.method_performance[method] = {}
        
        if category not in self.method_performance[method]:
            self.method_performance[method][category] = quality
        else:
            # Exponential moving average to favor recent scores
            alpha = 0.3  # Weight for new value
            current = self.method_performance[method][category]
            self.method_performance[method][category] = (alpha * quality) + ((1 - alpha) * current)
        
        # Periodically save to cache if enabled
        if self.cache_dir and (len(self.quality_history[material_id]) % 5 == 0):
            self._save_performance_data()
    
    def _save_performance_data(self) -> None:
        """Save performance data to cache"""
        if not self.cache_dir:
            return
            
        try:
            # Save method performance
            performance_path = os.path.join(self.cache_dir, "method_performance.json")
            with open(performance_path, "w") as f:
                json.dump(self.method_performance, f, indent=2)
                
            # Save quality history (limited to last 100 materials)
            history_path = os.path.join(self.cache_dir, "quality_history.json")
            material_ids = list(self.quality_history.keys())
            if len(material_ids) > 100:
                material_ids = material_ids[-100:]  # Keep only most recent
                
            # Extract history for selected materials
            history_to_save = {mid: self.quality_history[mid] for mid in material_ids if mid in self.quality_history}
            
            with open(history_path, "w") as f:
                json.dump(history_to_save, f, indent=2)
                
        except Exception as e:
            logger.error(f"Error saving performance data: {e}")
    
    def load_performance_data(self) -> None:
        """Load performance data from cache"""
        if not self.cache_dir:
            return
            
        try:
            # Load method performance
            performance_path = os.path.join(self.cache_dir, "method_performance.json")
            if os.path.exists(performance_path):
                with open(performance_path, "r") as f:
                    self.method_performance = json.load(f)
                    
            # Load quality history
            history_path = os.path.join(self.cache_dir, "quality_history.json")
            if os.path.exists(history_path):
                with open(history_path, "r") as f:
                    self.quality_history = json.load(f)
                
        except Exception as e:
            logger.error(f"Error loading performance data: {e}")
    
    def recommend_method(self, 
                        material_id: Optional[str] = None,
                        current_method: Optional[str] = None,
                        current_quality: Optional[float] = None,
                        available_methods: List[str] = ["feature-based", "ml-based", "hybrid"]) -> str:
        """
        Recommend the best embedding method based on historical performance
        
        Args:
            material_id: Optional material ID for context
            current_method: Currently used method
            current_quality: Current quality score if available
            available_methods: List of available methods to choose from
            
        Returns:
            Recommended method
        """
        with self._lock:
            # If no material ID or performance data, default to hybrid
            if not material_id or not self.method_performance:
                return "hybrid" if "hybrid" in available_methods else available_methods[0]
            
            # Get category for material
            category = self._get_category(material_id)
            
            # Check if current quality is below threshold
            if current_method and current_quality is not None:
                if current_quality >= self.quality_threshold:
                    # Current quality is good enough, stick with current method
                    return current_method
            
            # Find best performing method for this category
            best_method = None
            best_score = -1.0
            
            for method, categories in self.method_performance.items():
                if method not in available_methods:
                    continue
                    
                if category in categories:
                    # Use score for this specific category
                    score = categories[category]
                elif "unknown" in categories:
                    # Fall back to unknown category if specific not found
                    score = categories["unknown"]
                else:
                    # If no data for this category, use average across categories
                    score = sum(categories.values()) / len(categories) if categories else 0.0
                
                if score > best_score:
                    best_score = score
                    best_method = method
            
            # If best method is not confident enough or no best method found
            if not best_method or best_score < self.quality_threshold:
                # Default to hybrid as it's the most versatile
                if "hybrid" in available_methods:
                    return "hybrid"
                else:
                    # Or just pick the first available method
                    return available_methods[0]
            
            return best_method
    
    def get_method_performance_stats(self) -> Dict[str, Any]:
        """
        Get statistics about method performance
        
        Returns:
            Dictionary with performance statistics
        """
        with self._lock:
            stats = {
                "methods": {},
                "categories": {},
                "overall_best": None,
                "timestamp": datetime.now().isoformat()
            }
            
            # No data available
            if not self.method_performance:
                return stats
            
            # Calculate method averages
            method_avgs = {}
            for method, categories in self.method_performance.items():
                if categories:
                    method_avgs[method] = sum(categories.values()) / len(categories)
                else:
                    method_avgs[method] = 0.0
            
            # Calculate category statistics
            for method, categories in self.method_performance.items():
                # Add method stats
                stats["methods"][method] = {
                    "average_quality": method_avgs[method],
                    "categories": len(categories),
                    "best_category": max(categories.items(), key=lambda x: x[1])[0] if categories else None,
                    "worst_category": min(categories.items(), key=lambda x: x[1])[0] if categories else None
                }
                
                # Update category stats
                for category, score in categories.items():
                    if category not in stats["categories"]:
                        stats["categories"][category] = {
                            "methods": {},
                            "best_method": None,
                            "average_quality": 0.0
                        }
                    
                    stats["categories"][category]["methods"][method] = score
                    
                    # Update best method for this category
                    current_best = stats["categories"][category]["best_method"]
                    if current_best is None or score > stats["categories"][category]["methods"].get(current_best, 0.0):
                        stats["categories"][category]["best_method"] = method
            
            # Calculate category averages
            for category in stats["categories"]:
                method_scores = stats["categories"][category]["methods"]
                if method_scores:
                    stats["categories"][category]["average_quality"] = sum(method_scores.values()) / len(method_scores)
            
            # Determine overall best method
            if method_avgs:
                stats["overall_best"] = max(method_avgs.items(), key=lambda x: x[1])[0]
            
            return stats


# Simple functions for external use

def evaluate_embedding_quality(embedding: np.ndarray, 
                              material_id: Optional[str] = None,
                              reference_path: Optional[str] = None) -> Dict[str, float]:
    """
    Evaluate the quality of an embedding
    
    Args:
        embedding: The embedding vector to evaluate
        material_id: Optional material ID for context
        reference_path: Optional path to load reference embeddings
        
    Returns:
        Dictionary of quality scores
    """
    evaluator = EmbeddingQualityEvaluator(reference_path=reference_path)
    return evaluator.evaluate_quality(embedding, material_id=material_id)


def quality_based_method_selector(embedding: np.ndarray,
                                material_id: Optional[str] = None,
                                current_method: str = "hybrid",
                                available_methods: List[str] = ["feature-based", "ml-based", "hybrid"],
                                reference_path: Optional[str] = None,
                                cache_dir: Optional[str] = None) -> Tuple[str, Dict[str, float]]:
    """
    Select the best embedding method based on quality evaluation
    
    Args:
        embedding: The embedding vector to evaluate
        material_id: Optional material ID for context
        current_method: Currently used method
        available_methods: List of available methods to choose from
        reference_path: Optional path to load reference embeddings
        cache_dir: Directory to cache quality scores and statistics
        
    Returns:
        Tuple of (recommended_method, quality_scores)
    """
    evaluator = EmbeddingQualityEvaluator(reference_path=reference_path, cache_dir=cache_dir)
    
    # Load cached performance data if available
    if cache_dir:
        evaluator.load_performance_data()
    
    # Evaluate current embedding quality
    quality_scores = evaluator.evaluate_quality(embedding, material_id=material_id, method=current_method)
    
    # Get recommendation
    recommended_method = evaluator.recommend_method(
        material_id=material_id,
        current_method=current_method,
        current_quality=quality_scores["overall"],
        available_methods=available_methods
    )
    
    return recommended_method, quality_scores


if __name__ == "__main__":
    # Example usage when script is run directly
    import argparse
    
    parser = argparse.ArgumentParser(description="Evaluate embedding quality")
    parser.add_argument("--embedding-file", help="Path to embedding file")
    parser.add_argument("--reference-path", help="Path to reference embeddings")
    parser.add_argument("--material-id", help="Material ID")
    parser.add_argument("--method", default="hybrid", help="Embedding method")
    parser.add_argument("--cache-dir", help="Cache directory")
    parser.add_argument("--save-stats", action="store_true", help="Save performance statistics")
    
    args = parser.parse_args()
    
    if args.embedding_file:
        try:
            # Load embedding
            with open(args.embedding_file, "r") as f:
                data = json.load(f)
                
            if "vector" in data:
                embedding = np.array(data["vector"], dtype=np.float32)
                material_id = args.material_id or data.get("materialId")
                
                # Initialize evaluator
                evaluator = EmbeddingQualityEvaluator(
                    reference_path=args.reference_path,
                    cache_dir=args.cache_dir
                )
                
                # Evaluate quality
                quality = evaluator.evaluate_quality(embedding, material_id=material_id, method=args.method)
                
                # Print results
                print(json.dumps(quality, indent=2))
                
                # Get recommendation
                recommendation = evaluator.recommend_method(
                    material_id=material_id,
                    current_method=args.method,
                    current_quality=quality["overall"]
                )
                
                print(f"Recommended method: {recommendation}")
                
                # Save statistics if requested
                if args.save_stats and args.cache_dir:
                    stats = evaluator.get_method_performance_stats()
                    stats_path = os.path.join(args.cache_dir, "performance_stats.json")
                    with open(stats_path, "w") as f:
                        json.dump(stats, f, indent=2)
                    
                    print(f"Performance statistics saved to {stats_path}")
            
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)
    else:
        parser.print_help()