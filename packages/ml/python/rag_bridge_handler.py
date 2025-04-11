#!/usr/bin/env python3
"""
RAG Bridge Handler

This script acts as a communication bridge between the TypeScript RAG Bridge and the Python RAG components.
It parses command line arguments and routes requests to the appropriate RAG system components.
"""

import argparse
import json
import logging
import os
import sys
import time
from typing import Any, Dict, List, Optional, Union

# Import RAG components
try:
    from enhanced_text_embeddings import TextEmbeddingGenerator
    from hybrid_retriever import HybridRetriever
    from context_assembler import ContextAssembler
    from generative_enhancer import GenerativeEnhancer
    from material_rag_service import MaterialRAGService, create_material_rag_service
except ImportError as e:
    print(f"Error importing RAG components: {e}")
    print("Please ensure the RAG components are in the Python path.")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("rag_bridge_handler")

# Global RAG service instance
_rag_service: Optional[MaterialRAGService] = None

def get_rag_service(config: Optional[Dict[str, Any]] = None) -> MaterialRAGService:
    """
    Get or create the RAG service instance.
    
    Args:
        config: Optional configuration for the RAG service
        
    Returns:
        RAG service instance
    """
    global _rag_service
    if _rag_service is None:
        logger.info("Creating new RAG service instance")
        _rag_service = create_material_rag_service(config=config)
    elif config is not None:
        # Update configuration if provided
        logger.info("Updating RAG service configuration")
        _rag_service.updateConfig(config)
    
    return _rag_service

def handle_verify_modules(args: argparse.Namespace) -> None:
    """
    Verify that all required RAG modules are available.
    
    Args:
        args: Command line arguments
    """
    try:
        # Try to import all required modules
        logger.info("Verifying RAG modules...")
        
        # Check each module by accessing a key class/function
        TextEmbeddingGenerator
        HybridRetriever
        ContextAssembler
        GenerativeEnhancer
        MaterialRAGService
        
        # Initialize the RAG service with the provided config
        if args.config:
            config = json.loads(args.config)
            get_rag_service(config)
        else:
            get_rag_service()
        
        print(json.dumps({
            "status": "success",
            "message": "All RAG modules verified successfully"
        }))
    except Exception as e:
        logger.error(f"Error verifying RAG modules: {e}")
        print(json.dumps({
            "status": "error",
            "message": f"Error verifying RAG modules: {str(e)}"
        }))
        sys.exit(1)

def handle_query(args: argparse.Namespace) -> None:
    """
    Handle a RAG query.
    
    Args:
        args: Command line arguments
    """
    try:
        # Parse the query
        if not args.query:
            raise ValueError("Query parameter is required")
        
        query_obj = json.loads(args.query)
        
        # Get the RAG service
        rag_service = get_rag_service()
        
        # Execute the query
        query_text = query_obj.get("query", "")
        filters = query_obj.get("filters")
        options = query_obj.get("options")
        session_id = query_obj.get("sessionId")
        
        if not query_text:
            raise ValueError("Query text is required")
        
        # Use asyncio to run the async query method
        import asyncio
        response = asyncio.run(
            rag_service.query(
                query_text=query_text,
                filters=filters,
                options=options,
                session_id=session_id
            )
        )
        
        # Convert the response to JSON
        print(json.dumps(response))
    except Exception as e:
        logger.error(f"Error handling query: {e}")
        print(json.dumps({
            "error": str(e),
            "metadata": {
                "timestamp": time.time(),
                "error": True
            }
        }))

def handle_streaming(args: argparse.Namespace) -> None:
    """
    Handle a streaming RAG query.
    
    Args:
        args: Command line arguments
    """
    try:
        # Parse the query
        if not args.query:
            raise ValueError("Query parameter is required")
        
        query_obj = json.loads(args.query)
        
        # Get the RAG service
        rag_service = get_rag_service()
        
        # Execute the query
        query_text = query_obj.get("query", "")
        filters = query_obj.get("filters")
        options = query_obj.get("options")
        session_id = query_obj.get("sessionId")
        
        if not query_text:
            raise ValueError("Query text is required")
        
        # Use asyncio to run the async streaming generator
        import asyncio
        
        async def stream_results():
            # Start event
            print(json.dumps({
                "event": "start",
                "timestamp": time.time()
            }))
            
            # Use the streaming_query method
            async for chunk in rag_service.streaming_query(
                query_text=query_text,
                filters=filters,
                options=options,
                session_id=session_id
            ):
                print(chunk)
                # Flush to ensure output is sent immediately
                sys.stdout.flush()
        
        # Run the streaming function
        asyncio.run(stream_results())
    except Exception as e:
        logger.error(f"Error handling streaming query: {e}")
        print(json.dumps({
            "event": "error",
            "error": str(e),
            "timestamp": time.time()
        }))

