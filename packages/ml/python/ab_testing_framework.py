#!/usr/bin/env python3
"""
Automated A/B Testing Framework for Model Evaluation

This module provides a framework for:
1. Traffic splitting for model variants
2. Statistical significance testing of performance differences
3. Automatic promotion of better-performing models
4. Continuous evaluation and model selection

The framework enables systematic evaluation of different model configurations,
algorithm improvements, and hyperparameter settings with statistical rigor.
"""

import os
import json
import time
import uuid
import numpy as np
import logging
import datetime
from typing import Dict, List, Tuple, Union, Optional, Any, Callable

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('ab_testing')

# Conditionally import statistical packages
try:
    import scipy.stats as stats
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    logger.warning("SciPy not available. Statistical testing will be limited.")

# Conditionally import TensorFlow or PyTorch based on availability
try:
    import tensorflow as tf
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    logger.debug("TensorFlow not available.")

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.debug("PyTorch not available.")


# ---- Experiment Configuration ----

class ABExperimentConfig:
    """Configuration for an A/B testing experiment"""
    
    def __init__(self, 
                experiment_name: str,
                description: str = "",
                traffic_split: Dict[str, float] = None,
                metrics: List[str] = None,
                primary_metric: str = "accuracy",
                min_samples: int = 100,
                significance_level: float = 0.05,
                auto_promote: bool = False,
                variants: Dict[str, Dict[str, Any]] = None):
        """
        Initialize A/B experiment configuration
        
        Args:
            experiment_name: Unique name for the experiment
            description: Detailed description of what's being tested
            traffic_split: Dictionary of {variant_name: traffic_fraction}
            metrics: List of metrics to track
            primary_metric: Primary metric for statistical testing
            min_samples: Minimum samples per variant before testing
            significance_level: p-value threshold for significance
            auto_promote: Whether to automatically promote winning variants
            variants: Dictionary of variant configurations
        """
        self.experiment_name = experiment_name
        self.description = description
        self.metrics = metrics or ["accuracy", "loss", "inference_time"]
        self.primary_metric = primary_metric
        self.min_samples = min_samples
        self.significance_level = significance_level
        self.auto_promote = auto_promote
        self.experiment_id = str(uuid.uuid4())
        self.start_time = time.time()
        
        # Set default traffic split if not provided
        if traffic_split is None:
            self.traffic_split = {"control": 0.5, "variant": 0.5}
        else:
            # Normalize traffic split to ensure sum is 1.0
            total = sum(traffic_split.values())
            self.traffic_split = {k: v / total for k, v in traffic_split.items()}
        
        # Validate and store variant configurations
        self.variants = variants or {}
        if "control" not in self.variants and "control" in self.traffic_split:
            self.variants["control"] = {"name": "control", "description": "Baseline model"}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary for serialization"""
        return {
            "experiment_name": self.experiment_name,
            "experiment_id": self.experiment_id,
            "description": self.description,
            "traffic_split": self.traffic_split,
            "metrics": self.metrics,
            "primary_metric": self.primary_metric,
            "min_samples": self.min_samples,
            "significance_level": self.significance_level,
            "auto_promote": self.auto_promote,
            "variants": self.variants,
            "start_time": self.start_time,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ABExperimentConfig':
        """Create configuration from dictionary"""
        config = cls(
            experiment_name=data["experiment_name"],
            description=data.get("description", ""),
            traffic_split=data.get("traffic_split"),
            metrics=data.get("metrics"),
            primary_metric=data.get("primary_metric", "accuracy"),
            min_samples=data.get("min_samples", 100),
            significance_level=data.get("significance_level", 0.05),
            auto_promote=data.get("auto_promote", False),
            variants=data.get("variants")
        )
        config.experiment_id = data.get("experiment_id", str(uuid.uuid4()))
        config.start_time = data.get("start_time", time.time())
        return config


# ---- Experiment Results ----

class ABExperimentResults:
    """Results storage and analysis for an A/B testing experiment"""
    
    def __init__(self, config: ABExperimentConfig):
        """
        Initialize results storage
        
        Args:
            config: A/B experiment configuration
        """
        self.config = config
        self.variant_results = {variant: {} for variant in config.traffic_split.keys()}
        self.variant_metrics = {variant: {metric: [] for metric in config.metrics} 
                              for variant in config.traffic_split.keys()}
        self.sample_counts = {variant: 0 for variant in config.traffic_split.keys()}
        self.last_analysis_time = None
        self.winner = None
        self.analysis_history = []
    
    def record_result(self, variant: str, metrics: Dict[str, float]) -> None:
        """
        Record a result for a variant
        
        Args:
            variant: Name of the variant
            metrics: Dictionary of metric values
        """
        if variant not in self.variant_results:
            logger.warning(f"Unknown variant: {variant}. Result not recorded.")
            return
        
        # Record metrics
        for metric, value in metrics.items():
            if metric in self.variant_metrics[variant]:
                self.variant_metrics[variant][metric].append(value)
        
        # Update sample count
        self.sample_counts[variant] += 1
    
    def analyze(self, force: bool = False) -> Dict[str, Any]:
        """
        Analyze current results to determine if there is a statistically significant winner
        
        Args:
            force: Force analysis even if minimum sample sizes haven't been reached
            
        Returns:
            Analysis results
        """
        # Check if we have enough samples
        if not force:
            for variant, count in self.sample_counts.items():
                if count < self.config.min_samples:
                    logger.info(f"Not enough samples for variant {variant}: {count}/{self.config.min_samples}")
                    return {
                        "status": "insufficient_data",
                        "sample_counts": self.sample_counts,
                        "min_samples": self.config.min_samples
                    }
        
        # Calculate summary statistics
        summary = self._calculate_summary_stats()
        
        # Perform statistical testing
        comparison = self._perform_statistical_testing()
        
        # Determine winner
        winner_data = self._determine_winner(comparison)
        
        # Prepare analysis result
        analysis = {
            "timestamp": time.time(),
            "sample_counts": self.sample_counts,
            "summary_statistics": summary,
            "statistical_comparison": comparison,
            "winner": winner_data["winner"],
            "is_significant": winner_data["is_significant"],
            "p_value": winner_data["p_value"]
        }
        
        # Store analysis in history
        self.analysis_history.append(analysis)
        self.last_analysis_time = analysis["timestamp"]
        self.winner = winner_data["winner"]
        
        return analysis
    
    def _calculate_summary_stats(self) -> Dict[str, Any]:
        """Calculate summary statistics for each variant and metric"""
        summary = {}
        
        for variant in self.variant_metrics:
            summary[variant] = {}
            for metric in self.variant_metrics[variant]:
                values = self.variant_metrics[variant][metric]
                if values:
                    summary[variant][metric] = {
                        "mean": float(np.mean(values)),
                        "std": float(np.std(values)),
                        "min": float(np.min(values)),
                        "max": float(np.max(values)),
                        "median": float(np.median(values)),
                        "count": len(values)
                    }
                else:
                    summary[variant][metric] = {
                        "mean": None,
                        "std": None,
                        "min": None,
                        "max": None,
                        "median": None,
                        "count": 0
                    }
        
        return summary
    
    def _perform_statistical_testing(self) -> Dict[str, Any]:
        """Perform statistical testing between variants"""
        primary_metric = self.config.primary_metric
        comparison = {}
        variants = list(self.variant_metrics.keys())
        
        # Check if SciPy is available for advanced statistical tests
        if not SCIPY_AVAILABLE:
            logger.warning("SciPy not available. Using basic statistical comparison.")
            
            # Perform basic comparisons without statistical tests
            for i, variant1 in enumerate(variants):
                for variant2 in variants[i+1:]:
                    values1 = self.variant_metrics[variant1][primary_metric]
                    values2 = self.variant_metrics[variant2][primary_metric]
                    
                    if not values1 or not values2:
                        continue
                    
                    mean1 = np.mean(values1)
                    mean2 = np.mean(values2)
                    
                    comparison[f"{variant1}_vs_{variant2}"] = {
                        "mean_difference": float(mean1 - mean2),
                        "better_variant": variant1 if mean1 > mean2 else variant2,
                        "is_significant": None,  # Cannot determine without statistical tests
                        "p_value": None
                    }
            
            return comparison
        
        # Perform t-tests for each pair of variants
        for i, variant1 in enumerate(variants):
            for variant2 in variants[i+1:]:
                values1 = self.variant_metrics[variant1][primary_metric]
                values2 = self.variant_metrics[variant2][primary_metric]
                
                if not values1 or not values2:
                    continue
                
                # Perform two-sample t-test
                t_stat, p_value = stats.ttest_ind(values1, values2, equal_var=False)
                
                mean1 = np.mean(values1)
                mean2 = np.mean(values2)
                
                comparison[f"{variant1}_vs_{variant2}"] = {
                    "t_statistic": float(t_stat),
                    "p_value": float(p_value),
                    "mean_difference": float(mean1 - mean2),
                    "better_variant": variant1 if mean1 > mean2 else variant2,
                    "is_significant": p_value < self.config.significance_level,
                    "confidence_level": 1.0 - self.config.significance_level
                }
        
        return comparison
    
    def _determine_winner(self, comparison: Dict[str, Any]) -> Dict[str, Any]:
        """Determine the overall winner from the comparisons"""
        if not comparison:
            return {"winner": None, "is_significant": False, "p_value": None}
        
        # For each variant, count how many times it wins significantly
        significant_wins = {variant: 0 for variant in self.variant_metrics.keys()}
        best_p_value = 1.0
        
        for comp_key, comp_data in comparison.items():
            if comp_data.get("is_significant", False):
                better_variant = comp_data["better_variant"]
                significant_wins[better_variant] += 1
                
                # Track the best p-value for this winner
                if comp_data["p_value"] < best_p_value:
                    best_p_value = comp_data["p_value"]
        
        # Find the variant with the most significant wins
        if max(significant_wins.values()) > 0:
            max_wins = max(significant_wins.values())
            winners = [v for v, wins in significant_wins.items() if wins == max_wins]
            
            if len(winners) == 1:
                return {
                    "winner": winners[0],
                    "is_significant": True,
                    "p_value": best_p_value
                }
            else:
                # Multiple variants tied for most significant wins
                # Use the one with highest mean on primary metric
                primary_metric = self.config.primary_metric
                best_mean = -float('inf')
                best_variant = None
                
                for variant in winners:
                    values = self.variant_metrics[variant][primary_metric]
                    if values:
                        mean = np.mean(values)
                        if mean > best_mean:
                            best_mean = mean
                            best_variant = variant
                
                return {
                    "winner": best_variant,
                    "is_significant": True,
                    "p_value": best_p_value
                }
        
        # No significant winner
        return {"winner": None, "is_significant": False, "p_value": None}
    
    def get_latest_summary(self) -> Dict[str, Any]:
        """Get the latest summary of experiment results"""
        summary = {
            "experiment_id": self.config.experiment_id,
            "experiment_name": self.config.experiment_name,
            "sample_counts": self.sample_counts,
            "duration_days": (time.time() - self.config.start_time) / (60 * 60 * 24),
            "metrics_summary": self._calculate_summary_stats(),
            "winner": self.winner,
            "analysis_count": len(self.analysis_history)
        }
        
        # Add the latest analysis if available
        if self.analysis_history:
            latest = self.analysis_history[-1]
            summary["latest_analysis"] = {
                "timestamp": latest["timestamp"],
                "winner": latest["winner"],
                "is_significant": latest["is_significant"],
                "p_value": latest["p_value"]
            }
        
        return summary
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert results to dictionary for serialization"""
        return {
            "experiment_id": self.config.experiment_id,
            "variant_metrics": self.variant_metrics,
            "sample_counts": self.sample_counts,
            "last_analysis_time": self.last_analysis_time,
            "winner": self.winner,
            "analysis_history": self.analysis_history
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any], config: ABExperimentConfig) -> 'ABExperimentResults':
        """Create results from dictionary"""
        results = cls(config)
        results.variant_metrics = data.get("variant_metrics", {})
        results.sample_counts = data.get("sample_counts", {})
        results.last_analysis_time = data.get("last_analysis_time")
        results.winner = data.get("winner")
        results.analysis_history = data.get("analysis_history", [])
        return results


