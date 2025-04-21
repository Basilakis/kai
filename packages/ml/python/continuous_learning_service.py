#!/usr/bin/env python3
"""
Continuous Learning Service

This script runs the continuous learning pipeline as a service.
It periodically checks for fine-tuning triggers and runs fine-tuning when needed.
"""

import asyncio
import logging
import os
import signal
import sys
import time
from typing import Dict, Any, Optional

# Import enhanced RAG components
from enhanced_rag_config import get_config
from initialize_enhanced_rag import initialize_enhanced_rag
from setup_dependencies import setup_dependencies

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global flag for shutdown
shutdown_flag = False

def handle_shutdown(signum, frame):
    """
    Handle shutdown signals.
    """
    global shutdown_flag
    logger.info(f"Received signal {signum}, shutting down...")
    shutdown_flag = True

async def run_continuous_learning_service():
    """
    Run the continuous learning service.
    """
    try:
        # Set up dependencies
        config_path = os.environ.get("RAG_CONFIG_PATH")
        setup_dependencies(config_path=config_path)
        
        # Get configuration
        config = get_config(config_path=config_path)
        
        # Initialize enhanced RAG
        enhanced_rag = await initialize_enhanced_rag(config_path=config_path)
        
        # Get learning pipeline
        learning_pipeline = enhanced_rag.enhanced_rag.learning_pipeline
        
        if not learning_pipeline:
            logger.error("Learning pipeline not initialized")
            return
        
        # Get check interval
        check_interval = config.get("learning_pipeline_config", {}).get("check_interval_minutes", 60)
        check_interval_seconds = check_interval * 60
        
        logger.info(f"Continuous learning service started with check interval of {check_interval} minutes")
        
        # Main loop
        while not shutdown_flag:
            try:
                # Check for fine-tuning triggers
                should_fine_tune = await learning_pipeline.check_fine_tuning_triggers()
                
                if should_fine_tune:
                    logger.info("Fine-tuning triggers met, running fine-tuning")
                    
                    # Run fine-tuning
                    fine_tuning_result = await learning_pipeline.run_fine_tuning()
                    
                    if fine_tuning_result:
                        logger.info("Fine-tuning completed successfully")
                    else:
                        logger.error("Fine-tuning failed")
                else:
                    logger.info("Fine-tuning triggers not met, skipping fine-tuning")
                
                # Wait for next check
                logger.info(f"Waiting {check_interval} minutes for next check")
                
                # Check for shutdown every 10 seconds
                for _ in range(int(check_interval_seconds / 10)):
                    if shutdown_flag:
                        break
                    await asyncio.sleep(10)
                
            except Exception as e:
                logger.error(f"Error in continuous learning service: {str(e)}")
                await asyncio.sleep(60)  # Wait a minute before retrying
        
        logger.info("Continuous learning service shutting down")
        
    except Exception as e:
        logger.error(f"Error in continuous learning service: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    # Register signal handlers
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)
    
    # Run the service
    asyncio.run(run_continuous_learning_service())
