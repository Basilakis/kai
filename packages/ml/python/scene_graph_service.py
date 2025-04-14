"""
3D Scene Graph Generation Service (3DSSG)

This service provides 3D scene graph generation capabilities,
creating relationship-aware representations of 3D scenes.
It leverages the scene-graph-3d library to extract objects
and their relationships from 3D scenes.

The service supports:
- Scene graph generation from 3D models and point clouds
- Relationship extraction between objects
- Semantic querying of scene contents
- Saving and loading scene graphs
- Merging multiple scene graphs
- Relationship-aware editing operations

Dependencies:
- scene-graph-3d>=0.1.0
- numpy
- scipy
- torch
- open3d
"""

import os
import sys
import time
import json
import tempfile
import logging
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Union, Optional, Any

# Import scene-graph-3d library (the actual import would depend on the real package name)
try:
    import scene_graph_3d
except ImportError:
    print("Error: scene-graph-3d package not found. Please install it with: pip install scene-graph-3d>=0.1.0")
    sys.exit(1)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("SceneGraphService")

class SceneGraphService:
    """Service for generating and manipulating 3D scene graphs."""
    
    def __init__(self, cache_dir: Optional[str] = None, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the Scene Graph Service.
        
        Args:
            cache_dir: Directory to cache generated scene graphs
            config: Configuration options for the scene graph generator
        """
        self.cache_dir = cache_dir or os.path.join(tempfile.gettempdir(), "scene_graph_cache")
        os.makedirs(self.cache_dir, exist_ok=True)
        
        # Default configuration
        self.config = {
            "min_confidence": 0.5,
            "max_relationships": 100,
            "use_gpu": True,
            "relationship_types": ["on", "in", "next_to", "supporting", "attached_to", "part_of"],
            "object_types": ["wall", "floor", "ceiling", "table", "chair", "sofa", "lamp", "door", "window", "shelf"],
            "semantic_similarity_threshold": 0.7,
            "spatial_relationship_distance_threshold": 0.5,
            "cache_enabled": True,
            "merge_similar_objects": True
        }
        
        # Override defaults with provided config
        if config:
            self.config.update(config)
            
        # Initialize the 3DSSG model
        logger.info("Initializing 3DSSG model...")
        try:
            self.model = scene_graph_3d.SceneGraphGenerator(
                use_gpu=self.config["use_gpu"],
                min_confidence=self.config["min_confidence"],
                relationship_types=self.config["relationship_types"]
            )
            logger.info("3DSSG model initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize 3DSSG model: {e}")
            raise RuntimeError(f"Failed to initialize 3DSSG model: {e}")
    
    def generate_scene_graph_from_model(self, model_path: str, format: str = "gltf") -> Dict[str, Any]:
        """
        Generate a scene graph from a 3D model.
        
        Args:
            model_path: Path to the 3D model file
            format: Format of the 3D model (gltf, obj, ply, etc.)
            
        Returns:
            A dictionary containing the generated scene graph
        """
        cache_key = f"{os.path.basename(model_path)}_{hash(model_path)}"
        cache_path = os.path.join(self.cache_dir, f"{cache_key}.json")
        
        # Check cache if enabled
        if self.config["cache_enabled"] and os.path.exists(cache_path):
            logger.info(f"Loading scene graph from cache: {cache_path}")
            try:
                with open(cache_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load from cache: {e}")
        
        logger.info(f"Generating scene graph from model: {model_path}")
        try:
            # Load the 3D model
            model = scene_graph_3d.load_model(model_path, format=format)
            
            # Generate the scene graph
            scene_graph = self.model.generate(model)
            
            # Process the scene graph
            processed_graph = self._process_scene_graph(scene_graph)
            
            # Cache the result
            if self.config["cache_enabled"]:
                with open(cache_path, 'w') as f:
                    json.dump(processed_graph, f)
            
            return processed_graph
        except Exception as e:
            logger.error(f"Failed to generate scene graph: {e}")
            raise RuntimeError(f"Failed to generate scene graph: {e}")
    
    def generate_scene_graph_from_point_cloud(self, pointcloud_path: str) -> Dict[str, Any]:
        """
        Generate a scene graph from a point cloud.
        
        Args:
            pointcloud_path: Path to the point cloud file (PLY, PCD, etc.)
            
        Returns:
            A dictionary containing the generated scene graph
        """
        cache_key = f"{os.path.basename(pointcloud_path)}_{hash(pointcloud_path)}"
        cache_path = os.path.join(self.cache_dir, f"{cache_key}.json")
        
        # Check cache if enabled
        if self.config["cache_enabled"] and os.path.exists(cache_path):
            logger.info(f"Loading scene graph from cache: {cache_path}")
            try:
                with open(cache_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load from cache: {e}")
        
        logger.info(f"Generating scene graph from point cloud: {pointcloud_path}")
        try:
            # Load the point cloud
            point_cloud = scene_graph_3d.load_point_cloud(pointcloud_path)
            
            # Generate the scene graph
            scene_graph = self.model.generate_from_point_cloud(point_cloud)
            
            # Process the scene graph
            processed_graph = self._process_scene_graph(scene_graph)
            
            # Cache the result
            if self.config["cache_enabled"]:
                with open(cache_path, 'w') as f:
                    json.dump(processed_graph, f)
            
            return processed_graph
        except Exception as e:
            logger.error(f"Failed to generate scene graph from point cloud: {e}")
            raise RuntimeError(f"Failed to generate scene graph from point cloud: {e}")
    
    def generate_scene_graph_from_images(self, image_paths: List[str], camera_params: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """
        Generate a scene graph from multiple images with optional camera parameters.
        
        Args:
            image_paths: List of paths to images
            camera_params: Optional list of camera parameters for each image
            
        Returns:
            A dictionary containing the generated scene graph
        """
        cache_key = f"images_{hash(''.join(image_paths))}"
        cache_path = os.path.join(self.cache_dir, f"{cache_key}.json")
        
        # Check cache if enabled
        if self.config["cache_enabled"] and os.path.exists(cache_path):
            logger.info(f"Loading scene graph from cache: {cache_path}")
            try:
                with open(cache_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load from cache: {e}")
        
        logger.info(f"Generating scene graph from {len(image_paths)} images")
        try:
            # Load the images
            images = [scene_graph_3d.load_image(path) for path in image_paths]
            
            # Generate the scene graph
            if camera_params:
                scene_graph = self.model.generate_from_images(images, camera_params=camera_params)
            else:
                scene_graph = self.model.generate_from_images(images)
            
            # Process the scene graph
            processed_graph = self._process_scene_graph(scene_graph)
            
            # Cache the result
            if self.config["cache_enabled"]:
                with open(cache_path, 'w') as f:
                    json.dump(processed_graph, f)
            
            return processed_graph
        except Exception as e:
            logger.error(f"Failed to generate scene graph from images: {e}")
            raise RuntimeError(f"Failed to generate scene graph from images: {e}")
    
    def query_scene_graph(self, scene_graph: Dict[str, Any], query: str) -> List[Dict[str, Any]]:
        """
        Query a scene graph for specific relationships or objects.
        
        Args:
            scene_graph: The scene graph to query
            query: A natural language or structured query
            
        Returns:
            A list of matching objects or relationships
        """
        logger.info(f"Querying scene graph with: {query}")
        try:
            # Parse the query
            parsed_query = self.model.parse_query(query)
            
            # Execute the query against the scene graph
            results = self.model.execute_query(scene_graph, parsed_query)
            
            return results
        except Exception as e:
            logger.error(f"Failed to query scene graph: {e}")
            raise RuntimeError(f"Failed to query scene graph: {e}")
    
    def merge_scene_graphs(self, scene_graphs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Merge multiple scene graphs into a single unified graph.
        
        Args:
            scene_graphs: List of scene graphs to merge
            
        Returns:
            A merged scene graph
        """
        logger.info(f"Merging {len(scene_graphs)} scene graphs")
        try:
            # Use the model to merge the scene graphs
            merged_graph = self.model.merge_graphs(scene_graphs)
            
            # Process the merged graph
            processed_graph = self._process_scene_graph(merged_graph)
            
            return processed_graph
        except Exception as e:
            logger.error(f"Failed to merge scene graphs: {e}")
            raise RuntimeError(f"Failed to merge scene graphs: {e}")
    
    def generate_editing_suggestions(self, scene_graph: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Generate editing suggestions based on the scene graph.
        
        Args:
            scene_graph: The scene graph to analyze
            
        Returns:
            A list of editing suggestions
        """
        logger.info("Generating editing suggestions")
        try:
            # Analyze the scene graph for potential improvements
            suggestions = self.model.generate_suggestions(scene_graph)
            
            return suggestions
        except Exception as e:
            logger.error(f"Failed to generate editing suggestions: {e}")
            raise RuntimeError(f"Failed to generate editing suggestions: {e}")
    
    def _process_scene_graph(self, scene_graph: Any) -> Dict[str, Any]:
        """
        Process a raw scene graph into a standardized format.
        
        Args:
            scene_graph: The raw scene graph from the model
            
        Returns:
            A processed scene graph in a standardized format
        """
        # Convert the scene graph to a dictionary
        if hasattr(scene_graph, 'to_dict'):
            graph_dict = scene_graph.to_dict()
        elif isinstance(scene_graph, dict):
            graph_dict = scene_graph
        else:
            graph_dict = {
                "nodes": [],
                "edges": [],
                "metadata": {}
            }
            
            # Convert nodes
            for node in getattr(scene_graph, 'nodes', []):
                graph_dict["nodes"].append({
                    "id": getattr(node, 'id', str(id(node))),
                    "type": getattr(node, 'type', 'unknown'),
                    "label": getattr(node, 'label', 'Unknown'),
                    "position": getattr(node, 'position', [0, 0, 0]),
                    "size": getattr(node, 'size', [1, 1, 1]),
                    "confidence": getattr(node, 'confidence', 1.0),
                    "attributes": getattr(node, 'attributes', {})
                })
                
            # Convert edges
            for edge in getattr(scene_graph, 'edges', []):
                graph_dict["edges"].append({
                    "id": getattr(edge, 'id', str(id(edge))),
                    "source": getattr(edge, 'source', ''),
                    "target": getattr(edge, 'target', ''),
                    "type": getattr(edge, 'type', 'unknown'),
                    "label": getattr(edge, 'label', 'Unknown'),
                    "confidence": getattr(edge, 'confidence', 1.0),
                    "attributes": getattr(edge, 'attributes', {})
                })
                
            # Add metadata
            graph_dict["metadata"] = {
                "timestamp": time.time(),
                "version": getattr(scene_graph, 'version', '1.0'),
                "generator": "SceneGraphService"
            }
        
        # Filter by confidence threshold
        if self.config["min_confidence"] > 0:
            graph_dict["nodes"] = [node for node in graph_dict["nodes"] 
                                  if node.get("confidence", 0) >= self.config["min_confidence"]]
            
            graph_dict["edges"] = [edge for edge in graph_dict["edges"] 
                                  if edge.get("confidence", 0) >= self.config["min_confidence"]]
        
        # Limit the number of relationships
        if self.config["max_relationships"] > 0:
            graph_dict["edges"] = sorted(
                graph_dict["edges"], 
                key=lambda e: e.get("confidence", 0), 
                reverse=True
            )[:self.config["max_relationships"]]
        
        # Merge similar objects if enabled
        if self.config["merge_similar_objects"]:
            graph_dict = self._merge_similar_objects(graph_dict)
        
        return graph_dict
    
    def _merge_similar_objects(self, graph_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Merge objects that are very similar in type and position.
        
        Args:
            graph_dict: The scene graph dictionary
            
        Returns:
            An updated scene graph with merged similar objects
        """
        # Get configuration parameters
        semantic_threshold = self.config["semantic_similarity_threshold"]
        spatial_threshold = self.config["spatial_relationship_distance_threshold"]
        
        if not graph_dict.get("nodes") or len(graph_dict["nodes"]) <= 1:
            return graph_dict  # No nodes or just one node, nothing to merge
        
        # Create a deep copy to avoid modifying the original during processing
        result = {
            "nodes": [],
            "edges": [] if "edges" in graph_dict else [],
            "metadata": graph_dict.get("metadata", {})
        }
        
        # Group nodes by type for initial filtering
        nodes_by_type = {}
        for node in graph_dict["nodes"]:
            node_type = node.get("type", "unknown")
            if node_type not in nodes_by_type:
                nodes_by_type[node_type] = []
            nodes_by_type[node_type].append(node)
        
        # Process each type group
        merged_nodes = []
        node_mapping = {}  # Maps original node IDs to merged node IDs
        
        for node_type, nodes in nodes_by_type.items():
            # Skip if only one node of this type
            if len(nodes) <= 1:
                merged_nodes.extend(nodes)
                for node in nodes:
                    node_mapping[node["id"]] = node["id"]
                continue
            
            # Check for similar nodes within the same type
            processed_indices = set()
            for i in range(len(nodes)):
                if i in processed_indices:
                    continue
                
                node_i = nodes[i]
                similar_nodes = [node_i]
                pos_i = np.array(node_i.get("position", [0, 0, 0]))
                
                # Find similar nodes
                for j in range(i + 1, len(nodes)):
                    if j in processed_indices:
                        continue
                    
                    node_j = nodes[j]
                    
                    # Check positional similarity
                    pos_j = np.array(node_j.get("position", [0, 0, 0]))
                    distance = np.linalg.norm(pos_i - pos_j)
                    
                    # Check attribute similarity if needed
                    attrs_i = node_i.get("attributes", {})
                    attrs_j = node_j.get("attributes", {})
                    attribute_similarity = self._compute_attribute_similarity(attrs_i, attrs_j)
                    
                    # If nodes are similar enough, group them
                    if distance <= spatial_threshold and attribute_similarity >= semantic_threshold:
                        similar_nodes.append(node_j)
                        processed_indices.add(j)
                
                # Create a merged node if we found similar nodes
                if len(similar_nodes) > 1:
                    merged_node = self._create_merged_node(similar_nodes)
                    merged_nodes.append(merged_node)
                    
                    # Update node mapping
                    for node in similar_nodes:
                        node_mapping[node["id"]] = merged_node["id"]
                else:
                    # Just add the single node as-is
                    merged_nodes.append(node_i)
                    node_mapping[node_i["id"]] = node_i["id"]
                
                processed_indices.add(i)
        
        # Add all merged and non-merged nodes to result
        result["nodes"] = merged_nodes
        
        # Update edges to reference merged nodes
        if "edges" in graph_dict:
            for edge in graph_dict["edges"]:
                source_id = edge.get("source", "")
                target_id = edge.get("target", "")
                
                # Skip edges with unknown nodes
                if not source_id or not target_id:
                    continue
                
                # Map to new node IDs
                new_source = node_mapping.get(source_id)
                new_target = node_mapping.get(target_id)
                
                # Skip if either node was removed during merging
                if not new_source or not new_target:
                    continue
                
                # Create updated edge
                new_edge = edge.copy()
                new_edge["source"] = new_source
                new_edge["target"] = new_target
                
                # Skip self-loops created by merging
                if new_source == new_target:
                    continue
                
                result["edges"].append(new_edge)
        
        # Add result metadata
        if "metadata" not in result:
            result["metadata"] = {}
            
        result["metadata"]["merged_nodes_count"] = len(graph_dict.get("nodes", [])) - len(merged_nodes)
        result["metadata"]["processing"] = {
            "merged": len(graph_dict.get("nodes", [])) > len(merged_nodes),
            "semantic_threshold": semantic_threshold,
            "spatial_threshold": spatial_threshold
        }
        
        return result
    
    def _compute_attribute_similarity(self, attrs1: Dict, attrs2: Dict) -> float:
        """
        Compute similarity between two sets of attributes.
        
        Args:
            attrs1: First attribute dictionary
            attrs2: Second attribute dictionary
            
        Returns:
            Similarity score between 0 and 1
        """
        if not attrs1 and not attrs2:
            return 1.0  # Both empty means identical
            
        if not attrs1 or not attrs2:
            return 0.0  # One empty means no similarity
        
        # Get all keys
        all_keys = set(attrs1.keys()) | set(attrs2.keys())
        if not all_keys:
            return 1.0
            
        # Count matching values
        matches = 0
        for key in all_keys:
            if key in attrs1 and key in attrs2:
                value1 = attrs1[key]
                value2 = attrs2[key]
                
                # Handle different data types
                if isinstance(value1, (int, float)) and isinstance(value2, (int, float)):
                    # Numerical comparison with 10% tolerance
                    max_val = max(abs(value1), abs(value2), 1e-10)  # Avoid division by zero
                    if abs(value1 - value2) / max_val < 0.1:
                        matches += 1
                else:
                    # String/other comparison
                    if value1 == value2:
                        matches += 1
        
        return matches / len(all_keys)
    
    def _create_merged_node(self, nodes: List[Dict]) -> Dict:
        """
        Create a merged node from a list of similar nodes.
        
        Args:
            nodes: List of nodes to merge
            
        Returns:
            A merged node
        """
        if not nodes:
            return {}
            
        if len(nodes) == 1:
            return nodes[0].copy()
        
        # Generate new ID for merged node
        merged_id = f"merged_{nodes[0]['id']}_{len(nodes)}"
        
        # Compute average position and size
        positions = np.array([node.get("position", [0, 0, 0]) for node in nodes])
        avg_position = positions.mean(axis=0).tolist()
        
        sizes = np.array([node.get("size", [1, 1, 1]) for node in nodes])
        avg_size = sizes.mean(axis=0).tolist()
        
        # Take attributes from highest confidence node
        highest_conf_node = max(nodes, key=lambda n: n.get("confidence", 0))
        
        # Combine labels if they differ
        labels = set(node.get("label", "Unknown") for node in nodes)
        if len(labels) == 1:
            merged_label = next(iter(labels))
        else:
            merged_label = "+".join(sorted(labels))
        
        # Create merged node
        merged_node = {
            "id": merged_id,
            "type": nodes[0].get("type", "unknown"),
            "label": merged_label,
            "position": avg_position,
            "size": avg_size,
            "confidence": sum(node.get("confidence", 1.0) for node in nodes) / len(nodes),
            "attributes": highest_conf_node.get("attributes", {}).copy(),
            "merged_from": [node["id"] for node in nodes]
        }
        
        return merged_node

# Health check function
def health_check():
    """
    Check if the scene graph service is operational.
    
    Returns:
        A dictionary with the health status
    """
    try:
        # Create a simple service instance
        service = SceneGraphService()
        
        # Check if the model is loaded
        if hasattr(service, 'model'):
            return {
                "status": "healthy",
                "timestamp": time.time(),
                "version": "1.0",
                "message": "Scene graph service is operational"
            }
        else:
            return {
                "status": "unhealthy",
                "timestamp": time.time(),
                "message": "Scene graph model not loaded"
            }
    except Exception as e:
        return {
            "status": "unhealthy",
            "timestamp": time.time(),
            "message": f"Scene graph service error: {str(e)}"
        }

# Main execution
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="3D Scene Graph Generation Service")
    parser.add_argument("--action", choices=["generate", "query", "health"], default="health", help="Action to perform")
    parser.add_argument("--input", help="Input file path (3D model, point cloud, or image)")
    parser.add_argument("--format", default="gltf", help="Format of the input file")
    parser.add_argument("--query", help="Query string for scene graph querying")
    parser.add_argument("--output", help="Output file path for saving results")
    
    args = parser.parse_args()
    
    if args.action == "health":
        print(json.dumps(health_check(), indent=2))
    
    elif args.action == "generate":
        if not args.input:
            print("Error: --input is required for 'generate' action")
            sys.exit(1)
        
        service = SceneGraphService()
        
        if args.input.lower().endswith((".ply", ".pcd")):
            result = service.generate_scene_graph_from_point_cloud(args.input)
        elif args.input.lower().endswith((".jpg", ".jpeg", ".png")):
            result = service.generate_scene_graph_from_images([args.input])
        else:
            result = service.generate_scene_graph_from_model(args.input, format=args.format)
        
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(result, f, indent=2)
        else:
            print(json.dumps(result, indent=2))
    
    elif args.action == "query":
        if not args.input or not args.query:
            print("Error: both --input and --query are required for 'query' action")
            sys.exit(1)
        
        service = SceneGraphService()
        
        # Load the scene graph from file
        with open(args.input, 'r') as f:
            scene_graph = json.load(f)
        
        # Query the scene graph
        results = service.query_scene_graph(scene_graph, args.query)
        
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(results, f, indent=2)
        else:
            print(json.dumps(results, indent=2))