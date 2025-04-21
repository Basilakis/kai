#!/bin/bash
# Enhanced RAG system deployment pipeline

# Set default values
DOCKER_REGISTRY=${DOCKER_REGISTRY:-"localhost:5000"}
TAG=${TAG:-"latest"}
MONITOR_DURATION=${MONITOR_DURATION:-"5m"}

# Export variables
export DOCKER_REGISTRY
export TAG
export DURATION=$MONITOR_DURATION

# Make scripts executable
echo "Making scripts executable..."
chmod +x build-push-rag.sh deploy-rag.sh verify-rag-deployment.sh monitor-rag-performance.sh monitor-rag-api.sh

# Step 1: Build and push Docker images
echo "Step 1: Building and pushing Docker images..."
./build-push-rag.sh
if [ $? -ne 0 ]; then
  echo "Error: Failed to build and push Docker images"
  exit 1
fi
echo "Step 1 completed successfully!"

# Step 2: Deploy to Kubernetes
echo "Step 2: Deploying to Kubernetes..."
./deploy-rag.sh
if [ $? -ne 0 ]; then
  echo "Error: Failed to deploy to Kubernetes"
  exit 1
fi
echo "Step 2 completed successfully!"

# Step 3: Verify deployment
echo "Step 3: Verifying deployment..."
./verify-rag-deployment.sh
if [ $? -ne 0 ]; then
  echo "Error: Deployment verification failed"
  exit 1
fi
echo "Step 3 completed successfully!"

# Step 4: Monitor system performance
echo "Step 4: Monitoring system performance..."
./monitor-rag-performance.sh
echo "Step 4 completed successfully!"

# Step 5: Monitor API performance
echo "Step 5: Monitoring API performance..."
./monitor-rag-api.sh
echo "Step 5 completed successfully!"

echo "Enhanced RAG system deployment pipeline completed successfully!"