# ---- Traffic Splitter ----

class TrafficSplitter:
    """
    Class to manage the splitting of incoming samples between variants
    based on configured traffic allocation.
    """
    
    def __init__(self, config: ABExperimentConfig):
        """
        Initialize traffic splitter
        
        Args:
            config: A/B experiment configuration
        """
        self.config = config
        self.variant_weights = list(config.traffic_split.values())
        self.variant_names = list(config.traffic_split.keys())
        
        # Cache for stable assignment
        self.assignment_cache = {}
    
    def assign_variant(self, sample_id: str) -> str:
        """
        Assign a variant to a sample based on traffic split
        
        Args:
            sample_id: Unique identifier for the sample
            
        Returns:
            Assigned variant name
        """
        # Check cache for consistent assignment
        if sample_id in self.assignment_cache:
            return self.assignment_cache[sample_id]
        
        # Deterministic random assignment based on hash of sample_id
        hash_val = hash(sample_id) % 10000 / 10000
        
        # Use the hash value to choose a variant based on weights
        cumulative_weight = 0
        for i, weight in enumerate(self.variant_weights):
            cumulative_weight += weight
            if hash_val < cumulative_weight:
                variant = self.variant_names[i]
                self.assignment_cache[sample_id] = variant
                return variant
        
        # Fallback to the last variant
        variant = self.variant_names[-1]
        self.assignment_cache[sample_id] = variant
        return variant
    
    def get_variant_config(self, variant: str) -> Dict[str, Any]:
        """
        Get configuration for a specific variant
        
        Args:
            variant: Variant name
            
        Returns:
            Variant configuration dictionary
        """
        if variant in self.config.variants:
            return self.config.variants[variant]
        else:
            logger.warning(f"No configuration found for variant: {variant}")
            return {}


