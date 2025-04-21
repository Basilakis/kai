#!/usr/bin/env python3
"""
MCP RAG Bridge

This module provides a bridge between the MCP server and the enhanced RAG system.
It handles requests from the MCP server and forwards them to the enhanced RAG system.
"""

import asyncio
import json
import logging
import os
import sys
from typing import Any, Dict, List, Optional, Union

# Import enhanced RAG components
from enhanced_rag_config import get_config
from initialize_enhanced_rag import initialize_enhanced_rag

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

class MCPRAGBridge:
    """
    Bridge between the MCP server and the enhanced RAG system.
    """
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize the MCP RAG bridge.
        
        Args:
            config_path: Path to the configuration file (optional)
        """
        self.config_path = config_path
        self.enhanced_rag = None
        self.initialized = False
    
    async def initialize(self, existing_components: Optional[Dict[str, Any]] = None):
        """
        Initialize the enhanced RAG system.
        
        Args:
            existing_components: Existing components to use (optional)
            
        Returns:
            True if initialization was successful, False otherwise
        """
        try:
            # Initialize enhanced RAG
            self.enhanced_rag = await initialize_enhanced_rag(
                config_path=self.config_path,
                existing_components=existing_components
            )
            
            self.initialized = True
            logger.info("MCP RAG bridge initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error initializing MCP RAG bridge: {str(e)}")
            self.initialized = False
            return False
    
    async def handle_query(
        self,
        request: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Handle a query request from the MCP server.
        
        Args:
            request: Request from the MCP server
            
        Returns:
            Response to the MCP server
        """
        try:
            # Check if initialized
            if not self.initialized or not self.enhanced_rag:
                return {
                    "error": "MCP RAG bridge not initialized",
                    "status": "error"
                }
            
            # Extract request parameters
            text_query = request.get("textQuery")
            image_data = request.get("imageData")
            options = request.get("options", {})
            
            # Process query
            result = await self.enhanced_rag.process_query(
                text_query=text_query,
                image_data=image_data,
                options=options
            )
            
            # Add status to result
            result["status"] = "success"
            
            return result
            
        except Exception as e:
            logger.error(f"Error handling query: {str(e)}")
            return {
                "error": str(e),
                "status": "error"
            }
    
    async def handle_feedback(
        self,
        request: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Handle a feedback request from the MCP server.
        
        Args:
            request: Request from the MCP server
            
        Returns:
            Response to the MCP server
        """
        try:
            # Check if initialized
            if not self.initialized or not self.enhanced_rag:
                return {
                    "error": "MCP RAG bridge not initialized",
                    "status": "error"
                }
            
            # Extract request parameters
            query = request.get("query")
            response = request.get("response")
            feedback = request.get("feedback")
            
            # Submit feedback
            result = await self.enhanced_rag.submit_feedback(
                query=query,
                response=response,
                feedback=feedback
            )
            
            return {
                "success": result,
                "status": "success" if result else "error"
            }
            
        except Exception as e:
            logger.error(f"Error handling feedback: {str(e)}")
            return {
                "error": str(e),
                "status": "error"
            }
    
    async def handle_stats(
        self,
        request: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Handle a stats request from the MCP server.
        
        Args:
            request: Request from the MCP server
            
        Returns:
            Response to the MCP server
        """
        try:
            # Check if initialized
            if not self.initialized or not self.enhanced_rag:
                return {
                    "error": "MCP RAG bridge not initialized",
                    "status": "error"
                }
            
            # Get system stats
            stats = await self.enhanced_rag.get_system_stats()
            
            # Add status to stats
            stats["status"] = "success"
            
            return stats
            
        except Exception as e:
            logger.error(f"Error handling stats request: {str(e)}")
            return {
                "error": str(e),
                "status": "error"
            }
    
    async def handle_request(
        self,
        request_type: str,
        request: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Handle a request from the MCP server.
        
        Args:
            request_type: Type of request
            request: Request from the MCP server
            
        Returns:
            Response to the MCP server
        """
        if request_type == "query":
            return await self.handle_query(request)
        elif request_type == "feedback":
            return await self.handle_feedback(request)
        elif request_type == "stats":
            return await self.handle_stats(request)
        else:
            return {
                "error": f"Unknown request type: {request_type}",
                "status": "error"
            }


# Factory function to create the MCP RAG bridge
def create_mcp_rag_bridge(config_path: Optional[str] = None) -> MCPRAGBridge:
    """
    Create an MCPRAGBridge with specified configuration.
    
    Args:
        config_path: Path to the configuration file (optional)
        
    Returns:
        Configured MCPRAGBridge
    """
    return MCPRAGBridge(config_path=config_path)
