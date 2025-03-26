#!/usr/bin/env python3
"""
Model Context Protocol (MCP) Server

A dedicated server for managing machine learning models, providing centralized
model loading, caching, and inference capabilities. Implements the Model Context Protocol
standard for standardized communication with ML models.

Features:
- Centralized model management
- Support for both feature-based and ML-based recognition
- Model versioning and hot-swapping
- Agent-friendly API for future integration
- Performance optimization through model caching
- Standardized protocol-based communication

Usage:
    uvicorn mcp_server:app --host 0.0.0.0 --port 8000
"""

import os
import sys
import json
import time
import uuid
import numpy as np
import cv2
from typing import Dict, List, Any, Tuple, Optional, Union
from fastapi import FastAPI, File, UploadFile, Body, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import logging
from enum import Enum
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("mcp_server")

# Conditionally import ML frameworks
try:
    import tensorflow as tf
    TF_AVAILABLE = True
    logger.info("TensorFlow is available")
except ImportError:
    TF_AVAILABLE = False
    logger.warning("TensorFlow is not available")

try:
    import torch
    import torchvision
    TORCH_AVAILABLE = True
    logger.info("PyTorch is available")
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch is not available")

# Constants
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models')
FEATURE_MODEL_PATH = os.path.join(MODEL_DIR, 'feature_descriptors.npz')
ML_MODEL_PATH_TF = os.path.join(MODEL_DIR, 'material_classifier_tf')
ML_MODEL_PATH_TORCH = os.path.join(MODEL_DIR, 'material_classifier_torch.pt')
MATERIAL_METADATA_PATH = os.path.join(MODEL_DIR, 'material_metadata.json')

# Ensure model directory exists
os.makedirs(MODEL_DIR, exist_ok=True)

# Define data models for API
class ModelType(str, Enum):
    HYBRID = "hybrid"
    FEATURE_BASED = "feature-based"
    ML_BASED = "ml-based"

class RecognitionOptions(BaseModel):
    model_type: ModelType = ModelType.HYBRID
    confidence_threshold: float = 0.6
    max_results: int = 5
    include_features: bool = True

class ModelInfo(BaseModel):
    id: str
    name: str
    type: ModelType
    version: str
    description: str
    created_at: str
    updated_at: str
    status: str = "active"
    capabilities: List[str]

class ModelMatch(BaseModel):
    material_id: str = Field(..., alias="materialId")
    confidence: float
    features: Optional[Dict[str, Any]] = None

class RecognitionResult(BaseModel):
    matches: List[ModelMatch]
    extracted_features: Optional[Dict[str, Any]] = Field(None, alias="extractedFeatures")
    processing_time: float = Field(..., alias="processingTime")
    model_id: str = Field(..., alias="modelId")
    request_id: str = Field(..., alias="requestId")

class AgentMessage(BaseModel):
    message_type: str
    content: Dict[str, Any]
    timestamp: float = Field(default_factory=time.time)
    
class ModelContext(BaseModel):
    """Context information for model inference."""
    model_id: str
    version: str
    parameters: Dict[str, Any] = {}
    metadata: Dict[str, Any] = {}

