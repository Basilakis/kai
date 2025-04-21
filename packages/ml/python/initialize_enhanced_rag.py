#!/usr/bin/env python3
"""
Initialize Enhanced RAG

This script initializes the enhanced RAG system and connects it to the existing system.
It can be used as a standalone script or imported as a module.
"""

import argparse
import asyncio
import json
import logging
import os
import sys
from typing import Any, Dict, Optional

# Import enhanced RAG components
from enhanced_rag_config import get_config
from rag_integration import create_enhanced_rag_integration

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

async def initialize_enhanced_rag(
    config_path: Optional[str] = None,
    override_config: Optional[Dict[str, Any]] = None,
    existing_components: Optional[Dict[str, Any]] = None
):
    """
    Initialize the enhanced RAG system.
    
    Args:
        config_path: Path to the configuration file (optional)
        override_config: Override configuration (optional)
        existing_components: Existing components to use (optional)
        
    Returns:
        Initialized EnhancedRAGIntegration
    """
    try:
        # Get configuration
        config = get_config(config_path, override_config)
        
        # Extract existing components
        existing_components = existing_components or {}
        base_retriever = existing_components.get("base_retriever")
        embedding_model = existing_components.get("embedding_model")
        vision_model = existing_components.get("vision_model")
        text_model = existing_components.get("text_model")
        llm_client = existing_components.get("llm_client")
        feedback_db = existing_components.get("feedback_db")
        vector_stores = existing_components.get("vector_stores")
        
        # Create enhanced RAG integration
        enhanced_rag = create_enhanced_rag_integration(
            config=config,
            base_retriever=base_retriever,
            embedding_model=embedding_model,
            vision_model=vision_model,
            text_model=text_model,
            llm_client=llm_client,
            feedback_db=feedback_db,
            vector_stores=vector_stores
        )
        
        logger.info("Enhanced RAG system initialized successfully")
        return enhanced_rag
        
    except Exception as e:
        logger.error(f"Error initializing enhanced RAG system: {str(e)}")
        raise

async def test_enhanced_rag(enhanced_rag):
    """
    Test the enhanced RAG system with a simple query.
    
    Args:
        enhanced_rag: Initialized EnhancedRAGIntegration
    """
    try:
        # Test with a simple query
        query = "What are the best hardwood flooring options for high-traffic areas?"
        
        logger.info(f"Testing enhanced RAG with query: {query}")
        
        # Process query
        result = await enhanced_rag.process_query(text_query=query)
        
        # Print result summary
        materials_count = len(result.get("materials", []))
        logger.info(f"Retrieved {materials_count} materials")
        
        if materials_count > 0:
            first_material = result.get("materials", [{}])[0]
            logger.info(f"First material: {first_material.get('name')}")
        
        # Get system stats
        stats = await enhanced_rag.get_system_stats()
        logger.info(f"System stats: {json.dumps(stats, indent=2)}")
        
        logger.info("Enhanced RAG test completed successfully")
        
    except Exception as e:
        logger.error(f"Error testing enhanced RAG: {str(e)}")

async def main():
    """
    Main function for standalone execution.
    """
    parser = argparse.ArgumentParser(description="Initialize Enhanced RAG")
    parser.add_argument("--config", help="Path to configuration file")
    parser.add_argument("--test", action="store_true", help="Run a test query after initialization")
    args = parser.parse_args()
    
    # Initialize enhanced RAG
    enhanced_rag = await initialize_enhanced_rag(config_path=args.config)
    
    # Run test if requested
    if args.test and enhanced_rag:
        await test_enhanced_rag(enhanced_rag)

if __name__ == "__main__":
    asyncio.run(main())