# ---- Experiment Manager ----

class ABExperimentManager:
    """
    Manager for creating, running, and analyzing A/B experiments.
    Handles persistence of experiment configurations and results.
    """
    
    def __init__(self, storage_dir: str = "./experiments"):
        """
        Initialize experiment manager
        
        Args:
            storage_dir: Directory to store experiment data
        """
        self.storage_dir = storage_dir
        self.active_experiments = {}
        self.traffic_splitters = {}
        
        # Create storage directory if it doesn't exist
        os.makedirs(storage_dir, exist_ok=True)
        
        # Load existing experiments
        self._load_experiments()
    
    def create_experiment(self, config: ABExperimentConfig) -> str:
        """
        Create a new A/B testing experiment
        
        Args:
            config: Experiment configuration
            
        Returns:
            Experiment ID
        """
        # Create results storage
        results = ABExperimentResults(config)
        
        # Create traffic splitter
        splitter = TrafficSplitter(config)
        
        # Store experiment
        experiment_id = config.experiment_id
        self.active_experiments[experiment_id] = {
            "config": config,
            "results": results
        }
        self.traffic_splitters[experiment_id] = splitter
        
        # Save experiment configuration
        self._save_experiment(experiment_id)
        
        logger.info(f"Created experiment: {config.experiment_name} ({experiment_id})")
        return experiment_id
    
    def record_sample(self, experiment_id: str, sample_id: str, metrics: Dict[str, float]) -> str:
        """
        Record a sample for an experiment
        
        Args:
            experiment_id: ID of the experiment
            sample_id: Unique identifier for the sample
            metrics: Dictionary of metric values
            
        Returns:
            Assigned variant name
        """
        if experiment_id not in self.active_experiments:
            logger.error(f"Unknown experiment: {experiment_id}")
            return None
        
        # Get the traffic splitter
        splitter = self.traffic_splitters[experiment_id]
        
        # Assign variant
        variant = splitter.assign_variant(sample_id)
        
        # Record result
        results = self.active_experiments[experiment_id]["results"]
        results.record_result(variant, metrics)
        
        # Save periodically (every 10 samples)
        if sum(results.sample_counts.values()) % 10 == 0:
            self._save_experiment(experiment_id)
        
        # If auto-promote is enabled and we have enough samples, analyze results
        config = self.active_experiments[experiment_id]["config"]
        min_count = min(results.sample_counts.values())
        
        if config.auto_promote and min_count >= config.min_samples:
            # Only analyze every 10 new samples to avoid excessive computation
            if sum(results.sample_counts.values()) % 10 == 0:
                self.analyze_experiment(experiment_id)
        
        return variant
    
    def analyze_experiment(self, experiment_id: str, force: bool = False) -> Dict[str, Any]:
        """
        Analyze current results for an experiment
        
        Args:
            experiment_id: ID of the experiment
            force: Force analysis even if minimum sample sizes haven't been reached
            
        Returns:
            Analysis results
        """
        if experiment_id not in self.active_experiments:
            logger.error(f"Unknown experiment: {experiment_id}")
            return None
        
        results = self.active_experiments[experiment_id]["results"]
        analysis = results.analyze(force=force)
        
        # Save after analysis
        self._save_experiment(experiment_id)
        
        return analysis
    
    def get_experiment_summary(self, experiment_id: str) -> Dict[str, Any]:
        """
        Get summary information about an experiment
        
        Args:
            experiment_id: ID of the experiment
            
        Returns:
            Experiment summary
        """
        if experiment_id not in self.active_experiments:
            logger.error(f"Unknown experiment: {experiment_id}")
            return None
        
        config = self.active_experiments[experiment_id]["config"]
        results = self.active_experiments[experiment_id]["results"]
        
        summary = results.get_latest_summary()
        summary["description"] = config.description
        summary["traffic_split"] = config.traffic_split
        summary["metrics"] = config.metrics
        summary["primary_metric"] = config.primary_metric
        summary["auto_promote"] = config.auto_promote
        
        return summary
    
    def list_experiments(self) -> List[Dict[str, Any]]:
        """
        Get a list of all experiments
        
        Returns:
            List of experiment summaries
        """
        summaries = []
        for experiment_id in self.active_experiments:
            config = self.active_experiments[experiment_id]["config"]
            results = self.active_experiments[experiment_id]["results"]
            
            summaries.append({
                "experiment_id": experiment_id,
                "name": config.experiment_name,
                "description": config.description,
                "start_time": config.start_time,
                "duration_days": (time.time() - config.start_time) / (60 * 60 * 24),
                "sample_counts": results.sample_counts,
                "winner": results.winner
            })
        
        return summaries
    
    def end_experiment(self, experiment_id: str) -> Dict[str, Any]:
        """
        End an experiment and get final results
        
        Args:
            experiment_id: ID of the experiment
            
        Returns:
            Final experiment summary
        """
        if experiment_id not in self.active_experiments:
            logger.error(f"Unknown experiment: {experiment_id}")
            return None
        
        # Force final analysis
        analysis = self.analyze_experiment(experiment_id, force=True)
        
        # Get summary
        summary = self.get_experiment_summary(experiment_id)
        summary["final_analysis"] = analysis
        summary["end_time"] = time.time()
        
        # Mark experiment as completed
        config = self.active_experiments[experiment_id]["config"]
        config.end_time = time.time()
        
        # Save final state
        self._save_experiment(experiment_id)
        
        logger.info(f"Ended experiment: {config.experiment_name} ({experiment_id})")
        return summary
    
    def _save_experiment(self, experiment_id: str) -> None:
        """Save experiment configuration and results to disk"""
        experiment = self.active_experiments[experiment_id]
        config = experiment["config"]
        results = experiment["results"]
        
        # Create experiment directory
        experiment_dir = os.path.join(self.storage_dir, experiment_id)
        os.makedirs(experiment_dir, exist_ok=True)
        
        # Save configuration
        config_path = os.path.join(experiment_dir, "config.json")
        with open(config_path, 'w') as f:
            json.dump(config.to_dict(), f, indent=2)
        
        # Save results
        results_path = os.path.join(experiment_dir, "results.json")
        with open(results_path, 'w') as f:
            json.dump(results.to_dict(), f, indent=2)
    
    def _load_experiments(self) -> None:
        """Load existing experiments from disk"""
        if not os.path.exists(self.storage_dir):
            return
        
        experiment_dirs = [d for d in os.listdir(self.storage_dir) 
                         if os.path.isdir(os.path.join(self.storage_dir, d))]
        
        for experiment_id in experiment_dirs:
            experiment_dir = os.path.join(self.storage_dir, experiment_id)
            config_path = os.path.join(experiment_dir, "config.json")
            results_path = os.path.join(experiment_dir, "results.json")
            
            if os.path.exists(config_path) and os.path.exists(results_path):
                try:
                    # Load configuration
                    with open(config_path, 'r') as f:
                        config_dict = json.load(f)
                    config = ABExperimentConfig.from_dict(config_dict)
                    
                    # Load results
                    with open(results_path, 'r') as f:
                        results_dict = json.load(f)
                    results = ABExperimentResults.from_dict(results_dict, config)
                    
                    # Create traffic splitter
                    splitter = TrafficSplitter(config)
                    
                    # Store experiment
                    self.active_experiments[experiment_id] = {
                        "config": config,
                        "results": results
                    }
                    self.traffic_splitters[experiment_id] = splitter
                    
                    logger.info(f"Loaded experiment: {config.experiment_name} ({experiment_id})")
                except Exception as e:
                    logger.error(f"Error loading experiment {experiment_id}: {e}")


