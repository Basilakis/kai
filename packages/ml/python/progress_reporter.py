#!/usr/bin/env python3
"""
Progress Reporter for ML Training Scripts

Provides functionality to report training progress to the server.
Can be used by any ML script that needs to report progress.
"""

import json
import time
import uuid
import requests
from typing import Dict, Any, Optional, Union, List
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('progress_reporter')

class ProgressReporter:
    """
    Reports training progress to the server.
    
    Provides methods to start a training job, update progress,
    complete a job, and report errors.
    """
    
    def __init__(self, base_url: str = "http://localhost:3000", api_key: Optional[str] = None):
        """
        Initialize the progress reporter.
        
        Args:
            base_url: Base URL of the server API
            api_key: Optional API key for authentication
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.job_id = None
        self.headers = {
            'Content-Type': 'application/json'
        }
        if api_key:
            self.headers['Authorization'] = f'Bearer {api_key}'
    
    def start_job(self, model_type: str, job_id: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Start a new training job and report initial progress.
        
        Args:
            model_type: Type of model being trained (e.g., 'feature-based', 'neural-network', 'hybrid')
            job_id: Optional job ID (generated if not provided)
            metadata: Optional metadata about the job
            
        Returns:
            The job ID
        """
        self.job_id = job_id or str(uuid.uuid4())
        
        data = {
            'jobId': self.job_id,
            'type': 'start',
            'timestamp': int(time.time() * 1000),
            'data': {
                'modelType': model_type,
                'message': f'Started training {model_type} model'
            }
        }
        
        if metadata:
            data['data'].update(metadata)
        
        self._send_progress(data)
        logger.info(f"Started job {self.job_id} for {model_type} model")
        return self.job_id
    
    def update_progress(self, progress: float, current_epoch: Optional[int] = None, 
                         total_epochs: Optional[int] = None, loss: Optional[float] = None,
                         accuracy: Optional[float] = None, eta: Optional[int] = None,
                         message: Optional[str] = None, custom_data: Optional[Dict[str, Any]] = None) -> None:
        """
        Update progress for the current job.
        
        Args:
            progress: Progress as a float between 0 and 1
            current_epoch: Current epoch number (for neural networks)
            total_epochs: Total number of epochs (for neural networks)
            loss: Current loss value
            accuracy: Current accuracy value
            eta: Estimated time remaining in seconds
            message: Optional message about the progress
            custom_data: Any additional custom data to include
        """
        if not self.job_id:
            raise ValueError("No active job. Call start_job() first.")
        
        data = {
            'jobId': self.job_id,
            'type': 'progress',
            'timestamp': int(time.time() * 1000),
            'data': {
                'progress': progress
            }
        }
        
        # Add optional fields if provided
        if current_epoch is not None:
            data['data']['currentEpoch'] = current_epoch
        if total_epochs is not None:
            data['data']['totalEpochs'] = total_epochs
        if loss is not None:
            data['data']['loss'] = loss
        if accuracy is not None:
            data['data']['accuracy'] = accuracy
        if eta is not None:
            data['data']['eta'] = eta
        if message:
            data['data']['message'] = message
        if custom_data:
            data['data'].update(custom_data)
        
        self._send_progress(data)
        
        # Log progress
        progress_str = f"{progress:.1%}"
        epoch_str = ""
        if current_epoch is not None and total_epochs is not None:
            epoch_str = f" (Epoch {current_epoch}/{total_epochs})"
        metrics_str = ""
        if loss is not None or accuracy is not None:
            metrics = []
            if loss is not None:
                metrics.append(f"loss={loss:.4f}")
            if accuracy is not None:
                metrics.append(f"acc={accuracy:.4f}")
            metrics_str = f" - {', '.join(metrics)}"
        
        logger.info(f"Progress: {progress_str}{epoch_str}{metrics_str}")
    
    def complete_job(self, message: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None) -> None:
        """
        Mark the current job as complete.
        
        Args:
            message: Optional completion message
            metadata: Optional metadata about the completed job
        """
        if not self.job_id:
            raise ValueError("No active job. Call start_job() first.")
        
        data = {
            'jobId': self.job_id,
            'type': 'complete',
            'timestamp': int(time.time() * 1000),
            'data': {
                'message': message or f'Job {self.job_id} completed successfully'
            }
        }
        
        if metadata:
            data['data'].update(metadata)
        
        self._send_progress(data)
        logger.info(f"Completed job {self.job_id}")
        self.job_id = None
    
    def report_error(self, error: Union[str, Exception], metadata: Optional[Dict[str, Any]] = None) -> None:
        """
        Report an error for the current job.
        
        Args:
            error: Error message or exception
            metadata: Optional metadata about the error
        """
        if not self.job_id:
            raise ValueError("No active job. Call start_job() first.")
        
        error_message = str(error)
        
        data = {
            'jobId': self.job_id,
            'type': 'error',
            'timestamp': int(time.time() * 1000),
            'data': {
                'error': error_message,
                'message': f'Job {self.job_id} failed: {error_message}'
            }
        }
        
        if metadata:
            data['data'].update(metadata)
        
        self._send_progress(data)
        logger.error(f"Job {self.job_id} failed: {error_message}")
        self.job_id = None
    
    def _send_progress(self, data: Dict[str, Any]) -> None:
        """
        Send progress data to the server.
        
        Args:
            data: Progress data to send
        """
        url = f"{self.base_url}/api/admin/training/progress"
        
        try:
            response = requests.post(url, json=data, headers=self.headers)
            
            if response.status_code != 200:
                logger.warning(f"Failed to send progress: {response.status_code} - {response.text}")
            
        except Exception as e:
            logger.warning(f"Error sending progress: {e}")
            # Failing to report progress shouldn't crash the training process
            pass


