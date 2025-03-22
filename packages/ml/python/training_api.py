#!/usr/bin/env python3
"""
Unified Training API

This module serves as the main entry point for the improved training capabilities,
integrating transfer learning, hyperparameter optimization, Supabase-based distributed
training, enhanced progress visualization, active learning, and automated retraining.

Features:
1. Transfer learning - Fine-tuning existing models with small datasets
2. Hyperparameter optimization - Grid search, random search, and Bayesian optimization
3. Distributed training - Supabase-based training queue and parameter sharing
4. Enhanced progress visualization - Real-time charts and metrics
5. Active learning - Uncertainty-based sample selection for manual labeling
6. Automated retraining triggers - Data-driven model updates
"""

import os
import sys
import json
import time
import logging
import argparse
import multiprocessing
from typing import Dict, List, Any, Tuple, Optional, Union, Callable
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('training_api')

# Import internal modules
try:
    # Import transfer learning module
    from transfer_learning import (
        TransferLearningModel, TFTransferLearningModel, 
        TorchTransferLearningModel, transfer_learn
    )
except ImportError:
    logger.warning("Transfer learning module not available. Some features will be limited.")
    TransferLearningModel = None
    transfer_learn = None

try:
    # Import hyperparameter optimization module
    from hyperparameter_optimization import (
        HyperparameterOptimizer, GridSearchOptimizer,
        RandomSearchOptimizer, BayesianOptimizer, optimize_hyperparameters
    )
except ImportError:
    logger.warning("Hyperparameter optimization module not available. Some features will be limited.")
    HyperparameterOptimizer = None
    optimize_hyperparameters = None

try:
    # Import distributed training module
    from distributed_training import (
        DistributedTrainingManager, SupabaseTrainingQueue,
        TrainingWorker, create_distributed_trainer
    )
except ImportError:
    logger.warning("Distributed training module not available. Some features will be limited.")
    DistributedTrainingManager = None
    create_distributed_trainer = None

try:
    # Import training visualization module
    from training_visualization import (
        VisualizationReporter, create_progress_dashboard,
        generate_performance_charts, save_visualization_data
    )
except ImportError:
    logger.warning("Training visualization module not available. Some features will be limited.")
    VisualizationReporter = None
    create_progress_dashboard = None

try:
    # Import active learning module
    from active_learning import (
        ActiveLearner, UncertaintyMeasure, DiversitySampler,
        setup_default_retraining_triggers, integrate_with_model_trainer
    )
except ImportError:
    logger.warning("Active learning module not available. Some features will be limited.")
    ActiveLearner = None
    setup_default_retraining_triggers = None

try:
    # Import original modules
    from model_trainer import HybridTrainer
    from parameter_manager import create_parameter_manager
    from progress_reporter import HybridProgressReporter
    from feedback_loop import FeedbackLoopSystem
except ImportError:
    logger.warning("Core training modules not available. Functionality will be limited.")
    HybridTrainer = None
    create_parameter_manager = None
    HybridProgressReporter = None
    FeedbackLoopSystem = None