# ---- Model A/B Testing ----

class ModelABTesting:
    """
    Specialized A/B testing for machine learning models.
    Compares multiple model variants in terms of accuracy, inference time, etc.
    """
    
    def __init__(self, experiment_name: str, variants: Dict[str, Any], 
                primary_metric: str = "accuracy", auto_promote: bool = False):
        """
        Initialize model A/B testing
        
        Args:
            experiment_name: Name of the experiment
            variants: Dictionary of variant models
            primary_metric: Primary metric for comparison
            auto_promote: Whether to automatically promote winning models
        """
        self.experiment_name = experiment_name
        self.variants = variants
        self.primary_metric = primary_metric
        self.auto_promote = auto_promote
        
        # Create experiment manager
        self.manager = ABExperimentManager()
        
        # Create experiment configuration
        self.config = self._create_config()
        
        # Create experiment
        self.experiment_id = self.manager.create_experiment(self.config)
    
    def _create_config(self) -> ABExperimentConfig:
        """Create experiment configuration"""
        # Set up traffic split (equal by default)
        traffic_split = {name: 1.0 / len(self.variants) for name in self.variants.keys()}
        
        variant_configs = {}
        for name, model in self.variants.items():
            variant_configs[name] = {
                "name": name,
                "model_type": type(model).__name__ if model is not None else "None",
                "description": f"Model variant: {name}"
            }
        
        return ABExperimentConfig(
            experiment_name=self.experiment_name,
            description=f"Model comparison: {', '.join(self.variants.keys())}",
            traffic_split=traffic_split,
            metrics=["accuracy", "precision", "recall", "f1", "inference_time"],
            primary_metric=self.primary_metric,
            min_samples=100,
            significance_level=0.05,
            auto_promote=self.auto_promote,
            variants=variant_configs
        )
    
    def evaluate_sample(self, sample_id: str, inputs: Any, true_labels: Any) -> Dict[str, Any]:
        """
        Evaluate a sample using the appropriate model variant
        
        Args:
            sample_id: Unique identifier for the sample
            inputs: Model inputs
            true_labels: Ground truth labels
            
        Returns:
            Evaluation results
        """
        # Assign variant
        variant = self.manager.traffic_splitters[self.experiment_id].assign_variant(sample_id)
        
        # Get the model
        model = self.variants[variant]
        
        # Evaluate model
        start_time = time.time()
        predictions = self._get_predictions(model, inputs)
        inference_time = time.time() - start_time
        
        # Calculate metrics
        metrics = self._calculate_metrics(predictions, true_labels)
        metrics["inference_time"] = inference_time
        
        # Record result
        self.manager.record_sample(self.experiment_id, sample_id, metrics)
        
        return {
            "variant": variant,
            "predictions": predictions,
            "metrics": metrics
        }
    
    def _get_predictions(self, model: Any, inputs: Any) -> np.ndarray:
        """Get predictions from a model"""
        if model is None:
            return np.zeros(1)  # Default prediction
        
        if TF_AVAILABLE and isinstance(model, tf.keras.Model):
            return model.predict(inputs)
        
        if TORCH_AVAILABLE and isinstance(model, torch.nn.Module):
            model.eval()
            with torch.no_grad():
                if isinstance(inputs, np.ndarray):
                    inputs = torch.from_numpy(inputs).float()
                outputs = model(inputs)
                return outputs.numpy() if hasattr(outputs, 'numpy') else outputs.detach().cpu().numpy()
        
        # Generic model with predict method
        if hasattr(model, 'predict'):
            return model.predict(inputs)
        
        # Generic callable model
        if callable(model):
            return model(inputs)
        
        logger.error(f"Unsupported model type: {type(model)}")
        return np.zeros(1)  # Default prediction
    
    def _calculate_metrics(self, predictions: np.ndarray, true_labels: Any) -> Dict[str, float]:
        """Calculate evaluation metrics"""
        metrics = {}
        
        # Handle different prediction types
        if len(predictions.shape) > 1 and predictions.shape[1] > 1:
            # Multi-class predictions
            pred_labels = np.argmax(predictions, axis=1)
        else:
            # Binary or single-value predictions
            pred_labels = (predictions > 0.5).astype(int) if len(predictions.shape) == 2 else predictions
        
        # Ensure true_labels is numpy array
        if not isinstance(true_labels, np.ndarray):
            true_labels = np.array(true_labels)
        
        # Convert one-hot encoded labels if needed
        if len(true_labels.shape) > 1 and true_labels.shape[1] > 1:
            true_labels = np.argmax(true_labels, axis=1)
        
        # Calculate basic metrics
        correct = (pred_labels == true_labels).sum()
        total = len(true_labels)
        metrics["accuracy"] = float(correct) / total if total > 0 else 0.0
        
        # Try to calculate more detailed metrics if scipy is available
        try:
            # Simple versions of precision, recall, f1
            tp = np.sum((pred_labels == 1) & (true_labels == 1))
            fp = np.sum((pred_labels == 1) & (true_labels == 0))
            fn = np.sum((pred_labels == 0) & (true_labels == 1))
            
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
            
            metrics["precision"] = float(precision)
            metrics["recall"] = float(recall)
            metrics["f1"] = float(f1)
        except:
            logger.warning("Error calculating detailed metrics")
            metrics["precision"] = 0.0
            metrics["recall"] = 0.0
            metrics["f1"] = 0.0
        
        return metrics
    
    def get_results(self) -> Dict[str, Any]:
        """Get current experiment results"""
        return self.manager.get_experiment_summary(self.experiment_id)
    
    def analyze(self) -> Dict[str, Any]:
        """Analyze current results"""
        return self.manager.analyze_experiment(self.experiment_id)
    
    def end_experiment(self) -> Dict[str, Any]:
        """End the experiment and get final results"""
        return self.manager.end_experiment(self.experiment_id)
    
    def get_best_model(self) -> Any:
        """Get the best performing model based on experiment results"""
        summary = self.get_results()
        winner = summary.get("winner")
        
        if winner and winner in self.variants:
            return self.variants[winner]
        
        # No clear winner, return the control variant
        return self.variants.get("control")


