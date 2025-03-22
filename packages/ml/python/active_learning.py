#!/usr/bin/env python3
"""
Active Learning Module for Material Recognition

This module implements active learning workflows to prioritize samples
for manual labeling based on model uncertainty and diversity.
It also provides automated retraining triggers based on data changes.

Features:
1. Uncertainty-based sample selection
2. Diversity sampling strategies
3. Automated retraining triggers
4. Integration with feedback loop and distributed training
"""

import os
import json
import time
import uuid
import logging
import random
import hashlib
from typing import Dict, List, Any, Tuple, Optional, Union, Callable, Set
from dataclasses import dataclass, asdict, field
from datetime import datetime
import math

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('active_learning')

# Try to import numpy for calculations
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    logger.warning("NumPy not available. Some features will be limited.")

# Try to import scikit-learn for clustering and diversity measures
try:
    from sklearn.cluster import KMeans
    from sklearn.metrics import pairwise_distances
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logger.warning("scikit-learn not available. Diversity sampling will be limited.")

# Try to import torch for uncertainty measures
try:
    import torch
    import torch.nn.functional as F
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch not available. Some uncertainty measures will be limited.")

# Try to import tensorflow for uncertainty measures
try:
    import tensorflow as tf
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    logger.warning("TensorFlow not available. Some uncertainty measures will be limited.")

# Try to import from other project modules
try:
    from feedback_loop import FeedbackLoopSystem
    FEEDBACK_LOOP_AVAILABLE = True
except ImportError:
    FEEDBACK_LOOP_AVAILABLE = False
    logger.warning("feedback_loop module not available. Integration will be limited.")


# Data structures
@dataclass
class SampleCandidate:
    """Represents a sample candidate for active learning"""
    sample_id: str
    image_path: str
    uncertainty_score: float
    diversity_score: Optional[float] = None
    prediction: Optional[Dict[str, Any]] = None
    embedding: Optional[Any] = None
    features: Optional[Dict[str, Any]] = None
    model_version: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        result = asdict(self)
        
        # Convert numpy arrays or tensors to lists for JSON serialization
        if NUMPY_AVAILABLE and isinstance(self.embedding, np.ndarray):
            result['embedding'] = self.embedding.tolist()
        elif TORCH_AVAILABLE and isinstance(self.embedding, torch.Tensor):
            result['embedding'] = self.embedding.cpu().numpy().tolist()
        elif TF_AVAILABLE and isinstance(self.embedding, tf.Tensor):
            result['embedding'] = self.embedding.numpy().tolist()
        
        return result


@dataclass
class LabelingBatch:
    """Represents a batch of samples selected for labeling"""
    batch_id: str
    samples: List[SampleCandidate]
    selection_strategy: str
    batch_size: int
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    completed_at: Optional[str] = None
    labeled_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        result = asdict(self)
        result['samples'] = [s.to_dict() for s in self.samples]
        return result


@dataclass
class RetrainingTrigger:
    """Represents a trigger for model retraining"""
    trigger_id: str
    trigger_type: str  # 'count', 'time', 'significance', 'distribution_shift'
    threshold: Union[int, float]
    current_value: Union[int, float]
    status: str = "pending"  # 'pending', 'triggered', 'completed'
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    triggered_at: Optional[str] = None
    model_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        return asdict(self)


