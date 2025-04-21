#!/usr/bin/env python3
"""
Enhanced RAG Configuration

This module provides configuration for the enhanced RAG system.
"""

import os
from typing import Dict, Any

def get_default_config() -> Dict[str, Any]:
    """
    Get the default configuration for the enhanced RAG system.
    
    Returns:
        Default configuration
    """
    # Base directory for data storage
    data_dir = os.environ.get("RAG_DATA_DIR", "./data")
    
    return {
        # Model registry configuration
        "model_registry_config": {
            "registry_dir": os.path.join(data_dir, "model-registry"),
            "models_dir": os.path.join(data_dir, "models")
        },
        
        # Learning pipeline configuration
        "learning_pipeline_config": {
            "min_feedback_samples": 100,
            "feedback_threshold": 0.7,
            "fine_tuning_interval_days": 7,
            "test_size": 0.2,
            "ab_test_duration_days": 3,
            "models_to_compare": 2,
            "state_dir": os.path.join(data_dir, "state"),
            "temp_dir": os.path.join(data_dir, "temp")
        },
        
        # Distributed retrieval configuration
        "distributed_retrieval_config": {
            "cache_enabled": True,
            "cache_ttl_seconds": 3600,  # 1 hour
            "batch_size": 100,
            "timeout_seconds": 10,
            "max_concurrent_requests": 5
        },
        
        # Hierarchical retriever configuration
        "hierarchical_retriever_config": {
            "max_sub_queries": 3,
            "min_query_length": 15,
            "reranking_enabled": True,
            "combine_strategy": "weighted",
            "query_decomposition_model": "gpt-3.5-turbo"
        },
        
        # Cross-modal attention configuration
        "cross_modal_attention_config": {
            "visual_feature_dim": 512,
            "text_feature_dim": 768,
            "joint_feature_dim": 1024,
            "attention_heads": 8,
            "vision_model_name": "clip",
            "text_model_name": "bert"
        }
    }

def load_config_from_file(config_path: str) -> Dict[str, Any]:
    """
    Load configuration from a JSON file.
    
    Args:
        config_path: Path to the configuration file
        
    Returns:
        Loaded configuration
    """
    import json
    
    try:
        with open(config_path, "r") as f:
            config = json.load(f)
        
        return config
    except Exception as e:
        print(f"Error loading configuration from {config_path}: {str(e)}")
        return get_default_config()

def merge_configs(base_config: Dict[str, Any], override_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Merge two configurations, with override_config taking precedence.
    
    Args:
        base_config: Base configuration
        override_config: Override configuration
        
    Returns:
        Merged configuration
    """
    merged_config = base_config.copy()
    
    for key, value in override_config.items():
        if isinstance(value, dict) and key in merged_config and isinstance(merged_config[key], dict):
            # Recursively merge nested dictionaries
            merged_config[key] = merge_configs(merged_config[key], value)
        else:
            # Override or add value
            merged_config[key] = value
    
    return merged_config

def get_config(config_path: str = None, override_config: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Get the configuration for the enhanced RAG system.
    
    Args:
        config_path: Path to the configuration file (optional)
        override_config: Override configuration (optional)
        
    Returns:
        Configuration for the enhanced RAG system
    """
    # Get default configuration
    config = get_default_config()
    
    # Load configuration from file if provided
    if config_path:
        file_config = load_config_from_file(config_path)
        config = merge_configs(config, file_config)
    
    # Apply override configuration if provided
    if override_config:
        config = merge_configs(config, override_config)
    
    return config
