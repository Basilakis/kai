#!/usr/bin/env python3
"""
Supabase-based Distributed Training System

This module provides a distributed training system that uses Supabase
instead of Redis for job queue management, parameter synchronization,
and worker coordination. It enables scaling training workloads across
multiple machines while maintaining a centralized state.

Features:
1. Job queue management through Supabase tables
2. Parameter server for gradient aggregation and model state synchronization
3. Worker coordination with fault tolerance
4. Real-time progress monitoring

Usage:
    Import this module to distribute training workloads across multiple workers
"""

import os
import sys
import json
import time
import uuid
import threading
import socket
import hashlib
import datetime
import base64
import logging
from typing import Dict, List, Any, Tuple, Optional, Union, Callable
from enum import Enum
from dataclasses import dataclass, asdict
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('distributed_training')

# Try to import supabase
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logger.warning("Supabase client not available. Install with: pip install supabase")

# Try to import tensor libraries for serialization/deserialization
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    import tensorflow as tf
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False

# Enums
class JobStatus(str, Enum):
    """Status enum for training jobs"""
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class WorkerStatus(str, Enum):
    """Status enum for worker nodes"""
    IDLE = "idle"
    BUSY = "busy"
    OFFLINE = "offline"


# Data classes
@dataclass
class DistributedJob:
    """Data class representing a distributed training job"""
    job_id: str
    job_type: str
    priority: int = 1
    status: str = JobStatus.PENDING
    parameters: Dict[str, Any] = None
    results: Dict[str, Any] = None
    worker_id: Optional[str] = None
    created_at: str = None
    updated_at: str = None
    error: Optional[str] = None
    batch_indices: Optional[List[int]] = None
    task_id: Optional[str] = None
    
    def __post_init__(self):
        """Initialize default values"""
        if self.parameters is None:
            self.parameters = {}
        if self.results is None:
            self.results = {}
        if self.created_at is None:
            self.created_at = datetime.datetime.now().isoformat()
        if self.updated_at is None:
            self.updated_at = self.created_at
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Supabase storage"""
        return asdict(self)


@dataclass
class WorkerInfo:
    """Data class representing a worker node"""
    worker_id: str
    hostname: str
    ip_address: str
    status: str = WorkerStatus.IDLE
    capabilities: Dict[str, Any] = None
    current_job_id: Optional[str] = None
    last_heartbeat: str = None
    registered_at: str = None
    
    def __post_init__(self):
        """Initialize default values"""
        if self.capabilities is None:
            self.capabilities = {}
        if self.last_heartbeat is None:
            self.last_heartbeat = datetime.datetime.now().isoformat()
        if self.registered_at is None:
            self.registered_at = self.last_heartbeat
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Supabase storage"""
        return asdict(self)


@dataclass
class ModelGradient:
    """Data class representing model gradients"""
    gradient_id: str
    job_id: str
    worker_id: str
    layer_name: str
    iteration: int
    batch_size: int
    data: Any  # Serialized gradient data
    created_at: str = None
    
    def __post_init__(self):
        """Initialize default values"""
        if self.created_at is None:
            self.created_at = datetime.datetime.now().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Supabase storage"""
        result = asdict(self)
        # Convert numpy arrays or tensors to base64 strings for storage
        if isinstance(self.data, np.ndarray):
            result['data'] = base64.b64encode(self.data.tobytes()).decode('utf-8')
            result['data_shape'] = self.data.shape
            result['data_dtype'] = str(self.data.dtype)
            result['data_type'] = 'numpy'
        elif TORCH_AVAILABLE and isinstance(self.data, torch.Tensor):
            result['data'] = base64.b64encode(self.data.cpu().numpy().tobytes()).decode('utf-8')
            result['data_shape'] = list(self.data.shape)
            result['data_dtype'] = str(self.data.dtype)
            result['data_type'] = 'torch'
        elif TF_AVAILABLE and isinstance(self.data, tf.Tensor):
            numpy_data = self.data.numpy()
            result['data'] = base64.b64encode(numpy_data.tobytes()).decode('utf-8')
            result['data_shape'] = numpy_data.shape
            result['data_dtype'] = str(numpy_data.dtype)
            result['data_type'] = 'tensorflow'
        
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ModelGradient':
        """Create from dictionary retrieved from Supabase"""
        gradient_dict = data.copy()
        
        # Handle serialized data
        if 'data_type' in gradient_dict and 'data' in gradient_dict:
            data_type = gradient_dict.pop('data_type')
            shape = gradient_dict.pop('data_shape')
            dtype = gradient_dict.pop('data_dtype')
            
            # Decode base64 string to bytes
            raw_bytes = base64.b64decode(gradient_dict['data'])
            
            if data_type == 'numpy':
                # Recreate numpy array from bytes
                gradient_dict['data'] = np.frombuffer(raw_bytes, dtype=np.dtype(dtype)).reshape(shape)
            elif data_type == 'torch' and TORCH_AVAILABLE:
                # Recreate torch tensor from bytes
                numpy_array = np.frombuffer(raw_bytes, dtype=np.dtype(dtype)).reshape(shape)
                gradient_dict['data'] = torch.from_numpy(numpy_array)
            elif data_type == 'tensorflow' and TF_AVAILABLE:
                # Recreate tensorflow tensor from bytes
                numpy_array = np.frombuffer(raw_bytes, dtype=np.dtype(dtype)).reshape(shape)
                gradient_dict['data'] = tf.convert_to_tensor(numpy_array)
        
        return cls(**gradient_dict)


@dataclass
class TrainingTask:
    """Data class representing a high-level training task"""
    task_id: str
    task_type: str
    dataset_id: str
    model_type: str
    hyperparameters: Dict[str, Any]
    status: str = "pending"
    created_at: str = None
    updated_at: str = None
    jobs: List[str] = None
    progress: float = 0.0
    results: Dict[str, Any] = None
    
    def __post_init__(self):
        """Initialize default values"""
        if self.created_at is None:
            self.created_at = datetime.datetime.now().isoformat()
        if self.updated_at is None:
            self.updated_at = self.created_at
        if self.jobs is None:
            self.jobs = []
        if self.results is None:
            self.results = {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Supabase storage"""
        return asdict(self)