class UncertaintyMeasure:
    """Calculates uncertainty measures for model predictions"""
    
    @staticmethod
    def entropy(probabilities: List[float]) -> float:
        """
        Calculate entropy-based uncertainty
        
        Args:
            probabilities: List of class probabilities
            
        Returns:
            Entropy value (higher means more uncertain)
        """
        if not NUMPY_AVAILABLE:
            # Fallback implementation
            entropy = 0.0
            for p in probabilities:
                if p > 0:
                    entropy -= p * math.log(p)
            return entropy
        
        # NumPy implementation
        probs = np.array(probabilities)
        return -np.sum(probs * np.log(probs + 1e-10))
    
    @staticmethod
    def margin_confidence(probabilities: List[float]) -> float:
        """
        Calculate margin-based uncertainty (1 - margin)
        
        Args:
            probabilities: List of class probabilities
            
        Returns:
            Margin confidence (higher means more uncertain)
        """
        if len(probabilities) < 2:
            return 0.0
        
        # Sort probabilities in descending order
        sorted_probs = sorted(probabilities, reverse=True)
        
        # Calculate margin between top 2 probabilities
        margin = sorted_probs[0] - sorted_probs[1]
        
        # Return inverse margin (higher value = more uncertain)
        return 1.0 - margin
    
    @staticmethod
    def least_confidence(probabilities: List[float]) -> float:
        """
        Calculate least confidence uncertainty (1 - max_prob)
        
        Args:
            probabilities: List of class probabilities
            
        Returns:
            Least confidence (higher means more uncertain)
        """
        max_prob = max(probabilities)
        return 1.0 - max_prob
    
    @staticmethod
    def variation_ratio(probabilities: List[float]) -> float:
        """
        Calculate variation ratio uncertainty (1 - max_prob)
        
        Args:
            probabilities: List of class probabilities
            
        Returns:
            Variation ratio (higher means more uncertain)
        """
        # Same as least confidence
        max_prob = max(probabilities)
        return 1.0 - max_prob
    
    @staticmethod
    def bayesian_uncertainty(mc_dropout_predictions: List[List[float]]) -> float:
        """
        Calculate Bayesian uncertainty from Monte Carlo dropout runs
        
        Args:
            mc_dropout_predictions: List of prediction probabilities from multiple MC dropout runs
            
        Returns:
            Uncertainty value (higher means more uncertain)
        """
        if not NUMPY_AVAILABLE:
            return 0.0
        
        # Convert to numpy array
        predictions = np.array(mc_dropout_predictions)
        
        # Calculate mean prediction
        mean_pred = np.mean(predictions, axis=0)
        
        # Calculate entropy of the mean prediction
        mean_entropy = -np.sum(mean_pred * np.log(mean_pred + 1e-10))
        
        # Calculate mean of entropies
        entropy_mean = np.mean([
            -np.sum(pred * np.log(pred + 1e-10)) for pred in predictions
        ])
        
        # Calculate mutual information (mean entropy - entropy of mean)
        mutual_info = entropy_mean - mean_entropy
        
        return mutual_info
    
    @staticmethod
    def calculate_from_pytorch_output(output, uncertainty_type: str = "entropy") -> float:
        """
        Calculate uncertainty from PyTorch model output
        
        Args:
            output: PyTorch model output
            uncertainty_type: Type of uncertainty measure
            
        Returns:
            Uncertainty value
        """
        if not TORCH_AVAILABLE:
            return 0.0
        
        # Convert to probabilities
        if len(output.shape) == 1:
            # Output is already a vector
            probs = F.softmax(output, dim=0).cpu().numpy()
        else:
            # Batch of outputs, take the first one
            probs = F.softmax(output[0], dim=0).cpu().numpy()
        
        if uncertainty_type == "entropy":
            return UncertaintyMeasure.entropy(probs)
        elif uncertainty_type == "margin":
            return UncertaintyMeasure.margin_confidence(probs)
        elif uncertainty_type == "least_confidence":
            return UncertaintyMeasure.least_confidence(probs)
        else:
            return UncertaintyMeasure.entropy(probs)
    
    @staticmethod
    def calculate_from_tensorflow_output(output, uncertainty_type: str = "entropy") -> float:
        """
        Calculate uncertainty from TensorFlow model output
        
        Args:
            output: TensorFlow model output
            uncertainty_type: Type of uncertainty measure
            
        Returns:
            Uncertainty value
        """
        if not TF_AVAILABLE:
            return 0.0
        
        # Convert to probabilities
        if len(output.shape) == 1:
            # Output is already a vector
            probs = tf.nn.softmax(output).numpy()
        else:
            # Batch of outputs, take the first one
            probs = tf.nn.softmax(output[0]).numpy()
        
        if uncertainty_type == "entropy":
            return UncertaintyMeasure.entropy(probs)
        elif uncertainty_type == "margin":
            return UncertaintyMeasure.margin_confidence(probs)
        elif uncertainty_type == "least_confidence":
            return UncertaintyMeasure.least_confidence(probs)
        else:
            return UncertaintyMeasure.entropy(probs)
    
    @staticmethod
    def calculate_from_prediction(prediction: Dict[str, Any], 
                                uncertainty_type: str = "entropy") -> float:
        """
        Calculate uncertainty from a prediction dictionary
        
        Args:
            prediction: Prediction dictionary with 'matches' list
            uncertainty_type: Type of uncertainty measure
            
        Returns:
            Uncertainty value
        """
        # Extract probabilities from matches
        if "matches" not in prediction:
            return 0.0
        
        matches = prediction["matches"]
        if not matches:
            return 0.0
        
        # Extract confidence scores as probabilities
        probabilities = [match.get("confidence", 0.0) for match in matches]
        
        # Normalize if they don't sum to 1
        prob_sum = sum(probabilities)
        if prob_sum > 0:
            probabilities = [p / prob_sum for p in probabilities]
        
        # Calculate uncertainty
        if uncertainty_type == "entropy":
            return UncertaintyMeasure.entropy(probabilities)
        elif uncertainty_type == "margin":
            return UncertaintyMeasure.margin_confidence(probabilities)
        elif uncertainty_type == "least_confidence":
            return UncertaintyMeasure.least_confidence(probabilities)
        else:
            return UncertaintyMeasure.entropy(probabilities)


class DiversitySampler:
    """Selects diverse samples for labeling"""
    
    @staticmethod
    def kmeans_diversity(embeddings: List[Any], k: int, 
                       preselected_indices: Optional[Set[int]] = None) -> List[int]:
        """
        Select diverse samples using k-means clustering
        
        Args:
            embeddings: List of sample embeddings
            k: Number of samples to select
            preselected_indices: Indices of already selected samples to exclude
            
        Returns:
            Indices of selected samples
        """
        if not SKLEARN_AVAILABLE or not NUMPY_AVAILABLE:
            # Fallback to random selection
            logger.warning("sklearn not available, using random selection for diversity")
            all_indices = set(range(len(embeddings)))
            if preselected_indices:
                all_indices -= preselected_indices
            
            if len(all_indices) <= k:
                return list(all_indices)
            
            return random.sample(list(all_indices), k)
        
        # Convert embeddings to numpy array
        if isinstance(embeddings[0], list):
            embeddings_array = np.array(embeddings)
        elif TORCH_AVAILABLE and isinstance(embeddings[0], torch.Tensor):
            embeddings_array = np.array([e.cpu().numpy() for e in embeddings])
        elif TF_AVAILABLE and isinstance(embeddings[0], tf.Tensor):
            embeddings_array = np.array([e.numpy() for e in embeddings])
        elif NUMPY_AVAILABLE and isinstance(embeddings[0], np.ndarray):
            embeddings_array = np.array(embeddings)
        else:
            # Fallback to random selection
            logger.warning("Unsupported embedding type, using random selection")
            all_indices = set(range(len(embeddings)))
            if preselected_indices:
                all_indices -= preselected_indices
            
            if len(all_indices) <= k:
                return list(all_indices)
            
            return random.sample(list(all_indices), k)
        
        # Create mask for preselected indices
        valid_indices = list(range(len(embeddings)))
        if preselected_indices:
            valid_indices = [i for i in valid_indices if i not in preselected_indices]
        
        if len(valid_indices) <= k:
            return valid_indices
        
        # Get subset of embeddings for valid indices
        valid_embeddings = embeddings_array[valid_indices]
        
        # Apply k-means clustering
        kmeans = KMeans(n_clusters=k, random_state=42)
        cluster_labels = kmeans.fit_predict(valid_embeddings)
        
        # For each cluster, find the sample closest to the centroid
        selected_indices = []
        for cluster_idx in range(k):
            cluster_samples = np.where(cluster_labels == cluster_idx)[0]
            if len(cluster_samples) == 0:
                continue
            
            # Calculate distances to centroid
            centroid = kmeans.cluster_centers_[cluster_idx]
            distances = np.linalg.norm(valid_embeddings[cluster_samples] - centroid, axis=1)
            
            # Get the closest sample
            closest_idx = cluster_samples[np.argmin(distances)]
            selected_indices.append(valid_indices[closest_idx])
        
        # If we didn't get enough samples, add more
        if len(selected_indices) < k:
            remaining = k - len(selected_indices)
            remaining_indices = [i for i in valid_indices if i not in selected_indices]
            selected_indices.extend(random.sample(remaining_indices, min(remaining, len(remaining_indices))))
        
        return selected_indices
    
    @staticmethod
    def max_min_diversity(embeddings: List[Any], k: int, 
                        preselected_indices: Optional[Set[int]] = None) -> List[int]:
        """
        Select diverse samples using max-min diversity
        
        Args:
            embeddings: List of sample embeddings
            k: Number of samples to select
            preselected_indices: Indices of already selected samples to exclude
            
        Returns:
            Indices of selected samples
        """
        if not NUMPY_AVAILABLE:
            # Fallback to random selection
            logger.warning("NumPy not available, using random selection for diversity")
            all_indices = set(range(len(embeddings)))
            if preselected_indices:
                all_indices -= preselected_indices
            
            if len(all_indices) <= k:
                return list(all_indices)
            
            return random.sample(list(all_indices), k)
        
        # Convert embeddings to numpy array
        if isinstance(embeddings[0], list):
            embeddings_array = np.array(embeddings)
        elif TORCH_AVAILABLE and isinstance(embeddings[0], torch.Tensor):
            embeddings_array = np.array([e.cpu().numpy() for e in embeddings])
        elif TF_AVAILABLE and isinstance(embeddings[0], tf.Tensor):
            embeddings_array = np.array([e.numpy() for e in embeddings])
        elif NUMPY_AVAILABLE and isinstance(embeddings[0], np.ndarray):
            embeddings_array = np.array(embeddings)
        else:
            # Fallback to random selection
            logger.warning("Unsupported embedding type, using random selection")
            all_indices = set(range(len(embeddings)))
            if preselected_indices:
                all_indices -= preselected_indices
            
            if len(all_indices) <= k:
                return list(all_indices)
            
            return random.sample(list(all_indices), k)
        
        # Create valid indices list
        valid_indices = list(range(len(embeddings)))
        if preselected_indices:
            valid_indices = [i for i in valid_indices if i not in preselected_indices]
        
        if len(valid_indices) <= k:
            return valid_indices
        
        # Get subset of embeddings for valid indices
        valid_embeddings = embeddings_array[valid_indices]
        
        # Calculate pairwise distances
        distances = pairwise_distances(valid_embeddings)
        
        # Initialize with a random sample
        selected = [random.randint(0, len(valid_indices) - 1)]
        
        # Iteratively select the farthest sample from currently selected ones
        for _ in range(k - 1):
            if len(selected) >= len(valid_indices):
                break
                
            # Calculate minimum distance from each unselected sample to any selected sample
            min_distances = np.min(distances[selected][:, list(set(range(len(valid_indices))) - set(selected))], axis=0)
            
            # Select the sample with the maximum minimal distance
            next_idx = np.argmax(min_distances)
            
            # Convert to the original index
            unselected = list(set(range(len(valid_indices))) - set(selected))
            selected.append(unselected[next_idx])
        
        # Convert to original indices
        return [valid_indices[i] for i in selected]