class FileProgressReporter(ProgressReporter):
    """
    A version of ProgressReporter that writes to a local file instead of making HTTP requests.
    Useful for development or when the server is not available.
    """
    
    def __init__(self, output_dir: str = "./training_progress"):
        """
        Initialize the file progress reporter.
        
        Args:
            output_dir: Directory to write progress files to
        """
        import os
        self.output_dir = output_dir
        self.job_id = None
        
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
    
    def _send_progress(self, data: Dict[str, Any]) -> None:
        """
        Write progress data to a file.
        
        Args:
            data: Progress data to write
        """
        import os
        
        job_id = data['jobId']
        file_path = os.path.join(self.output_dir, f"{job_id}.json")
        
        try:
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.warning(f"Error writing progress to file: {e}")
            # Failing to report progress shouldn't crash the training process
            pass


# Create a progress reporter class that can use either HTTP or file-based reporting
class HybridProgressReporter:
    """
    A progress reporter that tries HTTP first, then falls back to file-based reporting.
    """
    
    def __init__(self, base_url: str = "http://localhost:3000", 
                 api_key: Optional[str] = None, 
                 output_dir: str = "./training_progress",
                 fallback_to_file: bool = True):
        """
        Initialize the hybrid progress reporter.
        
        Args:
            base_url: Base URL of the server API
            api_key: Optional API key for authentication
            output_dir: Directory to write progress files to (for file fallback)
            fallback_to_file: Whether to fall back to file-based reporting if HTTP fails
        """
        self.http_reporter = ProgressReporter(base_url, api_key)
        self.file_reporter = FileProgressReporter(output_dir)
        self.fallback_to_file = fallback_to_file
        self.job_id = None
        self.using_fallback = False
    
    def start_job(self, model_type: str, job_id: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Start a new training job and report initial progress.
        
        Args:
            model_type: Type of model being trained (e.g., 'feature-based', 'neural-network', 'hybrid')
            job_id: Optional job ID (generated if not provided)
            metadata: Optional metadata about the job
            
        Returns:
            The job ID
        """
        self.job_id = job_id or str(uuid.uuid4())
        
        try:
            # Try HTTP first
            self.http_reporter.start_job(model_type, self.job_id, metadata)
            self.using_fallback = False
        except Exception as e:
            logger.warning(f"HTTP progress reporting failed, {('falling back to file' if self.fallback_to_file else 'disabled')}: {e}")
            if self.fallback_to_file:
                self.file_reporter.start_job(model_type, self.job_id, metadata)
                self.using_fallback = True
        
        return self.job_id
    
    def update_progress(self, progress: float, current_epoch: Optional[int] = None, 
                        total_epochs: Optional[int] = None, loss: Optional[float] = None,
                        accuracy: Optional[float] = None, eta: Optional[int] = None,
                        message: Optional[str] = None, custom_data: Optional[Dict[str, Any]] = None) -> None:
        """
        Update progress for the current job.
        
        Args:
            progress: Progress as a float between 0 and 1
            current_epoch: Current epoch number (for neural networks)
            total_epochs: Total number of epochs (for neural networks)
            loss: Current loss value
            accuracy: Current accuracy value
            eta: Estimated time remaining in seconds
            message: Optional message about the progress
            custom_data: Any additional custom data to include
        """
        if not self.job_id:
            raise ValueError("No active job. Call start_job() first.")
        
        if not self.using_fallback:
            try:
                self.http_reporter.update_progress(
                    progress, current_epoch, total_epochs, loss, 
                    accuracy, eta, message, custom_data
                )
                return
            except Exception as e:
                logger.warning(f"HTTP progress reporting failed, {('falling back to file' if self.fallback_to_file else 'disabled')}: {e}")
                if self.fallback_to_file:
                    self.using_fallback = True
        
        if self.fallback_to_file:
            self.file_reporter.update_progress(
                progress, current_epoch, total_epochs, loss, 
                accuracy, eta, message, custom_data
            )
    
    def complete_job(self, message: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None) -> None:
        """
        Mark the current job as complete.
        
        Args:
            message: Optional completion message
            metadata: Optional metadata about the completed job
        """
        if not self.job_id:
            raise ValueError("No active job. Call start_job() first.")
        
        if not self.using_fallback:
            try:
                self.http_reporter.complete_job(message, metadata)
                self.job_id = None
                return
            except Exception as e:
                logger.warning(f"HTTP progress reporting failed, {('falling back to file' if self.fallback_to_file else 'disabled')}: {e}")
                if self.fallback_to_file:
                    self.using_fallback = True
        
        if self.fallback_to_file:
            self.file_reporter.complete_job(message, metadata)
        
        self.job_id = None
    
    def report_error(self, error: Union[str, Exception], metadata: Optional[Dict[str, Any]] = None) -> None:
        """
        Report an error for the current job.
        
        Args:
            error: Error message or exception
            metadata: Optional metadata about the error
        """
        if not self.job_id:
            raise ValueError("No active job. Call start_job() first.")
        
        if not self.using_fallback:
            try:
                self.http_reporter.report_error(error, metadata)
                self.job_id = None
                return
            except Exception as e:
                logger.warning(f"HTTP progress reporting failed, {('falling back to file' if self.fallback_to_file else 'disabled')}: {e}")
                if self.fallback_to_file:
                    self.using_fallback = True
        
        if self.fallback_to_file:
            self.file_reporter.report_error(error, metadata)
        
        self.job_id = None


# Create a default progress reporter for easy import
progress_reporter = HybridProgressReporter()

# Example usage
if __name__ == "__main__":
    # Example of how to use the progress reporter
    reporter = progress_reporter
    
    try:
        # Start a job
        job_id = reporter.start_job("test-model", metadata={"dataset_size": 1000})
        
        # Simulate training progress
        total_epochs = 10
        for epoch in range(total_epochs):
            time.sleep(0.5)  # Simulate training time
            
            # Update progress
            reporter.update_progress(
                progress=(epoch + 1) / total_epochs,
                current_epoch=epoch + 1,
                total_epochs=total_epochs,
                loss=1.0 - (epoch / total_epochs) * 0.8,
                accuracy=0.5 + (epoch / total_epochs) * 0.4,
                eta=(total_epochs - epoch - 1) * 2,
                message=f"Training epoch {epoch + 1}/{total_epochs}"
            )
        
        # Complete the job
        reporter.complete_job(
            message="Training completed successfully",
            metadata={"final_accuracy": 0.92, "final_loss": 0.2}
        )
        
    except Exception as e:
        # Report an error
        reporter.report_error(e)