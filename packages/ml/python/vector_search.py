#!/usr/bin/env python3
"""
Vector Search for Material Recognition

This script implements efficient similarity search for material images using vector embeddings.
It uses FAISS for fast approximate nearest neighbor search.

Usage:
    python vector_search.py <command> [options]

Commands:
    index       Create a search index from embeddings
    search      Search for similar materials using an image
    visualize   Visualize search results

Options:
    --embeddings-dir    Directory containing embedding files
    --index-path        Path to save/load the search index
    --image-path        Path to the query image
    --num-results       Number of results to return
    --threshold         Similarity threshold (0-1)
"""

import os
import sys
import json
import argparse
import numpy as np
from pathlib import Path
import time
from tqdm import tqdm
import matplotlib.pyplot as plt
import cv2
from typing import Dict, List, Any, Tuple, Optional

# Import embedding generator
from embedding_generator import generate_embedding

# Check for FAISS
try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    print("Warning: FAISS is not available. Using NumPy for vector search (slower).")


class VectorSearchIndex:
    """Vector search index for material embeddings"""
    
    def __init__(self, index_path: Optional[str] = None):
        """
        Initialize the vector search index
        
        Args:
            index_path: Path to load an existing index
        """
        self.index = None
        self.dimension = None
        self.material_ids = []
        self.metadata = {}
        
        if index_path and os.path.exists(index_path):
            self.load(index_path)
    
    def build(self, embeddings: np.ndarray, material_ids: List[str], metadata: Dict[str, Any] = None):
        """
        Build a search index from embeddings
        
        Args:
            embeddings: Matrix of embedding vectors (n_samples, dimension)
            material_ids: List of material IDs corresponding to embeddings
            metadata: Additional metadata for the index
        """
        if not FAISS_AVAILABLE:
            print("Warning: FAISS is not available. Using NumPy for vector search (slower).")
            self.index = embeddings
        else:
            # Get embedding dimension
            n_samples, dimension = embeddings.shape
            
            # Create FAISS index
            # Using L2 distance and IndexFlatL2 for exact search
            # For larger datasets, consider using approximate methods like IndexIVFFlat
            self.index = faiss.IndexFlatL2(dimension)
            
            # Add embeddings to the index
            self.index.add(embeddings.astype(np.float32))
        
        self.dimension = embeddings.shape[1]
        self.material_ids = material_ids
        self.metadata = metadata or {}
    
    def search(self, query_embedding: np.ndarray, k: int = 5) -> Tuple[List[str], List[float]]:
        """
        Search for similar materials
        
        Args:
            query_embedding: Query embedding vector
            k: Number of results to return
            
        Returns:
            Tuple of (material_ids, distances)
        """
        if self.index is None:
            raise ValueError("Index not built or loaded")
        
        # Ensure query is 2D
        if query_embedding.ndim == 1:
            query_embedding = query_embedding.reshape(1, -1)
        
        if not FAISS_AVAILABLE:
            # Compute L2 distances using NumPy
            distances = np.linalg.norm(self.index - query_embedding, axis=1)
            indices = np.argsort(distances)[:k]
            distances = distances[indices]
        else:
            # Search using FAISS
            distances, indices = self.index.search(query_embedding.astype(np.float32), k)
            distances = distances[0]
            indices = indices[0]
        
        # Get material IDs for the results
        result_material_ids = [self.material_ids[i] for i in indices]
        
        # Convert distances to similarity scores (1 - normalized distance)
        max_dist = np.max(distances) if len(distances) > 0 else 1.0
        similarities = [1.0 - (d / max_dist) for d in distances]
        
        return result_material_ids, similarities
    
    def save(self, index_path: str):
        """
        Save the index to a file
        
        Args:
            index_path: Path to save the index
        """
        os.makedirs(os.path.dirname(index_path), exist_ok=True)
        
        # Save the index
        if FAISS_AVAILABLE:
            faiss.write_index(self.index, index_path)
        else:
            np.save(index_path, self.index)
        
        # Save metadata
        metadata_path = os.path.splitext(index_path)[0] + "_metadata.json"
        with open(metadata_path, "w") as f:
            json.dump({
                "dimension": self.dimension,
                "material_ids": self.material_ids,
                "metadata": self.metadata
            }, f, indent=2)
    
    def load(self, index_path: str):
        """
        Load the index from a file
        
        Args:
            index_path: Path to load the index from
        """
        if not os.path.exists(index_path):
            raise FileNotFoundError(f"Index file not found: {index_path}")
        
        # Load metadata
        metadata_path = os.path.splitext(index_path)[0] + "_metadata.json"
        if not os.path.exists(metadata_path):
            raise FileNotFoundError(f"Metadata file not found: {metadata_path}")
        
        with open(metadata_path, "r") as f:
            metadata_dict = json.load(f)
            self.dimension = metadata_dict["dimension"]
            self.material_ids = metadata_dict["material_ids"]
            self.metadata = metadata_dict["metadata"]
        
        # Load the index
        if FAISS_AVAILABLE:
            self.index = faiss.read_index(index_path)
        else:
            self.index = np.load(index_path)


