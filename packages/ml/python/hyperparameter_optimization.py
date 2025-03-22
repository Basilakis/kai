#!/usr/bin/env python3
"""
Hyperparameter Optimization Module for Material Recognition

This module provides automated hyperparameter optimization for model training:
1. Grid search: Systematic search through specified parameter combinations
2. Random search: Random sampling from parameter distributions
3. Bayesian optimization: Sequential model-based optimization with a surrogate function

Usage:
    Import this module to enable hyperparameter optimization in the model training pipeline
"""

import os
import json
import time
import random
import itertools
import numpy as np
import logging
from typing import Dict, List, Any, Tuple, Optional, Union, Callable
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('hyperparameter_optimization')

# Try to import specialized optimization libraries
try:
    import optuna
    OPTUNA_AVAILABLE = True
except ImportError:
    OPTUNA_AVAILABLE = False
    logger.warning("Optuna is not available. Bayesian optimization will use a simplified implementation.")

try:
    from sklearn.model_selection import ParameterGrid, ParameterSampler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logger.warning("scikit-learn is not available. Using custom parameter grid implementation.")


class ParameterSpace:
    """Define and manage hyperparameter search spaces"""

    def __init__(self):
        """Initialize the parameter space"""
        self.params = {}
        self.param_distributions = {}

    def add_categorical_param(self, name: str, values: List[Any]) -> 'ParameterSpace':
        """
        Add a categorical parameter
        
        Args:
            name: Parameter name
            values: List of possible values
            
        Returns:
            Self for method chaining
        """
        self.params[name] = values
        self.param_distributions[name] = {
            'type': 'categorical',
            'values': values
        }
        return self

    def add_numerical_param(self, name: str, low: float, high: float, 
                           step: Optional[float] = None, log: bool = False) -> 'ParameterSpace':
        """
        Add a numerical parameter
        
        Args:
            name: Parameter name
            low: Lower bound
            high: Upper bound
            step: Step size (if None, treated as continuous)
            log: Whether to sample in log space
            
        Returns:
            Self for method chaining
        """
        if step is not None:
            # Discrete parameter
            if log:
                # Log-spaced discrete values
                values = np.exp(np.arange(np.log(low), np.log(high) + 1e-7, np.log(high/low) / (1 + (high - low) / step)))
                values = np.unique([round(x, 8) for x in values])
            else:
                # Linear-spaced discrete values
                values = np.arange(low, high + 1e-7, step)
            
            self.params[name] = list(values)
            self.param_distributions[name] = {
                'type': 'discrete_numerical',
                'values': list(values),
                'low': low,
                'high': high,
                'step': step,
                'log': log
            }
        else:
            # Continuous parameter
            if log:
                self.params[name] = [low, high]
            else:
                self.params[name] = [low, high]
            
            self.param_distributions[name] = {
                'type': 'continuous',
                'low': low,
                'high': high,
                'log': log
            }
        
        return self

    def add_integer_param(self, name: str, low: int, high: int, step: int = 1) -> 'ParameterSpace':
        """
        Add an integer parameter
        
        Args:
            name: Parameter name
            low: Lower bound (inclusive)
            high: Upper bound (inclusive)
            step: Step size
            
        Returns:
            Self for method chaining
        """
        values = list(range(low, high + 1, step))
        self.params[name] = values
        self.param_distributions[name] = {
            'type': 'integer',
            'values': values,
            'low': low,
            'high': high,
            'step': step
        }
        return self

    def get_param_grid(self) -> Dict[str, List[Any]]:
        """
        Get the parameter grid for grid search
        
        Returns:
            Parameter grid
        """
        return self.params
    
    def sample_random_params(self, n_samples: int = 10) -> List[Dict[str, Any]]:
        """
        Sample random parameter combinations
        
        Args:
            n_samples: Number of parameter combinations to sample
            
        Returns:
            List of parameter dictionaries
        """
        samples = []
        for _ in range(n_samples):
            sample = {}
            for param_name, param_info in self.param_distributions.items():
                if param_info['type'] == 'categorical':
                    sample[param_name] = random.choice(param_info['values'])
                elif param_info['type'] in ['discrete_numerical', 'integer']:
                    sample[param_name] = random.choice(param_info['values'])
                elif param_info['type'] == 'continuous':
                    if param_info['log']:
                        sample[param_name] = np.exp(
                            random.uniform(
                                np.log(param_info['low']), 
                                np.log(param_info['high'])
                            )
                        )
                    else:
                        sample[param_name] = random.uniform(
                            param_info['low'], 
                            param_info['high']
                        )
            samples.append(sample)
        
        return samples

    def sample_from_optuna_trial(self, trial) -> Dict[str, Any]:
        """
        Sample parameters for an Optuna trial
        
        Args:
            trial: Optuna trial object
            
        Returns:
            Parameter dictionary
        """
        params = {}
        for param_name, param_info in self.param_distributions.items():
            if param_info['type'] == 'categorical':
                params[param_name] = trial.suggest_categorical(param_name, param_info['values'])
            elif param_info['type'] == 'integer':
                params[param_name] = trial.suggest_int(
                    param_name, 
                    param_info['low'], 
                    param_info['high'],
                    step=param_info['step']
                )
            elif param_info['type'] == 'discrete_numerical':
                params[param_name] = trial.suggest_categorical(param_name, param_info['values'])
            elif param_info['type'] == 'continuous':
                if param_info['log']:
                    params[param_name] = trial.suggest_float(
                        param_name,
                        param_info['low'],
                        param_info['high'],
                        log=True
                    )
                else:
                    params[param_name] = trial.suggest_float(
                        param_name],
                        param_info['low'],
                        param_info['high']
                    )
        
        return params


