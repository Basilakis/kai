#!/usr/bin/env python3
"""
Distributed OCR Processing

This module provides distributed processing capabilities for neural OCR engines,
enabling scaling across multiple machines and accelerators.

Key features:
1. Task distribution and load balancing
2. Worker management and health monitoring
3. Results aggregation and error handling
4. Resource optimization for GPU/CPU workloads
5. Dynamic scaling based on workload
"""

import os
import sys
import json
import time
import uuid
import logging
import socket
import threading
import queue
import multiprocessing
from typing import Dict, List, Any, Tuple, Optional, Union, Callable
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Try to import distributed computing libraries
try:
    import ray
    RAY_AVAILABLE = True
    logger.info("Ray available for distributed processing")
except ImportError:
    RAY_AVAILABLE = False
    logger.warning("Ray not available, falling back to local processing")

try:
    import torch.distributed as dist
    TORCH_DISTRIBUTED_AVAILABLE = True
    logger.info("PyTorch distributed available")
except ImportError:
    TORCH_DISTRIBUTED_AVAILABLE = False
    logger.warning("PyTorch distributed not available")

try:
    from dask.distributed import Client, LocalCluster
    DASK_AVAILABLE = True
    logger.info("Dask available for distributed processing")
except ImportError:
    DASK_AVAILABLE = False
    logger.warning("Dask not available")


