#!/usr/bin/env python3
"""
Distribution Shift Monitor

This module implements methods to detect distribution shifts in data,
particularly focusing on embedding space shifts for material recognition.

Features:
- Statistical tests for distribution comparison (e.g., KS test, Wasserstein distance).
- Monitoring of feature/embedding distributions over time.
- Alerting mechanism for significant shifts.
- Placeholder for embedding space visualization.
"""

import logging
import numpy as np
from typing import Dict, List, Any, Optional, Union

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('distribution_monitor')

# Try importing scipy for statistical tests
try:
    from scipy.stats import ks_2samp, wasserstein_distance
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    logger.warning("SciPy not available. Statistical tests for distribution shift will be limited.")

class DistributionMonitor:
    """
    Monitors data distributions to detect significant shifts over time.
    """

    def __init__(self, reference_stats: Optional[Dict[str, Any]] = None, alert_threshold: float = 0.05):
        """
        Initialize the Distribution Monitor.

        Args:
            reference_stats: Dictionary containing statistics of the reference distribution.
                             Expected keys: 'mean', 'std', 'histogram' (or samples).
            alert_threshold: p-value threshold for statistical tests to trigger an alert.
        """
        self.reference_stats = reference_stats or {}
        self.alert_threshold = alert_threshold
        self.history: List[Dict] = [] # To store historical distribution checks

        if not self.reference_stats:
            logger.warning("No reference statistics provided. Distribution shift detection will be limited.")
        elif SCIPY_AVAILABLE:
             logger.info("DistributionMonitor initialized with reference stats and SciPy.")
        else:
             logger.info("DistributionMonitor initialized. SciPy not found, tests limited.")


    def update_reference_stats(self, new_stats: Dict[str, Any]):
        """
        Update the reference distribution statistics.
        """
        self.reference_stats = new_stats
        logger.info("Updated reference distribution statistics.")

    def check_shift(self,
                    new_data: np.ndarray,
                    method: str = 'ks', # 'ks' or 'wasserstein'
                    feature_name: str = 'embedding') -> Dict[str, Any]:
        """
        Check for a distribution shift between new data and the reference data.

        Args:
            new_data: Numpy array of new data samples (e.g., embeddings, feature values).
                      Assumes 1D array for KS/Wasserstein, or flattens if multi-dimensional.
            method: Statistical test method ('ks' or 'wasserstein').
            feature_name: Name of the feature being checked (for logging/reporting).

        Returns:
            Dictionary containing the test statistic, p-value (for KS), distance (for Wasserstein),
            and whether a shift is detected based on the threshold.
        """
        if not SCIPY_AVAILABLE:
            logger.warning("SciPy not available, cannot perform statistical tests.")
            return {"shift_detected": False, "reason": "SciPy not available"}

        if not self.reference_stats or 'samples' not in self.reference_stats:
             # Requires reference samples for these tests. Could also work with histograms/means/stds for other tests.
             logger.warning("Reference samples not available in stats. Cannot perform KS or Wasserstein test.")
             return {"shift_detected": False, "reason": "Reference samples missing"}

        reference_samples = np.array(self.reference_stats['samples'])

        # Ensure data is 1D for standard tests
        if new_data.ndim > 1:
            # Option 1: Flatten (loses multi-dimensional info)
            # new_data_1d = new_data.flatten()
            # reference_samples_1d = reference_samples.flatten()
            # Option 2: Compare each dimension independently (more complex)
            # Option 3: Use multi-dimensional tests (e.g., from libraries like `dcor`)
            # For simplicity, let's compare marginal distributions (average across features)
            logger.debug(f"Input data for {feature_name} is multi-dimensional. Comparing mean feature values.")
            new_data_1d = np.mean(new_data, axis=tuple(range(1, new_data.ndim))) if new_data.ndim > 1 else new_data
            reference_samples_1d = np.mean(reference_samples, axis=tuple(range(1, reference_samples.ndim))) if reference_samples.ndim > 1 else reference_samples
        else:
            new_data_1d = new_data
            reference_samples_1d = reference_samples

        if new_data_1d.size == 0 or reference_samples_1d.size == 0:
             logger.warning("Not enough data points to perform distribution shift check.")
             return {"shift_detected": False, "reason": "Insufficient data"}


        result = {"feature": feature_name, "method": method}
        shift_detected = False

        try:
            if method == 'ks':
                statistic, p_value = ks_2samp(reference_samples_1d, new_data_1d)
                result["ks_statistic"] = statistic
                result["p_value"] = p_value
                shift_detected = p_value < self.alert_threshold
                logger.info(f"KS test for '{feature_name}': statistic={statistic:.4f}, p-value={p_value:.4f}")
            elif method == 'wasserstein':
                distance = wasserstein_distance(reference_samples_1d, new_data_1d)
                result["wasserstein_distance"] = distance
                # Thresholding Wasserstein distance is heuristic, depends on scale
                # Example: Trigger if distance is > 0.1 (needs tuning)
                wasserstein_threshold = self.reference_stats.get('wasserstein_threshold', 0.1)
                shift_detected = distance > wasserstein_threshold
                logger.info(f"Wasserstein test for '{feature_name}': distance={distance:.4f}")
            else:
                raise ValueError(f"Unsupported distribution shift method: {method}")

            result["shift_detected"] = shift_detected
            if shift_detected:
                logger.warning(f"Distribution shift detected for '{feature_name}' using {method} test!")
                self._trigger_alert(result)

        except Exception as e:
            logger.error(f"Error during distribution shift check for '{feature_name}': {e}")
            result["error"] = str(e)
            result["shift_detected"] = False # Default to no shift on error

        # Store history (optional)
        # self.history.append(result)

        return result

    def _trigger_alert(self, result: Dict[str, Any]):
        """
        Placeholder for triggering an alert when a shift is detected.
        This could involve sending notifications, logging critical events, etc.
        """
        logger.critical(f"ALERT: Distribution shift detected! Details: {result}")
        # TODO: Implement actual alerting mechanism (e.g., webhook, email, monitoring system integration)
        pass

    def visualize_distributions(self, new_data: np.ndarray, feature_name: str = 'embedding'):
        """
        Placeholder for visualizing distribution comparison.
        Requires matplotlib.
        """
        logger.warning("Distribution visualization not implemented yet.")
        # TODO: Implement visualization using matplotlib if needed
        pass

