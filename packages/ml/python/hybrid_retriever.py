#!/usr/bin/env python3
"""
Hybrid Retrieval System for RAG

This module implements an advanced hybrid retrieval system that combines:
1. Dense vector retrieval
2. Sparse vector retrieval 
3. Metadata-based filtering
4. Ensemble result blending
5. Contextualized re-ranking

It works with the enhanced vector storage in Supabase to provide
high-quality, relevant results for the RAG (Retrieval Augmented Generation) system.
"""

import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple, Union, cast, Set

import numpy as np
from scipy.spatial.distance import cosine
from sklearn.feature_extraction.text import TfidfVectorizer

# Import local modules
from adaptive_hybrid_embeddings import AdaptiveHybridEmbedding
from embedding_generator import EmbeddingGenerator
from vector_search import VectorSearchClient
from progress_reporter import ProgressReporter

# Set up logging
logger = logging.getLogger("hybrid_retriever")
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Type aliases
ResultItem = Dict[str, Any]
ResultList = List[ResultItem]
EmbeddingVector = List[float]
SparseEmbedding = Dict[str, Union[List[int], List[float], int]]


# Type aliases
ResultItem = Dict[str, Any]
ResultList = List[ResultItem]
EmbeddingVector = List[float]
SparseEmbedding = Dict[str, Union[List[int], List[float], int]]
KnowledgeEntry = Dict[str, Any]
KnowledgeList = List[KnowledgeEntry]
MaterialRelationship = Dict[str, Any]
RelationshipList = List[MaterialRelationship]


