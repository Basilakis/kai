#!/usr/bin/env python3
"""
Continuous Learning Pipeline

This module implements a continuous learning pipeline for the RAG system,
enabling automated fine-tuning based on user feedback and performance metrics.

Key features:
1. Automated fine-tuning triggers based on feedback metrics
2. A/B testing framework for model comparison
3. Performance tracking and analysis
4. Feedback-based training data generation
"""

import asyncio
import json
import logging
import os
import random
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

# Set up logging
logger = logging.getLogger(__name__)

class ContinuousLearningPipeline:
    """
    Implements a continuous learning pipeline for the RAG system.
    """
    
    def __init__(
        self,
        config: Dict[str, Any],
        feedback_db=None,
        model_registry=None,
        embedding_model=None,
        llm_client=None
    ):
        """
        Initialize the continuous learning pipeline.
        
        Args:
            config: Configuration for the pipeline
            feedback_db: Database client for feedback data
            model_registry: Model registry for tracking models
            embedding_model: Embedding model for fine-tuning
            llm_client: LLM client for generation tasks
        """
        self.config = config
        self.feedback_db = feedback_db
        self.model_registry = model_registry
        self.embedding_model = embedding_model
        self.llm_client = llm_client
        
        # Set default configuration values
        self.config.setdefault("min_feedback_samples", 100)
        self.config.setdefault("feedback_threshold", 0.7)
        self.config.setdefault("fine_tuning_interval_days", 7)
        self.config.setdefault("test_size", 0.2)
        self.config.setdefault("ab_test_duration_days", 3)
        self.config.setdefault("models_to_compare", 2)
        
        # Initialize state
        self.last_fine_tuning = None
        self.current_ab_test = None
        self.fine_tuning_in_progress = False
        
        # Load state if available
        self._load_state()
    
    def _load_state(self):
        """
        Load pipeline state from disk.
        """
        state_path = os.path.join(
            self.config.get("state_dir", "./state"),
            "continuous_learning_state.json"
        )
        
        if os.path.exists(state_path):
            try:
                with open(state_path, "r") as f:
                    state = json.load(f)
                
                self.last_fine_tuning = state.get("last_fine_tuning")
                self.current_ab_test = state.get("current_ab_test")
                
                logger.info(f"Loaded continuous learning state: last fine-tuning on {self.last_fine_tuning}")
            except Exception as e:
                logger.error(f"Error loading continuous learning state: {str(e)}")
    
    def _save_state(self):
        """
        Save pipeline state to disk.
        """
        state_path = os.path.join(
            self.config.get("state_dir", "./state"),
            "continuous_learning_state.json"
        )
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(state_path), exist_ok=True)
        
        try:
            state = {
                "last_fine_tuning": self.last_fine_tuning,
                "current_ab_test": self.current_ab_test
            }
            
            with open(state_path, "w") as f:
                json.dump(state, f)
            
            logger.info(f"Saved continuous learning state")
        except Exception as e:
            logger.error(f"Error saving continuous learning state: {str(e)}")
    
    async def check_fine_tuning_triggers(self) -> bool:
        """
        Check if fine-tuning should be triggered based on configured criteria.
        
        Returns:
            True if fine-tuning should be triggered, False otherwise
        """
        if self.fine_tuning_in_progress:
            logger.info("Fine-tuning already in progress, skipping trigger check")
            return False
        
        # Check if enough time has passed since last fine-tuning
        if self.last_fine_tuning:
            last_time = datetime.fromisoformat(self.last_fine_tuning)
            days_since = (datetime.now() - last_time).days
            
            if days_since < self.config["fine_tuning_interval_days"]:
                logger.info(f"Not enough time since last fine-tuning ({days_since} days), skipping")
                return False
        
        # Check if we have enough feedback data
        feedback_count = await self._get_feedback_count()
        if feedback_count < self.config["min_feedback_samples"]:
            logger.info(f"Not enough feedback samples ({feedback_count}), skipping fine-tuning")
            return False
        
        # Check if feedback quality is below threshold
        feedback_quality = await self._get_feedback_quality()
        if feedback_quality >= self.config["feedback_threshold"]:
            logger.info(f"Feedback quality ({feedback_quality:.2f}) above threshold, skipping fine-tuning")
            return False
        
        logger.info(f"Fine-tuning triggers met: {feedback_count} samples, {feedback_quality:.2f} quality")
        return True
    
    async def _get_feedback_count(self) -> int:
        """
        Get the count of feedback entries since last fine-tuning.
        
        Returns:
            Number of feedback entries
        """
        if not self.feedback_db:
            return 0
        
        try:
            # Query feedback database for count since last fine-tuning
            since_date = self.last_fine_tuning or "1970-01-01T00:00:00"
            count = await self.feedback_db.get_feedback_count(since_date)
            return count
        except Exception as e:
            logger.error(f"Error getting feedback count: {str(e)}")
            return 0
    
    async def _get_feedback_quality(self) -> float:
        """
        Calculate the average quality score from feedback.
        
        Returns:
            Average quality score (0-1)
        """
        if not self.feedback_db:
            return 1.0  # Default to high quality (no fine-tuning needed)
        
        try:
            # Query feedback database for quality metrics
            since_date = self.last_fine_tuning or "1970-01-01T00:00:00"
            quality_metrics = await self.feedback_db.get_feedback_metrics(since_date)
            
            # Calculate average quality score
            if not quality_metrics or "average_rating" not in quality_metrics:
                return 1.0
            
            # Normalize to 0-1 scale
            avg_rating = quality_metrics["average_rating"]
            max_rating = quality_metrics.get("max_rating", 5.0)
            
            return avg_rating / max_rating
        except Exception as e:
            logger.error(f"Error calculating feedback quality: {str(e)}")
            return 1.0
    
    async def run_fine_tuning(self) -> bool:
        """
        Run the fine-tuning process based on feedback data.
        
        Returns:
            True if fine-tuning was successful, False otherwise
        """
        if self.fine_tuning_in_progress:
            logger.warning("Fine-tuning already in progress")
            return False
        
        self.fine_tuning_in_progress = True
        
        try:
            # 1. Collect training data from feedback
            logger.info("Collecting training data from feedback")
            training_data = await self._collect_training_data()
            
            if not training_data or len(training_data) < self.config["min_feedback_samples"]:
                logger.warning(f"Not enough training data collected: {len(training_data) if training_data else 0} samples")
                self.fine_tuning_in_progress = False
                return False
            
            # 2. Prepare training and validation sets
            logger.info("Preparing training and validation sets")
            train_data, val_data = self._prepare_training_data(training_data)
            
            # 3. Fine-tune embedding model
            if self.embedding_model and self.config.get("fine_tune_embeddings", True):
                logger.info("Fine-tuning embedding model")
                embedding_result = await self._fine_tune_embedding_model(train_data, val_data)
                
                if not embedding_result:
                    logger.error("Embedding model fine-tuning failed")
                    self.fine_tuning_in_progress = False
                    return False
            
            # 4. Fine-tune generative model
            if self.llm_client and self.config.get("fine_tune_generative", True):
                logger.info("Fine-tuning generative model")
                generative_result = await self._fine_tune_generative_model(train_data, val_data)
                
                if not generative_result:
                    logger.error("Generative model fine-tuning failed")
                    self.fine_tuning_in_progress = False
                    return False
            
            # 5. Update state
            self.last_fine_tuning = datetime.now().isoformat()
            self._save_state()
            
            # 6. Set up A/B testing if configured
            if self.config.get("enable_ab_testing", True):
                logger.info("Setting up A/B testing for new models")
                await self._setup_ab_testing()
            
            logger.info("Fine-tuning completed successfully")
            self.fine_tuning_in_progress = False
            return True
            
        except Exception as e:
            logger.error(f"Error during fine-tuning: {str(e)}")
            self.fine_tuning_in_progress = False
            return False
    
    async def _collect_training_data(self) -> List[Dict[str, Any]]:
        """
        Collect training data from feedback database.
        
        Returns:
            List of training examples
        """
        if not self.feedback_db:
            return []
        
        try:
            # Query feedback database for training data
            since_date = self.last_fine_tuning or "1970-01-01T00:00:00"
            feedback_data = await self.feedback_db.get_feedback_for_training(since_date)
            
            # Process feedback data into training examples
            training_data = []
            
            for feedback in feedback_data:
                # Skip feedback without necessary data
                if not feedback.get("query") or not feedback.get("response"):
                    continue
                
                # Skip negative feedback if configured
                if self.config.get("skip_negative_feedback", True):
                    rating = feedback.get("rating", 0)
                    max_rating = feedback.get("max_rating", 5)
                    normalized_rating = rating / max_rating
                    
                    if normalized_rating < 0.6:  # Skip low-rated responses
                        continue
                
                # Create training example
                example = {
                    "query": feedback["query"],
                    "response": feedback["response"],
                    "context": feedback.get("context", ""),
                    "material_type": feedback.get("material_type", "unknown"),
                    "rating": feedback.get("rating", 0),
                    "feedback_text": feedback.get("feedback_text", "")
                }
                
                training_data.append(example)
            
            logger.info(f"Collected {len(training_data)} training examples from feedback")
            return training_data
            
        except Exception as e:
            logger.error(f"Error collecting training data: {str(e)}")
            return []
    
    def _prepare_training_data(
        self,
        training_data: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Prepare training and validation sets.
        
        Args:
            training_data: Raw training data
            
        Returns:
            Tuple of (training set, validation set)
        """
        # Split data into training and validation sets
        train_data, val_data = train_test_split(
            training_data,
            test_size=self.config["test_size"],
            random_state=42
        )
        
        logger.info(f"Split data into {len(train_data)} training and {len(val_data)} validation examples")
        return train_data, val_data
    
    async def _fine_tune_embedding_model(
        self,
        train_data: List[Dict[str, Any]],
        val_data: List[Dict[str, Any]]
    ) -> bool:
        """
        Fine-tune the embedding model.
        
        Args:
            train_data: Training data
            val_data: Validation data
            
        Returns:
            True if fine-tuning was successful, False otherwise
        """
        if not self.embedding_model:
            logger.warning("No embedding model available for fine-tuning")
            return False
        
        try:
            # Prepare data for embedding model fine-tuning
            formatted_train_data = self._format_data_for_embedding(train_data)
            formatted_val_data = self._format_data_for_embedding(val_data)
            
            # Generate a unique model ID
            model_id = f"embedding-ft-{int(time.time())}"
            
            # Fine-tune the model
            output_path = os.path.join(
                self.config.get("models_dir", "./models"),
                model_id
            )
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Call embedding model fine-tuning
            fine_tuning_result = await self.embedding_model.fine_tune(
                train_data=formatted_train_data,
                val_data=formatted_val_data,
                output_path=output_path,
                epochs=self.config.get("embedding_epochs", 3),
                batch_size=self.config.get("embedding_batch_size", 16),
                learning_rate=self.config.get("embedding_learning_rate", 2e-5)
            )
            
            # Register the new model
            if self.model_registry and fine_tuning_result:
                await self.model_registry.register_model(
                    model_id=model_id,
                    model_type="embedding",
                    model_path=output_path,
                    metadata={
                        "fine_tuned": True,
                        "base_model": self.embedding_model.get_model_name(),
                        "training_samples": len(train_data),
                        "validation_samples": len(val_data),
                        "fine_tuned_date": datetime.now().isoformat()
                    }
                )
            
            return fine_tuning_result
            
        except Exception as e:
            logger.error(f"Error fine-tuning embedding model: {str(e)}")
            return False
    
    def _format_data_for_embedding(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Format data for embedding model fine-tuning.
        
        Args:
            data: Raw data
            
        Returns:
            Formatted data for embedding model
        """
        formatted_data = []
        
        for example in data:
            # Create positive pair (query, relevant context)
            formatted_data.append({
                "text1": example["query"],
                "text2": example["context"],
                "label": 1
            })
            
            # Create negative pairs if available
            if "negative_contexts" in example:
                for neg_context in example["negative_contexts"]:
                    formatted_data.append({
                        "text1": example["query"],
                        "text2": neg_context,
                        "label": 0
                    })
        
        return formatted_data
    
    async def _fine_tune_generative_model(
        self,
        train_data: List[Dict[str, Any]],
        val_data: List[Dict[str, Any]]
    ) -> bool:
        """
        Fine-tune the generative model.
        
        Args:
            train_data: Training data
            val_data: Validation data
            
        Returns:
            True if fine-tuning was successful, False otherwise
        """
        if not self.llm_client:
            logger.warning("No LLM client available for fine-tuning")
            return False
        
        try:
            # Prepare data for generative model fine-tuning
            formatted_train_data = self._format_data_for_generative(train_data)
            formatted_val_data = self._format_data_for_generative(val_data)
            
            # Generate a unique model ID
            model_id = f"generative-ft-{int(time.time())}"
            
            # Fine-tune the model
            output_path = os.path.join(
                self.config.get("models_dir", "./models"),
                model_id
            )
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Call generative model fine-tuning
            fine_tuning_result = await self.llm_client.fine_tune(
                training_file=formatted_train_data,
                validation_file=formatted_val_data,
                model=self.config.get("base_generative_model", "gpt-3.5-turbo"),
                suffix=model_id,
                hyperparameters={
                    "n_epochs": self.config.get("generative_epochs", 3),
                    "batch_size": self.config.get("generative_batch_size", 4),
                    "learning_rate_multiplier": self.config.get("generative_learning_rate_multiplier", 1.0)
                }
            )
            
            # Register the new model
            if self.model_registry and fine_tuning_result:
                await self.model_registry.register_model(
                    model_id=model_id,
                    model_type="generative",
                    model_path=fine_tuning_result.get("fine_tuned_model", ""),
                    metadata={
                        "fine_tuned": True,
                        "base_model": self.config.get("base_generative_model", "gpt-3.5-turbo"),
                        "training_samples": len(train_data),
                        "validation_samples": len(val_data),
                        "fine_tuned_date": datetime.now().isoformat()
                    }
                )
            
            return bool(fine_tuning_result)
            
        except Exception as e:
            logger.error(f"Error fine-tuning generative model: {str(e)}")
            return False
    
    def _format_data_for_generative(self, data: List[Dict[str, Any]]) -> str:
        """
        Format data for generative model fine-tuning.
        
        Args:
            data: Raw data
            
        Returns:
            Path to formatted data file for generative model
        """
        formatted_data = []
        
        for example in data:
            # Create system message
            system_message = "You are a materials expert assistant. Use only the provided context to answer questions about materials."
            
            # Create user message with context
            user_message = f"Context:\n{example['context']}\n\nQuestion: {example['query']}"
            
            # Create assistant message
            assistant_message = example["response"]
            
            # Create formatted example
            formatted_example = {
                "messages": [
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message},
                    {"role": "assistant", "content": assistant_message}
                ]
            }
            
            formatted_data.append(formatted_example)
        
        # Write to JSONL file
        output_file = os.path.join(
            self.config.get("temp_dir", "./temp"),
            f"generative_training_{int(time.time())}.jsonl"
        )
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        with open(output_file, "w") as f:
            for example in formatted_data:
                f.write(json.dumps(example) + "\n")
        
        return output_file
    
    async def _setup_ab_testing(self) -> bool:
        """
        Set up A/B testing for newly fine-tuned models.
        
        Returns:
            True if setup was successful, False otherwise
        """
        if not self.model_registry:
            logger.warning("No model registry available for A/B testing")
            return False
        
        try:
            # Get latest models
            latest_embedding_models = await self.model_registry.get_latest_models(
                model_type="embedding",
                limit=self.config["models_to_compare"]
            )
            
            latest_generative_models = await self.model_registry.get_latest_models(
                model_type="generative",
                limit=self.config["models_to_compare"]
            )
            
            # Create A/B test configuration
            ab_test_id = f"ab-test-{int(time.time())}"
            ab_test_config = {
                "id": ab_test_id,
                "start_date": datetime.now().isoformat(),
                "end_date": (datetime.now() + datetime.timedelta(days=self.config["ab_test_duration_days"])).isoformat(),
                "embedding_models": [model["model_id"] for model in latest_embedding_models],
                "generative_models": [model["model_id"] for model in latest_generative_models],
                "metrics": ["response_quality", "retrieval_precision", "user_rating"]
            }
            
            # Register A/B test
            await self.model_registry.register_ab_test(ab_test_config)
            
            # Update current A/B test
            self.current_ab_test = ab_test_id
            self._save_state()
            
            logger.info(f"Set up A/B test {ab_test_id} for {len(latest_embedding_models)} embedding models and {len(latest_generative_models)} generative models")
            return True
            
        except Exception as e:
            logger.error(f"Error setting up A/B testing: {str(e)}")
            return False
    
    async def get_ab_test_results(self, ab_test_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get results from an A/B test.
        
        Args:
            ab_test_id: ID of the A/B test (defaults to current)
            
        Returns:
            A/B test results
        """
        if not self.model_registry:
            logger.warning("No model registry available for A/B test results")
            return {}
        
        try:
            # Use current A/B test if not specified
            test_id = ab_test_id or self.current_ab_test
            
            if not test_id:
                logger.warning("No A/B test ID specified or current")
                return {}
            
            # Get A/B test results
            results = await self.model_registry.get_ab_test_results(test_id)
            
            return results
            
        except Exception as e:
            logger.error(f"Error getting A/B test results: {str(e)}")
            return {}
    
    async def select_best_models(self, ab_test_id: Optional[str] = None) -> Dict[str, str]:
        """
        Select the best models from an A/B test.
        
        Args:
            ab_test_id: ID of the A/B test (defaults to current)
            
        Returns:
            Dictionary with best model IDs by type
        """
        if not self.model_registry:
            logger.warning("No model registry available for selecting best models")
            return {}
        
        try:
            # Get A/B test results
            results = await self.get_ab_test_results(ab_test_id)
            
            if not results:
                logger.warning("No A/B test results available")
                return {}
            
            # Select best models
            best_models = {}
            
            # Best embedding model
            if "embedding_results" in results:
                embedding_results = results["embedding_results"]
                if embedding_results:
                    # Sort by overall score
                    sorted_embedding = sorted(
                        embedding_results,
                        key=lambda x: x.get("overall_score", 0),
                        reverse=True
                    )
                    
                    if sorted_embedding:
                        best_models["embedding"] = sorted_embedding[0]["model_id"]
            
            # Best generative model
            if "generative_results" in results:
                generative_results = results["generative_results"]
                if generative_results:
                    # Sort by overall score
                    sorted_generative = sorted(
                        generative_results,
                        key=lambda x: x.get("overall_score", 0),
                        reverse=True
                    )
                    
                    if sorted_generative:
                        best_models["generative"] = sorted_generative[0]["model_id"]
            
            # Set as default models if configured
            if best_models and self.config.get("auto_set_default_models", True):
                for model_type, model_id in best_models.items():
                    await self.model_registry.set_default_model(model_type, model_id)
            
            logger.info(f"Selected best models: {best_models}")
            return best_models
            
        except Exception as e:
            logger.error(f"Error selecting best models: {str(e)}")
            return {}


# Factory function to create a continuous learning pipeline
def create_continuous_learning_pipeline(
    config: Dict[str, Any],
    feedback_db=None,
    model_registry=None,
    embedding_model=None,
    llm_client=None
) -> ContinuousLearningPipeline:
    """
    Create a ContinuousLearningPipeline with specified configuration and dependencies.
    
    Args:
        config: Configuration for the pipeline
        feedback_db: Database client for feedback data
        model_registry: Model registry for tracking models
        embedding_model: Embedding model for fine-tuning
        llm_client: LLM client for generation tasks
        
    Returns:
        Configured ContinuousLearningPipeline
    """
    return ContinuousLearningPipeline(
        config=config,
        feedback_db=feedback_db,
        model_registry=model_registry,
        embedding_model=embedding_model,
        llm_client=llm_client
    )