class SupabaseQueue:
    """
    Supabase-based job queue system for distributed training
    
    This class manages job submission, allocation, and tracking through Supabase.
    """
    
    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        jobs_table: str = "distributed_jobs",
        workers_table: str = "worker_nodes",
        gradients_table: str = "model_gradients",
        tasks_table: str = "training_tasks",
        heartbeat_interval: int = 30
    ):
        """
        Initialize the Supabase queue
        
        Args:
            supabase_url: Supabase URL (defaults to SUPABASE_URL env var)
            supabase_key: Supabase API key (defaults to SUPABASE_KEY env var)
            jobs_table: Name of the jobs table
            workers_table: Name of the workers table
            gradients_table: Name of the gradients table
            tasks_table: Name of the tasks table
            heartbeat_interval: Heartbeat interval in seconds
        """
        if not SUPABASE_AVAILABLE:
            raise ImportError("Supabase client not available. Install with: pip install supabase")
        
        # Connect to Supabase
        self.supabase_url = supabase_url or os.getenv('SUPABASE_URL')
        self.supabase_key = supabase_key or os.getenv('SUPABASE_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError(
                "Supabase URL and key must be provided either as arguments or as environment variables"
            )
        
        # Create the Supabase client
        self.supabase = create_client(self.supabase_url, self.supabase_key)
        
        # Set table names
        self.jobs_table = jobs_table
        self.workers_table = workers_table
        self.gradients_table = gradients_table
        self.tasks_table = tasks_table
        
        # Set heartbeat interval
        self.heartbeat_interval = heartbeat_interval
        
        # Track current worker
        self.worker_id = None
        self.worker_info = None
        self.heartbeat_thread = None
        self.running = False
        
        logger.info("Supabase queue initialized")
    
    def _generate_id(self, prefix: str = "") -> str:
        """Generate a unique ID with an optional prefix"""
        return f"{prefix}{str(uuid.uuid4())}"
    
    def submit_job(self, job_type: str, parameters: Dict[str, Any], priority: int = 1, 
                  task_id: Optional[str] = None) -> str:
        """
        Submit a job to the queue
        
        Args:
            job_type: Type of job
            parameters: Job parameters
            priority: Job priority (higher number = higher priority)
            task_id: Associated task ID if part of a larger task
            
        Returns:
            Job ID
        """
        # Create job
        job_id = self._generate_id("job_")
        job = DistributedJob(
            job_id=job_id,
            job_type=job_type,
            priority=priority,
            parameters=parameters,
            task_id=task_id
        )
        
        # Insert into Supabase
        self.supabase.table(self.jobs_table).insert(job.to_dict()).execute()
        
        logger.info(f"Submitted job {job_id} of type {job_type}")
        return job_id
    
    def submit_batch_jobs(self, job_type: str, common_parameters: Dict[str, Any], 
                         batch_parameters: List[Dict[str, Any]], priority: int = 1,
                         task_id: Optional[str] = None) -> List[str]:
        """
        Submit multiple related jobs as a batch
        
        Args:
            job_type: Type of job
            common_parameters: Common parameters for all jobs
            batch_parameters: List of batch-specific parameters
            priority: Job priority
            task_id: Associated task ID
            
        Returns:
            List of job IDs
        """
        # Create jobs
        jobs = []
        job_ids = []
        
        for i, batch_params in enumerate(batch_parameters):
            job_id = self._generate_id(f"job_batch_{i}_")
            # Combine common and batch parameters
            params = {**common_parameters, **batch_params, "batch_index": i}
            
            job = DistributedJob(
                job_id=job_id,
                job_type=job_type,
                priority=priority,
                parameters=params,
                task_id=task_id,
                batch_indices=[i]
            )
            
            jobs.append(job.to_dict())
            job_ids.append(job_id)
        
        # Insert all jobs into Supabase
        self.supabase.table(self.jobs_table).insert(jobs).execute()
        
        logger.info(f"Submitted {len(jobs)} batch jobs of type {job_type}")
        return job_ids
    
    def create_task(self, task_type: str, dataset_id: str, model_type: str, 
                   hyperparameters: Dict[str, Any]) -> str:
        """
        Create a high-level training task
        
        Args:
            task_type: Type of task
            dataset_id: Dataset ID
            model_type: Model type
            hyperparameters: Hyperparameters
            
        Returns:
            Task ID
        """
        # Create task
        task_id = self._generate_id("task_")
        task = TrainingTask(
            task_id=task_id,
            task_type=task_type,
            dataset_id=dataset_id,
            model_type=model_type,
            hyperparameters=hyperparameters
        )
        
        # Insert into Supabase
        self.supabase.table(self.tasks_table).insert(task.to_dict()).execute()
        
        logger.info(f"Created task {task_id} of type {task_type}")
        return task_id
    
    def register_worker(self, capabilities: Optional[Dict[str, Any]] = None) -> str:
        """
        Register this process as a worker
        
        Args:
            capabilities: Worker capabilities (GPU, memory, etc.)
            
        Returns:
            Worker ID
        """
        # Generate worker info
        worker_id = self._generate_id("worker_")
        hostname = socket.gethostname()
        ip_address = socket.gethostbyname(hostname)
        
        # Default capabilities if not provided
        if capabilities is None:
            capabilities = {
                "cpu_count": os.cpu_count(),
                "gpu_available": TORCH_AVAILABLE and torch.cuda.is_available() if TORCH_AVAILABLE else False,
                "memory_gb": round(os.sysconf('SC_PAGE_SIZE') * os.sysconf('SC_PHYS_PAGES') / (1024.**3), 1)
            }
        
        # Create worker info
        self.worker_info = WorkerInfo(
            worker_id=worker_id,
            hostname=hostname,
            ip_address=ip_address,
            capabilities=capabilities
        )
        
        # Insert into Supabase
        self.supabase.table(self.workers_table).insert(self.worker_info.to_dict()).execute()
        
        # Store worker ID
        self.worker_id = worker_id
        
        # Start heartbeat thread
        self.running = True
        self.heartbeat_thread = threading.Thread(target=self._heartbeat_loop)
        self.heartbeat_thread.daemon = True
        self.heartbeat_thread.start()
        
        logger.info(f"Registered worker {worker_id} ({hostname})")
        return worker_id
    
    def _heartbeat_loop(self) -> None:
        """Background thread for sending worker heartbeats"""
        while self.running and self.worker_id:
            try:
                # Update last heartbeat
                self.supabase.table(self.workers_table) \
                    .update({"last_heartbeat": datetime.datetime.now().isoformat()}) \
                    .eq("worker_id", self.worker_id) \
                    .execute()
                
                # Sleep until next heartbeat
                time.sleep(self.heartbeat_interval)
            except Exception as e:
                logger.error(f"Error sending heartbeat: {e}")
                time.sleep(5)  # Shorter sleep on error
    
    def get_next_job(self) -> Optional[DistributedJob]:
        """
        Get the next available job for this worker
        
        Returns:
            Job object or None if no jobs available
        """
        if not self.worker_id:
            raise ValueError("Worker not registered. Call register_worker() first.")
        
        try:
            # Get the highest priority pending job
            result = self.supabase.table(self.jobs_table) \
                .select("*") \
                .eq("status", JobStatus.PENDING) \
                .order("priority", desc=True) \
                .order("created_at", asc=True) \
                .limit(1) \
                .execute()
            
            if not result.data:
                return None
            
            job_data = result.data[0]
            job_id = job_data["job_id"]
            
            # Try to claim the job with optimistic concurrency control
            update_result = self.supabase.table(self.jobs_table) \
                .update({
                    "status": JobStatus.ASSIGNED,
                    "worker_id": self.worker_id,
                    "updated_at": datetime.datetime.now().isoformat()
                }) \
                .eq("job_id", job_id) \
                .eq("status", JobStatus.PENDING) \
                .execute()
            
            if not update_result.data:
                # Job was claimed by another worker
                return None
            
            # Update worker status
            self.supabase.table(self.workers_table) \
                .update({
                    "status": WorkerStatus.BUSY,
                    "current_job_id": job_id
                }) \
                .eq("worker_id", self.worker_id) \
                .execute()
            
            # Convert to job object
            return DistributedJob(**update_result.data[0])
        
        except Exception as e:
            logger.error(f"Error getting next job: {e}")
            return None
    
    def update_job_status(self, job_id: str, status: str, 
                         results: Optional[Dict[str, Any]] = None,
                         error: Optional[str] = None) -> bool:
        """
        Update job status
        
        Args:
            job_id: Job ID
            status: New status
            results: Optional job results
            error: Optional error message
            
        Returns:
            Success flag
        """
        if not self.worker_id:
            raise ValueError("Worker not registered. Call register_worker() first.")
        
        try:
            update_data = {
                "status": status,
                "updated_at": datetime.datetime.now().isoformat()
            }
            
            if results is not None:
                update_data["results"] = results
            
            if error is not None:
                update_data["error"] = error
            
            # Update job
            self.supabase.table(self.jobs_table) \
                .update(update_data) \
                .eq("job_id", job_id) \
                .eq("worker_id", self.worker_id) \
                .execute()
            
            # If job is completed or failed, update worker status
            if status in [JobStatus.COMPLETED, JobStatus.FAILED]:
                self.supabase.table(self.workers_table) \
                    .update({
                        "status": WorkerStatus.IDLE,
                        "current_job_id": None
                    }) \
                    .eq("worker_id", self.worker_id) \
                    .execute()
            
            return True
        
        except Exception as e:
            logger.error(f"Error updating job status: {e}")
            return False
    
    def submit_gradient(self, job_id: str, layer_name: str, iteration: int, 
                       batch_size: int, gradient_data: Any) -> str:
        """
        Submit model gradient for parameter server
        
        Args:
            job_id: Associated job ID
            layer_name: Name of the model layer
            iteration: Training iteration
            batch_size: Batch size used for this gradient
            gradient_data: Gradient data (numpy array, torch tensor, etc.)
            
        Returns:
            Gradient ID
        """
        if not self.worker_id:
            raise ValueError("Worker not registered. Call register_worker() first.")
        
        # Create gradient object
        gradient_id = self._generate_id("grad_")
        gradient = ModelGradient(
            gradient_id=gradient_id,
            job_id=job_id,
            worker_id=self.worker_id,
            layer_name=layer_name,
            iteration=iteration,
            batch_size=batch_size,
            data=gradient_data
        )
        
        # Insert into Supabase
        gradient_dict = gradient.to_dict()
        self.supabase.table(self.gradients_table).insert(gradient_dict).execute()
        
        return gradient_id
    
    def get_aggregated_gradients(self, job_id: str, iteration: int) -> Dict[str, Any]:
        """
        Get aggregated gradients for parameter server
        
        Args:
            job_id: Job ID
            iteration: Training iteration
            
        Returns:
            Dictionary of layer name to aggregated gradient data
        """
        try:
            # Get all gradients for this job and iteration
            result = self.supabase.table(self.gradients_table) \
                .select("*") \
                .eq("job_id", job_id) \
                .eq("iteration", iteration) \
                .execute()
            
            if not result.data:
                return {}
            
            # Group gradients by layer name
            gradients_by_layer = {}
            for grad_data in result.data:
                gradient = ModelGradient.from_dict(grad_data)
                if gradient.layer_name not in gradients_by_layer:
                    gradients_by_layer[gradient.layer_name] = []
                gradients_by_layer[gradient.layer_name].append(gradient)
            
            # Aggregate gradients for each layer
            aggregated = {}
            for layer_name, gradients in gradients_by_layer.items():
                # Weight gradients by batch size
                total_batch_size = sum(g.batch_size for g in gradients)
                
                # Handle different types of gradient data
                if isinstance(gradients[0].data, np.ndarray):
                    # Weighted average of numpy arrays
                    aggregated[layer_name] = sum(
                        g.data * (g.batch_size / total_batch_size) for g in gradients
                    )
                elif TORCH_AVAILABLE and isinstance(gradients[0].data, torch.Tensor):
                    # Weighted average of torch tensors
                    aggregated[layer_name] = sum(
                        g.data * (g.batch_size / total_batch_size) for g in gradients
                    )
                elif TF_AVAILABLE and isinstance(gradients[0].data, tf.Tensor):
                    # Weighted average of tensorflow tensors
                    aggregated[layer_name] = sum(
                        g.data * (g.batch_size / total_batch_size) for g in gradients
                    )
            
            return aggregated
        
        except Exception as e:
            logger.error(f"Error getting aggregated gradients: {e}")
            return {}
    
    def update_task_progress(self, task_id: str, progress: float, 
                           results: Optional[Dict[str, Any]] = None) -> bool:
        """
        Update task progress
        
        Args:
            task_id: Task ID
            progress: Progress as float between 0 and 1
            results: Optional task results
            
        Returns:
            Success flag
        """
        try:
            update_data = {
                "progress": min(1.0, max(0.0, progress)),  # Clamp between 0 and 1
                "updated_at": datetime.datetime.now().isoformat()
            }
            
            if results is not None:
                update_data["results"] = results
            
            # If progress is 1, mark task as completed
            if progress >= 1.0:
                update_data["status"] = "completed"
            
            # Update task
            self.supabase.table(self.tasks_table) \
                .update(update_data) \
                .eq("task_id", task_id) \
                .execute()
            
            return True
        
        except Exception as e:
            logger.error(f"Error updating task progress: {e}")
            return False
    
    def get_task_jobs(self, task_id: str) -> List[DistributedJob]:
        """
        Get all jobs for a task
        
        Args:
            task_id: Task ID
            
        Returns:
            List of jobs
        """
        try:
            result = self.supabase.table(self.jobs_table) \
                .select("*") \
                .eq("task_id", task_id) \
                .execute()
            
            return [DistributedJob(**job_data) for job_data in result.data]
        
        except Exception as e:
            logger.error(f"Error getting task jobs: {e}")
            return []
    
    def get_active_workers(self) -> List[WorkerInfo]:
        """
        Get all active workers
        
        Returns:
            List of active worker info
        """
        try:
            # Get workers with recent heartbeats
            cutoff_time = (datetime.datetime.now() - 
                           datetime.timedelta(seconds=self.heartbeat_interval * 3)).isoformat()
            
            result = self.supabase.table(self.workers_table) \
                .select("*") \
                .filter("last_heartbeat", "gt", cutoff_time) \
                .execute()
            
            return [WorkerInfo(**worker_data) for worker_data in result.data]
        
        except Exception as e:
            logger.error(f"Error getting active workers: {e}")
            return []
    
    def shutdown(self) -> None:
        """Shutdown worker and clean up resources"""
        if self.worker_id:
            # Stop heartbeat thread
            self.running = False
            if self.heartbeat_thread:
                self.heartbeat_thread.join(timeout=1)
            
            # Update worker status
            try:
                self.supabase.table(self.workers_table) \
                    .update({
                        "status": WorkerStatus.OFFLINE,
                        "last_heartbeat": datetime.datetime.now().isoformat()
                    }) \
                    .eq("worker_id", self.worker_id) \
                    .execute()
            except Exception as e:
                logger.error(f"Error updating worker status during shutdown: {e}")
            
            logger.info(f"Worker {self.worker_id} shutdown")
            self.worker_id = None


