#!/usr/bin/env python3
"""
Enhanced Text Embedding Generator

This module provides advanced text embedding generation capabilities for the RAG system,
supporting both dense and sparse embeddings with state-of-the-art models.

Features:
- Dense embedding generation using transformer models
- Sparse embedding generation with multiple algorithms (BM25, TF-IDF)
- Hybrid embedding support combining dense and sparse representations
- Material category-specific embedding tuning
- Optimized for use with pgvector in Supabase

Usage:
    python enhanced_text_embeddings.py [options] <text>

Options:
    --method                Embedding method: 'dense', 'sparse', or 'hybrid' (default: hybrid)
    --model                 Model to use for dense embeddings (default: all-MiniLM-L6-v2)
    --output-format         Output format: 'json' or 'binary' (default: json)
    --dimensions            Dimensions for dense embeddings (default: 384)
    --material-category     Optional material category for specialized embedding
"""

import os
import sys
import json
import logging
import time
import numpy as np
from typing import Dict, List, Any, Tuple, Optional, Union
from pathlib import Path
import pickle

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('enhanced_text_embeddings')

# Import necessary libraries
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    logger.warning("sentence-transformers library not available, dense embeddings will be limited")

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch not available, some models may not work")

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.feature_extraction.text import CountVectorizer
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logger.warning("scikit-learn not available, sparse embeddings will be limited")

try:
    import spacy
    SPACY_AVAILABLE = True
    try:
        nlp = spacy.load("en_core_web_sm")
    except:
        nlp = None
        logger.warning("spaCy model not found, please run: python -m spacy download en_core_web_sm")
except ImportError:
    SPACY_AVAILABLE = False
    nlp = None
    logger.warning("spaCy not available, text preprocessing will be limited")


# Default models
DEFAULT_DENSE_MODEL = "all-MiniLM-L6-v2"
DEFAULT_DIMENSIONS = 384


class DenseEmbeddingGenerator:
    """Generate dense vector embeddings from text using transformer models"""
    
    def __init__(self, model_name: str = DEFAULT_DENSE_MODEL, dimensions: int = DEFAULT_DIMENSIONS):
        """
        Initialize the dense embedding generator
        
        Args:
            model_name: Name of the pre-trained model to use
            dimensions: Dimensions of the output embedding vector
        """
        self.model_name = model_name
        self.dimensions = dimensions
        self.model = None
        
        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            logger.error("Cannot initialize dense embeddings: sentence-transformers not available")
            return
        
        try:
            # Load the model
            self.model = SentenceTransformer(model_name)
            logger.info(f"Loaded dense embedding model: {model_name}")
            
            # Check if dimensions match model output
            model_dim = self.model.get_sentence_embedding_dimension()
            if model_dim != dimensions:
                logger.warning(f"Model output dimension ({model_dim}) doesn't match requested dimension ({dimensions})")
                logger.warning("Will resize embeddings to match requested dimensions")
        except Exception as e:
            logger.error(f"Error loading dense embedding model: {e}")
            self.model = None
    
    def generate(self, text: str) -> np.ndarray:
        """
        Generate dense embedding for text
        
        Args:
            text: Input text
            
        Returns:
            Dense embedding vector
        """
        if self.model is None:
            logger.error("Dense embedding model not initialized")
            return np.zeros(self.dimensions, dtype=np.float32)
        
        try:
            # Generate embedding
            embedding = self.model.encode(text, convert_to_numpy=True)
            
            # Resize if needed
            if embedding.shape[0] != self.dimensions:
                if embedding.shape[0] > self.dimensions:
                    # Truncate
                    embedding = embedding[:self.dimensions]
                else:
                    # Pad with zeros
                    padding = np.zeros(self.dimensions - embedding.shape[0], dtype=np.float32)
                    embedding = np.concatenate([embedding, padding])
            
            # Normalize the vector to unit length
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
            
            return embedding
        except Exception as e:
            logger.error(f"Error generating dense embedding: {e}")
            return np.zeros(self.dimensions, dtype=np.float32)
    
    def batch_generate(self, texts: List[str]) -> np.ndarray:
        """
        Generate dense embeddings for multiple texts
        
        Args:
            texts: List of input texts
            
        Returns:
            Matrix of dense embedding vectors
        """
        if self.model is None:
            logger.error("Dense embedding model not initialized")
            return np.zeros((len(texts), self.dimensions), dtype=np.float32)
        
        try:
            # Generate embeddings
            embeddings = self.model.encode(texts, convert_to_numpy=True)
            
            # Resize if needed
            if embeddings.shape[1] != self.dimensions:
                resized_embeddings = np.zeros((len(texts), self.dimensions), dtype=np.float32)
                for i, embedding in enumerate(embeddings):
                    if embedding.shape[0] > self.dimensions:
                        # Truncate
                        resized_embeddings[i] = embedding[:self.dimensions]
                    else:
                        # Pad with zeros
                        resized_embeddings[i, :embedding.shape[0]] = embedding
                
                embeddings = resized_embeddings
            
            # Normalize each vector to unit length
            for i in range(embeddings.shape[0]):
                norm = np.linalg.norm(embeddings[i])
                if norm > 0:
                    embeddings[i] = embeddings[i] / norm
            
            return embeddings
        except Exception as e:
            logger.error(f"Error generating dense embeddings: {e}")
            return np.zeros((len(texts), self.dimensions), dtype=np.float32)


