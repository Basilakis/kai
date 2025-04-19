#!/usr/bin/env python3
"""
Knowledge Base Client for Supabase

This module provides a client class to interact with Supabase tables
containing knowledge base entries and material relationships.
"""

import os
import logging
from typing import Dict, List, Any, Optional

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('knowledge_client')

# Try to import supabase-py
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logger.error("supabase-py library not found. Please install it: pip install supabase")

# Type Aliases (can be refined with TypedDict or dataclasses if needed)
KnowledgeEntry = Dict[str, Any]
KnowledgeList = List[KnowledgeEntry]
MaterialRelationship = Dict[str, Any]
RelationshipList = List[MaterialRelationship]

class KnowledgeClient:
    """Client for interacting with the knowledge base stored in Supabase."""

    def __init__(self, supabase_url: Optional[str] = None, supabase_key: Optional[str] = None):
        """
        Initialize the KnowledgeClient.

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
            logger.info("KnowledgeClient: Supabase client initialized successfully.")
        except Exception as e:
            logger.error(f"KnowledgeClient: Failed to initialize Supabase client: {e}")
            raise

    async def get_entries_for_materials(
        self,
        material_ids: List[str],
        max_entries_per_material: int = 5,
        quality_threshold: float = 0.7,
        query: Optional[str] = None, # For potential semantic filtering
        semantic_indexing: bool = False # Flag for future use
    ) -> KnowledgeList:
        """
        Retrieve knowledge entries associated with a list of material IDs.

        Args:
            material_ids: List of material IDs.
            max_entries_per_material: Max entries to return per material.
            quality_threshold: Minimum quality score for entries.
            query: Optional query text for semantic relevance filtering (requires RPC).
            semantic_indexing: Flag indicating if semantic organization is needed (handled by caller).

        Returns:
            List of knowledge entries.
        """
        if not material_ids:
            return []
        try:
            # Base query
            query_builder = self.supabase.table("knowledge_entries") \
                .select("*") \
                .in_("material_id", material_ids) \
                .gte("confidence", quality_threshold) # Assuming a 'confidence' column

            # TODO: Implement semantic filtering based on 'query' if needed.
            # This might require an RPC function that takes the query embedding
            # and compares it against knowledge entry embeddings.
            # For now, we just filter by material_id and quality.

            # Execute query
            response = query_builder.execute()

            if response.data:
                # Group by material_id and limit
                entries_by_material: Dict[str, List[KnowledgeEntry]] = {}
                for entry in response.data:
                    mat_id = entry.get("material_id")
                    if mat_id:
                        if mat_id not in entries_by_material:
                            entries_by_material[mat_id] = []
                        # Sort by relevance/confidence before limiting? Assume sorted by DB or add sorting.
                        if len(entries_by_material[mat_id]) < max_entries_per_material:
                            entries_by_material[mat_id].append(entry)

                # Flatten the results
                all_entries = [entry for entries in entries_by_material.values() for entry in entries]
                return all_entries
            else:
                if hasattr(response, 'error') and response.error:
                    logger.error(f"Error getting knowledge entries: {response.error}")
                return []
        except Exception as e:
            logger.error(f"Error in get_entries_for_materials: {e}")
            raise

    async def get_entries_by_embedding(
        self,
        embedding: List[float],
        max_entries: int = 5,
        threshold: float = 0.6,
        material_type: Optional[str] = None # For potential filtering
    ) -> KnowledgeList:
        """
        Retrieve knowledge entries based on semantic similarity using embeddings.

        Args:
            embedding: The query embedding vector.
            max_entries: Maximum number of entries to return.
            threshold: Similarity threshold.
            material_type: Optional material type filter.

        Returns:
            List of knowledge entries.
        """
        try:
            # Assume an RPC function 'find_knowledge_by_embedding' exists
            rpc_function = 'find_knowledge_by_embedding'
            rpc_params = {
                'query_vector': embedding,
                'similarity_threshold': threshold,
                'max_results': max_entries
            }
            # Add filtering if the RPC supports it
            # if material_type:
            #     rpc_params['material_type_filter'] = material_type

            logger.debug(f"Calling RPC '{rpc_function}'")
            response = self.supabase.rpc(rpc_function, rpc_params).execute()

            if response.data:
                # Assuming RPC returns full knowledge entry structure + similarity
                return response.data
            else:
                if hasattr(response, 'error') and response.error:
                    logger.error(f"RPC '{rpc_function}' error: {response.error}")
                return []
        except Exception as e:
            logger.error(f"Error in get_entries_by_embedding: {e}")
            raise

    async def get_material_relationships(
        self,
        material_ids: List[str],
        relationship_types: Optional[List[str]] = None,
        max_relationships: int = 10
    ) -> RelationshipList:
        """
        Retrieve relationships for a list of materials.

        Args:
            material_ids: List of source material IDs.
            relationship_types: Optional list of relationship types to filter by.
            max_relationships: Maximum total relationships to return.

        Returns:
            List of material relationships.
        """
        if not material_ids:
            return []
        try:
            query_builder = self.supabase.table("material_relationships") \
                .select("*") \
                .in_("source_id", material_ids) \
                .order("strength", desc=True) # Order by strength to get most relevant
                .limit(max_relationships)

            if relationship_types:
                query_builder = query_builder.in_("type", relationship_types)

            response = query_builder.execute()

            if response.data:
                return response.data
            else:
                if hasattr(response, 'error') and response.error:
                    logger.error(f"Error getting material relationships: {response.error}")
                return []
        except Exception as e:
            logger.error(f"Error in get_material_relationships: {e}")
            raise

    async def search_knowledge_base(
        self,
        query: str,
        material_type: Optional[str] = None,
        limit: int = 10
    ) -> KnowledgeList:
        """
        Perform text search directly on the knowledge base.

        Args:
            query: The text query string.
            material_type: Optional material type filter.
            limit: Maximum number of results.

        Returns:
            List of relevant knowledge entries.
        """
        try:
            # Use Supabase's textSearch feature on 'knowledge_entries' table
            # Assuming 'fts' column exists on knowledge_entries
            fts_column = 'fts'
            query_builder = self.supabase.table("knowledge_entries") \
                .select('*, similarity: fts <=> websearch_to_tsquery(\'english\', query)') # Calculate similarity

            # Apply material_type filter if provided
            if material_type:
                # This assumes knowledge entries have a material_type column or relation
                # Adjust filter as per actual schema
                query_builder = query_builder.eq('material_type', material_type)

            # Apply text search
            query_builder = query_builder.text_search(fts_column, f"'{query}'", config='english', type='websearch')

            # Order by similarity and limit
            query_builder = query_builder.order('similarity', desc=True).limit(limit)

            logger.debug(f"Executing knowledge base text search for query: {query}")
            response = query_builder.execute()

            if response.data:
                return response.data
            else:
                if hasattr(response, 'error') and response.error:
                    logger.error(f"Knowledge base text search error: {response.error}")
                return []
        except Exception as e:
            logger.error(f"Error in search_knowledge_base: {e}")
            raise

# Example usage or testing
async def main_test(args):
    """Main function for testing the client."""
    client = KnowledgeClient()

    if args.command == "get_entries":
        if not args.ids:
            print("Please provide --ids")
            return
        ids_list = args.ids.split(',')
        results = await client.get_entries_for_materials(ids_list, max_entries_per_material=args.limit)
        print(json.dumps(results, indent=2))

    elif args.command == "get_relationships":
        if not args.ids:
            print("Please provide --ids")
            return
        ids_list = args.ids.split(',')
        results = await client.get_material_relationships(ids_list, max_relationships=args.limit)
        print(json.dumps(results, indent=2))

    elif args.command == "search_knowledge":
        if not args.query:
            print("Please provide --query")
            return
        results = await client.search_knowledge_base(args.query, material_type=args.material_type, limit=args.limit)
        print(json.dumps(results, indent=2))

    # Add test for get_entries_by_embedding if needed, requires generating an embedding first

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Supabase Knowledge Base Client CLI")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Get Entries command
    entries_parser = subparsers.add_parser("get_entries", help="Get knowledge entries for material IDs")
    entries_parser.add_argument("--ids", required=True, help="Comma-separated list of material IDs")
    entries_parser.add_argument("--limit", type=int, default=5, help="Max entries per material")

    # Get Relationships command
    rels_parser = subparsers.add_parser("get_relationships", help="Get relationships for material IDs")
    rels_parser.add_argument("--ids", required=True, help="Comma-separated list of material IDs")
    rels_parser.add_argument("--limit", type=int, default=10, help="Max total relationships")

    # Search Knowledge command
    search_parser = subparsers.add_parser("search_knowledge", help="Text search the knowledge base")
    search_parser.add_argument("--query", required=True, help="Search query text")
    search_parser.add_argument("--material-type", help="Filter by material type")
    search_parser.add_argument("--limit", type=int, default=10, help="Max results")

    args = parser.parse_args()

    if hasattr(args, 'command') and args.command:
        import asyncio
        asyncio.run(main_test(args))
    else:
        parser.print_help()