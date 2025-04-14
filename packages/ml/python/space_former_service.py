"""
SpaceFormer Service for Interior Design Automation

This service provides layout generation and furniture placement optimization
using the SpaceFormer model. It implements both room layout generation and
furniture placement based on design principles.

Dependencies:
- spaceformer>=0.2.0
- numpy>=1.19.0
- torch>=1.7.1
- transformers>=4.5.0
"""

import os
import sys
import time
import json
import logging
import tempfile
from typing import Dict, List, Optional, Tuple, Union, Any

import numpy as np
try:
    import torch
    from torch import nn
    import spaceformer
    from spaceformer.models import RoomLayoutModel, FurniturePlacementModel
    from spaceformer.utils import design_principles, spatial_constraints
    from spaceformer.data import RoomSchema, FurnitureItem
    HAS_SPACEFORMER = True
except ImportError:
    HAS_SPACEFORMER = False
    logging.error("SpaceFormer module not found. Please install spaceformer>=0.2.0")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("SpaceFormerService")

class SpaceFormerService:
    """Service for interior design automation using SpaceFormer"""
    
    def __init__(self, model_path: Optional[str] = None, device: str = "cuda"):
        """
        Initialize the SpaceFormer service
        
        Args:
            model_path: Path to pre-trained SpaceFormer models
            device: Compute device to use ('cuda' or 'cpu')
        """
        self.device = "cuda" if torch.cuda.is_available() and device == "cuda" else "cpu"
        logger.info(f"Using device: {self.device}")
        
        if not HAS_SPACEFORMER:
            self.ready = False
            logger.error("SpaceFormer dependencies not available")
            return
            
        try:
            # Initialize layout generation model
            self.layout_model = RoomLayoutModel.from_pretrained(
                model_path or "spaceformer/room-layout-base"
            ).to(self.device)
            
            # Initialize furniture placement model
            self.furniture_model = FurniturePlacementModel.from_pretrained(
                model_path or "spaceformer/furniture-placement-base"
            ).to(self.device)
            
            # Load design principles
            self.design_principles = design_principles.load_default_principles()
            
            self.ready = True
            logger.info("SpaceFormer service initialized successfully")
        except Exception as e:
            self.ready = False
            logger.error(f"Failed to initialize SpaceFormer service: {str(e)}")
    
    def health_check(self) -> Dict[str, Any]:
        """
        Check if the service is ready
        
        Returns:
            Dict with health status information
        """
        status = "healthy" if self.ready else "unhealthy"
        device = self.device
        has_spaceformer = HAS_SPACEFORMER
        
        return {
            "status": status,
            "device": device,
            "has_spaceformer": has_spaceformer,
            "timestamp": time.time()
        }
    
    def generate_room_layout(self, 
                           room_dimensions: Dict[str, float], 
                           room_type: str,
                           fixed_elements: Optional[List[Dict[str, Any]]] = None,
                           style_preferences: Optional[Dict[str, float]] = None,
                           quality: str = "medium") -> Dict[str, Any]:
        """
        Generate a room layout based on dimensions and type
        
        Args:
            room_dimensions: Dict with 'width', 'length', and 'height' in meters
            room_type: Type of room (e.g., 'living_room', 'bedroom', 'kitchen')
            fixed_elements: Fixed elements in the room (doors, windows, built-ins)
            style_preferences: Style preference weights
            quality: Quality level ('low', 'medium', 'high')
            
        Returns:
            Dict with generated layout
        """
        if not self.ready:
            return {"error": "Service not ready"}
        
        try:
            # Prepare room schema
            room_schema = RoomSchema(
                width=room_dimensions["width"],
                length=room_dimensions["length"],
                height=room_dimensions.get("height", 2.7),  # Default ceiling height
                room_type=room_type,
                fixed_elements=fixed_elements or []
            )
            
            # Set quality parameters
            if quality == "low":
                num_iterations = 30
                diversity_samples = 3
            elif quality == "medium":
                num_iterations = 100
                diversity_samples = 5
            else:  # high
                num_iterations = 300
                diversity_samples = 10
                
            # Generate layout with the model
            with torch.no_grad():
                layouts = self.layout_model.generate(
                    room_schema,
                    style_preferences=style_preferences,
                    num_iterations=num_iterations,
                    diversity_samples=diversity_samples
                )
            
            # Convert model output to serializable format
            results = []
            for layout in layouts:
                layout_data = {
                    "zones": [zone.to_dict() for zone in layout.zones],
                    "circulation_paths": [path.to_dict() for path in layout.circulation_paths],
                    "score": float(layout.score)
                }
                results.append(layout_data)
            
            # Sort by score
            results.sort(key=lambda x: x["score"], reverse=True)
            
            return {
                "status": "success",
                "room_type": room_type,
                "dimensions": room_dimensions,
                "layouts": results
            }
            
        except Exception as e:
            logger.error(f"Error generating room layout: {str(e)}")
            return {"error": str(e)}
    
    def place_furniture(self,
                      room_layout: Dict[str, Any],
                      furniture_items: List[Dict[str, Any]],
                      constraints: Optional[Dict[str, Any]] = None,
                      quality: str = "medium") -> Dict[str, Any]:
        """
        Place furniture items optimally in a room layout
        
        Args:
            room_layout: Room layout from generate_room_layout
            furniture_items: List of furniture items to place
            constraints: Additional placement constraints
            quality: Quality level ('low', 'medium', 'high')
            
        Returns:
            Dict with furniture placement results
        """
        if not self.ready:
            return {"error": "Service not ready"}
        
        try:
            # Convert furniture items to model format
            model_furniture = []
            for item in furniture_items:
                furniture_item = FurnitureItem(
                    id=item.get("id", f"item_{len(model_furniture)}"),
                    type=item["type"],
                    width=item["dimensions"]["width"],
                    depth=item["dimensions"]["depth"],
                    height=item["dimensions"]["height"],
                    preferred_zone=item.get("preferred_zone"),
                    orientation_constraints=item.get("orientation_constraints", [])
                )
                model_furniture.append(furniture_item)
            
            # Set quality parameters
            if quality == "low":
                num_iterations = 50
                temperature = 0.8
            elif quality == "medium":
                num_iterations = 150
                temperature = 0.5
            else:  # high
                num_iterations = 500
                temperature = 0.2
            
            # Create constraint manager
            constraint_manager = spatial_constraints.ConstraintManager()
            if constraints:
                for c_type, c_value in constraints.items():
                    constraint_manager.add_constraint(c_type, c_value)
            
            # Apply design principles
            design_principle_weights = {}
            for principle in self.design_principles:
                design_principle_weights[principle.name] = principle.default_weight
            
            # Generate furniture placement
            with torch.no_grad():
                placements = self.furniture_model.generate(
                    room_layout=room_layout["layouts"][0],  # Use the highest-scoring layout
                    furniture_items=model_furniture,
                    constraint_manager=constraint_manager,
                    design_principle_weights=design_principle_weights,
                    num_iterations=num_iterations,
                    temperature=temperature
                )
            
            # Convert results to serializable format
            placement_results = []
            for placement in placements:
                placement_data = {
                    "furniture_placements": [
                        {
                            "id": p.item.id,
                            "position": {
                                "x": float(p.position[0]),
                                "y": float(p.position[1]),
                                "z": float(p.position[2])
                            },
                            "rotation": float(p.rotation),
                            "zone": p.zone
                        }
                        for p in placement.placements
                    ],
                    "score": float(placement.score),
                    "metrics": {
                        metric: float(value) 
                        for metric, value in placement.metrics.items()
                    }
                }
                placement_results.append(placement_data)
            
            # Sort by score
            placement_results.sort(key=lambda x: x["score"], reverse=True)
            
            return {
                "status": "success",
                "room_layout_id": room_layout.get("id"),
                "furniture_placements": placement_results
            }
            
        except Exception as e:
            logger.error(f"Error placing furniture: {str(e)}")
            return {"error": str(e)}
    
    def optimize_existing_layout(self,
                              room_data: Dict[str, Any],
                              furniture_data: List[Dict[str, Any]],
                              optimization_goals: Dict[str, float],
                              quality: str = "medium") -> Dict[str, Any]:
        """
        Optimize an existing room layout and furniture arrangement
        
        Args:
            room_data: Room dimensions and fixed elements
            furniture_data: Existing furniture with current positions
            optimization_goals: Weights for different optimization goals
            quality: Quality level ('low', 'medium', 'high')
            
        Returns:
            Dict with optimized layout
        """
        if not self.ready:
            return {"error": "Service not ready"}
        
        try:
            # First generate a room layout
            room_layout = self.generate_room_layout(
                room_dimensions=room_data["dimensions"],
                room_type=room_data["type"],
                fixed_elements=room_data.get("fixed_elements"),
                quality=quality
            )
            
            if "error" in room_layout:
                return room_layout
            
            # Extract existing furniture positions for constraints
            position_constraints = {}
            for furniture in furniture_data:
                if "position" in furniture and furniture.get("keep_position", False):
                    position_constraints[furniture["id"]] = {
                        "position": furniture["position"],
                        "rotation": furniture.get("rotation", 0)
                    }
            
            # Create constraints with optimization goals
            constraints = {
                "position_constraints": position_constraints,
                "optimization_weights": optimization_goals
            }
            
            # Place furniture with the enhanced constraints
            placement_result = self.place_furniture(
                room_layout=room_layout,
                furniture_items=furniture_data,
                constraints=constraints,
                quality=quality
            )
            
            return {
                "status": "success",
                "original_layout": room_layout,
                "optimized_placement": placement_result
            }
            
        except Exception as e:
            logger.error(f"Error optimizing layout: {str(e)}")
            return {"error": str(e)}
    
    def analyze_existing_layout(self, 
                              room_data: Dict[str, Any],
                              furniture_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze an existing layout for improvement suggestions
        
        Args:
            room_data: Room dimensions and fixed elements
            furniture_data: Existing furniture with current positions
            
        Returns:
            Dict with analysis and suggestions
        """
        if not self.ready:
            return {"error": "Service not ready"}
        
        try:
            # Prepare room schema
            room_schema = RoomSchema(
                width=room_data["dimensions"]["width"],
                length=room_data["dimensions"]["length"],
                height=room_data["dimensions"].get("height", 2.7),
                room_type=room_data["type"],
                fixed_elements=room_data.get("fixed_elements", [])
            )
            
            # Convert furniture to model format
            model_furniture = []
            for item in furniture_data:
                furniture_item = FurnitureItem(
                    id=item.get("id", f"item_{len(model_furniture)}"),
                    type=item["type"],
                    width=item["dimensions"]["width"],
                    depth=item["dimensions"]["depth"],
                    height=item["dimensions"]["height"]
                )
                
                # Add position if available
                if "position" in item:
                    furniture_item.position = (
                        item["position"]["x"],
                        item["position"]["y"],
                        item["position"]["z"]
                    )
                    furniture_item.rotation = item.get("rotation", 0)
                
                model_furniture.append(furniture_item)
            
            # Analyze layout using design principles
            analysis_results = {}
            suggestions = []
            
            # Evaluate each design principle
            for principle in self.design_principles:
                score = principle.evaluate(room_schema, model_furniture)
                analysis_results[principle.name] = float(score)
                
                # If score is below threshold, add suggestion
                if score < principle.suggestion_threshold:
                    suggestions.append({
                        "principle": principle.name,
                        "score": float(score),
                        "suggestion": principle.get_suggestion(room_schema, model_furniture),
                        "priority": "high" if score < 0.3 else "medium" if score < 0.6 else "low"
                    })
            
            # Sort suggestions by priority
            suggestions.sort(key=lambda x: 0 if x["priority"] == "high" else 
                                           1 if x["priority"] == "medium" else 2)
            
            return {
                "status": "success",
                "overall_score": float(sum(analysis_results.values()) / len(analysis_results)),
                "principle_scores": analysis_results,
                "suggestions": suggestions
            }
            
        except Exception as e:
            logger.error(f"Error analyzing layout: {str(e)}")
            return {"error": str(e)}

# Entry point for command line execution
if __name__ == "__main__":
    service = SpaceFormerService()
    
    # Check if the service is ready
    health = service.health_check()
    print(f"Service health: {health['status']}")
    
    if health["status"] == "healthy":
        # Example usage
        room_dimensions = {"width": 5.0, "length": 7.0, "height": 2.7}
        room_type = "living_room"
        
        # Generate a layout
        layout = service.generate_room_layout(room_dimensions, room_type)
        print(f"Generated {len(layout['layouts'])} layouts")
        
        # Define furniture to place
        furniture = [
            {
                "type": "sofa",
                "dimensions": {"width": 2.2, "depth": 0.9, "height": 0.8}
            },
            {
                "type": "coffee_table",
                "dimensions": {"width": 1.2, "depth": 0.6, "height": 0.45}
            },
            {
                "type": "tv_stand",
                "dimensions": {"width": 1.8, "depth": 0.5, "height": 0.6}
            },
            {
                "type": "armchair",
                "dimensions": {"width": 0.8, "depth": 0.8, "height": 0.9}
            }
        ]
        
        # Place furniture
        placement = service.place_furniture(layout, furniture)
        print(f"Generated {len(placement['furniture_placements'])} furniture arrangements")