class DistributedTrainer:
    """
    Distributed trainer that coordinates multiple workers
    
    This class manages the distributed training process, handling task creation,
    job submission, and result aggregation.
    """
    
    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        output_dir: str = "./distributed_training"
    ):
        """
        Initialize the distributed trainer
        
        Args:
            supabase_url: Supabase URL
            supabase_key: Supabase API key
            output_dir: Output directory for models and results
        """
        # Create Supabase queue
        self.queue = SupabaseQueue(
            supabase_url=supabase_url,
            supabase_key=supabase_key
        )
        
        # Set output directory
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        
        # Track current task
        self.current_task_id = None
        
        logger.info(f"Distributed trainer initialized with output dir: {output_dir}")
    
    def create_distributed_training_task(
        self,
        dataset_id: str,
        model_type: str,
        hyperparameters: Dict[str, Any],
        num_epochs: int = 10,
        num_batches_per_epoch: Optional[int] = None,
        batch_size: int = 32
    ) -> str:
        """
        Create a distributed training task
        
        Args:
            dataset_id: Dataset ID
            model_type: Type of model
            hyperparameters: Training hyperparameters
            num_epochs: Number of epochs
            num_batches_per_epoch: Number of batches per epoch (if None, calculated from dataset)
            batch_size: Batch size
            
        Returns:
            Task ID
        """
        # Create high-level task
        task_id = self.queue.create_task(
            task_type="distributed_training",
            dataset_id=dataset_id,
            model_type=model_type,
            hyperparameters={
                **hyperparameters,
                "num_epochs": num_epochs,
                "batch_size": batch_size,
                "num_batches_per_epoch": num_batches_per_epoch
            }
        )
        
        self.current_task_id = task_id
        
        # Create initial jobs for data preparation
        self.queue.submit_job(
            job_type="data_preparation",
            parameters={
                "dataset_id": dataset_id,
                "batch_size": batch_size
            },
            priority=10,  # High priority for initial setup
            task_id=task_id
        )
        
        return task_id
    
    def submit_epoch_jobs(
        self,
        task_id: str,
        epoch: int,
        num_batches: int,
        model_state_id: Optional[str] = None
    ) -> List[str]:
        """
        Submit jobs for a training epoch
        
        Args:
            task_id: Task ID
            epoch: Epoch number
            num_batches: Number of batches to distribute
            model_state_id: Optional model state ID for continuing training
            
        Returns:
            List of job IDs
        """
        # Create batch parameters
        batch_parameters = []
        for batch_idx in range(num_batches):
            batch_parameters.append({
                "batch_index": batch_idx,
                "batch_start": batch_idx
            })
        
        # Common parameters for all batch jobs
        common_parameters = {
            "epoch": epoch,
            "num_batches": num_batches,
            "model_state_id": model_state_id
        }
        
        # Submit batch jobs
        job_ids = self.queue.submit_batch_jobs(
            job_type="train_batch",
            common_parameters=common_parameters,
            batch_parameters=batch_parameters,
            priority=5,
            task_id=task_id
        )
        
        # Submit parameter aggregation job (to run after batch jobs)
        self.queue.submit_job(
            job_type="aggregate_parameters",
            parameters={
                "epoch": epoch,
                "num_batches": num_batches,
                "batch_job_ids": job_ids
            },
            priority=3,  # Lower priority so batch jobs run first
            task_id=task_id
        )
        
        return job_ids
    
    def monitor_training_progress(self, task_id: str) -> Dict[str, Any]:
        """
        Monitor training progress for a task
        
        Args:
            task_id: Task ID
            
        Returns:
            Progress information
        """
        # Get task
        task_result = self.queue.supabase.table(self.queue.tasks_table) \
            .select("*") \
            .eq("task_id", task_id) \
            .execute()
        
        if not task_result.data:
            return {"error": "Task not found"}
        
        task_data = task_result.data[0]
        
        # Get all jobs for this task
        jobs = self.queue.get_task_jobs(task_id)
        
        # Count jobs by status
        job_status_counts = {}
        for job in jobs:
            if job.status not in job_status_counts:
                job_status_counts[job.status] = 0
            job_status_counts[job.status] += 1
        
        # Get active workers
        workers = self.queue.get_active_workers()
        
        return {
            "task": task_data,
            "progress": task_data.get("progress", 0),
            "job_counts": job_status_counts,
            "total_jobs": len(jobs),
            "active_workers": len(workers),
            "worker_details": [w.to_dict() for w in workers]
        }


