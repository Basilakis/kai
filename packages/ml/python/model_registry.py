#!/usr/bin/env python3
"""
Model Registry

This module implements a model registry for tracking models and A/B tests.
It provides functionality for registering models, tracking their performance,
and managing A/B tests.

Key features:
1. Model registration and versioning
2. A/B test management
3. Performance tracking
4. Default model selection
"""

import asyncio
import json
import logging
import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

# Set up logging
logger = logging.getLogger(__name__)

class ModelRegistry:
    """
    Implements a model registry for tracking models and A/B tests.
    """
    
    def __init__(
        self,
        config: Dict[str, Any],
        db_client=None
    ):
        """
        Initialize the model registry.
        
        Args:
            config: Configuration for the registry
            db_client: Database client for storing registry data
        """
        self.config = config
        self.db_client = db_client
        
        # Set default configuration values
        self.config.setdefault("registry_dir", "./registry")
        self.config.setdefault("models_dir", "./models")
        
        # Initialize registry
        self._initialize_registry()
    
    def _initialize_registry(self):
        """
        Initialize the registry structure.
        """
        # Create registry directory if it doesn't exist
        os.makedirs(self.config["registry_dir"], exist_ok=True)
        
        # Create models directory if it doesn't exist
        os.makedirs(self.config["models_dir"], exist_ok=True)
        
        # Initialize registry files if they don't exist
        models_file = os.path.join(self.config["registry_dir"], "models.json")
        if not os.path.exists(models_file):
            with open(models_file, "w") as f:
                json.dump({"models": []}, f)
        
        ab_tests_file = os.path.join(self.config["registry_dir"], "ab_tests.json")
        if not os.path.exists(ab_tests_file):
            with open(ab_tests_file, "w") as f:
                json.dump({"ab_tests": []}, f)
        
        defaults_file = os.path.join(self.config["registry_dir"], "defaults.json")
        if not os.path.exists(defaults_file):
            with open(defaults_file, "w") as f:
                json.dump({"defaults": {}}, f)
        
        logger.info("Initialized model registry")
    
    async def register_model(
        self,
        model_id: str,
        model_type: str,
        model_path: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Register a model in the registry.
        
        Args:
            model_id: Unique identifier for the model
            model_type: Type of model (embedding, generative, etc.)
            model_path: Path to the model files
            metadata: Additional metadata for the model
            
        Returns:
            True if registration was successful, False otherwise
        """
        try:
            # Create model entry
            model_entry = {
                "model_id": model_id,
                "model_type": model_type,
                "model_path": model_path,
                "registered_date": datetime.now().isoformat(),
                "metadata": metadata or {},
                "performance": {}
            }
            
            # Add to registry
            if self.db_client:
                # Add to database
                await self.db_client.add_model(model_entry)
            else:
                # Add to file registry
                models_file = os.path.join(self.config["registry_dir"], "models.json")
                
                with open(models_file, "r") as f:
                    registry = json.load(f)
                
                registry["models"].append(model_entry)
                
                with open(models_file, "w") as f:
                    json.dump(registry, f, indent=2)
            
            logger.info(f"Registered model {model_id} of type {model_type}")
            return True
            
        except Exception as e:
            logger.error(f"Error registering model {model_id}: {str(e)}")
            return False
    
    async def get_model(self, model_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a model from the registry.
        
        Args:
            model_id: Unique identifier for the model
            
        Returns:
            Model entry or None if not found
        """
        try:
            if self.db_client:
                # Get from database
                return await self.db_client.get_model(model_id)
            else:
                # Get from file registry
                models_file = os.path.join(self.config["registry_dir"], "models.json")
                
                with open(models_file, "r") as f:
                    registry = json.load(f)
                
                for model in registry["models"]:
                    if model["model_id"] == model_id:
                        return model
                
                return None
                
        except Exception as e:
            logger.error(f"Error getting model {model_id}: {str(e)}")
            return None
    
    async def get_latest_models(
        self,
        model_type: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get the latest models of a specific type.
        
        Args:
            model_type: Type of model (embedding, generative, etc.)
            limit: Maximum number of models to return
            
        Returns:
            List of model entries
        """
        try:
            if self.db_client:
                # Get from database
                return await self.db_client.get_latest_models(model_type, limit)
            else:
                # Get from file registry
                models_file = os.path.join(self.config["registry_dir"], "models.json")
                
                with open(models_file, "r") as f:
                    registry = json.load(f)
                
                # Filter by model type
                filtered_models = [
                    model for model in registry["models"]
                    if model["model_type"] == model_type
                ]
                
                # Sort by registered date (newest first)
                sorted_models = sorted(
                    filtered_models,
                    key=lambda x: x["registered_date"],
                    reverse=True
                )
                
                # Limit results
                return sorted_models[:limit]
                
        except Exception as e:
            logger.error(f"Error getting latest {model_type} models: {str(e)}")
            return []
    
    async def update_model_performance(
        self,
        model_id: str,
        performance_metrics: Dict[str, Any]
    ) -> bool:
        """
        Update performance metrics for a model.
        
        Args:
            model_id: Unique identifier for the model
            performance_metrics: Performance metrics to update
            
        Returns:
            True if update was successful, False otherwise
        """
        try:
            # Get model
            model = await self.get_model(model_id)
            
            if not model:
                logger.warning(f"Model {model_id} not found for performance update")
                return False
            
            # Update performance metrics
            model["performance"].update(performance_metrics)
            model["performance"]["last_updated"] = datetime.now().isoformat()
            
            # Save updated model
            if self.db_client:
                # Update in database
                await self.db_client.update_model(model)
            else:
                # Update in file registry
                models_file = os.path.join(self.config["registry_dir"], "models.json")
                
                with open(models_file, "r") as f:
                    registry = json.load(f)
                
                # Find and update model
                for i, m in enumerate(registry["models"]):
                    if m["model_id"] == model_id:
                        registry["models"][i] = model
                        break
                
                with open(models_file, "w") as f:
                    json.dump(registry, f, indent=2)
            
            logger.info(f"Updated performance metrics for model {model_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating performance for model {model_id}: {str(e)}")
            return False
    
    async def register_ab_test(
        self,
        ab_test_config: Dict[str, Any]
    ) -> bool:
        """
        Register an A/B test.
        
        Args:
            ab_test_config: Configuration for the A/B test
            
        Returns:
            True if registration was successful, False otherwise
        """
        try:
            # Ensure required fields
            required_fields = ["id", "start_date", "end_date"]
            for field in required_fields:
                if field not in ab_test_config:
                    logger.error(f"Missing required field {field} in A/B test config")
                    return False
            
            # Add to registry
            if self.db_client:
                # Add to database
                await self.db_client.add_ab_test(ab_test_config)
            else:
                # Add to file registry
                ab_tests_file = os.path.join(self.config["registry_dir"], "ab_tests.json")
                
                with open(ab_tests_file, "r") as f:
                    registry = json.load(f)
                
                registry["ab_tests"].append(ab_test_config)
                
                with open(ab_tests_file, "w") as f:
                    json.dump(registry, f, indent=2)
            
            logger.info(f"Registered A/B test {ab_test_config['id']}")
            return True
            
        except Exception as e:
            logger.error(f"Error registering A/B test: {str(e)}")
            return False
    
    async def get_ab_test(self, ab_test_id: str) -> Optional[Dict[str, Any]]:
        """
        Get an A/B test from the registry.
        
        Args:
            ab_test_id: Unique identifier for the A/B test
            
        Returns:
            A/B test entry or None if not found
        """
        try:
            if self.db_client:
                # Get from database
                return await self.db_client.get_ab_test(ab_test_id)
            else:
                # Get from file registry
                ab_tests_file = os.path.join(self.config["registry_dir"], "ab_tests.json")
                
                with open(ab_tests_file, "r") as f:
                    registry = json.load(f)
                
                for ab_test in registry["ab_tests"]:
                    if ab_test["id"] == ab_test_id:
                        return ab_test
                
                return None
                
        except Exception as e:
            logger.error(f"Error getting A/B test {ab_test_id}: {str(e)}")
            return None
    
    async def update_ab_test_results(
        self,
        ab_test_id: str,
        results: Dict[str, Any]
    ) -> bool:
        """
        Update results for an A/B test.
        
        Args:
            ab_test_id: Unique identifier for the A/B test
            results: Results to update
            
        Returns:
            True if update was successful, False otherwise
        """
        try:
            # Get A/B test
            ab_test = await self.get_ab_test(ab_test_id)
            
            if not ab_test:
                logger.warning(f"A/B test {ab_test_id} not found for results update")
                return False
            
            # Update results
            if "results" not in ab_test:
                ab_test["results"] = {}
            
            ab_test["results"].update(results)
            ab_test["results"]["last_updated"] = datetime.now().isoformat()
            
            # Save updated A/B test
            if self.db_client:
                # Update in database
                await self.db_client.update_ab_test(ab_test)
            else:
                # Update in file registry
                ab_tests_file = os.path.join(self.config["registry_dir"], "ab_tests.json")
                
                with open(ab_tests_file, "r") as f:
                    registry = json.load(f)
                
                # Find and update A/B test
                for i, test in enumerate(registry["ab_tests"]):
                    if test["id"] == ab_test_id:
                        registry["ab_tests"][i] = ab_test
                        break
                
                with open(ab_tests_file, "w") as f:
                    json.dump(registry, f, indent=2)
            
            logger.info(f"Updated results for A/B test {ab_test_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating results for A/B test {ab_test_id}: {str(e)}")
            return False
    
    async def get_ab_test_results(self, ab_test_id: str) -> Dict[str, Any]:
        """
        Get results from an A/B test.
        
        Args:
            ab_test_id: Unique identifier for the A/B test
            
        Returns:
            A/B test results
        """
        try:
            # Get A/B test
            ab_test = await self.get_ab_test(ab_test_id)
            
            if not ab_test:
                logger.warning(f"A/B test {ab_test_id} not found for getting results")
                return {}
            
            # Return results
            return ab_test.get("results", {})
            
        except Exception as e:
            logger.error(f"Error getting results for A/B test {ab_test_id}: {str(e)}")
            return {}
    
    async def set_default_model(
        self,
        model_type: str,
        model_id: str
    ) -> bool:
        """
        Set a model as the default for its type.
        
        Args:
            model_type: Type of model (embedding, generative, etc.)
            model_id: Unique identifier for the model
            
        Returns:
            True if setting default was successful, False otherwise
        """
        try:
            # Verify model exists
            model = await self.get_model(model_id)
            
            if not model:
                logger.warning(f"Model {model_id} not found for setting as default")
                return False
            
            # Set as default
            if self.db_client:
                # Set in database
                await self.db_client.set_default_model(model_type, model_id)
            else:
                # Set in file registry
                defaults_file = os.path.join(self.config["registry_dir"], "defaults.json")
                
                with open(defaults_file, "r") as f:
                    defaults = json.load(f)
                
                defaults["defaults"][model_type] = model_id
                
                with open(defaults_file, "w") as f:
                    json.dump(defaults, f, indent=2)
            
            logger.info(f"Set model {model_id} as default for type {model_type}")
            return True
            
        except Exception as e:
            logger.error(f"Error setting default model for type {model_type}: {str(e)}")
            return False
    
    async def get_default_model(self, model_type: str) -> Optional[Dict[str, Any]]:
        """
        Get the default model for a type.
        
        Args:
            model_type: Type of model (embedding, generative, etc.)
            
        Returns:
            Default model entry or None if not found
        """
        try:
            # Get default model ID
            default_model_id = None
            
            if self.db_client:
                # Get from database
                default_model_id = await self.db_client.get_default_model_id(model_type)
            else:
                # Get from file registry
                defaults_file = os.path.join(self.config["registry_dir"], "defaults.json")
                
                with open(defaults_file, "r") as f:
                    defaults = json.load(f)
                
                default_model_id = defaults.get("defaults", {}).get(model_type)
            
            if not default_model_id:
                logger.warning(f"No default model set for type {model_type}")
                return None
            
            # Get model
            return await self.get_model(default_model_id)
            
        except Exception as e:
            logger.error(f"Error getting default model for type {model_type}: {str(e)}")
            return None


# Factory function to create a model registry
def create_model_registry(
    config: Dict[str, Any],
    db_client=None
) -> ModelRegistry:
    """
    Create a ModelRegistry with specified configuration and database client.
    
    Args:
        config: Configuration for the registry
        db_client: Database client for storing registry data
        
    Returns:
        Configured ModelRegistry
    """
    return ModelRegistry(
        config=config,
        db_client=db_client
    )
