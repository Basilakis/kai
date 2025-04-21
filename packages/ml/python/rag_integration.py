#!/usr/bin/env python3
"""
RAG Integration

This module integrates the enhanced RAG system with the existing RAG system.
It provides a bridge between the two systems and handles the transition.
"""

import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple, Union

# Import enhanced components
from enhanced_rag_system import create_enhanced_rag_system
from material_specific_prompts import get_material_system_prompt

# Set up logging
logger = logging.getLogger(__name__)

class EnhancedRAGIntegration:
    """
    Integration class that connects the enhanced RAG system with the existing RAG system.
    """
    
    def __init__(
        self,
        config: Dict[str, Any],
        base_retriever=None,
        embedding_model=None,
        vision_model=None,
        text_model=None,
        llm_client=None,
        feedback_db=None,
        vector_stores=None
    ):
        """
        Initialize the integration.
        
        Args:
            config: Configuration for the enhanced RAG system
            base_retriever: Base retriever from existing system
            embedding_model: Embedding model from existing system
            vision_model: Vision model from existing system
            text_model: Text model from existing system
            llm_client: LLM client from existing system
            feedback_db: Feedback database from existing system
            vector_stores: Vector stores from existing system
        """
        self.config = config
        self.base_retriever = base_retriever
        self.embedding_model = embedding_model
        self.vision_model = vision_model
        self.text_model = text_model
        self.llm_client = llm_client
        self.feedback_db = feedback_db
        self.vector_stores = vector_stores or []
        
        # Initialize enhanced RAG system
        self._initialize_enhanced_rag()
    
    def _initialize_enhanced_rag(self):
        """
        Initialize the enhanced RAG system.
        """
        try:
            # Create enhanced RAG system
            self.enhanced_rag = create_enhanced_rag_system(
                config=self.config,
                base_retriever=self.base_retriever,
                embedding_model=self.embedding_model,
                vision_model=self.vision_model,
                text_model=self.text_model,
                llm_client=self.llm_client,
                feedback_db=self.feedback_db,
                vector_stores=self.vector_stores
            )
            
            logger.info("Enhanced RAG system initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing enhanced RAG system: {str(e)}")
            self.enhanced_rag = None
    
    async def process_query(
        self,
        text_query: Optional[str] = None,
        image_data: Optional[Union[str, bytes]] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process a query using the enhanced RAG system.
        
        Args:
            text_query: Text query
            image_data: Image data
            options: Additional options
            
        Returns:
            RAG response
        """
        options = options or {}
        
        try:
            if self.enhanced_rag:
                # Process query with enhanced RAG system
                result = await self.enhanced_rag.process_query(
                    text_query=text_query,
                    image_data=image_data,
                    options=options
                )
                
                return result
            else:
                # Fallback to base retriever if enhanced RAG is not available
                if self.base_retriever:
                    logger.info("Enhanced RAG not available, falling back to base retriever")
                    return await self.base_retriever.retrieve(text_query, options)
                else:
                    return {"error": "Enhanced RAG system not initialized and no fallback available"}
            
        except Exception as e:
            logger.error(f"Error processing query: {str(e)}")
            return {"error": str(e)}
    
    async def submit_feedback(
        self,
        query: str,
        response: Dict[str, Any],
        feedback: Dict[str, Any]
    ) -> bool:
        """
        Submit feedback for a RAG response.
        
        Args:
            query: Original query
            response: RAG response
            feedback: User feedback
            
        Returns:
            True if feedback was submitted successfully, False otherwise
        """
        try:
            if self.enhanced_rag:
                # Submit feedback to enhanced RAG system
                result = await self.enhanced_rag.submit_feedback(
                    query=query,
                    response=response,
                    feedback=feedback
                )
                
                return result
            else:
                logger.warning("Enhanced RAG not available for feedback submission")
                return False
            
        except Exception as e:
            logger.error(f"Error submitting feedback: {str(e)}")
            return False
    
    async def get_system_stats(self) -> Dict[str, Any]:
        """
        Get statistics for the enhanced RAG system.
        
        Returns:
            System statistics
        """
        try:
            if self.enhanced_rag:
                # Get stats from enhanced RAG system
                return await self.enhanced_rag.get_system_stats()
            else:
                return {"status": "Enhanced RAG system not initialized"}
            
        except Exception as e:
            logger.error(f"Error getting system stats: {str(e)}")
            return {"error": str(e)}


# Factory function to create the integration
def create_enhanced_rag_integration(
    config: Dict[str, Any],
    base_retriever=None,
    embedding_model=None,
    vision_model=None,
    text_model=None,
    llm_client=None,
    feedback_db=None,
    vector_stores=None
) -> EnhancedRAGIntegration:
    """
    Create an EnhancedRAGIntegration with specified configuration and components.
    
    Args:
        config: Configuration for the enhanced RAG system
        base_retriever: Base retriever from existing system
        embedding_model: Embedding model from existing system
        vision_model: Vision model from existing system
        text_model: Text model from existing system
        llm_client: LLM client from existing system
        feedback_db: Feedback database from existing system
        vector_stores: Vector stores from existing system
        
    Returns:
        Configured EnhancedRAGIntegration
    """
    return EnhancedRAGIntegration(
        config=config,
        base_retriever=base_retriever,
        embedding_model=embedding_model,
        vision_model=vision_model,
        text_model=text_model,
        llm_client=llm_client,
        feedback_db=feedback_db,
        vector_stores=vector_stores
    )