class SparseEmbeddingGenerator:
    """Generate sparse vector embeddings from text using TF-IDF or BM25"""
    
    def __init__(self, method: str = "tfidf", max_features: int = 10000, vocabulary: Optional[Dict[str, int]] = None):
        """
        Initialize the sparse embedding generator
        
        Args:
            method: Method to use (tfidf, bm25, count)
            max_features: Maximum number of features (tokens) in the sparse vector
            vocabulary: Optional fixed vocabulary mapping
        """
        self.method = method
        self.max_features = max_features
        self.vocabulary = vocabulary
        self.vectorizer = None
        
        if not SKLEARN_AVAILABLE:
            logger.error("Cannot initialize sparse embeddings: scikit-learn not available")
            return
        
        try:
            # Initialize vectorizer based on method
            if method == "tfidf":
                self.vectorizer = TfidfVectorizer(
                    max_features=max_features,
                    vocabulary=vocabulary,
                    analyzer='word',
                    token_pattern=r'\b\w+\b',
                    stop_words='english',
                    ngram_range=(1, 2),
                    use_idf=True,
                    norm='l2'
                )
            elif method == "bm25":
                # BM25 is a custom extension of TF-IDF
                self.vectorizer = TfidfVectorizer(
                    max_features=max_features,
                    vocabulary=vocabulary,
                    analyzer='word',
                    token_pattern=r'\b\w+\b',
                    stop_words='english',
                    ngram_range=(1, 2),
                    use_idf=True,
                    norm=None  # No normalization for BM25
                )
                # BM25 parameters
                self.k1 = 1.5
                self.b = 0.75
                # Need to fit on a corpus to calculate document lengths
                self.fitted = False
                self.avgdl = 0
                self.doc_len = []
            elif method == "count":
                self.vectorizer = CountVectorizer(
                    max_features=max_features,
                    vocabulary=vocabulary,
                    analyzer='word',
                    token_pattern=r'\b\w+\b',
                    stop_words='english',
                    ngram_range=(1, 2)
                )
            else:
                logger.error(f"Unknown sparse embedding method: {method}")
                self.vectorizer = None
            
            if self.vectorizer:
                logger.info(f"Initialized sparse embedding vectorizer: {method}")
        except Exception as e:
            logger.error(f"Error initializing sparse embedding generator: {e}")
            self.vectorizer = None
    
    def preprocess_text(self, text: str) -> str:
        """
        Preprocess text for sparse embedding
        
        Args:
            text: Input text
            
        Returns:
            Preprocessed text
        """
        if nlp is None:
            # Basic preprocessing if spaCy is not available
            text = text.lower()
            return text
        
        # Use spaCy for better preprocessing
        doc = nlp(text)
        tokens = [token.lemma_.lower() for token in doc if not token.is_stop and not token.is_punct]
        return " ".join(tokens)
    
    def fit(self, texts: List[str]) -> None:
        """
        Fit the vectorizer on a corpus of texts
        
        Args:
            texts: List of texts to fit on
        """
        if self.vectorizer is None:
            logger.error("Sparse embedding vectorizer not initialized")
            return
        
        try:
            # Preprocess texts
            preprocessed_texts = [self.preprocess_text(text) for text in texts]
            
            # Fit vectorizer
            self.vectorizer.fit(preprocessed_texts)
            
            # For BM25, calculate average document length
            if self.method == "bm25":
                X = self.vectorizer.transform(preprocessed_texts)
                self.doc_len = X.sum(1).A1
                self.avgdl = self.doc_len.mean()
                self.fitted = True
            
            logger.info(f"Fitted sparse embedding vectorizer on {len(texts)} texts")
        except Exception as e:
            logger.error(f"Error fitting sparse embedding vectorizer: {e}")
    
    def generate(self, text: str) -> Tuple[np.ndarray, np.ndarray]:
        """
        Generate sparse embedding for text
        
        Args:
            text: Input text
            
        Returns:
            Tuple of (indices, values) representing the sparse vector
        """
        if self.vectorizer is None:
            logger.error("Sparse embedding vectorizer not initialized")
            return (np.array([], dtype=np.int32), np.array([], dtype=np.float32))
        
        try:
            # Preprocess text
            preprocessed_text = self.preprocess_text(text)
            
            # Generate sparse vector
            X = self.vectorizer.transform([preprocessed_text])
            
            # Apply BM25 weighting if method is bm25
            if self.method == "bm25" and self.fitted:
                X_bm25 = self._apply_bm25(X)
                indices = X_bm25.indices
                values = X_bm25.data
            else:
                indices = X.indices
                values = X.data
            
            return (indices, values)
        except Exception as e:
            logger.error(f"Error generating sparse embedding: {e}")
            return (np.array([], dtype=np.int32), np.array([], dtype=np.float32))
    
    def batch_generate(self, texts: List[str]) -> List[Tuple[np.ndarray, np.ndarray]]:
        """
        Generate sparse embeddings for multiple texts
        
        Args:
            texts: List of input texts
            
        Returns:
            List of (indices, values) tuples representing sparse vectors
        """
        if self.vectorizer is None:
            logger.error("Sparse embedding vectorizer not initialized")
            return [(np.array([], dtype=np.int32), np.array([], dtype=np.float32))] * len(texts)
        
        try:
            # Preprocess texts
            preprocessed_texts = [self.preprocess_text(text) for text in texts]
            
            # Generate sparse vectors
            X = self.vectorizer.transform(preprocessed_texts)
            
            # Apply BM25 weighting if method is bm25
            if self.method == "bm25" and self.fitted:
                X = self._apply_bm25(X)
            
            # Convert to list of (indices, values) tuples
            result = []
            for i in range(X.shape[0]):
                Xi = X[i].tocsr()
                result.append((Xi.indices, Xi.data))
            
            return result
        except Exception as e:
            logger.error(f"Error generating sparse embeddings: {e}")
            return [(np.array([], dtype=np.int32), np.array([], dtype=np.float32))] * len(texts)
    
    def _apply_bm25(self, X):
        """
        Apply BM25 weighting to TF-IDF matrix
        
        Args:
            X: TF-IDF sparse matrix
            
        Returns:
            BM25-weighted sparse matrix
        """
        if not self.fitted:
            return X
        
        # Get document frequencies from the vectorizer
        df = self.vectorizer.idf_ - 1  # IDF values include a +1, so subtract it
        
        # Get average document length
        avgdl = self.avgdl
        
        # Get document length for this document
        dl = X.sum(1).A1
        
        # Calculate BM25 term weights
        k1 = self.k1
        b = self.b
        
        # Convert to CSR format for efficient row operations
        X = X.tocsr()
        
        # For each document (row)
        for i in range(X.shape[0]):
            # Get non-zero elements in this row
            row = X.getrow(i)
            indices = row.indices
            values = row.data
            
            # Calculate BM25 weights for each term
            for j in range(len(indices)):
                idx = indices[j]
                tf = values[j]
                idf = df[idx]
                
                # BM25 term frequency component
                tf_bm25 = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl[i] / avgdl))
                
                # BM25 score for this term
                bm25_score = tf_bm25 * idf
                
                # Update the value
                X[i, idx] = bm25_score
        
        return X
    
    def get_vocabulary(self) -> Dict[str, int]:
        """
        Get the vocabulary mapping
        
        Returns:
            Vocabulary dictionary mapping terms to indices
        """
        if self.vectorizer is None:
            logger.error("Sparse embedding vectorizer not initialized")
            return {}
        
        return self.vectorizer.vocabulary_
    
    def save(self, path: str) -> bool:
        """
        Save the vectorizer to a file
        
        Args:
            path: Path to save the vectorizer
            
        Returns:
            True if successful, False otherwise
        """
        if self.vectorizer is None:
            logger.error("Sparse embedding vectorizer not initialized")
            return False
        
        try:
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(path), exist_ok=True)
            
            # Save the vectorizer
            with open(path, 'wb') as f:
                pickle.dump({
                    'vectorizer': self.vectorizer,
                    'method': self.method,
                    'max_features': self.max_features,
                    'fitted': getattr(self, 'fitted', False),
                    'avgdl': getattr(self, 'avgdl', 0),
                    'k1': getattr(self, 'k1', 1.5),
                    'b': getattr(self, 'b', 0.75)
                }, f)
            
            logger.info(f"Saved sparse embedding vectorizer to {path}")
            return True
        except Exception as e:
            logger.error(f"Error saving sparse embedding vectorizer: {e}")
            return False
    
    @classmethod
    def load(cls, path: str) -> 'SparseEmbeddingGenerator':
        """
        Load a vectorizer from a file
        
        Args:
            path: Path to load the vectorizer from
            
        Returns:
            SparseEmbeddingGenerator instance
        """
        try:
            with open(path, 'rb') as f:
                data = pickle.load(f)
            
            # Create new instance
            instance = cls(method=data['method'], max_features=data['max_features'])
            
            # Set attributes from loaded data
            instance.vectorizer = data['vectorizer']
            
            # Load BM25 specific attributes if present
            if data['method'] == 'bm25':
                instance.fitted = data.get('fitted', False)
                instance.avgdl = data.get('avgdl', 0)
                instance.k1 = data.get('k1', 1.5)
                instance.b = data.get('b', 0.75)
            
            logger.info(f"Loaded sparse embedding vectorizer from {path}")
            return instance
        except Exception as e:
            logger.error(f"Error loading sparse embedding vectorizer: {e}")
            return cls()