# ---- PyTorch Integration ----

if TORCH_AVAILABLE:
    class ABTestCallback(torch.nn.Module):
        """
        PyTorch callback for A/B testing during training
        Periodically evaluates model variants on a validation set
        """
        
        def __init__(self, experiment_name: str, val_loader, 
                    eval_interval: int = 10, auto_promote: bool = False):
            """
            Initialize A/B test callback
            
            Args:
                experiment_name: Name of the experiment
                val_loader: Validation data loader
                eval_interval: How often to evaluate (epochs)
                auto_promote: Whether to automatically promote winning models
            """
            super(ABTestCallback, self).__init__()
            self.experiment_name = experiment_name
            self.val_loader = val_loader
            self.eval_interval = eval_interval
            self.auto_promote = auto_promote
            
            self.variants = {}
            self.current_epoch = 0
            self.ab_testing = None
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        def add_variant(self, name: str, model: torch.nn.Module) -> None:
            """Add a model variant to the experiment"""
            self.variants[name] = model
        
        def on_epoch_end(self) -> None:
            """Called at the end of each epoch"""
            self.current_epoch += 1
            
            # Skip if not at evaluation interval
            if self.current_epoch % self.eval_interval != 0:
                return
            
            # Initialize A/B testing if needed
            if self.ab_testing is None and len(self.variants) > 1:
                self.ab_testing = ModelABTesting(
                    experiment_name=f"{self.experiment_name}_epoch_{self.current_epoch}",
                    variants=self.variants,
                    primary_metric="accuracy",
                    auto_promote=self.auto_promote
                )
            
            # Evaluate all variants on validation set
            self._evaluate_variants()
            
            # Analyze results
            if self.ab_testing:
                analysis = self.ab_testing.analyze()
                if analysis.get("is_significant", False):
                    logger.info(f"Significant result at epoch {self.current_epoch}: " +
                               f"Winner is {analysis.get('winner')}")
        
        def _evaluate_variants(self) -> None:
            """Evaluate all model variants on validation set"""
            if not self.ab_testing:
                return
            
            # Set all models to evaluation mode
            for model in self.variants.values():
                model.eval()
            
            with torch.no_grad():
                for batch_idx, (inputs, targets) in enumerate(self.val_loader):
                    inputs = inputs.to(self.device)
                    targets = targets.to(self.device)
                    
                    # Generate a unique sample ID for this batch
                    sample_id = f"epoch_{self.current_epoch}_batch_{batch_idx}"
                    
                    # Evaluate the sample
                    self.ab_testing.evaluate_sample(
                        sample_id=sample_id,
                        inputs=inputs,
                        true_labels=targets.cpu().numpy()
                    )
            
            # Set all models back to training mode
            for model in self.variants.values():
                model.train()
        
        def get_best_model(self) -> torch.nn.Module:
            """Get the best performing model based on experiment results"""
            if not self.ab_testing:
                return list(self.variants.values())[0]  # Return first model if no A/B testing
            
            return self.ab_testing.get_best_model()


