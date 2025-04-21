#!/usr/bin/env python3
"""
Test Integration

This script tests the integration of the enhanced RAG system with the existing system.
It simulates the existing components and tests the enhanced RAG system.
"""

import argparse
import asyncio
import base64
import json
import logging
import os
import sys
from typing import Any, Dict, List, Optional, Union

# Import enhanced RAG components
from enhanced_rag_config import get_config
from initialize_enhanced_rag import initialize_enhanced_rag
from mcp_rag_bridge import create_mcp_rag_bridge
from setup_dependencies import setup_dependencies

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Mock components for testing
class MockRetriever:
    async def retrieve(self, query, options=None):
        return {
            "materials": [
                {
                    "id": "m1",
                    "name": "Red Oak Hardwood",
                    "material_type": "wood",
                    "description": "Natural hardwood flooring with medium grain pattern",
                    "properties": {
                        "Janka Hardness": "1290",
                        "Color": "Reddish brown",
                        "Grain": "Prominent, straight grain"
                    },
                    "score": 0.95
                },
                {
                    "id": "m2",
                    "name": "White Oak Hardwood",
                    "material_type": "wood",
                    "description": "Durable hardwood with distinctive grain pattern",
                    "properties": {
                        "Janka Hardness": "1360",
                        "Color": "Light brown to tan",
                        "Grain": "Tight, straight grain with longer rays than Red Oak"
                    },
                    "score": 0.92
                },
                {
                    "id": "m3",
                    "name": "Hickory Hardwood",
                    "material_type": "wood",
                    "description": "Very hard and durable wood with dramatic grain patterns",
                    "properties": {
                        "Janka Hardness": "1820",
                        "Color": "Light to medium brown with contrasting streaks",
                        "Grain": "Dramatic, variable grain pattern"
                    },
                    "score": 0.88
                }
            ],
            "metadata": {
                "query": query,
                "options": options
            }
        }

class MockEmbeddingModel:
    async def extract_features(self, text):
        import numpy as np
        return np.random.rand(768)
    
    async def fine_tune(self, train_data, val_data, output_path, epochs, batch_size, learning_rate):
        return True

class MockVisionModel:
    async def extract_features(self, image_bytes):
        import numpy as np
        return np.random.rand(512)
    
    async def detect_materials(self, image_bytes):
        return [
            {"name": "Oak", "confidence": 0.92},
            {"name": "Walnut", "confidence": 0.45}
        ]
    
    async def analyze_colors(self, image_bytes):
        return [
            {"name": "Brown", "hex": "#8B4513", "percentage": 0.65},
            {"name": "Tan", "hex": "#D2B48C", "percentage": 0.25}
        ]
    
    async def analyze_textures(self, image_bytes):
        return [
            {"name": "Wood grain", "confidence": 0.95},
            {"name": "Smooth", "confidence": 0.75}
        ]

class MockTextModel:
    async def extract_features(self, text):
        import numpy as np
        return np.random.rand(768)

class MockLLMClient:
    class ChatCompletions:
        async def create(self, model, messages, temperature=0.7, max_tokens=None, stream=False):
            class Response:
                class Choice:
                    class Message:
                        def __init__(self, content):
                            self.content = content
                    
                    def __init__(self, content):
                        self.message = self.Message(content)
                        self.delta = self.Message(content)
                
                def __init__(self, content):
                    self.choices = [self.Choice(content)]
            
            # Generate a response based on the messages
            if "system" in messages[0]["role"]:
                system = messages[0]["content"]
                user = messages[1]["content"] if len(messages) > 1 else ""
            else:
                system = ""
                user = messages[0]["content"]
            
            # Check for image content
            has_image = False
            if isinstance(user, list):
                for item in user:
                    if item.get("type") == "image_url":
                        has_image = True
            
            # Generate different responses based on the query
            if "wood" in user.lower() or "hardwood" in user.lower():
                response = "Oak is a popular hardwood flooring option known for its durability and classic grain pattern. It has a Janka hardness rating of 1290-1360, making it suitable for high-traffic areas. White Oak is more resistant to moisture than Red Oak, making it a better choice for kitchens and bathrooms."
            elif "tile" in user.lower() or "ceramic" in user.lower():
                response = "Ceramic tile is a durable flooring option made from clay that is fired in a kiln. It is available in a wide range of colors, patterns, and sizes. Porcelain tile is a type of ceramic tile that is denser and less porous, making it more durable and water-resistant."
            elif has_image:
                response = "The image shows what appears to be a hardwood floor with a medium brown color and prominent grain pattern. This looks like oak hardwood flooring, possibly White Oak based on the grain pattern and color. The wood appears to have a satin or semi-gloss finish."
            elif "break down" in user.lower() and "query" in user.lower():
                response = json.dumps([
                    {
                        "query": "What are the best hardwood options for durability?",
                        "weight": 0.6,
                        "aspect": "Durability"
                    },
                    {
                        "query": "What hardwoods work well in high-traffic areas?",
                        "weight": 0.4,
                        "aspect": "Application"
                    }
                ])
            else:
                response = "I'm not sure about that specific material. Could you provide more details or ask about a different type of material?"
            
            return Response(response)
    
    def __init__(self):
        self.chat = self.ChatCompletions()
    
    async def fine_tune(self, training_file, validation_file, model, suffix, hyperparameters):
        return {"fine_tuned_model": f"{model}-ft-{suffix}"}