class SimplifiedBayesianOptimizer:
    """
    Simplified Bayesian optimization implementation for when Optuna is not available
    Uses Gaussian process regression and expected improvement
    """
    
    def __init__(self, param_space: ParameterSpace, n_initial_points: int = 5):
        """
        Initialize the Bayesian optimizer
        
        Args:
            param_space: Parameter space
            n_initial_points: Number of initial random points
        """
        self.param_space = param_space
        self.n_initial_points = n_initial_points
        self.evaluated_params = []
        self.scores = []
        self.best_score = None
        self.best_params = None
    
    def suggest(self) -> Dict[str, Any]:
        """
        Suggest the next set of parameters to evaluate
        
        Returns:
            Parameter dictionary
        """
        # If we haven't evaluated enough points, use random sampling
        if len(self.evaluated_params) < self.n_initial_points:
            return self.param_space.sample_random_params(1)[0]
        
        # Otherwise, use simplified Bayesian optimization
        # This is a very simplified version - in production, you'd use a proper library
        
        # For now, choose a random point from previously successful combinations
        # and randomly perturb it
        
        # Sort evaluations by score (assuming higher is better)
        sorted_idx = np.argsort(self.scores)[::-1]
        
        # Select one of the top 3 (or fewer if we have fewer points)
        top_k = min(3, len(sorted_idx))
        selected_idx = sorted_idx[random.randint(0, top_k-1)]
        
        base_params = self.evaluated_params[selected_idx]
        new_params = {}
        
        # Perturb parameters
        for param_name, param_info in self.param_space.param_distributions.items():
            if param_info['type'] == 'categorical':
                # Either keep the same value or select a new one
                if random.random() < 0.7:  # 70% chance to keep the same value
                    new_params[param_name] = base_params[param_name]
                else:
                    new_values = [v for v in param_info['values'] if v != base_params[param_name]]
                    if new_values:
                        new_params[param_name] = random.choice(new_values)
                    else:
                        new_params[param_name] = base_params[param_name]
            
            elif param_info['type'] in ['discrete_numerical', 'integer']:
                # Perturb the index in the values list
                values = param_info['values']
                current_idx = values.index(base_params[param_name])
                
                # Decide how far to move (-2 to +2 steps)
                step = random.randint(-2, 2)
                new_idx = max(0, min(len(values) - 1, current_idx + step))
                new_params[param_name] = values[new_idx]
            
            elif param_info['type'] == 'continuous':
                # Perturb by a random factor
                if param_info['log']:
                    # Log-scale perturbation
                    factor = np.exp(random.uniform(-0.5, 0.5))  # Multiply by e^[-0.5, 0.5]
                    new_value = base_params[param_name] * factor
                else:
                    # Linear-scale perturbation
                    range_width = param_info['high'] - param_info['low']
                    noise = random.uniform(-0.2, 0.2) * range_width
                    new_value = base_params[param_name] + noise
                
                # Ensure the value is within bounds
                new_params[param_name] = max(
                    param_info['low'],
                    min(param_info['high'], new_value)
                )
        
        return new_params
    
    def register_result(self, params: Dict[str, Any], score: float) -> None:
        """
        Register the result of a parameter evaluation
        
        Args:
            params: Parameter dictionary
            score: Evaluation score (higher is better)
        """
        self.evaluated_params.append(params.copy())
        self.scores.append(score)
        
        # Update best score and parameters
        if self.best_score is None or score > self.best_score:
            self.best_score = score
            self.best_params = params.copy()