# Class for model management
class ModelManager:
    """Manager for ML models with caching and versioning."""
    
    def __init__(self):
        self.models = {}
        self.model_info = {}
        self.model_contexts = {}
        self.executor = ThreadPoolExecutor(max_workers=4)
        
    def load_material_metadata(self) -> Dict[str, Any]:
        """Load material metadata from JSON file."""
        if os.path.exists(MATERIAL_METADATA_PATH):
            with open(MATERIAL_METADATA_PATH, 'r') as f:
                return json.load(f)
        else:
            # Return empty metadata if file doesn't exist
            logger.warning(f"Material metadata file not found at {MATERIAL_METADATA_PATH}")
            return {"materials": {}}
    
    def load_feature_descriptors(self) -> Dict[str, Any]:
        """Load pre-computed feature descriptors for materials."""
        if os.path.exists(FEATURE_MODEL_PATH):
            return np.load(FEATURE_MODEL_PATH, allow_pickle=True)
        else:
            # Return empty descriptors if file doesn't exist
            logger.warning(f"Feature descriptors file not found at {FEATURE_MODEL_PATH}")
            return {"material_ids": np.array([]), "descriptors": np.array([])}
    
    def load_tf_model(self) -> Any:
        """Load TensorFlow model for material classification."""
        if TF_AVAILABLE and os.path.exists(ML_MODEL_PATH_TF):
            return tf.saved_model.load(ML_MODEL_PATH_TF)
        else:
            logger.warning(f"TensorFlow model not found at {ML_MODEL_PATH_TF}")
            return None
    
    def load_torch_model(self) -> Any:
        """Load PyTorch model for material classification."""
        if TORCH_AVAILABLE and os.path.exists(ML_MODEL_PATH_TORCH):
            model = torch.load(ML_MODEL_PATH_TORCH, map_location=torch.device('cpu'))
            model.eval()
            return model
        else:
            logger.warning(f"PyTorch model not found at {ML_MODEL_PATH_TORCH}")
            return None
            
    def get_model(self, model_id: str):
        """Get a model by ID, loading it if necessary."""
        if model_id not in self.models:
            logger.info(f"Loading model: {model_id}")
            
            if model_id == "material-hybrid" or model_id == "material-feature-based":
                # Load feature-based components
                self.models[model_id] = {
                    "feature_extractor": cv2.SIFT_create(),
                    "feature_matcher": cv2.FlannBasedMatcher({'algorithm': 1, 'trees': 5}, {'checks': 50}),
                    "feature_descriptors": self.load_feature_descriptors(),
                    "material_metadata": self.load_material_metadata()
                }
                
            if model_id == "material-hybrid" or model_id == "material-ml-based":
                # Add ML model to the hybrid model or create ML-only model
                if TF_AVAILABLE:
                    ml_model = self.load_tf_model()
                elif TORCH_AVAILABLE:
                    ml_model = self.load_torch_model()
                else:
                    ml_model = None
                    logger.warning("No ML framework available for ML-based model")
                
                if model_id == "material-hybrid":
                    self.models[model_id]["ml_model"] = ml_model
                else:  # ml-based
                    self.models[model_id] = {
                        "ml_model": ml_model,
                        "material_metadata": self.load_material_metadata()
                    }
            
            # Create model info
            self.model_info[model_id] = {
                "id": model_id,
                "name": model_id.replace("material-", "Material Recognition - ").title(),
                "type": model_id.replace("material-", ""),
                "version": "1.0.0",
                "description": f"Material recognition model using {model_id.replace('material-', '')} approach",
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "status": "active",
                "capabilities": ["material-recognition", "feature-extraction"]
            }
            
            # Create default context
            self.model_contexts[model_id] = {
                "model_id": model_id,
                "version": "1.0.0",
                "parameters": {},
                "metadata": {}
            }
        
        return self.models[model_id]
    
    def list_models(self) -> List[ModelInfo]:
        """List all available models."""
        # Lazy-load standard models if not already loaded
        for model_type in ["hybrid", "feature-based", "ml-based"]:
            model_id = f"material-{model_type}"
            if model_id not in self.model_info:
                try:
                    self.get_model(model_id)
                except Exception as e:
                    logger.error(f"Error loading model {model_id}: {e}")
        
        return [ModelInfo(**info) for info in self.model_info.values()]
    
    def get_model_info(self, model_id: str) -> ModelInfo:
        """Get information about a specific model."""
        if model_id not in self.model_info:
            self.get_model(model_id)
            
        if model_id not in self.model_info:
            raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
            
        return ModelInfo(**self.model_info[model_id])
    
    def get_context(self, model_id: str) -> ModelContext:
        """Get the context for a specific model."""
        if model_id not in self.model_contexts:
            # Create default context if not exists
            self.get_model(model_id)
            
        if model_id not in self.model_contexts:
            raise HTTPException(status_code=404, detail=f"Context for model {model_id} not found")
            
        return ModelContext(**self.model_contexts[model_id])
    
    def set_context(self, model_id: str, context: ModelContext):
        """Update the context for a specific model."""
        self.model_contexts[model_id] = context.dict()
    
    def extract_features(self, image: np.ndarray, model_id: str) -> Dict[str, Any]:
        """Extract features from an image using a specific model."""
        model = self.get_model(model_id)
        
        # Extract basic image features
        height, width, channels = image.shape
        aspect_ratio = width / height
        
        # Extract dominant colors
        dominant_colors = self._extract_dominant_colors(image)
        
        features = {
            "imageSize": {
                "width": width,
                "height": height
            },
            "aspectRatio": aspect_ratio,
            "channels": channels,
            "dominantColors": dominant_colors
        }
        
        if "feature_extractor" in model:
            # Extract SIFT features
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            keypoints, descriptors = model["feature_extractor"].detectAndCompute(gray, None)
            
            if keypoints and descriptors is not None:
                features["keypointCount"] = len(keypoints)
                features["descriptorShape"] = descriptors.shape
            
        return features
    
    def _extract_dominant_colors(self, image: np.ndarray, num_colors: int = 5) -> List[Dict[str, Any]]:
        """Extract dominant colors from an image"""
        # Reshape image to be a list of pixels
        pixels = image.reshape(-1, 3)
        
        # Convert to float32
        pixels = np.float32(pixels)
        
        # Define criteria and apply kmeans
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
        _, labels, centers = cv2.kmeans(pixels, num_colors, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
        
        # Convert back to uint8
        centers = np.uint8(centers)
        
        # Count occurrences of each label
        counts = np.bincount(labels.flatten())
        
        # Sort colors by frequency
        sorted_indices = np.argsort(counts)[::-1]
        sorted_centers = centers[sorted_indices]
        sorted_counts = counts[sorted_indices]
        
        # Calculate percentages
        total_pixels = image.shape[0] * image.shape[1]
        percentages = sorted_counts / total_pixels
        
        # Format results
        colors = []
        for i in range(min(num_colors, len(sorted_centers))):
            b, g, r = sorted_centers[i]
            hex_color = f"#{r:02x}{g:02x}{b:02x}"
            colors.append({
                "rgb": {"r": int(r), "g": int(g), "b": int(b)},
                "hex": hex_color,
                "percentage": float(percentages[i])
            })
        
        return colors
    
    def _feature_based_recognition(self, image: np.ndarray, model_id: str, options: RecognitionOptions) -> List[ModelMatch]:
        """Perform feature-based recognition using OpenCV."""
        model = self.get_model(model_id)
        
        # Extract features from the query image
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        keypoints, descriptors = model["feature_extractor"].detectAndCompute(gray, None)
        
        if descriptors is None or len(descriptors) == 0:
            logger.warning("No features detected in the image")
            return []
        
        feature_descriptors = model["feature_descriptors"]
        material_metadata = model["material_metadata"]
        
        if len(feature_descriptors["material_ids"]) == 0:
            logger.warning("No feature descriptors available for matching")
            return []
        
        # Match features against the database
        matches_list = []
        for i, material_id in enumerate(feature_descriptors["material_ids"]):
            material_descriptors = feature_descriptors["descriptors"][i]
            
            if len(material_descriptors) == 0:
                continue
            
            # Match descriptors
            matches = model["feature_matcher"].knnMatch(descriptors, material_descriptors, k=2)
            
            # Apply ratio test to filter good matches
            good_matches = []
            for m, n in matches:
                if m.distance < 0.75 * n.distance:
                    good_matches.append(m)
            
            # Calculate confidence based on number and quality of matches
            if len(good_matches) > 0:
                confidence = len(good_matches) / max(len(keypoints), 10)
                avg_distance = sum(m.distance for m in good_matches) / len(good_matches)
                # Normalize confidence (lower distance is better)
                confidence = confidence * (1 - min(avg_distance / 500, 0.9))
                
                if confidence >= options.confidence_threshold:
                    match_info = {
                        "materialId": material_id,
                        "confidence": float(confidence)
                    }
                    
                    if options.include_features:
                        match_info["features"] = {
                            "featureMatches": len(good_matches),
                            "avgDistance": float(avg_distance)
                        }
                    
                    matches_list.append(ModelMatch(**match_info))
        
        # Sort by confidence (descending)
        matches_list.sort(key=lambda x: x.confidence, reverse=True)
        
        return matches_list[:options.max_results]
    
    def _ml_based_recognition(self, image: np.ndarray, model_id: str, options: RecognitionOptions) -> List[ModelMatch]:
        """Perform ML-based recognition using TensorFlow or PyTorch."""
        model = self.get_model(model_id)
        
        # Resize image for the neural network
        resized_img = cv2.resize(image, (224, 224))
        
        if TF_AVAILABLE and model["ml_model"] is not None:
            # Preprocess for TensorFlow
            img_tensor = tf.convert_to_tensor(resized_img, dtype=tf.float32)
            img_tensor = tf.expand_dims(img_tensor, 0)  # Add batch dimension
            img_tensor = tf.keras.applications.mobilenet_v2.preprocess_input(img_tensor)
            
            # Get predictions
            predictions = model["ml_model"](img_tensor)
            if isinstance(predictions, dict):
                predictions = predictions['predictions']
            
            # Convert to numpy for processing
            predictions = predictions.numpy().flatten()
            
        elif TORCH_AVAILABLE and model["ml_model"] is not None:
            # Preprocess for PyTorch
            img_tensor = torch.from_numpy(resized_img).permute(2, 0, 1).float()
            img_tensor = img_tensor / 255.0
            img_tensor = torch.unsqueeze(img_tensor, 0)  # Add batch dimension
            
            # Normalize with ImageNet stats
            normalize = torchvision.transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
            img_tensor = normalize(img_tensor)
            
            # Get predictions
            with torch.no_grad():
                predictions = model["ml_model"](img_tensor)
                predictions = torch.nn.functional.softmax(predictions, dim=1)
                predictions = predictions.numpy().flatten()
        else:
            return []
        
        # Map predictions to materials
        material_metadata = model["material_metadata"]
        material_ids = list(material_metadata["materials"].keys())
        matches_list = []
        
        for i, confidence in enumerate(predictions):
            if i < len(material_ids) and confidence >= options.confidence_threshold:
                material_id = material_ids[i]
                
                match_info = {
                    "materialId": material_id,
                    "confidence": float(confidence)
                }
                
                if options.include_features:
                    match_info["features"] = {
                        "classificationScore": float(confidence)
                    }
                
                matches_list.append(ModelMatch(**match_info))
        
        # Sort by confidence (descending)
        matches_list.sort(key=lambda x: x.confidence, reverse=True)
        
        return matches_list[:options.max_results]
    
    def _hybrid_recognition(self, image: np.ndarray, model_id: str, options: RecognitionOptions) -> List[ModelMatch]:
        """Combine feature-based and ML-based recognition results."""
        # Create appropriate options for each recognition type
        feature_options = RecognitionOptions(
            model_type=ModelType.FEATURE_BASED,
            confidence_threshold=options.confidence_threshold,
            max_results=options.max_results * 2,  # Get more for fusion
            include_features=options.include_features
        )
        
        ml_options = RecognitionOptions(
            model_type=ModelType.ML_BASED,
            confidence_threshold=options.confidence_threshold,
            max_results=options.max_results * 2,  # Get more for fusion
            include_features=options.include_features
        )
        
        # Get results from both approaches
        feature_matches = self._feature_based_recognition(image, f"material-{ModelType.FEATURE_BASED}", feature_options)
        ml_matches = self._ml_based_recognition(image, f"material-{ModelType.ML_BASED}", ml_options)
        
        # Combine results
        combined_matches = {}
        
        # Add feature-based matches
        for match in feature_matches:
            material_id = match.material_id
            combined_matches[material_id] = match
        
        # Add or update with ML-based matches
        for match in ml_matches:
            material_id = match.material_id
            if material_id in combined_matches:
                # Average the confidence scores
                feature_conf = combined_matches[material_id].confidence
                ml_conf = match.confidence
                avg_conf = (feature_conf + ml_conf) / 2
                
                # Update confidence
                combined_matches[material_id].confidence = avg_conf
                
                # Combine features if included
                if options.include_features and combined_matches[material_id].features:
                    if match.features:
                        combined_matches[material_id].features.update(match.features)
            else:
                combined_matches[material_id] = match
        
        # Convert to list and sort by confidence
        result_list = list(combined_matches.values())
        result_list.sort(key=lambda x: x.confidence, reverse=True)
        
        return result_list[:options.max_results]
    
    async def recognize_material(self, image: np.ndarray, options: RecognitionOptions) -> RecognitionResult:
        """Recognize materials in an image."""
        start_time = time.time()
        request_id = str(uuid.uuid4())
        
        # Map model type to model ID
        model_id = f"material-{options.model_type}"
        
        # Perform recognition based on model type
        if options.model_type == ModelType.FEATURE_BASED:
            matches = await asyncio.to_thread(
                self._feature_based_recognition, 
                image, 
                model_id, 
                options
            )
        elif options.model_type == ModelType.ML_BASED:
            matches = await asyncio.to_thread(
                self._ml_based_recognition, 
                image, 
                model_id, 
                options
            )
        else:  # hybrid
            matches = await asyncio.to_thread(
                self._hybrid_recognition, 
                image, 
                model_id, 
                options
            )
        
        # Extract features if needed
        extracted_features = None
        if options.include_features:
            extracted_features = await asyncio.to_thread(
                self.extract_features,
                image,
                model_id
            )
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        # Prepare result
        result = {
            "matches": matches,
            "extractedFeatures": extracted_features,
            "processingTime": processing_time,
            "modelId": model_id,
            "requestId": request_id
        }
        
        return RecognitionResult(**result)

# Initialize FastAPI app
app = FastAPI(
    title="Model Context Protocol Server",
    description="Centralized model management server with Model Context Protocol support",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize model manager
model_manager = ModelManager()

# Agent communication queue
agent_queue = asyncio.Queue()

# API endpoints
@app.get("/")
async def root():
    """Root endpoint providing general information."""
    return {
        "name": "Model Context Protocol Server",
        "version": "1.0.0",
        "status": "running",
        "frameworks": {
            "tensorflow": TF_AVAILABLE,
            "pytorch": TORCH_AVAILABLE
        },
        "endpoints": {
            "models": "/api/v1/models",
            "recognition": "/api/v1/recognize",
            "agent": "/api/v1/agent"
        }
    }

@app.get("/api/v1/models")
async def list_models():
    """List all available models."""
    return model_manager.list_models()

@app.get("/api/v1/models/{model_id}")
async def get_model_info(model_id: str):
    """Get information about a specific model."""
    return model_manager.get_model_info(model_id)

@app.get("/api/v1/models/{model_id}/context")
async def get_model_context(model_id: str):
    """Get the context for a specific model."""
    return model_manager.get_context(model_id)

@app.put("/api/v1/models/{model_id}/context")
async def update_model_context(model_id: str, context: ModelContext):
    """Update the context for a specific model."""
    model_manager.set_context(model_id, context)
    return {"status": "success", "message": f"Context updated for model {model_id}"}

@app.post("/api/v1/recognize")
async def recognize_material(
    image: UploadFile = File(...),
    options: str = Body("{}")
):
    """
    Recognize materials in an image.
    
    - **image**: The image file to analyze
    - **options**: JSON string with recognition options
    """
    try:
        # Parse options
        if isinstance(options, str):
            try:
                options_dict = json.loads(options)
                recognition_options = RecognitionOptions(**options_dict)
            except json.JSONDecodeError:
                recognition_options = RecognitionOptions()
        else:
            recognition_options = RecognitionOptions(**options)
            
        # Read and decode image
        contents = await image.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Perform recognition
        result = await model_manager.recognize_material(img, recognition_options)
        
        # Notify agent about the recognition (if any)
        if recognition_options.model_type == ModelType.HYBRID:
            await agent_queue.put({
                "type": "recognition",
                "model_id": f"material-{recognition_options.model_type}",
                "timestamp": time.time(),
                "matches_count": len(result.matches),
                "confidence": result.matches[0].confidence if result.matches else 0
            })
        
        return result
    except Exception as e:
        logger.error(f"Error in recognition: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/agent/message")
async def send_agent_message(message: AgentMessage):
    """
    Send a message to the agent.
    
    This endpoint allows external services to communicate with the
    agent that will be integrated in the future.
    """
    await agent_queue.put({
        "type": message.message_type,
        "content": message.content,
        "timestamp": message.timestamp
    })
    return {"status": "message_queued"}

@app.get("/api/v1/agent/messages")
async def get_agent_messages(max_wait: float = 1.0):
    """
    Get messages from the agent queue.
    
    This endpoint is designed for the agent to consume messages
    when it's integrated in the future.
    """
    try:
        messages = []
        
        # Try to get at least one message
        try:
            message = await asyncio.wait_for(agent_queue.get(), timeout=max_wait)
            messages.append(message)
            agent_queue.task_done()
        except asyncio.TimeoutError:
            pass
        
        # Get any additional messages that are immediately available
        while not agent_queue.empty():
            message = agent_queue.get_nowait()
            messages.append(message)
            agent_queue.task_done()
        
        return {"messages": messages, "count": len(messages)}
    except Exception as e:
        logger.error(f"Error getting agent messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": time.time()}

# Main entry point
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)