class HybridEmbeddingGenerator:
    """Generate hybrid embeddings combining dense and sparse representations"""
    
    def __init__(self, 
                dense_model: str = DEFAULT_DENSE_MODEL, 
                dense_dimensions: int = DEFAULT_DIMENSIONS,
                sparse_method: str = "tfidf",
                sparse_features: int = 10000,
                material_category: Optional[str] = None):
        """
        Initialize the hybrid embedding generator
        
        Args:
            dense_model: Name of the pre-trained model for dense embeddings
            dense_dimensions: Dimensions of the dense embedding vector
            sparse_method: Method for sparse embeddings (tfidf, bm25, count)
            sparse_features: Maximum number of features for sparse embeddings
            material_category: Optional material category for specialized embeddings
        """
        self.dense_dimensions = dense_dimensions
        self.sparse_features = sparse_features
        self.material_category = material_category
        
        # Initialize dense embedding generator
        self.dense_generator = DenseEmbeddingGenerator(
            model_name=dense_model,
            dimensions=dense_dimensions
        )
        
        # Initialize sparse embedding generator
        self.sparse_generator = SparseEmbeddingGenerator(
            method=sparse_method,
            max_features=sparse_features
        )
        
        # Initialize category-specific generators if category is provided
        self.category_dense_generator = None
        self.category_sparse_generator = None
        
        if material_category:
            # Try to load category-specific models if they exist
            category_model_dir = os.path.join("models", "embeddings", material_category)
            
            if os.path.exists(os.path.join(category_model_dir, "dense_model")):
                self.category_dense_generator = DenseEmbeddingGenerator(
                    model_name=os.path.join(category_model_dir, "dense_model"),
                    dimensions=dense_dimensions
                )
            
            sparse_path = os.path.join(category_model_dir, "sparse_vectorizer.pkl")
            if os.path.exists(sparse_path):
                self.category_sparse_generator = SparseEmbeddingGenerator.load(sparse_path)
    
    def generate(self, text: str) -> Dict[str, Any]:
        """
        Generate hybrid embedding for text
        
        Args:
            text: Input text
            
        Returns:
            Dictionary with dense and sparse embeddings
        """
        start_time = time.time()
        
        # Use category-specific generators if available
        dense_gen = self.category_dense_generator or self.dense_generator
        sparse_gen = self.category_sparse_generator or self.sparse_generator
        
        # Generate dense embedding
        dense_vector = dense_gen.generate(text)
        
        # Generate sparse embedding
        sparse_indices, sparse_values = sparse_gen.generate(text)
        
        # Prepare result
        result = {
            "dense_vector": dense_vector.tolist(),
            "sparse_indices": sparse_indices.tolist(),
            "sparse_values": sparse_values.tolist(),
            "dense_dimensions": self.dense_dimensions,
            "sparse_dimensions": self.sparse_features,
            "material_category": self.material_category,
            "processing_time": time.time() - start_time
        }
        
        return result
    
    def batch_generate(self, texts: List[str]) -> List[Dict[str, Any]]:
        """
        Generate hybrid embeddings for multiple texts
        
        Args:
            texts: List of input texts
            
        Returns:
            List of dictionaries with dense and sparse embeddings
        """
        start_time = time.time()
        
        # Use category-specific generators if available
        dense_gen = self.category_dense_generator or self.dense_generator
        sparse_gen = self.category_sparse_generator or self.sparse_generator
        
        # Generate dense embeddings
        dense_vectors = dense_gen.batch_generate(texts)
        
        # Generate sparse embeddings
        sparse_embeddings = sparse_gen.batch_generate(texts)
        
        # Prepare results
        results = []
        for i in range(len(texts)):
            results.append({
                "dense_vector": dense_vectors[i].tolist(),
                "sparse_indices": sparse_embeddings[i][0].tolist(),
                "sparse_values": sparse_embeddings[i][1].tolist(),
                "dense_dimensions": self.dense_dimensions,
                "sparse_dimensions": self.sparse_features,
                "material_category": self.material_category
            })
        
        # Add total processing time
        batch_time = time.time() - start_time
        for result in results:
            result["processing_time"] = batch_time / len(texts)
        
        return results


