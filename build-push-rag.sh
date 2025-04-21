#!/bin/bash
# Build and push Docker images for the enhanced RAG system

# Set default values
DOCKER_REGISTRY=${DOCKER_REGISTRY:-"localhost:5000"}
TAG=${TAG:-"latest"}

# Export variables for docker-compose
export DOCKER_REGISTRY
export TAG
export OPENAI_API_KEY

# Build images
echo "Building Docker images..."
docker-compose -f docker-compose.rag.yml build

# Push images
echo "Pushing Docker images to $DOCKER_REGISTRY..."
docker-compose -f docker-compose.rag.yml push

echo "Build and push completed successfully!"