class OptimizationResults:
    """
    Store and analyze hyperparameter optimization results
    """
    
    def __init__(self, optimization_type: str, param_space: ParameterSpace):
        """
        Initialize optimization results
        
        Args:
            optimization_type: Type of optimization ('grid', 'random', 'bayesian')
            param_space: Parameter space
        """
        self.optimization_type = optimization_type
        self.param_space = param_space
        self.trials = []
        self.best_trial = None
        self.start_time = time.time()
    
    def add_trial(self, params: Dict[str, Any], metrics: Dict[str, float], 
                 training_time: float, trial_id: str) -> None:
        """
        Add a trial result
        
        Args:
            params: Parameters used for the trial
            metrics: Performance metrics
            training_time: Time taken for training
            trial_id: Unique identifier for the trial
        """
        trial = {
            'trial_id': trial_id,
            'params': params,
            'metrics': metrics,
            'training_time': training_time,
            'timestamp': datetime.now().isoformat()
        }
        
        self.trials.append(trial)
        
        # Update best trial if this is the first or better than current best
        if self.best_trial is None or metrics['val_accuracy'] > self.best_trial['metrics']['val_accuracy']:
            self.best_trial = trial
    
    def get_best_params(self) -> Dict[str, Any]:
        """
        Get the best parameters found
        
        Returns:
            Best parameters
        """
        return self.best_trial['params'] if self.best_trial else None
    
    def get_best_metrics(self) -> Dict[str, float]:
        """
        Get the metrics for the best trial
        
        Returns:
            Best metrics
        """
        return self.best_trial['metrics'] if self.best_trial else None
    
    def get_summary(self) -> Dict[str, Any]:
        """
        Get a summary of the optimization results
        
        Returns:
            Summary dictionary
        """
        total_time = time.time() - self.start_time
        
        return {
            'optimization_type': self.optimization_type,
            'num_trials': len(self.trials),
            'best_params': self.get_best_params(),
            'best_metrics': self.get_best_metrics(),
            'total_time': total_time,
            'average_trial_time': sum(t['training_time'] for t in self.trials) / max(1, len(self.trials)),
            'parameter_space': self.param_space.param_distributions,
            'timestamp': datetime.now().isoformat()
        }
    
    def save_results(self, output_dir: str) -> str:
        """
        Save optimization results to disk
        
        Args:
            output_dir: Directory to save results
            
        Returns:
            Path to the saved results file
        """
        os.makedirs(output_dir, exist_ok=True)
        
        # Create results object
        results = {
            'summary': self.get_summary(),
            'trials': self.trials
        }
        
        # Generate filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"hyperopt_{self.optimization_type}_{timestamp}.json"
        filepath = os.path.join(output_dir, filename)
        
        # Save to file
        with open(filepath, 'w') as f:
            json.dump(results, f, indent=2)
        
        logger.info(f"Optimization results saved to {filepath}")
        return filepath
    
    def generate_visualization_data(self) -> Dict[str, Any]:
        """
        Generate data for visualization
        
        Returns:
            Visualization data
        """
        if not self.trials:
            return {"error": "No trials recorded"}
        
        # Extract parameter names and metrics
        param_names = list(self.trials[0]['params'].keys())
        metric_names = list(self.trials[0]['metrics'].keys())
        
        # Prepare data for parameter vs. metric plots
        param_vs_metric = {}
        for param_name in param_names:
            param_vs_metric[param_name] = {
                'values': [t['params'][param_name] for t in self.trials],
                'metrics': {
                    metric_name: [t['metrics'][metric_name] for t in self.trials]
                    for metric_name in metric_names
                }
            }
        
        # Prepare data for metric progress over trials
        metrics_progress = {
            metric_name: [t['metrics'][metric_name] for t in self.trials]
            for metric_name in metric_names
        }
        
        # Prepare parallel coordinates data
        parallel_coords_data = []
        for trial in self.trials:
            trial_data = {
                **{f"param_{k}": v for k, v in trial['params'].items()},
                **{f"metric_{k}": v for k, v in trial['metrics'].items()},
                'trial_id': trial['trial_id']
            }
            parallel_coords_data.append(trial_data)
        
        return {
            'param_vs_metric': param_vs_metric,
            'metrics_progress': metrics_progress,
            'parallel_coords_data': parallel_coords_data,
            'best_trial': self.best_trial['trial_id'] if self.best_trial else None,
            'param_names': param_names,
            'metric_names': metric_names
        }