# ---- TensorFlow Integration ----

if TF_AVAILABLE:
    class ABTestCallbackTF(tf.keras.callbacks.Callback):
        """
        TensorFlow callback for A/B testing during training
        Periodically evaluates model variants on a validation set
        """
        
        def __init__(self, experiment_name: str, validation_data, 
                    eval_interval: int = 10, auto_promote: bool = False):
            """
            Initialize A/B test callback
            
            Args:
                experiment_name: Name of the experiment
                validation_data: Tuple of (x_val, y_val) or tf.data.Dataset
                eval_interval: How often to evaluate (epochs)
                auto_promote: Whether to automatically promote winning models
            """
            super(ABTestCallbackTF, self).__init__()
            self.experiment_name = experiment_name
            self.validation_data = validation_data
            self.eval_interval = eval_interval
            self.auto_promote = auto_promote
            
            self.variants = {}
            self.current_epoch = 0
            self.ab_testing = None
        
        def add_variant(self, name: str, model: tf.keras.Model) -> None:
            """Add a model variant to the experiment"""
            self.variants[name] = model
        
        def on_epoch_end(self, epoch, logs=None) -> None:
            """Called at the end of each epoch"""
            self.current_epoch += 1
            
            # Skip if not at evaluation interval
            if self.current_epoch % self.eval_interval != 0:
                return
            
            # Initialize A/B testing if needed
            if self.ab_testing is None and len(self.variants) > 1:
                self.ab_testing = ModelABTesting(
                    experiment_name=f"{self.experiment_name}_epoch_{self.current_epoch}",
                    variants=self.variants,
                    primary_metric="accuracy",
                    auto_promote=self.auto_promote
                )
            
            # Evaluate all variants on validation set
            self._evaluate_variants()
            
            # Analyze results
            if self.ab_testing:
                analysis = self.ab_testing.analyze()
                if analysis.get("is_significant", False):
                    logger.info(f"Significant result at epoch {self.current_epoch}: " +
                               f"Winner is {analysis.get('winner')}")
        
        def _evaluate_variants(self) -> None:
            """Evaluate all model variants on validation set"""
            if not self.ab_testing:
                return
            
            # Handle different validation data formats
            if isinstance(self.validation_data, tf.data.Dataset):
                self._evaluate_on_dataset()
            else:
                self._evaluate_on_arrays()
        
        def _evaluate_on_dataset(self) -> None:
            """Evaluate on a TensorFlow Dataset"""
            batch_idx = 0
            for inputs, targets in self.validation_data:
                # Generate a unique sample ID for this batch
                sample_id = f"epoch_{self.current_epoch}_batch_{batch_idx}"
                
                # Evaluate the sample
                self.ab_testing.evaluate_sample(
                    sample_id=sample_id,
                    inputs=inputs,
                    true_labels=targets.numpy()
                )
                
                batch_idx += 1
        
        def _evaluate_on_arrays(self) -> None:
            """Evaluate on numpy arrays"""
            x_val, y_val = self.validation_data
            
            # Process validation data in batches
            batch_size = 32
            num_samples = len(x_val)
            
            for i in range(0, num_samples, batch_size):
                end = min(i + batch_size, num_samples)
                batch_x = x_val[i:end]
                batch_y = y_val[i:end]
                
                # Generate a unique sample ID for this batch
                sample_id = f"epoch_{self.current_epoch}_batch_{i//batch_size}"
                
                # Evaluate the sample
                self.ab_testing.evaluate_sample(
                    sample_id=sample_id,
                    inputs=batch_x,
                    true_labels=batch_y
                )
        
        def get_best_model(self) -> tf.keras.Model:
            """Get the best performing model based on experiment results"""
            if not self.ab_testing:
                return list(self.variants.values())[0]  # Return first model if no A/B testing
            
            return self.ab_testing.get_best_model()


# ---- Visualizations and Reporting ----

