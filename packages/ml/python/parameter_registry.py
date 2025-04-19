#!/usr/bin/env python3
"""
Material-Specific Parameter Registry

This module implements a registry for managing hyperparameter configurations
organized by material type. It provides:

1. Database of successful hyperparameter configurations by material type
2. Similarity-based parameter suggestion
3. Warm-starting optimization from known good configurations

The registry enables efficient transfer of knowledge between related material types,
allowing new material optimization tasks to benefit from prior experience.
"""

import os
import json
import time
import logging
import numpy as np
from typing import Dict, List, Tuple, Union, Optional, Any, Callable
from pathlib import Path
import difflib

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('parameter_registry')


class ParameterRegistry:
    """
    Registry of hyperparameter configurations by material type.
    Provides similarity-based parameter suggestion and warm-starting optimization.
    """
    
    def __init__(self, database_path: Optional[str] = None):
        """
        Initialize the parameter registry.
        
        Args:
            database_path: Path to the registry database file
        """
        self.registry = {}
        self.database_path = database_path
        
        # Load the registry if a database path is provided
        if database_path and os.path.exists(database_path):
            self._load_registry(database_path)
    
    def _load_registry(self, database_path: str):
        """
        Load the registry from a database file.
        
        Args:
            database_path: Path to the registry database file
        """
        try:
            with open(database_path, 'r') as f:
                self.registry = json.load(f)
            
            logger.info(f"Loaded parameter registry from {database_path}")
            logger.info(f"Registry contains {len(self.registry)} material types")
        except Exception as e:
            logger.error(f"Error loading parameter registry: {e}")
            self.registry = {}
    
    def save_registry(self, database_path: Optional[str] = None):
        """
        Save the registry to a database file.
        
        Args:
            database_path: Path to save the registry (defaults to self.database_path)
        """
        database_path = database_path or self.database_path
        
        if not database_path:
            logger.warning("No database path provided. Registry not saved.")
            return
        
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(database_path), exist_ok=True)
            
            with open(database_path, 'w') as f:
                json.dump(self.registry, f, indent=2)
            
            logger.info(f"Saved parameter registry to {database_path}")
        except Exception as e:
            logger.error(f"Error saving parameter registry: {e}")
    
    def register_configuration(self, 
                             material_type: str, 
                             params: Dict[str, Any],
                             performance_metrics: Dict[str, float],
                             model_type: Optional[str] = None,
                             task_type: Optional[str] = None,
                             metadata: Optional[Dict[str, Any]] = None):
        """
        Register a hyperparameter configuration for a material type.
        
        Args:
            material_type: Type of material (e.g., 'wood', 'metal', 'fabric')
            params: Hyperparameter configuration
            performance_metrics: Performance metrics (e.g., 'val_loss', 'val_accuracy')
            model_type: Optional model type (e.g., 'tensorflow', 'pytorch')
            task_type: Optional task type (e.g., 'classification', 'segmentation')
            metadata: Optional additional metadata
        """
        # Initialize material type entry if it doesn't exist
        if material_type not in self.registry:
            self.registry[material_type] = []
        
        # Create configuration entry
        configuration = {
            "params": params,
            "performance": performance_metrics,
            "model_type": model_type,
            "task_type": task_type,
            "metadata": metadata or {},
            "timestamp": time.time()
        }
        
        # Add configuration to registry
        self.registry[material_type].append(configuration)
        
        # Save registry if database path is provided
        if self.database_path:
            self.save_registry()
        
        logger.info(f"Registered configuration for material type '{material_type}'")
    
    def get_configurations(self, 
                         material_type: str, 
                         model_type: Optional[str] = None,
                         task_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get all registered configurations for a material type, optionally filtered by model and task type.
        
        Args:
            material_type: Type of material
            model_type: Optional model type to filter by
            task_type: Optional task type to filter by
            
        Returns:
            List of configurations
        """
        # Get configurations for the material type
        configurations = self.registry.get(material_type, [])
        
        # Filter by model type if specified
        if model_type is not None:
            configurations = [
                config for config in configurations
                if config.get("model_type") == model_type
            ]
        
        # Filter by task type if specified
        if task_type is not None:
            configurations = [
                config for config in configurations
                if config.get("task_type") == task_type
            ]
        
        return configurations
    
    def get_best_configuration(self, 
                             material_type: str,
                             metric: str = "val_loss",
                             higher_is_better: bool = False,
                             model_type: Optional[str] = None,
                             task_type: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get the best configuration for a material type based on a metric.
        
        Args:
            material_type: Type of material
            metric: Performance metric to use for ranking
            higher_is_better: Whether higher values of the metric are better
            model_type: Optional model type to filter by
            task_type: Optional task type to filter by
            
        Returns:
            Best configuration or None if no configurations exist
        """
        # Get filtered configurations
        configurations = self.get_configurations(
            material_type, model_type, task_type
        )
        
        if not configurations:
            return None
        
        # Sort configurations by the specified metric
        sorted_configs = sorted(
            configurations,
            key=lambda x: x["performance"].get(metric, float('-inf') if higher_is_better else float('inf')),
            reverse=higher_is_better
        )
        
        return sorted_configs[0]
    
    def calculate_material_similarity(self, type1: str, type2: str) -> float:
        """
        Calculate similarity between two material types.
        
        Args:
            type1: First material type
            type2: Second material type
            
        Returns:
            Similarity score between 0.0 and 1.0
        """
        # Simple similarity calculation methods
        similarity_methods = [
            self._jaccard_similarity,
            self._sequence_similarity
        ]
        
        # Calculate similarity using multiple methods
        similarities = [method(type1, type2) for method in similarity_methods]
        
        # Return the maximum similarity from all methods
        return max(similarities)
    
    def _jaccard_similarity(self, type1: str, type2: str) -> float:
        """
        Calculate Jaccard similarity between material types based on tokenized words.
        
        Args:
            type1: First material type
            type2: Second material type
            
        Returns:
            Jaccard similarity score
        """
        # Process material type strings to handle various formats (CamelCase, snake_case, etc.)
        def tokenize(material_type):
            # Replace special characters with spaces
            cleaned = ''.join([c if c.isalnum() else ' ' for c in material_type])
            
            # Split CamelCase
            for i in range(len(cleaned) - 1, 0, -1):
                if cleaned[i].isupper() and cleaned[i-1].islower():
                    cleaned = cleaned[:i] + ' ' + cleaned[i:]
            
            # Convert to lowercase and split into words
            return set(cleaned.lower().split())
        
        # Tokenize material types
        words1 = tokenize(type1)
        words2 = tokenize(type2)
        
        # Calculate Jaccard similarity
        intersection = len(words1.intersection(words2))
        union = len(words1.union(words2))
        
        return intersection / union if union > 0 else 0.0
    
    def _sequence_similarity(self, type1: str, type2: str) -> float:
        """
        Calculate sequence similarity using difflib's SequenceMatcher.
        
        Args:
            type1: First material type
            type2: Second material type
            
        Returns:
            Sequence similarity score
        """
        # Use difflib's SequenceMatcher to calculate sequence similarity
        return difflib.SequenceMatcher(None, type1.lower(), type2.lower()).ratio()
    
    def get_similar_material_types(self, 
                                 material_type: str,
                                 similarity_threshold: float = 0.5,
                                 max_similar: int = 5) -> List[Tuple[str, float]]:
        """
        Get similar material types based on name similarity.
        
        Args:
            material_type: Target material type
            similarity_threshold: Minimum similarity score to consider a material type similar
            max_similar: Maximum number of similar material types to return
            
        Returns:
            List of (material_type, similarity_score) tuples
        """
        similar_types = []
        
        # Calculate similarity for all material types in the registry
        for other_type in self.registry.keys():
            if other_type == material_type:
                continue
            
            similarity = self.calculate_material_similarity(material_type, other_type)
            
            if similarity >= similarity_threshold:
                similar_types.append((other_type, similarity))
        
        # Sort by similarity (highest first) and limit to max_similar
        similar_types.sort(key=lambda x: x[1], reverse=True)
        return similar_types[:max_similar]
    
    def get_similar_configurations(self, 
                                 material_type: str,
                                 similarity_threshold: float = 0.5,
                                 max_configs_per_type: int = 3,
                                 model_type: Optional[str] = None,
                                 task_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get configurations from similar material types.
        
        Args:
            material_type: Target material type
            similarity_threshold: Minimum similarity score to consider a material type similar
            max_configs_per_type: Maximum number of configurations to include per similar type
            model_type: Optional model type to filter by
            task_type: Optional task type to filter by
            
        Returns:
            List of configurations from similar material types
        """
        similar_configs = []
        
        # Get similar material types
        similar_types = self.get_similar_material_types(
            material_type, similarity_threshold
        )
        
        # Collect configurations from similar material types
        for other_type, similarity in similar_types:
            # Get configurations for this material type
            configs = self.get_configurations(other_type, model_type, task_type)
            
            # Sort configurations by recency (most recent first)
            sorted_configs = sorted(
                configs,
                key=lambda x: x.get("timestamp", 0),
                reverse=True
            )
            
            # Add the top configurations with similarity information
            for config in sorted_configs[:max_configs_per_type]:
                config_copy = config.copy()
                config_copy["similarity"] = similarity
                config_copy["source_material_type"] = other_type
                similar_configs.append(config_copy)
        
        return similar_configs
    
    def suggest_initial_configuration(self, 
                                    material_type: str,
                                    model_type: Optional[str] = None,
                                    task_type: Optional[str] = None,
                                    metric: str = "val_loss",
                                    higher_is_better: bool = False,
                                    fallback_configs: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Suggest an initial configuration for a material type.
        
        Args:
            material_type: Type of material
            model_type: Optional model type to filter configurations
            task_type: Optional task type to filter configurations
            metric: Performance metric to use for ranking
            higher_is_better: Whether higher values of the metric are better
            fallback_configs: Default configurations to use if no suitable ones are found
            
        Returns:
            Suggested hyperparameter configuration
        """
        # Try to get the best configuration for this material type
        best_config = self.get_best_configuration(
            material_type, metric, higher_is_better, model_type, task_type
        )
        
        # If found, return its parameters
        if best_config:
            logger.info(f"Using best configuration for material type '{material_type}'")
            return best_config["params"]
        
        # Try to find configurations from similar material types
        similar_configs = self.get_similar_configurations(
            material_type, model_type=model_type, task_type=task_type
        )
        
        if similar_configs:
            # Sort by performance metric
            sorted_configs = sorted(
                similar_configs,
                key=lambda x: x["performance"].get(metric, float('-inf') if higher_is_better else float('inf')),
                reverse=higher_is_better
            )
            
            best_similar = sorted_configs[0]
            logger.info(f"Using configuration from similar material type "
                       f"'{best_similar['source_material_type']}' "
                       f"(similarity: {best_similar['similarity']:.2f})")
            
            return best_similar["params"]
        
        # Use a general fallback configuration based on model and task type
        logger.info(f"No suitable configurations found for material type '{material_type}'. "
                   f"Using default configuration.")
        
        # Fallback configurations
        fallback_configs = fallback_configs or {}
        
        # If fallback configurations are provided for this combination, use them
        key = f"{model_type or 'default'}_{task_type or 'default'}"
        if key in fallback_configs:
            return fallback_configs[key]
        
        # Default configuration as a last resort
        default_config = {
            "learning_rate": 0.001,
            "batch_size": 32,
            "optimizer": "adam",
            "weight_decay": 1e-5,
            "dropout": 0.3
        }
        
        # Add architecture default based on task type
        if task_type == "classification":
            default_config.update({
                "architecture": "mobilenet",
                "hidden_units": 128,
                "activation": "relu"
            })
        elif task_type == "segmentation":
            default_config.update({
                "architecture": "unet",
                "encoder_depth": 5,
                "decoder_channels": [256, 128, 64, 32, 16]
            })
        
        return default_config
    
    def get_material_types(self) -> List[str]:
        """
        Get all registered material types.
        
        Returns:
            List of material types
        """
        return list(self.registry.keys())
    
    def get_material_types_with_count(self) -> List[Tuple[str, int]]:
        """
        Get all registered material types with configuration counts.
        
        Returns:
            List of (material_type, count) tuples
        """
        return [(mat_type, len(configs)) for mat_type, configs in self.registry.items()]
    
    def get_material_type_statistics(self, material_type: str) -> Dict[str, Any]:
        """
        Get statistics for a specific material type.
        
        Args:
            material_type: Type of material
            
        Returns:
            Dictionary with statistics
        """
        if material_type not in self.registry:
            return {"error": f"Material type '{material_type}' not found"}
        
        configs = self.registry[material_type]
        
        # Count configurations by model type
        model_types = {}
        for config in configs:
            model_type = config.get("model_type", "unknown")
            model_types[model_type] = model_types.get(model_type, 0) + 1
        
        # Count configurations by task type
        task_types = {}
        for config in configs:
            task_type = config.get("task_type", "unknown")
            task_types[task_type] = task_types.get(task_type, 0) + 1
        
        # Get performance metrics
        metrics = set()
        for config in configs:
            metrics.update(config.get("performance", {}).keys())
        
        # Calculate average performance for each metric
        avg_performance = {}
        for metric in metrics:
            values = [config["performance"].get(metric) for config in configs 
                     if metric in config.get("performance", {})]
            values = [v for v in values if v is not None]
            if values:
                avg_performance[metric] = sum(values) / len(values)
        
        # Calculate first and last registration timestamps
        timestamps = [config.get("timestamp", 0) for config in configs]
        first_registered = min(timestamps) if timestamps else None
        last_registered = max(timestamps) if timestamps else None
        
        return {
            "material_type": material_type,
            "total_configurations": len(configs),
            "model_types": model_types,
            "task_types": task_types,
            "average_performance": avg_performance,
            "first_registered": first_registered,
            "last_registered": last_registered
        }
    
    def warm_start_parameter_space(self, 
                                  material_type: str,
                                  param_space: Dict[str, Any],
                                  model_type: Optional[str] = None,
                                  task_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Warm-start a parameter space with values from the registry.
        
        Args:
            material_type: Type of material
            param_space: Base parameter space definition
            model_type: Optional model type to filter configurations
            task_type: Optional task type to filter configurations
            
        Returns:
            Updated parameter space with initial values
        """
        # Get suggested configuration
        suggested_params = self.suggest_initial_configuration(
            material_type, model_type, task_type
        )
        
        # Clone the parameter space
        updated_space = param_space.copy()
        
        # Update the parameter space with suggested values where applicable
        for param_name, param_config in updated_space.items():
            if param_name in suggested_params:
                suggested_value = suggested_params[param_name]
                
                # Add suggested value as a bias or initial value
                if param_config["type"] == "categorical" or param_config["type"] == "choice":
                    # For categorical parameters, increase the probability of selecting the suggested value
                    # by adding it as an initial value
                    if "initial_value" not in param_config:
                        param_config["initial_value"] = suggested_value
                    
                    # Make sure the suggested value is in the values list
                    if suggested_value not in param_config["values"]:
                        param_config["values"].append(suggested_value)
                
                elif param_config["type"] == "int" or param_config["type"] == "float":
                    # For numerical parameters, center the distribution around the suggested value
                    if "initial_value" not in param_config:
                        param_config["initial_value"] = suggested_value
                    
                    # Adjust the range if the suggested value is outside the current range
                    if param_config["type"] == "int":
                        if suggested_value < param_config["min"]:
                            param_config["min"] = max(1, suggested_value // 2)
                        if suggested_value > param_config["max"]:
                            param_config["max"] = suggested_value * 2
                    else:  # float
                        if suggested_value < param_config["min"]:
                            param_config["min"] = suggested_value / 2
                        if suggested_value > param_config["max"]:
                            param_config["max"] = suggested_value * 2
        
        return updated_space
    
    def merge_registry(self, other_registry: 'ParameterRegistry'):
        """
        Merge another registry into this one.
        
        Args:
            other_registry: Another ParameterRegistry instance
        """
        # Iterate over material types in the other registry
        for material_type, configs in other_registry.registry.items():
            # Initialize this material type if it doesn't exist
            if material_type not in self.registry:
                self.registry[material_type] = []
            
            # Add configurations from the other registry
            self.registry[material_type].extend(configs)
        
        # Save the merged registry
        if self.database_path:
            self.save_registry()
        
        logger.info(f"Merged registry with {len(other_registry.registry)} material types")


# ---- Material-Specific Hyperparameter Defaults ----

class MaterialHyperparameters:
    """
    Predefined hyperparameter configurations for specific material categories.
    """
    
    # Common defaults across materials
    COMMON_DEFAULTS = {
        "batch_size": 32,
        "weight_decay": 1e-5,
        "dropout": 0.3,
        "learning_rate": 0.001
    }
    
    # Material-specific configurations
    MATERIAL_DEFAULTS = {
        # Wood-based materials focus on texture patterns
        "wood": {
            "architecture": "vit",  # Vision transformer good for texture
            "learning_rate": 0.0005,
            "batch_size": 16,
            "weight_decay": 5e-5,
            "data_augmentation": "texture_focused"
        },
        
        # Metal materials focus on reflectivity and color
        "metal": {
            "architecture": "hybrid-cnn-vit",
            "learning_rate": 0.0008,
            "batch_size": 24,
            "weight_decay": 1e-5,
            "data_augmentation": "color_lighting_focused"
        },
        
        # Fabric materials focus on fine texture details
        "fabric": {
            "architecture": "vit",
            "learning_rate": 0.0003,
            "batch_size": 16,
            "weight_decay": 1e-4,
            "data_augmentation": "pattern_focused"
        },
        
        # Stone materials focus on texture and color variations
        "stone": {
            "architecture": "hybrid-cnn-vit",
            "learning_rate": 0.0005,
            "batch_size": 24,
            "weight_decay": 5e-5,
            "data_augmentation": "texture_color_focused"
        },
        
        # Plastic materials focus on color and shininess
        "plastic": {
            "architecture": "mobilenet",
            "learning_rate": 0.001,
            "batch_size": 32,
            "weight_decay": 1e-5,
            "data_augmentation": "color_focused"
        },
        
        # Glass materials focus on transparency and reflections
        "glass": {
            "architecture": "hybrid-cnn-vit",
            "learning_rate": 0.0003,
            "batch_size": 16,
            "weight_decay": 1e-4,
            "data_augmentation": "lighting_focused"
        },
        
        # Ceramic materials focus on surface patterns and shine
        "ceramic": {
            "architecture": "vit",
            "learning_rate": 0.0005,
            "batch_size": 24,
            "weight_decay": 5e-5,
            "data_augmentation": "surface_focused"
        },
        
        # Leather materials focus on texture and color
        "leather": {
            "architecture": "vit",
            "learning_rate": 0.0005,
            "batch_size": 16,
            "weight_decay": 1e-4,
            "data_augmentation": "texture_focused"
        },
        
        # Paper materials focus on texture and patterns
        "paper": {
            "architecture": "mobilenet",
            "learning_rate": 0.001,
            "batch_size": 32,
            "weight_decay": 1e-5,
            "data_augmentation": "texture_focused"
        },
        
        # Concrete materials focus on texture variations
        "concrete": {
            "architecture": "vit",
            "learning_rate": 0.0005,
            "batch_size": 24,
            "weight_decay": 5e-5,
            "data_augmentation": "texture_focused"
        }
    }
    
    @classmethod
    def get_defaults(cls, material_type: str) -> Dict[str, Any]:
        """
        Get default hyperparameters for a specific material type.
        
        Args:
            material_type: Type of material
            
        Returns:
            Dictionary of default hyperparameters
        """
        # Standardize material type (lowercase)
        material_type = material_type.lower()
        
        # Start with common defaults
        defaults = cls.COMMON_DEFAULTS.copy()
        
        # Update with material-specific defaults if available
        material_defaults = None
        
        # Exact match
        if material_type in cls.MATERIAL_DEFAULTS:
            material_defaults = cls.MATERIAL_DEFAULTS[material_type]
        else:
            # Partial match (e.g., "oak_wood" should match "wood")
            for known_type in cls.MATERIAL_DEFAULTS:
                if known_type in material_type:
                    material_defaults = cls.MATERIAL_DEFAULTS[known_type]
                    break
        
        # Update with material-specific defaults if found
        if material_defaults:
            defaults.update(material_defaults)
        
        return defaults


# ---- Usage Examples ----

def create_example_registry():
    """Create an example registry with sample configurations"""
    # Create a registry
    registry = ParameterRegistry()
    
    # Register configurations for various material types
    
    # Wood materials
    registry.register_configuration(
        material_type="oak_wood",
        params={
            "architecture": "vit",
            "learning_rate": 0.0005,
            "batch_size": 16,
            "weight_decay": 5e-5,
            "dropout": 0.3,
            "data_augmentation": "texture_focused"
        },
        performance_metrics={
            "val_loss": 0.12,
            "val_accuracy": 0.94
        },
        model_type="tensorflow",
        task_type="classification"
    )
    
    registry.register_configuration(
        material_type="pine_wood",
        params={
            "architecture": "vit",
            "learning_rate": 0.0004,
            "batch_size": 16,
            "weight_decay": 6e-5,
            "dropout": 0.25,
            "data_augmentation": "texture_color_focused"
        },
        performance_metrics={
            "val_loss": 0.11,
            "val_accuracy": 0.95
        },
        model_type="tensorflow",
        task_type="classification"
    )
    
    # Metal materials
    registry.register_configuration(
        material_type="stainless_steel",
        params={
            "architecture": "hybrid-cnn-vit",
            "learning_rate": 0.0008,
            "batch_size": 24,
            "weight_decay": 1e-5,
            "dropout": 0.3,
            "data_augmentation": "color_lighting_focused"
        },
        performance_metrics={
            "val_loss": 0.15,
            "val_accuracy": 0.92
        },
        model_type="tensorflow",
        task_type="classification"
    )
    
    # Fabric materials
    registry.register_configuration(
        material_type="cotton_fabric",
        params={
            "architecture": "vit",
            "learning_rate": 0.0003,
            "batch_size": 16,
            "weight_decay": 1e-4,
            "dropout": 0.35,
            "data_augmentation": "pattern_focused"
        },
        performance_metrics={
            "val_loss": 0.13,
            "val_accuracy": 0.93
        },
        model_type="pytorch",
        task_type="classification"
    )
    
    return registry


def example_parameter_suggestion():
    """Example of parameter suggestion for a new material type"""
    # Create an example registry
    registry = create_example_registry()
    
    # Define a parameter space for hyperparameter optimization
    param_space = {
        "learning_rate": {
            "type": "float",
            "min": 1e-4,
            "max": 1e-2,
            "log_scale": True
        },
        "batch_size": {
            "type": "choice",
            "values": [8, 16, 32, 64]
        },
        "architecture": {
            "type": "categorical",
            "values": ["mobilenet", "resnet", "vit", "hybrid-cnn-vit"]
        },
        "weight_decay": {
            "type": "float",
            "min": 1e-6,
            "max": 1e-4,
            "log_scale": True
        },
        "dropout": {
            "type": "float",
            "min": 0.0,
            "max": 0.5
        }
    }
    
    # Get default hyperparameters for oak wood
    oak_defaults = MaterialHyperparameters.get_defaults("oak_wood")
    print("Default hyperparameters for oak_wood:")
    print(oak_defaults)
    
    # Suggest parameters for a new wood type based on similarity
    # This should match with pine_wood and oak_wood
    print("\nSuggesting parameters for maple_wood:")
    suggested_params = registry.suggest_initial_configuration("maple_wood")
    print(suggested_params)
    
    # Warm-start the parameter space with suggested values
    print("\nWarm-starting parameter space for maple_wood:")
    warm_started_space = registry.warm_start_parameter_space("maple_wood", param_space)
    print(warm_started_space)
    
    # Get similar material types for a new material
    print("\nSimilar material types for maple_wood:")
    similar_types = registry.get_similar_material_types("maple_wood")
    for material_type, similarity in similar_types:
        print(f"  {material_type}: {similarity:.2f}")
    
    # Get material type statistics
    print("\nMaterial type statistics for pine_wood:")
    stats = registry.get_material_type_statistics("pine_wood")
    print(f"  Total configurations: {stats['total_configurations']}")
    print(f"  Model types: {stats['model_types']}")
    print(f"  Average performance: {stats['average_performance']}")


def main():
    """Main function to demonstrate parameter registry"""
    print("Material-Specific Parameter Registry")
    
    # Run example
    example_parameter_suggestion()
    
    print("\nParameter registry example completed.")


if __name__ == "__main__":
    main()