# Example Usage
if __name__ == "__main__":
    print("Testing Distribution Monitor...")

    # Create dummy reference data (e.g., 100 samples, 10 dimensions)
    ref_mean = np.zeros(10)
    ref_cov = np.eye(10) * 0.5
    reference_samples = np.random.multivariate_normal(ref_mean, ref_cov, 100)
    ref_stats = {
        "samples": reference_samples.tolist(), # Store samples for KS/Wasserstein
        "mean": np.mean(reference_samples, axis=0).tolist(),
        "std": np.std(reference_samples, axis=0).tolist(),
        "wasserstein_threshold": 0.15 # Example threshold
    }

    # Initialize monitor
    monitor = DistributionMonitor(reference_stats=ref_stats, alert_threshold=0.05)

    # --- Test Case 1: No shift ---
    print("\n--- Test Case 1: No Shift ---")
    new_data_no_shift = np.random.multivariate_normal(ref_mean, ref_cov, 50)
    result_ks_1 = monitor.check_shift(new_data_no_shift, method='ks', feature_name='embedding_no_shift')
    print(f"KS Result (No Shift): {result_ks_1}")
    result_w_1 = monitor.check_shift(new_data_no_shift, method='wasserstein', feature_name='embedding_no_shift')
    print(f"Wasserstein Result (No Shift): {result_w_1}")

    # --- Test Case 2: Mean Shift ---
    print("\n--- Test Case 2: Mean Shift ---")
    shifted_mean = np.ones(10) * 0.5 # Shift mean by 0.5
    new_data_mean_shift = np.random.multivariate_normal(shifted_mean, ref_cov, 50)
    result_ks_2 = monitor.check_shift(new_data_mean_shift, method='ks', feature_name='embedding_mean_shift')
    print(f"KS Result (Mean Shift): {result_ks_2}")
    result_w_2 = monitor.check_shift(new_data_mean_shift, method='wasserstein', feature_name='embedding_mean_shift')
    print(f"Wasserstein Result (Mean Shift): {result_w_2}")

     # --- Test Case 3: Variance Shift ---
    print("\n--- Test Case 3: Variance Shift ---")
    shifted_cov = np.eye(10) * 1.5 # Increase variance
    new_data_var_shift = np.random.multivariate_normal(ref_mean, shifted_cov, 50)
    result_ks_3 = monitor.check_shift(new_data_var_shift, method='ks', feature_name='embedding_var_shift')
    print(f"KS Result (Variance Shift): {result_ks_3}")
    result_w_3 = monitor.check_shift(new_data_var_shift, method='wasserstein', feature_name='embedding_var_shift')
    print(f"Wasserstein Result (Variance Shift): {result_w_3}")