class EnhancedTrainingAPI:
    """
    Unified API for enhanced training capabilities
    
    This class integrates all training improvements into a single interface:
    - Transfer learning
    - Hyperparameter optimization
    - Distributed training with Supabase
    - Enhanced progress visualization
    - Active learning
    - Automated retraining
    """
    
    def __init__(
        self,
        base_dir: str = "./training",
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        use_distributed: bool = True,
        enable_transfer_learning: bool = True,
        enable_hyperparameter_optimization: bool = True,
        enable_active_learning: bool = True,
        visualization_level: str = "detailed",
        num_workers: int = 1
    ):
        """
        Initialize the enhanced training API
        
        Args:
            base_dir: Base directory for training data and models
            supabase_url: Supabase URL for distributed features
            supabase_key: Supabase API key for distributed features
            use_distributed: Whether to use distributed training
            enable_transfer_learning: Whether to enable transfer learning
            enable_hyperparameter_optimization: Whether to enable hyperparameter optimization
            enable_active_learning: Whether to enable active learning
            visualization_level: Level of visualization detail ('basic', 'standard', 'detailed')
            num_workers: Number of worker processes for distributed training
        """
        self.base_dir = base_dir
        self.data_dir = os.path.join(base_dir, "data")
        self.model_dir = os.path.join(base_dir, "models")
        self.results_dir = os.path.join(base_dir, "results")
        self.visualization_dir = os.path.join(base_dir, "visualizations")
        
        # Create directories
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.model_dir, exist_ok=True)
        os.makedirs(self.results_dir, exist_ok=True)
        os.makedirs(self.visualization_dir, exist_ok=True)
        
        # Store configuration
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.use_distributed = use_distributed
        self.enable_transfer_learning = enable_transfer_learning
        self.enable_hyperparameter_optimization = enable_hyperparameter_optimization
        self.enable_active_learning = enable_active_learning
        self.visualization_level = visualization_level
        self.num_workers = num_workers
        
        # Initialize components
        self._initialize_parameter_manager()
        self._initialize_progress_reporter()
        self._initialize_distributed_training()
        self._initialize_visualization()
        self._initialize_active_learning()
        
        logger.info(f"Enhanced Training API initialized in {base_dir}")
    
    def _initialize_parameter_manager(self) -> None:
        """Initialize parameter manager"""
        if create_parameter_manager:
            if self.supabase_url and self.supabase_key:
                # Use Supabase parameter manager
                self.parameter_manager = create_parameter_manager(
                    "supabase",
                    supabase_url=self.supabase_url,
                    supabase_key=self.supabase_key
                )
                logger.info("Initialized Supabase parameter manager")
            else:
                # Use file-based parameter manager
                param_file = os.path.join(self.base_dir, "parameters.json")
                self.parameter_manager = create_parameter_manager(
                    "file",
                    param_file=param_file
                )
                logger.info(f"Initialized file-based parameter manager with {param_file}")
        else:
            self.parameter_manager = None
            logger.warning("Parameter manager not available")
    
    def _initialize_progress_reporter(self) -> None:
        """Initialize progress reporter"""
        if HybridProgressReporter:
            # Create progress reporter
            if self.supabase_url and self.supabase_key:
                # Use HTTP reporting with Supabase
                self.progress_reporter = HybridProgressReporter(
                    base_url=f"{self.supabase_url}/rest/v1/training_progress",
                    api_key=self.supabase_key
                )
                logger.info("Initialized HTTP progress reporter with Supabase")
            else:
                # Use file-based reporting
                progress_file = os.path.join(self.base_dir, "progress.json")
                self.progress_reporter = HybridProgressReporter(
                    file_path=progress_file
                )
                logger.info(f"Initialized file-based progress reporter with {progress_file}")
        else:
            self.progress_reporter = None
            logger.warning("Progress reporter not available")
    
    def _initialize_distributed_training(self) -> None:
        """Initialize distributed training"""
        if not self.use_distributed:
            self.distributed_trainer = None
            return
        
        if create_distributed_trainer and self.supabase_url and self.supabase_key:
            # Create distributed training manager
            self.distributed_trainer = create_distributed_trainer(
                data_dir=self.data_dir,
                model_dir=self.model_dir,
                supabase_url=self.supabase_url,
                supabase_key=self.supabase_key,
                parameter_manager=self.parameter_manager,
                progress_reporter=self.progress_reporter,
                num_workers=self.num_workers
            )
            logger.info(f"Initialized distributed training with {self.num_workers} workers")
        else:
            self.distributed_trainer = None
            if self.use_distributed:
                logger.warning("Distributed training requested but not available")
    
    def _initialize_visualization(self) -> None:
        """Initialize visualization reporter"""
        if VisualizationReporter:
            # Create visualization reporter
            self.visualization_reporter = VisualizationReporter(
                output_dir=self.visualization_dir,
                detail_level=self.visualization_level,
                supabase_url=self.supabase_url,
                supabase_key=self.supabase_key
            )
            logger.info(f"Initialized visualization reporter with level {self.visualization_level}")
        else:
            self.visualization_reporter = None
            logger.warning("Visualization reporter not available")
    
    def _initialize_active_learning(self) -> None:
        """Initialize active learning"""
        if not self.enable_active_learning:
            self.active_learner = None
            return
        
        if ActiveLearner:
            # Create active learning system
            active_learning_dir = os.path.join(self.base_dir, "active_learning")
            
            self.active_learner, self.get_labeling_batch = integrate_with_model_trainer(
                data_dir=self.data_dir,
                model_dir=self.model_dir,
                batch_size=10,
                uncertainty_method="entropy",
                enable_auto_retraining=True,
                supabase_url=self.supabase_url,
                supabase_key=self.supabase_key
            )
            
            # Set up default retraining triggers
            setup_default_retraining_triggers(self.active_learner)
            
            logger.info(f"Initialized active learning system in {active_learning_dir}")
        else:
            self.active_learner = None
            logger.warning("Active learning not available")
    
    def train_model(
        self,
        dataset_path: str,
        model_type: str = "hybrid",
        model_name: Optional[str] = None,
        pretrained_model_path: Optional[str] = None,
        hyperparameters: Optional[Dict[str, Any]] = None,
        optimize_hyperparams: bool = False,
        validation_split: float = 0.2,
        epochs: int = 10,
        batch_size: int = 32,
        callbacks: Optional[List[Any]] = None,
        use_transfer_learning: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Train a model with enhanced capabilities
        
        Args:
            dataset_path: Path to the dataset
            model_type: Type of model to train ('feature', 'tensorflow', 'pytorch', 'hybrid')
            model_name: Optional model name (generated if None)
            pretrained_model_path: Optional path to pretrained model for transfer learning
            hyperparameters: Optional hyperparameters dictionary
            optimize_hyperparams: Whether to perform hyperparameter optimization
            validation_split: Validation data split ratio
            epochs: Number of training epochs
            batch_size: Training batch size
            callbacks: Optional list of callbacks for training
            use_transfer_learning: Whether to use transfer learning (overrides class setting)
            
        Returns:
            Training results
        """
        # Generate model name if not provided
        if model_name is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            model_name = f"{model_type}_{timestamp}"
        
        # Resolve transfer learning setting
        use_transfer = use_transfer_learning if use_transfer_learning is not None else self.enable_transfer_learning
        
        # Start job in progress reporter
        job_id = f"train_{model_name}"
        
        if self.progress_reporter:
            self.progress_reporter.start_job(
                job_id=job_id,
                job_type="model_training",
                job_name=f"Training {model_type} model: {model_name}",
                total_steps=epochs,
                metadata={
                    "model_type": model_type,
                    "dataset_path": dataset_path,
                    "use_transfer_learning": use_transfer,
                    "optimize_hyperparams": optimize_hyperparams
                }
            )
        
        # Handle hyperparameter optimization if requested
        if optimize_hyperparams and self.enable_hyperparameter_optimization and optimize_hyperparameters:
            if self.progress_reporter:
                self.progress_reporter.update_progress(
                    job_id=job_id,
                    current_step=0,
                    status="Optimizing hyperparameters",
                    message="Starting hyperparameter optimization"
                )
            
            # Define hyperparameter space
            if hyperparameters is None:
                if model_type == "tensorflow" or model_type == "hybrid":
                    hp_space = {
                        "learning_rate": {"type": "float", "min": 1e-4, "max": 1e-2, "log": True},
                        "dropout_rate": {"type": "float", "min": 0.1, "max": 0.5},
                        "dense_units": {"type": "int", "min": 64, "max": 512, "step": 64},
                        "optimizer": {"type": "categorical", "values": ["adam", "sgd", "rmsprop"]}
                    }
                elif model_type == "pytorch":
                    hp_space = {
                        "learning_rate": {"type": "float", "min": 1e-4, "max": 1e-2, "log": True},
                        "dropout_rate": {"type": "float", "min": 0.1, "max": 0.5},
                        "hidden_dim": {"type": "int", "min": 64, "max": 512, "step": 64},
                        "optimizer": {"type": "categorical", "values": ["adam", "sgd", "rmsprop"]}
                    }
                else:  # feature-based
                    hp_space = {
                        "feature_threshold": {"type": "float", "min": 0.6, "max": 0.9},
                        "min_matches": {"type": "int", "min": 3, "max": 20},
                        "normalization": {"type": "categorical", "values": ["l1", "l2", "max"]}
                    }
            else:
                # Use provided hyperparameters as space
                hp_space = hyperparameters
            
            # Run optimization
            opt_results = optimize_hyperparameters(
                dataset_path=dataset_path,
                model_type=model_type,
                hp_space=hp_space,
                validation_split=validation_split,
                max_trials=10,
                epochs_per_trial=3,
                optimization_metric="val_accuracy",
                optimization_goal="maximize",
                output_dir=os.path.join(self.results_dir, f"{model_name}_hpopt"),
                progress_reporter=self.progress_reporter,
                job_id=job_id
            )
            
            # Use optimized hyperparameters
            hyperparameters = opt_results["best_hyperparameters"]
            
            if self.progress_reporter:
                self.progress_reporter.update_progress(
                    job_id=job_id,
                    current_step=0,
                    status="Hyperparameter optimization completed",
                    message=f"Best hyperparameters: {json.dumps(hyperparameters)}",
                    metadata={"optimization_results": opt_results}
                )
        
        # Set up callbacks with visualization if available
        if callbacks is None:
            callbacks = []
        
        if self.visualization_reporter:
            viz_callback = self.visualization_reporter.create_callback(
                job_id=job_id,
                model_name=model_name,
                output_dir=os.path.join(self.visualization_dir, model_name)
            )
            callbacks.append(viz_callback)
        
        # Set up parameter manager callback if available
        if self.parameter_manager:
            param_callback = self.parameter_manager.create_callback(
                job_id=job_id,
                model_type=model_type
            )
            callbacks.append(param_callback)
        
        # Check if we should use distributed training
        if self.use_distributed and self.distributed_trainer:
            # Use distributed training
            logger.info(f"Starting distributed training for {model_name}")
            
            if self.progress_reporter:
                self.progress_reporter.update_progress(
                    job_id=job_id,
                    current_step=0,
                    status="Preparing distributed training",
                    message="Setting up distributed training job"
                )
            
            # Submit training job to distributed system
            training_results = self.distributed_trainer.submit_training_job(
                dataset_path=dataset_path,
                model_type=model_type,
                model_name=model_name,
                hyperparameters=hyperparameters,
                validation_split=validation_split,
                epochs=epochs,
                batch_size=batch_size,
                pretrained_model_path=pretrained_model_path if use_transfer else None,
                callbacks=callbacks
            )
            
        else:
            # Use local training
            logger.info(f"Starting local training for {model_name}")
            
            if self.progress_reporter:
                self.progress_reporter.update_progress(
                    job_id=job_id,
                    current_step=0,
                    status="Preparing local training",
                    message="Setting up local training job"
                )
            
            # Check if we should use transfer learning
            if use_transfer and pretrained_model_path and TransferLearningModel and transfer_learn:
                logger.info(f"Using transfer learning with pretrained model {pretrained_model_path}")
                
                if self.progress_reporter:
                    self.progress_reporter.update_progress(
                        job_id=job_id,
                        current_step=0,
                        status="Preparing transfer learning",
                        message=f"Using pretrained model: {pretrained_model_path}"
                    )
                
                # Use transfer learning
                training_results = transfer_learn(
                    dataset_path=dataset_path,
                    pretrained_model_path=pretrained_model_path,
                    model_type=model_type,
                    output_model_path=os.path.join(self.model_dir, model_name),
                    hyperparameters=hyperparameters,
                    validation_split=validation_split,
                    epochs=epochs,
                    batch_size=batch_size,
                    callbacks=callbacks,
                    progress_reporter=self.progress_reporter,
                    job_id=job_id
                )
            
            elif HybridTrainer:
                # Use standard training
                try:
                    # Create trainer based on model type
                    trainer = HybridTrainer(
                        model_type=model_type,
                        data_dir=dataset_path,
                        output_dir=os.path.join(self.model_dir, model_name),
                        progress_reporter=self.progress_reporter,
                        parameter_manager=self.parameter_manager
                    )
                    
                    # Train model
                    training_results = trainer.train(
                        epochs=epochs,
                        batch_size=batch_size,
                        hyperparameters=hyperparameters,
                        validation_split=validation_split,
                        callbacks=callbacks
                    )
                    
                    # Save model
                    model_path = trainer.save_model()
                    training_results["model_path"] = model_path
                    
                except Exception as e:
                    logger.error(f"Error during training: {e}")
                    if self.progress_reporter:
                        self.progress_reporter.report_error(
                            job_id=job_id,
                            error=str(e),
                            error_details={"exception": str(e)}
                        )
                    
                    return {"status": "error", "message": str(e)}
            
            else:
                error_message = "Training infrastructure not available"
                logger.error(error_message)
                
                if self.progress_reporter:
                    self.progress_reporter.report_error(
                        job_id=job_id,
                        error=error_message
                    )
                
                return {"status": "error", "message": error_message}
        
        # Complete progress reporting
        if self.progress_reporter:
            self.progress_reporter.complete_job(
                job_id=job_id,
                status="completed",
                metadata={"training_results": training_results}
            )
        
        # Generate final visualizations
        if self.visualization_reporter:
            visualization_path = self.visualization_reporter.generate_final_report(
                job_id=job_id,
                model_name=model_name,
                training_results=training_results,
                output_dir=os.path.join(self.visualization_dir, model_name)
            )
            training_results["visualization_path"] = visualization_path
        
        return {
            "status": "success",
            "model_name": model_name,
            "model_path": os.path.join(self.model_dir, model_name),
            "training_results": training_results
        }
    
    def get_samples_for_labeling(self, count: int = 10) -> Dict[str, Any]:
        """
        Get samples for manual labeling using active learning
        
        Args:
            count: Number of samples to select
            
        Returns:
            Selected samples and batch information
        """
        if not self.active_learner:
            return {"status": "error", "message": "Active learning not available"}
        
        # Select samples for labeling
        batch = self.active_learner.select_samples_for_labeling(count=count)
        
        return {
            "status": "success",
            "batch_id": batch.batch_id,
            "samples": [sample.to_dict() for sample in batch.samples],
            "count": len(batch.samples)
        }
    
    def record_labeling_feedback(
        self,
        sample_id: str,
        correct_material_id: str,
        batch_id: Optional[str] = None,
        user_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Record feedback from manual labeling
        
        Args:
            sample_id: Sample ID
            correct_material_id: Correct material ID
            batch_id: Optional batch ID
            user_notes: Optional user notes
            
        Returns:
            Feedback recording result
        """
        if not self.active_learner:
            return {"status": "error", "message": "Active learning not available"}
        
        # Record feedback
        feedback_id = self.active_learner.record_feedback(
            sample_id=sample_id,
            correct_material_id=correct_material_id,
            batch_id=batch_id,
            user_notes=user_notes
        )
        
        if not feedback_id:
            return {"status": "error", "message": "Failed to record feedback"}
        
        # Check retraining triggers
        triggered = self.active_learner.check_retraining_triggers()
        
        if triggered:
            # Retraining is triggered
            return {
                "status": "success",
                "feedback_id": feedback_id,
                "retraining_triggered": True,
                "triggers": [t.to_dict() for t in triggered]
            }
        
        return {
            "status": "success",
            "feedback_id": feedback_id,
            "retraining_triggered": False
        }
    
    def retrain_from_feedback(
        self,
        trigger_id: Optional[str] = None,
        model_type: str = "hybrid",
        feedback_threshold: int = 10
    ) -> Dict[str, Any]:
        """
        Retrain model based on feedback data
        
        Args:
            trigger_id: Optional trigger ID
            model_type: Type of model to train
            feedback_threshold: Minimum feedback items required
            
        Returns:
            Retraining results
        """
        if not self.active_learner:
            return {"status": "error", "message": "Active learning not available"}
        
        # Start job in progress reporter
        job_id = f"retrain_{trigger_id or datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        if self.progress_reporter:
            self.progress_reporter.start_job(
                job_id=job_id,
                job_type="model_retraining",
                job_name=f"Retraining {model_type} model from feedback",
                metadata={
                    "trigger_id": trigger_id,
                    "model_type": model_type,
                    "feedback_threshold": feedback_threshold
                }
            )
        
        # Define retraining function with progress reporting
        def retraining_fn(training_data):
            try:
                # Create model name
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                model_name = f"{model_type}_retrained_{timestamp}"
                
                # Train model with the data
                training_result = self.train_model(
                    dataset_path=training_data["dataset_path"],
                    model_type=model_type,
                    model_name=model_name,
                    hyperparameters=training_data.get("hyperparameters"),
                    epochs=15,  # More epochs for retraining
                    batch_size=16,
                    use_transfer_learning=True
                )
                
                return {
                    "status": "success",
                    "model_name": model_name,
                    "model_path": training_result["model_path"],
                    "training_metrics": training_result.get("training_results", {})
                }
                
            except Exception as e:
                logger.error(f"Error during retraining: {e}")
                if self.progress_reporter:
                    self.progress_reporter.report_error(
                        job_id=job_id,
                        error=str(e)
                    )
                
                return {"status": "error", "message": str(e)}
        
        # Perform retraining
        retrain_result = self.active_learner.retrain_model(
            trigger_id=trigger_id,
            feedback_count_threshold=feedback_threshold,
            retraining_fn=retraining_fn
        )
        
        # Complete progress reporting
        if self.progress_reporter:
            if retrain_result.get("status") == "success":
                self.progress_reporter.complete_job(
                    job_id=job_id,
                    status="completed",
                    metadata={"retraining_results": retrain_result}
                )
            else:
                self.progress_reporter.report_error(
                    job_id=job_id,
                    error=retrain_result.get("message", "Unknown error")
                )
        
        return retrain_result
    
    def start_distributed_workers(self, num_workers: Optional[int] = None) -> Dict[str, Any]:
        """
        Start distributed training worker processes
        
        Args:
            num_workers: Number of worker processes to start
            
        Returns:
            Worker start results
        """
        if not self.distributed_trainer:
            return {"status": "error", "message": "Distributed training not available"}
        
        # Use specified number of workers or default
        worker_count = num_workers if num_workers is not None else self.num_workers
        
        # Start workers
        worker_results = self.distributed_trainer.start_workers(worker_count)
        
        return {
            "status": "success",
            "workers_started": worker_count,
            "worker_results": worker_results
        }
    
    def stop_distributed_workers(self) -> Dict[str, Any]:
        """
        Stop all distributed training worker processes
        
        Returns:
            Worker stop results
        """
        if not self.distributed_trainer:
            return {"status": "error", "message": "Distributed training not available"}
        
        # Stop workers
        stop_results = self.distributed_trainer.stop_workers()
        
        return {
            "status": "success",
            "workers_stopped": stop_results.get("workers_stopped", 0)
        }
    
    def get_training_status(self, job_id: str) -> Dict[str, Any]:
        """
        Get status of a training job
        
        Args:
            job_id: Training job ID
            
        Returns:
            Job status information
        """
        # Check distributed trainer first
        if self.distributed_trainer:
            job_status = self.distributed_trainer.get_job_status(job_id)
            
            if job_status and job_status.get("status") != "not_found":
                return job_status
        
        # Check progress reporter
        if self.progress_reporter:
            try:
                # Get job progress
                progress = self.progress_reporter.get_job_progress(job_id)
                
                if progress:
                    return {
                        "status": "found",
                        "job_id": job_id,
                        "progress": progress
                    }
            except Exception as e:
                logger.error(f"Error getting job progress: {e}")
        
        return {"status": "not_found", "job_id": job_id}
    
    def get_performance_metrics(self, model_name: str) -> Dict[str, Any]:
        """
        Get performance metrics for a trained model
        
        Args:
            model_name: Model name
            
        Returns:
            Model performance metrics
        """
        # Check if feedback system is available
        if FeedbackLoopSystem:
            try:
                # Create feedback system
                feedback_system = FeedbackLoopSystem(
                    data_dir=self.data_dir,
                    supabase_url=self.supabase_url,
                    supabase_key=self.supabase_key
                )
                
                # Get model path
                model_path = os.path.join(self.model_dir, model_name)
                
                # Get performance metrics
                metrics = feedback_system.get_performance_metrics(model_path)
                
                return {
                    "status": "success",
                    "model_name": model_name,
                    "metrics": metrics
                }
            except Exception as e:
                logger.error(f"Error getting performance metrics: {e}")
                return {"status": "error", "message": str(e)}
        
        return {"status": "error", "message": "Feedback system not available"}
    
    def generate_visualization_dashboard(
        self,
        job_id: str,
        output_format: str = "html"
    ) -> Dict[str, Any]:
        """
        Generate visualization dashboard for a training job
        
        Args:
            job_id: Training job ID
            output_format: Output format ('html', 'json', 'png')
            
        Returns:
            Dashboard generation results
        """
        if not self.visualization_reporter:
            return {"status": "error", "message": "Visualization not available"}
        
        try:
            # Generate dashboard
            dashboard_path = self.visualization_reporter.generate_dashboard(
                job_id=job_id,
                output_format=output_format,
                output_dir=os.path.join(self.visualization_dir, job_id)
            )
            
            return {
                "status": "success",
                "job_id": job_id,
                "dashboard_path": dashboard_path,
                "output_format": output_format
            }
        except Exception as e:
            logger.error(f"Error generating dashboard: {e}")
            return {"status": "error", "message": str(e)}


def train_with_all_improvements(
    dataset_path: str,
    model_type: str = "hybrid",
    output_dir: Optional[str] = None,
    model_name: Optional[str] = None,
    supabase_url: Optional[str] = None,
    supabase_key: Optional[str] = None,
    epochs: int = 10,
    batch_size: int = 32,
    distributed: bool = False,
    optimize_hyperparams: bool = True,
    use_transfer_learning: bool = True,
    pretrained_model_path: Optional[str] = None,
    visualization_level: str = "detailed",
    num_workers: int = 1
) -> Dict[str, Any]:
    """
    Simplified function to train a model with all improvements
    
    Args:
        dataset_path: Path to the dataset
        model_type: Type of model to train
        output_dir: Output directory for models and results
        model_name: Optional model name
        supabase_url: Optional Supabase URL
        supabase_key: Optional Supabase API key
        epochs: Number of training epochs
        batch_size: Training batch size
        distributed: Whether to use distributed training
        optimize_hyperparams: Whether to perform hyperparameter optimization
        use_transfer_learning: Whether to use transfer learning
        pretrained_model_path: Optional pretrained model path
        visualization_level: Visualization detail level
        num_workers: Number of worker processes
        
    Returns:
        Training results
    """
    # Create output directory if not provided
    if output_dir is None:
        output_dir = f"./training_{model_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    # Create enhanced training API
    api = EnhancedTrainingAPI(
        base_dir=output_dir,
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        use_distributed=distributed,
        enable_transfer_learning=use_transfer_learning,
        enable_hyperparameter_optimization=optimize_hyperparams,
        visualization_level=visualization_level,
        num_workers=num_workers
    )
    
    # Start distributed workers if using distributed training
    if distributed and num_workers > 0:
        api.start_distributed_workers(num_workers)
    
    try:
        # Train model
        results = api.train_model(
            dataset_path=dataset_path,
            model_type=model_type,
            model_name=model_name,
            pretrained_model_path=pretrained_model_path,
            optimize_hyperparams=optimize_hyperparams,
            epochs=epochs,
            batch_size=batch_size,
            use_transfer_learning=use_transfer_learning
        )
        
        # Stop distributed workers if using distributed training
        if distributed and num_workers > 0:
            api.stop_distributed_workers()
        
        return results
    
    except Exception as e:
        logger.error(f"Error during training: {e}")
        
        # Stop distributed workers if using distributed training
        if distributed and num_workers > 0:
            api.stop_distributed_workers()
        
        return {"status": "error", "message": str(e)}


def start_retraining_monitor(
    data_dir: str,
    model_dir: str,
    check_interval: int = 3600,  # 1 hour
    supabase_url: Optional[str] = None,
    supabase_key: Optional[str] = None
) -> None:
    """
    Start a monitoring process that checks for retraining triggers
    
    Args:
        data_dir: Data directory
        model_dir: Model directory
        check_interval: Check interval in seconds
        supabase_url: Optional Supabase URL
        supabase_key: Optional Supabase API key
    """
    if ActiveLearner is None:
        logger.error("Active learning module not available")
        return
    
    # Create active learning system
    active_learner = ActiveLearner(
        storage_dir=os.path.join(data_dir, "active_learning"),
        supabase_url=supabase_url,
        supabase_key=supabase_key
    )
    
    # Set up default retraining triggers
    setup_default_retraining_triggers(active_learner)
    
    logger.info(f"Starting retraining monitor with check interval {check_interval} seconds")
    
    while True:
        try:
            # Check for triggered retraining
            triggered = active_learner.check_retraining_triggers()
            
            for trigger in triggered:
                logger.info(f"Retraining trigger {trigger.trigger_id} activated")
                
                # Perform retraining
                retrain_result = active_learner.retrain_model(
                    trigger_id=trigger.trigger_id,
                    feedback_count_threshold=10
                )
                
                if retrain_result.get("status") == "success":
                    logger.info(f"Retraining completed successfully: {retrain_result}")
                else:
                    logger.error(f"Retraining failed: {retrain_result}")
            
            # Sleep until next check
            time.sleep(check_interval)
            
        except KeyboardInterrupt:
            logger.info("Retraining monitor stopped by user")
            break
        
        except Exception as e:
            logger.error(f"Error in retraining monitor: {e}")
            # Sleep for a shorter period before retrying
            time.sleep(60)


if __name__ == "__main__":
    """Command-line interface for the enhanced training API"""
    parser = argparse.ArgumentParser(description="Enhanced Training API")
    
    # Create subparsers for different commands
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Train command
    train_parser = subparsers.add_parser("train", help="Train a model")
    train_parser.add_argument("--dataset", required=True, help="Dataset path")
    train_parser.add_argument("--model-type", default="hybrid", choices=["feature", "tensorflow", "pytorch", "hybrid"],
                            help="Model type")
    train_parser.add_argument("--output-dir", help="Output directory")
    train_parser.add_argument("--model-name", help="Model name")
    train_parser.add_argument("--epochs", type=int, default=10, help="Number of epochs")
    train_parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    train_parser.add_argument("--use-distributed", action="store_true", help="Use distributed training")
    train_parser.add_argument("--optimize-hyperparams", action="store_true", help="Perform hyperparameter optimization")
    train_parser.add_argument("--use-transfer-learning", action="store_true", help="Use transfer learning")
    train_parser.add_argument("--pretrained-model", help="Pretrained model path")
    train_parser.add_argument("--num-workers", type=int, default=1, help="Number of worker processes")
    train_parser.add_argument("--supabase-url", help="Supabase URL")
    train_parser.add_argument("--supabase-key", help="Supabase API key")
    
    # Active learning command
    active_parser = subparsers.add_parser("active-learning", help="Active learning operations")
    active_parser.add_argument("--operation", required=True, choices=["select", "feedback", "retrain"],
                             help="Active learning operation")
    active_parser.add_argument("--data-dir", required=True, help="Data directory")
    active_parser.add_argument("--model-dir", required=True, help="Model directory")
    active_parser.add_argument("--count", type=int, default=10, help="Number of samples to select")
    active_parser.add_argument("--sample-id", help="Sample ID for feedback")
    active_parser.add_argument("--material-id", help="Correct material ID for feedback")
    active_parser.add_argument("--batch-id", help="Batch ID for feedback")
    active_parser.add_argument("--trigger-id", help="Trigger ID for retraining")
    active_parser.add_argument("--supabase-url", help="Supabase URL")
    active_parser.add_argument("--supabase-key", help="Supabase API key")
    
    # Monitor command
    monitor_parser = subparsers.add_parser("monitor", help="Start retraining monitor")
    monitor_parser.add_argument("--data-dir", required=True, help="Data directory")
    monitor_parser.add_argument("--model-dir", required=True, help="Model directory")
    monitor_parser.add_argument("--check-interval", type=int, default=3600, help="Check interval in seconds")
    monitor_parser.add_argument("--supabase-url", help="Supabase URL")
    monitor_parser.add_argument("--supabase-key", help="Supabase API key")
    
    # Distributed command
    dist_parser = subparsers.add_parser("distributed", help="Distributed training operations")
    dist_parser.add_argument("--operation", required=True, choices=["start-workers", "stop-workers"],
                           help="Distributed training operation")
    dist_parser.add_argument("--data-dir", required=True, help="Data directory")
    dist_parser.add_argument("--model-dir", required=True, help="Model directory")
    dist_parser.add_argument("--num-workers", type=int, default=1, help="Number of worker processes")
    dist_parser.add_argument("--supabase-url", help="Supabase URL")
    dist_parser.add_argument("--supabase-key", help="Supabase API key")
    
    # Parse arguments
    args = parser.parse_args()
    
    # Handle commands
    if args.command == "train":
        # Train a model with all improvements
        result = train_with_all_improvements(
            dataset_path=args.dataset,
            model_type=args.model_type,
            output_dir=args.output_dir,
            model_name=args.model_name,
            supabase_url=args.supabase_url,
            supabase_key=args.supabase_key,
            epochs=args.epochs,
            batch_size=args.batch_size,
            distributed=args.use_distributed,
            optimize_hyperparams=args.optimize_hyperparams,
            use_transfer_learning=args.use_transfer_learning,
            pretrained_model_path=args.pretrained_model,
            num_workers=args.num_workers
        )
        
        print(json.dumps(result, indent=2))
    
    elif args.command == "active-learning":
        # Create active learning system
        active_learner = ActiveLearner(
            storage_dir=os.path.join(args.data_dir, "active_learning"),
            supabase_url=args.supabase_url,
            supabase_key=args.supabase_key
        )
        
        if args.operation == "select":
            # Select samples for labeling
            batch = active_learner.select_samples_for_labeling(count=args.count)
            
            result = {
                "batch_id": batch.batch_id,
                "samples": [sample.to_dict() for sample in batch.samples],
                "count": len(batch.samples)
            }
            
            print(json.dumps(result, indent=2))
        
        elif args.operation == "feedback":
            if not args.sample_id or not args.material_id:
                print("Error: sample-id and material-id are required for feedback operation")
                sys.exit(1)
            
            # Record feedback
            feedback_id = active_learner.record_feedback(
                sample_id=args.sample_id,
                correct_material_id=args.material_id,
                batch_id=args.batch_id
            )
            
            if feedback_id:
                print(f"Recorded feedback: {feedback_id}")
                
                # Check triggers
                triggered = active_learner.check_retraining_triggers()
                
                if triggered:
                    print(f"Retraining triggered: {[t.trigger_id for t in triggered]}")
            else:
                print("Failed to record feedback")
        
        elif args.operation == "retrain":
            # Retrain model
            result = active_learner.retrain_model(
                trigger_id=args.trigger_id,
                feedback_count_threshold=args.count or 10
            )
            
            print(json.dumps(result, indent=2))
    
    elif args.command == "monitor":
        # Start retraining monitor
        start_retraining_monitor(
            data_dir=args.data_dir,
            model_dir=args.model_dir,
            check_interval=args.check_interval,
            supabase_url=args.supabase_url,
            supabase_key=args.supabase_key
        )
    
    elif args.command == "distributed":
        # Create enhanced training API
        api = EnhancedTrainingAPI(
            base_dir=args.data_dir,
            supabase_url=args.supabase_url,
            supabase_key=args.supabase_key,
            use_distributed=True,
            num_workers=args.num_workers
        )
        
        if args.operation == "start-workers":
            # Start workers
            result = api.start_distributed_workers(args.num_workers)
            print(json.dumps(result, indent=2))
        
        elif args.operation == "stop-workers":
            # Stop workers
            result = api.stop_distributed_workers()
            print(json.dumps(result, indent=2))
    
    else:
        parser.print_help()