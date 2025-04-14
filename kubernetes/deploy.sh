#!/bin/bash
# Kubernetes Deployment Script for KAI ML Platform
# This script applies all Kubernetes configurations in the correct order

set -e  # Exit on any error

# Set default environment variables
KUBE_CONTEXT=${KUBE_CONTEXT:-"kai-ml-cluster"}
REGISTRY_URL=${REGISTRY_URL:-"registry.example.com"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}

# Display script usage
usage() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  --context=<context>    Kubernetes context (default: $KUBE_CONTEXT)"
  echo "  --registry=<url>       Container registry URL (default: $REGISTRY_URL)"
  echo "  --tag=<tag>            Image tag (default: $IMAGE_TAG)"
  echo "  --dry-run              Perform a dry run without applying changes"
  echo "  --skip-infrastructure  Skip infrastructure components"
  echo "  --skip-coordinator     Skip coordinator service components"
  echo "  --skip-workflows       Skip workflow templates"
  echo "  --help                 Display this help message"
  exit 1
}

# Parse command line arguments
DRY_RUN=false
SKIP_INFRASTRUCTURE=false
SKIP_COORDINATOR=false
SKIP_WORKFLOWS=false

for arg in "$@"; do
  case $arg in
    --context=*)
      KUBE_CONTEXT="${arg#*=}"
      ;;
    --registry=*)
      REGISTRY_URL="${arg#*=}"
      ;;
    --tag=*)
      IMAGE_TAG="${arg#*=}"
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    --skip-infrastructure)
      SKIP_INFRASTRUCTURE=true
      ;;
    --skip-coordinator)
      SKIP_COORDINATOR=true
      ;;
    --skip-workflows)
      SKIP_WORKFLOWS=true
      ;;
    --help)
      usage
      ;;
    *)
      echo "Unknown option: $arg"
      usage
      ;;
  esac
done

# Set up dry run flag for kubectl
KUBECTL_DRY_RUN=""
if [ "$DRY_RUN" = true ]; then
  KUBECTL_DRY_RUN="--dry-run=client"
  echo "Performing dry run (no changes will be applied)"
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
  echo "Error: kubectl is not installed or not in the PATH"
  exit 1
fi

# Check if the context exists
if ! kubectl config get-contexts $KUBE_CONTEXT &> /dev/null; then
  echo "Error: Kubernetes context '$KUBE_CONTEXT' does not exist"
  echo "Available contexts:"
  kubectl config get-contexts
  exit 1
fi

# Set the kubectl context
echo "Setting Kubernetes context to $KUBE_CONTEXT"
kubectl config use-context $KUBE_CONTEXT

# Function to apply Kubernetes configuration with templating
apply_config() {
  local file=$1
  echo "Applying $file..."
  
  # Create a temporary file for variable substitution
  local tmp_file=$(mktemp)
  
  # Replace placeholders with environment variables
  cat $file | \
    sed "s|\${REGISTRY_URL}|$REGISTRY_URL|g" | \
    sed "s|\${IMAGE_TAG}|$IMAGE_TAG|g" > $tmp_file
  
  # Apply configuration
  kubectl apply -f $tmp_file $KUBECTL_DRY_RUN
  
  # Clean up temporary file
  rm $tmp_file
}

# Create timestamp for deployment
DEPLOY_TIMESTAMP=$(date +%Y%m%d%H%M%S)
echo "Deployment timestamp: $DEPLOY_TIMESTAMP"

# Deploy infrastructure components
if [ "$SKIP_INFRASTRUCTURE" = false ]; then
  echo "Deploying infrastructure components..."
  
  # Apply namespace first
  apply_config kubernetes/infrastructure/namespace.yaml
  
  # Apply priority classes
  apply_config kubernetes/infrastructure/priority-classes.yaml
  
  # Apply node pool configurations
  apply_config kubernetes/infrastructure/node-pools.yaml
  
  # Apply monitoring infrastructure
  apply_config kubernetes/infrastructure/monitoring.yaml
  
  # Apply caching infrastructure
  apply_config kubernetes/infrastructure/caching.yaml
  
  echo "Infrastructure components deployed successfully"
fi

# Deploy coordinator service
if [ "$SKIP_COORDINATOR" = false ]; then
  echo "Deploying coordinator service..."
  
  # Apply RBAC first
  apply_config kubernetes/coordinator/rbac.yaml
  
  # Apply configuration
  apply_config kubernetes/coordinator/config.yaml
  
  # Apply service
  apply_config kubernetes/coordinator/service.yaml
  
  # Apply deployment
  apply_config kubernetes/coordinator/deployment.yaml
  
  echo "Coordinator service deployed successfully"
fi

# Deploy workflow templates
if [ "$SKIP_WORKFLOWS" = false ]; then
  echo "Deploying workflow templates..."
  
  # Apply workflow templates
  for template in kubernetes/workflows/*.yaml; do
    apply_config $template
  done
  
  echo "Workflow templates deployed successfully"
fi

echo "Deployment completed successfully at $(date)"

# Verify deployment
echo "Verifying deployment..."

# Check namespace
echo "Checking namespace..."
kubectl get namespace kai-ml

# Check coordinator service
echo "Checking coordinator service..."
kubectl get deployments -n kai-ml coordinator-service

# Check priority classes
echo "Checking priority classes..."
kubectl get priorityclasses | grep -E 'system-critical|interactive|high-priority-batch|medium-priority-batch|low-priority-batch|maintenance|preemptible'

# Check Redis deployment
echo "Checking Redis deployment..."
kubectl get deployments -n kai-ml redis-master

# Check Prometheus and Grafana
echo "Checking monitoring components..."
kubectl get deployments -n kai-ml prometheus
kubectl get deployments -n kai-ml grafana

echo "Verification completed"

# Print post-installation instructions
echo ""
echo "==============================================================================="
echo "Post-Installation Instructions"
echo "==============================================================================="
echo "1. Access Grafana Dashboard: http://$(kubectl get service grafana -n kai-ml -o jsonpath='{.status.loadBalancer.ingress[0].ip}'):80"
echo "   Default credentials: admin/admin"
echo ""
echo "2. Access Jaeger UI: http://$(kubectl get service jaeger -n kai-ml -o jsonpath='{.status.loadBalancer.ingress[0].ip}'):16686"
echo ""
echo "3. Test the coordinator service:"
echo "   curl -X POST http://$(kubectl get service coordinator-service -n kai-ml -o jsonpath='{.status.loadBalancer.ingress[0].ip}')/api/workflow \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"type\": \"3d-reconstruction\", \"parameters\": {\"input-images\": [\"https://example.com/image1.jpg\"]}}'"
echo ""
echo "4. Monitor cluster resource usage:"
echo "   kubectl top nodes"
echo "   kubectl top pods -n kai-ml"
echo "==============================================================================="