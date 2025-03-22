#!/usr/bin/env python3
"""
Training Progress Visualization Module

This module enhances progress reporting with real-time charts and metrics
for better visualization of model training progress, learning curves,
and performance metrics.

Features:
1. Real-time training metrics visualization
2. Learning curve plotting
3. Integration with progress reporting system
4. Export of charts for embedding in web interfaces
5. Model performance comparisons
"""

import os
import json
import time
import uuid
import datetime
import logging
from typing import Dict, List, Any, Optional, Union, Tuple, Callable
from dataclasses import dataclass
import base64
from io import BytesIO

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('training_visualization')

# Try to import progress reporter
try:
    from progress_reporter import HybridProgressReporter
    PROGRESS_REPORTER_AVAILABLE = True
except ImportError:
    PROGRESS_REPORTER_AVAILABLE = False
    logger.warning("progress_reporter module not found, some features will be disabled")

# Try to import plotting libraries
try:
    import matplotlib
    matplotlib.use('Agg')  # Use non-interactive backend
    import matplotlib.pyplot as plt
    import seaborn as sns
    PLOTTING_AVAILABLE = True
except ImportError:
    PLOTTING_AVAILABLE = False
    logger.warning("Matplotlib and/or Seaborn not available. Visualization will be limited.")

# Try to import numpy for data manipulation
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    logger.warning("NumPy not available. Some data transformation features will be disabled.")


# Data structures for metrics tracking
@dataclass
class TrainingMetric:
    """Represents a single training metric with timestamp"""
    name: str
    value: float
    epoch: Optional[int] = None
    iteration: Optional[int] = None
    timestamp: Optional[str] = None
    
    def __post_init__(self):
        """Initialize default values"""
        if self.timestamp is None:
            self.timestamp = datetime.datetime.now().isoformat()


class MetricsTracker:
    """Tracks training metrics over time"""
    
    def __init__(self, job_id: str, metrics_dir: Optional[str] = None):
        """
        Initialize metrics tracker
        
        Args:
            job_id: Unique identifier for the training job
            metrics_dir: Directory to save metrics (if None, metrics are only kept in memory)
        """
        self.job_id = job_id
        self.metrics_dir = metrics_dir
        self.metrics: Dict[str, List[TrainingMetric]] = {}
        self.epochs: List[int] = []
        
        # Create metrics directory if provided
        if metrics_dir:
            os.makedirs(metrics_dir, exist_ok=True)
    
    def add_metric(self, name: str, value: float, epoch: Optional[int] = None, 
                  iteration: Optional[int] = None) -> None:
        """
        Add a metric value
        
        Args:
            name: Metric name
            value: Metric value
            epoch: Optional epoch number
            iteration: Optional iteration number
        """
        metric = TrainingMetric(name=name, value=value, epoch=epoch, iteration=iteration)
        
        if name not in self.metrics:
            self.metrics[name] = []
        
        self.metrics[name].append(metric)
        
        if epoch is not None and epoch not in self.epochs:
            self.epochs.append(epoch)
            self.epochs.sort()
        
        # Save metrics to file if directory is provided
        if self.metrics_dir:
            self._save_metrics()
    
    def add_metrics_dict(self, metrics_dict: Dict[str, float], epoch: Optional[int] = None,
                        iteration: Optional[int] = None) -> None:
        """
        Add multiple metrics from a dictionary
        
        Args:
            metrics_dict: Dictionary of metric name to value
            epoch: Optional epoch number
            iteration: Optional iteration number
        """
        for name, value in metrics_dict.items():
            self.add_metric(name, value, epoch, iteration)
    
    def get_metric_values(self, name: str) -> List[float]:
        """
        Get all values for a metric
        
        Args:
            name: Metric name
            
        Returns:
            List of metric values
        """
        if name not in self.metrics:
            return []
        
        return [metric.value for metric in self.metrics[name]]
    
    def get_metric_by_epoch(self, name: str) -> Dict[int, List[float]]:
        """
        Get metric values grouped by epoch
        
        Args:
            name: Metric name
            
        Returns:
            Dictionary mapping epoch to list of values
        """
        if name not in self.metrics:
            return {}
        
        result = {}
        for metric in self.metrics[name]:
            if metric.epoch is not None:
                if metric.epoch not in result:
                    result[metric.epoch] = []
                result[metric.epoch].append(metric.value)
        
        return result
    
    def get_latest_metrics(self) -> Dict[str, float]:
        """
        Get the latest value for each metric
        
        Returns:
            Dictionary mapping metric name to latest value
        """
        result = {}
        for name, metrics in self.metrics.items():
            if metrics:
                result[name] = metrics[-1].value
        
        return result
    
    def _save_metrics(self) -> None:
        """Save metrics to a JSON file"""
        metrics_file = os.path.join(self.metrics_dir, f"{self.job_id}_metrics.json")
        
        # Convert metrics to serializable format
        serializable_metrics = {}
        for name, metrics in self.metrics.items():
            serializable_metrics[name] = [
                {
                    "value": metric.value,
                    "epoch": metric.epoch,
                    "iteration": metric.iteration,
                    "timestamp": metric.timestamp
                }
                for metric in metrics
            ]
        
        # Save to file
        with open(metrics_file, 'w') as f:
            json.dump(serializable_metrics, f, indent=2)
    
    def load_metrics(self) -> bool:
        """
        Load metrics from file
        
        Returns:
            Success flag
        """
        if not self.metrics_dir:
            return False
        
        metrics_file = os.path.join(self.metrics_dir, f"{self.job_id}_metrics.json")
        
        if not os.path.exists(metrics_file):
            return False
        
        try:
            with open(metrics_file, 'r') as f:
                serialized_metrics = json.load(f)
            
            # Convert to TrainingMetric objects
            for name, metrics_data in serialized_metrics.items():
                self.metrics[name] = [
                    TrainingMetric(
                        name=name,
                        value=data["value"],
                        epoch=data.get("epoch"),
                        iteration=data.get("iteration"),
                        timestamp=data.get("timestamp")
                    )
                    for data in metrics_data
                ]
                
                # Update epochs list
                for metric in self.metrics[name]:
                    if metric.epoch is not None and metric.epoch not in self.epochs:
                        self.epochs.append(metric.epoch)
            
            self.epochs.sort()
            return True
        
        except Exception as e:
            logger.error(f"Error loading metrics: {e}")
            return False


