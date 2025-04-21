#!/usr/bin/env python3
"""
MCP Bridge Client

This script provides a client for the MCP RAG bridge.
It handles requests from the MCP server and forwards them to the MCP RAG bridge.
"""

import asyncio
import json
import logging
import os
import sys
from typing import Dict, Any

# Import enhanced RAG components
from mcp_rag_bridge import create_mcp_rag_bridge

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

async def handle_request(request_json: str) -> Dict[str, Any]:
    """
    Handle a request from the MCP server.
    
    Args:
        request_json: JSON string with request data
        
    Returns:
        Response data
    """
    try:
        # Parse request
        request = json.loads(request_json)
        
        # Get request type and data
        request_type = request.get("requestType")
        data = request.get("data", {})
        
        # Get configuration path
        config_path = os.environ.get("RAG_CONFIG_PATH")
        
        # Create MCP RAG bridge
        mcp_bridge = create_mcp_rag_bridge(config_path=config_path)
        
        # Initialize MCP RAG bridge
        await mcp_bridge.initialize()
        
        # Handle request
        response = await mcp_bridge.handle_request(request_type, data)
        
        return response
        
    except Exception as e:
        logger.error(f"Error handling request: {str(e)}")
        return {
            "error": str(e),
            "status": "error"
        }

async def main():
    """
    Main function for standalone execution.
    """
    # Check if request JSON is provided
    if len(sys.argv) < 2:
        logger.error("No request JSON provided")
        sys.exit(1)
    
    # Get request JSON
    request_json = sys.argv[1]
    
    # Handle request
    response = await handle_request(request_json)
    
    # Print response as JSON
    print(json.dumps(response))

if __name__ == "__main__":
    asyncio.run(main())
