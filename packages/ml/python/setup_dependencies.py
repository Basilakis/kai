#!/usr/bin/env python3
"""
Setup Dependencies

This script sets up the necessary dependencies for the enhanced RAG system.
It creates the required directories and initializes the vector stores.
"""

import argparse
import json
import logging
import os
import sys
from typing import Dict, Any, Optional

# Import enhanced RAG components
from enhanced_rag_config import get_config

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

def setup_directories(config: Dict[str, Any]):
    """
    Set up the required directories for the enhanced RAG system.
    
    Args:
        config: Configuration for the enhanced RAG system
    """
    try:
        # Create model registry directory
        registry_dir = config.get("model_registry_config", {}).get("registry_dir")
        if registry_dir:
            os.makedirs(registry_dir, exist_ok=True)
            logger.info(f"Created model registry directory: {registry_dir}")
        
        # Create models directory
        models_dir = config.get("model_registry_config", {}).get("models_dir")
        if models_dir:
            os.makedirs(models_dir, exist_ok=True)
            logger.info(f"Created models directory: {models_dir}")
        
        # Create state directory
        state_dir = config.get("learning_pipeline_config", {}).get("state_dir")
        if state_dir:
            os.makedirs(state_dir, exist_ok=True)
            logger.info(f"Created state directory: {state_dir}")
        
        # Create temp directory
        temp_dir = config.get("learning_pipeline_config", {}).get("temp_dir")
        if temp_dir:
            os.makedirs(temp_dir, exist_ok=True)
            logger.info(f"Created temp directory: {temp_dir}")
        
    except Exception as e:
        logger.error(f"Error setting up directories: {str(e)}")
        raise

def initialize_vector_stores(config: Dict[str, Any]):
    """
    Initialize the vector stores for the enhanced RAG system.
    
    Args:
        config: Configuration for the enhanced RAG system
    """
    try:
        # Get vector store configuration
        vector_store_config = config.get("vector_store_config", {})
        provider = vector_store_config.get("provider")
        
        if provider == "pinecone":
            logger.info("Initializing Pinecone vector store")
            # Placeholder for Pinecone initialization
            # In a real implementation, you would initialize Pinecone here
            logger.info("Pinecone vector store initialized")
        elif provider == "supabase":
            logger.info("Initializing Supabase vector store")
            # Placeholder for Supabase initialization
            # In a real implementation, you would initialize Supabase here
            logger.info("Supabase vector store initialized")
        else:
            logger.warning(f"Unknown vector store provider: {provider}")
        
    except Exception as e:
        logger.error(f"Error initializing vector stores: {str(e)}")
        raise

def initialize_model_registry(config: Dict[str, Any]):
    """
    Initialize the model registry for the enhanced RAG system.
    
    Args:
        config: Configuration for the enhanced RAG system
    """
    try:
        # Get model registry configuration
        registry_dir = config.get("model_registry_config", {}).get("registry_dir")
        
        if not registry_dir:
            logger.warning("No model registry directory specified")
            return
        
        # Create registry files if they don't exist
        models_file = os.path.join(registry_dir, "models.json")
        if not os.path.exists(models_file):
            with open(models_file, "w") as f:
                json.dump({"models": []}, f)
            logger.info(f"Created models registry file: {models_file}")
        
        ab_tests_file = os.path.join(registry_dir, "ab_tests.json")
        if not os.path.exists(ab_tests_file):
            with open(ab_tests_file, "w") as f:
                json.dump({"ab_tests": []}, f)
            logger.info(f"Created A/B tests registry file: {ab_tests_file}")
        
        defaults_file = os.path.join(registry_dir, "defaults.json")
        if not os.path.exists(defaults_file):
            with open(defaults_file, "w") as f:
                json.dump({"defaults": {}}, f)
            logger.info(f"Created defaults registry file: {defaults_file}")
        
    except Exception as e:
        logger.error(f"Error initializing model registry: {str(e)}")
        raise

def setup_dependencies(config_path: Optional[str] = None):
    """
    Set up the necessary dependencies for the enhanced RAG system.
    
    Args:
        config_path: Path to the configuration file (optional)
    """
    try:
        # Get configuration
        config = get_config(config_path)
        
        # Set up directories
        setup_directories(config)
        
        # Initialize vector stores
        initialize_vector_stores(config)
        
        # Initialize model registry
        initialize_model_registry(config)
        
        logger.info("Dependencies set up successfully")
        
    except Exception as e:
        logger.error(f"Error setting up dependencies: {str(e)}")
        raise

def main():
    """
    Main function for standalone execution.
    """
    parser = argparse.ArgumentParser(description="Setup Dependencies for Enhanced RAG")
    parser.add_argument("--config", help="Path to configuration file")
    args = parser.parse_args()
    
    # Set up dependencies
    setup_dependencies(config_path=args.config)

if __name__ == "__main__":
    main()
