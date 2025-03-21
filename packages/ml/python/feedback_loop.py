#!/usr/bin/env python3
"""
Feedback Loop System for Material Recognition

This script implements a system to collect, store, and utilize user feedback
to improve material recognition accuracy over time through:
1. Storing recognition results and user feedback in Supabase
2. Adjusting confidence scores based on feedback
3. Retraining models with corrected data
4. Tracking performance metrics over time

Usage:
    python feedback_loop.py <command> [options]

Commands:
    store      Store recognition result and user feedback
    adjust     Adjust confidence scores based on feedback
    retrain    Retrain models using feedback data
    metrics    Get performance metrics

Options:
    --data-dir            Directory for feedback data storage
    --model-dir           Directory for model storage
    --recognition-id      ID of the recognition result
    --feedback-type       Type of feedback (correct, incorrect, partial)
    --material-id         Actual material ID (for corrections)
    --confidence-threshold Threshold for confidence adjustment
"""

import os
import sys
import json
import time
import argparse
import numpy as np
from typing import Dict, List, Any, Tuple, Optional, Union
from datetime import datetime
import hashlib
import uuid
import requests
from sklearn.metrics import confusion_matrix, accuracy_score, precision_recall_fscore_support

# Import module for parameter management from Supabase
try:
    from supabase_parameter_manager import SupabaseParameterManager
except ImportError:
    # Create a simple mock if the actual implementation is not available
    class SupabaseParameterManager:
        def __init__(self, *args, **kwargs):
            print("Warning: Using mock SupabaseParameterManager")
            self.url = kwargs.get('url', 'https://example.supabase.co')
            self.key = kwargs.get('key', 'mock_key')
            self.storage_bucket = kwargs.get('storage_bucket', 'models')
        
        def get_parameter(self, key, default=None):
            return default
        
        def set_parameter(self, key, value):
            pass

# Import model training functionality
try:
    from train_neural_network import train_model_with_additional_data
except ImportError:
    # Mock function if actual implementation is not available
    def train_model_with_additional_data(*args, **kwargs):
        print("Warning: train_model_with_additional_data is not available")
        return {"status": "error", "message": "Training function not available"}