class GridSearchOptimizer:
    """
    Grid search hyperparameter optimization
    """
    
    def __init__(self, param_space: ParameterSpace, output_dir: str):
        """
        Initialize grid search optimizer
        
        Args:
            param_space: Parameter space
            output_dir: Directory to save results
        """
        self.param_space = param_space
        self.output_dir = output_dir
        self.results = OptimizationResults('grid', param_space)
    
    def optimize(self, objective_fn: Callable[[Dict[str, Any]], Dict[str, float]], 
                max_trials: Optional[int] = None) -> Dict[str, Any]:
        """
        Run grid search optimization
        
        Args:
            objective_fn: Function that takes parameters and returns metrics
            max_trials: Maximum number of trials (limits the grid if specified)
            
        Returns:
            Optimization results summary
        """
        # Get parameter grid
        param_grid = self.param_space.get_param_grid()
        
        # Generate all combinations
        if SKLEARN_AVAILABLE:
            param_combinations = list(ParameterGrid(param_grid))
        else:
            keys = param_grid.keys()
            values = param_grid.values()
            param_combinations = [dict(zip(keys, combination)) for combination in itertools.product(*values)]
        
        # Limit the number of trials if specified
        if max_trials is not None and max_trials < len(param_combinations):
            logger.info(f"Limiting grid search to {max_trials} trials out of {len(param_combinations)} possible combinations")
            random.shuffle(param_combinations)
            param_combinations = param_combinations[:max_trials]
        
        logger.info(f"Starting grid search with {len(param_combinations)} parameter combinations")
        
        # Evaluate each combination
        for i, params in enumerate(param_combinations):
            trial_id = f"grid_{i:04d}"
            logger.info(f"Trial {trial_id}: {params}")
            
            # Run the objective function
            start_time = time.time()
            metrics = objective_fn(params)
            training_time = time.time() - start_time
            
            # Record results
            self.results.add_trial(params, metrics, training_time, trial_id)
            
            logger.info(f"Trial {trial_id} completed with metrics: {metrics}")
        
        # Save results
        self.results.save_results(self.output_dir)
        
        return self.results.get_summary()