def generate_text_embedding(text: str,
                           method: str = "hybrid",
                           dense_model: str = DEFAULT_DENSE_MODEL,
                           dense_dimensions: int = DEFAULT_DIMENSIONS,
                           sparse_method: str = "tfidf",
                           sparse_features: int = 10000,
                           material_category: Optional[str] = None) -> Dict[str, Any]:
    """
    Generate text embedding using the specified method
    
    Args:
        text: Input text
        method: Embedding method (dense, sparse, hybrid)
        dense_model: Model for dense embeddings
        dense_dimensions: Dimensions for dense embeddings
        sparse_method: Method for sparse embeddings
        sparse_features: Maximum features for sparse embeddings
        material_category: Optional material category
        
    Returns:
        Dictionary with embedding and metadata
    """
    start_time = time.time()
    
    result = {
        "text_length": len(text),
        "method": method,
        "material_category": material_category,
        "timestamp": time.time()
    }
    
    try:
        if method == "dense":
            # Dense embedding only
            generator = DenseEmbeddingGenerator(
                model_name=dense_model,
                dimensions=dense_dimensions
            )
            vector = generator.generate(text)
            
            result["dense_vector"] = vector.tolist()
            result["dimensions"] = dense_dimensions
            
        elif method == "sparse":
            # Sparse embedding only
            generator = SparseEmbeddingGenerator(
                method=sparse_method,
                max_features=sparse_features
            )
            indices, values = generator.generate(text)
            
            result["sparse_indices"] = indices.tolist()
            result["sparse_values"] = values.tolist()
            result["sparse_dimensions"] = sparse_features
            
        else:  # hybrid
            # Both dense and sparse
            generator = HybridEmbeddingGenerator(
                dense_model=dense_model,
                dense_dimensions=dense_dimensions,
                sparse_method=sparse_method,
                sparse_features=sparse_features,
                material_category=material_category
            )
            
            hybrid_result = generator.generate(text)
            result.update(hybrid_result)
    
    except Exception as e:
        logger.error(f"Error generating text embedding: {e}")
        result["error"] = str(e)
    
    # Add processing time
    result["processing_time"] = time.time() - start_time
    
    return result


