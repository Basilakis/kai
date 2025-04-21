#!/usr/bin/env python3
"""
Enhanced RAG System

This module integrates all the enhancements to the RAG system:
1. Material-specific models and prompts
2. Continuous learning pipeline
3. Advanced retrieval techniques
4. Enhanced integration with visual recognition
5. Performance optimization

It provides a unified interface for the enhanced RAG system.
"""

import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple, Union

# Import enhanced components
from continuous_learning_pipeline import create_continuous_learning_pipeline
from cross_modal_attention import create_cross_modal_attention
from distributed_retrieval import create_distributed_retrieval
from hierarchical_retriever import create_hierarchical_retriever
from material_specific_prompts import get_material_system_prompt
from model_registry import create_model_registry

# Set up logging
logger = logging.getLogger(__name__)

class EnhancedRAGSystem:
    """
    Enhanced RAG system that integrates all improvements.
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
        Initialize the enhanced RAG system.
        
        Args:
            config: Configuration for the system
            base_retriever: Base retriever for executing queries
            embedding_model: Embedding model for text embedding
            vision_model: Vision model for image processing
            text_model: Text model for text processing
            llm_client: LLM client for generation tasks
            feedback_db: Database client for feedback data
            vector_stores: List of vector store clients
        """
        self.config = config
        self.base_retriever = base_retriever
        self.embedding_model = embedding_model
        self.vision_model = vision_model
        self.text_model = text_model
        self.llm_client = llm_client
        self.feedback_db = feedback_db
        self.vector_stores = vector_stores or []
        
        # Initialize components
        self._initialize_components()
    
    def _initialize_components(self):
        """
        Initialize all enhanced components.
        """
        # Create model registry
        self.model_registry = create_model_registry(
            config=self.config.get("model_registry_config", {}),
            db_client=self.feedback_db
        )
        
        # Create continuous learning pipeline
        self.learning_pipeline = create_continuous_learning_pipeline(
            config=self.config.get("learning_pipeline_config", {}),
            feedback_db=self.feedback_db,
            model_registry=self.model_registry,
            embedding_model=self.embedding_model,
            llm_client=self.llm_client
        )
        
        # Create distributed retrieval
        self.distributed_retrieval = create_distributed_retrieval(
            config=self.config.get("distributed_retrieval_config", {}),
            vector_stores=self.vector_stores
        )
        
        # Create hierarchical retriever
        self.hierarchical_retriever = create_hierarchical_retriever(
            config=self.config.get("hierarchical_retriever_config", {}),
            base_retriever=self.distributed_retrieval or self.base_retriever,
            llm_client=self.llm_client
        )
        
        # Create cross-modal attention
        self.cross_modal_attention = create_cross_modal_attention(
            config=self.config.get("cross_modal_attention_config", {}),
            vision_model=self.vision_model,
            text_model=self.text_model,
            llm_client=self.llm_client
        )
        
        logger.info("Initialized enhanced RAG system components")
    
    async def process_query(
        self,
        text_query: Optional[str] = None,
        image_data: Optional[Union[str, bytes]] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process a query with the enhanced RAG system.
        
        Args:
            text_query: Text query
            image_data: Image data
            options: Additional options
            
        Returns:
            RAG response
        """
        options = options or {}
        
        try:
            # Check if we have a query
            has_text = text_query is not None and len(text_query.strip()) > 0
            has_image = image_data is not None
            
            if not has_text and not has_image:
                return {"error": "No text query or image provided"}
            
            # Process multi-modal query if both text and image are provided
            if has_text and has_image:
                return await self._process_multi_modal_query(text_query, image_data, options)
            elif has_text:
                return await self._process_text_query(text_query, options)
            else:
                return await self._process_image_query(image_data, options)
                
        except Exception as e:
            logger.error(f"Error processing query: {str(e)}")
            return {"error": str(e)}
    
    async def _process_multi_modal_query(
        self,
        text_query: str,
        image_data: Union[str, bytes],
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process a multi-modal query with both text and image.
        
        Args:
            text_query: Text query
            image_data: Image data
            options: Additional options
            
        Returns:
            RAG response
        """
        # Apply cross-modal attention
        cross_modal_result = await self.cross_modal_attention.process_multi_modal_query(
            text_query=text_query,
            image_data=image_data,
            options=options
        )
        
        # Get enhanced query
        enhanced_query = cross_modal_result.get("enhanced_query", text_query)
        
        # Add visual context to options
        options["visual_context"] = cross_modal_result.get("visual_context", {})
        
        # Retrieve materials using hierarchical retriever
        retrieval_result = await self.hierarchical_retriever.retrieve(
            query=enhanced_query,
            options=options
        )
        
        # Add cross-modal information to result
        retrieval_result["cross_modal"] = {
            "original_query": text_query,
            "enhanced_query": enhanced_query,
            "visual_context": cross_modal_result.get("visual_context", {})
        }
        
        return retrieval_result
    
    async def _process_text_query(
        self,
        text_query: str,
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process a text-only query.
        
        Args:
            text_query: Text query
            options: Additional options
            
        Returns:
            RAG response
        """
        # Retrieve materials using hierarchical retriever
        retrieval_result = await self.hierarchical_retriever.retrieve(
            query=text_query,
            options=options
        )
        
        return retrieval_result
    
    async def _process_image_query(
        self,
        image_data: Union[str, bytes],
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process an image-only query.
        
        Args:
            image_data: Image data
            options: Additional options
            
        Returns:
            RAG response
        """
        # Generate text query from image
        cross_modal_result = await self.cross_modal_attention.process_multi_modal_query(
            text_query=None,
            image_data=image_data,
            options=options
        )
        
        # Get generated query
        generated_query = cross_modal_result.get("generated_text_query", "What materials are in this image?")
        
        # Add visual context to options
        options["visual_context"] = cross_modal_result.get("visual_context", {})
        
        # Retrieve materials using hierarchical retriever
        retrieval_result = await self.hierarchical_retriever.retrieve(
            query=generated_query,
            options=options
        )
        
        # Add cross-modal information to result
        retrieval_result["cross_modal"] = {
            "generated_query": generated_query,
            "visual_context": cross_modal_result.get("visual_context", {})
        }
        
        return retrieval_result
    
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
        if not self.feedback_db:
            logger.warning("No feedback database available")
            return False
        
        try:
            # Format feedback data
            feedback_data = {
                "query": query,
                "response": response,
                "feedback": feedback,
                "timestamp": feedback.get("timestamp") or self._get_current_timestamp()
            }
            
            # Submit feedback
            result = await self.feedback_db.submit_feedback(feedback_data)
            
            # Check if fine-tuning should be triggered
            if result and self.learning_pipeline:
                should_fine_tune = await self.learning_pipeline.check_fine_tuning_triggers()
                
                if should_fine_tune:
                    logger.info("Triggering fine-tuning based on feedback")
                    # Start fine-tuning in the background
                    asyncio.create_task(self.learning_pipeline.run_fine_tuning())
            
            return result
            
        except Exception as e:
            logger.error(f"Error submitting feedback: {str(e)}")
            return False
    
    def _get_current_timestamp(self) -> str:
        """
        Get the current timestamp in ISO format.
        
        Returns:
            Current timestamp
        """
        from datetime import datetime
        return datetime.now().isoformat()
    
    async def get_system_stats(self) -> Dict[str, Any]:
        """
        Get statistics for the enhanced RAG system.
        
        Returns:
            System statistics
        """
        stats = {
            "components": {
                "model_registry": bool(self.model_registry),
                "learning_pipeline": bool(self.learning_pipeline),
                "distributed_retrieval": bool(self.distributed_retrieval),
                "hierarchical_retriever": bool(self.hierarchical_retriever),
                "cross_modal_attention": bool(self.cross_modal_attention)
            }
        }
        
        # Add distributed retrieval stats
        if self.distributed_retrieval:
            stats["distributed_retrieval"] = await self.distributed_retrieval.get_stats()
        
        # Add model registry stats
        if self.model_registry:
            stats["models"] = {
                "embedding": await self.model_registry.get_default_model("embedding"),
                "generative": await self.model_registry.get_default_model("generative")
            }
        
        return stats


# Factory function to create an enhanced RAG system
def create_enhanced_rag_system(
    config: Dict[str, Any],
    base_retriever=None,
    embedding_model=None,
    vision_model=None,
    text_model=None,
    llm_client=None,
    feedback_db=None,
    vector_stores=None
) -> EnhancedRAGSystem:
    """
    Create an EnhancedRAGSystem with specified configuration and dependencies.
    
    Args:
        config: Configuration for the system
        base_retriever: Base retriever for executing queries
        embedding_model: Embedding model for text embedding
        vision_model: Vision model for image processing
        text_model: Text model for text processing
        llm_client: LLM client for generation tasks
        feedback_db: Database client for feedback data
        vector_stores: List of vector store clients
        
    Returns:
        Configured EnhancedRAGSystem
    """
    return EnhancedRAGSystem(
        config=config,
        base_retriever=base_retriever,
        embedding_model=embedding_model,
        vision_model=vision_model,
        text_model=text_model,
        llm_client=llm_client,
        feedback_db=feedback_db,
        vector_stores=vector_stores
    )