class MockFeedbackDB:
    def __init__(self):
        self.feedback = []
    
    async def submit_feedback(self, feedback_data):
        self.feedback.append(feedback_data)
        return True
    
    async def get_feedback_count(self, since_date):
        return len(self.feedback)
    
    async def get_feedback_metrics(self, since_date):
        if not self.feedback:
            return {"average_rating": 0, "max_rating": 5}
        
        total_rating = sum(f.get("feedback", {}).get("rating", 0) for f in self.feedback)
        return {"average_rating": total_rating / len(self.feedback), "max_rating": 5}
    
    async def get_feedback_for_training(self, since_date):
        return self.feedback

async def test_direct_integration():
    """
    Test the direct integration of the enhanced RAG system.
    """
    logger.info("=== Testing Direct Integration ===")
    
    # Create mock components
    base_retriever = MockRetriever()
    embedding_model = MockEmbeddingModel()
    vision_model = MockVisionModel()
    text_model = MockTextModel()
    llm_client = MockLLMClient()
    feedback_db = MockFeedbackDB()
    
    # Create existing components dictionary
    existing_components = {
        "base_retriever": base_retriever,
        "embedding_model": embedding_model,
        "vision_model": vision_model,
        "text_model": text_model,
        "llm_client": llm_client,
        "feedback_db": feedback_db
    }
    
    # Initialize enhanced RAG
    enhanced_rag = await initialize_enhanced_rag(
        existing_components=existing_components
    )
    
    # Test text query
    logger.info("Testing text query...")
    text_result = await enhanced_rag.process_query(
        text_query="What are the best hardwood flooring options for high-traffic areas?",
        options={"detail_level": "detailed"}
    )
    logger.info(f"Retrieved {len(text_result.get('materials', []))} materials")
    
    # Test image query
    logger.info("Testing image query...")
    dummy_image = base64.b64encode(b"dummy image data").decode("utf-8")
    image_result = await enhanced_rag.process_query(
        image_data=dummy_image,
        options={"detail_level": "medium"}
    )
    logger.info(f"Generated query: {image_result.get('cross_modal', {}).get('generated_query')}")
    
    # Test multi-modal query
    logger.info("Testing multi-modal query...")
    multi_modal_result = await enhanced_rag.process_query(
        text_query="What type of wood is this and how durable is it?",
        image_data=dummy_image,
        options={"detail_level": "detailed"}
    )
    logger.info(f"Enhanced query: {multi_modal_result.get('cross_modal', {}).get('enhanced_query')}")
    
    # Test feedback submission
    logger.info("Testing feedback submission...")
    feedback_result = await enhanced_rag.submit_feedback(
        query="What are the best hardwood flooring options for high-traffic areas?",
        response=text_result,
        feedback={
            "rating": 4,
            "feedback_text": "Good information but could include more about maintenance requirements."
        }
    )
    logger.info(f"Feedback submitted: {feedback_result}")
    
    # Test system stats
    logger.info("Testing system stats...")
    stats = await enhanced_rag.get_system_stats()
    logger.info(f"Components: {stats.get('components')}")
    
    logger.info("Direct integration test completed successfully")

async def test_mcp_bridge():
    """
    Test the MCP bridge integration.
    """
    logger.info("=== Testing MCP Bridge Integration ===")
    
    # Create mock components
    base_retriever = MockRetriever()
    embedding_model = MockEmbeddingModel()
    vision_model = MockVisionModel()
    text_model = MockTextModel()
    llm_client = MockLLMClient()
    feedback_db = MockFeedbackDB()
    
    # Create existing components dictionary
    existing_components = {
        "base_retriever": base_retriever,
        "embedding_model": embedding_model,
        "vision_model": vision_model,
        "text_model": text_model,
        "llm_client": llm_client,
        "feedback_db": feedback_db
    }
    
    # Create MCP RAG bridge
    mcp_bridge = create_mcp_rag_bridge()
    
    # Initialize MCP RAG bridge
    await mcp_bridge.initialize(existing_components=existing_components)
    
    # Test query request
    logger.info("Testing query request...")
    query_request = {
        "textQuery": "What are the best hardwood flooring options for high-traffic areas?",
        "options": {"detail_level": "detailed"}
    }
    query_response = await mcp_bridge.handle_request("query", query_request)
    logger.info(f"Query response status: {query_response.get('status')}")
    
    # Test feedback request
    logger.info("Testing feedback request...")
    feedback_request = {
        "query": "What are the best hardwood flooring options for high-traffic areas?",
        "response": query_response,
        "feedback": {
            "rating": 4,
            "feedback_text": "Good information but could include more about maintenance requirements."
        }
    }
    feedback_response = await mcp_bridge.handle_request("feedback", feedback_request)
    logger.info(f"Feedback response status: {feedback_response.get('status')}")
    
    # Test stats request
    logger.info("Testing stats request...")
    stats_response = await mcp_bridge.handle_request("stats", {})
    logger.info(f"Stats response status: {stats_response.get('status')}")
    
    logger.info("MCP bridge integration test completed successfully")

async def main():
    """
    Main function for standalone execution.
    """
    parser = argparse.ArgumentParser(description="Test Integration")
    parser.add_argument("--config", help="Path to configuration file")
    parser.add_argument("--setup", action="store_true", help="Set up dependencies before testing")
    parser.add_argument("--test-direct", action="store_true", help="Test direct integration")
    parser.add_argument("--test-mcp", action="store_true", help="Test MCP bridge integration")
    args = parser.parse_args()
    
    # Set up dependencies if requested
    if args.setup:
        setup_dependencies(config_path=args.config)
    
    # Test direct integration if requested
    if args.test_direct:
        await test_direct_integration()
    
    # Test MCP bridge integration if requested
    if args.test_mcp:
        await test_mcp_bridge()
    
    # If no specific test is requested, run all tests
    if not args.test_direct and not args.test_mcp:
        await test_direct_integration()
        await test_mcp_bridge()

if __name__ == "__main__":
    asyncio.run(main())