class HybridRetriever:
    """
    Hybrid Retrieval System implementing multi-stage retrieval, ensemble result blending,
    and contextualized re-ranking for the RAG system.
    """
    
    def __init__(
        self,
        vector_client: Optional[VectorSearchClient] = None,
        embedding_generator: Optional[EmbeddingGenerator] = None,
        config: Optional[Dict[str, Any]] = None,
        progress_reporter: Optional[ProgressReporter] = None,
        knowledge_client=None
    ):
        """
        Initialize the Hybrid Retriever.
        
        Args:
            vector_client: Client for vector database interaction
            embedding_generator: Generator for text embeddings
            config: Configuration parameters for retrieval
            progress_reporter: Reporter for tracking progress
            knowledge_client: Optional client for knowledge base interaction
        """
        self.vector_client = vector_client or VectorSearchClient()
        self.embedding_generator = embedding_generator or EmbeddingGenerator()
        self.adaptive_embeddings = AdaptiveHybridEmbedding()
        self.progress_reporter = progress_reporter
        self.knowledge_client = knowledge_client
        
        # Default configuration
        self.config = {
            # Weights for ensemble blending
            "dense_weight": 0.7,
            "sparse_weight": 0.2,
            "metadata_weight": 0.1,
            
            # Retrieval parameters
            "max_dense_results": 50,
            "max_sparse_results": 30,
            "max_metadata_results": 20,
            "final_results_count": 10,
            
            # Similarity thresholds
            "dense_threshold": 0.6,
            "sparse_threshold": 0.4,
            "combined_threshold": 0.5,
            
            # Re-ranking parameters
            "reranking_enabled": True,
            "reranking_model": "all-MiniLM-L6-v2",
            "context_window_size": 3,
            
            # Ensemble method: "weighted_sum", "reciprocal_rank_fusion", "logit_sum"
            "ensemble_method": "weighted_sum",
            
            # Knowledge base integration
            "knowledge_integration_enabled": True,
            "max_knowledge_entries": 5,
            "knowledge_weight": 0.3,
            "knowledge_similarity_threshold": 0.6,
            
            # Relationship mapping
            "relationship_mapping_enabled": True,
            "max_relationships": 10,
            "relationship_types": ["similar_to", "complementary_with", "alternative_for"],
            "bidirectional_linking": True
        }
        
        # Update with provided configuration
        if config:
            self.config.update(config)
            
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=10000,
            ngram_range=(1, 2)
        )
        
        logger.info("Hybrid Retriever initialized with configuration: %s", self.config)
    
    async def retrieve(
        self,
        query: str,
        material_type: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 10,
        include_knowledge: bool = True,
        include_relationships: bool = True
    ) -> Dict[str, Any]:
        """
        Main retrieval method implementing the multi-stage hybrid retrieval pipeline.
        
        Args:
            query: The search query text
            material_type: Optional material type filter
            filters: Additional metadata filters
            limit: Maximum number of results to return
            include_knowledge: Whether to include knowledge entries
            include_relationships: Whether to include material relationships
            
        Returns:
            Dictionary containing result items, knowledge entries, and relationships
        """
        start_time = time.time()
        self.report_progress("Starting hybrid retrieval process", 0.0)
        
        # Stage 1: Generate embeddings for the query
        embeddings = await self._generate_query_embeddings(query, material_type)
        self.report_progress("Generated query embeddings", 0.1)
        
        # Adjust result limits based on provided limit
        self.config["final_results_count"] = min(limit, self.config["final_results_count"])
        
        # Stage 2: Multi-stage retrieval from different sources
        retrieval_results = await self._perform_multi_stage_retrieval(
            query=query,
            embeddings=embeddings,
            material_type=material_type,
            filters=filters
        )
        dense_results, sparse_results, metadata_results = retrieval_results
        self.report_progress("Completed multi-stage retrieval", 0.4)
        
        # Stage 3: Ensemble blending
        combined_results = self._blend_results(
            dense_results, sparse_results, metadata_results
        )
        self.report_progress("Blended results using ensemble approach", 0.6)
        
        # Stage 4: Re-ranking (if enabled)
        if self.config["reranking_enabled"]:
            final_results = await self._rerank_results(combined_results, query)
            self.report_progress("Completed contextual re-ranking", 0.8)
        else:
            final_results = combined_results[:self.config["final_results_count"]]
        
        # Stage 5: Knowledge integration (if enabled and requested)
        knowledge_entries = []
        if self.config["knowledge_integration_enabled"] and include_knowledge and self.knowledge_client:
            knowledge_entries = await self._retrieve_knowledge_entries(
                query, 
                final_results, 
                embeddings,
                material_type
            )
            self.report_progress("Retrieved knowledge entries", 0.85)
        
        # Stage 6: Relationship mapping (if enabled and requested)
        relationships = []
        if self.config["relationship_mapping_enabled"] and include_relationships and self.knowledge_client:
            relationships = await self._retrieve_material_relationships(final_results)
            self.report_progress("Retrieved material relationships", 0.9)
        
        # Stage 7: Final processing
        processed_results = self._process_final_results(final_results, query)
        
        # Stage 8: Create bidirectional links between results and knowledge
        if self.config["bidirectional_linking"] and knowledge_entries:
            processed_results, knowledge_entries = self._create_bidirectional_links(
                processed_results, 
                knowledge_entries
            )
        
        self.report_progress("Completed hybrid retrieval process", 1.0)
        
        logger.info("Hybrid retrieval completed in %.2f seconds", time.time() - start_time)
        
        # Return complete package with all components
        return {
            "results": processed_results,
            "knowledge_entries": knowledge_entries,
            "relationships": relationships,
            "query_embedding": embeddings.get("dense_vector", []),
            "metadata": {
                "query": query,
                "material_type": material_type,
                "result_count": len(processed_results),
                "knowledge_count": len(knowledge_entries),
                "relationship_count": len(relationships),
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }
        }
    
    async def _retrieve_knowledge_entries(
        self,
        query: str,
        material_results: ResultList,
        query_embeddings: Dict[str, Any],
        material_type: Optional[str] = None
    ) -> KnowledgeList:
        """
        Retrieve relevant knowledge entries based on query and material results.
        
        Args:
            query: Original query text
            material_results: Retrieval results for materials
            query_embeddings: Query embedding vectors
            material_type: Optional material type filter
            
        Returns:
            List of knowledge entries
        """
        try:
            if not self.knowledge_client:
                logger.warning("Knowledge client not available, skipping knowledge retrieval")
                return []
                
            # Extract material IDs from the results
            material_ids = [item.get("id") for item in material_results if item.get("id")]
            
            if not material_ids:
                return []
                
            # Get knowledge entries for the retrieved materials
            knowledge_entries = await self.knowledge_client.get_entries_for_materials(
                material_ids=material_ids,
                max_entries=self.config["max_knowledge_entries"],
                query=query
            )
            
            # If we have query embeddings, find additional semantically relevant entries
            if query_embeddings.get("dense_vector") and len(knowledge_entries) < self.config["max_knowledge_entries"]:
                semantic_entries = await self.knowledge_client.get_entries_by_embedding(
                    embedding=query_embeddings["dense_vector"],
                    max_entries=self.config["max_knowledge_entries"] - len(knowledge_entries),
                    threshold=self.config["knowledge_similarity_threshold"],
                    material_type=material_type
                )
                
                # Merge entries, avoiding duplicates
                seen_entry_ids = {entry.get("id") for entry in knowledge_entries}
                for entry in semantic_entries:
                    if entry.get("id") and entry.get("id") not in seen_entry_ids:
                        knowledge_entries.append(entry)
                        seen_entry_ids.add(entry.get("id"))
            
            # Sort by relevance
            knowledge_entries.sort(key=lambda x: x.get("relevance", 0), reverse=True)
            
            return knowledge_entries
        except Exception as e:
            logger.error(f"Error retrieving knowledge entries: {str(e)}")
            return []
    
    async def _retrieve_material_relationships(self, material_results: ResultList) -> RelationshipList:
        """
        Retrieve relationships for the retrieved materials.
        
        Args:
            material_results: Retrieved material results
            
        Returns:
            List of material relationships
        """
        try:
            if not self.knowledge_client:
                logger.warning("Knowledge client not available, skipping relationship retrieval")
                return []
                
            # Extract material IDs from the results
            material_ids = [item.get("id") for item in material_results if item.get("id")]
            
            if not material_ids:
                return []
                
            # Get relationships for the retrieved materials
            relationships = await self.knowledge_client.get_material_relationships(
                material_ids=material_ids,
                relationship_types=self.config["relationship_types"],
                max_relationships=self.config["max_relationships"]
            )
            
            return relationships
        except Exception as e:
            logger.error(f"Error retrieving material relationships: {str(e)}")
            return []
    
    def _create_bidirectional_links(
        self, 
        material_results: ResultList, 
        knowledge_entries: KnowledgeList
    ) -> Tuple[ResultList, KnowledgeList]:
        """
        Create bidirectional links between materials and knowledge entries.
        
        Args:
            material_results: List of material results
            knowledge_entries: List of knowledge entries
            
        Returns:
            Updated material results and knowledge entries with bidirectional links
        """
        # Create lookup maps for faster access
        material_map = {item.get("id"): item for item in material_results if item.get("id")}
        knowledge_map = {entry.get("id"): entry for entry in knowledge_entries if entry.get("id")}
        
        # Map knowledge entries to their associated materials
        material_to_knowledge: Dict[str, List[str]] = {}
        knowledge_to_material: Dict[str, List[str]] = {}
        
        # Build the mappings
        for entry in knowledge_entries:
            entry_id = entry.get("id")
            material_id = entry.get("material_id")
            
            if not entry_id or not material_id:
                continue
                
            # Add to knowledge_to_material map
            if entry_id not in knowledge_to_material:
                knowledge_to_material[entry_id] = []
            knowledge_to_material[entry_id].append(material_id)
            
            # Add to material_to_knowledge map
            if material_id not in material_to_knowledge:
                material_to_knowledge[material_id] = []
            material_to_knowledge[material_id].append(entry_id)
        
        # Update material results with knowledge entry references
        for material_id, knowledge_ids in material_to_knowledge.items():
            if material_id in material_map:
                material = material_map[material_id]
                
                # Add knowledge entries reference to material
                material["knowledge_entry_ids"] = knowledge_ids
                
                # Add summary of knowledge as a new field
                knowledge_summaries = []
                for k_id in knowledge_ids:
                    if k_id in knowledge_map:
                        entry = knowledge_map[k_id]
                        summary = f"{entry.get('content', '')[:50]}..."
                        knowledge_summaries.append(summary)
                
                if knowledge_summaries:
                    material["knowledge_summary"] = knowledge_summaries
        
        # Update knowledge entries with material references
        for knowledge_id, material_ids in knowledge_to_material.items():
            if knowledge_id in knowledge_map:
                entry = knowledge_map[knowledge_id]
                
                # Get actual materials that are in our results
                linked_materials = [
                    {"id": m_id, "name": material_map[m_id].get("name", "")}
                    for m_id in material_ids if m_id in material_map
                ]
                
                # Add material references to knowledge entry
                entry["linked_materials"] = linked_materials
        
        # Return the updated lists
        updated_materials = list(material_map.values())
        updated_knowledge = list(knowledge_map.values())
        
        return updated_materials, updated_knowledge
    
    async def _generate_query_embeddings(
        self, 
        query: str, 
        material_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate dense and sparse embeddings for the query text.
        
        Args:
            query: The search query text
            material_type: Optional material type for specialized embeddings
            
        Returns:
            Dictionary containing dense and sparse embeddings
        """
        try:
            # Get hybrid embeddings (both dense and sparse)
            embedding_result = await self.adaptive_embeddings.get_hybrid_embedding(
                text=query,
                material_type=material_type,
                sparse_method="bm25" if material_type else "tfidf"
            )
            
            return {
                "dense_vector": embedding_result.get("dense_vector", []),
                "sparse_indices": embedding_result.get("sparse_indices", []),
                "sparse_values": embedding_result.get("sparse_values", []),
                "sparse_dimensions": embedding_result.get("sparse_dimensions", 0),
                "material_category": material_type
            }
        except Exception as e:
            logger.error(f"Error generating embeddings: {str(e)}")
            # Fallback to basic embeddings
            dense_vector = await self.embedding_generator.get_text_embedding(query)
            return {
                "dense_vector": dense_vector,
                "material_category": material_type
            }
    
    async def _perform_multi_stage_retrieval(
        self,
        query: str,
        embeddings: Dict[str, Any],
        material_type: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> Tuple[ResultList, ResultList, ResultList]:
        """
        Perform retrieval from multiple sources (dense, sparse, metadata) in parallel.
        
        Args:
            query: The search query text
            embeddings: Query embeddings (dense and sparse)
            material_type: Optional material type filter
            filters: Additional metadata filters
            
        Returns:
            Tuple of results from dense, sparse, and metadata retrieval
        """
        # Create tasks for parallel execution
        tasks = []
        
        # Dense vector retrieval task
        dense_task = self._retrieve_by_dense_vector(
            embeddings.get("dense_vector", []),
            material_type,
            filters,
            self.config["max_dense_results"]
        )
        tasks.append(dense_task)
        
        # Sparse vector retrieval task (if available)
        if "sparse_indices" in embeddings and "sparse_values" in embeddings:
            sparse_embedding = {
                "indices": embeddings["sparse_indices"],
                "values": embeddings["sparse_values"],
                "dimensions": embeddings.get("sparse_dimensions", 10000)
            }
            sparse_task = self._retrieve_by_sparse_vector(
                sparse_embedding,
                material_type,
                filters,
                self.config["max_sparse_results"]
            )
        else:
            # Create a task that returns an empty list
            sparse_task = asyncio.create_task(asyncio.sleep(0, result=[]))
        tasks.append(sparse_task)
        
        # Metadata retrieval task
        metadata_task = self._retrieve_by_metadata(
            query,
            material_type,
            filters,
            self.config["max_metadata_results"]
        )
        tasks.append(metadata_task)
        
        # Execute all tasks in parallel
        try:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results, handling any exceptions
            dense_results = results[0] if not isinstance(results[0], Exception) else []
            if isinstance(results[0], Exception):
                logger.error(f"Error in dense retrieval: {results[0]}")
                
            sparse_results = results[1] if not isinstance(results[1], Exception) else []
            if isinstance(results[1], Exception):
                logger.error(f"Error in sparse retrieval: {results[1]}")
                
            metadata_results = results[2] if not isinstance(results[2], Exception) else []
            if isinstance(results[2], Exception):
                logger.error(f"Error in metadata retrieval: {results[2]}")
            
            return dense_results, sparse_results, metadata_results
            
        except Exception as e:
            # Fallback to empty results if parallel execution fails
            logger.error(f"Error in parallel retrieval: {str(e)}")
            return [], [], []
    
    async def _retrieve_by_dense_vector(
        self,
        vector: List[float],
        material_type: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50
    ) -> ResultList:
        """
        Retrieve materials using dense vector similarity.
        Improved with retry logic and timeout handling.
        
        Args:
            vector: Dense embedding vector
            material_type: Optional material type filter
            filters: Additional metadata filters
            limit: Maximum number of results
            
        Returns:
            List of result items with similarity scores
        """
        if not vector:
            return []
        
        # Retry parameters
        max_retries = 3
        base_delay = 0.5  # start with 0.5 second delay
        timeout_seconds = 15.0  # timeout after 15 seconds
        
        # Use specialized HNSW index if available for this material type
        index_name = f"materials_{material_type}_hnsw_idx" if material_type else "materials_hnsw_idx"
        threshold = self.config["dense_threshold"]
        
        for attempt in range(max_retries):
            try:
                # Set timeout to prevent hanging queries
                results = await asyncio.wait_for(
                    self.vector_client.find_similar_by_vector(
                        vector=vector,
                        table="materials",
                        column="dense_embedding",
                        index_name=index_name,
                        threshold=threshold,
                        limit=limit,
                        filters=filters or {},
                        material_type=material_type
                    ),
                    timeout=timeout_seconds
                )
                
                # Normalize to ensure consistent scoring across methods
                return self._normalize_results(results, "dense")
                
            except asyncio.TimeoutError:
                # Log timeout and retry if attempts remain
                retry_message = f" (retry {attempt+1}/{max_retries})" if attempt < max_retries - 1 else " (giving up)"
                logger.warning(f"Dense vector retrieval timed out after {timeout_seconds} seconds{retry_message}")
                
                if attempt == max_retries - 1:
                    logger.error("Dense vector retrieval failed after maximum retry attempts")
                    return []
                
            except Exception as e:
                # Log error and retry with exponential backoff if attempts remain
                retry_message = f" (retry {attempt+1}/{max_retries})" if attempt < max_retries - 1 else " (giving up)"
                logger.warning(f"Error in dense vector retrieval{retry_message}: {str(e)}")
                
                if attempt == max_retries - 1:
                    logger.error("Dense vector retrieval failed after maximum retry attempts")
                    return []
            
            # Exponential backoff before retry
            delay = base_delay * (2 ** attempt)
            await asyncio.sleep(delay)
        
        return []  # Fallback if all retries fail
    
    async def _retrieve_by_sparse_vector(
        self,
        sparse_embedding: SparseEmbedding,
        material_type: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 30
    ) -> ResultList:
        """
        Retrieve materials using sparse vector similarity.
        Improved with retry logic and timeout handling.
        
        Args:
            sparse_embedding: Sparse embedding (indices and values)
            material_type: Optional material type filter
            filters: Additional metadata filters
            limit: Maximum number of results
            
        Returns:
            List of result items with similarity scores
        """
        if not sparse_embedding or "indices" not in sparse_embedding or "values" not in sparse_embedding:
            return []
        
        # Retry parameters
        max_retries = 3
        base_delay = 0.5  # start with 0.5 second delay
        timeout_seconds = 15.0  # timeout after 15 seconds
        threshold = self.config["sparse_threshold"]
        
        for attempt in range(max_retries):
            try:
                # Set timeout to prevent hanging queries
                results = await asyncio.wait_for(
                    self.vector_client.find_similar_by_sparse_vector(
                        indices=sparse_embedding["indices"],
                        values=sparse_embedding["values"],
                        dimensions=sparse_embedding.get("dimensions", 10000),
                        table="materials",
                        threshold=threshold,
                        limit=limit,
                        filters=filters or {},
                        material_type=material_type
                    ),
                    timeout=timeout_seconds
                )
                
                return self._normalize_results(results, "sparse")
                
            except asyncio.TimeoutError:
                # Log timeout and retry if attempts remain
                retry_message = f" (retry {attempt+1}/{max_retries})" if attempt < max_retries - 1 else " (giving up)"
                logger.warning(f"Sparse vector retrieval timed out after {timeout_seconds} seconds{retry_message}")
                
                if attempt == max_retries - 1:
                    logger.error("Sparse vector retrieval failed after maximum retry attempts")
                    return []
                    
            except Exception as e:
                # Log error and retry with exponential backoff if attempts remain
                retry_message = f" (retry {attempt+1}/{max_retries})" if attempt < max_retries - 1 else " (giving up)"
                logger.warning(f"Error in sparse vector retrieval{retry_message}: {str(e)}")
                
                if attempt == max_retries - 1:
                    logger.error("Sparse vector retrieval failed after maximum retry attempts")
                    return []
            
            # Exponential backoff before retry
            delay = base_delay * (2 ** attempt)
            await asyncio.sleep(delay)
        
        return []  # Fallback if all retries fail
    
    async def _retrieve_by_metadata(
        self,
        query: str,
        material_type: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 20
    ) -> ResultList:
        """
        Retrieve materials using metadata and text matching.
        Improved with retry logic and timeout handling.
        
        Args:
            query: The search query text
            material_type: Optional material type filter
            filters: Additional metadata filters
            limit: Maximum number of results
            
        Returns:
            List of result items with relevance scores
        """
        # Retry parameters
        max_retries = 3
        base_delay = 0.5  # start with 0.5 second delay
        timeout_seconds = 12.0  # timeout after 12 seconds
        
        # Enhance filters with material type if provided
        enhanced_filters = filters.copy() if filters else {}
        if material_type:
            enhanced_filters["material_type"] = material_type
        
        for attempt in range(max_retries):
            try:
                # Set timeout to prevent hanging queries
                results = await asyncio.wait_for(
                    self.vector_client.find_by_text(
                        query=query,
                        table="materials",
                        text_columns=["name", "description", "keywords"],
                        limit=limit,
                        filters=enhanced_filters
                    ),
                    timeout=timeout_seconds
                )
                
                return self._normalize_results(results, "metadata")
                
            except asyncio.TimeoutError:
                # Log timeout and retry if attempts remain
                retry_message = f" (retry {attempt+1}/{max_retries})" if attempt < max_retries - 1 else " (giving up)"
                logger.warning(f"Metadata retrieval timed out after {timeout_seconds} seconds{retry_message}")
                
                if attempt == max_retries - 1:
                    logger.error("Metadata retrieval failed after maximum retry attempts")
                    return []
                
            except Exception as e:
                # Log error and retry with exponential backoff if attempts remain
                retry_message = f" (retry {attempt+1}/{max_retries})" if attempt < max_retries - 1 else " (giving up)"
                logger.warning(f"Error in metadata retrieval{retry_message}: {str(e)}")
                
                if attempt == max_retries - 1:
                    logger.error("Metadata retrieval failed after maximum retry attempts")
                    return []
            
            # Exponential backoff before retry
            delay = base_delay * (2 ** attempt)
            await asyncio.sleep(delay)
        
        return []  # Fallback if all retries fail
    
    def _normalize_results(
        self, 
        results: ResultList,
        retrieval_type: str
    ) -> ResultList:
        """
        Normalize results to ensure consistent scoring across methods.
        
        Args:
            results: List of result items
            retrieval_type: Type of retrieval (dense, sparse, metadata)
            
        Returns:
            Normalized result items
        """
        normalized = []
        
        if not results:
            return normalized
        
        # Get min and max scores for normalization
        scores = [float(item.get("similarity", 0)) for item in results]
        min_score = min(scores) if scores else 0
        max_score = max(scores) if scores else 1
        score_range = max_score - min_score
        
        # Normalize scores to [0, 1] range and add source information
        for item in results:
            normalized_item = item.copy()
            raw_score = float(item.get("similarity", 0))
            
            # Avoid division by zero
            if score_range > 0:
                normalized_score = (raw_score - min_score) / score_range
            else:
                normalized_score = 1.0 if raw_score > 0 else 0.0
            
            normalized_item["similarity"] = normalized_score
            normalized_item["raw_score"] = raw_score
            normalized_item["retrieval_source"] = retrieval_type
            normalized_item["matched_by"] = retrieval_type
            normalized.append(normalized_item)
        
        return normalized
    
    def _blend_results(
        self,
        dense_results: ResultList,
        sparse_results: ResultList,
        metadata_results: ResultList
    ) -> ResultList:
        """
        Blend results from multiple retrieval sources using the configured ensemble method.
        
        Args:
            dense_results: Results from dense vector retrieval
            sparse_results: Results from sparse vector retrieval
            metadata_results: Results from metadata retrieval
            
        Returns:
            Blended and ranked results
        """
        ensemble_method = self.config["ensemble_method"]
        
        if ensemble_method == "weighted_sum":
            return self._blend_weighted_sum(dense_results, sparse_results, metadata_results)
        elif ensemble_method == "reciprocal_rank_fusion":
            return self._blend_reciprocal_rank_fusion(dense_results, sparse_results, metadata_results)
        elif ensemble_method == "logit_sum":
            return self._blend_logit_sum(dense_results, sparse_results, metadata_results)
        else:
            logger.warning(f"Unknown ensemble method: {ensemble_method}, falling back to weighted sum")
            return self._blend_weighted_sum(dense_results, sparse_results, metadata_results)
    
    def _blend_weighted_sum(
        self,
        dense_results: ResultList,
        sparse_results: ResultList,
        metadata_results: ResultList
    ) -> ResultList:
        """
        Blend results using weighted sum of scores.
        
        Args:
            dense_results: Results from dense vector retrieval
            sparse_results: Results from sparse vector retrieval
            metadata_results: Results from metadata retrieval
            
        Returns:
            Blended and ranked results
        """
        # Create a dictionary to track combined scores by item ID
        combined_scores: Dict[str, Dict[str, Any]] = {}
        dense_weight = self.config["dense_weight"]
        sparse_weight = self.config["sparse_weight"]
        metadata_weight = self.config["metadata_weight"]
        
        # Process dense results
        for item in dense_results:
            item_id = item.get("id")
            if not item_id:
                continue
                
            score = item.get("similarity", 0) * dense_weight
            combined_scores[item_id] = {
                "item": item,
                "score": score,
                "sources": ["dense"],
                "component_scores": {"dense": item.get("similarity", 0)}
            }
        
        # Process sparse results
        for item in sparse_results:
            item_id = item.get("id")
            if not item_id:
                continue
                
            score = item.get("similarity", 0) * sparse_weight
            if item_id in combined_scores:
                combined_scores[item_id]["score"] += score
                combined_scores[item_id]["sources"].append("sparse")
                combined_scores[item_id]["component_scores"]["sparse"] = item.get("similarity", 0)
            else:
                combined_scores[item_id] = {
                    "item": item,
                    "score": score,
                    "sources": ["sparse"],
                    "component_scores": {"sparse": item.get("similarity", 0)}
                }
        
        # Process metadata results
        for item in metadata_results:
            item_id = item.get("id")
            if not item_id:
                continue
                
            score = item.get("similarity", 0) * metadata_weight
            if item_id in combined_scores:
                combined_scores[item_id]["score"] += score
                combined_scores[item_id]["sources"].append("metadata")
                combined_scores[item_id]["component_scores"]["metadata"] = item.get("similarity", 0)
            else:
                combined_scores[item_id] = {
                    "item": item,
                    "score": score,
                    "sources": ["metadata"],
                    "component_scores": {"metadata": item.get("similarity", 0)}
                }
        
        # Create final blended results
        blended_results = []
        for item_id, data in combined_scores.items():
            item = data["item"].copy()
            item["similarity"] = data["score"]
            item["blended_score"] = data["score"]
            item["retrieval_sources"] = data["sources"]
            item["component_scores"] = data["component_scores"]
            
            # Determine match type based on sources
            sources = data["sources"]
            if len(sources) > 1:
                item["matched_by"] = "hybrid"
            else:
                item["matched_by"] = sources[0]
                
            blended_results.append(item)
        
        # Sort by combined score and apply threshold
        blended_results.sort(key=lambda x: x.get("similarity", 0), reverse=True)
        filtered_results = [
            item for item in blended_results 
            if item.get("similarity", 0) >= self.config["combined_threshold"]
        ]
        
        return filtered_results[:self.config["final_results_count"]]
    
    def _blend_reciprocal_rank_fusion(
        self,
        dense_results: ResultList,
        sparse_results: ResultList,
        metadata_results: ResultList
    ) -> ResultList:
        """
        Blend results using Reciprocal Rank Fusion.
        
        Args:
            dense_results: Results from dense vector retrieval
            sparse_results: Results from sparse vector retrieval
            metadata_results: Results from metadata retrieval
            
        Returns:
            Blended and ranked results
        """
        # Create maps from item ID to rank
        dense_ranks = {item.get("id"): idx + 1 for idx, item in enumerate(dense_results)}
        sparse_ranks = {item.get("id"): idx + 1 for idx, item in enumerate(sparse_results)}
        metadata_ranks = {item.get("id"): idx + 1 for idx, item in enumerate(metadata_results)}
        
        # Constant k for RRF
        k = 60
        
        # Collect all unique item IDs
        all_ids = set(list(dense_ranks.keys()) + list(sparse_ranks.keys()) + list(metadata_ranks.keys()))
        
        # Calculate RRF scores
        rrf_scores = {}
        for item_id in all_ids:
            # Get rank from each source (default to a large value if not present)
            dense_rank = dense_ranks.get(item_id, len(dense_results) + 100)
            sparse_rank = sparse_ranks.get(item_id, len(sparse_results) + 100)
            metadata_rank = metadata_ranks.get(item_id, len(metadata_results) + 100)
            
            # Apply weights to each source's contribution
            rrf_score = (
                self.config["dense_weight"] * (1.0 / (k + dense_rank)) +
                self.config["sparse_weight"] * (1.0 / (k + sparse_rank)) +
                self.config["metadata_weight"] * (1.0 / (k + metadata_rank))
            )
            
            rrf_scores[item_id] = rrf_score
        
        # Create a map from item ID to the original item
        id_to_item = {}
        for item in dense_results + sparse_results + metadata_results:
            item_id = item.get("id")
            if item_id:
                id_to_item[item_id] = item
        
        # Create final blended results
        blended_results = []
        for item_id, score in rrf_scores.items():
            if item_id in id_to_item:
                item = id_to_item[item_id].copy()
                item["similarity"] = score
                item["blended_score"] = score
                
                # Track which sources contributed to this result
                sources = []
                if item_id in dense_ranks:
                    sources.append("dense")
                if item_id in sparse_ranks:
                    sources.append("sparse")
                if item_id in metadata_ranks:
                    sources.append("metadata")
                
                item["retrieval_sources"] = sources
                
                # Determine match type based on sources
                if len(sources) > 1:
                    item["matched_by"] = "hybrid"
                else:
                    item["matched_by"] = sources[0] if sources else "unknown"
                    
                blended_results.append(item)
        
        # Sort by RRF score
        blended_results.sort(key=lambda x: x.get("similarity", 0), reverse=True)
        
        return blended_results[:self.config["final_results_count"]]
    
    def _blend_logit_sum(
        self,
        dense_results: ResultList,
        sparse_results: ResultList,
        metadata_results: ResultList
    ) -> ResultList:
        """
        Blend results using logit sum (log-odds sum) with improved numerical stability.
        
        Args:
            dense_results: Results from dense vector retrieval
            sparse_results: Results from sparse vector retrieval
            metadata_results: Results from metadata retrieval
            
        Returns:
            Blended and ranked results
        """
        # Helper function to convert similarity to logit with improved numerical stability
        def to_logit(sim):
            # More aggressive clipping to avoid numerical issues
            sim = max(0.00001, min(0.99999, sim))
            # Use more numerically stable formula
            return np.log(sim) - np.log(1 - sim)
        
        # Create a dictionary to track combined scores by item ID
        combined_scores = {}
        dense_weight = self.config["dense_weight"]
        sparse_weight = self.config["sparse_weight"]
        metadata_weight = self.config["metadata_weight"]
        
        # Process dense results
        for item in dense_results:
            item_id = item.get("id")
            if not item_id:
                continue
                
            score = to_logit(item.get("similarity", 0.5)) * dense_weight
            combined_scores[item_id] = {
                "item": item,
                "logit_score": score,
                "sources": ["dense"],
                "component_scores": {"dense": item.get("similarity", 0)}
            }
        
        # Process sparse results
        for item in sparse_results:
            item_id = item.get("id")
            if not item_id:
                continue
                
            score = to_logit(item.get("similarity", 0.5)) * sparse_weight
            if item_id in combined_scores:
                combined_scores[item_id]["logit_score"] += score
                combined_scores[item_id]["sources"].append("sparse")
                combined_scores[item_id]["component_scores"]["sparse"] = item.get("similarity", 0)
            else:
                combined_scores[item_id] = {
                    "item": item,
                    "logit_score": score,
                    "sources": ["sparse"],
                    "component_scores": {"sparse": item.get("similarity", 0)}
                }
        
        # Process metadata results
        for item in metadata_results:
            item_id = item.get("id")
            if not item_id:
                continue
                
            score = to_logit(item.get("similarity", 0.5)) * metadata_weight
            if item_id in combined_scores:
                combined_scores[item_id]["logit_score"] += score
                combined_scores[item_id]["sources"].append("metadata")
                combined_scores[item_id]["component_scores"]["metadata"] = item.get("similarity", 0)
            else:
                combined_scores[item_id] = {
                    "item": item,
                    "logit_score": score,
                    "sources": ["metadata"],
                    "component_scores": {"metadata": item.get("similarity", 0)}
                }
        
        # Convert logit scores back to probabilities
        for item_id, data in combined_scores.items():
            logit_score = data["logit_score"]
            probability = 1 / (1 + np.exp(-logit_score))
            combined_scores[item_id]["score"] = probability
        
        # Create final blended results
        blended_results = []
        for item_id, data in combined_scores.items():
            item = data["item"].copy()
            item["similarity"] = data["score"]
            item["blended_score"] = data["score"]
            item["logit_score"] = data["logit_score"]
            item["retrieval_sources"] = data["sources"]
            item["component_scores"] = data["component_scores"]
            
            # Determine match type based on sources
            sources = data["sources"]
            if len(sources) > 1:
                item["matched_by"] = "hybrid"
            else:
                item["matched_by"] = sources[0]
                
            blended_results.append(item)
        
        # Sort by probability score
        blended_results.sort(key=lambda x: x.get("similarity", 0), reverse=True)
        
        return blended_results[:self.config["final_results_count"]]
    
    async def _rerank_results(
        self,
        results: ResultList,
        query: str
    ) -> ResultList:
        """
        Re-rank results using contextual information.
        Improved with batched embedding generation for better performance.
        
        Args:
            results: Initial retrieval results
            query: The search query text
            
        Returns:
            Re-ranked results
        """
        if not results:
            return []
        
        try:
            # Extract material descriptions for re-ranking
            materials_for_reranking = []
            
            for item in results:
                # Extract text fields for re-ranking
                description = item.get("description", "")
                name = item.get("name", "")
                keywords = " ".join(item.get("keywords", []))
                
                # Combine fields with appropriate weighting
                context_text = f"{name}. {description} {keywords}"
                materials_for_reranking.append({
                    "id": item.get("id"),
                    "text": context_text,
                    "original_rank": results.index(item),
                    "original_score": item.get("similarity", 0)
                })
            
            # Use embedding-based re-ranking with batching for better performance
            reranked_scores = await self._calculate_reranking_scores_batched(query, materials_for_reranking)
            
            # Apply re-ranking scores
            for item in results:
                item_id = item.get("id")
                if item_id in reranked_scores:
                    item["rerank_score"] = reranked_scores[item_id]
                    
                    # Combine original score and rerank score
                    old_score = item.get("similarity", 0)
                    new_score = 0.4 * old_score + 0.6 * reranked_scores[item_id]
                    
                    item["original_similarity"] = old_score
                    item["similarity"] = new_score
            
            # Re-sort based on the new scores
            results.sort(key=lambda x: x.get("similarity", 0), reverse=True)
            
            return results[:self.config["final_results_count"]]
        except Exception as e:
            logger.error(f"Error in result re-ranking: {str(e)}")
            # Fall back to original results
            return results[:self.config["final_results_count"]]
    
    async def _calculate_reranking_scores_batched(
        self,
        query: str,
        materials: List[Dict[str, Any]],
        batch_size: int = 5
    ) -> Dict[str, float]:
        """
        Calculate re-ranking scores based on semantic similarity to the query,
        using batched embedding generation for better performance.
        
        Args:
            query: The search query text
            materials: List of materials with text content
            batch_size: Number of embeddings to generate in parallel
            
        Returns:
            Dictionary mapping material IDs to re-ranking scores
        """
        # Generate query embedding
        query_embedding = await self.embedding_generator.get_text_embedding(
            query, 
            model=self.config["reranking_model"]
        )
        
        scores = {}
        
        # Process materials in batches for better performance
        for i in range(0, len(materials), batch_size):
            batch = materials[i:i+batch_size]
            batch_texts = [material["text"] for material in batch]
            batch_ids = [material["id"] for material in batch]
            batch_original_scores = {material["id"]: material["original_score"] for material in batch}
            
            # Create tasks for parallel embedding generation
            embedding_tasks = []
            for text in batch_texts:
                task = self.embedding_generator.get_text_embedding(
                    text, 
                    model=self.config["reranking_model"]
                )
                embedding_tasks.append(task)
            
            try:
                # Execute all embedding generation in parallel
                batch_embeddings = await asyncio.gather(*embedding_tasks, return_exceptions=True)
                
                # Calculate similarity scores for each embedding
                for idx, (material_id, embedding) in enumerate(zip(batch_ids, batch_embeddings)):
                    if isinstance(embedding, Exception):
                        logger.error(f"Error generating embedding for {material_id}: {str(embedding)}")
                        # Use original score as fallback
                        scores[material_id] = batch_original_scores[material_id]
                    else:
                        # Calculate cosine similarity
                        sim_score = 1 - cosine(query_embedding, embedding)
                        scores[material_id] = sim_score
                        
            except Exception as e:
                logger.error(f"Error in batch embedding generation: {str(e)}")
                # Use original scores as fallback for the entire batch
                for material_id in batch_ids:
                    scores[material_id] = batch_original_scores[material_id]
        
        return scores
    
    # Keep the original method for compatibility
    async def _calculate_reranking_scores(
        self,
        query: str,
        materials: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        """
        Legacy method, now uses the batched implementation.
        
        Args:
            query: The search query text
            materials: List of materials with text content
            
        Returns:
            Dictionary mapping material IDs to re-ranking scores
        """
        return await self._calculate_reranking_scores_batched(query, materials)
    
    def _process_final_results(
        self, 
        results: ResultList,
        query: str
    ) -> ResultList:
        """
        Process and format the final results.
        
        Args:
            results: Retrieval results to process
            query: The original search query
            
        Returns:
            Processed and formatted results
        """
        final_results = []
        
        for item in results:
            processed_item = {
                "id": item.get("id"),
                "name": item.get("name", ""),
                "material_type": item.get("material_type", ""),
                "similarity": round(item.get("similarity", 0), 4),
                "matched_by": item.get("matched_by", "hybrid"),
                "retrieval_sources": item.get("retrieval_sources", []),
                "semantic_relevance": self._calculate_semantic_relevance(item, query),
            }
            
            # Add description if available (truncated for readability)
            description = item.get("description", "")
            if description:
                # Truncate long descriptions
                if len(description) > 300:
                    processed_item["description"] = description[:297] + "..."
                else:
                    processed_item["description"] = description
            
            # Add metadata fields if available
            for field in ["keywords", "component_scores", "preview_url"]:
                if field in item:
                    processed_item[field] = item[field]
            
            # Prepare for knowledge integration
            processed_item["knowledge_ready"] = True
            
            # Add semantic tags based on the query and material properties
            processed_item["semantic_tags"] = self._generate_semantic_tags(item, query)
            
            final_results.append(processed_item)
        
        return final_results
    
    def _calculate_semantic_relevance(self, item: Dict[str, Any], query: str) -> float:
        """
        Calculate a semantic relevance score beyond simple vector similarity.
        
        Args:
            item: Material item
            query: Original query string
            
        Returns:
            Semantic relevance score
        """
        # Start with the basic similarity score
        base_score = item.get("similarity", 0.0)
        
        # Adjust based on keyword matches
        keywords = item.get("keywords", [])
        if keywords:
            query_terms = set(query.lower().split())
            matching_keywords = [k for k in keywords if any(term in k.lower() for term in query_terms)]
            keyword_boost = min(0.2, len(matching_keywords) * 0.05)
        else:
            keyword_boost = 0.0
        
        # Adjust based on material type relevance
        material_type = item.get("material_type", "").lower()
        if material_type and any(material_type in term.lower() for term in query.split()):
            type_boost = 0.1
        else:
            type_boost = 0.0
        
        # Calculate final score (capped at 1.0)
        relevance = min(1.0, base_score + keyword_boost + type_boost)
        
        return round(relevance, 4)
    
    def _generate_semantic_tags(self, item: Dict[str, Any], query: str) -> List[str]:
        """
        Generate semantic tags based on the query and material properties.
        
        Args:
            item: Material item
            query: Original query string
            
        Returns:
            List of semantic tags
        """
        tags = set()
        
        # Add material type as a tag
        material_type = item.get("material_type", "")
        if material_type:
            tags.add(material_type.lower())
        
        # Extract potential attributes from the query
        query_terms = query.lower().split()
        
        # Common attributes to check for
        attributes = ["modern", "traditional", "rustic", "contemporary", 
                     "natural", "synthetic", "durable", "eco-friendly", 
                     "sustainable", "premium", "budget", "luxury"]
        
        for attr in attributes:
            if attr in query_terms:
                tags.add(attr)
        
        # Add color tags if available
        if "color" in item:
            color = item.get("color", {})
            if isinstance(color, dict) and "name" in color:
                tags.add(color["name"].lower())
            elif isinstance(color, str):
                tags.add(color.lower())
        
        # Add finish as tag if available
        finish = item.get("finish", "")
        if finish:
            tags.add(finish.lower())
        
        # Convert tags to sorted list
        return sorted(list(tags))
    
    def report_progress(self, message: str, progress: float) -> None:
        """
        Report progress of the retrieval process.
        
        Args:
            message: Progress message
            progress: Progress value (0.0 to 1.0)
        """
        if self.progress_reporter:
            self.progress_reporter.report_progress(message, progress)
        else:
            logger.debug(f"Progress ({progress:.0%}): {message}")

# Factory function to create a preconfigured hybrid retriever
def create_hybrid_retriever(
    vector_client: Optional[VectorSearchClient] = None,
    config: Optional[Dict[str, Any]] = None,
    knowledge_client=None
) -> HybridRetriever:
    """
    Create a HybridRetriever with the specified configuration.
    
    Args:
        vector_client: Optional vector client to use
        config: Optional configuration override
        knowledge_client: Optional knowledge base client
        
    Returns:
        Configured HybridRetriever instance
    """
    embedding_generator = EmbeddingGenerator()
    progress_reporter = ProgressReporter("hybrid_retrieval")
    
    return HybridRetriever(
        vector_client=vector_client,
        embedding_generator=embedding_generator,
        config=config,
        progress_reporter=progress_reporter,
        knowledge_client=knowledge_client
    )

# Example usage
if __name__ == "__main__":
    import asyncio
    
    async def main():
        retriever = create_hybrid_retriever()
        response = await retriever.retrieve(
            query="modern wooden floor with natural finish",
            material_type="wood",
            limit=5
        )
        
        results = response["results"]
        
        print(f"Retrieved {len(results)} results:")
        for i, result in enumerate(results):
            print(f"{i+1}. {result['name']} - {result['similarity']:.4f} ({result['matched_by']})")
            if "semantic_tags" in result:
                print(f"   Tags: {', '.join(result['semantic_tags'])}")
    
    asyncio.run(main())