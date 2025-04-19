#!/usr/bin/env python3
"""
Hybrid Retrieval System for Material Recognition

This module implements a multi-stage retrieval system combining:
1. Dense vector embedding search (semantic similarity)
2. Sparse vector search (keyword/feature matching)
3. Metadata filtering (structured property matching)
4. Ensemble approach for result blending
5. Contextualized re-ranking

The hybrid approach combines the strengths of different retrieval methods
to provide more accurate and relevant material search results.
"""

import os
import json
import time
import logging
import numpy as np
from typing import Dict, List, Tuple, Union, Optional, Any, Callable
from collections import defaultdict, Counter

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('hybrid_retriever')

# Try to import vector search module
try:
    from vector_search import (
        search_dense_vectors, 
        search_sparse_vectors,
        combine_search_results,
        create_dense_embedding
    )
    VECTOR_SEARCH_AVAILABLE = True
except ImportError:
    logger.warning("vector_search module not available. Some functionality will be limited.")
    VECTOR_SEARCH_AVAILABLE = False

# Try to import knowledge client for knowledge base integration
try:
    from knowledge_client import KnowledgeClient
    KNOWLEDGE_CLIENT_AVAILABLE = True
except ImportError:
    logger.warning("knowledge_client module not available. Knowledge base integration will be limited.")
    KNOWLEDGE_CLIENT_AVAILABLE = False


# ---- Hybrid Retriever Core ----