def handle_batch(args: argparse.Namespace) -> None:
    """
    Handle a batch of RAG queries.
    
    Args:
        args: Command line arguments
    """
    try:
        # Parse the queries
        if not args.queries:
            raise ValueError("Queries parameter is required")
        
        queries = json.loads(args.queries)
        session_id = args.sessionId
        max_concurrent = args.maxConcurrent
        
        if not isinstance(queries, list):
            raise ValueError("Queries must be a list")
        
        # Get the RAG service
        rag_service = get_rag_service()
        
        # Execute the batch query
        import asyncio
        responses = asyncio.run(
            rag_service.batch_query(
                queries=queries,
                session_id=session_id,
                max_concurrent=int(max_concurrent) if max_concurrent else None
            )
        )
        
        # Convert the responses to JSON
        print(json.dumps(responses))
    except Exception as e:
        logger.error(f"Error handling batch query: {e}")
        print(json.dumps({
            "error": str(e),
            "metadata": {
                "timestamp": time.time(),
                "error": True
            }
        }))

def handle_stats(args: argparse.Namespace) -> None:
    """
    Get usage statistics for the RAG service.
    
    Args:
        args: Command line arguments
    """
    try:
        # Get the RAG service
        rag_service = get_rag_service()
        
        # Get the statistics
        stats = rag_service.get_usage_statistics()
        
        # Convert the statistics to JSON
        print(json.dumps(stats))
    except Exception as e:
        logger.error(f"Error getting statistics: {e}")
        print(json.dumps({
            "error": str(e),
            "metadata": {
                "timestamp": time.time(),
                "error": True
            }
        }))

def handle_clear_cache(args: argparse.Namespace) -> None:
    """
    Clear the RAG service cache.
    
    Args:
        args: Command line arguments
    """
    try:
        # Get the RAG service
        rag_service = get_rag_service()
        
        # Clear the cache
        rag_service.clear_cache()
        
        # Return success
        print(json.dumps({
            "status": "success",
            "message": "Cache cleared successfully"
        }))
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        print(json.dumps({
            "error": str(e),
            "metadata": {
                "timestamp": time.time(),
                "error": True
            }
        }))

def handle_health(args: argparse.Namespace) -> None:
    """
    Get the health status of the RAG service.
    
    Args:
        args: Command line arguments
    """
    try:
        # Get the RAG service
        rag_service = get_rag_service()
        
        # Get the health status
        health = rag_service.get_health_status()
        
        # Convert the health status to JSON
        print(json.dumps(health))
    except Exception as e:
        logger.error(f"Error getting health status: {e}")
        print(json.dumps({
            "error": str(e),
            "metadata": {
                "timestamp": time.time(),
                "error": True
            }
        }))

def handle_update_config(args: argparse.Namespace) -> None:
    """
    Update the RAG service configuration.
    
    Args:
        args: Command line arguments
    """
    try:
        # Parse the configuration
        if not args.config:
            raise ValueError("Config parameter is required")
        
        config = json.loads(args.config)
        
        # Get the RAG service
        rag_service = get_rag_service()
        
        # Update the configuration
        rag_service.updateConfig(config)
        
        # Return success
        print(json.dumps({
            "status": "success",
            "message": "Configuration updated successfully"
        }))
    except Exception as e:
        logger.error(f"Error updating configuration: {e}")
        print(json.dumps({
            "error": str(e),
            "metadata": {
                "timestamp": time.time(),
                "error": True
            }
        }))

def handle_optimize(args: argparse.Namespace) -> None:
    """
    Optimize the RAG service for a specific material.
    
    Args:
        args: Command line arguments
    """
    try:
        # Parse the material ID
        if not args.materialId:
            raise ValueError("Material ID parameter is required")
        
        material_id = args.materialId
        
        # Get the RAG service
        rag_service = get_rag_service()
        
        # Optimize for the material
        import asyncio
        result = asyncio.run(
            rag_service.optimize_for_material(material_id)
        )
        
        # Convert the result to JSON
        print(json.dumps(result))
    except Exception as e:
        logger.error(f"Error optimizing for material: {e}")
        print(json.dumps({
            "error": str(e),
            "metadata": {
                "timestamp": time.time(),
                "error": True
            }
        }))

def main():
    """
    Main entry point.
    """
    parser = argparse.ArgumentParser(description="RAG Bridge Handler")
    parser.add_argument("--mode", required=True, help="Operation mode")
    parser.add_argument("--query", help="Query JSON")
    parser.add_argument("--queries", help="Batch queries JSON")
    parser.add_argument("--config", help="Configuration JSON")
    parser.add_argument("--sessionId", help="Session ID")
    parser.add_argument("--maxConcurrent", help="Maximum concurrent requests")
    parser.add_argument("--materialId", help="Material ID")
    
    args = parser.parse_args()
    
    # Route to the appropriate handler based on the mode
    if args.mode == "verify":
        handle_verify_modules(args)
    elif args.mode == "query":
        handle_query(args)
    elif args.mode == "streaming":
        handle_streaming(args)
    elif args.mode == "batch":
        handle_batch(args)
    elif args.mode == "stats":
        handle_stats(args)
    elif args.mode == "clear_cache":
        handle_clear_cache(args)
    elif args.mode == "health":
        handle_health(args)
    elif args.mode == "update_config":
        handle_update_config(args)
    elif args.mode == "optimize":
        handle_optimize(args)
    else:
        logger.error(f"Unknown mode: {args.mode}")
        print(json.dumps({
            "error": f"Unknown mode: {args.mode}",
            "metadata": {
                "timestamp": time.time(),
                "error": True
            }
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()