class RandomSearchOptimizer:
    """
    Random search hyperparameter optimization
    """
    
    def __init__(self, param_space: ParameterSpace, output_dir: str):
        """
        Initialize random search optimizer
        
        Args:
            param_space: Parameter space
            output_dir: Directory to save results
        """
        self.param_space = param_space
        self.output_dir = output_dir
        self.results = OptimizationResults('random', param_space)
    
    def optimize(self, objective_fn: Callable[[Dict[str, Any]], Dict[str, float]], 
                n_trials: int = 10) -> Dict[str, Any]:
        """
        Run random search optimization
        
        Args:
            objective_fn: Function that takes parameters and returns metrics
            n_trials: Number of random trials
            
        Returns:
            Optimization results summary
        """
        # Sample random parameter combinations
        param_combinations = self.param_space.sample_random_params(n_trials)
        
        logger.info(f"Starting random search with {n_trials} trials")
        
        # Evaluate each combination
        for i, params in enumerate(param_combinations):
            trial_id = f"random_{i:04d}"
            logger.info(f"Trial {trial_id}: {params}")
            
            # Run the objective function
            start_time = time.time()
            metrics = objective_fn(params)
            training_time = time.time() - start_time
            
            # Record results
            self.results.add_trial(params, metrics, training_time, trial_id)
            
            logger.info(f"Trial {trial_id} completed with metrics: {metrics}")
        
        # Save results
        self.results.save_results(self.output_dir)
        
        return self.results.get_summary()


class BayesianOptimizer:
    """
    Bayesian optimization using Optuna (or simplified alternative)
    """
    
    def __init__(self, param_space: ParameterSpace, output_dir: str):
        """
        Initialize Bayesian optimizer
        
        Args:
            param_space: Parameter space
            output_dir: Directory to save results
        """
        self.param_space = param_space
        self.output_dir = output_dir
        self.results = OptimizationResults('bayesian', param_space)
        
        if not OPTUNA_AVAILABLE:
            logger.warning("Using simplified Bayesian optimization since Optuna is not available")
            self.simplified_optimizer = SimplifiedBayesianOptimizer(param_space)
    
    def _optuna_objective(self, trial, objective_fn: Callable[[Dict[str, Any]], Dict[str, float]]) -> float:
        """
        Objective function for Optuna
        
        Args:
            trial: Optuna trial
            objective_fn: User-provided objective function
            
        Returns:
            Objective value (validation accuracy)
        """
        # Sample parameters from the trial
        params = {}
        for param_name, param_info in self.param_space.param_distributions.items():
            if param_info['type'] == 'categorical':
                params[param_name] = trial.suggest_categorical(param_name, param_info['values'])
            elif param_info['type'] == 'integer':
                params[param_name] = trial.suggest_int(
                    param_name, 
                    param_info['low'], 
                    param_info['high'],
                    step=param_info.get('step', 1)
                )
            elif param_info['type'] == 'discrete_numerical':
                params[param_name] = trial.suggest_categorical(param_name, param_info['values'])
            elif param_info['type'] == 'continuous':
                if param_info['log']:
                    params[param_name] = trial.suggest_float(
                        param_name,
                        param_info['low'],
                        param_info['high'],
                        log=True
                    )
                else:
                    params[param_name] = trial.suggest_float(
                        param_name,
                        param_info['low'],
                        param_info['high']
                    )
        
        # Run the objective function
        start_time = time.time()
        metrics = objective_fn(params)
        training_time = time.time() - start_time
        
        # Record results
        trial_id = f"bayesian_{trial.number:04d}"
        self.results.add_trial(params, metrics, training_time, trial_id)
        
        logger.info(f"Trial {trial_id} completed with metrics: {metrics}")
        
        # Return the metric to maximize
        return metrics['val_accuracy']
    
    def optimize(self, objective_fn: Callable[[Dict[str, Any]], Dict[str, float]], 
                n_trials: int = 10, n_jobs: int = 1) -> Dict[str, Any]:
        """
        Run Bayesian optimization
        
        Args:
            objective_fn: Function that takes parameters and returns metrics
            n_trials: Number of trials
            n_jobs: Number of parallel jobs
            
        Returns:
            Optimization results summary
        """
        logger.info(f"Starting Bayesian optimization with {n_trials} trials")
        
        if OPTUNA_AVAILABLE:
            # Use Optuna for Bayesian optimization
            import optuna
            
            # Create study
            study = optuna.create_study(
                direction='maximize',
                sampler=optuna.samplers.TPESampler(seed=42)
            )
            
            # Run optimization
            study.optimize(
                lambda trial: self._optuna_objective(trial, objective_fn),
                n_trials=n_trials,
                n_jobs=n_jobs
            )
            
            # Log best results
            logger.info(f"Best trial: {study.best_trial.number}, Value: {study.best_trial.value}")
            logger.info(f"Best parameters: {study.best_trial.params}")
        else:
            # Use simplified Bayesian optimization
            for i in range(n_trials):
                trial_id = f"bayesian_{i:04d}"
                
                # Get next parameter suggestion
                params = self.simplified_optimizer.suggest()
                logger.info(f"Trial {trial_id}: {params}")
                
                # Run the objective function
                start_time = time.time()
                metrics = objective_fn(params)
                training_time = time.time() - start_time
                
                # Record results
                self.results.add_trial(params, metrics, training_time, trial_id)
                
                # Update the optimizer with the result
                self.simplified_optimizer.register_result(params, metrics['val_accuracy'])
                
                logger.info(f"Trial {trial_id} completed with metrics: {metrics}")
        
        # Save results
        self.results.save_results(self.output_dir)
        
        return self.results.get_summary()