class HybridRetriever:
    """
    Hybrid retrieval system that combines multiple search strategies
    to provide more accurate and relevant results.
    """
    
    def __init__(self, vector_db_config: Dict[str, Any] = None,
                knowledge_base_config: Dict[str, Any] = None,
                use_dense_vectors: bool = True,
                use_sparse_vectors: bool = True,
                use_metadata_filtering: bool = True,
                use_knowledge_base: bool = True,
                dense_weight: float = 0.6,
                sparse_weight: float = 0.3,
                metadata_weight: float = 0.1,
                reranking_enabled: bool = True,
                filter_threshold: float = 0.5):
        """
        Initialize the hybrid retriever
        
        Args:
            vector_db_config: Configuration for vector database
            knowledge_base_config: Configuration for knowledge base
            use_dense_vectors: Whether to use dense vector search
            use_sparse_vectors: Whether to use sparse vector search
            use_metadata_filtering: Whether to use metadata filtering
            use_knowledge_base: Whether to use knowledge base
            dense_weight: Weight for dense vector results
            sparse_weight: Weight for sparse vector results
            metadata_weight: Weight for metadata filtering results
            reranking_enabled: Whether to enable re-ranking of results
            filter_threshold: Threshold for filtering results
        """
        self.vector_db_config = vector_db_config or {}
        self.knowledge_base_config = knowledge_base_config or {}
        
        # Feature flags
        self.use_dense_vectors = use_dense_vectors
        self.use_sparse_vectors = use_sparse_vectors
        self.use_metadata_filtering = use_metadata_filtering
        self.use_knowledge_base = use_knowledge_base and KNOWLEDGE_CLIENT_AVAILABLE
        
        # Search weights
        self.dense_weight = dense_weight
        self.sparse_weight = sparse_weight
        self.metadata_weight = metadata_weight
        
        # Normalize weights
        total_weight = self.dense_weight + self.sparse_weight + self.metadata_weight
        self.dense_weight /= total_weight
        self.sparse_weight /= total_weight
        self.metadata_weight /= total_weight
        
        # Re-ranking
        self.reranking_enabled = reranking_enabled
        self.filter_threshold = filter_threshold
        
        # Initialize clients
        self.vector_client = None
        self.knowledge_client = None
        self._initialize_clients()
        
        # Cache for query embeddings
        self.embedding_cache = {}
    
    def _initialize_clients(self):
        """Initialize database clients"""
        # Initialize vector search client if available
        if VECTOR_SEARCH_AVAILABLE:
            if self.use_dense_vectors or self.use_sparse_vectors:
                try:
                    # In a real implementation, this would connect to the vector database
                    self.vector_client = "initialized"
                    logger.info("Vector search client initialized")
                except Exception as e:
                    logger.error(f"Error initializing vector search client: {e}")
                    self.use_dense_vectors = False
                    self.use_sparse_vectors = False
        else:
            self.use_dense_vectors = False
            self.use_sparse_vectors = False
        
        # Initialize knowledge base client if available
        if KNOWLEDGE_CLIENT_AVAILABLE and self.use_knowledge_base:
            try:
                self.knowledge_client = KnowledgeClient(**self.knowledge_base_config)
                logger.info("Knowledge base client initialized")
            except Exception as e:
                logger.error(f"Error initializing knowledge base client: {e}")
                self.use_knowledge_base = False
    
    def search(self, query: str, filter_metadata: Dict[str, Any] = None, 
              num_results: int = 10, use_knowledge_base: bool = None) -> Dict[str, Any]:
        """
        Perform a hybrid search using the query
        
        Args:
            query: The search query (text)
            filter_metadata: Optional metadata filters to apply
            num_results: Number of results to return
            use_knowledge_base: Whether to use knowledge base (overrides instance setting)
            
        Returns:
            Dictionary containing search results and metadata
        """
        start_time = time.time()
        
        # Use instance setting if not specified
        if use_knowledge_base is None:
            use_knowledge_base = self.use_knowledge_base
        
        # Initialize search results container
        all_results = {
            "dense_results": [],
            "sparse_results": [],
            "metadata_results": [],
            "knowledge_base_results": [],
            "combined_results": [],
            "query": query,
            "search_metadata": {
                "total_time_ms": 0,
                "dense_time_ms": 0,
                "sparse_time_ms": 0,
                "metadata_time_ms": 0,
                "knowledge_base_time_ms": 0,
                "reranking_time_ms": 0,
                "filter_criteria": filter_metadata
            }
        }
        
        # Generate embeddings for the query
        query_embeddings = self._generate_query_embeddings(query)
        
        # Perform multi-stage retrieval
        dense_results = self._dense_vector_search(
            query, query_embeddings.get("dense"), filter_metadata, num_results
        ) if self.use_dense_vectors else []
        
        sparse_results = self._sparse_vector_search(
            query, query_embeddings.get("sparse"), filter_metadata, num_results
        ) if self.use_sparse_vectors else []
        
        metadata_results = self._metadata_search(
            query, filter_metadata, num_results
        ) if self.use_metadata_filtering else []
        
        # Get knowledge base results if enabled
        kb_start_time = time.time()
        knowledge_base_results = []
        if use_knowledge_base and self.knowledge_client:
            try:
                knowledge_base_results = self._knowledge_base_search(
                    query, filter_metadata, num_results
                )
            except Exception as e:
                logger.error(f"Error querying knowledge base: {e}")
        all_results["search_metadata"]["knowledge_base_time_ms"] = int((time.time() - kb_start_time) * 1000)
        
        # Combine results using ensemble approach
        ensemble_start_time = time.time()
        combined_results = self._combine_results(
            dense_results, sparse_results, metadata_results, knowledge_base_results, num_results
        )
        
        # Apply re-ranking if enabled
        if self.reranking_enabled and combined_results:
            combined_results = self._rerank_results(combined_results, query, query_embeddings)
        
        all_results["search_metadata"]["reranking_time_ms"] = int((time.time() - ensemble_start_time) * 1000)
        
        # Store results
        all_results["dense_results"] = dense_results
        all_results["sparse_results"] = sparse_results
        all_results["metadata_results"] = metadata_results
        all_results["knowledge_base_results"] = knowledge_base_results
        all_results["combined_results"] = combined_results
        
        # Calculate total time
        all_results["search_metadata"]["total_time_ms"] = int((time.time() - start_time) * 1000)
        
        return all_results
    
    def _generate_query_embeddings(self, query: str) -> Dict[str, np.ndarray]:
        """
        Generate dense and sparse embeddings for the query
        
        Args:
            query: The search query
            
        Returns:
            Dictionary containing dense and sparse embeddings
        """
        # Check if cached
        if query in self.embedding_cache:
            return self.embedding_cache[query]
        
        embeddings = {}
        
        # Generate dense embedding if available
        if VECTOR_SEARCH_AVAILABLE and self.use_dense_vectors:
            try:
                embeddings["dense"] = create_dense_embedding(query)
            except Exception as e:
                logger.error(f"Error generating dense embedding: {e}")
        
        # Generate sparse embedding (simplified for example)
        if VECTOR_SEARCH_AVAILABLE and self.use_sparse_vectors:
            try:
                # In a real implementation, this would use BM25 or a similar algorithm
                # Here we'll just use a simple bag of words approach
                tokens = query.lower().split()
                sparse_vec = np.zeros(1000)  # Assuming 1000-dim sparse space
                for token in tokens:
                    token_hash = hash(token) % 1000
                    sparse_vec[token_hash] += 1
                embeddings["sparse"] = sparse_vec
            except Exception as e:
                logger.error(f"Error generating sparse embedding: {e}")
        
        # Cache the embeddings
        self.embedding_cache[query] = embeddings
        
        return embeddings
    
    def _dense_vector_search(self, query: str, embedding: np.ndarray, 
                           filter_metadata: Dict[str, Any] = None, 
                           num_results: int = 10) -> List[Dict[str, Any]]:
        """
        Perform dense vector search
        
        Args:
            query: The search query
            embedding: The dense embedding vector
            filter_metadata: Optional metadata filters
            num_results: Number of results to return
            
        Returns:
            List of search results
        """
        if not embedding or not VECTOR_SEARCH_AVAILABLE:
            return []
        
        start_time = time.time()
        
        try:
            results = search_dense_vectors(
                embedding, 
                filter_criteria=filter_metadata,
                limit=num_results
            )
        except Exception as e:
            logger.error(f"Error in dense vector search: {e}")
            results = []
        
        # Record search time
        self.last_dense_time_ms = int((time.time() - start_time) * 1000)
        
        return results
    
    def _sparse_vector_search(self, query: str, embedding: np.ndarray, 
                            filter_metadata: Dict[str, Any] = None, 
                            num_results: int = 10) -> List[Dict[str, Any]]:
        """
        Perform sparse vector search
        
        Args:
            query: The search query
            embedding: The sparse embedding vector
            filter_metadata: Optional metadata filters
            num_results: Number of results to return
            
        Returns:
            List of search results
        """
        if not embedding or not VECTOR_SEARCH_AVAILABLE:
            return []
        
        start_time = time.time()
        
        try:
            results = search_sparse_vectors(
                embedding,
                filter_criteria=filter_metadata,
                limit=num_results
            )
        except Exception as e:
            logger.error(f"Error in sparse vector search: {e}")
            results = []
        
        # Record search time
        self.last_sparse_time_ms = int((time.time() - start_time) * 1000)
        
        return results
    
    def _metadata_search(self, query: str, filter_metadata: Dict[str, Any] = None, 
                       num_results: int = 10) -> List[Dict[str, Any]]:
        """
        Perform metadata-based search
        
        Args:
            query: The search query
            filter_metadata: Metadata filters to apply
            num_results: Number of results to return
            
        Returns:
            List of search results
        """
        if not filter_metadata:
            return []
        
        start_time = time.time()
        results = []
        
        try:
            # In a real implementation, this would query the database
            # Here we'll just return an empty list
            pass
        except Exception as e:
            logger.error(f"Error in metadata search: {e}")
        
        # Record search time
        self.last_metadata_time_ms = int((time.time() - start_time) * 1000)
        
        return results
    
    def _knowledge_base_search(self, query: str, filter_metadata: Dict[str, Any] = None, 
                             num_results: int = 10) -> List[Dict[str, Any]]:
        """
        Query the knowledge base
        
        Args:
            query: The search query
            filter_metadata: Optional metadata filters
            num_results: Number of results to return
            
        Returns:
            List of knowledge base results
        """
        if not self.knowledge_client:
            return []
        
        try:
            # Query the knowledge base
            kb_results = self.knowledge_client.query(
                query=query,
                filters=filter_metadata,
                limit=num_results
            )
            
            # Format results to match the structure of vector search results
            formatted_results = []
            for result in kb_results:
                formatted_results.append({
                    "id": result.get("id", ""),
                    "metadata": result.get("metadata", {}),
                    "source": "knowledge_base",
                    "score": result.get("relevance", 0.0),
                    "content": result.get("content", ""),
                    "knowledge_base_id": result.get("kb_id", "")
                })
            
            return formatted_results
        except Exception as e:
            logger.error(f"Error querying knowledge base: {e}")
            return []
    
    def _combine_results(self, dense_results: List[Dict[str, Any]], 
                        sparse_results: List[Dict[str, Any]],
                        metadata_results: List[Dict[str, Any]],
                        kb_results: List[Dict[str, Any]],
                        num_results: int = 10) -> List[Dict[str, Any]]:
        """
        Combine results from different search methods using an ensemble approach
        
        Args:
            dense_results: Results from dense vector search
            sparse_results: Results from sparse vector search
            metadata_results: Results from metadata filtering
            kb_results: Results from knowledge base
            num_results: Number of results to return
            
        Returns:
            Combined and ranked list of results
        """
        # Create a dictionary to store combined scores
        combined_scores = defaultdict(float)
        result_map = {}
        
        # Process dense vector results
        for i, result in enumerate(dense_results):
            result_id = result["id"]
            # Score based on rank and search score
            score = self.dense_weight * (result["score"] * (1.0 - i / len(dense_results)))
            combined_scores[result_id] += score
            result_map[result_id] = result
        
        # Process sparse vector results
        for i, result in enumerate(sparse_results):
            result_id = result["id"]
            score = self.sparse_weight * (result["score"] * (1.0 - i / len(sparse_results)))
            combined_scores[result_id] += score
            if result_id not in result_map:
                result_map[result_id] = result
        
        # Process metadata results
        for i, result in enumerate(metadata_results):
            result_id = result["id"]
            score = self.metadata_weight * (result["score"] * (1.0 - i / len(metadata_results)))
            combined_scores[result_id] += score
            if result_id not in result_map:
                result_map[result_id] = result
        
        # Process knowledge base results
        for i, result in enumerate(kb_results):
            result_id = result["id"]
            # Knowledge base results get a boost
            score = 0.2 * (result["score"] * (1.0 - i / len(kb_results)))
            combined_scores[result_id] += score
            if result_id not in result_map:
                result_map[result_id] = result
        
        # Sort results by combined score
        sorted_results = sorted(
            [(result_id, score) for result_id, score in combined_scores.items()],
            key=lambda x: x[1],
            reverse=True
        )
        
        # Create combined results list
        combined_results = []
        for result_id, score in sorted_results[:num_results]:
            result = result_map[result_id].copy()
            result["combined_score"] = score
            combined_results.append(result)
        
        return combined_results
    
    def _rerank_results(self, results: List[Dict[str, Any]], query: str, 
                       query_embeddings: Dict[str, np.ndarray]) -> List[Dict[str, Any]]:
        """
        Re-rank results using additional contextual information
        
        Args:
            results: Combined search results
            query: Original search query
            query_embeddings: Query embeddings
            
        Returns:
            Re-ranked list of results
        """
        # If no results or query embeddings, return as-is
        if not results or not query_embeddings:
            return results
        
        try:
            # In a real implementation, this might use a more sophisticated
            # re-ranking model, such as a learned ranking model
            # For simplicity, we'll apply a few rule-based adjustments
            
            # 1. Boost results that have matching material properties
            query_terms = set(query.lower().split())
            
            for result in results:
                # Initialize re-ranking score using combined score
                result["rerank_score"] = result["combined_score"]
                
                # Check metadata for property matches
                metadata = result.get("metadata", {})
                property_matches = 0
                
                for key, value in metadata.items():
                    if key.lower() in query_terms:
                        property_matches += 1
                    
                    if isinstance(value, str) and value.lower() in query_terms:
                        property_matches += 1
                
                # Apply property match boost
                result["rerank_score"] += property_matches * 0.05
                
                # Boost knowledge base results slightly
                if result.get("source") == "knowledge_base":
                    result["rerank_score"] += 0.1
            
            # Sort by reranking score
            results.sort(key=lambda x: x["rerank_score"], reverse=True)
        
        except Exception as e:
            logger.error(f"Error during re-ranking: {e}")
        
        return results
    
    def search_by_image(self, image_embedding: np.ndarray, 
                      filter_metadata: Dict[str, Any] = None,
                      num_results: int = 10) -> Dict[str, Any]:
        """
        Search for materials using an image embedding
        
        Args:
            image_embedding: Dense embedding of the image
            filter_metadata: Optional metadata filters
            num_results: Number of results to return
            
        Returns:
            Dictionary containing search results
        """
        start_time = time.time()
        
        # Initialize results container
        all_results = {
            "dense_results": [],
            "combined_results": [],
            "search_metadata": {
                "total_time_ms": 0,
                "dense_time_ms": 0,
                "filter_criteria": filter_metadata
            }
        }
        
        # Perform dense vector search only
        dense_results = []
        if VECTOR_SEARCH_AVAILABLE:
            try:
                dense_start_time = time.time()
                dense_results = search_dense_vectors(
                    image_embedding,
                    filter_criteria=filter_metadata,
                    limit=num_results
                )
                all_results["search_metadata"]["dense_time_ms"] = int((time.time() - dense_start_time) * 1000)
            except Exception as e:
                logger.error(f"Error in image-based search: {e}")
        
        # Store results
        all_results["dense_results"] = dense_results
        all_results["combined_results"] = dense_results  # For image search, we just use dense results
        
        # Calculate total time
        all_results["search_metadata"]["total_time_ms"] = int((time.time() - start_time) * 1000)
        
        return all_results
    
    def bulk_search(self, queries: List[str], 
                   filter_metadata: Dict[str, Any] = None,
                   num_results: int = 10) -> Dict[str, List[Dict[str, Any]]]:
        """
        Perform bulk searching for multiple queries
        
        Args:
            queries: List of search queries
            filter_metadata: Optional metadata filters
            num_results: Number of results per query
            
        Returns:
            Dictionary mapping query IDs to search results
        """
        results = {}
        
        for i, query in enumerate(queries):
            query_id = f"q{i}"
            try:
                results[query_id] = self.search(
                    query=query,
                    filter_metadata=filter_metadata,
                    num_results=num_results
                )
            except Exception as e:
                logger.error(f"Error processing query '{query}': {e}")
                results[query_id] = {"error": str(e)}
        
        return results


