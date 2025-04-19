#!/usr/bin/env python3
"""
Vector Search Client for Supabase

This module provides a client class to interact with Supabase for vector search operations,
including dense, sparse, and text-based searches on material data.
It replaces the previous local FAISS/NumPy implementation.
"""

import os
import sys
import json
import argparse
import numpy as np
import logging
from typing import Dict, List, Any, Tuple, Optional

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('vector_search_client')

# Try to import supabase-py
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logger.error("supabase-py library not found. Please install it: pip install supabase")
    # Allow script to load but client will fail if used without library

# Type Aliases
SearchResult = Dict[str, Any]
ResultList = List[SearchResult]
SparseEmbedding = Dict[str, Any] # Expects {'indices': List[int], 'values': List[float], 'dimensions': int}

class VectorSearchClient:
    """Client for performing vector search operations using Supabase."""

    def __init__(self, supabase_url: Optional[str] = None, supabase_key: Optional[str] = None):
        """
        Initialize the VectorSearchClient.

        Args:
            supabase_url: Supabase project URL. Reads from SUPABASE_URL env var if None.
            supabase_key: Supabase service role key. Reads from SUPABASE_KEY env var if None.
        """
        if not SUPABASE_AVAILABLE:
            raise ImportError("Supabase client library is not installed.")

        url = supabase_url or os.environ.get('SUPABASE_URL')
        key = supabase_key or os.environ.get('SUPABASE_KEY')

        if not url or not key:
            raise ValueError("Supabase URL and Key must be provided or set as environment variables (SUPABASE_URL, SUPABASE_KEY).")

        try:
            self.supabase: Client = create_client(url, key)
            logger.info("Supabase client initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            raise

    async def find_similar_by_vector(
        self,
        vector: List[float],
        table: str = "materials",
        column: str = "dense_embedding", # Assuming this is the vector column
        threshold: float = 0.5,
        limit: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        material_type: Optional[str] = None,
        index_name: Optional[str] = None # Added for potential index hints
    ) -> ResultList:
        """
        Find similar items using dense vector similarity search via RPC.

        Args:
            vector: The dense query vector.
            table: The table to search (unused, RPC handles table).
            column: The vector column name (unused, RPC handles column).
            threshold: Similarity threshold.
            limit: Maximum number of results.
            filters: Dictionary of metadata filters (e.g., {"manufacturer": "Acme"}).
            material_type: Optional material type filter.
            index_name: Optional index name hint (unused, RPC handles index).

        Returns:
            List of search results with similarity scores.
        """
        try:
            # Use a generic RPC function assuming it handles filtering internally
            # Based on enhanced-vector-service.ts, 'find_similar_materials_hybrid' seems relevant
            # but we need a dense-only version or pass null for sparse.
            # Let's assume a function 'find_similar_materials_dense' exists or adapt hybrid.
            rpc_function = 'find_similar_materials_dense' # Assumed RPC function name
            rpc_params = {
                'dense_query_vector': vector,
                'similarity_threshold': threshold,
                'max_results': limit,
                'filter_conditions': filters or {} # Pass filters to RPC
            }
            if material_type:
                rpc_params['material_type_filter'] = material_type

            logger.debug(f"Calling RPC '{rpc_function}' with params: {rpc_params.keys()}")
            response = self.supabase.rpc(rpc_function, rpc_params).execute()

            if response.data:
                # Assuming RPC returns id, name, material_type, similarity
                return [
                    {
                        "id": item.get("id"),
                        "name": item.get("name"),
                        "materialType": item.get("material_type"),
                        "similarity": item.get("similarity"),
                        "matchedBy": "dense"
                    } for item in response.data
                ]
            else:
                 # Log potential RPC errors if available in response structure
                 if hasattr(response, 'error') and response.error:
                     logger.error(f"RPC '{rpc_function}' error: {response.error}")
                 return []

        except Exception as e:
            logger.error(f"Error in find_similar_by_vector: {e}")
            # Re-raise or handle appropriately
            raise

    async def find_similar_by_sparse_vector(
        self,
        indices: List[int],
        values: List[float],
        dimensions: int,
        table: str = "materials", # Unused, RPC handles table
        threshold: float = 0.4,
        limit: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        material_type: Optional[str] = None
    ) -> ResultList:
        """
        Find similar items using sparse vector similarity search via RPC.

        Args:
            indices: List of indices for the sparse vector.
            values: List of values for the sparse vector.
            dimensions: The total dimensions of the sparse vector space.
            table: The table to search (unused).
            threshold: Similarity threshold.
            limit: Maximum number of results.
            filters: Dictionary of metadata filters.
            material_type: Optional material type filter.

        Returns:
            List of search results with similarity scores.
        """
        try:
            # Assume an RPC function exists for sparse search, e.g., 'find_similar_materials_sparse'
            # Or adapt the hybrid one.
            rpc_function = 'find_similar_materials_sparse' # Assumed RPC function name
            sparse_embedding_json = {
                "indices": indices,
                "values": values,
                "dimensions": dimensions
            }
            rpc_params = {
                'sparse_query_vector': sparse_embedding_json,
                'similarity_threshold': threshold,
                'max_results': limit,
                'filter_conditions': filters or {} # Pass filters to RPC
            }
            if material_type:
                rpc_params['material_type_filter'] = material_type

            logger.debug(f"Calling RPC '{rpc_function}' with params: {rpc_params.keys()}")
            response = self.supabase.rpc(rpc_function, rpc_params).execute()

            if response.data:
                 # Assuming RPC returns id, name, material_type, similarity
                 return [
                     {
                         "id": item.get("id"),
                         "name": item.get("name"),
                         "materialType": item.get("material_type"),
                         "similarity": item.get("similarity"),
                         "matchedBy": "sparse"
                     } for item in response.data
                 ]
            else:
                 if hasattr(response, 'error') and response.error:
                     logger.error(f"RPC '{rpc_function}' error: {response.error}")
                 return []

        except Exception as e:
            logger.error(f"Error in find_similar_by_sparse_vector: {e}")
            raise

    async def find_by_text(
        self,
        query: str,
        table: str = "materials",
        text_columns: List[str] = ["name", "description", "keywords"], # Assuming these columns exist and are indexed
        limit: int = 10,
        filters: Optional[Dict[str, Any]] = None
    ) -> ResultList:
        """
        Find items using full-text search.

        Args:
            query: The text query string.
            table: The table to search.
            text_columns: List of columns to search against.
            limit: Maximum number of results.
            filters: Dictionary of metadata filters.

        Returns:
            List of search results with relevance scores (if available).
        """
        try:
            # Use Supabase's textSearch feature
            # Note: Requires tsvector column and index in the database
            # Example: searching 'fts' column using 'websearch' config
            fts_column = 'fts' # Assumed tsvector column name
            query_builder = self.supabase.table(table).select('*, similarity: fts <=> websearch_to_tsquery(\'english\', query)') # Calculate similarity

            # Apply filters
            if filters:
                for key, value in filters.items():
                    # Basic equality filter, extend as needed
                    query_builder = query_builder.eq(key, value)

            # Apply text search
            # Use websearch_to_tsquery for more flexible query parsing
            query_builder = query_builder.text_search(fts_column, f"'{query}'", config='english', type='websearch')

            # Order by similarity (descending) and limit
            query_builder = query_builder.order('similarity', desc=True).limit(limit)

            logger.debug(f"Executing text search query on table '{table}' for query: {query}")
            response = query_builder.execute()

            if response.data:
                 return [
                     {
                         "id": item.get("id"),
                         "name": item.get("name"),
                         "materialType": item.get("material_type"),
                         "similarity": item.get("similarity", 0.0), # Use calculated similarity
                         "matchedBy": "text"
                     } for item in response.data
                 ]
            else:
                 if hasattr(response, 'error') and response.error:
                     logger.error(f"Text search error: {response.error}")
                 return []

        except Exception as e:
            logger.error(f"Error in find_by_text: {e}")
            raise

    async def get_materials_by_ids(self, material_ids: List[str]) -> ResultList:
        """
        Retrieve full material details for a list of IDs.

        Args:
            material_ids: List of material IDs to retrieve.

        Returns:
            List of material details.
        """
        if not material_ids:
            return []
        try:
            response = self.supabase.table("materials").select("*").in_("id", material_ids).execute()

            if response.data:
                return response.data
            else:
                if hasattr(response, 'error') and response.error:
                    logger.error(f"Error getting materials by IDs: {response.error}")
                return []
        except Exception as e:
            logger.error(f"Error in get_materials_by_ids: {e}")
            raise

    async def search(
        self,
        query: str,
        material_type: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 10,
        threshold: float = 0.5,
        dense_weight: float = 0.7,
        exclude_ids: Optional[List[str]] = None # Added for knowledge_first search
    ) -> ResultList:
        """
        Performs a hybrid search using the Supabase RPC function.
        This acts as a simplified interface, assuming the RPC handles the hybrid logic.

        Args:
            query: The search query text.
            material_type: Optional material type filter.
            filters: Additional metadata filters.
            limit: Maximum number of results.
            threshold: Similarity threshold.
            dense_weight: Weight for dense vector contribution (passed to RPC).
            exclude_ids: Optional list of IDs to exclude from results.

        Returns:
            List of search results.
        """
        try:
            # Generate hybrid embedding for the query
            # Assuming HybridEmbeddingGenerator exists and works
            # Need to instantiate it or import a function
            from enhanced_text_embeddings import generate_text_embedding
            embedding_result = generate_text_embedding(
                text=query,
                method='hybrid',
                material_category=material_type
            )

            if not embedding_result.get("dense_vector"):
                raise ValueError("Failed to generate dense vector for query.")

            sparse_embedding_json = None
            if embedding_result.get("sparse_indices") and embedding_result.get("sparse_values"):
                sparse_embedding_json = {
                    "indices": embedding_result["sparse_indices"],
                    "values": embedding_result["sparse_values"],
                    "dimensions": embedding_result.get("sparse_dimensions", 10000) # Default dimension
                }

            # Call the hybrid search RPC function
            rpc_function = 'find_similar_materials_hybrid' # Assumed RPC function name
            rpc_params = {
                'dense_query_vector': embedding_result["dense_vector"],
                'sparse_query_vector': sparse_embedding_json,
                'similarity_threshold': threshold,
                'max_results': limit,
                'material_type_filter': material_type,
                'dense_weight': dense_weight,
                'filter_conditions': filters or {}, # Pass filters
                'exclude_ids_list': exclude_ids or [] # Pass exclude_ids
            }

            logger.debug(f"Calling RPC '{rpc_function}' with params: {rpc_params.keys()}")
            response = self.supabase.rpc(rpc_function, rpc_params).execute()

            if response.data:
                 # Assuming RPC returns id, name, material_type, similarity, matched_by
                 return [
                     {
                         "id": item.get("id"),
                         "name": item.get("name"),
                         "materialType": item.get("material_type"),
                         "similarity": item.get("similarity"),
                         "matchedBy": item.get("matched_by", "hybrid") # Default to hybrid if missing
                     } for item in response.data
                 ]
            else:
                 if hasattr(response, 'error') and response.error:
                     logger.error(f"RPC '{rpc_function}' error: {response.error}")
                 return []

        except Exception as e:
            logger.error(f"Error in hybrid search: {e}")
            raise


# Example usage or testing
async def main_test(args):
    """Main function for testing the client."""
    client = VectorSearchClient()

    if args.command == "search_dense":
        # Example dense vector (replace with actual embedding generation)
        # Need embedding generator here
        from enhanced_text_embeddings import generate_text_embedding
        embed_res = generate_text_embedding(args.query, method='dense')
        query_vector = embed_res.get('dense_vector')

        if not query_vector:
            print("Failed to generate query vector.")
            return

        results = await client.find_similar_by_vector(
            vector=query_vector,
            limit=args.num_results,
            threshold=args.threshold,
            material_type=args.material_type
        )
        print(json.dumps(results, indent=2))

    elif args.command == "search_sparse":
         # Example sparse vector generation
         from enhanced_text_embeddings import generate_text_embedding
         embed_res = generate_text_embedding(args.query, method='sparse')
         indices = embed_res.get('sparse_indices')
         values = embed_res.get('sparse_values')
         dims = embed_res.get('sparse_dimensions')

         if indices is None or values is None or dims is None:
             print("Failed to generate sparse query vector.")
             return

         results = await client.find_similar_by_sparse_vector(
             indices=indices,
             values=values,
             dimensions=dims,
             limit=args.num_results,
             threshold=args.threshold,
             material_type=args.material_type
         )
         print(json.dumps(results, indent=2))

    elif args.command == "search_text":
        results = await client.find_by_text(
            query=args.query,
            limit=args.num_results,
            filters={"material_type": args.material_type} if args.material_type else None
        )
        print(json.dumps(results, indent=2))

    elif args.command == "search_hybrid":
         results = await client.search(
             query=args.query,
             limit=args.num_results,
             threshold=args.threshold,
             material_type=args.material_type
         )
         print(json.dumps(results, indent=2))

    elif args.command == "get_by_ids":
        if not args.ids:
            print("Please provide --ids for get_by_ids command.")
            return
        ids_list = args.ids.split(',')
        results = await client.get_materials_by_ids(ids_list)
        print(json.dumps(results, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Supabase Vector Search Client CLI")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    common_search_args = argparse.ArgumentParser(add_help=False)
    common_search_args.add_argument("--query", required=True, help="Search query text")
    common_search_args.add_argument("--num-results", type=int, default=5, help="Number of results")
    common_search_args.add_argument("--threshold", type=float, default=0.0, help="Similarity threshold")
    common_search_args.add_argument("--material-type", help="Filter by material type")

    search_dense_parser = subparsers.add_parser("search_dense", help="Search using dense vectors", parents=[common_search_args])
    search_sparse_parser = subparsers.add_parser("search_sparse", help="Search using sparse vectors", parents=[common_search_args])
    search_text_parser = subparsers.add_parser("search_text", help="Search using text", parents=[common_search_args])
    search_hybrid_parser = subparsers.add_parser("search_hybrid", help="Search using hybrid RPC", parents=[common_search_args])

    get_ids_parser = subparsers.add_parser("get_by_ids", help="Get materials by IDs")
    get_ids_parser.add_argument("--ids", required=True, help="Comma-separated list of material IDs")

    args = parser.parse_args()

    if hasattr(args, 'command') and args.command:
        import asyncio
        asyncio.run(main_test(args))
    else:
        parser.print_help()