class DistributedOCRManager:
    """Manages distributed OCR processing across multiple nodes"""
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize distributed OCR manager
        
        Args:
            config: Configuration dictionary
        """
        self.config = {
            'backend': 'local',  # 'local', 'ray', 'torch', 'dask'
            'num_workers': multiprocessing.cpu_count(),
            'worker_timeout': 600,  # seconds
            'batch_size': 8,
            'ray_address': None,  # Default local or 'auto' for auto-connection
            'ray_resources': {},  # Custom resources per task
            'gpu_fraction': 0.5,  # Fraction of GPU memory per worker
            'max_retries': 3,
            'result_timeout': 3600,  # seconds
            'heartbeat_interval': 30,  # seconds
            'task_queue_size': 1000,
            'result_queue_size': 1000,
            'log_level': 'INFO',
            'scheduler_type': 'dynamic',  # 'static', 'dynamic', 'priority'
            'priority_rules': {},  # Custom rules for priority scheduling
            'checkpoint_interval': 50,  # tasks
            'checkpoint_dir': None
        }
        
        if config:
            self.config.update(config)
        
        # Set up logging
        numeric_level = getattr(logging, self.config['log_level'].upper(), None)
        if isinstance(numeric_level, int):
            logger.setLevel(numeric_level)
        
        # Create checkpoint directory
        if not self.config['checkpoint_dir']:
            self.config['checkpoint_dir'] = os.path.join(os.getcwd(), 'ocr_checkpoints')
        
        os.makedirs(self.config['checkpoint_dir'], exist_ok=True)
        
        # Initialize backend
        self.backend = None
        self.workers = []
        self.tasks = queue.Queue(maxsize=self.config['task_queue_size'])
        self.results = queue.Queue(maxsize=self.config['result_queue_size'])
        self.worker_status = {}
        self.task_map = {}  # Maps task_id to task details
        self.shutdown_flag = threading.Event()
        
        # Initialize statistics
        self.stats = {
            'tasks_submitted': 0,
            'tasks_completed': 0,
            'tasks_failed': 0,
            'processing_time': 0,
            'worker_utilization': {},
            'start_time': time.time()
        }
    
    def initialize(self) -> bool:
        """
        Initialize the distributed processing backend
        
        Returns:
            True if initialization successful, False otherwise
        """
        try:
            if self.config['backend'] == 'ray' and RAY_AVAILABLE:
                return self._initialize_ray()
            elif self.config['backend'] == 'torch' and TORCH_DISTRIBUTED_AVAILABLE:
                return self._initialize_torch_distributed()
            elif self.config['backend'] == 'dask' and DASK_AVAILABLE:
                return self._initialize_dask()
            else:
                # Fall back to local processing
                logger.info("Using local processing backend")
                self.config['backend'] = 'local'
                return self._initialize_local()
                
        except Exception as e:
            logger.error(f"Error initializing backend: {e}")
            # Fall back to local processing
            logger.info("Falling back to local processing")
            self.config['backend'] = 'local'
            return self._initialize_local()
    
    def _initialize_ray(self) -> bool:
        """Initialize Ray backend"""
        try:
            # Initialize Ray
            if not ray.is_initialized():
                if self.config['ray_address']:
                    ray.init(address=self.config['ray_address'])
                else:
                    ray.init()
            
            logger.info(f"Ray initialized. Available resources: {ray.available_resources()}")
            
            # Define remote worker function
            @ray.remote
            def ocr_worker(worker_id, engine_type, models_dir, config):
                """Ray worker for OCR processing"""
                # Initialize worker
                if engine_type == 'nougat':
                    # Import and initialize Nougat
                    from nougat_engine import NougatEngine
                    engine = NougatEngine(config)
                elif engine_type == 'marker':
                    # Import and initialize Marker
                    from marker_engine import MarkerEngine
                    engine = MarkerEngine(config)
                elif engine_type == 'thepipe':
                    # Import and initialize thepipe
                    from thepipe_engine import ThePipeEngine
                    engine = ThePipeEngine(config)
                else:
                    return {'error': f"Unknown engine type: {engine_type}"}
                
                # Return worker info
                return {
                    'worker_id': worker_id,
                    'engine_type': engine_type,
                    'hostname': socket.gethostname(),
                    'status': 'ready'
                }
            
            # Start worker processes based on configuration
            self.workers = []
            
            for worker_idx in range(self.config['num_workers']):
                # Create worker with specified engine type
                worker_ref = ocr_worker.remote(
                    worker_idx,
                    'nougat',  # Default engine, can be configured per worker
                    os.path.join(self.config['checkpoint_dir'], 'models'),
                    {'gpu_fraction': self.config['gpu_fraction']}
                )
                self.workers.append(worker_ref)
                
                # Initialize worker status
                self.worker_status[worker_idx] = {
                    'status': 'starting',
                    'last_heartbeat': time.time(),
                    'tasks_processed': 0,
                    'current_task': None
                }
            
            # Wait for workers to initialize
            initialization_results = ray.get([worker.remote() for worker in self.workers])
            
            for idx, result in enumerate(initialization_results):
                if 'error' in result:
                    logger.error(f"Worker {idx} initialization failed: {result['error']}")
                else:
                    logger.info(f"Worker {idx} initialized: {result}")
                    self.worker_status[idx]['status'] = 'idle'
            
            # Start monitoring thread
            self._start_monitoring()
            
            return True
            
        except Exception as e:
            logger.error(f"Error initializing Ray: {e}")
            return False
    
    def _initialize_torch_distributed(self) -> bool:
        """Initialize PyTorch distributed backend"""
        try:
            # Initialize process group
            if not dist.is_initialized():
                dist.init_process_group(backend='nccl' if torch.cuda.is_available() else 'gloo')
            
            # Get local rank and world size
            local_rank = dist.get_rank()
            world_size = dist.get_world_size()
            
            logger.info(f"PyTorch distributed initialized. Rank: {local_rank}, World Size: {world_size}")
            
            # Start monitoring thread
            self._start_monitoring()
            
            return True
            
        except Exception as e:
            logger.error(f"Error initializing PyTorch distributed: {e}")
            return False
    
    def _initialize_dask(self) -> bool:
        """Initialize Dask backend"""
        try:
            # Create local cluster if no external cluster specified
            if not hasattr(self, 'dask_client'):
                cluster = LocalCluster(
                    n_workers=self.config['num_workers'],
                    threads_per_worker=1
                )
                self.dask_client = Client(cluster)
            
            logger.info(f"Dask initialized. Dashboard: {self.dask_client.dashboard_link}")
            
            # Start monitoring thread
            self._start_monitoring()
            
            return True
            
        except Exception as e:
            logger.error(f"Error initializing Dask: {e}")
            return False
    
    def _initialize_local(self) -> bool:
        """Initialize local processing backend"""
        try:
            # Use process pool for local parallelism
            self.process_pool = ProcessPoolExecutor(max_workers=self.config['num_workers'])
            
            # Initialize worker status
            for worker_idx in range(self.config['num_workers']):
                self.worker_status[worker_idx] = {
                    'status': 'idle',
                    'last_heartbeat': time.time(),
                    'tasks_processed': 0,
                    'current_task': None
                }
            
            # Start task scheduler and result collector threads
            self._start_scheduler()
            self._start_result_collector()
            
            # Start monitoring thread
            self._start_monitoring()
            
            logger.info(f"Local processing initialized with {self.config['num_workers']} workers")
            
            return True
            
        except Exception as e:
            logger.error(f"Error initializing local processing: {e}")
            return False
    
    def _start_monitoring(self):
        """Start monitoring thread"""
        def monitor_workers():
            while not self.shutdown_flag.is_set():
                try:
                    current_time = time.time()
                    
                    # Check worker status
                    for worker_id, status in self.worker_status.items():
                        # Check for worker timeout
                        if status['status'] != 'idle' and current_time - status['last_heartbeat'] > self.config['worker_timeout']:
                            logger.warning(f"Worker {worker_id} timed out, marking as failed")
                            
                            # Handle failed task
                            if status['current_task']:
                                task_id = status['current_task']
                                if task_id in self.task_map:
                                    task = self.task_map[task_id]
                                    
                                    # Add to retry queue if retries remaining
                                    if task.get('retries', 0) < self.config['max_retries']:
                                        task['retries'] = task.get('retries', 0) + 1
                                        logger.info(f"Requeueing task {task_id} for retry {task['retries']}/{self.config['max_retries']}")
                                        self.tasks.put(task)
                                    else:
                                        # Mark as failed
                                        logger.error(f"Task {task_id} failed after {self.config['max_retries']} retries")
                                        self.stats['tasks_failed'] += 1
                                        
                                        # Add failure result
                                        task_result = {
                                            'task_id': task_id,
                                            'status': 'failed',
                                            'error': 'Worker timeout',
                                            'retries': task.get('retries', 0),
                                            'timestamp': time.time()
                                        }
                                        self.results.put(task_result)
                            
                            # Reset worker status
                            status['status'] = 'idle'
                            status['current_task'] = None
                            status['last_heartbeat'] = current_time
                    
                    # Update stats
                    self.stats['uptime'] = time.time() - self.stats['start_time']
                    
                    # Calculate worker utilization
                    active_workers = sum(1 for status in self.worker_status.values() if status['status'] == 'busy')
                    self.stats['worker_utilization']['current'] = active_workers / max(1, len(self.worker_status))
                    
                    # Log stats periodically
                    if int(self.stats['uptime']) % 60 == 0:
                        logger.info(f"Stats: {self.stats}")
                    
                    # Sleep before next check
                    time.sleep(self.config['heartbeat_interval'])
                    
                except Exception as e:
                    logger.error(f"Error in monitor thread: {e}")
        
        # Start monitor thread
        self.monitor_thread = threading.Thread(target=monitor_workers, daemon=True)
        self.monitor_thread.start()
    
    def _start_scheduler(self):
        """Start task scheduler thread"""
        def task_scheduler():
            while not self.shutdown_flag.is_set():
                try:
                    # Get next task
                    task = self.tasks.get(timeout=1.0)
                    
                    # Find available worker
                    worker_id = self._find_available_worker()
                    
                    if worker_id is not None:
                        # Assign task to worker
                        self.worker_status[worker_id]['status'] = 'busy'
                        self.worker_status[worker_id]['current_task'] = task['task_id']
                        self.worker_status[worker_id]['last_heartbeat'] = time.time()
                        
                        # Submit task to worker
                        if self.config['backend'] == 'local':
                            future = self.process_pool.submit(
                                self._process_task,
                                task,
                                worker_id
                            )
                            
                            # Add callback for result handling
                            future.add_done_callback(self._handle_task_result)
                    else:
                        # No worker available, put task back in queue
                        self.tasks.put(task)
                        time.sleep(0.1)
                    
                except queue.Empty:
                    # No tasks in queue
                    pass
                except Exception as e:
                    logger.error(f"Error in scheduler thread: {e}")
        
        # Start scheduler thread
        self.scheduler_thread = threading.Thread(target=task_scheduler, daemon=True)
        self.scheduler_thread.start()
    
    def _start_result_collector(self):
        """Start result collector thread"""
        def result_collector():
            while not self.shutdown_flag.is_set():
                try:
                    # Get next result
                    result = self.results.get(timeout=1.0)
                    
                    # Update task status
                    task_id = result.get('task_id')
                    if task_id in self.task_map:
                        task = self.task_map[task_id]
                        
                        # Update task with result
                        task['result'] = result
                        
                        # Remove from task map if complete
                        if result.get('status') in ['completed', 'failed']:
                            del self.task_map[task_id]
                    
                    # Notify callback if provided
                    if 'callback' in result and callable(result['callback']):
                        try:
                            result['callback'](result)
                        except Exception as e:
                            logger.error(f"Error in result callback: {e}")
                    
                    # Update stats
                    if result.get('status') == 'completed':
                        self.stats['tasks_completed'] += 1
                    elif result.get('status') == 'failed':
                        self.stats['tasks_failed'] += 1
                    
                    # Periodic checkpoint
                    if (self.stats['tasks_completed'] + self.stats['tasks_failed']) % self.config['checkpoint_interval'] == 0:
                        self._save_checkpoint()
                    
                except queue.Empty:
                    # No results in queue
                    pass
                except Exception as e:
                    logger.error(f"Error in result collector thread: {e}")
        
        # Start result collector thread
        self.result_thread = threading.Thread(target=result_collector, daemon=True)
        self.result_thread.start()
    
    def _find_available_worker(self) -> Optional[int]:
        """Find an available worker"""
        for worker_id, status in self.worker_status.items():
            if status['status'] == 'idle':
                return worker_id
        return None
    
    def _process_task(self, task: Dict[str, Any], worker_id: int) -> Dict[str, Any]:
        """
        Process a task (for local backend)
        
        Args:
            task: Task dictionary
            worker_id: Worker ID
            
        Returns:
            Task result dictionary
        """
        try:
            start_time = time.time()
            
            # Update worker status
            self.worker_status[worker_id]['status'] = 'busy'
            self.worker_status[worker_id]['current_task'] = task['task_id']
            
            # Extract task parameters
            engine_type = task.get('engine_type', 'nougat')
            document_path = task.get('document_path')
            document_data = task.get('document_data')
            processing_options = task.get('options', {})
            
            # Initialize appropriate engine
            if engine_type == 'nougat':
                # Import and initialize Nougat
                from nougat_engine import NougatEngine
                engine = NougatEngine(processing_options)
            elif engine_type == 'marker':
                # Import and initialize Marker
                from marker_engine import MarkerEngine
                engine = MarkerEngine(processing_options)
            elif engine_type == 'thepipe':
                # Import and initialize thepipe
                from thepipe_engine import ThePipeEngine
                engine = ThePipeEngine(processing_options)
            else:
                return {
                    'task_id': task['task_id'],
                    'status': 'failed',
                    'error': f"Unknown engine type: {engine_type}",
                    'worker_id': worker_id,
                    'timestamp': time.time(),
                    'processing_time': time.time() - start_time
                }
            
            # Process document
            if document_path:
                # Process from file
                result = engine.process_file(document_path)
            elif document_data:
                # Process from memory
                result = engine.process_data(document_data)
            else:
                return {
                    'task_id': task['task_id'],
                    'status': 'failed',
                    'error': 'No document path or data provided',
                    'worker_id': worker_id,
                    'timestamp': time.time(),
                    'processing_time': time.time() - start_time
                }
            
            # Update worker status
            self.worker_status[worker_id]['status'] = 'idle'
            self.worker_status[worker_id]['current_task'] = None
            self.worker_status[worker_id]['tasks_processed'] += 1
            self.worker_status[worker_id]['last_heartbeat'] = time.time()
            
            # Return result
            return {
                'task_id': task['task_id'],
                'status': 'completed',
                'result': result,
                'worker_id': worker_id,
                'timestamp': time.time(),
                'processing_time': time.time() - start_time
            }
            
        except Exception as e:
            logger.error(f"Error processing task {task.get('task_id')}: {e}")
            
            # Update worker status
            self.worker_status[worker_id]['status'] = 'idle'
            self.worker_status[worker_id]['current_task'] = None
            self.worker_status[worker_id]['last_heartbeat'] = time.time()
            
            # Return error
            return {
                'task_id': task['task_id'],
                'status': 'failed',
                'error': str(e),
                'worker_id': worker_id,
                'timestamp': time.time(),
                'processing_time': time.time() - start_time
            }
    
    def _handle_task_result(self, future):
        """Handle task result from Future"""
        try:
            result = future.result()
            if result:
                # Put result in queue
                self.results.put(result)
        except Exception as e:
            logger.error(f"Error handling task result: {e}")
    
    def _save_checkpoint(self):
        """Save checkpoint of current state"""
        try:
            checkpoint_path = os.path.join(
                self.config['checkpoint_dir'],
                f"checkpoint_{int(time.time())}.json"
            )
            
            # Create checkpoint data
            checkpoint = {
                'timestamp': time.time(),
                'stats': self.stats,
                'config': self.config,
                'tasks_pending': self.tasks.qsize(),
                'results_pending': self.results.qsize(),
                'worker_status': self.worker_status
            }
            
            # Save checkpoint
            with open(checkpoint_path, 'w', encoding='utf-8') as f:
                json.dump(checkpoint, f, indent=2)
            
            logger.info(f"Checkpoint saved to {checkpoint_path}")
            
        except Exception as e:
            logger.error(f"Error saving checkpoint: {e}")
    
    def submit_task(self, document_path: str = None, document_data: bytes = None, 
                  engine_type: str = 'nougat', options: Dict[str, Any] = None,
                  callback: Callable = None) -> str:
        """
        Submit a document processing task
        
        Args:
            document_path: Path to document file (optional)
            document_data: Raw document data (optional)
            engine_type: OCR engine to use ('nougat', 'marker', 'thepipe')
            options: Processing options specific to the engine
            callback: Optional callback function to call with result
            
        Returns:
            Task ID string
        """
        if not document_path and not document_data:
            raise ValueError("Either document_path or document_data must be provided")
        
        # Generate unique task ID
        task_id = str(uuid.uuid4())
        
        # Create task
        task = {
            'task_id': task_id,
            'document_path': document_path,
            'document_data': document_data,
            'engine_type': engine_type,
            'options': options or {},
            'callback': callback,
            'submission_time': time.time(),
            'status': 'submitted',
            'retries': 0
        }
        
        # Add to task map
        self.task_map[task_id] = task
        
        # Add to task queue
        self.tasks.put(task)
        
        # Update stats
        self.stats['tasks_submitted'] += 1
        
        return task_id
    
    def get_result(self, task_id: str, timeout: float = None) -> Dict[str, Any]:
        """
        Get result for a specific task
        
        Args:
            task_id: Task ID
            timeout: Maximum time to wait for result (seconds)
            
        Returns:
            Result dictionary or None if timeout
        """
        # Check if already completed
        if task_id not in self.task_map:
            # Check if it was already processed
            task_result_file = os.path.join(
                self.config['checkpoint_dir'],
                f"result_{task_id}.json"
            )
            
            if os.path.exists(task_result_file):
                with open(task_result_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            
            return None
        
        # Wait for task to complete
        start_time = time.time()
        timeout = timeout or self.config['result_timeout']
        
        while task_id in self.task_map and (time.time() - start_time) < timeout:
            task = self.task_map[task_id]
            
            if 'result' in task:
                return task['result']
            
            time.sleep(0.1)
        
        # Timeout reached
        return None
    
    def get_status(self, task_id: str = None) -> Dict[str, Any]:
        """
        Get status of tasks and workers
        
        Args:
            task_id: Optional task ID to get specific task status
            
        Returns:
            Status dictionary
        """
        if task_id:
            # Get specific task status
            if task_id in self.task_map:
                task = self.task_map[task_id]
                return {
                    'task_id': task_id,
                    'status': task.get('status', 'unknown'),
                    'submission_time': task.get('submission_time'),
                    'engine_type': task.get('engine_type'),
                    'retries': task.get('retries', 0)
                }
            else:
                return {'task_id': task_id, 'status': 'not_found'}
        
        # Get overall status
        return {
            'stats': self.stats,
            'tasks_queued': self.tasks.qsize(),
            'results_queued': self.results.qsize(),
            'active_tasks': len(self.task_map),
            'workers': len(self.worker_status),
            'active_workers': sum(1 for status in self.worker_status.values() if status['status'] == 'busy'),
            'backend': self.config['backend']
        }
    
    def cancel_task(self, task_id: str) -> bool:
        """
        Cancel a pending task
        
        Args:
            task_id: Task ID to cancel
            
        Returns:
            True if task was canceled, False otherwise
        """
        if task_id in self.task_map:
            task = self.task_map[task_id]
            
            # Check if already processing
            for worker_id, status in self.worker_status.items():
                if status['current_task'] == task_id:
                    # Cannot cancel in-progress task in local mode
                    if self.config['backend'] == 'local':
                        return False
                    
                    # For other backends, attempt to cancel
                    if self.config['backend'] == 'ray' and RAY_AVAILABLE:
                        # For Ray, we can attempt to cancel the task
                        pass
                    
                    return False
            
            # Remove from task map
            del self.task_map[task_id]
            
            # Add cancellation result
            result = {
                'task_id': task_id,
                'status': 'canceled',
                'timestamp': time.time()
            }
            self.results.put(result)
            
            return True
        
        return False
    
    def shutdown(self):
        """Shutdown distributed processing"""
        logger.info("Shutting down distributed OCR processing")
        
        # Set shutdown flag
        self.shutdown_flag.set()
        
        # Wait for threads to finish
        if hasattr(self, 'monitor_thread') and self.monitor_thread.is_alive():
            self.monitor_thread.join(timeout=5.0)
        
        if hasattr(self, 'scheduler_thread') and self.scheduler_thread.is_alive():
            self.scheduler_thread.join(timeout=5.0)
        
        if hasattr(self, 'result_thread') and self.result_thread.is_alive():
            self.result_thread.join(timeout=5.0)
        
        # Shutdown backend
        if self.config['backend'] == 'local' and hasattr(self, 'process_pool'):
            self.process_pool.shutdown(wait=False)
        
        elif self.config['backend'] == 'ray' and RAY_AVAILABLE and ray.is_initialized():
            # Don't shut down Ray if we didn't initialize it
            if not self.config['ray_address']:
                ray.shutdown()
        
        elif self.config['backend'] == 'dask' and hasattr(self, 'dask_client'):
            self.dask_client.close()
        
        # Save final checkpoint
        self._save_checkpoint()


class DistributedBatchProcessor:
    """Processes batches of documents using distributed OCR"""
    
    def __init__(self, distributed_manager: DistributedOCRManager):
        """
        Initialize batch processor
        
        Args:
            distributed_manager: DistributedOCRManager instance
        """
        self.manager = distributed_manager
        self.batch_results = {}
        self.batch_stats = {}
    
    def process_batch(self, document_paths: List[str], engine_type: str = 'nougat',
                    options: Dict[str, Any] = None, batch_id: str = None) -> str:
        """
        Process a batch of documents
        
        Args:
            document_paths: List of paths to documents
            engine_type: OCR engine to use
            options: Processing options
            batch_id: Optional batch ID (generated if not provided)
            
        Returns:
            Batch ID string
        """
        # Generate batch ID if not provided
        if not batch_id:
            batch_id = f"batch_{str(uuid.uuid4())}"
        
        # Initialize batch tracking
        self.batch_results[batch_id] = {
            'status': 'in_progress',
            'total': len(document_paths),
            'completed': 0,
            'failed': 0,
            'results': {},
            'task_ids': [],
            'start_time': time.time()
        }
        
        # Submit each document as a task
        for doc_path in document_paths:
            # Create callback for tracking batch progress
            def result_callback(result, batch_id=batch_id, doc_path=doc_path):
                self._handle_batch_result(batch_id, doc_path, result)
            
            # Submit task
            task_id = self.manager.submit_task(
                document_path=doc_path,
                engine_type=engine_type,
                options=options,
                callback=result_callback
            )
            
            # Track task ID for this batch
            self.batch_results[batch_id]['task_ids'].append(task_id)
        
        return batch_id
    
    def _handle_batch_result(self, batch_id: str, doc_path: str, result: Dict[str, Any]):
        """Handle result from a batch task"""
        if batch_id in self.batch_results:
            batch = self.batch_results[batch_id]
            
            # Store result
            batch['results'][doc_path] = result
            
            # Update counters
            if result.get('status') == 'completed':
                batch['completed'] += 1
            elif result.get('status') in ['failed', 'canceled']:
                batch['failed'] += 1
            
            # Check if batch is complete
            if batch['completed'] + batch['failed'] >= batch['total']:
                batch['status'] = 'completed'
                batch['end_time'] = time.time()
                batch['processing_time'] = batch['end_time'] - batch['start_time']
                
                # Log completion
                logger.info(f"Batch {batch_id} completed: {batch['completed']} succeeded, {batch['failed']} failed, took {batch['processing_time']:.2f} seconds")
    
    def get_batch_status(self, batch_id: str) -> Dict[str, Any]:
        """
        Get status of a batch
        
        Args:
            batch_id: Batch ID
            
        Returns:
            Batch status dictionary
        """
        if batch_id in self.batch_results:
            return self.batch_results[batch_id]
        else:
            return {'status': 'not_found', 'batch_id': batch_id}
    
    def wait_for_batch(self, batch_id: str, timeout: float = None) -> Dict[str, Any]:
        """
        Wait for a batch to complete
        
        Args:
            batch_id: Batch ID
            timeout: Maximum time to wait (seconds)
            
        Returns:
            Batch results dictionary
        """
        if batch_id not in self.batch_results:
            return {'status': 'not_found', 'batch_id': batch_id}
        
        # Wait for batch to complete
        start_time = time.time()
        timeout = timeout or 3600  # Default 1 hour
        
        while self.batch_results[batch_id]['status'] == 'in_progress' and (time.time() - start_time) < timeout:
            time.sleep(0.5)
        
        return self.batch_results[batch_id]
    
    def cancel_batch(self, batch_id: str) -> bool:
        """
        Cancel a batch
        
        Args:
            batch_id: Batch ID
            
        Returns:
            True if batch was canceled, False otherwise
        """
        if batch_id in self.batch_results:
            batch = self.batch_results[batch_id]
            
            # Cancel each task
            for task_id in batch['task_ids']:
                self.manager.cancel_task(task_id)
            
            # Update batch status
            batch['status'] = 'canceled'
            batch['end_time'] = time.time()
            
            return True
        
        return False


def main():
    """Main entry point for command-line usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Distributed OCR Processing")
    parser.add_argument('--backend', choices=['local', 'ray', 'torch', 'dask'], default='local',
                       help='Distributed backend to use')
    parser.add_argument('--workers', type=int, default=multiprocessing.cpu_count(),
                       help='Number of worker processes')
    parser.add_argument('--batch-size', type=int, default=8,
                       help='Batch size for processing')
    parser.add_argument('--engine', choices=['nougat', 'marker', 'thepipe'], default='nougat',
                       help='OCR engine to use')
    parser.add_argument('--ray-address', help='Ray cluster address (for ray backend)')
    parser.add_argument('--input-dir', help='Input directory with documents to process')
    parser.add_argument('--output-dir', help='Output directory for results')
    
    args = parser.parse_args()
    
    # Set up configuration
    config = {
        'backend': args.backend,
        'num_workers': args.workers,
        'batch_size': args.batch_size,
        'ray_address': args.ray_address
    }
    
    # Initialize distributed manager
    distributed_manager = DistributedOCRManager(config)
    success = distributed_manager.initialize()
    
    if not success:
        logger.error("Failed to initialize distributed processing")
        return
    
    # Process input directory if provided
    if args.input_dir and os.path.isdir(args.input_dir):
        # Find document files
        document_paths = []
        for root, dirs, files in os.walk(args.input_dir):
            for file in files:
                if file.lower().endswith(('.pdf', '.jpg', '.jpeg', '.png', '.tif', '.tiff')):
                    document_paths.append(os.path.join(root, file))
        
        if document_paths:
            logger.info(f"Found {len(document_paths)} documents to process")
            
            # Create batch processor
            batch_processor = DistributedBatchProcessor(distributed_manager)
            
            # Process batch
            batch_id = batch_processor.process_batch(
                document_paths=document_paths,
                engine_type=args.engine
            )
            
            # Wait for batch to complete
            logger.info(f"Processing batch {batch_id}...")
            result = batch_processor.wait_for_batch(batch_id)
            
            # Save results if output directory provided
            if args.output_dir:
                os.makedirs(args.output_dir, exist_ok=True)
                
                result_path = os.path.join(args.output_dir, f"batch_result_{batch_id}.json")
                with open(result_path, 'w', encoding='utf-8') as f:
                    json.dump(result, f, indent=2)
                
                logger.info(f"Results saved to {result_path}")
            
            logger.info(f"Batch processing completed: {result['completed']} succeeded, {result['failed']} failed")
        else:
            logger.error(f"No document files found in {args.input_dir}")
    
    # Shutdown distributed processing
    distributed_manager.shutdown()


if __name__ == "__main__":
    main()