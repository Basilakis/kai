#!/usr/bin/env python3
"""
Distributed Retrieval

This module implements a distributed retrieval system for handling large vector databases
and optimizing performance for large-scale deployments.

Key features:
1. Distributed retrieval across multiple vector stores
2. Caching strategies for frequently accessed materials
3. Load balancing for retrieval operations
4. Batched operations for improved throughput
"""

import asyncio
import hashlib
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple, Union

# Set up logging
logger = logging.getLogger(__name__)

class DistributedRetrieval:
    """
    Implements a distributed retrieval system for large-scale deployments.
    """
    
    def __init__(
        self,
        config: Dict[str, Any],
        vector_stores: List[Any] = None,
        cache_client=None
    ):
        """
        Initialize the distributed retrieval system.
        
        Args:
            config: Configuration for the system
            vector_stores: List of vector store clients
            cache_client: Cache client for caching results
        """
        self.config = config
        self.vector_stores = vector_stores or []
        self.cache_client = cache_client
        
        # Set default configuration values
        self.config.setdefault("cache_enabled", True)
        self.config.setdefault("cache_ttl_seconds", 3600)  # 1 hour
        self.config.setdefault("batch_size", 100)
        self.config.setdefault("timeout_seconds", 10)
        self.config.setdefault("max_concurrent_requests", 5)
        
        # Initialize state
        self.store_stats = {i: {"queries": 0, "latency": 0} for i in range(len(self.vector_stores))}
        self.semaphore = asyncio.Semaphore(self.config["max_concurrent_requests"])
    
    async def retrieve(
        self,
        query: str,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Retrieve materials using distributed retrieval.
        
        Args:
            query: User query
            options: Additional options for retrieval
            
        Returns:
            Retrieved materials and metadata
        """
        options = options or {}
        start_time = time.time()
        
        try:
            # Check cache if enabled
            if self.config["cache_enabled"] and self.cache_client:
                cache_key = self._generate_cache_key(query, options)
                cached_result = await self._get_from_cache(cache_key)
                
                if cached_result:
                    logger.info(f"Cache hit for query: {query}")
                    return cached_result
            
            # Determine retrieval strategy
            if options.get("strategy") == "parallel":
                # Retrieve from all stores in parallel
                results = await self._retrieve_parallel(query, options)
            else:
                # Retrieve using load balancing
                results = await self._retrieve_load_balanced(query, options)
            
            # Cache results if enabled
            if self.config["cache_enabled"] and self.cache_client:
                cache_key = self._generate_cache_key(query, options)
                await self._store_in_cache(cache_key, results)
            
            # Add metadata
            results["metadata"]["retrieval_time"] = time.time() - start_time
            results["metadata"]["distributed"] = True
            results["metadata"]["stores_used"] = len(self.vector_stores)
            
            return results
            
        except Exception as e:
            logger.error(f"Error in distributed retrieval: {str(e)}")
            return {
                "materials": [],
                "metadata": {
                    "error": str(e),
                    "retrieval_time": time.time() - start_time
                }
            }
    
    def _generate_cache_key(self, query: str, options: Dict[str, Any]) -> str:
        """
        Generate a cache key for a query and options.
        
        Args:
            query: User query
            options: Additional options
            
        Returns:
            Cache key
        """
        # Create a string representation of the query and options
        key_data = {
            "query": query,
            "options": {k: v for k, v in options.items() if k != "user_id"}  # Exclude user-specific data
        }
        
        # Generate a hash
        key_str = json.dumps(key_data, sort_keys=True)
        return hashlib.md5(key_str.encode()).hexdigest()
    
    async def _get_from_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """
        Get results from cache.
        
        Args:
            cache_key: Cache key
            
        Returns:
            Cached results or None if not found
        """
        if not self.cache_client:
            return None
        
        try:
            # Get from cache
            cached_data = await self.cache_client.get(cache_key)
            
            if cached_data:
                # Parse cached data
                return json.loads(cached_data)
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting from cache: {str(e)}")
            return None
    
    async def _store_in_cache(self, cache_key: str, results: Dict[str, Any]) -> bool:
        """
        Store results in cache.
        
        Args:
            cache_key: Cache key
            results: Results to cache
            
        Returns:
            True if successful, False otherwise
        """
        if not self.cache_client:
            return False
        
        try:
            # Store in cache
            ttl = self.config["cache_ttl_seconds"]
            
            # Serialize results
            serialized = json.dumps(results)
            
            # Store with TTL
            await self.cache_client.set(cache_key, serialized, ttl)
            
            return True
            
        except Exception as e:
            logger.error(f"Error storing in cache: {str(e)}")
            return False
    
    async def _retrieve_parallel(
        self,
        query: str,
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Retrieve from all stores in parallel.
        
        Args:
            query: User query
            options: Additional options
            
        Returns:
            Combined results
        """
        if not self.vector_stores:
            return {"materials": [], "metadata": {"error": "No vector stores available"}}
        
        # Create tasks for all stores
        tasks = []
        for i, store in enumerate(self.vector_stores):
            task = self._retrieve_from_store(i, store, query, options)
            tasks.append(task)
        
        # Wait for all tasks with timeout
        results = await asyncio.gather(*tasks)
        
        # Combine results
        combined_materials = []
        combined_metadata = {"stores": []}
        
        for i, result in enumerate(results):
            materials = result.get("materials", [])
            metadata = result.get("metadata", {})
            
            # Add store identifier to materials
            for material in materials:
                material["store_id"] = i
            
            combined_materials.extend(materials)
            combined_metadata["stores"].append({
                "store_id": i,
                "count": len(materials),
                "latency": metadata.get("latency", 0)
            })
        
        # Sort by score
        combined_materials = sorted(
            combined_materials,
            key=lambda x: x.get("score", 0),
            reverse=True
        )
        
        # Deduplicate
        deduplicated = self._deduplicate_materials(combined_materials)
        
        return {
            "materials": deduplicated,
            "metadata": combined_metadata
        }
    
    async def _retrieve_load_balanced(
        self,
        query: str,
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Retrieve using load balancing.
        
        Args:
            query: User query
            options: Additional options
            
        Returns:
            Results from selected store
        """
        if not self.vector_stores:
            return {"materials": [], "metadata": {"error": "No vector stores available"}}
        
        # Select store based on load balancing
        store_idx = self._select_store()
        store = self.vector_stores[store_idx]
        
        # Retrieve from selected store
        result = await self._retrieve_from_store(store_idx, store, query, options)
        
        # Add store identifier to materials
        materials = result.get("materials", [])
        for material in materials:
            material["store_id"] = store_idx
        
        # Add metadata
        result["metadata"]["store_id"] = store_idx
        result["metadata"]["load_balanced"] = True
        
        return result
    
    async def _retrieve_from_store(
        self,
        store_idx: int,
        store: Any,
        query: str,
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Retrieve from a specific store.
        
        Args:
            store_idx: Store index
            store: Vector store client
            query: User query
            options: Additional options
            
        Returns:
            Results from the store
        """
        start_time = time.time()
        
        try:
            # Acquire semaphore to limit concurrent requests
            async with self.semaphore:
                # Call the store with timeout
                result = await asyncio.wait_for(
                    store.retrieve(query, options),
                    timeout=self.config["timeout_seconds"]
                )
            
            # Update stats
            latency = time.time() - start_time
            self.store_stats[store_idx]["queries"] += 1
            self.store_stats[store_idx]["latency"] += latency
            
            # Add latency to metadata
            if "metadata" not in result:
                result["metadata"] = {}
            
            result["metadata"]["latency"] = latency
            
            return result
            
        except asyncio.TimeoutError:
            logger.error(f"Timeout retrieving from store {store_idx}")
            return {"materials": [], "metadata": {"error": "Timeout", "latency": time.time() - start_time}}
            
        except Exception as e:
            logger.error(f"Error retrieving from store {store_idx}: {str(e)}")
            return {"materials": [], "metadata": {"error": str(e), "latency": time.time() - start_time}}
    
    def _select_store(self) -> int:
        """
        Select a store based on load balancing.
        
        Returns:
            Selected store index
        """
        # Simple round-robin if no stats available
        if not self.store_stats:
            return 0
        
        # Select based on average latency and query count
        scores = []
        
        for idx, stats in self.store_stats.items():
            queries = stats["queries"]
            latency = stats["latency"]
            
            # Avoid division by zero
            avg_latency = latency / max(1, queries)
            
            # Lower score is better
            score = avg_latency * (queries + 1)
            scores.append((idx, score))
        
        # Select store with lowest score
        selected_idx, _ = min(scores, key=lambda x: x[1])
        
        return selected_idx
    
    def _deduplicate_materials(self, materials: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Deduplicate materials by ID.
        
        Args:
            materials: List of materials
            
        Returns:
            Deduplicated list of materials
        """
        deduplicated = {}
        
        for material in materials:
            material_id = material.get("id")
            
            if not material_id:
                continue
            
            if material_id not in deduplicated:
                # First occurrence
                deduplicated[material_id] = material
            else:
                # Keep the one with higher score
                existing = deduplicated[material_id]
                
                if material.get("score", 0) > existing.get("score", 0):
                    deduplicated[material_id] = material
        
        return list(deduplicated.values())
    
    async def invalidate_cache(self, pattern: Optional[str] = None) -> int:
        """
        Invalidate cache entries.
        
        Args:
            pattern: Pattern to match cache keys
            
        Returns:
            Number of invalidated entries
        """
        if not self.cache_client or not self.config["cache_enabled"]:
            return 0
        
        try:
            # Invalidate cache entries
            count = await self.cache_client.invalidate(pattern)
            
            logger.info(f"Invalidated {count} cache entries")
            return count
            
        except Exception as e:
            logger.error(f"Error invalidating cache: {str(e)}")
            return 0
    
    async def get_stats(self) -> Dict[str, Any]:
        """
        Get statistics for the distributed retrieval system.
        
        Returns:
            Statistics
        """
        stats = {
            "stores": self.store_stats,
            "cache_enabled": self.config["cache_enabled"],
            "cache_ttl_seconds": self.config["cache_ttl_seconds"],
            "max_concurrent_requests": self.config["max_concurrent_requests"]
        }
        
        # Add cache stats if available
        if self.cache_client and self.config["cache_enabled"]:
            try:
                cache_stats = await self.cache_client.get_stats()
                stats["cache"] = cache_stats
            except Exception as e:
                logger.error(f"Error getting cache stats: {str(e)}")
                stats["cache"] = {"error": str(e)}
        
        return stats


class CacheClient:
    """
    Client for caching retrieval results.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the cache client.
        
        Args:
            config: Configuration for the client
        """
        self.config = config
        self.cache = {}
        self.expiry = {}
        self.stats = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "invalidations": 0
        }
    
    async def get(self, key: str) -> Optional[str]:
        """
        Get a value from the cache.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found
        """
        # Check if key exists and is not expired
        if key in self.cache and key in self.expiry:
            if datetime.now() < self.expiry[key]:
                self.stats["hits"] += 1
                return self.cache[key]
            else:
                # Expired
                del self.cache[key]
                del self.expiry[key]
        
        self.stats["misses"] += 1
        return None
    
    async def set(self, key: str, value: str, ttl: int) -> bool:
        """
        Set a value in the cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
            
        Returns:
            True if successful, False otherwise
        """
        self.cache[key] = value
        self.expiry[key] = datetime.now() + timedelta(seconds=ttl)
        self.stats["sets"] += 1
        return True
    
    async def invalidate(self, pattern: Optional[str] = None) -> int:
        """
        Invalidate cache entries.
        
        Args:
            pattern: Pattern to match cache keys
            
        Returns:
            Number of invalidated entries
        """
        if pattern is None:
            # Invalidate all
            count = len(self.cache)
            self.cache.clear()
            self.expiry.clear()
            self.stats["invalidations"] += count
            return count
        
        # Invalidate by pattern
        keys_to_remove = []
        
        for key in self.cache.keys():
            if pattern in key:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self.cache[key]
            del self.expiry[key]
        
        self.stats["invalidations"] += len(keys_to_remove)
        return len(keys_to_remove)
    
    async def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Cache statistics
        """
        stats = self.stats.copy()
        stats["size"] = len(self.cache)
        
        # Calculate hit rate
        total = stats["hits"] + stats["misses"]
        stats["hit_rate"] = stats["hits"] / max(1, total)
        
        return stats


# Factory function to create a distributed retrieval system
def create_distributed_retrieval(
    config: Dict[str, Any],
    vector_stores: List[Any] = None,
    cache_client=None
) -> DistributedRetrieval:
    """
    Create a DistributedRetrieval system with specified configuration and dependencies.
    
    Args:
        config: Configuration for the system
        vector_stores: List of vector store clients
        cache_client: Cache client for caching results
        
    Returns:
        Configured DistributedRetrieval system
    """
    # Create cache client if not provided
    if cache_client is None and config.get("cache_enabled", True):
        cache_client = CacheClient(config.get("cache_config", {}))
    
    return DistributedRetrieval(
        config=config,
        vector_stores=vector_stores,
        cache_client=cache_client
    )
