#!/usr/bin/env python3
"""
Parameter Manager for Dynamic Training Parameter Adjustment

This module provides classes for managing training parameters that can be
dynamically adjusted during the training process. It supports both file-based
and Supabase-based storage mechanisms.

Classes:
    ParameterManager: Abstract base class defining the parameter management interface
    FileBasedParameterManager: Implements file-based parameter management
    SupabaseParameterManager: Implements Supabase-based parameter management

Functions:
    create_parameter_manager: Factory function to create the appropriate manager
"""

import os
import json
import time
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('parameter_manager')


class ParameterManager(ABC):
    """
    Abstract base class for parameter management
    
    This class defines the interface for parameter managers that handle
    dynamic parameter adjustment during training.
    """
    
    def __init__(self, job_id: str):
        """
        Initialize the parameter manager
        
        Args:
            job_id: Unique identifier for the training job
        """
        self.job_id = job_id
    
    @abstractmethod
    def has_updates(self) -> bool:
        """
        Check if there are parameter updates available
        
        Returns:
            True if updates are available, False otherwise
        """
        pass
    
    @abstractmethod
    def get_updates(self) -> Dict[str, Any]:
        """
        Get available parameter updates
        
        Returns:
            Dictionary of parameter updates
        """
        pass
    
    @abstractmethod
    def acknowledge_updates(self) -> None:
        """
        Acknowledge that updates have been applied
        """
        pass
    
    @abstractmethod
    def report_current_parameters(self, params: Dict[str, Any]) -> None:
        """
        Report the current parameters
        
        Args:
            params: Dictionary of current parameters
        """
        pass


class FileBasedParameterManager(ParameterManager):
    """
    File-based parameter manager implementation
    
    This class implements parameter management using local files for storage.
    """
    
    def __init__(self, job_id: str, base_dir: str = './params'):
        """
        Initialize the file-based parameter manager
        
        Args:
            job_id: Unique identifier for the training job
            base_dir: Base directory for parameter files
        """
        super().__init__(job_id)
        self.base_dir = base_dir
        self.params_dir = os.path.join(base_dir, job_id)
        self.updates_file = os.path.join(self.params_dir, 'updates.json')
        self.current_file = os.path.join(self.params_dir, 'current.json')
        self.last_update_time = 0
        
        # Create directories if they don't exist
        os.makedirs(self.params_dir, exist_ok=True)
        
        # Initialize files if they don't exist
        if not os.path.exists(self.updates_file):
            with open(self.updates_file, 'w') as f:
                json.dump({}, f)
        
        if not os.path.exists(self.current_file):
            with open(self.current_file, 'w') as f:
                json.dump({}, f)
    
    def has_updates(self) -> bool:
        """
        Check if there are parameter updates available
        
        Returns:
            True if updates are available, False otherwise
        """
        if not os.path.exists(self.updates_file):
            return False
        
        # Check if the file has been modified since last check
        current_mtime = os.path.getmtime(self.updates_file)
        if current_mtime > self.last_update_time:
            try:
                with open(self.updates_file, 'r') as f:
                    updates = json.load(f)
                return len(updates) > 0
            except (json.JSONDecodeError, IOError) as e:
                logger.error(f"Error checking for updates: {e}")
                return False
        
        return False
    
    def get_updates(self) -> Dict[str, Any]:
        """
        Get available parameter updates
        
        Returns:
            Dictionary of parameter updates
        """
        if not os.path.exists(self.updates_file):
            return {}
        
        try:
            with open(self.updates_file, 'r') as f:
                updates = json.load(f)
            
            self.last_update_time = os.path.getmtime(self.updates_file)
            return updates
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Error getting updates: {e}")
            return {}
    
    def acknowledge_updates(self) -> None:
        """
        Acknowledge that updates have been applied
        """
        try:
            # Get current parameters
            current_params = {}
            if os.path.exists(self.current_file):
                with open(self.current_file, 'r') as f:
                    current_params = json.load(f)
            
            # Get updates
            updates = {}
            if os.path.exists(self.updates_file):
                with open(self.updates_file, 'r') as f:
                    updates = json.load(f)
            
            # Apply updates to current parameters
            current_params.update(updates)
            
            # Save updated current parameters
            with open(self.current_file, 'w') as f:
                json.dump(current_params, f, indent=2)
            
            # Clear updates
            with open(self.updates_file, 'w') as f:
                json.dump({}, f, indent=2)
            
            self.last_update_time = os.path.getmtime(self.updates_file)
            
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Error acknowledging updates: {e}")
    
    def report_current_parameters(self, params: Dict[str, Any]) -> None:
        """
        Report the current parameters
        
        Args:
            params: Dictionary of current parameters
        """
        try:
            with open(self.current_file, 'w') as f:
                json.dump(params, f, indent=2)
        except IOError as e:
            logger.error(f"Error reporting current parameters: {e}")