def convert_to_pgvector(embedding_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert embedding results to a format suitable for pgvector storage
    
    Args:
        embedding_result: Embedding result from generate_text_embedding
        
    Returns:
        Dictionary with pgvector-compatible formats
    """
    result = {
        "metadata": {
            "text_length": embedding_result.get("text_length", 0),
            "method": embedding_result.get("method", "hybrid"),
            "material_category": embedding_result.get("material_category"),
            "processing_time": embedding_result.get("processing_time", 0),
            "timestamp": embedding_result.get("timestamp", time.time())
        }
    }
    
    # For dense vector, convert to PostgreSQL array format
    if "dense_vector" in embedding_result:
        dense_vector = embedding_result["dense_vector"]
        result["dense_vector"] = dense_vector
    
    # For sparse vector, convert to PostgreSQL composite format
    if "sparse_indices" in embedding_result and "sparse_values" in embedding_result:
        sparse_indices = embedding_result["sparse_indices"]
        sparse_values = embedding_result["sparse_values"]
        
        # Format for pgvector storage as JSON
        sparse_vector = {
            "indices": sparse_indices,
            "values": sparse_values,
            "dimensions": embedding_result.get("sparse_dimensions", len(sparse_indices) if sparse_indices else 0)
        }
        
        result["sparse_vector"] = sparse_vector
    
    return result


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate text embeddings")
    parser.add_argument("text", help="Text to generate embeddings for")
    parser.add_argument("--method", choices=["dense", "sparse", "hybrid"], 
                        default="hybrid", help="Embedding method")
    parser.add_argument("--dense-model", default=DEFAULT_DENSE_MODEL,
                        help="Model for dense embeddings")
    parser.add_argument("--dense-dimensions", type=int, default=DEFAULT_DIMENSIONS,
                        help="Dimensions for dense embeddings")
    parser.add_argument("--sparse-method", choices=["tfidf", "bm25", "count"],
                        default="tfidf", help="Method for sparse embeddings")
    parser.add_argument("--sparse-features", type=int, default=10000,
                        help="Maximum features for sparse embeddings")
    parser.add_argument("--material-category", help="Material category")
    parser.add_argument("--pgvector-format", action="store_true",
                        help="Output in pgvector-compatible format")
    
    args = parser.parse_args()
    
    try:
        # Generate embedding
        result = generate_text_embedding(
            text=args.text,
            method=args.method,
            dense_model=args.dense_model,
            dense_dimensions=args.dense_dimensions,
            sparse_method=args.sparse_method,
            sparse_features=args.sparse_features,
            material_category=args.material_category
        )
        
        # Convert to pgvector format if requested
        if args.pgvector_format:
            result = convert_to_pgvector(result)
        
        # Print result as JSON
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)