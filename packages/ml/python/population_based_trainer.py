#!/usr/bin/env python3
"""
Population-Based Training (PBT) for Hyperparameter Optimization

This module implements a Population-Based Training algorithm to optimize
hyperparameters concurrently with model training.

Key components:
- Manages a population of models with varying hyperparameters.
- Coordinates parallel training workers (potentially simulated or using multiprocessing).
- Implements evolutionary selection (e.g., truncation selection).
- Applies hyperparameter mutations/perturbations (exploration).
- Copies weights from better-performing models (exploitation).
"""

import os
import json
import time
import random
import logging
import copy
import multiprocessing
from typing import Dict, List, Any, Tuple, Optional, Callable

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('pbt_trainer')

# Placeholder for model training function (would likely call parts of model_trainer.py)
# This function needs to accept hyperparameters, train for one step/epoch, and return performance.
def train_step(worker_id: int, model_config: Dict, hyperparameters: Dict, data_dir: str) -> Tuple[float, Dict]:
    """
    Placeholder function representing training a model for one step/epoch.

    Args:
        worker_id: Identifier for the worker/model instance.
        model_config: Configuration for the model architecture, etc.
        hyperparameters: Current hyperparameters (e.g., learning_rate).
        data_dir: Path to the training data.

    Returns:
        Tuple of (performance_metric, updated_model_state_or_path).
        Performance metric could be validation accuracy/loss.
    """
    logger.debug(f"Worker {worker_id}: Training step with LR={hyperparameters.get('learning_rate', 0.001)}")
    # Simulate training step
    time.sleep(random.uniform(0.5, 1.5))
    # Simulate performance - higher LR might learn faster initially but plateau
    performance = random.uniform(0.5, 0.9) + hyperparameters.get('learning_rate', 0.001) * 10
    performance = min(performance, 0.95) # Cap performance
    # Simulate model state update (e.g., path to saved weights)
    model_state = {"weights_path": f"/path/to/worker_{worker_id}_weights.h5"}
    logger.debug(f"Worker {worker_id}: Step complete. Performance={performance:.4f}")
    return performance, model_state