class ActiveLearner:
    """Active learning system for prioritizing samples for manual labeling"""
    
    def __init__(
        self,
        storage_dir: str = "./active_learning",
        feedback_system: Optional[Any] = None,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        uncertainty_method: str = "entropy",
        diversity_method: str = "kmeans",
        feedback_weight: float = 0.7,
        diversity_weight: float = 0.3
    ):
        """
        Initialize active learning system
        
        Args:
            storage_dir: Directory for storing active learning data
            feedback_system: Optional feedback loop system
            supabase_url: Optional Supabase URL
            supabase_key: Optional Supabase API key
            uncertainty_method: Method for calculating uncertainty
            diversity_method: Method for ensuring sample diversity
            feedback_weight: Weight for feedback uncertainty in combined score
            diversity_weight: Weight for diversity in combined score
        """
        self.storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)
        
        # Calculate and save paths
        self.candidates_dir = os.path.join(storage_dir, "candidates")
        self.batches_dir = os.path.join(storage_dir, "batches")
        self.triggers_dir = os.path.join(storage_dir, "triggers")
        
        os.makedirs(self.candidates_dir, exist_ok=True)
        os.makedirs(self.batches_dir, exist_ok=True)
        os.makedirs(self.triggers_dir, exist_ok=True)
        
        # Store configuration
        self.uncertainty_method = uncertainty_method
        self.diversity_method = diversity_method
        self.feedback_weight = feedback_weight
        self.diversity_weight = diversity_weight
        
        # Initialize feedback system
        self.feedback_system = feedback_system
        if FEEDBACK_LOOP_AVAILABLE and feedback_system is None:
            try:
                self.feedback_system = FeedbackLoopSystem(
                    data_dir=storage_dir,
                    supabase_url=supabase_url,
                    supabase_key=supabase_key
                )
            except Exception as e:
                logger.warning(f"Could not initialize feedback system: {e}")
                self.feedback_system = None
        
        # Initialize retraining triggers
        self.triggers: List[RetrainingTrigger] = []
        self._load_triggers()
        
        # Initialize Supabase client
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.supabase = None
        
        if supabase_url and supabase_key:
            try:
                from supabase import create_client
                self.supabase = create_client(supabase_url, supabase_key)
                logger.info("Initialized Supabase client for active learning")
            except ImportError:
                logger.warning("supabase-py not installed. Install with: pip install supabase")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {e}")
        
        logger.info(f"Active learning system initialized with storage in {storage_dir}")
    
    def register_candidate(
        self,
        image_path: str,
        prediction: Dict[str, Any],
        embedding: Optional[Any] = None,
        features: Optional[Dict[str, Any]] = None,
        model_version: Optional[str] = None,
        sample_id: Optional[str] = None
    ) -> SampleCandidate:
        """
        Register a sample as a candidate for active learning
        
        Args:
            image_path: Path to the image file
            prediction: Model prediction for the sample
            embedding: Optional feature embedding of the sample
            features: Optional extracted features
            model_version: Optional model version identifier
            sample_id: Optional sample ID (generated if None)
            
        Returns:
            Registered sample candidate
        """
        # Generate sample ID if not provided
        if sample_id is None:
            # Create hash from image path for deterministic ID
            hasher = hashlib.md5()
            hasher.update(image_path.encode('utf-8'))
            sample_id = f"sample_{hasher.hexdigest()[:12]}"
        
        # Calculate uncertainty score
        uncertainty_score = UncertaintyMeasure.calculate_from_prediction(
            prediction, uncertainty_type=self.uncertainty_method
        )
        
        # Create sample candidate
        candidate = SampleCandidate(
            sample_id=sample_id,
            image_path=image_path,
            uncertainty_score=uncertainty_score,
            prediction=prediction,
            embedding=embedding,
            features=features,
            model_version=model_version
        )
        
        # Save candidate to file
        self._save_candidate(candidate)
        
        # Check if this sample triggers retraining
        self._check_uncertainty_trigger(uncertainty_score)
        
        return candidate
    
    def _save_candidate(self, candidate: SampleCandidate) -> None:
        """Save a sample candidate to storage"""
        file_path = os.path.join(self.candidates_dir, f"{candidate.sample_id}.json")
        
        with open(file_path, 'w') as f:
            json.dump(candidate.to_dict(), f, indent=2)
        
        # Store in Supabase if available
        if self.supabase:
            try:
                self.supabase.table('active_learning_candidates').upsert(
                    candidate.to_dict(),
                    on_conflict='sample_id'
                ).execute()
            except Exception as e:
                logger.warning(f"Failed to store candidate in Supabase: {e}")
    
    def get_candidates(self, limit: int = 100, min_uncertainty: float = 0.0) -> List[SampleCandidate]:
        """
        Get sample candidates for active learning
        
        Args:
            limit: Maximum number of candidates to return
            min_uncertainty: Minimum uncertainty score threshold
            
        Returns:
            List of sample candidates
        """
        # First try to get candidates from Supabase
        if self.supabase:
            try:
                result = self.supabase.table('active_learning_candidates') \
                    .select('*') \
                    .filter('uncertainty_score', 'gte', min_uncertainty) \
                    .order('uncertainty_score', desc=True) \
                    .limit(limit) \
                    .execute()
                
                if result.data:
                    return [SampleCandidate(**item) for item in result.data]
            except Exception as e:
                logger.warning(f"Failed to get candidates from Supabase: {e}")
        
        # Fallback to local storage
        candidates = []
        
        for filename in os.listdir(self.candidates_dir):
            if not filename.endswith('.json'):
                continue
            
            file_path = os.path.join(self.candidates_dir, filename)
            
            try:
                with open(file_path, 'r') as f:
                    data = json.load(f)
                
                if data.get('uncertainty_score', 0.0) >= min_uncertainty:
                    candidates.append(SampleCandidate(**data))
            except Exception as e:
                logger.error(f"Error loading candidate from {file_path}: {e}")
        
        # Sort by uncertainty score (descending) and limit
        candidates.sort(key=lambda c: c.uncertainty_score, reverse=True)
        return candidates[:limit]
    
    def select_samples_for_labeling(
        self,
        count: int = 10,
        min_uncertainty: float = 0.0,
        batch_id: Optional[str] = None,
        strategy: str = "combined",
        exclude_previous_batches: bool = True
    ) -> LabelingBatch:
        """
        Select samples for manual labeling
        
        Args:
            count: Number of samples to select
            min_uncertainty: Minimum uncertainty threshold
            batch_id: Optional batch ID (generated if None)
            strategy: Selection strategy ('uncertainty', 'diversity', 'combined')
            exclude_previous_batches: Whether to exclude samples from previous batches
            
        Returns:
            Labeling batch with selected samples
        """
        # Generate batch ID if not provided
        if batch_id is None:
            batch_id = f"batch_{uuid.uuid4()}"
        
        # Get current set of candidates
        candidates = self.get_candidates(limit=1000, min_uncertainty=min_uncertainty)
        
        if not candidates:
            logger.warning("No candidates available for labeling")
            return LabelingBatch(
                batch_id=batch_id,
                samples=[],
                selection_strategy=strategy,
                batch_size=count
            )
        
        # Get indices of samples in previous batches to exclude
        excluded_sample_ids = set()
        if exclude_previous_batches:
            previous_batches = self.get_labeling_batches()
            for batch in previous_batches:
                excluded_sample_ids.update(sample.sample_id for sample in batch.samples)
        
        # Filter out excluded samples
        filtered_candidates = [c for c in candidates if c.sample_id not in excluded_sample_ids]
        
        if not filtered_candidates:
            logger.warning("No candidates available after filtering")
            return LabelingBatch(
                batch_id=batch_id,
                samples=[],
                selection_strategy=strategy,
                batch_size=count
            )
        
        # Select samples based on strategy
        selected_samples = []
        
        if strategy == "uncertainty":
            # Sort by uncertainty and take top 'count'
            filtered_candidates.sort(key=lambda c: c.uncertainty_score, reverse=True)
            selected_samples = filtered_candidates[:count]
            
        elif strategy == "diversity" and NUMPY_AVAILABLE:
            # Get embeddings for diversity sampling
            candidate_embeddings = []
            valid_candidates = []
            
            for candidate in filtered_candidates:
                embedding = candidate.embedding
                if embedding is not None:
                    valid_candidates.append(candidate)
                    if isinstance(embedding, list):
                        candidate_embeddings.append(embedding)
                    elif NUMPY_AVAILABLE and isinstance(embedding, np.ndarray):
                        candidate_embeddings.append(embedding)
                    elif TORCH_AVAILABLE and isinstance(embedding, torch.Tensor):
                        candidate_embeddings.append(embedding.cpu().numpy())
                    elif TF_AVAILABLE and isinstance(embedding, tf.Tensor):
                        candidate_embeddings.append(embedding.numpy())
            
            if not candidate_embeddings:
                logger.warning("No embeddings available for diversity sampling, falling back to uncertainty")
                filtered_candidates.sort(key=lambda c: c.uncertainty_score, reverse=True)
                selected_samples = filtered_candidates[:count]
            else:
                # Select diverse samples
                if self.diversity_method == "kmeans":
                    indices = DiversitySampler.kmeans_diversity(candidate_embeddings, count)
                else:  # max_min
                    indices = DiversitySampler.max_min_diversity(candidate_embeddings, count)
                
                selected_samples = [valid_candidates[i] for i in indices if i < len(valid_candidates)]
        
        elif strategy == "combined" and NUMPY_AVAILABLE:
            # Get embeddings for diversity sampling
            candidate_embeddings = []
            valid_candidates = []
            
            for candidate in filtered_candidates:
                embedding = candidate.embedding
                if embedding is not None:
                    valid_candidates.append(candidate)
                    if isinstance(embedding, list):
                        candidate_embeddings.append(embedding)
                    elif NUMPY_AVAILABLE and isinstance(embedding, np.ndarray):
                        candidate_embeddings.append(embedding)
                    elif TORCH_AVAILABLE and isinstance(embedding, torch.Tensor):
                        candidate_embeddings.append(embedding.cpu().numpy())
                    elif TF_AVAILABLE and isinstance(embedding, tf.Tensor):
                        candidate_embeddings.append(embedding.numpy())
            
            if not candidate_embeddings:
                logger.warning("No embeddings available for diversity sampling, falling back to uncertainty")
                filtered_candidates.sort(key=lambda c: c.uncertainty_score, reverse=True)
                selected_samples = filtered_candidates[:count]
            else:
                # First select some samples based on uncertainty
                uncertainty_count = max(1, int(count * self.feedback_weight))
                filtered_candidates.sort(key=lambda c: c.uncertainty_score, reverse=True)
                uncertainty_samples = filtered_candidates[:uncertainty_count]
                uncertainty_sample_ids = {s.sample_id for s in uncertainty_samples}
                
                # Then select remaining samples based on diversity
                diversity_count = count - uncertainty_count
                if diversity_count > 0:
                    # Create indices of already selected samples
                    preselected_indices = {
                        i for i, c in enumerate(valid_candidates) 
                        if c.sample_id in uncertainty_sample_ids
                    }
                    
                    # Select diverse samples
                    if self.diversity_method == "kmeans":
                        indices = DiversitySampler.kmeans_diversity(
                            candidate_embeddings, diversity_count, preselected_indices
                        )
                    else:  # max_min
                        indices = DiversitySampler.max_min_diversity(
                            candidate_embeddings, diversity_count, preselected_indices
                        )
                    
                    diversity_samples = [valid_candidates[i] for i in indices if i < len(valid_candidates)]
                    
                    # Combine samples
                    selected_samples = uncertainty_samples + diversity_samples
                else:
                    selected_samples = uncertainty_samples
        
        else:
            # Default to uncertainty sampling
            filtered_candidates.sort(key=lambda c: c.uncertainty_score, reverse=True)
            selected_samples = filtered_candidates[:count]
        
        # Create labeling batch
        batch = LabelingBatch(
            batch_id=batch_id,
            samples=selected_samples,
            selection_strategy=strategy,
            batch_size=count
        )
        
        # Save batch
        self._save_batch(batch)
        
        return batch
    
    def _save_batch(self, batch: LabelingBatch) -> None:
        """Save a labeling batch to storage"""
        file_path = os.path.join(self.batches_dir, f"{batch.batch_id}.json")
        
        with open(file_path, 'w') as f:
            json.dump(batch.to_dict(), f, indent=2)
        
        # Store in Supabase if available
        if self.supabase:
            try:
                self.supabase.table('active_learning_batches').upsert(
                    batch.to_dict(),
                    on_conflict='batch_id'
                ).execute()
            except Exception as e:
                logger.warning(f"Failed to store batch in Supabase: {e}")
    
    def get_labeling_batches(self, limit: int = 10) -> List[LabelingBatch]:
        """
        Get recent labeling batches
        
        Args:
            limit: Maximum number of batches to return
            
        Returns:
            List of labeling batches
        """
        # First try to get batches from Supabase
        if self.supabase:
            try:
                result = self.supabase.table('active_learning_batches') \
                    .select('*') \
                    .order('created_at', desc=True) \
                    .limit(limit) \
                    .execute()
                
                if result.data:
                    return [
                        LabelingBatch(
                            batch_id=item['batch_id'],
                            samples=[SampleCandidate(**s) for s in item['samples']],
                            selection_strategy=item['selection_strategy'],
                            batch_size=item['batch_size'],
                            created_at=item['created_at'],
                            completed_at=item.get('completed_at'),
                            labeled_count=item.get('labeled_count', 0)
                        )
                        for item in result.data
                    ]
            except Exception as e:
                logger.warning(f"Failed to get batches from Supabase: {e}")
        
        # Fallback to local storage
        batches = []
        
        for filename in os.listdir(self.batches_dir):
            if not filename.endswith('.json'):
                continue
            
            file_path = os.path.join(self.batches_dir, filename)
            
            try:
                with open(file_path, 'r') as f:
                    data = json.load(f)
                
                samples = [SampleCandidate(**s) for s in data.get('samples', [])]
                
                batch = LabelingBatch(
                    batch_id=data['batch_id'],
                    samples=samples,
                    selection_strategy=data['selection_strategy'],
                    batch_size=data['batch_size'],
                    created_at=data.get('created_at'),
                    completed_at=data.get('completed_at'),
                    labeled_count=data.get('labeled_count', 0)
                )
                
                batches.append(batch)
            except Exception as e:
                logger.error(f"Error loading batch from {file_path}: {e}")
        
        # Sort by creation time (descending) and limit
        batches.sort(key=lambda b: b.created_at, reverse=True)
        return batches[:limit]
    
    def record_feedback(
        self,
        sample_id: str,
        correct_material_id: str,
        user_notes: Optional[str] = None,
        batch_id: Optional[str] = None,
        update_batch: bool = True
    ) -> Optional[str]:
        """
        Record feedback for a sample
        
        Args:
            sample_id: Sample ID
            correct_material_id: Correct material ID
            user_notes: Optional user notes
            batch_id: Optional batch ID
            update_batch: Whether to update batch statistics
            
        Returns:
            Feedback ID if successful, None otherwise
        """
        # First, find the sample
        sample_path = os.path.join(self.candidates_dir, f"{sample_id}.json")
        sample = None
        
        if os.path.exists(sample_path):
            try:
                with open(sample_path, 'r') as f:
                    sample_data = json.load(f)
                sample = SampleCandidate(**sample_data)
            except Exception as e:
                logger.error(f"Error loading sample from {sample_path}: {e}")
        
        if sample is None:
            logger.error(f"Sample {sample_id} not found")
            return None
        
        # Record feedback using the feedback system if available
        feedback_id = None
        
        if self.feedback_system and sample.prediction:
            try:
                # Get the recognition ID from the prediction if available
                recognition_id = sample.prediction.get("recognition_id", f"al_{sample_id}")
                
                # Store feedback
                feedback_id = self.feedback_system.store_feedback(
                    recognition_id=recognition_id,
                    feedback_type="incorrect" if correct_material_id != sample.prediction.get("materialId") else "correct",
                    correct_material_id=correct_material_id,
                    user_notes=user_notes
                )
                
                logger.info(f"Recorded feedback {feedback_id} for sample {sample_id}")
            except Exception as e:
                logger.error(f"Error recording feedback: {e}")
        
        # Update batch if requested
        if update_batch and batch_id:
            self._update_batch_with_feedback(batch_id, sample_id)
            
            # Check if this feedback triggers retraining
            self._check_feedback_count_trigger(batch_id)
        
        return feedback_id
    
    def _update_batch_with_feedback(self, batch_id: str, sample_id: str) -> None:
        """Update batch statistics with feedback"""
        batch_path = os.path.join(self.batches_dir, f"{batch_id}.json")
        
        if not os.path.exists(batch_path):
            logger.warning(f"Batch {batch_id} not found")
            return
        
        try:
            # Load batch
            with open(batch_path, 'r') as f:
                batch_data = json.load(f)
            
            # Update labeled count
            batch_data['labeled_count'] = batch_data.get('labeled_count', 0) + 1
            
            # Check if batch is completed
            if batch_data['labeled_count'] >= len(batch_data.get('samples', [])):
                batch_data['completed_at'] = datetime.now().isoformat()
            
            # Save batch
            with open(batch_path, 'w') as f:
                json.dump(batch_data, f, indent=2)
            
            # Update in Supabase if available
            if self.supabase:
                try:
                    self.supabase.table('active_learning_batches').update(
                        {
                            'labeled_count': batch_data['labeled_count'],
                            'completed_at': batch_data.get('completed_at')
                        }
                    ).eq('batch_id', batch_id).execute()
                except Exception as e:
                    logger.warning(f"Failed to update batch in Supabase: {e}")
            
        except Exception as e:
            logger.error(f"Error updating batch with feedback: {e}")
    
    def create_retraining_trigger(
        self,
        trigger_type: str,
        threshold: Union[int, float],
        current_value: Optional[Union[int, float]] = 0,
        model_id: Optional[str] = None
    ) -> RetrainingTrigger:
        """
        Create a trigger for model retraining
        
        Args:
            trigger_type: Type of trigger ('count', 'time', 'significance', 'distribution_shift')
            threshold: Threshold value for triggering
            current_value: Current value (defaults to 0)
            model_id: Optional model ID to retrain
            
        Returns:
            Created retraining trigger
        """
        trigger_id = f"trigger_{uuid.uuid4()}"
        
        trigger = RetrainingTrigger(
            trigger_id=trigger_id,
            trigger_type=trigger_type,
            threshold=threshold,
            current_value=current_value if current_value is not None else 0,
            model_id=model_id
        )
        
        # Save trigger
        self._save_trigger(trigger)
        
        # Add to local list
        self.triggers.append(trigger)
        
        return trigger
    
    def _save_trigger(self, trigger: RetrainingTrigger) -> None:
        """Save a retraining trigger to storage"""
        file_path = os.path.join(self.triggers_dir, f"{trigger.trigger_id}.json")
        
        with open(file_path, 'w') as f:
            json.dump(trigger.to_dict(), f, indent=2)
        
        # Store in Supabase if available
        if self.supabase:
            try:
                self.supabase.table('retraining_triggers').upsert(
                    trigger.to_dict(),
                    on_conflict='trigger_id'
                ).execute()
            except Exception as e:
                logger.warning(f"Failed to store trigger in Supabase: {e}")
    
    def _load_triggers(self) -> None:
        """Load retraining triggers from storage"""
        self.triggers = []
        
        # First try to get triggers from Supabase
        if self.supabase:
            try:
                result = self.supabase.table('retraining_triggers') \
                    .select('*') \
                    .eq('status', 'pending') \
                    .execute()
                
                if result.data:
                    self.triggers = [RetrainingTrigger(**item) for item in result.data]
                    return
            except Exception as e:
                logger.warning(f"Failed to get triggers from Supabase: {e}")
        
        # Fallback to local storage
        for filename in os.listdir(self.triggers_dir):
            if not filename.endswith('.json'):
                continue
            
            file_path = os.path.join(self.triggers_dir, filename)
            
            try:
                with open(file_path, 'r') as f:
                    data = json.load(f)
                
                trigger = RetrainingTrigger(**data)
                
                # Only add pending triggers
                if trigger.status == "pending":
                    self.triggers.append(trigger)
            except Exception as e:
                logger.error(f"Error loading trigger from {file_path}: {e}")
    
    def _check_feedback_count_trigger(self, batch_id: Optional[str] = None) -> bool:
        """
        Check if feedback count triggers retraining
        
        Args:
            batch_id: Optional batch ID to check
            
        Returns:
            True if retraining is triggered, False otherwise
        """
        # Find count-based triggers
        count_triggers = [t for t in self.triggers if t.trigger_type == 'count']
        
        if not count_triggers:
            return False
        
        # Calculate current feedback count
        feedback_count = 0
        
        if batch_id:
            # Count feedback for specific batch
            batch_path = os.path.join(self.batches_dir, f"{batch_id}.json")
            
            if os.path.exists(batch_path):
                try:
                    with open(batch_path, 'r') as f:
                        batch_data = json.load(f)
                    
                    feedback_count = batch_data.get('labeled_count', 0)
                except Exception as e:
                    logger.error(f"Error loading batch: {e}")
        else:
            # Count all feedback across batches
            batches = self.get_labeling_batches(limit=100)
            feedback_count = sum(batch.labeled_count for batch in batches)
        
        # Check if any trigger is activated
        triggered = False
        
        for trigger in count_triggers:
            # Update current value
            trigger.current_value = feedback_count
            
            # Check if threshold is reached
            if trigger.current_value >= trigger.threshold:
                trigger.status = "triggered"
                trigger.triggered_at = datetime.now().isoformat()
                triggered = True
                
                # Save updated trigger
                self._save_trigger(trigger)
                
                logger.info(f"Trigger {trigger.trigger_id} activated: "
                           f"{trigger.current_value} feedback items >= threshold {trigger.threshold}")
        
        return triggered
    
    def _check_uncertainty_trigger(self, uncertainty_score: float) -> bool:
        """
        Check if uncertainty triggers retraining
        
        Args:
            uncertainty_score: Uncertainty score to check
            
        Returns:
            True if retraining is triggered, False otherwise
        """
        # Find significance-based triggers
        significance_triggers = [t for t in self.triggers if t.trigger_type == 'significance']
        
        if not significance_triggers:
            return False
        
        # Check if any trigger is activated
        triggered = False
        
        for trigger in significance_triggers:
            # Check if uncertainty score is significant
            if uncertainty_score >= trigger.threshold:
                # Increment current value (count of significant samples)
                trigger.current_value = trigger.current_value + 1
                
                # Check if we've seen enough significant samples
                if trigger.current_value >= 5:  # Require multiple significant samples
                    trigger.status = "triggered"
                    trigger.triggered_at = datetime.now().isoformat()
                    triggered = True
                
                # Save updated trigger
                self._save_trigger(trigger)
                
                if triggered:
                    logger.info(f"Trigger {trigger.trigger_id} activated: "
                               f"Uncertainty {uncertainty_score} >= threshold {trigger.threshold}")
        
        return triggered
    
    def check_retraining_triggers(self) -> List[RetrainingTrigger]:
        """
        Check all retraining triggers
        
        Returns:
            List of triggered triggers
        """
        # Reload triggers
        self._load_triggers()
        
        # Check time-based triggers
        self._check_time_triggers()
        
        # Check distribution shift triggers
        self._check_distribution_shift()
        
        # Return all triggered triggers
        return [t for t in self.triggers if t.status == "triggered"]
    
    def _check_time_triggers(self) -> None:
        """Check time-based triggers"""
        # Find time-based triggers
        time_triggers = [t for t in self.triggers if t.trigger_type == 'time']
        
        if not time_triggers:
            return
        
        current_time = time.time()
        
        for trigger in time_triggers:
            # Check if enough time has passed
            created_time = datetime.fromisoformat(trigger.created_at).timestamp()
            elapsed_hours = (current_time - created_time) / 3600
            
            trigger.current_value = elapsed_hours
            
            if elapsed_hours >= trigger.threshold:
                trigger.status = "triggered"
                trigger.triggered_at = datetime.now().isoformat()
                
                # Save updated trigger
                self._save_trigger(trigger)
                
                logger.info(f"Time-based trigger {trigger.trigger_id} activated: "
                           f"{elapsed_hours:.1f} hours >= threshold {trigger.threshold}")
    
    def _check_distribution_shift(self) -> None:
        """Check for distribution shift in recent samples"""
        # Find distribution shift triggers
        dist_triggers = [t for t in self.triggers if t.trigger_type == 'distribution_shift']
        
        if not dist_triggers:
            return
        
        # This is a simplified check - in practice, would involve more sophisticated
        # distribution shift detection algorithms
        
        # Get recent candidates
        recent_candidates = self.get_candidates(limit=100)
        
        if len(recent_candidates) < 20:  # Need enough samples to detect shift
            return
        
        # Calculate average uncertainty
        avg_uncertainty = sum(c.uncertainty_score for c in recent_candidates) / len(recent_candidates)
        
        for trigger in dist_triggers:
            # Update current value
            trigger.current_value = avg_uncertainty
            
            # Check if threshold is reached
            if avg_uncertainty >= trigger.threshold:
                trigger.status = "triggered"
                trigger.triggered_at = datetime.now().isoformat()
                
                # Save updated trigger
                self._save_trigger(trigger)
                
                logger.info(f"Distribution shift trigger {trigger.trigger_id} activated: "
                           f"Average uncertainty {avg_uncertainty:.4f} >= threshold {trigger.threshold}")
    
    def retrain_model(
        self,
        trigger_id: Optional[str] = None,
        model_id: Optional[str] = None,
        feedback_count_threshold: int = 10,
        retraining_fn: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Initiate model retraining based on trigger
        
        Args:
            trigger_id: Optional trigger ID
            model_id: Optional model ID to retrain
            feedback_count_threshold: Minimum feedback items required
            retraining_fn: Optional retraining function
            
        Returns:
            Retraining results
        """
        # If a trigger ID is provided, find and validate it
        if trigger_id:
            # Find the trigger
            trigger_path = os.path.join(self.triggers_dir, f"{trigger_id}.json")
            
            if not os.path.exists(trigger_path):
                logger.error(f"Trigger {trigger_id} not found")
                return {"status": "error", "message": f"Trigger {trigger_id} not found"}
            
            try:
                with open(trigger_path, 'r') as f:
                    trigger_data = json.load(f)
                
                trigger = RetrainingTrigger(**trigger_data)
                
                # Check if already completed
                if trigger.status == "completed":
                    logger.info(f"Trigger {trigger_id} already completed")
                    return {"status": "completed", "trigger_id": trigger_id}
                
                # Use model ID from trigger if not explicitly provided
                if model_id is None and trigger.model_id:
                    model_id = trigger.model_id
                
            except Exception as e:
                logger.error(f"Error loading trigger: {e}")
                return {"status": "error", "message": f"Error loading trigger: {e}"}
        
        # Check if we have enough feedback data
        if self.feedback_system:
            try:
                # Collect training data
                training_data_result = self.feedback_system.collect_training_data(
                    min_feedback_count=feedback_count_threshold
                )
                
                if training_data_result["status"] != "success":
                    logger.warning("Insufficient feedback data for retraining")
                    return {"status": "insufficient_data", **training_data_result}
                
                # Perform retraining
                if retraining_fn:
                    # Use provided retraining function
                    retrain_result = retraining_fn(training_data_result["data"])
                else:
                    # Use feedback system's built-in retraining
                    retrain_result = self.feedback_system.retrain_model(
                        model_type="hybrid",
                        min_feedback_count=feedback_count_threshold
                    )
                
                # Update trigger status if provided
                if trigger_id:
                    self._update_trigger_status(trigger_id, "completed")
                
                return {
                    "status": "success",
                    "trigger_id": trigger_id,
                    "model_id": model_id,
                    "retraining_result": retrain_result
                }
                
            except Exception as e:
                logger.error(f"Error during retraining: {e}")
                return {"status": "error", "message": f"Error during retraining: {e}"}
        
        else:
            logger.error("Feedback system not available for retraining")
            return {"status": "error", "message": "Feedback system not available"}
    
    def _update_trigger_status(self, trigger_id: str, status: str) -> None:
        """Update trigger status"""
        trigger_path = os.path.join(self.triggers_dir, f"{trigger_id}.json")
        
        if not os.path.exists(trigger_path):
            logger.warning(f"Trigger {trigger_id} not found")
            return
        
        try:
            # Load trigger
            with open(trigger_path, 'r') as f:
                trigger_data = json.load(f)
            
            # Update status
            trigger_data['status'] = status
            
            # Save trigger
            with open(trigger_path, 'w') as f:
                json.dump(trigger_data, f, indent=2)
            
            # Update in Supabase if available
            if self.supabase:
                try:
                    self.supabase.table('retraining_triggers').update(
                        {'status': status}
                    ).eq('trigger_id', trigger_id).execute()
                except Exception as e:
                    logger.warning(f"Failed to update trigger in Supabase: {e}")
            
        except Exception as e:
            logger.error(f"Error updating trigger status: {e}")


def setup_default_retraining_triggers(
    active_learner: ActiveLearner,
    feedback_threshold: int = 50,
    time_threshold_hours: int = 24,
    uncertainty_threshold: float = 0.8,
    distribution_shift_threshold: float = 0.7
) -> Dict[str, RetrainingTrigger]:
    """
    Set up default retraining triggers
    
    Args:
        active_learner: Active learning system
        feedback_threshold: Feedback count threshold
        time_threshold_hours: Time threshold in hours
        uncertainty_threshold: Uncertainty threshold
        distribution_shift_threshold: Distribution shift threshold
        
    Returns:
        Dictionary mapping trigger types to created triggers
    """
    triggers = {}
    
    # Create feedback count trigger
    triggers['count'] = active_learner.create_retraining_trigger(
        trigger_type='count',
        threshold=feedback_threshold,
        current_value=0
    )
    
    # Create time-based trigger
    triggers['time'] = active_learner.create_retraining_trigger(
        trigger_type='time',
        threshold=time_threshold_hours,
        current_value=0
    )
    
    # Create significance trigger
    triggers['significance'] = active_learner.create_retraining_trigger(
        trigger_type='significance',
        threshold=uncertainty_threshold,
        current_value=0
    )
    
    # Create distribution shift trigger
    triggers['distribution_shift'] = active_learner.create_retraining_trigger(
        trigger_type='distribution_shift',
        threshold=distribution_shift_threshold,
        current_value=0
    )
    
    logger.info("Created default retraining triggers")
    
    return triggers


def integrate_with_model_trainer(
    data_dir: str,
    model_dir: str,
    batch_size: int = 10,
    uncertainty_method: str = "entropy",
    enable_auto_retraining: bool = True,
    supabase_url: Optional[str] = None,
    supabase_key: Optional[str] = None
) -> Tuple[ActiveLearner, Callable]:
    """
    Integrate active learning with model trainer
    
    Args:
        data_dir: Data directory
        model_dir: Model directory
        batch_size: Batch size for labeling
        uncertainty_method: Method for calculating uncertainty
        enable_auto_retraining: Whether to enable automated retraining
        supabase_url: Optional Supabase URL
        supabase_key: Optional Supabase API key
        
    Returns:
        Tuple of (active_learner, labeling_function)
    """
    # Create active learning system
    active_learner = ActiveLearner(
        storage_dir=os.path.join(data_dir, "active_learning"),
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        uncertainty_method=uncertainty_method
    )
    
    # Set up default retraining triggers
    if enable_auto_retraining:
        setup_default_retraining_triggers(active_learner)
    
    # Define function to get next batch of samples for labeling
    def get_next_labeling_batch(count: Optional[int] = None) -> LabelingBatch:
        """Get next batch of samples for labeling"""
        return active_learner.select_samples_for_labeling(
            count=count or batch_size,
            strategy="combined"
        )
    
    return active_learner, get_next_labeling_batch


if __name__ == "__main__":
    # Example of how to use the active learning module
    import argparse
    
    parser = argparse.ArgumentParser(description="Active Learning System")
    parser.add_argument("--mode", choices=["register", "select", "check-triggers", "retrain"],
                      required=True, help="Operation mode")
    parser.add_argument("--data-dir", default="./active_learning_data",
                      help="Data directory")
    parser.add_argument("--image-path", help="Path to the image (register mode)")
    parser.add_argument("--prediction-file", help="Path to prediction JSON file (register mode)")
    parser.add_argument("--batch-size", type=int, default=10,
                      help="Batch size for labeling (select mode)")
    parser.add_argument("--trigger-id", help="Trigger ID (retrain mode)")
    
    args = parser.parse_args()
    
    # Create active learning system
    active_learner = ActiveLearner(storage_dir=args.data_dir)
    
    if args.mode == "register":
        if not args.image_path or not args.prediction_file:
            print("Error: image-path and prediction-file are required for register mode")
            sys.exit(1)
        
        # Load prediction
        try:
            with open(args.prediction_file, 'r') as f:
                prediction = json.load(f)
        except Exception as e:
            print(f"Error loading prediction file: {e}")
            sys.exit(1)
        
        # Register candidate
        candidate = active_learner.register_candidate(
            image_path=args.image_path,
            prediction=prediction
        )
        
        print(f"Registered candidate {candidate.sample_id} with uncertainty {candidate.uncertainty_score:.4f}")
    
    elif args.mode == "select":
        # Select samples for labeling
        batch = active_learner.select_samples_for_labeling(count=args.batch_size)
        
        print(f"Selected {len(batch.samples)} samples for labeling:")
        for i, sample in enumerate(batch.samples, 1):
            print(f"  {i}. {sample.sample_id} - {sample.image_path}")
            print(f"     Uncertainty: {sample.uncertainty_score:.4f}")
        
        print(f"\nBatch ID: {batch.batch_id}")
    
    elif args.mode == "check-triggers":
        # Check retraining triggers
        triggered = active_learner.check_retraining_triggers()
        
        print(f"Found {len(triggered)} triggered retraining triggers:")
        for trigger in triggered:
            print(f"  {trigger.trigger_id} - {trigger.trigger_type}")
            print(f"  Threshold: {trigger.threshold}, Current value: {trigger.current_value}")
            print(f"  Triggered at: {trigger.triggered_at}")
    
    elif args.mode == "retrain":
        if not args.trigger_id:
            print("Error: trigger-id is required for retrain mode")
            sys.exit(1)
        
        # Retrain model
        result = active_learner.retrain_model(trigger_id=args.trigger_id)
        
        print(f"Retraining result: {result['status']}")
        if result['status'] == 'success':
            print(f"New model created successfully")