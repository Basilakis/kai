#!/usr/bin/env python3
"""
RAG System Usage Example

This script demonstrates how to use the Material RAG system with different configuration options.
It provides practical examples of querying, customization, and analyzing the results.
"""

import asyncio
import json
import sys
import os

# Add the parent directory to the Python path to access the modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import RAG components
from material_rag_service import create_material_rag_service


async def basic_rag_query():
    """
    Basic RAG query example with default configuration.
    """
    print("\n=== Basic RAG Query Example ===\n")
    
    # Create a RAG service with default configuration
    rag_service = create_material_rag_service()
    
    # Define a simple query about materials
    query = "What are the best hardwood options for kitchen flooring?"
    
    # Execute the query
    print(f"Query: {query}")
    print("Executing query with default configuration...")
    
    response = await rag_service.query(query_text=query)
    
    # Print the results
    print("\nResults:")
    print(f"Found {len(response['materials'])} materials:")
    
    for i, material in enumerate(response['materials']):
        print(f"  {i+1}. {material['name']} (Score: {material.get('similarity_score', 0):.2f})")
    
    # Print generated explanations if available
    if 'enhancements' in response and 'explanations' in response['enhancements']:
        print("\nExplanations:")
        for explanation in response['enhancements']['explanations']:
            print(f"  • {explanation['material_name']}: {explanation['explanation'][:100]}...")


async def customized_rag_query():
    """
    Customized RAG query example with specific configuration.
    """
    print("\n=== Customized RAG Query Example ===\n")
    
    # Create a RAG service with custom configuration
    custom_config = {
        "retrieval": {
            "max_results": 3,
            "strategy": "hybrid",
            "threshold": 0.6,
            "dense_weight": 0.8,
            "sparse_weight": 0.2
        },
        "generation": {
            "temperature": 0.5,
            "enhancement_types": ["explanation", "application"],
            "detail_level": "brief"
        }
    }
    
    rag_service = create_material_rag_service(config=custom_config)
    
    # Define a query with filters
    query = "What sustainable materials work well for bathroom walls?"
    filters = {"sustainable": True, "water_resistant": True}
    
    # Execute the query with filters
    print(f"Query: {query}")
    print(f"Filters: {filters}")
    print("Executing query with custom configuration...")
    
    response = await rag_service.query(
        query_text=query,
        filters=filters
    )
    
    # Print the results
    print("\nResults:")
    print(f"Found {len(response['materials'])} materials:")
    
    for i, material in enumerate(response['materials']):
        print(f"  {i+1}. {material['name']} (Score: {material.get('similarity_score', 0):.2f})")
    
    # Print application recommendations if available
    if 'enhancements' in response and 'applications' in response['enhancements']:
        print("\nApplication Recommendations:")
        for application in response['enhancements']['applications']:
            if 'specific_recommendations' in application:
                print(f"  • {application['material_name']}:")
                for rec in application['specific_recommendations'][:2]:  # Show first 2 recommendations
                    print(f"    - {rec}")


async def streaming_rag_query():
    """
    Streaming RAG query example.
    """
    print("\n=== Streaming RAG Query Example ===\n")
    
    # Create a RAG service
    rag_service = create_material_rag_service()
    
    # Define a complex query that will generate a larger response
    query = "Compare different types of stone and wood flooring for a high-traffic commercial space"
    
    print(f"Query: {query}")
    print("Executing streaming query...")
    
    # Define a callback for streaming chunks
    def print_chunk(chunk):
        # In a real application, you would process these chunks for progressive UI updates
        print(".", end="", flush=True)
    
    # Execute streaming query
    async for chunk in rag_service.streaming_query(
        query_text=query,
        stream_handler=print_chunk
    ):
        # In a real app, you would process each chunk as it arrives
        # Here we're just counting chunks
        pass
    
    print("\nStreaming complete!")


async def batch_rag_query():
    """
    Batch RAG query example.
    """
    print("\n=== Batch RAG Query Example ===\n")
    
    # Create a RAG service
    rag_service = create_material_rag_service()
    
    # Define multiple queries
    queries = [
        {
            "query": "What are heat-resistant materials for kitchen countertops?",
            "filters": {"heat_resistant": True}
        },
        {
            "query": "Which flooring materials are best for homes with pets?",
            "filters": {"scratch_resistant": True, "water_resistant": True}
        },
        {
            "query": "What are eco-friendly insulation options?",
            "filters": {"eco_friendly": True, "application": "insulation"}
        }
    ]
    
    print(f"Processing {len(queries)} queries in batch...")
    
    # Execute batch query
    responses = await rag_service.batch_query(
        queries=queries,
        max_concurrent=2
    )
    
    # Print basic results
    print("\nBatch Results:")
    for i, response in enumerate(responses):
        query_text = queries[i]["query"]
        material_count = len(response.get("materials", []))
        print(f"  • Query: {query_text}")
        print(f"    Found {material_count} materials")
        print(f"    Processing time: {response.get('metadata', {}).get('processing_time', 0):.2f}s")
        print()


async def main():
    """
    Main function to run all examples.
    """
    print("=== Material RAG System Examples ===")
    
    try:
        # Run basic example
        await basic_rag_query()
        
        # Run customized example
        await customized_rag_query()
        
        # Run streaming example
        await streaming_rag_query()
        
        # Run batch example
        await batch_rag_query()
        
        print("\nAll examples completed successfully!")
        
    except Exception as e:
        print(f"\nError running examples: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())