class ProgressVisualizer:
    """Visualizes training progress with charts and metrics"""
    
    def __init__(self, metrics_tracker: MetricsTracker, output_dir: str):
        """
        Initialize the progress visualizer
        
        Args:
            metrics_tracker: Metrics tracker
            output_dir: Directory to save visualization outputs
        """
        self.metrics_tracker = metrics_tracker
        self.output_dir = output_dir
        
        if not PLOTTING_AVAILABLE:
            logger.warning("Plotting libraries not available, visualization disabled")
        else:
            # Set up plotting style
            plt.style.use('seaborn-v0_8-darkgrid')
            sns.set_context("talk")
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
    
    def plot_learning_curves(self, 
                            metrics: Optional[List[str]] = None,
                            figsize: Tuple[int, int] = (12, 8),
                            save_path: Optional[str] = None) -> Optional[str]:
        """
        Plot learning curves for specified metrics
        
        Args:
            metrics: List of metrics to plot (if None, plots loss and accuracy)
            figsize: Figure size
            save_path: Path to save the figure (if None, saves to output directory)
            
        Returns:
            Path to the saved figure or None if plotting is not available
        """
        if not PLOTTING_AVAILABLE:
            return None
        
        # Default metrics
        if metrics is None:
            metrics = ["loss", "accuracy"]
            
            # Check if validation metrics are available
            if "val_loss" in self.metrics_tracker.metrics:
                metrics.extend(["val_loss", "val_accuracy"])
        
        # Filter to available metrics
        metrics = [m for m in metrics if m in self.metrics_tracker.metrics]
        
        if not metrics:
            logger.warning("No metrics available for plotting learning curves")
            return None
        
        # Calculate grid dimensions
        n_metrics = len(metrics)
        n_cols = min(3, n_metrics)
        n_rows = (n_metrics + n_cols - 1) // n_cols
        
        fig, axes = plt.subplots(n_rows, n_cols, figsize=figsize)
        if n_rows * n_cols == 1:
            axes = [axes]
        axes = axes.flatten() if hasattr(axes, 'flatten') else axes
        
        for i, metric_name in enumerate(metrics):
            if i >= len(axes):
                break
                
            ax = axes[i]
            
            # Get metric values by epoch
            metrics_by_epoch = self.metrics_tracker.get_metric_by_epoch(metric_name)
            
            if not metrics_by_epoch:
                ax.text(0.5, 0.5, f"No data for {metric_name}", 
                      horizontalalignment='center', verticalalignment='center')
                continue
            
            # Calculate mean and std for each epoch
            epochs = sorted(metrics_by_epoch.keys())
            mean_values = [np.mean(metrics_by_epoch[e]) for e in epochs]
            
            if len(metrics_by_epoch[epochs[0]]) > 1:
                # If multiple values per epoch, plot with std deviation
                std_values = [np.std(metrics_by_epoch[e]) for e in epochs]
                ax.fill_between(epochs, 
                               [m - s for m, s in zip(mean_values, std_values)],
                               [m + s for m, s in zip(mean_values, std_values)],
                               alpha=0.2)
            
            # Plot mean values
            ax.plot(epochs, mean_values, 'o-', label=f'Mean {metric_name}')
            
            # Add labels and title
            ax.set_xlabel('Epoch')
            ax.set_ylabel(metric_name.capitalize())
            ax.set_title(f'{metric_name.capitalize()} vs. Epoch')
            
            # Set integer ticks for epochs
            ax.xaxis.set_major_locator(plt.MaxNLocator(integer=True))
            
            if len(epochs) > 1:
                ax.set_xlim(min(epochs) - 0.2, max(epochs) + 0.2)
            
            ax.legend()
        
        # Hide unused subplots
        for i in range(n_metrics, len(axes)):
            axes[i].axis('off')
        
        plt.tight_layout()
        
        # Determine save path
        if save_path is None:
            timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
            save_path = os.path.join(self.output_dir, f"learning_curves_{timestamp}.png")
        
        # Save figure
        plt.savefig(save_path, bbox_inches='tight', dpi=150)
        plt.close(fig)
        
        return save_path
    
    def plot_metric_comparison(self, metrics: List[str], figsize: Tuple[int, int] = (10, 6),
                              save_path: Optional[str] = None) -> Optional[str]:
        """
        Plot comparison of multiple metrics
        
        Args:
            metrics: List of metrics to compare
            figsize: Figure size
            save_path: Path to save the figure
            
        Returns:
            Path to the saved figure or None if plotting is not available
        """
        if not PLOTTING_AVAILABLE or not NUMPY_AVAILABLE:
            return None
        
        # Filter to available metrics
        metrics = [m for m in metrics if m in self.metrics_tracker.metrics]
        
        if len(metrics) < 2:
            logger.warning("Need at least 2 metrics for comparison plot")
            return None
        
        # Create figure
        fig, ax = plt.subplots(figsize=figsize)
        
        # Get common epochs
        common_epochs = set()
        for metric in metrics:
            metric_by_epoch = self.metrics_tracker.get_metric_by_epoch(metric)
            if common_epochs:
                common_epochs.intersection_update(metric_by_epoch.keys())
            else:
                common_epochs = set(metric_by_epoch.keys())
        
        if not common_epochs:
            logger.warning("No common epochs found for selected metrics")
            return None
        
        epochs = sorted(common_epochs)
        
        # Plot each metric
        for metric in metrics:
            metric_by_epoch = self.metrics_tracker.get_metric_by_epoch(metric)
            mean_values = [np.mean(metric_by_epoch[e]) for e in epochs]
            
            # Normalize to [0,1] range for easier comparison
            if len(mean_values) > 1:
                min_val = min(mean_values)
                max_val = max(mean_values)
                if max_val > min_val:
                    normalized_values = [(v - min_val) / (max_val - min_val) for v in mean_values]
                else:
                    normalized_values = [0.5 for _ in mean_values]
            else:
                normalized_values = [0.5]
            
            ax.plot(epochs, normalized_values, 'o-', label=metric)
        
        # Add labels and title
        ax.set_xlabel('Epoch')
        ax.set_ylabel('Normalized Value')
        ax.set_title('Metric Comparison (Normalized)')
        
        # Set integer ticks for epochs
        ax.xaxis.set_major_locator(plt.MaxNLocator(integer=True))
        
        if len(epochs) > 1:
            ax.set_xlim(min(epochs) - 0.2, max(epochs) + 0.2)
        
        ax.set_ylim(-0.05, 1.05)
        ax.legend()
        
        plt.tight_layout()
        
        # Determine save path
        if save_path is None:
            timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
            save_path = os.path.join(self.output_dir, f"metric_comparison_{timestamp}.png")
        
        # Save figure
        plt.savefig(save_path, bbox_inches='tight', dpi=150)
        plt.close(fig)
        
        return save_path
    
    def plot_distribution(self, metric: str, figsize: Tuple[int, int] = (8, 6),
                        save_path: Optional[str] = None) -> Optional[str]:
        """
        Plot distribution of a metric
        
        Args:
            metric: Metric to plot
            figsize: Figure size
            save_path: Path to save the figure
            
        Returns:
            Path to the saved figure or None if plotting is not available
        """
        if not PLOTTING_AVAILABLE or not NUMPY_AVAILABLE:
            return None
        
        if metric not in self.metrics_tracker.metrics:
            logger.warning(f"Metric {metric} not available")
            return None
        
        # Get metric values
        values = self.metrics_tracker.get_metric_values(metric)
        
        if not values:
            logger.warning(f"No values for metric {metric}")
            return None
        
        # Create figure
        fig, ax = plt.subplots(figsize=figsize)
        
        # Plot distribution
        sns.histplot(values, kde=True, ax=ax)
        
        # Add labels and title
        ax.set_xlabel(metric.capitalize())
        ax.set_ylabel('Frequency')
        ax.set_title(f'Distribution of {metric.capitalize()}')
        
        plt.tight_layout()
        
        # Determine save path
        if save_path is None:
            timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
            save_path = os.path.join(self.output_dir, f"{metric}_distribution_{timestamp}.png")
        
        # Save figure
        plt.savefig(save_path, bbox_inches='tight', dpi=150)
        plt.close(fig)
        
        return save_path
    
    def generate_html_report(self, save_path: Optional[str] = None) -> Optional[str]:
        """
        Generate an HTML report with all visualizations
        
        Args:
            save_path: Path to save the HTML report
            
        Returns:
            Path to the saved report or None if plotting is not available
        """
        if not PLOTTING_AVAILABLE:
            return None
        
        # Determine save path
        if save_path is None:
            timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
            save_path = os.path.join(self.output_dir, f"training_report_{timestamp}.html")
        
        # Generate visualizations
        learning_curves_path = self.plot_learning_curves()
        
        # Find metrics for comparison (pairs of related metrics)
        comparison_metrics = []
        all_metrics = list(self.metrics_tracker.metrics.keys())
        
        # Look for validation/training pairs
        for metric in all_metrics:
            if metric.startswith('val_') and metric[4:] in all_metrics:
                comparison_metrics.append([metric[4:], metric])
        
        # If no pairs found, use all metrics
        if not comparison_metrics and len(all_metrics) >= 2:
            comparison_metrics = [all_metrics]
        
        # Generate comparison plots
        comparison_paths = []
        for metrics in comparison_metrics:
            path = self.plot_metric_comparison(metrics)
            if path:
                comparison_paths.append(path)
        
        # Generate distribution plots
        distribution_paths = []
        for metric in all_metrics:
            path = self.plot_distribution(metric)
            if path:
                distribution_paths.append(path)
        
        # Get latest metrics
        latest_metrics = self.metrics_tracker.get_latest_metrics()
        
        # HTML Template
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Training Progress Report - {self.metrics_tracker.job_id}</title>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 1200px; margin: 0 auto; }}
                h1, h2, h3 {{ color: #333; }}
                .metrics-table {{ border-collapse: collapse; width: 100%; margin-bottom: 20px; }}
                .metrics-table th, .metrics-table td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                .metrics-table th {{ background-color: #f2f2f2; }}
                .metrics-table tr:nth-child(even) {{ background-color: #f9f9f9; }}
                .visualization {{ margin-bottom: 30px; }}
                .visualization img {{ max-width: 100%; height: auto; border: 1px solid #ddd; }}
                .footer {{ margin-top: 30px; color: #777; font-size: 0.9em; }}
            </style>
        </head>
        <body>
            <h1>Training Progress Report</h1>
            <p>Job ID: {self.metrics_tracker.job_id}</p>
            <p>Generated on: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            
            <h2>Latest Metrics</h2>
            <table class="metrics-table">
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                </tr>
        """
        
        # Add metrics rows
        for name, value in latest_metrics.items():
            html += f"""
                <tr>
                    <td>{name}</td>
                    <td>{value:.6f}</td>
                </tr>
            """
        
        html += """
            </table>
            
            <h2>Learning Curves</h2>
        """
        
        # Add learning curves
        if learning_curves_path:
            with open(learning_curves_path, 'rb') as img_file:
                img_data = base64.b64encode(img_file.read()).decode('utf-8')
            
            html += f"""
            <div class="visualization">
                <img src="data:image/png;base64,{img_data}" alt="Learning Curves">
            </div>
            """
        
        # Add metric comparisons
        if comparison_paths:
            html += """
            <h2>Metric Comparisons</h2>
            """
            
            for path in comparison_paths:
                with open(path, 'rb') as img_file:
                    img_data = base64.b64encode(img_file.read()).decode('utf-8')
                
                html += f"""
                <div class="visualization">
                    <img src="data:image/png;base64,{img_data}" alt="Metric Comparison">
                </div>
                """
        
        # Add distribution plots
        if distribution_paths:
            html += """
            <h2>Metric Distributions</h2>
            """
            
            for path in distribution_paths:
                with open(path, 'rb') as img_file:
                    img_data = base64.b64encode(img_file.read()).decode('utf-8')
                
                html += f"""
                <div class="visualization">
                    <img src="data:image/png;base64,{img_data}" alt="Metric Distribution">
                </div>
                """
        
        # Complete HTML
        html += """
            <div class="footer">
                <p>Generated using ML Training Visualization Module</p>
            </div>
        </body>
        </html>
        """
        
        # Save HTML report
        with open(save_path, 'w') as f:
            f.write(html)
        
        return save_path
    
    def save_chart_for_web(self, chart_type: str, **kwargs) -> Dict[str, Any]:
        """
        Generate and save a chart for web embedding
        
        Args:
            chart_type: Type of chart to generate
            **kwargs: Additional parameters for the chart function
            
        Returns:
            Dictionary with chart info
        """
        if not PLOTTING_AVAILABLE:
            return {"error": "Plotting libraries not available"}
        
        # Determine chart function
        if chart_type == "learning_curves":
            chart_fn = self.plot_learning_curves
        elif chart_type == "metric_comparison":
            chart_fn = self.plot_metric_comparison
        elif chart_type == "distribution":
            chart_fn = self.plot_distribution
        else:
            return {"error": f"Unknown chart type: {chart_type}"}
        
        # Generate chart to memory
        plt.figure()
        chart_path = chart_fn(**kwargs)
        
        if not chart_path:
            return {"error": "Failed to generate chart"}
        
        # Convert to base64 for web embedding
        with open(chart_path, 'rb') as img_file:
            img_data = base64.b64encode(img_file.read()).decode('utf-8')
        
        return {
            "chart_type": chart_type,
            "image_path": chart_path,
            "image_data_url": f"data:image/png;base64,{img_data}"
        }


class EnhancedProgressReporter:
    """
    Enhanced progress reporter with visualization capabilities
    
    This class enhances the standard progress reporter with real-time
    visualization of training metrics and learning curves.
    """
    
    def __init__(
        self,
        base_reporter=None,
        visualize: bool = True,
        output_dir: str = "./training_viz",
        job_id: Optional[str] = None
    ):
        """
        Initialize enhanced progress reporter
        
        Args:
            base_reporter: Base progress reporter to enhance (creates new one if None)
            visualize: Whether to enable visualization
            output_dir: Output directory for visualizations
            job_id: Job ID (generated if None)
        """
        # Set job ID
        self.job_id = job_id or str(uuid.uuid4())
        
        # Create or use base reporter
        if base_reporter is None and PROGRESS_REPORTER_AVAILABLE:
            self.reporter = HybridProgressReporter()
        else:
            self.reporter = base_reporter
        
        # Initialize metrics tracker
        self.metrics_tracker = MetricsTracker(self.job_id, metrics_dir=output_dir)
        
        # Initialize visualizer if enabled
        self.visualize = visualize and PLOTTING_AVAILABLE
        self.visualizer = ProgressVisualizer(self.metrics_tracker, output_dir) if self.visualize else None
        
        # Create output directory
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        
        # Track epoch metrics
        self.epoch_metrics = {}
        self.current_epoch = None
    
    def start_job(self, model_type: str, metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Start a training job
        
        Args:
            model_type: Type of model being trained
            metadata: Optional metadata about the job
            
        Returns:
            Job ID
        """
        # Start job in base reporter
        if self.reporter:
            self.reporter.start_job(model_type, self.job_id, metadata)
        
        return self.job_id
    
    def update_progress(self, 
                       progress: float, 
                       current_epoch: Optional[int] = None,
                       metrics: Optional[Dict[str, float]] = None, 
                       **kwargs) -> None:
        """
        Update training progress with metrics
        
        Args:
            progress: Progress as a float between 0 and 1
            current_epoch: Current epoch number
            metrics: Dictionary of metric name to value
            **kwargs: Additional arguments for base reporter
        """
        # Track epoch change
        if current_epoch is not None and current_epoch != self.current_epoch:
            self.current_epoch = current_epoch
            self.epoch_metrics = {}
        
        # Update base reporter
        if self.reporter:
            all_args = {
                "progress": progress,
                "current_epoch": current_epoch
            }
            
            # Add metrics if provided
            if metrics:
                all_args.update(metrics)
            
            # Add additional kwargs
            all_args.update(kwargs)
            
            self.reporter.update_progress(**all_args)
        
        # Track metrics
        if metrics:
            # Add metrics to tracker
            self.metrics_tracker.add_metrics_dict(metrics, epoch=current_epoch)
            
            # Update epoch metrics
            if current_epoch is not None:
                for name, value in metrics.items():
                    if name not in self.epoch_metrics:
                        self.epoch_metrics[name] = []
                    self.epoch_metrics[name].append(value)
        
        # Generate visualizations if epoch complete
        if self.visualize and self.visualizer and kwargs.get("epoch_end", False):
            # Generate learning curves
            self.visualizer.plot_learning_curves()
            
            # Check if we have comparison metrics
            if metrics and len(metrics) >= 2:
                self.visualizer.plot_metric_comparison(list(metrics.keys()))
    
    def complete_job(self, message: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None) -> None:
        """
        Mark the current job as complete
        
        Args:
            message: Optional completion message
            metadata: Optional metadata about the completed job
        """
        # Complete job in base reporter
        if self.reporter:
            all_metadata = metadata or {}
            
            # Add latest metrics to metadata
            latest_metrics = self.metrics_tracker.get_latest_metrics()
            if latest_metrics:
                all_metadata["final_metrics"] = latest_metrics
            
            self.reporter.complete_job(message, all_metadata)
        
        # Generate final visualizations
        if self.visualize and self.visualizer:
            # Generate HTML report
            report_path = self.visualizer.generate_html_report()
            
            if report_path:
                logger.info(f"Training visualization report saved to: {report_path}")
    
    def report_error(self, error: Union[str, Exception], metadata: Optional[Dict[str, Any]] = None) -> None:
        """
        Report an error for the current job
        
        Args:
            error: Error message or exception
            metadata: Optional metadata about the error
        """
        # Report error in base reporter
        if self.reporter:
            self.reporter.report_error(error, metadata)


class TrainingVisualizationDashboard:
    """
    Dashboard for visualizing training progress in real-time
    
    This class provides a web dashboard for real-time visualization
    of training progress, metrics, and learning curves.
    """
    
    def __init__(self, job_id: str, metrics_dir: str, port: int = 8050):
        """
        Initialize the dashboard
        
        Args:
            job_id: Job ID to visualize
            metrics_dir: Directory with metrics data
            port: Port to run the dashboard on
        """
        self.job_id = job_id
        self.metrics_dir = metrics_dir
        self.port = port
        
        # Check for Dash
        try:
            import dash
            from dash import dcc, html
            import plotly.express as px
            import plotly.graph_objs as go
            
            self.dash_available = True
            self.dash = dash
            self.dcc = dcc
            self.html = html
            self.px = px
            self.go = go
        except ImportError:
            logger.warning("Dash not available. Install with: pip install dash plotly")
            self.dash_available = False
    
    def start(self) -> None:
        """Start the dashboard server"""
        if not self.dash_available:
            logger.error("Dash not available. Cannot start dashboard.")
            return
        
        # Load metrics
        metrics_tracker = MetricsTracker(self.job_id, metrics_dir=self.metrics_dir)
        if not metrics_tracker.load_metrics():
            logger.error(f"No metrics found for job {self.job_id} in {self.metrics_dir}")
            return
        
        # Create app
        app = self.dash.Dash(__name__)
        
        # Define layout
        app.layout = self.html.Div([
            self.html.H1(f"Training Progress Dashboard - Job {self.job_id}"),
            
            self.html.Div([
                self.html.H2("Learning Curves"),
                self.dcc.Graph(id='learning-curves'),
                self.dcc.Interval(
                    id='interval-component',
                    interval=5*1000,  # in milliseconds (5s)
                    n_intervals=0
                )
            ]),
            
            self.html.Div([
                self.html.H2("Latest Metrics"),
                self.html.Div(id='latest-metrics')
            ])
        ])
        
        # Define callbacks
        @app.callback(
            [self.dash.Output('learning-curves', 'figure'),
             self.dash.Output('latest-metrics', 'children')],
            [self.dash.Input('interval-component', 'n_intervals')]
        )
        def update_dashboard(n):
            # Reload metrics
            metrics_tracker.load_metrics()
            
            # Create learning curves figure
            fig = self.go.Figure()
            
            for metric_name in metrics_tracker.metrics:
                metrics_by_epoch = metrics_tracker.get_metric_by_epoch(metric_name)
                
                if metrics_by_epoch:
                    epochs = sorted(metrics_by_epoch.keys())
                    mean_values = [np.mean(metrics_by_epoch[e]) for e in epochs]
                    
                    fig.add_trace(self.go.Scatter(
                        x=epochs,
                        y=mean_values,
                        mode='lines+markers',
                        name=metric_name
                    ))
            
            fig.update_layout(
                title='Learning Curves',
                xaxis_title='Epoch',
                yaxis_title='Value',
                legend_title='Metric'
            )
            
            # Create latest metrics table
            latest_metrics = metrics_tracker.get_latest_metrics()
            metrics_table = self.html.Table([
                self.html.Thead(
                    self.html.Tr([
                        self.html.Th('Metric'),
                        self.html.Th('Value')
                    ])
                ),
                self.html.Tbody([
                    self.html.Tr([
                        self.html.Td(name),
                        self.html.Td(f"{value:.6f}")
                    ]) for name, value in latest_metrics.items()
                ])
            ], style={'width': '100%', 'border-collapse': 'collapse'})
            
            return fig, metrics_table
        
        # Run server
        app.run_server(debug=True, port=self.port)


def enhance_progress_reporting(job_id: Optional[str] = None, 
                              output_dir: str = "./training_viz") -> EnhancedProgressReporter:
    """
    Create an enhanced progress reporter
    
    Args:
        job_id: Job ID (generated if None)
        output_dir: Output directory for visualizations
        
    Returns:
        Enhanced progress reporter
    """
    return EnhancedProgressReporter(
        visualize=True,
        output_dir=output_dir,
        job_id=job_id
    )


def visualize_training_history(history: Dict[str, List[float]], 
                              output_path: Optional[str] = None) -> Optional[str]:
    """
    Visualize training history from a dictionary
    
    This is a standalone function for visualizing training history
    from frameworks like TensorFlow or PyTorch.
    
    Args:
        history: Dictionary mapping metric names to lists of values
        output_path: Path to save visualization
        
    Returns:
        Path to the saved visualization or None if plotting is not available
    """
    if not PLOTTING_AVAILABLE:
        return None
    
    # Generate job ID and setup
    job_id = str(uuid.uuid4())
    output_dir = os.path.dirname(output_path) if output_path else "./training_viz"
    os.makedirs(output_dir, exist_ok=True)
    
    # Create metrics tracker
    metrics_tracker = MetricsTracker(job_id, metrics_dir=output_dir)
    
    # Add metrics
    for name, values in history.items():
        for epoch, value in enumerate(values):
            metrics_tracker.add_metric(name, value, epoch=epoch)
    
    # Create visualizer
    visualizer = ProgressVisualizer(metrics_tracker, output_dir)
    
    # Generate visualization
    return visualizer.plot_learning_curves(save_path=output_path)


if __name__ == "__main__":
    # Example of how to use the progress visualization module
    import argparse
    import random
    
    parser = argparse.ArgumentParser(description="Training Progress Visualization Demo")
    parser.add_argument("--mode", choices=["generate", "dashboard"], default="generate",
                      help="Mode: generate visualizations or run dashboard")
    parser.add_argument("--job-id", default=None,
                      help="Job ID (generated if None)")
    parser.add_argument("--output-dir", default="./training_viz",
                      help="Output directory")
    parser.add_argument("--port", type=int, default=8050,
                      help="Port for dashboard (dashboard mode only)")
    
    args = parser.parse_args()
    
    if args.mode == "generate":
        # Generate sample training history
        job_id = args.job_id or str(uuid.uuid4())
        
        # Create metrics tracker
        metrics_tracker = MetricsTracker(job_id, metrics_dir=args.output_dir)
        
        # Generate some fake metrics for demonstration
        num_epochs = 10
        
        for epoch in range(num_epochs):
            # Simulate training
            train_loss = 1.0 - 0.05 * epoch + random.uniform(-0.05, 0.05)
            train_accuracy = 0.5 + 0.04 * epoch + random.uniform(-0.03, 0.03)
            
            # Simulate validation
            val_loss = train_loss + random.uniform(0, 0.1)
            val_accuracy = train_accuracy - random.uniform(0, 0.05)
            
            # Add metrics for each batch to simulate multiple values per epoch
            num_batches = 10
            for batch in range(num_batches):
                batch_train_loss = train_loss + random.uniform(-0.03, 0.03)
                batch_train_accuracy = train_accuracy + random.uniform(-0.02, 0.02)
                
                metrics_tracker.add_metric("loss", batch_train_loss, epoch=epoch)
                metrics_tracker.add_metric("accuracy", batch_train_accuracy, epoch=epoch)
            
            # Add validation metrics (one per epoch)
            metrics_tracker.add_metric("val_loss", val_loss, epoch=epoch)
            metrics_tracker.add_metric("val_accuracy", val_accuracy, epoch=epoch)
        
        # Create visualizer
        visualizer = ProgressVisualizer(metrics_tracker, args.output_dir)
        
        # Generate visualizations
        learning_curves_path = visualizer.plot_learning_curves()
        comparison_path = visualizer.plot_metric_comparison(["loss", "val_loss"])
        report_path = visualizer.generate_html_report()
        
        print(f"Generated visualizations in {args.output_dir}")
        print(f"Learning curves: {learning_curves_path}")
        print(f"Metric comparison: {comparison_path}")
        print(f"HTML report: {report_path}")
        
    elif args.mode == "dashboard":
        # Run dashboard for existing metrics
        job_id = args.job_id
        
        if not job_id:
            print("Error: --job-id is required for dashboard mode")
            sys.exit(1)
        
        # Create and start dashboard
        dashboard = TrainingVisualizationDashboard(job_id, args.output_dir, args.port)
        dashboard.start()