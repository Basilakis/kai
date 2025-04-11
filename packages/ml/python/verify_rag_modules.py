#!/usr/bin/env python3
"""
RAG Modules Verification Script

This script verifies that all the required RAG modules are installed and accessible.
It's used by the RAG Bridge handler to check the system's readiness before executing queries.
"""

import argparse
import json
import logging
import sys
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("verify_rag_modules")

def verify_modules():
    """
    Verify that all required RAG modules are available.
    
    Returns:
        Tuple of (success, message)
    """
    missing_modules = []
    
    # Try to import each module
    modules_to_check = [
        "enhanced_text_embeddings",
        "hybrid_retriever", 
        "context_assembler",
        "generative_enhancer",
        "material_rag_service"
    ]
    
    for module_name in modules_to_check:
        try:
            __import__(module_name)
            logger.info(f"✓ Module {module_name} is available")
        except ImportError:
            missing_modules.append(module_name)
            logger.error(f"✗ Module {module_name} is missing")
    
    # Check for key classes/functions in each module
    if not missing_modules:
        try:
            # Import key classes
            from enhanced_text_embeddings import TextEmbeddingGenerator
            from hybrid_retriever import HybridRetriever
            from context_assembler import ContextAssembler
            from generative_enhancer import GenerativeEnhancer
            from material_rag_service import MaterialRAGService, create_material_rag_service
            
            logger.info("✓ All required classes are available")
            
            # Try to initialize the RAG service
            logger.info("Attempting to initialize RAG service...")
            rag_service = create_material_rag_service()
            logger.info("✓ RAG service initialization successful")
            
            return True, "All RAG modules verified successfully"
        except ImportError as e:
            logger.error(f"Error importing classes: {e}")
            return False, f"Error importing classes: {e}"
        except Exception as e:
            logger.error(f"Error initializing RAG service: {e}")
            return False, f"Error initializing RAG service: {e}"
    else:
        missing_list = ", ".join(missing_modules)
        return False, f"Missing modules: {missing_list}"

def main():
    """
    Main entry point.
    """
    parser = argparse.ArgumentParser(description="Verify RAG Modules")
    parser.add_argument("--config", help="Configuration JSON (optional)")
    parser.add_argument("--json", action="store_true", help="Output in JSON format")
    
    args = parser.parse_args()
    
    logger.info("Verifying RAG modules...")
    success, message = verify_modules()
    
    if args.json:
        result = {
            "success": success,
            "message": message,
            "timestamp": time.time()
        }
        print(json.dumps(result))
    else:
        if success:
            print(f"SUCCESS: {message}")
        else:
            print(f"ERROR: {message}")
            sys.exit(1)

if __name__ == "__main__":
    main()