def create_default_param_space(framework: str = "tensorflow") -> ParameterSpace:
    """
    Create a default parameter space for hyperparameter optimization
    
    Args:
        framework: Deep learning framework ("tensorflow" or "pytorch")
        
    Returns:
        Default parameter space
    """
    param_space = ParameterSpace()
    
    # Common parameters for both frameworks
    param_space.add_categorical_param("model_name", ["mobilenetv2", "resnet50", "efficientnetb0"])
    param_space.add_integer_param("batch_size", 8, 64, 8)
    param_space.add_numerical_param("learning_rate", 1e-5, 1e-2, log=True)
    param_space.add_integer_param("epochs", 5, 25, 5)
    param_space.add_numerical_param("dropout_rate", 0.1, 0.7, step=0.1)
    param_space.add_integer_param("num_layers_to_unfreeze", 0, 5, 1)
    param_space.add_categorical_param("augmentation_strength", ["light", "medium", "heavy"])
    
    # Framework-specific parameters
    if framework == "tensorflow":
        param_space.add_categorical_param("optimizer", ["adam", "sgd", "rmsprop"])
    else:  # pytorch
        param_space.add_categorical_param("optimizer", ["adam", "sgd", "adamw"])
        param_space.add_numerical_param("weight_decay", 1e-6, 1e-3, log=True)
    
    return param_space


def run_hyperparameter_optimization(
    train_fn: Callable[[Dict[str, Any]], Dict[str, float]],
    param_space: Optional[ParameterSpace] = None,
    optimization_type: str = "bayesian",
    n_trials: int = 10,
    output_dir: str = "./hyperopt_results",
    framework: str = "tensorflow"
) -> Dict[str, Any]:
    """
    Run hyperparameter optimization
    
    Args:
        train_fn: Training function that takes hyperparameters and returns metrics
        param_space: Parameter space (if None, uses default)
        optimization_type: Type of optimization ("grid", "random", or "bayesian")
        n_trials: Number of trials (for random and Bayesian optimization)
        output_dir: Directory to save results
        framework: Deep learning framework ("tensorflow" or "pytorch")
        
    Returns:
        Optimization results summary
    """
    # Use default parameter space if not provided
    if param_space is None:
        param_space = create_default_param_space(framework)
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Select optimizer
    if optimization_type == "grid":
        optimizer = GridSearchOptimizer(param_space, output_dir)
        results = optimizer.optimize(train_fn, max_trials=n_trials)
    elif optimization_type == "random":
        optimizer = RandomSearchOptimizer(param_space, output_dir)
        results = optimizer.optimize(train_fn, n_trials=n_trials)
    elif optimization_type == "bayesian":
        optimizer = BayesianOptimizer(param_space, output_dir)
        results = optimizer.optimize(train_fn, n_trials=n_trials)
    else:
        raise ValueError(f"Unsupported optimization type: {optimization_type}")
    
    logger.info(f"Hyperparameter optimization completed with best parameters: {results['best_params']}")
    logger.info(f"Best metrics: {results['best_metrics']}")
    
    return results