class SupabaseParameterManager(ParameterManager):
    """
    Supabase-based parameter manager implementation
    
    This class implements parameter management using Supabase for storage.
    """
    
    def __init__(self, job_id: str, supabase_url: str, supabase_key: str):
        """
        Initialize the Supabase parameter manager
        
        Args:
            job_id: Unique identifier for the training job
            supabase_url: Supabase URL
            supabase_key: Supabase API key
        """
        super().__init__(job_id)
        self.job_id = job_id
        self.last_update_time = 0
        self.last_update_id = None
        self.table_name = 'training_parameters'
        
        try:
            from supabase import create_client
            self.supabase = create_client(supabase_url, supabase_key)
            logger.info(f"Supabase client initialized for parameter management")
        except ImportError:
            logger.error("supabase-py not installed. Install with: pip install supabase")
            raise ImportError("supabase-py not installed. Install with: pip install supabase")
        except Exception as e:
            logger.error(f"Error initializing Supabase client: {e}")
            raise

    def has_updates(self) -> bool:
        """
        Check if there are parameter updates available
        
        Returns:
            True if updates are available, False otherwise
        """
        try:
            current_time = time.time()
            
            # Only check for updates every 5 seconds to avoid excessive API calls
            if current_time - self.last_update_time < 5:
                return False
            
            # Query for updates that haven't been acknowledged
            response = self.supabase.table(self.table_name).select('*').eq('job_id', self.job_id).eq('status', 'pending').execute()
            
            # Check if there are any updates
            result = response.data
            has_updates = len(result) > 0
            
            self.last_update_time = current_time
            return has_updates
            
        except Exception as e:
            logger.error(f"Error checking for updates: {e}")
            return False
    
    def get_updates(self) -> Dict[str, Any]:
        """
        Get available parameter updates
        
        Returns:
            Dictionary of parameter updates
        """
        try:
            # Query for updates that haven't been acknowledged
            response = self.supabase.table(self.table_name).select('*').eq('job_id', self.job_id).eq('status', 'pending').order('created_at', desc=False).limit(1).execute()
            
            # Check if there are any updates
            if not response.data:
                return {}
            
            update = response.data[0]
            self.last_update_id = update.get('id')
            parameters = update.get('parameters', {})
            
            return parameters
            
        except Exception as e:
            logger.error(f"Error getting updates: {e}")
            return {}
    
    def acknowledge_updates(self) -> None:
        """
        Acknowledge that updates have been applied
        """
        if not self.last_update_id:
            return
        
        try:
            # Update the status of the update
            self.supabase.table(self.table_name).update({'status': 'applied', 'applied_at': int(time.time() * 1000)}).eq('id', self.last_update_id).execute()
            self.last_update_id = None
            
        except Exception as e:
            logger.error(f"Error acknowledging updates: {e}")
    
    def report_current_parameters(self, params: Dict[str, Any]) -> None:
        """
        Report the current parameters
        
        Args:
            params: Dictionary of current parameters
        """
        try:
            # Check if there's an entry for the current parameters
            response = self.supabase.table(self.table_name).select('id').eq('job_id', self.job_id).eq('type', 'current').execute()
            
            current_time = int(time.time() * 1000)
            
            if response.data:
                # Update existing entry
                self.supabase.table(self.table_name).update({
                    'parameters': params,
                    'updated_at': current_time
                }).eq('id', response.data[0]['id']).execute()
            else:
                # Create new entry
                self.supabase.table(self.table_name).insert({
                    'job_id': self.job_id,
                    'type': 'current',
                    'parameters': params,
                    'status': 'active',
                    'created_at': current_time,
                    'updated_at': current_time
                }).execute()
            
        except Exception as e:
            logger.error(f"Error reporting current parameters: {e}")


def create_parameter_manager(job_id: str, storage_type: str = 'file', 
                             supabase_url: Optional[str] = None, 
                             supabase_key: Optional[str] = None,
                             base_dir: str = './params') -> ParameterManager:
    """
    Create a parameter manager based on the specified storage type
    
    Args:
        job_id: Unique identifier for the training job
        storage_type: Type of storage to use ('file' or 'supabase')
        supabase_url: Supabase URL (required if storage_type is 'supabase')
        supabase_key: Supabase API key (required if storage_type is 'supabase')
        base_dir: Base directory for file-based parameter storage
        
    Returns:
        A parameter manager instance
        
    Raises:
        ValueError: If supabase_url or supabase_key is not provided for 'supabase' storage type
    """
    if storage_type == 'supabase':
        if not supabase_url or not supabase_key:
            raise ValueError("supabase_url and supabase_key are required for supabase storage type")
        return SupabaseParameterManager(job_id, supabase_url, supabase_key)
    else:
        return FileBasedParameterManager(job_id, base_dir)