# ---- Context Assembly System ----

class ContextAssembler:
    """
    Assembles context from search results, knowledge base, and structured data.
    Creates a unified context for downstream processing.
    """
    
    def __init__(self, max_context_items: int = 5, knowledge_base_config: Dict[str, Any] = None):
        """
        Initialize context assembler
        
        Args:
            max_context_items: Maximum number of context items to include
            knowledge_base_config: Configuration for knowledge base client
        """
        self.max_context_items = max_context_items
        self.knowledge_base_config = knowledge_base_config or {}
        
        # Initialize knowledge base client if available
        self.knowledge_client = None
        if KNOWLEDGE_CLIENT_AVAILABLE:
            try:
                self.knowledge_client = KnowledgeClient(**self.knowledge_base_config)
            except Exception as e:
                logger.error(f"Error initializing knowledge base client: {e}")
    
    def assemble_context(self, search_results: Dict[str, Any], 
                        query: str = None,
                        include_metadata: bool = True,
                        include_relationships: bool = True) -> Dict[str, Any]:
        """
        Assemble context from search results
        
        Args:
            search_results: Results from hybrid search
            query: Original search query
            include_metadata: Whether to include metadata
            include_relationships: Whether to include relationships
            
        Returns:
            Assembled context
        """
        combined_results = search_results.get("combined_results", [])
        if not combined_results:
            return {"context_items": [], "query": query}
        
        # Select top results for context
        top_results = combined_results[:min(self.max_context_items, len(combined_results))]
        
        # Initialize context
        context = {
            "query": query,
            "context_items": [],
            "metadata": {
                "total_items": len(combined_results),
                "included_items": len(top_results),
                "sources": Counter([item.get("source", "unknown") for item in top_results])
            }
        }
        
        # Process each result
        for i, result in enumerate(top_results):
            context_item = {
                "id": result.get("id", f"item_{i}"),
                "content": result.get("content", ""),
                "source": result.get("source", "unknown"),
                "score": result.get("combined_score", 0.0)
            }
            
            # Add metadata if requested
            if include_metadata and "metadata" in result:
                context_item["metadata"] = result["metadata"]
            
            # Add relationships if requested and available
            if include_relationships and self.knowledge_client:
                try:
                    # Get related items from knowledge base
                    related_items = self._get_relationships(result.get("id"))
                    if related_items:
                        context_item["relationships"] = related_items
                except Exception as e:
                    logger.error(f"Error fetching relationships: {e}")
            
            context["context_items"].append(context_item)
        
        # Add additional context metadata
        if self.knowledge_client:
            try:
                context["knowledge_graph"] = self._get_knowledge_graph_context(query, top_results)
            except Exception as e:
                logger.error(f"Error fetching knowledge graph context: {e}")
        
        return context
    
    def _get_relationships(self, item_id: str) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get relationships for an item from the knowledge base
        
        Args:
            item_id: ID of the item
            
        Returns:
            Dictionary of relationship types and related items
        """
        if not self.knowledge_client:
            return {}
        
        try:
            return self.knowledge_client.get_relationships(item_id)
        except Exception as e:
            logger.error(f"Error getting relationships for {item_id}: {e}")
            return {}
    
    def _get_knowledge_graph_context(self, query: str, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Get additional context from the knowledge graph
        
        Args:
            query: Original search query
            results: Search results
            
        Returns:
            Knowledge graph context
        """
        if not self.knowledge_client:
            return {}
        
        # Extract entity IDs from results
        entity_ids = [result.get("id") for result in results if "id" in result]
        
        try:
            # Get common properties and relationships
            return self.knowledge_client.get_graph_context(entity_ids)
        except Exception as e:
            logger.error(f"Error getting knowledge graph context: {e}")
            return {}