def create_index_from_embeddings(embeddings_dir: str, index_path: str):
    """
    Create a search index from embedding files
    
    Args:
        embeddings_dir: Directory containing embedding files
        index_path: Path to save the search index
    """
    # Check if embeddings directory exists
    if not os.path.exists(embeddings_dir):
        raise FileNotFoundError(f"Embeddings directory not found: {embeddings_dir}")
    
    # Get all embedding files
    embedding_files = []
    for ext in ['json', 'npy']:
        embedding_files.extend(list(Path(embeddings_dir).glob(f"**/*.{ext}")))
    
    if not embedding_files:
        raise ValueError(f"No embedding files found in {embeddings_dir}")
    
    print(f"Found {len(embedding_files)} embedding files")
    
    # Load embeddings
    embeddings = []
    material_ids = []
    metadata = {"materials": {}}
    
    for file_path in tqdm(embedding_files, desc="Loading embeddings"):
        try:
            if file_path.suffix == '.json':
                with open(file_path, "r") as f:
                    data = json.load(f)
                    
                    # Extract embedding vector
                    if "vector" in data:
                        vector = np.array(data["vector"], dtype=np.float32)
                        
                        # Extract material ID
                        material_id = data.get("materialId", os.path.splitext(file_path.name)[0])
                        
                        embeddings.append(vector)
                        material_ids.append(material_id)
                        
                        # Add metadata
                        metadata["materials"][material_id] = {
                            "id": material_id,
                            "name": data.get("name", material_id.replace("_", " ").title()),
                            "path": str(file_path),
                            "dimensions": data.get("dimensions", len(vector))
                        }
            elif file_path.suffix == '.npy':
                vector = np.load(file_path)
                material_id = os.path.splitext(file_path.name)[0]
                
                embeddings.append(vector)
                material_ids.append(material_id)
                
                # Add metadata
                metadata["materials"][material_id] = {
                    "id": material_id,
                    "name": material_id.replace("_", " ").title(),
                    "path": str(file_path),
                    "dimensions": len(vector)
                }
        except Exception as e:
            print(f"Error loading embedding from {file_path}: {e}", file=sys.stderr)
    
    if not embeddings:
        raise ValueError("No valid embeddings found")
    
    # Convert to numpy array
    embeddings_array = np.array(embeddings, dtype=np.float32)
    
    # Create search index
    index = VectorSearchIndex()
    index.build(embeddings_array, material_ids, metadata)
    
    # Save index
    index.save(index_path)
    
    print(f"Search index created with {len(embeddings)} embeddings and saved to {index_path}")
    
    return {
        "index_path": index_path,
        "metadata_path": os.path.splitext(index_path)[0] + "_metadata.json",
        "num_embeddings": len(embeddings),
        "dimension": embeddings_array.shape[1]
    }


def search_similar_materials(index_path: str, image_path: str, num_results: int = 5, threshold: float = 0.0):
    """
    Search for similar materials using an image
    
    Args:
        index_path: Path to the search index
        image_path: Path to the query image
        num_results: Number of results to return
        threshold: Similarity threshold (0-1)
        
    Returns:
        Dictionary with search results
    """
    # Check if index exists
    if not os.path.exists(index_path):
        raise FileNotFoundError(f"Index file not found: {index_path}")
    
    # Check if image exists
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")
    
    # Load search index
    index = VectorSearchIndex(index_path)
    
    # Generate embedding for the query image
    start_time = time.time()
    embedding_result = generate_embedding(image_path, method='hybrid')
    embedding_time = time.time() - start_time
    
    query_embedding = np.array(embedding_result["vector"], dtype=np.float32)
    
    # Search for similar materials
    start_time = time.time()
    material_ids, similarities = index.search(query_embedding, num_results)
    search_time = time.time() - start_time
    
    # Filter by threshold
    filtered_results = []
    for material_id, similarity in zip(material_ids, similarities):
        if similarity >= threshold:
            material_metadata = index.metadata.get("materials", {}).get(material_id, {})
            filtered_results.append({
                "materialId": material_id,
                "similarity": float(similarity),
                "metadata": material_metadata
            })
    
    # Prepare result
    result = {
        "query": {
            "imagePath": image_path,
            "embeddingDimensions": query_embedding.shape[0],
            "embeddingTime": embedding_time
        },
        "results": filtered_results,
        "searchTime": search_time,
        "totalTime": embedding_time + search_time
    }
    
    return result