class DistributedWorker:
    """
    Worker node for distributed training
    
    This class handles job execution on a worker node, communicating
    with the Supabase queue for job retrieval and result submission.
    """
    
    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        working_dir: str = "./worker_data",
        capabilities: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize the worker
        
        Args:
            supabase_url: Supabase URL
            supabase_key: Supabase API key
            working_dir: Working directory for temporary files
            capabilities: Worker capabilities
        """
        # Create Supabase queue
        self.queue = SupabaseQueue(
            supabase_url=supabase_url,
            supabase_key=supabase_key
        )
        
        # Set working directory
        self.working_dir = working_dir
        os.makedirs(working_dir, exist_ok=True)
        
        # Register worker
        self.worker_id = self.queue.register_worker(capabilities)
        
        # Job handlers by type
        self.job_handlers = {}
        
        # Register default handlers
        self._register_default_handlers()
        
        # Running flag
        self.running = True
        
        logger.info(f"Worker {self.worker_id} initialized")
    
    def _register_default_handlers(self) -> None:
        """Register default job handlers"""
        # Data preparation handler
        self.register_job_handler("data_preparation", self._handle_data_preparation)
        
        # Batch training handler
        self.register_job_handler("train_batch", self._handle_train_batch)
        
        # Parameter aggregation handler
        self.register_job_handler("aggregate_parameters", self._handle_aggregate_parameters)
    
    def register_job_handler(self, job_type: str, handler: Callable[[DistributedJob], Dict[str, Any]]) -> None:
        """
        Register a job handler
        
        Args:
            job_type: Type of job
            handler: Handler function that takes a job and returns results
        """
        self.job_handlers[job_type] = handler
        logger.info(f"Registered handler for job type: {job_type}")
    
    def run(self, poll_interval: int = 5, max_jobs: Optional[int] = None) -> None:
        """
        Run the worker
        
        Args:
            poll_interval: Polling interval in seconds
            max_jobs: Maximum number of jobs to process (None = unlimited)
        """
        job_count = 0
        
        try:
            logger.info(f"Worker {self.worker_id} started")
            
            while self.running and (max_jobs is None or job_count < max_jobs):
                # Get next job
                job = self.queue.get_next_job()
                
                if job is None:
                    # No jobs available, wait and try again
                    time.sleep(poll_interval)
                    continue
                
                logger.info(f"Processing job {job.job_id} of type {job.job_type}")
                
                # Update job status to in progress
                self.queue.update_job_status(job.job_id, JobStatus.IN_PROGRESS)
                
                try:
                    # Get handler for this job type
                    handler = self.job_handlers.get(job.job_type)
                    
                    if handler is None:
                        raise ValueError(f"No handler registered for job type: {job.job_type}")
                    
                    # Handle job
                    start_time = time.time()
                    results = handler(job)
                    duration = time.time() - start_time
                    
                    # Add timing to results
                    if results is None:
                        results = {}
                    results["execution_time"] = duration
                    
                    # Update job status to completed
                    self.queue.update_job_status(job.job_id, JobStatus.COMPLETED, results)
                    logger.info(f"Completed job {job.job_id} in {duration:.2f}s")
                    
                except Exception as e:
                    # Update job status to failed
                    error_msg = f"{type(e).__name__}: {str(e)}"
                    logger.error(f"Error processing job {job.job_id}: {error_msg}")
                    self.queue.update_job_status(job.job_id, JobStatus.FAILED, error=error_msg)
                
                job_count += 1
        
        finally:
            # Shutdown gracefully
            self.shutdown()
    
    def shutdown(self) -> None:
        """Shutdown the worker"""
        self.running = False
        self.queue.shutdown()
        logger.info(f"Worker {self.worker_id} shutdown")
    
    # Default job handlers
    
    def _handle_data_preparation(self, job: DistributedJob) -> Dict[str, Any]:
        """
        Handle data preparation job
        
        Args:
            job: Job details
            
        Returns:
            Job results
        """
        # Placeholder implementation - would be replaced with actual data preparation logic
        dataset_id = job.parameters.get("dataset_id")
        batch_size = job.parameters.get("batch_size", 32)
        
        # Simulate data preparation
        time.sleep(2)
        
        # Return data information
        return {
            "dataset_id": dataset_id,
            "num_samples": 1000,  # Example value
            "num_batches": 1000 // batch_size,
            "num_classes": 10,  # Example value
            "data_prepared": True
        }
    
    def _handle_train_batch(self, job: DistributedJob) -> Dict[str, Any]:
        """
        Handle batch training job
        
        Args:
            job: Job details
            
        Returns:
            Job results
        """
        # Placeholder implementation - would be replaced with actual training logic
        epoch = job.parameters.get("epoch", 0)
        batch_index = job.parameters.get("batch_index", 0)
        
        # Simulate training
        time.sleep(1)
        
        # Simulated metrics
        loss = 1.0 / (1.0 + 0.1 * epoch + 0.01 * batch_index)
        accuracy = 0.5 + 0.01 * epoch + 0.001 * batch_index
        
        # Simulate gradient calculation
        if TORCH_AVAILABLE:
            # Create dummy gradients
            layer1_grad = torch.randn(10, 10) * 0.01
            layer2_grad = torch.randn(10, 1) * 0.005
            
            # Submit gradients
            self.queue.submit_gradient(
                job_id=job.job_id,
                layer_name="layer1",
                iteration=epoch * 1000 + batch_index,
                batch_size=job.parameters.get("batch_size", 32),
                gradient_data=layer1_grad
            )
            
            self.queue.submit_gradient(
                job_id=job.job_id,
                layer_name="layer2",
                iteration=epoch * 1000 + batch_index,
                batch_size=job.parameters.get("batch_size", 32),
                gradient_data=layer2_grad
            )
        else:
            # Create numpy gradients
            layer1_grad = np.random.randn(10, 10) * 0.01
            layer2_grad = np.random.randn(10, 1) * 0.005
            
            # Submit gradients
            self.queue.submit_gradient(
                job_id=job.job_id,
                layer_name="layer1",
                iteration=epoch * 1000 + batch_index,
                batch_size=job.parameters.get("batch_size", 32),
                gradient_data=layer1_grad
            )
            
            self.queue.submit_gradient(
                job_id=job.job_id,
                layer_name="layer2",
                iteration=epoch * 1000 + batch_index,
                batch_size=job.parameters.get("batch_size", 32),
                gradient_data=layer2_grad
            )
        
        # Return batch results
        return {
            "epoch": epoch,
            "batch_index": batch_index,
            "loss": float(loss),
            "accuracy": float(accuracy),
            "gradients_submitted": True
        }
    
    def _handle_aggregate_parameters(self, job: DistributedJob) -> Dict[str, Any]:
        """
        Handle parameter aggregation job
        
        Args:
            job: Job details
            
        Returns:
            Job results
        """
        # Get parameters
        epoch = job.parameters.get("epoch", 0)
        num_batches = job.parameters.get("num_batches", 0)
        batch_job_ids = job.parameters.get("batch_job_ids", [])
        
        # Check if all batch jobs are completed
        all_completed = True
        batch_results = []
        
        for job_id in batch_job_ids:
            result = self.queue.supabase.table(self.queue.jobs_table) \
                .select("*") \
                .eq("job_id", job_id) \
                .execute()
            
            if not result.data:
                all_completed = False
                continue
            
            job_data = result.data[0]
            if job_data.get("status") != JobStatus.COMPLETED:
                all_completed = False
                continue
            
            batch_results.append(job_data.get("results", {}))
        
        if not all_completed:
            return {
                "status": "waiting_for_batches",
                "completed_batches": len(batch_results),
                "total_batches": len(batch_job_ids)
            }
        
        # Get aggregated gradients
        iteration_base = epoch * 1000
        aggregated_gradients = {}
        
        for batch_idx in range(num_batches):
            iteration = iteration_base + batch_idx
            gradients = self.queue.get_aggregated_gradients(job_id, iteration)
            
            for layer_name, gradient in gradients.items():
                if layer_name not in aggregated_gradients:
                    aggregated_gradients[layer_name] = gradient
                else:
                    # Average the gradients from different batches
                    aggregated_gradients[layer_name] += gradient
        
        # Divide by number of batches to get final average
        for layer_name in aggregated_gradients:
            aggregated_gradients[layer_name] /= num_batches
        
        # Calculate average metrics
        avg_loss = sum(result.get("loss", 0) for result in batch_results) / len(batch_results)
        avg_accuracy = sum(result.get("accuracy", 0) for result in batch_results) / len(batch_results)
        
        # Update task progress
        if job.task_id:
            self.queue.update_task_progress(
                task_id=job.task_id,
                progress=(epoch + 1) / job.parameters.get("num_epochs", 10),
                results={
                    "current_epoch": epoch + 1,
                    "total_epochs": job.parameters.get("num_epochs", 10),
                    "average_loss": avg_loss,
                    "average_accuracy": avg_accuracy
                }
            )
        
        # Return aggregation results
        return {
            "epoch": epoch,
            "batches_processed": len(batch_results),
            "average_loss": avg_loss,
            "average_accuracy": avg_accuracy,
            "parameters_updated": True
        }


# Helper functions

def create_supabase_tables(
    supabase_url: str, 
    supabase_key: str,
    rpc_function_name: str = "create_distributed_training_tables"
) -> bool:
    """
    Create required Supabase tables and functions for distributed training
    
    Args:
        supabase_url: Supabase URL
        supabase_key: Supabase API key
        rpc_function_name: RPC function name
        
    Returns:
        Success flag
    """
    try:
        # Create Supabase client
        supabase = create_client(supabase_url, supabase_key)
        
        # Call RPC function to create tables
        result = supabase.rpc(rpc_function_name).execute()
        
        return "error" not in result.data
    
    except Exception as e:
        logger.error(f"Error creating Supabase tables: {e}")
        return False


def distributed_training_with_supabase(
    train_function: Callable,
    dataset_id: str,
    model_type: str,
    hyperparameters: Dict[str, Any],
    supabase_url: Optional[str] = None,
    supabase_key: Optional[str] = None,
    num_epochs: int = 10,
    batch_size: int = 32,
    output_dir: str = "./distributed_output"
) -> Dict[str, Any]:
    """
    Run distributed training with Supabase
    
    This high-level function orchestrates the distributed training process
    by setting up the task, monitoring progress, and returning results.
    
    Args:
        train_function: Function that performs the actual training on each batch
        dataset_id: Dataset ID
        model_type: Type of model
        hyperparameters: Training hyperparameters
        supabase_url: Supabase URL
        supabase_key: Supabase API key
        num_epochs: Number of epochs
        batch_size: Batch size
        output_dir: Output directory
        
    Returns:
        Training results
    """
    # Create distributed trainer
    trainer = DistributedTrainer(
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        output_dir=output_dir
    )
    
    # Create training task
    task_id = trainer.create_distributed_training_task(
        dataset_id=dataset_id,
        model_type=model_type,
        hyperparameters=hyperparameters,
        num_epochs=num_epochs,
        batch_size=batch_size
    )
    
    logger.info(f"Created distributed training task: {task_id}")
    
    # Monitor task until completion
    completed = False
    max_wait_time = 3600  # 1 hour timeout
    start_time = time.time()
    
    while not completed and (time.time() - start_time) < max_wait_time:
        # Get progress
        progress_info = trainer.monitor_training_progress(task_id)
        
        # Check if task is completed
        if progress_info.get("progress", 0) >= 1.0:
            completed = True
            break
        
        # Print progress
        logger.info(f"Task progress: {progress_info.get('progress', 0):.1%}, "
                   f"Jobs: {progress_info.get('job_counts', {})}, "
                   f"Workers: {progress_info.get('active_workers', 0)}")
        
        # Wait before checking again
        time.sleep(10)
    
    # Get final results
    final_results = trainer.monitor_training_progress(task_id)
    
    if completed:
        logger.info(f"Training task {task_id} completed successfully")
    else:
        logger.warning(f"Training task {task_id} did not complete within the timeout")
    
    return {
        "task_id": task_id,
        "completed": completed,
        "training_time": time.time() - start_time,
        "results": final_results
    }


if __name__ == "__main__":
    # Example of how to use the distributed training system
    import argparse
    
    parser = argparse.ArgumentParser(description="Run distributed training")
    parser.add_argument("--mode", choices=["worker", "coordinator"], required=True,
                       help="Run mode: worker or coordinator")
    parser.add_argument("--supabase-url", default=None,
                       help="Supabase URL (defaults to SUPABASE_URL env var)")
    parser.add_argument("--supabase-key", default=None,
                       help="Supabase API key (defaults to SUPABASE_KEY env var)")
    parser.add_argument("--output-dir", default="./distributed_output",
                       help="Output directory")
    parser.add_argument("--max-jobs", type=int, default=None,
                       help="Maximum number of jobs to process (worker mode only)")
    
    args = parser.parse_args()
    
    if args.mode == "worker":
        # Run as worker
        worker = DistributedWorker(
            supabase_url=args.supabase_url,
            supabase_key=args.supabase_key,
            working_dir=os.path.join(args.output_dir, "worker_data")
        )
        
        try:
            worker.run(max_jobs=args.max_jobs)
        except KeyboardInterrupt:
            logger.info("Worker stopped by user")
        finally:
            worker.shutdown()
    
    elif args.mode == "coordinator":
        # Run as coordinator
        trainer = DistributedTrainer(
            supabase_url=args.supabase_url,
            supabase_key=args.supabase_key,
            output_dir=args.output_dir
        )
        
        # Example of creating a training task
        task_id = trainer.create_distributed_training_task(
            dataset_id="example_dataset",
            model_type="resnet50",
            hyperparameters={
                "learning_rate": 0.001,
                "optimizer": "adam"
            },
            num_epochs=5,
            batch_size=32
        )
        
        logger.info(f"Created training task: {task_id}")
        logger.info("Monitor the task from the admin panel or by running:")
        logger.info(f"    python -m distributed_training --mode worker")