class PopulationBasedTrainer:
    """
    Manages the Population-Based Training process.
    """

    def __init__(self,
                 population_size: int,
                 hyperparameter_space: Dict[str, Tuple[float, float]], # e.g., {"learning_rate": (1e-5, 1e-2)}
                 model_config: Dict,
                 data_dir: str,
                 num_workers: Optional[int] = None,
                 steps_per_update: int = 10,
                 exploitation_quantile: float = 0.2,
                 exploration_perturb_factor: float = 1.2):
        """
        Initialize the PBT trainer.

        Args:
            population_size: Number of models in the population.
            hyperparameter_space: Dict defining the range for each hyperparameter.
            model_config: Configuration for the base model architecture.
            data_dir: Directory containing training data.
            num_workers: Number of parallel workers (defaults to population_size).
            steps_per_update: How many training steps before evaluating/updating population.
            exploitation_quantile: Fraction of bottom performers to replace (e.g., 0.2 means bottom 20%).
            exploration_perturb_factor: Factor for perturbing hyperparameters (e.g., 1.2 means *1.2 or /1.2).
        """
        self.population_size = population_size
        self.hyperparameter_space = hyperparameter_space
        self.model_config = model_config
        self.data_dir = data_dir
        self.num_workers = num_workers or population_size
        self.steps_per_update = steps_per_update
        self.exploitation_quantile = exploitation_quantile
        self.exploration_perturb_factor = exploration_perturb_factor

        self.population: List[Dict] = [] # Stores state: {'id', 'hyperparameters', 'model_state', 'performance', 'steps'}
        self.history: List[Dict] = [] # Track performance over time

        self._initialize_population()
        logger.info(f"PBT Initialized with population size {self.population_size}")

    def _initialize_population(self):
        """Create the initial population with random hyperparameters."""
        self.population = []
        for i in range(self.population_size):
            hyperparams = {}
            for name, (min_val, max_val) in self.hyperparameter_space.items():
                # Sample logarithmically for learning rates, linearly otherwise
                if "learning_rate" in name:
                     log_min, log_max = np.log(min_val), np.log(max_val)
                     hyperparams[name] = np.exp(random.uniform(log_min, log_max))
                else:
                     hyperparams[name] = random.uniform(min_val, max_val)

            self.population.append({
                "id": i,
                "hyperparameters": hyperparams,
                "model_state": None, # Initial model state (e.g., path to initial weights)
                "performance": -float('inf'), # Initialize with worst performance
                "steps": 0
            })
        logger.info("Initialized population with random hyperparameters.")

    def _exploit(self, sorted_population: List[Dict]):
        """
        Exploitation step: Replace bottom performers with copies of top performers.
        """
        num_to_replace = int(self.population_size * self.exploitation_quantile)
        if num_to_replace == 0:
            return # Nothing to replace

        top_performers = sorted_population[-num_to_replace:] # Best are at the end
        bottom_performers = sorted_population[:num_to_replace] # Worst are at the beginning

        for i in range(num_to_replace):
            target_worker = bottom_performers[i]
            source_worker = top_performers[i % len(top_performers)] # Cycle through top performers

            logger.info(f"Exploit: Worker {target_worker['id']} (perf={target_worker['performance']:.4f}) "
                        f"copying from Worker {source_worker['id']} (perf={source_worker['performance']:.4f})")

            # Copy hyperparameters and model state
            target_worker['hyperparameters'] = copy.deepcopy(source_worker['hyperparameters'])
            target_worker['model_state'] = copy.deepcopy(source_worker['model_state']) # Assumes state can be copied
            target_worker['performance'] = source_worker['performance'] # Inherit performance temporarily
            target_worker['steps'] = source_worker['steps'] # Sync steps

    def _explore(self, worker_state: Dict):
        """
        Exploration step: Perturb the hyperparameters of a worker.
        """
        hyperparams = worker_state['hyperparameters']
        perturbed_hyperparams = {}

        for name, value in hyperparams.items():
            perturb_factor = random.uniform(1.0 / self.exploration_perturb_factor, self.exploration_perturb_factor)
            new_value = value * perturb_factor

            # Clip to defined range
            min_val, max_val = self.hyperparameter_space[name]
            new_value = max(min_val, min(max_val, new_value))
            perturbed_hyperparams[name] = new_value

        logger.debug(f"Explore: Worker {worker_state['id']} hyperparameters perturbed: {hyperparams} -> {perturbed_hyperparams}")
        worker_state['hyperparameters'] = perturbed_hyperparams

    def run(self, total_steps: int):
        """
        Run the PBT algorithm.

        Args:
            total_steps: Total number of training steps to run.
        """
        current_step = 0
        while current_step < total_steps:
            next_update_step = current_step + self.steps_per_update
            steps_to_run = min(self.steps_per_update, total_steps - current_step)

            logger.info(f"--- Running PBT from step {current_step} to {current_step + steps_to_run} ---")

            # --- Parallel Training Step ---
            # This part needs a robust implementation for parallel execution.
            # Using multiprocessing.Pool as a basic example.
            # A real implementation might use Ray Tune or similar frameworks.
            pool = multiprocessing.Pool(self.num_workers)
            results = []

            try:
                tasks = []
                for worker_state in self.population:
                     # In a real scenario, train_step would load model_state, train, and save new state
                     tasks.append(
                         pool.apply_async(train_step, (
                             worker_state['id'],
                             self.model_config,
                             worker_state['hyperparameters'],
                             self.data_dir
                             # Pass model_state if needed: worker_state['model_state']
                         ))
                     )
                     worker_state['steps'] += steps_to_run # Increment steps optimistically

                pool.close()
                pool.join() # Wait for all workers to finish the step

                # Collect results
                for i, task_result in enumerate(tasks):
                    try:
                        performance, new_model_state = task_result.get()
                        self.population[i]['performance'] = performance
                        self.population[i]['model_state'] = new_model_state # Update model state
                    except Exception as e:
                         logger.error(f"Worker {self.population[i]['id']} failed step: {e}")
                         # Handle worker failure (e.g., reset performance)
                         self.population[i]['performance'] = -float('inf')

            except Exception as e:
                 logger.error(f"Error during parallel training step: {e}")
                 pool.terminate() # Terminate pool on error
                 raise

            current_step += steps_to_run

            # --- Evaluation and Update Step ---
            # Sort population by performance (ascending - worst first)
            sorted_population = sorted(self.population, key=lambda x: x['performance'])

            # Record history
            step_history = {
                "step": current_step,
                "population_stats": [
                    {"id": w['id'], "perf": w['performance'], "hparams": w['hyperparameters']}
                    for w in sorted_population
                ]
            }
            self.history.append(step_history)
            logger.info(f"Step {current_step}: Best Perf={sorted_population[-1]['performance']:.4f}, "
                        f"Worst Perf={sorted_population[0]['performance']:.4f}")

            # Exploit: Replace worst performers
            self._exploit(sorted_population)

            # Explore: Perturb hyperparameters (including those just copied)
            for worker_state in self.population:
                self._explore(worker_state)

        logger.info("--- PBT Run Completed ---")
        # Save final history?
        # Return best model/hyperparameters?
        best_worker = max(self.population, key=lambda x: x['performance'])
        logger.info(f"Best performing worker: ID={best_worker['id']}, "
                    f"Performance={best_worker['performance']:.4f}, "
                    f"Hyperparameters={best_worker['hyperparameters']}")
        return best_worker


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Population-Based Training Runner")
    parser.add_argument("--data-dir", required=True, help="Path to training data")
    parser.add_argument("--population-size", type=int, default=10, help="Number of models in population")
    parser.add_argument("--total-steps", type=int, default=100, help="Total training steps")
    parser.add_argument("--steps-per-update", type=int, default=10, help="Steps between PBT updates")
    parser.add_argument("--num-workers", type=int, default=None, help="Number of parallel workers (default: population size)")

    args = parser.parse_args()

    # Define hyperparameter space (example: learning rate)
    hparam_space = {
        "learning_rate": (1e-5, 1e-2)
        # Add other hyperparameters here, e.g., dropout_rate, batch_size (if adaptable)
    }

    # Define model configuration (placeholder)
    model_cfg = {
        "architecture": "mobilenet", # Example
        "input_shape": [224, 224, 3]
    }

    # Initialize and run PBT
    pbt_trainer = PopulationBasedTrainer(
        population_size=args.population_size,
        hyperparameter_space=hparam_space,
        model_config=model_cfg,
        data_dir=args.data_dir,
        num_workers=args.num_workers,
        steps_per_update=args.steps_per_update
    )

    try:
        best_result = pbt_trainer.run(total_steps=args.total_steps)
        print("\n--- PBT Finished ---")
        print(f"Best Worker ID: {best_result['id']}")
        print(f"Best Performance: {best_result['performance']:.4f}")
        print(f"Best Hyperparameters: {json.dumps(best_result['hyperparameters'], indent=2)}")
        # In a real scenario, you would retrieve the best model state: best_result['model_state']
    except Exception as e:
        logger.error(f"PBT run failed: {e}")
        sys.exit(1)