def visualize_search_results(index_path: str, image_path: str, num_results: int = 5, output_path: Optional[str] = None):
    """
    Visualize search results
    
    Args:
        index_path: Path to the search index
        image_path: Path to the query image
        num_results: Number of results to return
        output_path: Path to save the visualization image
        
    Returns:
        Path to the saved visualization image
    """
    # Search for similar materials
    search_result = search_similar_materials(index_path, image_path, num_results)
    
    # Load query image
    query_image = cv2.imread(image_path)
    query_image = cv2.cvtColor(query_image, cv2.COLOR_BGR2RGB)
    
    # Create figure
    fig, axes = plt.subplots(1, min(num_results + 1, len(search_result["results"]) + 1), figsize=(15, 5))
    
    # Display query image
    axes[0].imshow(query_image)
    axes[0].set_title("Query Image")
    axes[0].axis("off")
    
    # Display result images
    for i, result in enumerate(search_result["results"]):
        if i >= num_results:
            break
            
        material_id = result["materialId"]
        similarity = result["similarity"]
        
        # Try to load result image
        material_path = result["metadata"].get("path", "")
        if material_path and os.path.exists(material_path):
            # If the path is to an embedding file, try to find the corresponding image
            if material_path.endswith((".json", ".npy")):
                # Try common image extensions
                for ext in [".jpg", ".jpeg", ".png", ".webp"]:
                    img_path = os.path.splitext(material_path)[0] + ext
                    if os.path.exists(img_path):
                        material_path = img_path
                        break
            
            if os.path.exists(material_path) and material_path.endswith((".jpg", ".jpeg", ".png", ".webp")):
                result_image = cv2.imread(material_path)
                result_image = cv2.cvtColor(result_image, cv2.COLOR_BGR2RGB)
                axes[i+1].imshow(result_image)
            else:
                # Display placeholder
                axes[i+1].text(0.5, 0.5, "Image not found", ha="center", va="center")
                axes[i+1].set_facecolor("#f0f0f0")
        else:
            # Display placeholder
            axes[i+1].text(0.5, 0.5, "Image not found", ha="center", va="center")
            axes[i+1].set_facecolor("#f0f0f0")
        
        axes[i+1].set_title(f"{material_id}\nSimilarity: {similarity:.2f}")
        axes[i+1].axis("off")
    
    plt.tight_layout()
    
    # Save or show the visualization
    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        plt.savefig(output_path)
        plt.close()
        return output_path
    else:
        plt.show()
        return None


def main():
    """Main function to parse arguments and run commands"""
    parser = argparse.ArgumentParser(description="Vector search for material recognition")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Index command
    index_parser = subparsers.add_parser("index", help="Create a search index from embeddings")
    index_parser.add_argument("--embeddings-dir", required=True,
                             help="Directory containing embedding files")
    index_parser.add_argument("--index-path", required=True,
                             help="Path to save the search index")
    
    # Search command
    search_parser = subparsers.add_parser("search", help="Search for similar materials using an image")
    search_parser.add_argument("--index-path", required=True,
                              help="Path to the search index")
    search_parser.add_argument("--image-path", required=True,
                              help="Path to the query image")
    search_parser.add_argument("--num-results", type=int, default=5,
                              help="Number of results to return")
    search_parser.add_argument("--threshold", type=float, default=0.0,
                              help="Similarity threshold (0-1)")
    
    # Visualize command
    visualize_parser = subparsers.add_parser("visualize", help="Visualize search results")
    visualize_parser.add_argument("--index-path", required=True,
                                 help="Path to the search index")
    visualize_parser.add_argument("--image-path", required=True,
                                 help="Path to the query image")
    visualize_parser.add_argument("--num-results", type=int, default=5,
                                 help="Number of results to return")
    visualize_parser.add_argument("--output-path",
                                 help="Path to save the visualization image")
    
    args = parser.parse_args()
    
    try:
        if args.command == "index":
            result = create_index_from_embeddings(args.embeddings_dir, args.index_path)
            print(json.dumps(result, indent=2))
            
        elif args.command == "search":
            result = search_similar_materials(args.index_path, args.image_path, args.num_results, args.threshold)
            print(json.dumps(result, indent=2))
            
        elif args.command == "visualize":
            output_path = visualize_search_results(args.index_path, args.image_path, args.num_results, args.output_path)
            if output_path:
                print(f"Visualization saved to: {output_path}")
            
        else:
            parser.print_help()
            
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()