class SupabaseClient:
    """Simple client for interacting with Supabase from Python"""
    
    def __init__(self, supabase_url: str, supabase_key: str):
        """
        Initialize the Supabase client
        
        Args:
            supabase_url: Supabase project URL
            supabase_key: Supabase API key
        """
        self.url = supabase_url
        self.key = supabase_key
        self.headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
    
    def insert(self, table_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Insert data into a table
        
        Args:
            table_name: Name of the table
            data: Data to insert
            
        Returns:
            Response from Supabase
        """
        url = f"{self.url}/rest/v1/{table_name}"
        response = requests.post(url, headers=self.headers, json=data)
        
        if response.status_code >= 300:
            raise Exception(f"Failed to insert data: {response.text}")
        
        return response.json()
    
    def update(self, table_name: str, data: Dict[str, Any], query: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update data in a table
        
        Args:
            table_name: Name of the table
            data: Data to update
            query: Query parameters
            
        Returns:
            Response from Supabase
        """
        url = f"{self.url}/rest/v1/{table_name}"
        
        # Convert query to URL parameters
        params = {}
        for key, value in query.items():
            params[key] = f"eq.{value}"
        
        response = requests.patch(url, headers=self.headers, params=params, json=data)
        
        if response.status_code >= 300:
            raise Exception(f"Failed to update data: {response.text}")
        
        return response.json()
    
    def select(self, table_name: str, columns: str = "*", query: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Select data from a table
        
        Args:
            table_name: Name of the table
            columns: Columns to select
            query: Query parameters
            
        Returns:
            List of rows from Supabase
        """
        url = f"{self.url}/rest/v1/{table_name}"
        
        headers = self.headers.copy()
        headers["Accept"] = "application/json"
        
        params = {"select": columns}
        
        # Add query parameters
        if query:
            for key, value in query.items():
                if isinstance(value, str) and not value.startswith("eq."):
                    params[key] = f"eq.{value}"
                else:
                    params[key] = value
        
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code >= 300:
            raise Exception(f"Failed to select data: {response.text}")
        
        return response.json()
    
    def rpc(self, function_name: str, params: Dict[str, Any] = None) -> Any:
        """
        Call a Postgres function
        
        Args:
            function_name: Name of the function
            params: Function parameters
            
        Returns:
            Result from the function call
        """
        url = f"{self.url}/rest/v1/rpc/{function_name}"
        
        response = requests.post(url, headers=self.headers, json=params or {})
        
        if response.status_code >= 300:
            raise Exception(f"Failed to call function: {response.text}")
        
        return response.json()
    
    def upload_file(self, bucket: str, path: str, file_path: str) -> Dict[str, Any]:
        """
        Upload a file to Supabase Storage
        
        Args:
            bucket: Storage bucket name
            path: Path within the bucket
            file_path: Local file path
            
        Returns:
            Response from Supabase
        """
        url = f"{self.url}/storage/v1/object/{bucket}/{path}"
        
        headers = self.headers.copy()
        headers.pop("Content-Type", None)  # Let requests set the correct content type
        
        with open(file_path, 'rb') as f:
            response = requests.post(url, headers=headers, data=f)
        
        if response.status_code >= 300:
            raise Exception(f"Failed to upload file: {response.text}")
        
        return response.json()
    
    def download_file(self, bucket: str, path: str, output_path: str) -> bool:
        """
        Download a file from Supabase Storage
        
        Args:
            bucket: Storage bucket name
            path: Path within the bucket
            output_path: Local output path
            
        Returns:
            True if successful
        """
        url = f"{self.url}/storage/v1/object/{bucket}/{path}"
        
        response = requests.get(url, headers=self.headers)
        
        if response.status_code >= 300:
            raise Exception(f"Failed to download file: {response.text}")
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Write the file
        with open(output_path, 'wb') as f:
            f.write(response.content)
        
        return True


class FeedbackLoopSystem:
    """
    System for managing feedback data and improving recognition over time
    """
    
    def __init__(self, data_dir: str, model_dir: str = None, 
                supabase_url: str = None, supabase_key: str = None):
        """
        Initialize the feedback loop system
        
        Args:
            data_dir: Directory for feedback data storage
            model_dir: Directory for model storage (if None, uses data_dir/models)
            supabase_url: Supabase project URL (if None, uses environment variable)
            supabase_key: Supabase API key (if None, uses environment variable)
        """
        self.data_dir = data_dir
        self.model_dir = model_dir if model_dir else os.path.join(data_dir, "models")
        
        # Ensure directories exist
        os.makedirs(data_dir, exist_ok=True)
        os.makedirs(self.model_dir, exist_ok=True)
        
        # Get Supabase credentials from environment if not provided
        self.supabase_url = supabase_url or os.environ.get('SUPABASE_URL')
        self.supabase_key = supabase_key or os.environ.get('SUPABASE_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Supabase URL and key must be provided or set in environment variables")
        
        # Initialize Supabase client
        self.supabase = SupabaseClient(self.supabase_url, self.supabase_key)
        
        # Initialize parameter manager
        self.param_manager = SupabaseParameterManager(
            url=self.supabase_url, 
            key=self.supabase_key,
            storage_bucket="models"
        )
    
    def store_recognition_result(self, result: Dict[str, Any], image_path: str,
                                model_type: str, confidence_threshold: float,
                                processing_time: float) -> str:
        """
        Store a recognition result in Supabase
        
        Args:
            result: Recognition result dictionary
            image_path: Path to the input image
            model_type: Type of model used
            confidence_threshold: Confidence threshold used
            processing_time: Processing time in seconds
            
        Returns:
            ID of the stored recognition result
        """
        # Generate a unique ID for the recognition result
        result_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        # Prepare data for insertion
        data = {
            "id": result_id,
            "timestamp": timestamp,
            "image_path": image_path,
            "model_type": model_type,
            "confidence_threshold": confidence_threshold,
            "processing_time": processing_time,
            "result_json": json.dumps(result)
        }
        
        # Insert into recognition_results table
        self.supabase.insert("recognition_results", data)
        
        return result_id
    
    def store_feedback(self, recognition_id: str, feedback_type: str,
                      correct_material_id: str = None, user_notes: str = None) -> str:
        """
        Store user feedback for a recognition result
        
        Args:
            recognition_id: ID of the recognition result
            feedback_type: Type of feedback (correct, incorrect, partial)
            correct_material_id: Actual material ID (for corrections)
            user_notes: Additional notes from the user
            
        Returns:
            ID of the stored feedback
        """
        # Verify recognition_id exists
        results = self.supabase.select(
            "recognition_results", 
            "id", 
            {"id": recognition_id}
        )
        
        if not results:
            raise ValueError(f"Recognition result with ID {recognition_id} not found")
        
        # Generate a unique ID for the feedback
        feedback_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        # Prepare data for insertion
        data = {
            "id": feedback_id,
            "recognition_id": recognition_id,
            "timestamp": timestamp,
            "feedback_type": feedback_type,
            "correct_material_id": correct_material_id,
            "user_notes": user_notes
        }
        
        # Insert into feedback table
        self.supabase.insert("feedback", data)
        
        # If feedback indicates incorrect recognition, update confidence adjustments
        if feedback_type in ["incorrect", "partial"] and correct_material_id:
            self._update_confidence_adjustments(recognition_id, correct_material_id)
        
        return feedback_id
    
    def _update_confidence_adjustments(self, recognition_id: str, correct_material_id: str):
        """
        Update confidence adjustments based on feedback
        
        Args:
            recognition_id: ID of the recognition result
            correct_material_id: Correct material ID
        """
        # Get the recognition result
        results = self.supabase.select(
            "recognition_results", 
            "result_json", 
            {"id": recognition_id}
        )
        
        if not results:
            return
        
        # Parse the result JSON
        result = json.loads(results[0]["result_json"])
        matches = result.get("matches", [])
        
        # Find all incorrect matches
        incorrect_materials = []
        for match in matches:
            if match["materialId"] != correct_material_id:
                incorrect_materials.append(match["materialId"])
        
        # Update adjustment factors
        timestamp = datetime.now().isoformat()
        
        # Positive adjustment for correct material
        self._adjust_confidence_factor(correct_material_id, 0.05, timestamp)
        
        # Negative adjustment for incorrect materials
        for material_id in incorrect_materials:
            self._adjust_confidence_factor(material_id, -0.03, timestamp)
    
    def _adjust_confidence_factor(self, material_id: str, adjustment: float, timestamp: str):
        """
        Adjust confidence factor for a material
        
        Args:
            material_id: Material ID
            adjustment: Adjustment value (positive or negative)
            timestamp: Timestamp for the update
        """
        # Check if material exists in adjustments table
        results = self.supabase.select(
            "confidence_adjustments", 
            "adjustment_factor,feedback_count", 
            {"material_id": material_id}
        )
        
        if results:
            # Update existing record
            record = results[0]
            current_factor = record["adjustment_factor"]
            feedback_count = record["feedback_count"]
            new_count = feedback_count + 1
            
            # Calculate weighted adjustment (more weight to historical data as count increases)
            weight = min(0.9, feedback_count / (feedback_count + 10))
            new_factor = current_factor * weight + adjustment * (1 - weight)
            
            # Ensure factor stays in reasonable range
            new_factor = max(-0.5, min(0.5, new_factor))
            
            # Update record
            self.supabase.update(
                "confidence_adjustments",
                {
                    "adjustment_factor": new_factor,
                    "last_updated": timestamp,
                    "feedback_count": new_count
                },
                {"material_id": material_id}
            )
        else:
            # Insert new record
            adjustment_id = str(uuid.uuid4())
            self.supabase.insert(
                "confidence_adjustments",
                {
                    "id": adjustment_id,
                    "material_id": material_id,
                    "adjustment_factor": adjustment,
                    "last_updated": timestamp,
                    "feedback_count": 1
                }
            )
    
    def get_confidence_adjustments(self) -> Dict[str, float]:
        """
        Get confidence adjustment factors for all materials
        
        Returns:
            Dictionary mapping material IDs to adjustment factors
        """
        results = self.supabase.select(
            "confidence_adjustments", 
            "material_id,adjustment_factor"
        )
        
        return {row["material_id"]: row["adjustment_factor"] for row in results}
    
    def adjust_recognition_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Adjust a recognition result using learned confidence adjustments
        
        Args:
            result: Original recognition result
            
        Returns:
            Adjusted recognition result
        """
        # Get confidence adjustments
        adjustments = self.get_confidence_adjustments()
        
        if not adjustments:
            return result
        
        # Create a copy of the result
        adjusted_result = result.copy()
        matches = adjusted_result.get("matches", [])
        
        # Apply adjustments to matches
        for match in matches:
            material_id = match["materialId"]
            if material_id in adjustments:
                # Apply adjustment factor
                original_confidence = match["confidence"]
                adjustment = adjustments[material_id]
                
                # Adjust confidence (ensuring it stays in [0,1] range)
                adjusted_confidence = max(0.0, min(1.0, original_confidence + adjustment))
                
                # Update match with adjusted confidence
                match["confidence"] = adjusted_confidence
                
                # Add adjustment information to features
                if "features" not in match:
                    match["features"] = {}
                
                match["features"]["confidence_adjustment"] = {
                    "original": original_confidence,
                    "adjustment": adjustment,
                    "adjusted": adjusted_confidence
                }
        
        # Re-sort matches by adjusted confidence
        adjusted_result["matches"] = sorted(matches, key=lambda x: x["confidence"], reverse=True)
        
        # Add metadata about adjustment
        if "adjustments_applied" not in adjusted_result:
            adjusted_result["adjustments_applied"] = {
                "count": len(adjustments),
                "timestamp": datetime.now().isoformat()
            }
        
        return adjusted_result
    
    def collect_training_data(self, min_feedback_count: int = 10) -> Dict[str, Any]:
        """
        Collect training data from feedback for model retraining
        
        Args:
            min_feedback_count: Minimum number of feedback items to collect
            
        Returns:
            Dictionary with training data
        """
        # Query for recognition results with feedback
        results = self.supabase.select(
            "feedback",
            "recognition_id,feedback_type,correct_material_id",
            {
                "feedback_type": "in.(incorrect,partial)",
                "order": "timestamp.desc"
            }
        )
        
        if len(results) < min_feedback_count:
            return {
                "status": "insufficient_data",
                "count": len(results),
                "min_required": min_feedback_count
            }
        
        # Process results to extract training data
        training_data = []
        
        for row in results:
            # Get the recognition result
            recognition_results = self.supabase.select(
                "recognition_results",
                "image_path,result_json",
                {"id": row["recognition_id"]}
            )
            
            if not recognition_results:
                continue
            
            recognition_result = recognition_results[0]
            image_path = recognition_result["image_path"]
            
            # Skip if image doesn't exist
            if not os.path.exists(image_path):
                continue
            
            # Add to training data
            training_data.append({
                "recognition_id": row["recognition_id"],
                "image_path": image_path,
                "correct_material_id": row["correct_material_id"],
                "feedback_type": row["feedback_type"]
            })
        
        return {
            "status": "success",
            "count": len(training_data),
            "data": training_data
        }
    
    def retrain_model(self, model_type: str = "hybrid", min_feedback_count: int = 10) -> Dict[str, Any]:
        """
        Retrain model using feedback data
        
        Args:
            model_type: Type of model to retrain
            min_feedback_count: Minimum number of feedback items to use
            
        Returns:
            Dictionary with retraining results
        """
        # Collect training data
        training_data_result = self.collect_training_data(min_feedback_count)
        
        if training_data_result["status"] != "success":
            return training_data_result
        
        training_data = training_data_result["data"]
        
        # Create temporary directory for training data organization
        temp_dir = os.path.join(self.data_dir, "temp_training_data")
        os.makedirs(temp_dir, exist_ok=True)
        
        # Organize data by material ID
        material_dirs = {}
        for item in training_data:
            material_id = item["correct_material_id"]
            
            if material_id not in material_dirs:
                material_dir = os.path.join(temp_dir, material_id)
                os.makedirs(material_dir, exist_ok=True)
                material_dirs[material_id] = material_dir
            
            # Create a symbolic link or copy to the image
            dest_path = os.path.join(
                material_dirs[material_id],
                f"{os.path.basename(item['recognition_id'])}_{os.path.basename(item['image_path'])}"
            )
            
            try:
                # Try creating a symbolic link first
                if os.path.exists(dest_path):
                    os.remove(dest_path)
                
                os.symlink(item["image_path"], dest_path)
            except (OSError, AttributeError):
                # Fall back to copying if symlink fails
                import shutil
                shutil.copy2(item["image_path"], dest_path)
        
        # Generate a new model path
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_path = os.path.join(self.model_dir, f"{model_type}_model_{timestamp}")
        
        # Call retraining function
        start_time = time.time()
        training_result = train_model_with_additional_data(
            temp_dir,
            model_path,
            model_type=model_type
        )
        training_time = time.time() - start_time
        
        # Record training history
        if training_result.get("status") == "success":
            # Prepare data for insertion
            training_id = str(uuid.uuid4())
            timestamp = datetime.now().isoformat()
            
            self.supabase.insert(
                "training_history",
                {
                    "id": training_id,
                    "timestamp": timestamp,
                    "model_type": model_type,
                    "dataset_size": len(training_data),
                    "accuracy": training_result.get("accuracy", 0.0),
                    "precision": training_result.get("precision", 0.0),
                    "recall": training_result.get("recall", 0.0),
                    "f1_score": training_result.get("f1_score", 0.0),
                    "training_time": training_time,
                    "model_path": model_path
                }
            )
            
            # Upload model to Supabase Storage
            model_files = [f for f in os.listdir(model_path) if os.path.isfile(os.path.join(model_path, f))]
            for file in model_files:
                file_path = os.path.join(model_path, file)
                storage_path = f"models/{model_type}/{timestamp}/{file}"
                
                try:
                    self.supabase.upload_file("models", storage_path, file_path)
                except Exception as e:
                    print(f"Warning: Failed to upload model file {file}: {e}")
        
        # Clean up temporary directory
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        return {
            "status": training_result.get("status", "unknown"),
            "model_path": model_path,
            "training_time": training_time,
            "dataset_size": len(training_data),
            "metrics": {
                "accuracy": training_result.get("accuracy", 0.0),
                "precision": training_result.get("precision", 0.0),
                "recall": training_result.get("recall", 0.0),
                "f1_score": training_result.get("f1_score", 0.0)
            }
        }
    
    def get_latest_model_path(self, model_type: str = "hybrid") -> Optional[str]:
        """
        Get path to the latest trained model
        
        Args:
            model_type: Type of model
            
        Returns:
            Path to the latest model or None if not found
        """
        results = self.supabase.select(
            "training_history",
            "model_path",
            {
                "model_type": model_type,
                "order": "timestamp.desc",
                "limit": 1
            }
        )
        
        return results[0]["model_path"] if results else None
    
    def get_performance_metrics(self, time_period: str = "all") -> Dict[str, Any]:
        """
        Get performance metrics for the recognition system
        
        Args:
            time_period: Time period for metrics (day, week, month, year, all)
            
        Returns:
            Dictionary with performance metrics
        """
        # Determine date filter based on time period
        date_filter = ""
        if time_period == "day":
            date_filter = "timestamp.gte.now()-interval.1.day"
        elif time_period == "week":
            date_filter = "timestamp.gte.now()-interval.7.days"
        elif time_period == "month":
            date_filter = "timestamp.gte.now()-interval.30.days"
        elif time_period == "year":
            date_filter = "timestamp.gte.now()-interval.365.days"
        
        # Get feedback statistics
        if date_filter:
            results = self.supabase.select(
                "feedback",
                "feedback_type",
                {date_filter: True}
            )
        else:
            results = self.supabase.select(
                "feedback",
                "feedback_type"
            )
        
        # Count feedback types
        feedback_stats = {}
        for row in results:
            feedback_type = row["feedback_type"]
            feedback_stats[feedback_type] = feedback_stats.get(feedback_type, 0) + 1
        
        # Calculate accuracy
        total_feedback = sum(feedback_stats.values())
        correct_count = feedback_stats.get("correct", 0)
        accuracy = correct_count / total_feedback if total_feedback > 0 else 0
        
        # Use RPC to get advanced metrics
        metrics = {
            "time_period": time_period,
            "total_recognitions": total_feedback,
            "feedback_distribution": feedback_stats,
            "accuracy": accuracy,
            "timestamp": datetime.now().isoformat()
        }
        
        # For advanced metrics that would be better calculated in the database,
        # we would use RPC calls to Supabase functions. For simplicity in this example,
        # we'll just return the basic metrics.
        
        return metrics
    
    def get_learning_curve(self) -> Dict[str, Any]:
        """
        Get the learning curve showing improvement over time
        
        Returns:
            Dictionary with learning curve data
        """
        # Get accuracy over time from training history
        training_results = self.supabase.select(
            "training_history",
            "timestamp,accuracy,dataset_size",
            {"order": "timestamp.asc"}
        )
        
        training_data = [
            {
                "timestamp": row["timestamp"],
                "accuracy": row["accuracy"],
                "dataset_size": row["dataset_size"]
            }
            for row in training_results
        ]
        
        # Get monthly accuracy from feedback using RPC
        # This would typically be a function in Supabase
        # For simplicity, we'll just return the training history
        
        return {
            "training_history": training_data,
            "timestamp": datetime.now().isoformat()
        }


def handle_store_command(args):
    """Handle the 'store' command"""
    if not args.recognition_id or not args.feedback_type:
        print("Error: recognition_id and feedback_type are required", file=sys.stderr)
        return 1
    
    # Initialize feedback system
    feedback_system = FeedbackLoopSystem(args.data_dir)
    
    try:
        # Store feedback
        feedback_id = feedback_system.store_feedback(
            args.recognition_id,
            args.feedback_type,
            args.material_id,
            args.notes
        )
        
        print(json.dumps({
            "status": "success",
            "feedback_id": feedback_id
        }, indent=2))
        
        return 0
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        return 1


def handle_adjust_command(args):
    """Handle the 'adjust' command"""
    if not args.result_file:
        print("Error: result_file is required", file=sys.stderr)
        return 1
    
    # Load the result file
    try:
        with open(args.result_file, 'r') as f:
            result = json.load(f)
    except Exception as e:
        print(f"Error loading result file: {str(e)}", file=sys.stderr)
        return 1
    
    # Initialize feedback system
    feedback_system = FeedbackLoopSystem(args.data_dir)
    
    # Adjust recognition result
    adjusted_result = feedback_system.adjust_recognition_result(result)
    
    # Output adjusted result
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(adjusted_result, f, indent=2)
        print(f"Adjusted result saved to {args.output}")
    else:
        print(json.dumps(adjusted_result, indent=2))
    
    return 0


def handle_retrain_command(args):
    """Handle the 'retrain' command"""
    # Initialize feedback system
    feedback_system = FeedbackLoopSystem(args.data_dir, args.model_dir)
    
    # Retrain model
    result = feedback_system.retrain_model(
        model_type=args.model_type,
        min_feedback_count=args.min_feedback
    )
    
    # Output result
    print(json.dumps(result, indent=2))
    
    return 0 if result.get("status") == "success" else 1


def handle_metrics_command(args):
    """Handle the 'metrics' command"""
    # Initialize feedback system
    feedback_system = FeedbackLoopSystem(args.data_dir)
    
    # Get metrics
    if args.learning_curve:
        metrics = feedback_system.get_learning_curve()
    else:
        metrics = feedback_system.get_performance_metrics(args.time_period)
    
    # Output metrics
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(metrics, f, indent=2)
        print(f"Metrics saved to {args.output}")
    else:
        print(json.dumps(metrics, indent=2))
    
    return 0


def main():
    """Main function to parse arguments and run commands"""
    parser = argparse.ArgumentParser(description="Feedback loop system for material recognition")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Common arguments
    data_dir_arg = lambda p: p.add_argument("--data-dir", default="./feedback_data",
                                          help="Directory for feedback data storage")
    
    # Store command
    store_parser = subparsers.add_parser("store", help="Store recognition result and user feedback")
    data_dir_arg(store_parser)
    store_parser.add_argument("--recognition-id", required=True,
                             help="ID of the recognition result")
    store_parser.add_argument("--feedback-type", required=True,
                             choices=["correct", "incorrect", "partial"],
                             help="Type of feedback")
    store_parser.add_argument("--material-id",
                             help="Actual material ID (for corrections)")
    store_parser.add_argument("--notes",
                             help="Additional notes from the user")
    
    # Adjust command
    adjust_parser = subparsers.add_parser("adjust", help="Adjust confidence scores based on feedback")
    data_dir_arg(adjust_parser)
    adjust_parser.add_argument("--result-file", required=True,
                              help="JSON file with recognition result")
    adjust_parser.add_argument("--output",
                              help="Output file for adjusted result (defaults to stdout)")
    
    # Retrain command
    retrain_parser = subparsers.add_parser("retrain", help="Retrain models using feedback data")
    data_dir_arg(retrain_parser)
    retrain_parser.add_argument("--model-dir",
                               help="Directory for model storage")
    retrain_parser.add_argument("--model-type", default="hybrid",
                               choices=["hybrid", "feature-based", "ml-based"],
                               help="Type of model to retrain")
    retrain_parser.add_argument("--min-feedback", type=int, default=10,
                               help="Minimum number of feedback items to use")
    
    # Metrics command
    metrics_parser = subparsers.add_parser("metrics", help="Get performance metrics")
    data_dir_arg(metrics_parser)
    metrics_parser.add_argument("--time-period", default="all",
                               choices=["day", "week", "month", "year", "all"],
                               help="Time period for metrics")
    metrics_parser.add_argument("--learning-curve", action="store_true",
                               help="Get learning curve instead of performance metrics")
    metrics_parser.add_argument("--output",
                               help="Output file for metrics (defaults to stdout)")
    
    args = parser.parse_args()
    
    if args.command == "store":
        return handle_store_command(args)
    elif args.command == "adjust":
        return handle_adjust_command(args)
    elif args.command == "retrain":
        return handle_retrain_command(args)
    elif args.command == "metrics":
        return handle_metrics_command(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())