# ---- Integration with LLM for Enhanced Responses ----

class GenerativeEnhancer:
    """
    Enhances search results with generative explanations, comparisons,
    and application recommendations using LLMs.
    """
    
    def __init__(self, llm_config: Dict[str, Any] = None):
        """
        Initialize generative enhancer
        
        Args:
            llm_config: Configuration for LLM client
        """
        self.llm_config = llm_config or {}
        
        # LLM client placeholder (would be initialized with actual LLM API in real system)
        self.llm_client = None
        
        # Prompt templates
        self.explanation_template = """
        Generate a concise explanation for the material '{material_name}' based on the following information:
        
        Properties:
        {properties}
        
        Additional Context:
        {context}
        
        Your explanation should cover:
        - Key characteristics of this material
        - Typical applications
        - Notable properties
        
        Keep the explanation factual and well-structured, based only on the provided information.
        """
        
        self.comparison_template = """
        Compare the following materials based on their properties:
        
        Material 1: {material1_name}
        {material1_properties}
        
        Material 2: {material2_name}
        {material2_properties}
        
        Generate a concise comparison covering:
        - Similarities
        - Key differences
        - Situations where one might be preferred over the other
        
        Keep the comparison factual and based only on the provided information.
        """
        
        self.application_template = """
        Based on the properties of the material '{material_name}':
        
        {properties}
        
        Generate recommendations for suitable applications, explaining why this material would work well for each.
        
        Consider factors like:
        - Physical properties
        - Aesthetic qualities
        - Common use cases
        - Environmental considerations
        
        Provide 3-5 specific applications with brief explanations for each.
        """
    
    def generate_explanation(self, material_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate an explanation for a material
        
        Args:
            material_data: Data about the material
            
        Returns:
            Generated explanation and metadata
        """
        # Extract material information
        material_name = material_data.get("name", "Unknown Material")
        properties = self._format_properties(material_data.get("metadata", {}))
        context = self._format_context(material_data.get("context", []))
        
        # Format prompt
        prompt = self.explanation_template.format(
            material_name=material_name,
            properties=properties,
            context=context
        )
        
        # Generate explanation
        explanation = self._generate_text(prompt)
        
        return {
            "material_id": material_data.get("id"),
            "material_name": material_name,
            "explanation": explanation,
            "generated_at": time.time(),
            "sources": self._extract_sources(material_data)
        }
    
    def generate_comparison(self, material1: Dict[str, Any], material2: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate a comparison between two materials
        
        Args:
            material1: Data about the first material
            material2: Data about the second material
            
        Returns:
            Generated comparison and metadata
        """
        # Extract material information
        material1_name = material1.get("name", "Material 1")
        material2_name = material2.get("name", "Material 2")
        
        material1_properties = self._format_properties(material1.get("metadata", {}))
        material2_properties = self._format_properties(material2.get("metadata", {}))
        
        # Format prompt
        prompt = self.comparison_template.format(
            material1_name=material1_name,
            material1_properties=material1_properties,
            material2_name=material2_name,
            material2_properties=material2_properties
        )
        
        # Generate comparison
        comparison = self._generate_text(prompt)
        
        return {
            "material1_id": material1.get("id"),
            "material1_name": material1_name,
            "material2_id": material2.get("id"),
            "material2_name": material2_name,
            "comparison": comparison,
            "generated_at": time.time(),
            "sources": self._extract_sources(material1) + self._extract_sources(material2)
        }
    
    def generate_applications(self, material_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate application recommendations for a material
        
        Args:
            material_data: Data about the material
            
        Returns:
            Generated applications and metadata
        """
        # Extract material information
        material_name = material_data.get("name", "Unknown Material")
        properties = self._format_properties(material_data.get("metadata", {}))
        
        # Format prompt
        prompt = self.application_template.format(
            material_name=material_name,
            properties=properties
        )
        
        # Generate applications
        applications = self._generate_text(prompt)
        
        return {
            "material_id": material_data.get("id"),
            "material_name": material_name,
            "applications": applications,
            "generated_at": time.time(),
            "sources": self._extract_sources(material_data)
        }
    
    def _format_properties(self, metadata: Dict[str, Any]) -> str:
        """Format material properties for the prompt"""
        if not metadata:
            return "No properties available."
        
        formatted = []
        for key, value in metadata.items():
            formatted.append(f"- {key}: {value}")
        
        return "\n".join(formatted)
    
    def _format_context(self, context_items: List[Dict[str, Any]]) -> str:
        """Format context items for the prompt"""
        if not context_items:
            return "No additional context available."
        
        formatted = []
        for item in context_items:
            content = item.get("content", "")
            source = item.get("source", "unknown")
            formatted.append(f"- {content} (Source: {source})")
        
        return "\n".join(formatted)
    
    def _extract_sources(self, material_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract source information for citations"""
        sources = []
        
        # Extract sources from context items
        for item in material_data.get("context", []):
            source = {
                "id": item.get("id"),
                "source_type": item.get("source"),
                "title": item.get("metadata", {}).get("title", "Unknown")
            }
            sources.append(source)
        
        return sources
    
    def _generate_text(self, prompt: str) -> str:
        """
        Generate text using an LLM
        
        Args:
            prompt: The prompt to send to the LLM
            
        Returns:
            Generated text
        """
        # In a real implementation, this would call an actual LLM API
        # For this example, we'll just return a placeholder message
        return f"This is a placeholder for generated text. In a real implementation, this would be generated by an LLM based on the prompt: '{prompt[:50]}...'"


# ---- RAG Service Orchestration ----

class MaterialRAGService:
    """
    Unified RAG service for material search and knowledge integration.
    Orchestrates the hybrid retriever, context assembler, and generative enhancer.
    """
    
    def __init__(self, vector_db_config: Dict[str, Any] = None,
                knowledge_base_config: Dict[str, Any] = None,
                llm_config: Dict[str, Any] = None,
                cache_results: bool = True,
                cache_ttl_seconds: int = 3600):
        """
        Initialize the RAG service
        
        Args:
            vector_db_config: Configuration for vector database
            knowledge_base_config: Configuration for knowledge base
            llm_config: Configuration for LLM client
            cache_results: Whether to cache results
            cache_ttl_seconds: Time-to-live for cached results in seconds
        """
        # Initialize components
        self.retriever = HybridRetriever(
            vector_db_config=vector_db_config,
            knowledge_base_config=knowledge_base_config
        )
        
        self.context_assembler = ContextAssembler(
            knowledge_base_config=knowledge_base_config
        )
        
        self.enhancer = GenerativeEnhancer(
            llm_config=llm_config
        )
        
        # Cache configuration
        self.cache_results = cache_results
        self.cache_ttl_seconds = cache_ttl_seconds
        self.result_cache = {}
        self.cache_timestamps = {}
    
    def search(self, query: str, filter_metadata: Dict[str, Any] = None,
              num_results: int = 10, enhance_results: bool = False,
              include_explanations: bool = False) -> Dict[str, Any]:
        """
        Perform a RAG search for materials
        
        Args:
            query: The search query
            filter_metadata: Optional metadata filters
            num_results: Number of results to return
            enhance_results: Whether to enhance results with generative content
            include_explanations: Whether to include explanations for top results
            
        Returns:
            Search results and enhancements
        """
        # Check cache
        cache_key = f"{query}_{json.dumps(filter_metadata or {})}_{num_results}_{enhance_results}_{include_explanations}"
        if self.cache_results and cache_key in self.result_cache:
            # Check if cache is still valid
            if time.time() - self.cache_timestamps[cache_key] < self.cache_ttl_seconds:
                return self.result_cache[cache_key]
        
        # Perform search
        search_results = self.retriever.search(
            query=query,
            filter_metadata=filter_metadata,
            num_results=num_results
        )
        
        # Assemble context
        context = self.context_assembler.assemble_context(
            search_results=search_results,
            query=query
        )
        
        # Add context to the response
        response = {
            "query": query,
            "results": search_results["combined_results"],
            "context": context,
            "metadata": search_results["search_metadata"]
        }
        
        # Enhance results if requested
        if enhance_results:
            enhancements = self._enhance_results(
                results=search_results["combined_results"],
                context=context,
                include_explanations=include_explanations
            )
            response["enhancements"] = enhancements
        
        # Cache results
        if self.cache_results:
            self.result_cache[cache_key] = response
            self.cache_timestamps[cache_key] = time.time()
        
        return response
    
    def _enhance_results(self, results: List[Dict[str, Any]], context: Dict[str, Any],
                       include_explanations: bool = False) -> Dict[str, Any]:
        """
        Enhance results with generative content
        
        Args:
            results: Search results
            context: Assembled context
            include_explanations: Whether to include explanations
            
        Returns:
            Result enhancements
        """
        enhancements = {}
        
        # If no results, return empty enhancements
        if not results:
            return enhancements
        
        # Generate explanation for top result if requested
        if include_explanations and results:
            top_result = results[0]
            top_result_with_context = {
                "id": top_result.get("id"),
                "name": top_result.get("metadata", {}).get("name", "Unknown Material"),
                "metadata": top_result.get("metadata", {}),
                "context": context.get("context_items", [])
            }
            
            explanation = self.enhancer.generate_explanation(top_result_with_context)
            enhancements["explanations"] = [explanation]
        
        # If there are at least two results, generate a comparison
        if len(results) >= 2:
            result1 = results[0]
            result2 = results[1]
            
            result1_with_context = {
                "id": result1.get("id"),
                "name": result1.get("metadata", {}).get("name", "Unknown Material"),
                "metadata": result1.get("metadata", {})
            }
            
            result2_with_context = {
                "id": result2.get("id"),
                "name": result2.get("metadata", {}).get("name", "Unknown Material"),
                "metadata": result2.get("metadata", {})
            }
            
            comparison = self.enhancer.generate_comparison(
                result1_with_context, result2_with_context
            )
            enhancements["comparisons"] = [comparison]
        
        # Generate application recommendations for top result
        if results:
            top_result = results[0]
            top_result_with_context = {
                "id": top_result.get("id"),
                "name": top_result.get("metadata", {}).get("name", "Unknown Material"),
                "metadata": top_result.get("metadata", {})
            }
            
            applications = self.enhancer.generate_applications(top_result_with_context)
            enhancements["applications"] = [applications]
        
        return enhancements
    
    def search_by_image(self, image_embedding: np.ndarray,
                      filter_metadata: Dict[str, Any] = None,
                      num_results: int = 10,
                      enhance_results: bool = False) -> Dict[str, Any]:
        """
        Search for materials using an image embedding
        
        Args:
            image_embedding: Dense embedding of the image
            filter_metadata: Optional metadata filters
            num_results: Number of results to return
            enhance_results: Whether to enhance results with generative content
            
        Returns:
            Search results and enhancements
        """
        # Perform image-based search
        search_results = self.retriever.search_by_image(
            image_embedding=image_embedding,
            filter_metadata=filter_metadata,
            num_results=num_results
        )
        
        # Assemble context
        context = self.context_assembler.assemble_context(
            search_results=search_results,
            query="[Image-based search]"
        )
        
        # Add context to the response
        response = {
            "results": search_results["combined_results"],
            "context": context,
            "metadata": search_results["search_metadata"]
        }
        
        # Enhance results if requested
        if enhance_results and search_results["combined_results"]:
            enhancements = self._enhance_results(
                results=search_results["combined_results"],
                context=context,
                include_explanations=True
            )
            response["enhancements"] = enhancements
        
        return response
    
    def compare_materials(self, material_id1: str, material_id2: str) -> Dict[str, Any]:
        """
        Compare two materials in detail
        
        Args:
            material_id1: ID of the first material
            material_id2: ID of the second material
            
        Returns:
            Detailed comparison
        """
        # Get material data from database (placeholder)
        material1 = {"id": material_id1, "name": f"Material {material_id1}"}
        material2 = {"id": material_id2, "name": f"Material {material_id2}"}
        
        # Generate comparison
        comparison = self.enhancer.generate_comparison(material1, material2)
        
        return {
            "material1": material1,
            "material2": material2,
            "comparison": comparison
        }
    
    def clear_cache(self) -> Dict[str, int]:
        """
        Clear the result cache
        
        Returns:
            Cache statistics
        """
        cache_size = len(self.result_cache)
        self.result_cache = {}
        self.cache_timestamps = {}
        
        return {
            "cleared_items": cache_size,
            "current_cache_size": 0
        }


# ---- Example Usage ----

def example_usage():
    """Example usage of the hybrid retrieval system"""
    
    # Initialize the hybrid retriever
    retriever = HybridRetriever(
        vector_db_config={"url": "example.com/vector_db"},
        knowledge_base_config={"url": "example.com/kb"}
    )
    
    # Perform a search
    results = retriever.search(
        query="red wood material with high durability",
        filter_metadata={"material_type": "wood", "color": "red"},
        num_results=5
    )
    
    print(f"Found {len(results['combined_results'])} results")
    print(f"Search took {results['search_metadata']['total_time_ms']}ms")
    
    # Initialize context assembler
    assembler = ContextAssembler()
    
    # Assemble context
    context = assembler.assemble_context(
        search_results=results,
        query="red wood material with high durability"
    )
    
    print(f"Assembled context with {len(context['context_items'])} items")
    
    # Initialize the RAG service
    rag_service = MaterialRAGService()
    
    # Perform a search with the RAG service
    rag_results = rag_service.search(
        query="red wood material with high durability",
        filter_metadata={"material_type": "wood", "color": "red"},
        num_results=5,
        enhance_results=True,
        include_explanations=True
    )
    
    print(f"RAG service returned {len(rag_results['results'])} results")
    if "enhancements" in rag_results:
        print("Enhancements included in the response")


if __name__ == "__main__":
    print("Hybrid Retrieval System for Material Recognition")
    example_usage()