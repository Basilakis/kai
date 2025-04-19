#!/usr/bin/env python3
"""
Multi-Fidelity Hyperparameter Optimization with Hyperband

This module implements the Hyperband algorithm for efficient hyperparameter
optimization with limited resources. It includes:

1. Adaptive resource allocation
2. Early stopping for underperforming configurations
3. Successive halving procedure
4. Integration with both TensorFlow and PyTorch training pipelines
"""

import os
import math
import time
import json
import logging
import random
import numpy as np
from typing import Dict, List, Tuple, Union, Optional, Any, Callable
from pathlib import Path
import multiprocessing as mp
from functools import partial

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('hyperband_optimizer')

# Try to import TensorFlow
try:
    import tensorflow as tf
    TF_AVAILABLE = True
except ImportError:
    logger.warning("TensorFlow not available. TensorFlow-based optimization will be disabled.")
    TF_AVAILABLE = False

# Try to import PyTorch
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    logger.warning("PyTorch not available. PyTorch-based optimization will be disabled.")
    TORCH_AVAILABLE = False


# ---- Hyperband Core Implementation ----

class Hyperband:
    """
    Implementation of the Hyperband algorithm for hyperparameter optimization.
    
    Hyperband is a principled early-stopping method that adaptively allocates resources
    to promising configurations and terminates poorly performing ones.
    """
    
    def __init__(self, 
                 get_params_function: Callable[[], Dict[str, Any]],
                 try_params_function: Callable[[Dict[str, Any], int], float],
                 max_iter: int = 81,
                 eta: float = 3,
                 random_seed: Optional[int] = None,
                 verbose: bool = True):
        """
        Initialize the Hyperband optimizer.
        
        Args:
            get_params_function: Function that returns a dict of hyperparameters to try
            try_params_function: Function to evaluate a set of hyperparameters for a given budget,
                                returning the validation loss (lower is better)
            max_iter: Maximum iterations/epochs per configuration
            eta: Proportion of configurations to discard in each round
            random_seed: Random seed for reproducibility
            verbose: Whether to print detailed progress information
        """
        self.get_params = get_params_function
        self.try_params = try_params_function
        self.max_iter = max_iter
        self.eta = eta
        self.verbose = verbose
        
        # Set random seed if provided
        if random_seed is not None:
            random.seed(random_seed)
            np.random.seed(random_seed)
            if TF_AVAILABLE:
                tf.random.set_seed(random_seed)
            if TORCH_AVAILABLE:
                torch.manual_seed(random_seed)
                if torch.cuda.is_available():
                    torch.cuda.manual_seed(random_seed)
        
        # Calculate Hyperband parameters
        self.s_max = math.floor(math.log(max_iter, eta))
        self.B = (self.s_max + 1) * max_iter
        
        if self.verbose:
            logger.info(f"Hyperband initialized with max_iter={max_iter}, eta={eta}")
            logger.info(f"s_max={self.s_max}, B={self.B}")
    
    def run_optimization(self, parallelism: int = 1) -> Dict[str, Any]:
        """
        Run the Hyperband optimization process.
        
        Args:
            parallelism: Number of parallel evaluations to run (if > 1, uses multiprocessing)
            
        Returns:
            Dictionary containing the best parameters found and their performance
        """
        start_time = time.time()
        
        logger.info(f"Starting Hyperband optimization with parallelism={parallelism}")
        
        # Best configuration found so far
        best_loss = float('inf')
        best_params = None
        best_budget = 0
        
        # Track all configurations and their performances
        all_configs = []
        
        # Iterate over brackets
        for s in range(self.s_max, -1, -1):
            # Number of configurations
            n = int(math.ceil((self.s_max + 1) / (s + 1) * self.eta ** s))
            # Initial budget per configuration
            r = self.max_iter * self.eta ** (-s)
            
            if self.verbose:
                logger.info(f"\nBracket s={s}: n={n}, r={r}")
            
            # Generate configurations
            T = [self.get_params() for _ in range(n)]
            
            # Run successive halving
            for i in range(s + 1):
                n_i = int(n * self.eta ** (-i))
                r_i = int(r * self.eta ** i)
                
                if self.verbose:
                    logger.info(f"Round {i}: n_i={n_i}, r_i={r_i}")
                
                # Evaluate configurations in parallel or sequentially
                if parallelism > 1:
                    results = self._evaluate_configs_parallel(T[:n_i], r_i, parallelism)
                else:
                    results = self._evaluate_configs_sequential(T[:n_i], r_i)
                
                # Store all evaluated configurations
                for config, loss in results:
                    all_configs.append({
                        "params": config,
                        "budget": r_i,
                        "loss": loss,
                        "bracket": s,
                        "round": i
                    })
                    
                    # Update best configuration if needed
                    if loss < best_loss:
                        best_loss = loss
                        best_params = config
                        best_budget = r_i
                        if self.verbose:
                            logger.info(f"New best: loss={best_loss:.6f}, budget={best_budget}")
                
                # Sort configurations by loss and keep the top 1/eta
                indices = np.argsort([result[1] for result in results])
                T = [T[indices[j]] for j in range(min(n_i // self.eta, len(indices)))]
        
        # Final result
        elapsed_time = time.time() - start_time
        
        # Create the result dictionary
        result = {
            "best_params": best_params,
            "best_loss": best_loss,
            "best_budget": best_budget,
            "elapsed_time": elapsed_time,
            "all_configs": all_configs,
            "total_configs_evaluated": len(all_configs)
        }
        
        logger.info(f"\nHyperband optimization completed in {elapsed_time:.2f}s")
        logger.info(f"Best configuration: loss={best_loss:.6f}, budget={best_budget}")
        logger.info(f"Total configurations evaluated: {len(all_configs)}")
        
        return result
    
    def _evaluate_configs_sequential(self, 
                                   configs: List[Dict[str, Any]], 
                                   budget: int) -> List[Tuple[Dict[str, Any], float]]:
        """
        Evaluate a list of configurations sequentially.
        
        Args:
            configs: List of hyperparameter configurations
            budget: Computational budget (e.g., number of epochs) to use
            
        Returns:
            List of (config, loss) tuples
        """
        results = []
        
        for i, config in enumerate(configs):
            if self.verbose:
                logger.info(f"Evaluating configuration {i+1}/{len(configs)} with budget {budget}")
            
            try:
                # Evaluate configuration with the given budget
                loss = self.try_params(config, budget)
                results.append((config, loss))
                
                if self.verbose:
                    logger.info(f"Configuration {i+1}: loss={loss:.6f}")
            except Exception as e:
                logger.error(f"Error evaluating configuration {i+1}: {e}")
                # Assign a high loss to failed configurations
                results.append((config, float('inf')))
        
        return results
    
    def _evaluate_configs_parallel(self, 
                                 configs: List[Dict[str, Any]], 
                                 budget: int,
                                 num_workers: int) -> List[Tuple[Dict[str, Any], float]]:
        """
        Evaluate a list of configurations in parallel using multiprocessing.
        
        Args:
            configs: List of hyperparameter configurations
            budget: Computational budget (e.g., number of epochs) to use
            num_workers: Number of parallel workers
            
        Returns:
            List of (config, loss) tuples
        """
        num_workers = min(num_workers, len(configs))
        
        # Create an evaluation function for multiprocessing
        def evaluate_config(config, budget):
            try:
                return config, self.try_params(config, budget)
            except Exception as e:
                logger.error(f"Error in parallel evaluation: {e}")
                return config, float('inf')
        
        # Use starmap to handle multiple arguments
        with mp.Pool(num_workers) as pool:
            results = pool.starmap(evaluate_config, [(config, budget) for config in configs])
        
        return results


# ---- TensorFlow Integration ----

class TensorFlowHyperband:
    """
    Hyperband implementation specifically tailored for TensorFlow models.
    """
    
    def __init__(self, 
                 model_builder: Callable[[Dict[str, Any]], tf.keras.Model],
                 train_dataset,
                 valid_dataset,
                 param_space: Dict[str, Any],
                 max_epochs: int = 81,
                 eta: int = 3,
                 random_seed: Optional[int] = None,
                 verbose: bool = True):
        """
        Initialize the TensorFlow Hyperband optimizer.
        
        Args:
            model_builder: Function that takes hyperparameters and returns a compiled model
            train_dataset: TensorFlow dataset for training
            valid_dataset: TensorFlow dataset for validation
            param_space: Dictionary defining the hyperparameter search space
            max_epochs: Maximum number of epochs to train any model
            eta: Proportion of configurations to discard in each round
            random_seed: Random seed for reproducibility
            verbose: Whether to print detailed progress information
        """
        if not TF_AVAILABLE:
            raise ImportError("TensorFlow is not available")
        
        self.model_builder = model_builder
        self.train_dataset = train_dataset
        self.valid_dataset = valid_dataset
        self.param_space = param_space
        self.max_epochs = max_epochs
        self.verbose = verbose
        
        # Initialize the Hyperband optimizer
        self.hyperband = Hyperband(
            get_params_function=self._sample_parameters,
            try_params_function=self._evaluate_model,
            max_iter=max_epochs,
            eta=eta,
            random_seed=random_seed,
            verbose=verbose
        )
        
        # Dictionary to cache partial training results
        self.training_cache = {}
    
    def _sample_parameters(self) -> Dict[str, Any]:
        """
        Sample hyperparameters from the defined search space.
        
        Returns:
            Dictionary of sampled hyperparameters
        """
        params = {}
        
        for param_name, param_config in self.param_space.items():
            # Handle different types of parameter distributions
            if param_config["type"] == "categorical":
                params[param_name] = random.choice(param_config["values"])
            
            elif param_config["type"] == "int":
                min_val = param_config["min"]
                max_val = param_config["max"]
                if param_config.get("log_scale", False):
                    log_min = math.log(min_val)
                    log_max = math.log(max_val)
                    params[param_name] = int(math.exp(random.uniform(log_min, log_max)))
                else:
                    params[param_name] = random.randint(min_val, max_val)
            
            elif param_config["type"] == "float":
                min_val = param_config["min"]
                max_val = param_config["max"]
                if param_config.get("log_scale", False):
                    log_min = math.log(min_val)
                    log_max = math.log(max_val)
                    params[param_name] = math.exp(random.uniform(log_min, log_max))
                else:
                    params[param_name] = random.uniform(min_val, max_val)
            
            elif param_config["type"] == "choice":
                params[param_name] = random.choice(param_config["values"])
        
        return params
    
    def _evaluate_model(self, 
                       params: Dict[str, Any], 
                       budget: int) -> float:
        """
        Evaluate a model with the given hyperparameters and budget.
        
        Args:
            params: Hyperparameters for model building
            budget: Number of epochs to train
            
        Returns:
            Validation loss (lower is better)
        """
        # Generate a unique identifier for this configuration
        config_id = self._get_config_id(params)
        
        # Check if we have partially trained this model before
        if config_id in self.training_cache:
            cached_model, cached_history, cached_epochs = self.training_cache[config_id]
            initial_epoch = cached_epochs
            model = cached_model
            history = cached_history
            
            if initial_epoch >= budget:
                # We've already trained this model for at least the requested budget
                val_loss = history.history['val_loss'][budget - 1]
                return val_loss
            
            if self.verbose:
                logger.info(f"Resuming training from epoch {initial_epoch} to {budget}")
        else:
            # Build and compile a new model
            model = self.model_builder(params)
            initial_epoch = 0
            history = None
            
            if self.verbose:
                logger.info(f"Starting new model training for {budget} epochs")
        
        # Create early stopping callback
        early_stopping = tf.keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=max(3, budget // 10),  # Scale patience with budget
            restore_best_weights=True
        )
        
        # Train the model for the specified budget
        new_history = model.fit(
            self.train_dataset,
            validation_data=self.valid_dataset,
            epochs=budget,
            initial_epoch=initial_epoch,
            callbacks=[early_stopping],
            verbose=0 if not self.verbose else 1
        )
        
        # Update the cached history
        if history is None:
            history = new_history
        else:
            # Merge the histories
            for key in new_history.history:
                if key in history.history:
                    history.history[key].extend(new_history.history[key])
                else:
                    history.history[key] = new_history.history[key]
        
        # Cache the model and history
        self.training_cache[config_id] = (model, history, budget)
        
        # Return the validation loss at the specified budget
        return history.history['val_loss'][-1]
    
    def _get_config_id(self, params: Dict[str, Any]) -> str:
        """
        Generate a unique identifier for a hyperparameter configuration.
        
        Args:
            params: Hyperparameter dictionary
            
        Returns:
            String identifier
        """
        # Convert parameters to a sorted list of key-value pairs
        param_items = sorted(params.items())
        
        # Create a string representation
        param_str = "_".join([f"{k}={v}" for k, v in param_items])
        
        # Hash the string to create a fixed-length identifier
        return str(hash(param_str))
    
    def optimize(self, parallelism: int = 1) -> Dict[str, Any]:
        """
        Run the hyperparameter optimization process.
        
        Args:
            parallelism: Number of parallel evaluations to run
            
        Returns:
            Dictionary containing optimization results
        """
        # Run the Hyperband optimization
        result = self.hyperband.run_optimization(parallelism)
        
        # Train the best model for the full budget
        if self.verbose:
            logger.info("\nTraining best model for the full budget...")
        
        best_params = result["best_params"]
        best_model = self.model_builder(best_params)
        
        # Add early stopping
        early_stopping = tf.keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=max(5, self.max_epochs // 8),
            restore_best_weights=True
        )
        
        # Train the best model
        history = best_model.fit(
            self.train_dataset,
            validation_data=self.valid_dataset,
            epochs=self.max_epochs,
            callbacks=[early_stopping],
            verbose=0 if not self.verbose else 1
        )
        
        # Evaluate the best model
        val_metrics = best_model.evaluate(self.valid_dataset, verbose=0)
        
        # Add to the result
        result["best_model"] = best_model
        result["best_model_history"] = history.history
        
        if isinstance(val_metrics, list):
            # Multiple metrics returned
            metrics_dict = {}
            for i, metric_name in enumerate(best_model.metrics_names):
                metrics_dict[metric_name] = val_metrics[i]
            result["best_model_metrics"] = metrics_dict
        else:
            # Single metric (loss) returned
            result["best_model_metrics"] = {"loss": val_metrics}
        
        return result
    
    def save_results(self, result: Dict[str, Any], save_path: str) -> str:
        """
        Save optimization results to disk.
        
        Args:
            result: Optimization result dictionary
            save_path: Directory path to save results
            
        Returns:
            Path to the saved model
        """
        # Create directory if it doesn't exist
        os.makedirs(save_path, exist_ok=True)
        
        # Save the best model
        model_path = os.path.join(save_path, "best_model")
        result["best_model"].save(model_path)
        
        # Remove the model from the results (not serializable)
        save_result = result.copy()
        save_result.pop("best_model", None)
        
        # Save the results
        with open(os.path.join(save_path, "optimization_results.json"), "w") as f:
            # Make sure all values are serializable
            for key in list(save_result.keys()):
                if key == "all_configs":
                    # Keep all_configs but make sure it's serializable
                    for config in save_result["all_configs"]:
                        for param_key, param_value in list(config["params"].items()):
                            if not isinstance(param_value, (int, float, str, bool, type(None))):
                                config["params"][param_key] = str(param_value)
                elif not isinstance(save_result[key], (int, float, str, bool, dict, list, type(None))):
                    save_result[key] = str(save_result[key])
            
            json.dump(save_result, f, indent=2)
        
        # Save training history
        np.save(os.path.join(save_path, "training_history.npy"), result["best_model_history"])
        
        logger.info(f"Optimization results saved to {save_path}")
        return model_path


# ---- PyTorch Integration ----

class PyTorchHyperband:
    """
    Hyperband implementation specifically tailored for PyTorch models.
    """
    
    def __init__(self, 
                 model_builder: Callable[[Dict[str, Any]], torch.nn.Module],
                 train_loader,
                 valid_loader,
                 param_space: Dict[str, Any],
                 max_epochs: int = 81,
                 eta: int = 3,
                 criterion: Optional[torch.nn.Module] = None,
                 device: Optional[str] = None,
                 random_seed: Optional[int] = None,
                 verbose: bool = True):
        """
        Initialize the PyTorch Hyperband optimizer.
        
        Args:
            model_builder: Function that takes hyperparameters and returns a model
            train_loader: DataLoader for training data
            valid_loader: DataLoader for validation data
            param_space: Dictionary defining the hyperparameter search space
            max_epochs: Maximum number of epochs to train any model
            eta: Proportion of configurations to discard in each round
            criterion: Loss criterion (defaults to CrossEntropyLoss)
            device: Device to use for training ('cuda' or 'cpu')
            random_seed: Random seed for reproducibility
            verbose: Whether to print detailed progress information
        """
        if not TORCH_AVAILABLE:
            raise ImportError("PyTorch is not available")
        
        self.model_builder = model_builder
        self.train_loader = train_loader
        self.valid_loader = valid_loader
        self.param_space = param_space
        self.max_epochs = max_epochs
        
        # Set default criterion if not provided
        self.criterion = criterion or torch.nn.CrossEntropyLoss()
        
        # Set device
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.verbose = verbose
        
        # Initialize the Hyperband optimizer
        self.hyperband = Hyperband(
            get_params_function=self._sample_parameters,
            try_params_function=self._evaluate_model,
            max_iter=max_epochs,
            eta=eta,
            random_seed=random_seed,
            verbose=verbose
        )
        
        # Dictionary to cache partial training results
        self.training_cache = {}
    
    def _sample_parameters(self) -> Dict[str, Any]:
        """
        Sample hyperparameters from the defined search space.
        
        Returns:
            Dictionary of sampled hyperparameters
        """
        params = {}
        
        for param_name, param_config in self.param_space.items():
            # Handle different types of parameter distributions
            if param_config["type"] == "categorical":
                params[param_name] = random.choice(param_config["values"])
            
            elif param_config["type"] == "int":
                min_val = param_config["min"]
                max_val = param_config["max"]
                if param_config.get("log_scale", False):
                    log_min = math.log(min_val)
                    log_max = math.log(max_val)
                    params[param_name] = int(math.exp(random.uniform(log_min, log_max)))
                else:
                    params[param_name] = random.randint(min_val, max_val)
            
            elif param_config["type"] == "float":
                min_val = param_config["min"]
                max_val = param_config["max"]
                if param_config.get("log_scale", False):
                    log_min = math.log(min_val)
                    log_max = math.log(max_val)
                    params[param_name] = math.exp(random.uniform(log_min, log_max))
                else:
                    params[param_name] = random.uniform(min_val, max_val)
            
            elif param_config["type"] == "choice":
                params[param_name] = random.choice(param_config["values"])
        
        return params
    
    def _evaluate_model(self, 
                       params: Dict[str, Any], 
                       budget: int) -> float:
        """
        Evaluate a model with the given hyperparameters and budget.
        
        Args:
            params: Hyperparameters for model building
            budget: Number of epochs to train
            
        Returns:
            Validation loss (lower is better)
        """
        # Generate a unique identifier for this configuration
        config_id = self._get_config_id(params)
        
        # Check if we have partially trained this model before
        if config_id in self.training_cache:
            cached_model, cached_optimizer, cached_history, cached_epochs = self.training_cache[config_id]
            initial_epoch = cached_epochs
            model = cached_model
            optimizer = cached_optimizer
            history = cached_history
            
            if initial_epoch >= budget:
                # We've already trained this model for at least the requested budget
                val_loss = history["val_loss"][budget - 1]
                return val_loss
            
            if self.verbose:
                logger.info(f"Resuming training from epoch {initial_epoch} to {budget}")
        else:
            # Build a new model
            model = self.model_builder(params)
            model.to(self.device)
            
            # Create optimizer
            lr = params.get("learning_rate", 0.001)
            weight_decay = params.get("weight_decay", 0)
            optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=weight_decay)
            
            initial_epoch = 0
            history = {"train_loss": [], "val_loss": [], "val_acc": []}
            
            if self.verbose:
                logger.info(f"Starting new model training for {budget} epochs")
        
        # Early stopping initialization
        patience = max(3, budget // 10)  # Scale patience with budget
        best_val_loss = float('inf')
        best_model_state = None
        early_stop_counter = 0
        
        # Train the model for the specified number of epochs
        for epoch in range(initial_epoch, budget):
            # Training phase
            model.train()
            train_loss = 0.0
            
            for inputs, targets in self.train_loader:
                # Move data to device
                inputs, targets = inputs.to(self.device), targets.to(self.device)
                
                # Zero the gradients
                optimizer.zero_grad()
                
                # Forward pass
                outputs = model(inputs)
                loss = self.criterion(outputs, targets)
                
                # Backward pass and optimization
                loss.backward()
                optimizer.step()
                
                train_loss += loss.item() * inputs.size(0)
            
            train_loss /= len(self.train_loader.dataset)
            
            # Validation phase
            model.eval()
            val_loss = 0.0
            correct = 0
            total = 0
            
            with torch.no_grad():
                for inputs, targets in self.valid_loader:
                    # Move data to device
                    inputs, targets = inputs.to(self.device), targets.to(self.device)
                    
                    # Forward pass
                    outputs = model(inputs)
                    loss = self.criterion(outputs, targets)
                    
                    val_loss += loss.item() * inputs.size(0)
                    
                    # Calculate accuracy
                    _, predicted = outputs.max(1)
                    total += targets.size(0)
                    correct += predicted.eq(targets).sum().item()
            
            val_loss /= len(self.valid_loader.dataset)
            val_acc = 100.0 * correct / total
            
            # Update history
            history["train_loss"].append(train_loss)
            history["val_loss"].append(val_loss)
            history["val_acc"].append(val_acc)
            
            if self.verbose:
                logger.info(f"Epoch {epoch+1}/{budget}: train_loss={train_loss:.4f}, "
                           f"val_loss={val_loss:.4f}, val_acc={val_acc:.2f}%")
            
            # Early stopping check
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                best_model_state = model.state_dict().copy()
                early_stop_counter = 0
            else:
                early_stop_counter += 1
                if early_stop_counter >= patience:
                    if self.verbose:
                        logger.info(f"Early stopping at epoch {epoch+1}")
                    break
        
        # Load the best model state
        if best_model_state is not None:
            model.load_state_dict(best_model_state)
        
        # Cache the model and history
        self.training_cache[config_id] = (model, optimizer, history, budget)
        
        # Return the validation loss at the specified budget
        return best_val_loss
    
    def _get_config_id(self, params: Dict[str, Any]) -> str:
        """
        Generate a unique identifier for a hyperparameter configuration.
        
        Args:
            params: Hyperparameter dictionary
            
        Returns:
            String identifier
        """
        # Convert parameters to a sorted list of key-value pairs
        param_items = sorted(params.items())
        
        # Create a string representation
        param_str = "_".join([f"{k}={v}" for k, v in param_items])
        
        # Hash the string to create a fixed-length identifier
        return str(hash(param_str))
    
    def optimize(self, parallelism: int = 1) -> Dict[str, Any]:
        """
        Run the hyperparameter optimization process.
        
        Args:
            parallelism: Number of parallel evaluations to run
            
        Returns:
            Dictionary containing optimization results
        """
        # Run the Hyperband optimization
        result = self.hyperband.run_optimization(parallelism)
        
        # Train the best model for the full budget
        if self.verbose:
            logger.info("\nTraining best model for the full budget...")
        
        best_params = result["best_params"]
        
        # Build the best model
        best_model = self.model_builder(best_params)
        best_model.to(self.device)
        
        # Create optimizer
        lr = best_params.get("learning_rate", 0.001)
        weight_decay = best_params.get("weight_decay", 0)
        optimizer = torch.optim.Adam(best_model.parameters(), lr=lr, weight_decay=weight_decay)
        
        # Early stopping parameters
        patience = max(5, self.max_epochs // 8)
        best_val_loss = float('inf')
        best_model_state = None
        early_stop_counter = 0
        
        # Training history
        history = {"train_loss": [], "val_loss": [], "val_acc": []}
        
        # Train the best model
        for epoch in range(self.max_epochs):
            # Training phase
            best_model.train()
            train_loss = 0.0
            
            for inputs, targets in self.train_loader:
                # Move data to device
                inputs, targets = inputs.to(self.device), targets.to(self.device)
                
                # Zero the gradients
                optimizer.zero_grad()
                
                # Forward pass
                outputs = best_model(inputs)
                loss = self.criterion(outputs, targets)
                
                # Backward pass and optimization
                loss.backward()
                optimizer.step()
                
                train_loss += loss.item() * inputs.size(0)
            
            train_loss /= len(self.train_loader.dataset)
            
            # Validation phase
            best_model.eval()
            val_loss = 0.0
            correct = 0
            total = 0
            
            with torch.no_grad():
                for inputs, targets in self.valid_loader:
                    # Move data to device
                    inputs, targets = inputs.to(self.device), targets.to(self.device)
                    
                    # Forward pass
                    outputs = best_model(inputs)
                    loss = self.criterion(outputs, targets)
                    
                    val_loss += loss.item() * inputs.size(0)
                    
                    # Calculate accuracy
                    _, predicted = outputs.max(1)
                    total += targets.size(0)
                    correct += predicted.eq(targets).sum().item()
            
            val_loss /= len(self.valid_loader.dataset)
            val_acc = 100.0 * correct / total
            
            # Update history
            history["train_loss"].append(train_loss)
            history["val_loss"].append(val_loss)
            history["val_acc"].append(val_acc)
            
            if self.verbose:
                logger.info(f"Epoch {epoch+1}/{self.max_epochs}: train_loss={train_loss:.4f}, "
                           f"val_loss={val_loss:.4f}, val_acc={val_acc:.2f}%")
            
            # Early stopping check
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                best_model_state = best_model.state_dict().copy()
                early_stop_counter = 0
            else:
                early_stop_counter += 1
                if early_stop_counter >= patience:
                    if self.verbose:
                        logger.info(f"Early stopping at epoch {epoch+1}")
                    break
        
        # Load the best model state
        if best_model_state is not None:
            best_model.load_state_dict(best_model_state)
        
        # Evaluate the best model
        best_model.eval()
        val_loss = 0.0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for inputs, targets in self.valid_loader:
                # Move data to device
                inputs, targets = inputs.to(self.device), targets.to(self.device)
                
                # Forward pass
                outputs = best_model(inputs)
                loss = self.criterion(outputs, targets)
                
                val_loss += loss.item() * inputs.size(0)
                
                # Calculate accuracy
                _, predicted = outputs.max(1)
                total += targets.size(0)
                correct += predicted.eq(targets).sum().item()
        
        val_loss /= len(self.valid_loader.dataset)
        val_acc = 100.0 * correct / total
        
        # Add to the result
        result["best_model"] = best_model
        result["best_model_history"] = history
        result["best_model_metrics"] = {
            "val_loss": val_loss,
            "val_accuracy": val_acc
        }
        
        return result
    
    def save_results(self, result: Dict[str, Any], save_path: str) -> str:
        """
        Save optimization results to disk.
        
        Args:
            result: Optimization result dictionary
            save_path: Directory path to save results
            
        Returns:
            Path to the saved model
        """
        # Create directory if it doesn't exist
        os.makedirs(save_path, exist_ok=True)
        
        # Save the best model
        model_path = os.path.join(save_path, "best_model.pt")
        torch.save(result["best_model"].state_dict(), model_path)
        
        # Remove the model from the results (not serializable)
        save_result = result.copy()
        save_result.pop("best_model", None)
        
        # Save the results
        with open(os.path.join(save_path, "optimization_results.json"), "w") as f:
            # Make sure all values are serializable
            for key in list(save_result.keys()):
                if key == "all_configs":
                    # Keep all_configs but make sure it's serializable
                    for config in save_result["all_configs"]:
                        for param_key, param_value in list(config["params"].items()):
                            if not isinstance(param_value, (int, float, str, bool, type(None))):
                                config["params"][param_key] = str(param_value)
                elif not isinstance(save_result[key], (int, float, str, bool, dict, list, type(None))):
                    save_result[key] = str(save_result[key])
            
            json.dump(save_result, f, indent=2)
        
        # Save training history
        np.save(os.path.join(save_path, "training_history.npy"), result["best_model_history"])
        
        logger.info(f"Optimization results saved to {save_path}")
        return model_path


# ---- Parameter Registry for Material-Specific Presets ----

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
                             model_type: Optional[str] = None):
        """
        Register a hyperparameter configuration for a material type.
        
        Args:
            material_type: Type of material (e.g., 'wood', 'metal', 'fabric')
            params: Hyperparameter configuration
            performance_metrics: Performance metrics (e.g., 'val_loss', 'val_accuracy')
            model_type: Optional model type (e.g., 'tensorflow', 'pytorch')
        """
        # Initialize material type entry if it doesn't exist
        if material_type not in self.registry:
            self.registry[material_type] = []
        
        # Create configuration entry
        configuration = {
            "params": params,
            "performance": performance_metrics,
            "model_type": model_type,
            "timestamp": time.time()
        }
        
        # Add configuration to registry
        self.registry[material_type].append(configuration)
        
        # Save registry if database path is provided
        if self.database_path:
            self.save_registry()
        
        logger.info(f"Registered configuration for material type '{material_type}'")
    
    def get_configurations(self, material_type: str) -> List[Dict[str, Any]]:
        """
        Get all registered configurations for a material type.
        
        Args:
            material_type: Type of material
            
        Returns:
            List of configurations
        """
        return self.registry.get(material_type, [])
    
    def get_best_configuration(self, 
                             material_type: str,
                             metric: str = "val_loss",
                             higher_is_better: bool = False) -> Optional[Dict[str, Any]]:
        """
        Get the best configuration for a material type based on a metric.
        
        Args:
            material_type: Type of material
            metric: Performance metric to use for ranking
            higher_is_better: Whether higher values of the metric are better
            
        Returns:
            Best configuration or None if no configurations exist
        """
        configurations = self.get_configurations(material_type)
        
        if not configurations:
            return None
        
        # Sort configurations by the specified metric
        sorted_configs = sorted(
            configurations,
            key=lambda x: x["performance"].get(metric, float('-inf') if higher_is_better else float('inf')),
            reverse=higher_is_better
        )
        
        return sorted_configs[0]
    
    def get_similar_configurations(self, 
                                 material_type: str,
                                 similarity_threshold: float = 0.7) -> List[Dict[str, Any]]:
        """
        Get configurations for similar material types.
        
        Args:
            material_type: Type of material
            similarity_threshold: Minimum similarity score to consider a material type similar
            
        Returns:
            List of configurations from similar material types
        """
        similar_configs = []
        
        # Simple similarity function based on material type names
        # In a real implementation, this would use more sophisticated similarity metrics
        def calculate_similarity(type1, type2):
            # Convert to lowercase and split into words
            words1 = set(type1.lower().split('_'))
            words2 = set(type2.lower().split('_'))
            
            # Calculate Jaccard similarity
            intersection = len(words1.intersection(words2))
            union = len(words1.union(words2))
            
            return intersection / union if union > 0 else 0
        
        # Find similar material types
        for other_type in self.registry.keys():
            if other_type == material_type:
                continue
            
            similarity = calculate_similarity(material_type, other_type)
            
            if similarity >= similarity_threshold:
                # Get configurations for this similar material type
                configs = self.get_configurations(other_type)
                
                # Add similarity score to each configuration
                for config in configs:
                    config_copy = config.copy()
                    config_copy["similarity"] = similarity
                    config_copy["source_material_type"] = other_type
                    similar_configs.append(config_copy)
        
        # Sort by similarity (highest first)
        similar_configs.sort(key=lambda x: x["similarity"], reverse=True)
        
        return similar_configs
    
    def suggest_initial_configuration(self, 
                                    material_type: str,
                                    model_type: Optional[str] = None,
                                    metric: str = "val_loss",
                                    higher_is_better: bool = False) -> Dict[str, Any]:
        """
        Suggest an initial configuration for a material type.
        
        Args:
            material_type: Type of material
            model_type: Optional model type to filter configurations
            metric: Performance metric to use for ranking
            higher_is_better: Whether higher values of the metric are better
            
        Returns:
            Suggested hyperparameter configuration
        """
        # Try to get the best configuration for this material type
        best_config = self.get_best_configuration(
            material_type, metric, higher_is_better
        )
        
        # If found and it matches the model type, return it
        if best_config and (model_type is None or best_config.get("model_type") == model_type):
            logger.info(f"Using best configuration for material type '{material_type}'")
            return best_config["params"]
        
        # Try to find similar material types
        similar_configs = self.get_similar_configurations(material_type)
        
        # Filter by model type if specified
        if model_type is not None:
            similar_configs = [
                config for config in similar_configs
                if config.get("model_type") == model_type
            ]
        
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
        
        # Fall back to a default configuration
        logger.info(f"No suitable configurations found for material type '{material_type}'. "
                   f"Using default configuration.")
        
        # Default configuration (example)
        return {
            "learning_rate": 0.001,
            "batch_size": 32,
            "layers": 2,
            "units": 128,
            "dropout": 0.3,
            "weight_decay": 1e-5
        }
    
    def get_material_types(self) -> List[str]:
        """
        Get all registered material types.
        
        Returns:
            List of material types
        """
        return list(self.registry.keys())
    
    def warm_start_parameter_space(self, 
                                  material_type: str,
                                  param_space: Dict[str, Any],
                                  model_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Warm-start a parameter space with values from the registry.
        
        Args:
            material_type: Type of material
            param_space: Base parameter space definition
            model_type: Optional model type to filter configurations
            
        Returns:
            Updated parameter space with initial values
        """
        # Get suggested configuration
        suggested_params = self.suggest_initial_configuration(
            material_type, model_type
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
                    if "initial_value" not in param_config:
                        param_config["initial_value"] = suggested_value
                
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


# ---- Example Usage ----

def tensorflow_example():
    """Example usage with TensorFlow models"""
    if not TF_AVAILABLE:
        logger.error("TensorFlow is not available. Skipping example.")
        return
    
    # Define a parameter space
    param_space = {
        "learning_rate": {
            "type": "float",
            "min": 1e-4,
            "max": 1e-2,
            "log_scale": True
        },
        "batch_size": {
            "type": "choice",
            "values": [16, 32, 64, 128]
        },
        "units": {
            "type": "int",
            "min": 64,
            "max": 512,
            "log_scale": True
        },
        "activation": {
            "type": "categorical",
            "values": ["relu", "elu", "selu"]
        },
        "dropout": {
            "type": "float",
            "min": 0.0,
            "max": 0.5
        }
    }
    
    # Create a model builder function
    def model_builder(params):
        model = tf.keras.Sequential([
            tf.keras.layers.Dense(params["units"], activation=params["activation"], input_shape=(10,)),
            tf.keras.layers.Dropout(params["dropout"]),
            tf.keras.layers.Dense(params["units"] // 2, activation=params["activation"]),
            tf.keras.layers.Dropout(params["dropout"]),
            tf.keras.layers.Dense(1)
        ])
        
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=params["learning_rate"]),
            loss="mse",
            metrics=["mae"]
        )
        
        return model
    
    # Create dummy data for demonstration
    train_data = tf.random.normal((1000, 10))
    train_labels = tf.random.normal((1000, 1))
    train_dataset = tf.data.Dataset.from_tensor_slices((train_data, train_labels)).batch(32)
    
    valid_data = tf.random.normal((200, 10))
    valid_labels = tf.random.normal((200, 1))
    valid_dataset = tf.data.Dataset.from_tensor_slices((valid_data, valid_labels)).batch(32)
    
    # Create a parameter registry
    registry = ParameterRegistry()
    
    # Register a sample configuration
    registry.register_configuration(
        material_type="wood",
        params={
            "learning_rate": 0.001,
            "batch_size": 32,
            "units": 256,
            "activation": "relu",
            "dropout": 0.2
        },
        performance_metrics={
            "val_loss": 0.05,
            "val_mae": 0.18
        },
        model_type="tensorflow"
    )
    
    # Warm-start the parameter space
    warm_started_space = registry.warm_start_parameter_space(
        material_type="wood",
        param_space=param_space,
        model_type="tensorflow"
    )
    
    # Create a TensorFlow Hyperband optimizer
    optimizer = TensorFlowHyperband(
        model_builder=model_builder,
        train_dataset=train_dataset,
        valid_dataset=valid_dataset,
        param_space=warm_started_space,
        max_epochs=9,
        eta=3,
        verbose=True
    )
    
    logger.info("TensorFlow Hyperband example complete.")


def pytorch_example():
    """Example usage with PyTorch models"""
    if not TORCH_AVAILABLE:
        logger.error("PyTorch is not available. Skipping example.")
        return
    
    # Define a simple model class
    class SimpleModel(torch.nn.Module):
        def __init__(self, input_dim=10, hidden_dim=128, output_dim=1, dropout=0.3, activation="relu"):
            super(SimpleModel, self).__init__()
            
            activations = {
                "relu": torch.nn.ReLU(),
                "elu": torch.nn.ELU(),
                "selu": torch.nn.SELU()
            }
            
            self.layers = torch.nn.Sequential(
                torch.nn.Linear(input_dim, hidden_dim),
                activations[activation],
                torch.nn.Dropout(dropout),
                torch.nn.Linear(hidden_dim, hidden_dim // 2),
                activations[activation],
                torch.nn.Dropout(dropout),
                torch.nn.Linear(hidden_dim // 2, output_dim)
            )
        
        def forward(self, x):
            return self.layers(x)
    
    # Define a parameter space
    param_space = {
        "learning_rate": {
            "type": "float",
            "min": 1e-4,
            "max": 1e-2,
            "log_scale": True
        },
        "hidden_dim": {
            "type": "choice",
            "values": [64, 128, 256]
        },
        "dropout": {
            "type": "float",
            "min": 0.0,
            "max": 0.5
        },
        "activation": {
            "type": "categorical",
            "values": ["relu", "elu", "selu"]
        }
    }
    
    # Create a model builder function
    def model_builder(params):
        return SimpleModel(
            input_dim=10,
            hidden_dim=params["hidden_dim"],
            output_dim=1,
            dropout=params["dropout"],
            activation=params["activation"]
        )
    
    # Create dummy data for demonstration
    train_data = torch.randn(1000, 10)
    train_labels = torch.randn(1000, 1)
    train_dataset = torch.utils.data.TensorDataset(train_data, train_labels)
    train_loader = torch.utils.data.DataLoader(train_dataset, batch_size=32, shuffle=True)
    
    valid_data = torch.randn(200, 10)
    valid_labels = torch.randn(200, 1)
    valid_dataset = torch.utils.data.TensorDataset(valid_data, valid_labels)
    valid_loader = torch.utils.data.DataLoader(valid_dataset, batch_size=32)
    
    # Create a parameter registry
    registry = ParameterRegistry()
    
    # Register a sample configuration
    registry.register_configuration(
        material_type="metal",
        params={
            "learning_rate": 0.002,
            "hidden_dim": 128,
            "dropout": 0.3,
            "activation": "relu"
        },
        performance_metrics={
            "val_loss": 0.06,
            "val_accuracy": 0.94
        },
        model_type="pytorch"
    )
    
    # Warm-start the parameter space
    warm_started_space = registry.warm_start_parameter_space(
        material_type="metal",
        param_space=param_space,
        model_type="pytorch"
    )
    
    # Create a PyTorch Hyperband optimizer
    optimizer = PyTorchHyperband(
        model_builder=model_builder,
        train_loader=train_loader,
        valid_loader=valid_loader,
        param_space=warm_started_space,
        max_epochs=9,
        eta=3,
        criterion=torch.nn.MSELoss(),
        verbose=True
    )
    
    logger.info("PyTorch Hyperband example complete.")


def main():
    """Main function to demonstrate Hyperband optimization"""
    logger.info("Multi-Fidelity Hyperparameter Optimization with Hyperband")
    
    # Run TensorFlow example
    tensorflow_example()
    
    # Run PyTorch example
    pytorch_example()
    
    logger.info("Hyperband examples completed.")


if __name__ == "__main__":
    main()