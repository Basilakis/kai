#!/usr/bin/env python3
"""
Test script for the enhanced RAG system.

This script demonstrates how to use the enhanced RAG system with various types of queries.
"""

import asyncio
import base64
import json
import os
import sys
from typing import Any, Dict, List, Optional, Union

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import enhanced RAG system
from enhanced_rag_system import create_enhanced_rag_system

# Mock dependencies for testing
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

# Test function
async def test_enhanced_rag():
    # Create mock dependencies
    base_retriever = MockRetriever()
    embedding_model = MockEmbeddingModel()
    vision_model = MockVisionModel()
    text_model = MockTextModel()
    llm_client = MockLLMClient()
    feedback_db = MockFeedbackDB()
    
    # Create configuration
    config = {
        "model_registry_config": {
            "registry_dir": "./test_registry",
            "models_dir": "./test_models"
        },
        "learning_pipeline_config": {
            "min_feedback_samples": 2,  # Low for testing
            "feedback_threshold": 0.7,
            "fine_tuning_interval_days": 1,  # Low for testing
            "test_size": 0.2,
            "ab_test_duration_days": 1,
            "models_to_compare": 2
        },
        "distributed_retrieval_config": {
            "cache_enabled": True,
            "cache_ttl_seconds": 60,  # Low for testing
            "batch_size": 10,
            "timeout_seconds": 5,
            "max_concurrent_requests": 3
        },
        "hierarchical_retriever_config": {
            "max_sub_queries": 2,
            "min_query_length": 10,
            "reranking_enabled": True,
            "combine_strategy": "weighted",
            "query_decomposition_model": "gpt-3.5-turbo"
        },
        "cross_modal_attention_config": {
            "visual_feature_dim": 512,
            "text_feature_dim": 768,
            "joint_feature_dim": 1024,
            "attention_heads": 8,
            "vision_model_name": "clip",
            "text_model_name": "bert"
        }
    }
    
    # Create enhanced RAG system
    rag_system = create_enhanced_rag_system(
        config=config,
        base_retriever=base_retriever,
        embedding_model=embedding_model,
        vision_model=vision_model,
        text_model=text_model,
        llm_client=llm_client,
        feedback_db=feedback_db
    )
    
    print("Enhanced RAG System created successfully!")
    
    # Test text query
    print("\n=== Testing Text Query ===")
    text_result = await rag_system.process_query(
        text_query="What are the best hardwood flooring options for high-traffic areas?",
        options={"detail_level": "detailed"}
    )
    print(f"Retrieved {len(text_result.get('materials', []))} materials")
    print(f"First material: {text_result.get('materials', [{}])[0].get('name')}")
    
    # Test image query (using a dummy base64 image)
    print("\n=== Testing Image Query ===")
    dummy_image = base64.b64encode(b"dummy image data").decode("utf-8")
    image_result = await rag_system.process_query(
        image_data=dummy_image,
        options={"detail_level": "medium"}
    )
    print(f"Generated query: {image_result.get('cross_modal', {}).get('generated_query')}")
    print(f"Retrieved {len(image_result.get('materials', []))} materials")
    
    # Test multi-modal query
    print("\n=== Testing Multi-Modal Query ===")
    multi_modal_result = await rag_system.process_query(
        text_query="What type of wood is this and how durable is it?",
        image_data=dummy_image,
        options={"detail_level": "detailed"}
    )
    print(f"Enhanced query: {multi_modal_result.get('cross_modal', {}).get('enhanced_query')}")
    print(f"Retrieved {len(multi_modal_result.get('materials', []))} materials")
    
    # Test feedback submission
    print("\n=== Testing Feedback Submission ===")
    feedback_result = await rag_system.submit_feedback(
        query="What are the best hardwood flooring options for high-traffic areas?",
        response=text_result,
        feedback={
            "rating": 4,
            "feedback_text": "Good information but could include more about maintenance requirements."
        }
    )
    print(f"Feedback submitted: {feedback_result}")
    
    # Test system stats
    print("\n=== Testing System Stats ===")
    stats = await rag_system.get_system_stats()
    print(f"Components: {stats.get('components')}")
    
    print("\nAll tests completed successfully!")

# Run the test
if __name__ == "__main__":
    asyncio.run(test_enhanced_rag())