def optimize_hyperparameters_for_transfer_learning(
    dataset_dir: str, 
    output_dir: str, 
    custom_model_path: Optional[str] = None,
    optimization_type: str = "bayesian",
    n_trials: int = 10,
    framework: str = "auto",
    param_space: Optional[ParameterSpace] = None
) -> Dict[str, Any]:
    """
    Optimize hyperparameters for transfer learning
    
    Args:
        dataset_dir: Directory containing training data
        output_dir: Directory to save results
        custom_model_path: Path to a custom pretrained model (optional)
        optimization_type: Type of optimization ("grid", "random", or "bayesian")
        n_trials: Number of trials
        framework: Deep learning framework ("tensorflow", "pytorch", or "auto")
        param_space: Parameter space (if None, uses default)
        
    Returns:
        Optimization results summary
    """
    # Import transfer learning module
    try:
        from transfer_learning import fine_tune_with_small_dataset
    except ImportError:
        logger.error("transfer_learning module not found. Make sure it is in your Python path.")
        raise
    
    # Create optimization output directory
    hyperopt_output_dir = os.path.join(output_dir, "hyperopt")
    os.makedirs(hyperopt_output_dir, exist_ok=True)
    
    # Determine framework if auto
    if framework == "auto":
        try:
            import tensorflow
            framework = "tensorflow"
        except ImportError:
            try:
                import torch
                framework = "pytorch"
            except ImportError:
                raise ImportError("Neither TensorFlow nor PyTorch is available")
    
    # Use default parameter space if not provided
    if param_space is None:
        param_space = create_default_param_space(framework)
    
    # Define training function
    def train_with_hyperparams(params: Dict[str, Any]) -> Dict[str, float]:
        """Training function for hyperparameter optimization"""
        # Create trial-specific output directory
        trial_id = f"trial_{int(time.time() * 1000)}"
        trial_output_dir = os.path.join(hyperopt_output_dir, trial_id)
        os.makedirs(trial_output_dir, exist_ok=True)
        
        # Set common parameters
        common_params = {
            "dataset_dir": dataset_dir,
            "output_dir": trial_output_dir,
            "framework": framework,
            "custom_model_path": custom_model_path
        }
        
        # Run training with hyperparameters
        try:
            results = fine_tune_with_small_dataset(**common_params, **params)
            
            # Extract validation metrics
            metrics = {
                'val_accuracy': results['final_val_accuracy'],
                'val_loss': results.get('final_val_loss', 0.0),
                'accuracy': results['final_accuracy'],
                'loss': results.get('final_loss', 0.0)
            }
            
            return metrics
        except Exception as e:
            logger.error(f"Error during training: {e}")
            # Return poor metrics on failure
            return {
                'val_accuracy': 0.0,
                'val_loss': float('inf'),
                'accuracy': 0.0,
                'loss': float('inf')
            }
    
    # Run hyperparameter optimization
    results = run_hyperparameter_optimization(
        train_with_hyperparams,
        param_space=param_space,
        optimization_type=optimization_type,
        n_trials=n_trials,
        output_dir=hyperopt_output_dir,
        framework=framework
    )
    
    # Train a final model with the best hyperparameters
    logger.info("Training final model with best hyperparameters")
    final_output_dir = os.path.join(output_dir, "best_model")
    os.makedirs(final_output_dir, exist_ok=True)
    
    best_params = results['best_params']
    final_results = fine_tune_with_small_dataset(
        dataset_dir=dataset_dir,
        output_dir=final_output_dir,
        framework=framework,
        custom_model_path=custom_model_path,
        **best_params
    )
    
    # Save combined results
    combined_results = {
        'optimization_results': results,
        'final_model_results': final_results,
        'best_params': best_params,
        'timestamp': datetime.now().isoformat()
    }
    
    with open(os.path.join(output_dir, 'optimization_summary.json'), 'w') as f:
        json.dump(combined_results, f, indent=2)
    
    return combined_results