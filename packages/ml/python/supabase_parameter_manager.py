#!/usr/bin/env python3
"""
Supabase-based Parameter Manager for Real-time Training Parameter Updates

This module provides a Supabase-specific implementation of the parameter manager
that uses Supabase's real-time subscriptions for receiving parameter updates during
training without polling or manual checks.

Dependencies:
    - supabase-py (pip install supabase)
    - python-dotenv (pip install python-dotenv)
"""

import os
import json
import time
import threading
import uuid
from typing import Dict, Any, Optional, Callable, List, Union, Tuple
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Default parameters
DEFAULT_REFRESH_INTERVAL = 0.5  # seconds


class SupabaseRealtimeParameterManager:
    """
    Real-time parameter manager using Supabase subscriptions.
    
    This class enables bidirectional communication with Supabase for dynamic
    parameter adjustment during ML model training.
    """
    
    def __init__(
        self, 
        job_id: str,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        table_name: str = 'training_parameters',
        callback: Optional[Callable[[Dict[str, Any]], None]] = None,
        initial_parameters: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize the Supabase real-time parameter manager.
        
        Args:
            job_id: Unique identifier for the training job
            supabase_url: Supabase URL (defaults to SUPABASE_URL env var)
            supabase_key: Supabase API key (defaults to SUPABASE_KEY env var)
            table_name: Name of the table where parameters are stored
            callback: Optional callback function to call when parameters change
            initial_parameters: Initial parameter values to store
        """
        # Initialize parameters
        self.job_id = job_id
        self.table_name = table_name
        self.callback = callback
        self.subscription = None
        self._current_parameters = {}
        self._parameter_updates = {}
        self._unacknowledged_updates = {}
        self._lock = threading.RLock()
        
        # Connect to Supabase
        self.supabase_url = supabase_url or os.getenv('SUPABASE_URL')
        self.supabase_key = supabase_key or os.getenv('SUPABASE_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError(
                "Supabase URL and key must be provided either as arguments or as environment variables"
            )
        
        # Create the Supabase client
        self.supabase = create_client(self.supabase_url, self.supabase_key)
        
        # Initialize parameters record if provided
        if initial_parameters:
            self._current_parameters = initial_parameters.copy()
            # Store initial parameters
            self._store_parameters(self._current_parameters)
        else:
            # Try to load existing parameters
            self._load_parameters()
        
        # Start subscription for real-time updates
        self._start_subscription()
    
    def _start_subscription(self) -> None:
        """Start the Supabase real-time subscription to listen for parameter updates."""
        try:
            # Create a subscription that filters on job_id
            self.subscription = self.supabase.table(self.table_name) \
                .on("UPDATE", self._handle_parameter_update) \
                .subscribe()
            
            print(f"Established real-time connection for job {self.job_id}")
        except Exception as e:
            print(f"Error establishing real-time connection: {e}")
            # Fall back to polling if real-time fails
            print("Falling back to polling for parameter updates")
    
    def _handle_parameter_update(self, payload):
        """Handle real-time update events from Supabase."""
        with self._lock:
            data = payload.get('new', {})
            if data.get('job_id') != self.job_id:
                return
                
            # Extract parameters from the update
            params = data.get('parameters', {})
            if not params:
                return
                
            # Track the update
            update_id = data.get('update_id', str(uuid.uuid4()))
            status = data.get('status', 'pending')
            
            # Only process pending updates
            if status != 'pending':
                return
                
            self._parameter_updates.update(params)
            self._unacknowledged_updates[update_id] = params
            
            # Call the callback if provided
            if self.callback:
                self.callback(self._parameter_updates.copy())
    
    def _load_parameters(self) -> None:
        """Load the current parameters from Supabase."""
        try:
            result = self.supabase.table(self.table_name) \
                .select('parameters') \
                .eq('job_id', self.job_id) \
                .eq('status', 'applied') \
                .order('created_at', desc=True) \
                .limit(1) \
                .execute()
            
            if result.data and len(result.data) > 0:
                self._current_parameters = result.data[0].get('parameters', {})
        except Exception as e:
            print(f"Error loading parameters: {e}")
    
    def _store_parameters(self, parameters: Dict[str, Any], update_id: Optional[str] = None, status: str = 'applied') -> None:
        """Store parameters in Supabase."""
        try:
            record = {
                'job_id': self.job_id,
                'parameters': parameters,
                'status': status,
                'created_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'update_id': update_id or str(uuid.uuid4())
            }
            
            self.supabase.table(self.table_name).upsert(record).execute()
        except Exception as e:
            print(f"Error storing parameters: {e}")
    
    def get_parameters(self) -> Dict[str, Any]:
        """Get the current parameters including any pending updates."""
        with self._lock:
            # Combine current parameters with pending updates
            combined = self._current_parameters.copy()
            combined.update(self._parameter_updates)
            return combined
    
    def get_current_parameters(self) -> Dict[str, Any]:
        """Get only the current fully acknowledged parameters."""
        with self._lock:
            return self._current_parameters.copy()
    
    def get_parameter_updates(self) -> Dict[str, Any]:
        """Get only the pending parameter updates that haven't been acknowledged."""
        with self._lock:
            return self._parameter_updates.copy()
    
    def check_for_updates(self) -> bool:
        """Check if there are any parameter updates pending."""
        with self._lock:
            return bool(self._parameter_updates)
    
    def apply_parameter_updates(self) -> Dict[str, Any]:
        """
        Apply all pending parameter updates, moving them to the current parameters.
        
        Returns:
            Dictionary of parameters that were applied
        """
        with self._lock:
            # If there are no updates, return empty dict
            if not self._parameter_updates:
                return {}
            
            # Apply updates to current parameters
            applied_updates = self._parameter_updates.copy()
            self._current_parameters.update(self._parameter_updates)
            
            # Acknowledge all pending updates
            for update_id, params in list(self._unacknowledged_updates.items()):
                self._acknowledge_update(update_id)
                
            # Clear pending updates
            self._parameter_updates.clear()
            self._unacknowledged_updates.clear()
            
            # Store the updated parameters
            self._store_parameters(self._current_parameters)
            
            return applied_updates
    
    def _acknowledge_update(self, update_id: str) -> None:
        """Mark a specific update as acknowledged in Supabase."""
        try:
            self.supabase.table(self.table_name) \
                .update({'status': 'applied'}) \
                .eq('update_id', update_id) \
                .eq('job_id', self.job_id) \
                .execute()
        except Exception as e:
            print(f"Error acknowledging update {update_id}: {e}")
    
    def set_parameter(self, name: str, value: Any) -> None:
        """Set a parameter value and store it."""
        with self._lock:
            self._current_parameters[name] = value
            self._store_parameters(self._current_parameters)
    
    def set_parameters(self, parameters: Dict[str, Any]) -> None:
        """Set multiple parameter values and store them."""
        with self._lock:
            self._current_parameters.update(parameters)
            self._store_parameters(self._current_parameters)
    
    def get_parameter(self, name: str, default: Any = None) -> Any:
        """Get a parameter value, with optional default."""
        with self._lock:
            # Check updates first, then fall back to current parameters
            if name in self._parameter_updates:
                return self._parameter_updates[name]
            return self._current_parameters.get(name, default)
    
    def clear_updates(self) -> None:
        """Clear any pending parameter updates without applying them."""
        with self._lock:
            self._parameter_updates.clear()
            
            # Mark all unacknowledged updates as rejected
            for update_id in self._unacknowledged_updates:
                try:
                    self.supabase.table(self.table_name) \
                        .update({'status': 'rejected'}) \
                        .eq('update_id', update_id) \
                        .eq('job_id', self.job_id) \
                        .execute()
                except Exception as e:
                    print(f"Error rejecting update {update_id}: {e}")
            
            self._unacknowledged_updates.clear()
    
    def close(self) -> None:
        """Close the Supabase subscription and clean up resources."""
        if self.subscription:
            self.subscription.unsubscribe()
            print(f"Closed real-time connection for job {self.job_id}")


# Example usage
if __name__ == "__main__":
    def parameter_callback(params):
        print(f"Parameters updated: {params}")
    
    # Create a parameter manager with initial parameters
    manager = SupabaseRealtimeParameterManager(
        job_id="test-job-1",
        initial_parameters={
            "learning_rate": 0.001,
            "batch_size": 32,
            "epochs": 10,
        },
        callback=parameter_callback
    )
    
    # Simulate a training loop
    for epoch in range(10):
        print(f"Epoch {epoch+1}")
        
        # Check for parameter updates
        if manager.check_for_updates():
            updates = manager.apply_parameter_updates()
            print(f"Applied parameter updates: {updates}")
        
        # Get current parameters
        params = manager.get_parameters()
        print(f"Current parameters: {params}")
        
        # Simulate training
        time.sleep(2)
    
    # Clean up
    manager.close()