def generate_experiment_report(experiment_id: str, manager: ABExperimentManager, 
                              output_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Generate a comprehensive report for an experiment
    
    Args:
        experiment_id: ID of the experiment
        manager: A/B experiment manager
        output_path: Path to save the report (None for no saving)
        
    Returns:
        Report data
    """
    summary = manager.get_experiment_summary(experiment_id)
    
    if not summary:
        return None
    
    # Get experiment details
    config = manager.active_experiments[experiment_id]["config"]
    results = manager.active_experiments[experiment_id]["results"]
    
    # Format report
    report = {
        "experiment_id": experiment_id,
        "name": summary["experiment_name"],
        "description": summary["description"],
        "start_time": datetime.datetime.fromtimestamp(config.start_time).strftime('%Y-%m-%d %H:%M:%S'),
        "duration_days": round(summary["duration_days"], 2),
        "traffic_split": summary["traffic_split"],
        "metrics": summary["metrics"],
        "primary_metric": summary["primary_metric"],
        "variants": list(summary["traffic_split"].keys()),
        "sample_counts": summary["sample_counts"],
        "total_samples": sum(summary["sample_counts"].values()),
        "metrics_summary": summary["metrics_summary"],
        "winner": summary["winner"],
        "analysis_history": results.analysis_history
    }
    
    # Add latest analysis if available
    if "latest_analysis" in summary:
        report["latest_analysis"] = summary["latest_analysis"]
    
    # Save report if output path is provided
    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2)
    
    return report


def plot_experiment_results(experiment_id: str, manager: ABExperimentManager, 
                           metric: str = None, output_path: Optional[str] = None):
    """
    Plot results for an experiment
    
    Args:
        experiment_id: ID of the experiment
        manager: A/B experiment manager
        metric: Metric to plot (None for primary metric)
        output_path: Path to save the plot (None for display)
    """
    try:
        import matplotlib.pyplot as plt
        import pandas as pd
    except ImportError:
        logger.error("matplotlib and pandas are required for plotting")
        return
    
    summary = manager.get_experiment_summary(experiment_id)
    
    if not summary:
        return
    
    # Get experiment details
    config = manager.active_experiments[experiment_id]["config"]
    results = manager.active_experiments[experiment_id]["results"]
    
    # Use primary metric if not specified
    if not metric:
        metric = config.primary_metric
    
    # Create figure
    plt.figure(figsize=(12, 8))
    
    # Plot metrics for each variant
    for variant in results.variant_metrics:
        values = results.variant_metrics[variant].get(metric, [])
        if values:
            plt.plot(values, label=f"{variant} (n={len(values)})")
    
    # Add rolling average
    for variant in results.variant_metrics:
        values = results.variant_metrics[variant].get(metric, [])
        if len(values) > 10:
            rolling_avg = pd.Series(values).rolling(window=10).mean()
            plt.plot(rolling_avg, linestyle='--', alpha=0.6, 
                    label=f"{variant} (10-sample avg)")
    
    # Add current means as horizontal lines
    for variant in results.variant_metrics:
        values = results.variant_metrics[variant].get(metric, [])
        if values:
            mean = np.mean(values)
            plt.axhline(y=mean, linestyle=':', alpha=0.5, 
                      color=plt.gca().lines[-1].get_color())
            plt.text(len(values) * 0.5, mean, f"{mean:.4f}", 
                   verticalalignment='bottom')
    
    # Add labels and title
    plt.xlabel("Sample")
    plt.ylabel(metric.capitalize())
    plt.title(f"{summary['name']} - {metric.capitalize()} by Variant")
    plt.legend()
    plt.grid(alpha=0.3)
    
    # Add annotations for significant events
    for i, analysis in enumerate(results.analysis_history):
        if analysis.get("is_significant"):
            plt.axvline(x=i * 10, color='r', linestyle='--', alpha=0.3)
            plt.text(i * 10, plt.ylim()[0] + (plt.ylim()[1] - plt.ylim()[0]) * 0.1, 
                   f"Significant\np={analysis['p_value']:.4f}", 
                   color='r', fontsize=8)
    
    # Save or show plot
    if output_path:
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
    else:
        plt.show()


# ---- Utility Functions ----

def create_simple_ab_test(experiment_name: str, control_model, variant_model, 
                         primary_metric: str = "accuracy", auto_promote: bool = False) -> ModelABTesting:
    """
    Create a simple A/B test between two models
    
    Args:
        experiment_name: Name of the experiment
        control_model: Control model (baseline)
        variant_model: Variant model to test
        primary_metric: Primary metric for comparison
        auto_promote: Whether to automatically promote winning models
        
    Returns:
        ModelABTesting instance
    """
    variants = {"control": control_model, "variant": variant_model}
    return ModelABTesting(experiment_name, variants, primary_metric, auto_promote)


def create_ab_test_from_checkpoints(experiment_name: str, checkpoint_paths: Dict[str, str], 
                                   model_class, model_args=None, model_kwargs=None,
                                   primary_metric: str = "accuracy", 
                                   auto_promote: bool = False) -> ModelABTesting:
    """
    Create an A/B test from model checkpoints
    
    Args:
        experiment_name: Name of the experiment
        checkpoint_paths: Dictionary of {variant_name: checkpoint_path}
        model_class: Model class to instantiate
        model_args: Positional arguments for model constructor
        model_kwargs: Keyword arguments for model constructor
        primary_metric: Primary metric for comparison
        auto_promote: Whether to automatically promote winning models
        
    Returns:
        ModelABTesting instance
    """
    model_args = model_args or []
    model_kwargs = model_kwargs or {}
    variants = {}
    
    for variant, checkpoint_path in checkpoint_paths.items():
        try:
            model = model_class(*model_args, **model_kwargs)
            
            # Load weights based on framework
            if TF_AVAILABLE and isinstance(model, tf.keras.Model):
                model.load_weights(checkpoint_path)
            
            elif TORCH_AVAILABLE and isinstance(model, torch.nn.Module):
                model.load_state_dict(torch.load(checkpoint_path))
            
            else:
                logger.warning(f"Unsupported model type for checkpoint loading: {type(model)}")
                continue
            
            variants[variant] = model
            logger.info(f"Loaded model for variant {variant} from {checkpoint_path}")
            
        except Exception as e:
            logger.error(f"Error loading model for variant {variant}: {e}")
    
    if len(variants) < 2:
        logger.error("Failed to load at least two model variants")
        return None
    
    return ModelABTesting(experiment_name, variants, primary_metric, auto_promote)


def automated_model_selection(dataset, model_variants: Dict[str, Any], 
                            experiment_name: str = "Automated Model Selection",
                            batch_size: int = 32, num_batches: int = 10,
                            primary_metric: str = "accuracy") -> Any:
    """
    Run automated model selection using A/B testing
    
    Args:
        dataset: Dataset for evaluation (should provide batches of (inputs, labels))
        model_variants: Dictionary of {variant_name: model}
        experiment_name: Name of the experiment
        batch_size: Batch size for evaluation
        num_batches: Number of batches to evaluate
        primary_metric: Primary metric for comparison
        
    Returns:
        Selected best model
    """
    # Create A/B testing experiment
    ab_testing = ModelABTesting(
        experiment_name=experiment_name,
        variants=model_variants,
        primary_metric=primary_metric,
        auto_promote=True
    )
    
    # Evaluation loop
    try:
        # Different handling based on dataset type
        if hasattr(dataset, "__iter__") or hasattr(dataset, "__next__"):
            # Dataset is iterable
            batch_count = 0
            for inputs, labels in dataset:
                if batch_count >= num_batches:
                    break
                
                # Generate sample ID
                sample_id = f"batch_{batch_count}"
                
                # Evaluate batch
                ab_testing.evaluate_sample(sample_id, inputs, labels)
                batch_count += 1
        else:
            # Dataset is a tuple of (inputs, labels) or similar
            x_data, y_data = dataset
            num_samples = len(x_data)
            
            for i in range(0, num_samples, batch_size):
                if i // batch_size >= num_batches:
                    break
                
                end = min(i + batch_size, num_samples)
                batch_x = x_data[i:end]
                batch_y = y_data[i:end]
                
                # Generate sample ID
                sample_id = f"batch_{i//batch_size}"
                
                # Evaluate batch
                ab_testing.evaluate_sample(sample_id, batch_x, batch_y)
    
    except Exception as e:
        logger.error(f"Error during automated model selection: {e}")
    
    # Analyze results and select best model
    analysis = ab_testing.analyze()
    best_model = ab_testing.get_best_model()
    
    # End experiment and get final report
    final_report = ab_testing.end_experiment()
    
    logger.info(f"Automated model selection complete. Selected model: {final_report['winner']}")
    return best_model


# Example usage
if __name__ == "__main__":
    print("Automated A/B Testing Framework for Model Evaluation")
    
    # Example 1: Simple A/B test setup
    if TF_AVAILABLE:
        try:
            # Create simple models for demonstration
            model1 = tf.keras.Sequential([
                tf.keras.layers.Dense(10, activation='relu', input_shape=(5,)),
                tf.keras.layers.Dense(5, activation='softmax')
            ])
            model1.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
            
            model2 = tf.keras.Sequential([
                tf.keras.layers.Dense(20, activation='relu', input_shape=(5,)),
                tf.keras.layers.Dense(10, activation='relu'),
                tf.keras.layers.Dense(5, activation='softmax')
            ])
            model2.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
            
            # Create A/B test
            ab_test = create_simple_ab_test(
                experiment_name="Simple Model Comparison",
                control_model=model1,
                variant_model=model2
            )
            
            print("Created simple A/B test between two TensorFlow models")
        except Exception as e:
            print(f"Error creating TensorFlow example: {e}")
    
    # Example 2: Setup with experiment manager
    try:
        # Create experiment manager
        manager = ABExperimentManager()
        
        # Create configuration
        config = ABExperimentConfig(
            experiment_name="Example Experiment",
            description="Testing the A/B testing framework",
            traffic_split={"control": 0.5, "variant": 0.5},
            metrics=["accuracy", "inference_time"],
            primary_metric="accuracy",
            min_samples=10
        )
        
        # Create experiment
        experiment_id = manager.create_experiment(config)
        
        # Simulate some data
        for i in range(20):
            # Simulate better accuracy for variant but slower inference time
            if i % 2 == 0:  # control
                metrics = {
                    "accuracy": 0.75 + np.random.normal(0, 0.05),
                    "inference_time": 0.02 + np.random.normal(0, 0.005)
                }
            else:  # variant
                metrics = {
                    "accuracy": 0.85 + np.random.normal(0, 0.05),
                    "inference_time": 0.03 + np.random.normal(0, 0.005)
                }
            
            sample_id = f"sample_{i}"
            variant = manager.record_sample(experiment_id, sample_id, metrics)
        
        # Analyze results
        analysis = manager.analyze_experiment(experiment_id)
        
        # Get summary
        summary = manager.get_experiment_summary(experiment_id)
        
        print(f"Example experiment created with ID: {experiment_id}")
        print(f"Experiment summary: {summary['experiment_name']}")
        print(f"Total samples: {sum(summary['sample_counts'].values())}")
        if summary.get('winner'):
            print(f"Current winner: {summary['winner']}")
        
        # End experiment
        final_results = manager.end_experiment(experiment_id)
        print(f"Final winner: {final_results.get('winner')}")
        
    except Exception as e:
        print(f"Error in experiment manager example: {e}")