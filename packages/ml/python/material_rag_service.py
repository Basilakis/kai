#!/usr/bin/env python3
"""
Material RAG Service

This module provides a unified service that orchestrates the entire RAG pipeline for materials,
integrating enhanced vector storage, hybrid retrieval, context assembly, and generative enhancement.
It also provides caching for performance optimization, streaming for progressive result delivery,
and usage tracking for continuous improvement.

The Material RAG Service serves as the main entry point for the RAG system.
"""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Union, AsyncGenerator

# Import components
from enhanced_text_embeddings import TextEmbeddingGenerator
from hybrid_retriever import HybridRetriever
from context_assembler import ContextAssembler
from generative_enhancer import GenerativeEnhancer

# Set up logging
logger = logging.getLogger("material_rag")
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Type aliases
RAGQuery = Dict[str, Any]
RAGResponse = Dict[str, Any]
StreamCallback = Callable[[str], None]
MaterialData = Dict[str, Any]


class MaterialRAGService:
    """
    Unified RAG Service for materials data.
    
    This service orchestrates the entire RAG pipeline, providing a unified
    interface for material search, retrieval, context assembly, and generation.
    """
    
    def __init__(
        self,
        config: Optional[Dict[str, Any]] = None,
        embedding_generator: Optional[TextEmbeddingGenerator] = None,
        retriever: Optional[HybridRetriever] = None,
        context_assembler: Optional[ContextAssembler] = None,
        generative_enhancer: Optional[GenerativeEnhancer] = None
    ):
        """
        Initialize the Material RAG Service.
        
        Args:
            config: Configuration parameters
            embedding_generator: Custom embedding generator
            retriever: Custom retriever
            context_assembler: Custom context assembler
            generative_enhancer: Custom generative enhancer
        """
        # Default configuration
        self.config = {
            # Service configuration
            "service_name": "material_rag_service",
            "version": "1.0.0",
            
            # Cache configuration
            "enable_cache": True,
            "cache_ttl": 3600,  # 1 hour in seconds
            "max_cache_size": 1000,
            
            # Performance configuration
            "timeout": 30,  # seconds
            "max_concurrent_requests": 10,
            
            # Component configurations
            "embedding": {
                "default_model": "sentence-transformers/all-MiniLM-L6-v2",
                "dense_dimension": 384,
                "sparse_enabled": True
            },
            "retrieval": {
                "max_results": 10,
                "strategy": "hybrid",  # Options: dense, sparse, hybrid, metadata
                "threshold": 0.65
            },
            "assembly": {
                "include_relationships": True,
                "max_knowledge_items": 20,
                "include_properties": True
            },
            "generation": {
                "model": "gpt-4",
                "temperature": 0.7,
                "enhancement_types": ["explanation", "similarity", "application"]
            },
            
            # Tracking configuration
            "tracking_enabled": True,
            "log_level": "info",
            "metrics_enabled": True
        }
        
        # Update with provided configuration
        if config:
            self._update_nested_dict(self.config, config)
        
        # Initialize cache
        self.cache = {} if self.config["enable_cache"] else None
        self.cache_timestamps = {}
        
        # Initialize usage tracking
        self.usage_stats = {
            "total_requests": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "errors": 0,
            "avg_response_time": 0,
            "component_times": {
                "embedding": 0,
                "retrieval": 0,
                "assembly": 0,
                "generation": 0,
                "total": 0
            }
        }
        
        # Initialize components
        self.embedding_generator = embedding_generator or TextEmbeddingGenerator(self.config["embedding"])
        self.retriever = retriever or HybridRetriever(self.config["retrieval"])
        self.context_assembler = context_assembler or ContextAssembler(self.config["assembly"])
        self.generative_enhancer = generative_enhancer or GenerativeEnhancer(self.config["generation"])
        
        logger.info(f"MaterialRAGService initialized with configuration: {self.config}")
    
    def _update_nested_dict(self, d: Dict, u: Dict) -> Dict:
        """
        Update a nested dictionary with another dictionary.
        
        Args:
            d: Target dictionary
            u: Source dictionary
            
        Returns:
            Updated dictionary
        """
        for k, v in u.items():
            if isinstance(v, dict) and k in d and isinstance(d[k], dict):
                self._update_nested_dict(d[k], v)
            else:
                d[k] = v
        return d
    
    async def query(
        self,
        query_text: str,
        filters: Optional[Dict[str, Any]] = None,
        options: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None,
        stream_handler: Optional[StreamCallback] = None
    ) -> RAGResponse:
        """
        Process a RAG query for materials.
        
        Args:
            query_text: The user's query text
            filters: Optional filters for material retrieval
            options: Optional query options
            session_id: Optional session identifier for tracking
            stream_handler: Optional callback for streaming responses
            
        Returns:
            RAG response with materials and enhancements
        """
        start_time = time.time()
        
        # Generate a session ID if not provided
        if not session_id:
            session_id = str(uuid.uuid4())
        
        # Initialize request tracking
        self.usage_stats["total_requests"] += 1
        request_id = str(uuid.uuid4())
        
        # Merge options with defaults
        query_options = {}
        if options:
            query_options.update(options)
        
        # Try cache lookup
        cache_key = self._generate_cache_key(query_text, filters, query_options)
        if self.config["enable_cache"]:
            cached_response = self._check_cache(cache_key)
            if cached_response:
                logger.info(f"Cache hit for query: {query_text}")
                self.usage_stats["cache_hits"] += 1
                
                # Add tracking info
                cached_response["metadata"]["from_cache"] = True
                cached_response["metadata"]["request_id"] = request_id
                cached_response["metadata"]["session_id"] = session_id
                
                return cached_response
            
            self.usage_stats["cache_misses"] += 1
        
        # Process the query through the RAG pipeline
        try:
            logger.info(f"Processing query: {query_text}")
            
            # 1. Generate embeddings for the query
            embedding_start = time.time()
            query_embedding = await self.embedding_generator.generate_embeddings(
                query_text,
                include_dense=True,
                include_sparse=self.config["embedding"]["sparse_enabled"]
            )
            embedding_time = time.time() - embedding_start
            self.usage_stats["component_times"]["embedding"] += embedding_time
            
            # 2. Retrieve relevant materials
            retrieval_start = time.time()
            retrieved_materials = await self.retriever.retrieve(
                query_text=query_text,
                query_embedding=query_embedding,
                filters=filters,
                limit=query_options.get("limit", self.config["retrieval"]["max_results"])
            )
            retrieval_time = time.time() - retrieval_start
            self.usage_stats["component_times"]["retrieval"] += retrieval_time
            
            # 3. Assemble context from retrieved materials
            assembly_start = time.time()
            assembled_context = await self.context_assembler.assemble(
                query=query_text,
                materials=retrieved_materials,
                include_relationships=query_options.get(
                    "include_relationships", 
                    self.config["assembly"]["include_relationships"]
                ),
                include_properties=query_options.get(
                    "include_properties",
                    self.config["assembly"]["include_properties"]
                )
            )
            assembly_time = time.time() - assembly_start
            self.usage_stats["component_times"]["assembly"] += assembly_time
            
            # 4. Generate enhanced content
            generation_start = time.time()
            enhancement_types = query_options.get(
                "enhancement_types",
                self.config["generation"]["enhancement_types"]
            )
            
            enhanced_response = await self.generative_enhancer.enhance(
                context=assembled_context,
                query=query_text,
                enhancement_types=enhancement_types,
                stream_handler=stream_handler
            )
            generation_time = time.time() - generation_start
            self.usage_stats["component_times"]["generation"] += generation_time
            
            # 5. Construct the final response
            total_time = time.time() - start_time
            
            response = {
                "query": query_text,
                "materials": enhanced_response.get("materials", []),
                "enhancements": enhanced_response.get("enhancements", {}),
                "citations": enhanced_response.get("citations", []),
                "metadata": {
                    "request_id": request_id,
                    "session_id": session_id,
                    "timestamp": time.time(),
                    "processing_time": total_time,
                    "component_times": {
                        "embedding": embedding_time,
                        "retrieval": retrieval_time,
                        "assembly": assembly_time,
                        "generation": generation_time
                    },
                    "from_cache": False,
                    "enhancement_types": enhancement_types,
                    "material_count": len(retrieved_materials)
                }
            }
            
            # Update usage statistics
            self.usage_stats["component_times"]["total"] += total_time
            self.usage_stats["avg_response_time"] = (
                (self.usage_stats["avg_response_time"] * (self.usage_stats["total_requests"] - 1) + total_time)
                / self.usage_stats["total_requests"]
            )
            
            # Cache the response
            if self.config["enable_cache"]:
                self._add_to_cache(cache_key, response)
            
            logger.info(f"Query processed in {total_time:.2f} seconds")
            return response
            
        except Exception as e:
            logger.error(f"Error processing query: {str(e)}")
            self.usage_stats["errors"] += 1
            
            # Return error response
            error_response = {
                "query": query_text,
                "error": str(e),
                "metadata": {
                    "request_id": request_id,
                    "session_id": session_id,
                    "timestamp": time.time(),
                    "error": True,
                    "from_cache": False
                }
            }
            
            return error_response
    
    async def streaming_query(
        self,
        query_text: str,
        filters: Optional[Dict[str, Any]] = None,
        options: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        Process a RAG query with streaming response.
        
        Args:
            query_text: The user's query text
            filters: Optional filters for material retrieval
            options: Optional query options
            session_id: Optional session identifier for tracking
            
        Yields:
            Incremental parts of the response
        """
        # Generate a session ID if not provided
        if not session_id:
            session_id = str(uuid.uuid4())
        
        # Initialize request tracking
        request_id = str(uuid.uuid4())
        self.usage_stats["total_requests"] += 1
        
        try:
            logger.info(f"Processing streaming query: {query_text}")
            
            # Initialize streaming response structure
            yield json.dumps({
                "event": "start",
                "request_id": request_id,
                "session_id": session_id,
                "timestamp": time.time()
            }) + "\n"
            
            # 1. Generate embeddings for the query
            yield json.dumps({
                "event": "status",
                "message": "Generating embeddings..."
            }) + "\n"
            
            query_embedding = await self.embedding_generator.generate_embeddings(
                query_text,
                include_dense=True,
                include_sparse=self.config["embedding"]["sparse_enabled"]
            )
            
            # 2. Retrieve relevant materials
            yield json.dumps({
                "event": "status",
                "message": "Retrieving relevant materials..."
            }) + "\n"
            
            retrieved_materials = await self.retriever.retrieve(
                query_text=query_text,
                query_embedding=query_embedding,
                filters=filters,
                limit=options.get("limit", self.config["retrieval"]["max_results"])
            )
            
            # Send initial material list
            yield json.dumps({
                "event": "materials",
                "count": len(retrieved_materials),
                "materials": [
                    {
                        "id": m.get("id", ""),
                        "name": m.get("name", ""),
                        "material_type": m.get("material_type", ""),
                        "similarity_score": m.get("similarity_score", 0)
                    } for m in retrieved_materials[:3]  # Send top 3 initially
                ]
            }) + "\n"
            
            # 3. Assemble context from retrieved materials
            yield json.dumps({
                "event": "status",
                "message": "Assembling context..."
            }) + "\n"
            
            assembled_context = await self.context_assembler.assemble(
                query=query_text,
                materials=retrieved_materials,
                include_relationships=options.get(
                    "include_relationships", 
                    self.config["assembly"]["include_relationships"]
                ),
                include_properties=options.get(
                    "include_properties",
                    self.config["assembly"]["include_properties"]
                )
            )
            
            # 4. Generate enhanced content with streaming
            yield json.dumps({
                "event": "status",
                "message": "Generating enhanced content..."
            }) + "\n"
            
            enhancement_types = options.get(
                "enhancement_types",
                self.config["generation"]["enhancement_types"]
            )
            
            # Create a buffer for content chunks
            content_buffer = []
            async def stream_callback(content):
                content_buffer.append(content)
                if len(content_buffer) >= 5:  # Send in batches
                    chunk = "".join(content_buffer)
                    yield json.dumps({
                        "event": "content",
                        "chunk": chunk
                    }) + "\n"
                    content_buffer.clear()
            
            # Use enhanced response with streaming
            enhanced_response = await self.generative_enhancer.enhance(
                context=assembled_context,
                query=query_text,
                enhancement_types=enhancement_types,
                stream_handler=stream_callback
            )
            
            # Send any remaining buffered content
            if content_buffer:
                chunk = "".join(content_buffer)
                yield json.dumps({
                    "event": "content",
                    "chunk": chunk
                }) + "\n"
            
            # 5. Send final complete response
            yield json.dumps({
                "event": "complete",
                "response": enhanced_response,
                "timestamp": time.time()
            }) + "\n"
            
        except Exception as e:
            logger.error(f"Error in streaming query: {str(e)}")
            self.usage_stats["errors"] += 1
            
            # Send error response
            yield json.dumps({
                "event": "error",
                "error": str(e),
                "timestamp": time.time()
            }) + "\n"
    
    async def batch_query(
        self,
        queries: List[Dict[str, Any]],
        session_id: Optional[str] = None,
        max_concurrent: Optional[int] = None
    ) -> List[RAGResponse]:
        """
        Process multiple RAG queries in batch.
        
        Args:
            queries: List of query objects
            session_id: Optional session identifier for tracking
            max_concurrent: Maximum number of concurrent requests
            
        Returns:
            List of RAG responses
        """
        if not queries:
            return []
        
        # Generate a session ID if not provided
        if not session_id:
            session_id = str(uuid.uuid4())
        
        # Set max concurrent requests
        max_workers = max_concurrent or self.config["max_concurrent_requests"]
        
        # Create a semaphore to limit concurrent requests
        semaphore = asyncio.Semaphore(max_workers)
        
        async def process_query(query_obj):
            async with semaphore:
                query_text = query_obj.get("query", "")
                filters = query_obj.get("filters")
                options = query_obj.get("options")
                
                # Use the shared session_id but with unique request_id
                return await self.query(
                    query_text=query_text,
                    filters=filters,
                    options=options,
                    session_id=session_id
                )
        
        # Process all queries concurrently
        tasks = [process_query(query) for query in queries]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results and handle any exceptions
        processed_results = []
        for result in results:
            if isinstance(result, Exception):
                processed_results.append({
                    "error": str(result),
                    "metadata": {
                        "session_id": session_id,
                        "timestamp": time.time(),
                        "error": True
                    }
                })
            else:
                processed_results.append(result)
        
        return processed_results
    
    def _generate_cache_key(
        self,
        query_text: str,
        filters: Optional[Dict[str, Any]] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate a unique cache key for a query.
        
        Args:
            query_text: The query text
            filters: Optional filters
            options: Optional query options
            
        Returns:
            Cache key string
        """
        # Create a dictionary with all query parameters
        key_dict = {
            "query": query_text,
            "filters": filters or {},
            "options": options or {}
        }
        
        # Convert to a stable JSON string and hash
        key_json = json.dumps(key_dict, sort_keys=True)
        return key_json
    
    def _check_cache(self, cache_key: str) -> Optional[RAGResponse]:
        """
        Check if a response exists in the cache and is still valid.
        
        Args:
            cache_key: Cache key string
            
        Returns:
            Cached response or None
        """
        if not self.config["enable_cache"] or cache_key not in self.cache:
            return None
        
        # Check if the cache entry has expired
        timestamp = self.cache_timestamps.get(cache_key, 0)
        if time.time() - timestamp > self.config["cache_ttl"]:
            # Remove expired entry
            self._remove_from_cache(cache_key)
            return None
        
        return self.cache[cache_key]
    
    def _add_to_cache(self, cache_key: str, response: RAGResponse) -> None:
        """
        Add a response to the cache.
        
        Args:
            cache_key: Cache key string
            response: Response to cache
        """
        if not self.config["enable_cache"]:
            return
        
        # If cache is full, remove the oldest entry
        if len(self.cache) >= self.config["max_cache_size"]:
            oldest_key = min(self.cache_timestamps.items(), key=lambda x: x[1])[0]
            self._remove_from_cache(oldest_key)
        
        # Add to cache
        self.cache[cache_key] = response
        self.cache_timestamps[cache_key] = time.time()
    
    def _remove_from_cache(self, cache_key: str) -> None:
        """
        Remove an entry from the cache.
        
        Args:
            cache_key: Cache key string
        """
        if cache_key in self.cache:
            del self.cache[cache_key]
        
        if cache_key in self.cache_timestamps:
            del self.cache_timestamps[cache_key]
    
    def clear_cache(self) -> None:
        """Clear the entire cache."""
        self.cache = {}
        self.cache_timestamps = {}
    
    def get_usage_statistics(self) -> Dict[str, Any]:
        """
        Get usage statistics for the service.
        
        Returns:
            Dictionary of usage statistics
        """
        stats = self.usage_stats.copy()
        stats["timestamp"] = time.time()
        stats["cache_size"] = len(self.cache) if self.cache is not None else 0
        
        # Calculate cache hit rate
        total_cache_requests = stats["cache_hits"] + stats["cache_misses"]
        stats["cache_hit_rate"] = (
            stats["cache_hits"] / total_cache_requests if total_cache_requests > 0 else 0
        )
        
        # Calculate error rate
        stats["error_rate"] = stats["errors"] / stats["total_requests"] if stats["total_requests"] > 0 else 0
        
        return stats
    
    def get_health_status(self) -> Dict[str, Any]:
        """
        Get the health status of the service.
        
        Returns:
            Dictionary with health status information
        """
        return {
            "status": "healthy",
            "service": self.config["service_name"],
            "version": self.config["version"],
            "timestamp": time.time(),
            "uptime": time.time() - self.startup_time if hasattr(self, "startup_time") else 0,
            "components": {
                "embedding_generator": "healthy",
                "retriever": "healthy",
                "context_assembler": "healthy",
                "generative_enhancer": "healthy"
            },
            "cache": {
                "enabled": self.config["enable_cache"],
                "size": len(self.cache) if self.cache is not None else 0,
                "max_size": self.config["max_cache_size"]
            }
        }
    
    async def optimize_for_material(self, material_id: str) -> Dict[str, Any]:
        """
        Optimize the service for a specific material by precomputing and caching common queries.
        
        Args:
            material_id: Material ID to optimize for
            
        Returns:
            Optimization results
        """
        logger.info(f"Optimizing service for material: {material_id}")
        
        try:
            # Generate common queries for this material
            common_queries = [
                f"properties of material {material_id}",
                f"applications for material {material_id}",
                f"alternatives to material {material_id}",
                f"installation guide for material {material_id}"
            ]
            
            # Pre-process these queries and cache the results
            results = []
            for query in common_queries:
                response = await self.query(
                    query_text=query,
                    filters={"material_id": material_id}
                )
                results.append({
                    "query": query,
                    "cached": True
                })
            
            return {
                "material_id": material_id,
                "status": "optimized",
                "queries_cached": len(results),
                "queries": results
            }
            
        except Exception as e:
            logger.error(f"Error optimizing for material {material_id}: {str(e)}")
            return {
                "material_id": material_id,
                "status": "error",
                "error": str(e)
            }


# Factory function to create a Material RAG Service
def create_material_rag_service(
    config: Optional[Dict[str, Any]] = None,
    embedding_generator: Optional[TextEmbeddingGenerator] = None,
    retriever: Optional[HybridRetriever] = None,
    context_assembler: Optional[ContextAssembler] = None,
    generative_enhancer: Optional[GenerativeEnhancer] = None
) -> MaterialRAGService:
    """
    Create a MaterialRAGService with specified components and configuration.
    
    Args:
        config: Configuration parameters
        embedding_generator: Custom embedding generator
        retriever: Custom retriever
        context_assembler: Custom context assembler
        generative_enhancer: Custom generative enhancer
        
    Returns:
        Configured MaterialRAGService instance
    """
    service = MaterialRAGService(
        config=config,
        embedding_generator=embedding_generator,
        retriever=retriever,
        context_assembler=context_assembler,
        generative_enhancer=generative_enhancer
    )
    
    # Set startup time
    service.startup_time = time.time()
    
    return service


# Example usage
if __name__ == "__main__":
    import asyncio
    
    async def main():
        # Create the service
        service = create_material_rag_service()
        
        # Example query
        response = await service.query(
            query_text="What are the best wood options for modern flooring?",
            filters={"material_type": "wood"},
            options={"enhancement_types": ["explanation", "similarity"]}
        )
        
        print(f"Query response: {json.dumps(response, indent=2)}")
        
        # Get usage statistics
        stats = service.get_usage_statistics()
        print(f"Usage statistics: {json.dumps(stats, indent=2)}")
    
    asyncio.run(main())