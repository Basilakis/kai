#!/usr/bin/env python3
"""
Update MCP Server

This script updates the MCP server to use the enhanced RAG system.
It adds the necessary endpoints and initializes the enhanced RAG system.
"""

import argparse
import asyncio
import json
import logging
import os
import sys
from typing import Dict, Any, Optional

# Import enhanced RAG components
from enhanced_rag_config import get_config
from mcp_rag_bridge import create_mcp_rag_bridge
from setup_dependencies import setup_dependencies

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

async def update_mcp_server(config_path: Optional[str] = None):
    """
    Update the MCP server to use the enhanced RAG system.
    
    Args:
        config_path: Path to the configuration file (optional)
    """
    try:
        # Set up dependencies
        setup_dependencies(config_path=config_path)
        
        # Create MCP RAG bridge
        mcp_bridge = create_mcp_rag_bridge(config_path=config_path)
        
        # Initialize MCP RAG bridge
        await mcp_bridge.initialize()
        
        logger.info("MCP server updated to use enhanced RAG system")
        
        # Test the bridge
        test_query = "What are the best hardwood flooring options for high-traffic areas?"
        test_request = {
            "textQuery": test_query,
            "options": {"detail_level": "detailed"}
        }
        
        logger.info(f"Testing enhanced RAG with query: {test_query}")
        test_response = await mcp_bridge.handle_request("query", test_request)
        
        materials_count = len(test_response.get("materials", []))
        logger.info(f"Retrieved {materials_count} materials")
        
        if materials_count > 0:
            first_material = test_response.get("materials", [{}])[0]
            logger.info(f"First material: {first_material.get('name')}")
        
        logger.info("Enhanced RAG test completed successfully")
        
    except Exception as e:
        logger.error(f"Error updating MCP server: {str(e)}")
        sys.exit(1)

def main():
    """
    Main function for standalone execution.
    """
    parser = argparse.ArgumentParser(description="Update MCP Server")
    parser.add_argument("--config", help="Path to configuration file")
    args = parser.parse_args()
    
    # Update MCP server
    asyncio.run(update_mcp_server(config_path=args.config))

if __name__ == "__main__":
    main()
