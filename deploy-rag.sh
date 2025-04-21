#!/bin/bash
# Deploy the enhanced RAG system to Kubernetes

# Set default values
DOCKER_REGISTRY=${DOCKER_REGISTRY:-"localhost:5000"}
TAG=${TAG:-"latest"}

# Replace placeholders in deployment file
echo "Preparing deployment files..."
sed "s|\${DOCKER_REGISTRY}|$DOCKER_REGISTRY|g; s|\${IMAGE_TAG}|$TAG|g" kubernetes/continuous-learning-deployment.yaml > kubernetes/continuous-learning-deployment-prepared.yaml

# Apply deployment
echo "Deploying to Kubernetes..."
kubectl apply -f kubernetes/continuous-learning-deployment-prepared.yaml

# Wait for deployment to complete
echo "Waiting for deployment to complete..."
kubectl rollout status deployment/continuous-learning

# Check deployment status
echo "Checking deployment status..."
kubectl get pods -l app=continuous-learning

echo "Deployment completed!"
