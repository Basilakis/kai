#!/usr/bin/env python3
"""
Hierarchical Retriever

This module implements a hierarchical retrieval system that breaks down complex queries
into sub-queries and combines the results for more comprehensive retrieval.

Key features:
1. Query decomposition for complex queries
2. Hierarchical retrieval for multi-faceted queries
3. Result reranking based on query relevance
4. Support for both dense and sparse retrieval methods
"""

import asyncio
import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple, Union

# Set up logging
logger = logging.getLogger(__name__)

class HierarchicalRetriever:
    """
    Implements a hierarchical retrieval system for complex queries.
    """
    
    def __init__(
        self,
        config: Dict[str, Any],
        base_retriever=None,
        llm_client=None
    ):
        """
        Initialize the hierarchical retriever.
        
        Args:
            config: Configuration for the retriever
            base_retriever: Base retriever for executing sub-queries
            llm_client: LLM client for query decomposition
        """
        self.config = config
        self.base_retriever = base_retriever
        self.llm_client = llm_client
        
        # Set default configuration values
        self.config.setdefault("max_sub_queries", 3)
        self.config.setdefault("min_query_length", 15)
        self.config.setdefault("reranking_enabled", True)
        self.config.setdefault("combine_strategy", "weighted")
        self.config.setdefault("query_decomposition_model", "gpt-3.5-turbo")
    
    async def retrieve(
        self,
        query: str,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Retrieve materials using hierarchical retrieval.
        
        Args:
            query: User query
            options: Additional options for retrieval
            
        Returns:
            Retrieved materials and metadata
        """
        options = options or {}
        
        # Check if query is complex enough for decomposition
        if len(query) < self.config["min_query_length"] or not self._is_complex_query(query):
            logger.info(f"Query not complex enough for decomposition: {query}")
            return await self._simple_retrieve(query, options)
        
        try:
            # Decompose query into sub-queries
            sub_queries = await self._decompose_query(query)
            
            if not sub_queries or len(sub_queries) == 1:
                logger.info(f"Query decomposition yielded only one sub-query: {query}")
                return await self._simple_retrieve(query, options)
            
            logger.info(f"Decomposed query into {len(sub_queries)} sub-queries")
            
            # Retrieve results for each sub-query
            sub_results = []
            for sub_query in sub_queries:
                sub_result = await self._simple_retrieve(sub_query["query"], options)
                sub_result["sub_query"] = sub_query
                sub_results.append(sub_result)
            
            # Combine results
            combined_results = self._combine_results(query, sub_results)
            
            # Add metadata about the hierarchical retrieval
            combined_results["hierarchical"] = {
                "original_query": query,
                "sub_queries": sub_queries,
                "sub_results_count": [len(r.get("materials", [])) for r in sub_results]
            }
            
            return combined_results
            
        except Exception as e:
            logger.error(f"Error in hierarchical retrieval: {str(e)}")
            # Fall back to simple retrieval
            return await self._simple_retrieve(query, options)
    
    def _is_complex_query(self, query: str) -> bool:
        """
        Determine if a query is complex enough for decomposition.
        
        Args:
            query: User query
            
        Returns:
            True if the query is complex, False otherwise
        """
        # Check for multiple questions or aspects
        if "?" in query and query.count("?") > 1:
            return True
        
        # Check for conjunctions indicating multiple aspects
        conjunctions = ["and", "or", "versus", "vs", "compared to", "as well as"]
        for conjunction in conjunctions:
            if f" {conjunction} " in query.lower():
                return True
        
        # Check for multiple material types
        material_types = ["wood", "tile", "stone", "metal", "fabric", "glass", "ceramic"]
        found_types = [t for t in material_types if t in query.lower()]
        if len(found_types) > 1:
            return True
        
        # Check for multiple properties or characteristics
        property_terms = ["durability", "cost", "appearance", "installation", "maintenance"]
        found_props = [p for p in property_terms if p in query.lower()]
        if len(found_props) > 1:
            return True
        
        return False
    
    async def _decompose_query(self, query: str) -> List[Dict[str, Any]]:
        """
        Decompose a complex query into sub-queries.
        
        Args:
            query: Complex user query
            
        Returns:
            List of sub-queries with weights
        """
        if not self.llm_client:
            # Simple rule-based decomposition if no LLM client
            return self._rule_based_decomposition(query)
        
        try:
            # Use LLM to decompose query
            system_prompt = """
You are an expert at breaking down complex material-related queries into simpler sub-queries.
For the given query, identify the distinct aspects or questions being asked.
Return a JSON array of sub-queries, where each sub-query has:
1. "query": The specific sub-query text
2. "weight": A number from 0.1 to 1.0 indicating the importance of this sub-query to the original question
3. "aspect": A short description of what aspect this sub-query addresses

The weights should sum to 1.0. Focus on material properties, types, applications, and comparisons.
"""
            
            user_prompt = f"""
Please break down this complex query about materials into simpler sub-queries:

"{query}"

Return only the JSON array with no additional text.
"""
            
            # Call the LLM
            response = await self.llm_client.chat.completions.create(
                model=self.config["query_decomposition_model"],
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                max_tokens=500
            )
            
            # Extract and parse response
            response_text = response.choices[0].message.content
            
            # Extract JSON from response
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                sub_queries = json.loads(json_str)
                
                # Validate sub-queries
                valid_sub_queries = []
                for sq in sub_queries:
                    if "query" in sq and "weight" in sq:
                        valid_sub_queries.append(sq)
                
                # Limit number of sub-queries
                valid_sub_queries = valid_sub_queries[:self.config["max_sub_queries"]]
                
                # Normalize weights
                total_weight = sum(sq["weight"] for sq in valid_sub_queries)
                if total_weight > 0:
                    for sq in valid_sub_queries:
                        sq["weight"] = sq["weight"] / total_weight
                
                return valid_sub_queries
            
            # Fall back to rule-based decomposition
            logger.warning("LLM decomposition failed, falling back to rule-based")
            return self._rule_based_decomposition(query)
            
        except Exception as e:
            logger.error(f"Error in query decomposition: {str(e)}")
            return self._rule_based_decomposition(query)
    
    def _rule_based_decomposition(self, query: str) -> List[Dict[str, Any]]:
        """
        Decompose a query using rule-based methods.
        
        Args:
            query: Complex user query
            
        Returns:
            List of sub-queries with weights
        """
        sub_queries = []
        
        # Split by question marks
        if "?" in query and query.count("?") > 1:
            parts = [p.strip() + "?" for p in query.split("?") if p.strip()]
            parts = parts[:-1]  # Remove the last empty part
            
            for i, part in enumerate(parts):
                sub_queries.append({
                    "query": part,
                    "weight": 1.0 / len(parts),
                    "aspect": f"Question {i+1}"
                })
            
            return sub_queries[:self.config["max_sub_queries"]]
        
        # Split by conjunctions
        conjunctions = ["and", "or", "versus", "vs", "compared to", "as well as"]
        for conjunction in conjunctions:
            if f" {conjunction} " in query.lower():
                parts = query.lower().split(f" {conjunction} ")
                
                # Reconstruct with original case
                start_idx = 0
                original_parts = []
                for part in parts:
                    part_len = len(part)
                    original_part = query[start_idx:start_idx + part_len]
                    original_parts.append(original_part)
                    start_idx += part_len + len(f" {conjunction} ")
                
                for i, part in enumerate(original_parts):
                    sub_queries.append({
                        "query": part,
                        "weight": 1.0 / len(parts),
                        "aspect": f"Aspect {i+1}"
                    })
                
                if sub_queries:
                    return sub_queries[:self.config["max_sub_queries"]]
        
        # If no decomposition was possible, return the original query
        return [{
            "query": query,
            "weight": 1.0,
            "aspect": "Original query"
        }]
    
    async def _simple_retrieve(
        self,
        query: str,
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Perform simple retrieval using the base retriever.
        
        Args:
            query: User query
            options: Additional options for retrieval
            
        Returns:
            Retrieved materials and metadata
        """
        if not self.base_retriever:
            return {"materials": [], "metadata": {"error": "No base retriever available"}}
        
        try:
            # Call the base retriever
            results = await self.base_retriever.retrieve(query, options)
            return results
            
        except Exception as e:
            logger.error(f"Error in simple retrieval: {str(e)}")
            return {"materials": [], "metadata": {"error": str(e)}}
    
    def _combine_results(
        self,
        original_query: str,
        sub_results: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Combine results from sub-queries.
        
        Args:
            original_query: Original user query
            sub_results: Results from sub-queries
            
        Returns:
            Combined results
        """
        # Extract materials from all sub-results
        all_materials = []
        for result in sub_results:
            sub_query = result.get("sub_query", {})
            weight = sub_query.get("weight", 1.0 / len(sub_results))
            
            for material in result.get("materials", []):
                # Add sub-query information
                material["sub_query"] = sub_query.get("query", "")
                material["sub_query_aspect"] = sub_query.get("aspect", "")
                material["sub_query_weight"] = weight
                
                # Add to combined list
                all_materials.append(material)
        
        # Deduplicate materials
        deduplicated_materials = self._deduplicate_materials(all_materials)
        
        # Rerank if enabled
        if self.config["reranking_enabled"]:
            reranked_materials = self._rerank_materials(original_query, deduplicated_materials)
        else:
            reranked_materials = deduplicated_materials
        
        # Combine metadata
        combined_metadata = {
            "original_query": original_query,
            "sub_queries_count": len(sub_results),
            "total_materials_before_deduplication": len(all_materials),
            "total_materials_after_deduplication": len(deduplicated_materials)
        }
        
        # Add metadata from sub-results
        for i, result in enumerate(sub_results):
            if "metadata" in result:
                combined_metadata[f"sub_query_{i+1}_metadata"] = result["metadata"]
        
        return {
            "materials": reranked_materials,
            "metadata": combined_metadata
        }
    
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
                # Merge with existing material
                existing = deduplicated[material_id]
                
                # Combine scores with weights
                existing_weight = existing.get("sub_query_weight", 0.5)
                current_weight = material.get("sub_query_weight", 0.5)
                
                # Update score if available
                if "score" in existing and "score" in material:
                    existing["score"] = (existing["score"] * existing_weight + 
                                        material["score"] * current_weight) / (existing_weight + current_weight)
                
                # Add sub-query information
                if "sub_queries" not in existing:
                    existing["sub_queries"] = []
                
                existing["sub_queries"].append({
                    "query": material.get("sub_query", ""),
                    "aspect": material.get("sub_query_aspect", ""),
                    "weight": material.get("sub_query_weight", 0.0)
                })
        
        return list(deduplicated.values())
    
    def _rerank_materials(
        self,
        original_query: str,
        materials: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Rerank materials based on relevance to the original query.
        
        Args:
            original_query: Original user query
            materials: List of materials
            
        Returns:
            Reranked list of materials
        """
        # Calculate combined scores
        for material in materials:
            # Start with base score
            base_score = material.get("score", 0.5)
            
            # Calculate query term overlap
            query_terms = set(original_query.lower().split())
            material_text = " ".join([
                material.get("name", ""),
                material.get("description", ""),
                material.get("material_type", "")
            ]).lower()
            material_terms = set(material_text.split())
            
            overlap = len(query_terms.intersection(material_terms)) / max(1, len(query_terms))
            
            # Calculate sub-query coverage
            sub_query_coverage = 0.0
            if "sub_queries" in material:
                sub_query_coverage = sum(sq.get("weight", 0.0) for sq in material["sub_queries"])
            
            # Combine scores
            combined_score = (
                base_score * 0.6 +
                overlap * 0.2 +
                sub_query_coverage * 0.2
            )
            
            material["combined_score"] = combined_score
        
        # Sort by combined score
        reranked = sorted(materials, key=lambda x: x.get("combined_score", 0.0), reverse=True)
        
        return reranked


# Factory function to create a hierarchical retriever
def create_hierarchical_retriever(
    config: Dict[str, Any],
    base_retriever=None,
    llm_client=None
) -> HierarchicalRetriever:
    """
    Create a HierarchicalRetriever with specified configuration and dependencies.
    
    Args:
        config: Configuration for the retriever
        base_retriever: Base retriever for executing sub-queries
        llm_client: LLM client for query decomposition
        
    Returns:
        Configured HierarchicalRetriever
    """
    return HierarchicalRetriever(
        config=config,
        base_retriever=base_retriever,
        llm_client=llm_client
    )
