#!/bin/bash
# DEPRECATED: This script is deprecated. Use Flux GitOps for deployments.
# See readme/deployment-guide.md for details on the Flux workflow.
# This script is kept for reference or emergency manual overrides only.
#
# Helm-based Kubernetes Deployment Script for KAI ML Platform
# This script deploys the Kai Platform using Helm charts
# Supports canary deployments with health monitoring and automated rollbacks

set -eo pipefail  # Exit on any error and propagate pipe failures

# Set default environment variables
KUBE_CONTEXT=${KUBE_CONTEXT:-"kai-staging-cluster"}
ENVIRONMENT=${ENVIRONMENT:-"staging"}
REGISTRY_URL=${REGISTRY_URL:-"registry.example.com"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}
NAMESPACE=${NAMESPACE:-""}  # Will be set by values file if not specified
RELEASE_NAME="kai"
CHART_PATH="./helm-charts/kai"

# Canary deployment defaults
CANARY_DEPLOYMENT=false
CANARY_WEIGHT=10      # 10% of traffic
CANARY_ANALYSIS_TIME=10  # Minutes to monitor canary
HEALTH_THRESHOLD=95   # 95% success rate required
CRITICAL_SERVICES="api-server,coordinator-service"  # Comma-separated list of critical services

# Display script usage
usage() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  --context=<context>     Kubernetes context (default: $KUBE_CONTEXT)"
  echo "  --registry=<url>        Container registry URL (default: $REGISTRY_URL)"
  echo "  --tag=<tag>             Image tag (default: $IMAGE_TAG)"
  echo "  --env=<environment>     Target environment - staging or production (default: $ENVIRONMENT)"
  echo "  --namespace=<namespace> Override the namespace (default: from values file)"
  echo "  --release=<name>        Helm release name (default: $RELEASE_NAME)"
  echo "  --dry-run               Perform a dry run without applying changes"
  echo "  --rollback=<version>    Rollback to a previous Helm release version"
  echo "  --list-releases         List all Helm releases"
  echo "  --list-versions         List all versions of a release"
  echo ""
  echo "Canary Deployment Options:"
  echo "  --canary                Enable canary deployment"
  echo "  --canary-weight=<pct>   Percentage of traffic to route to canary (default: $CANARY_WEIGHT)"
  echo "  --canary-time=<min>     Minutes to analyze canary before promotion (default: $CANARY_ANALYSIS_TIME)"
  echo "  --health-threshold=<pct> Success rate threshold for promotion (default: $HEALTH_THRESHOLD)"
  echo "  --critical-services=<svc> Comma-separated list of critical services to monitor (default: $CRITICAL_SERVICES)"
  echo ""
  echo "  --help                  Display this help message"
  exit 1
}

# Parse command line arguments
DRY_RUN=false
ROLLBACK_VERSION=""
LIST_RELEASES=false
LIST_VERSIONS=false

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
    --env=*)
      ENVIRONMENT="${arg#*=}"
      ;;
    --namespace=*)
      NAMESPACE="${arg#*=}"
      ;;
    --release=*)
      RELEASE_NAME="${arg#*=}"
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    --rollback=*)
      ROLLBACK_VERSION="${arg#*=}"
      ;;
    --list-releases)
      LIST_RELEASES=true
      ;;
    --list-versions)
      LIST_VERSIONS=true
      ;;
    --canary)
      CANARY_DEPLOYMENT=true
      ;;
    --canary-weight=*)
      CANARY_WEIGHT="${arg#*=}"
      ;;
    --canary-time=*)
      CANARY_ANALYSIS_TIME="${arg#*=}"
      ;;
    --health-threshold=*)
      HEALTH_THRESHOLD="${arg#*=}"
      ;;
    --critical-services=*)
      CRITICAL_SERVICES="${arg#*=}"
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

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "Error: Environment must be either 'staging' or 'production'"
  exit 1
fi

# Values file path based on environment
VALUES_FILE="$CHART_PATH/values-$ENVIRONMENT.yaml"
if [ ! -f "$VALUES_FILE" ]; then
  echo "Error: Values file $VALUES_FILE does not exist"
  exit 1
fi

# Check if helm is installed
if ! command -v helm &> /dev/null; then
  echo "Error: helm is not installed or not in the PATH"
  exit 1
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

# List all Helm releases
if [ "$LIST_RELEASES" = true ]; then
  echo "Listing all Helm releases in context $KUBE_CONTEXT..."
  helm list --kube-context $KUBE_CONTEXT
  exit 0
fi

# List all versions of a release
if [ "$LIST_VERSIONS" = true ]; then
  echo "Listing all versions of release $RELEASE_NAME in context $KUBE_CONTEXT..."
  helm history $RELEASE_NAME --kube-context $KUBE_CONTEXT
  exit 0
fi

# Rollback to a previous version
if [ -n "$ROLLBACK_VERSION" ]; then
  echo "Rolling back release $RELEASE_NAME to version $ROLLBACK_VERSION in context $KUBE_CONTEXT..."
  helm rollback $RELEASE_NAME $ROLLBACK_VERSION --kube-context $KUBE_CONTEXT
  echo "Rollback completed"
  exit 0
fi

# Create a timestamp for this deployment
DEPLOY_TIMESTAMP=$(date +%Y%m%d%H%M%S)
echo "Deployment timestamp: $DEPLOY_TIMESTAMP (Environment: $ENVIRONMENT)"

# Prepare set values
SET_VALUES="global.registry.url=$REGISTRY_URL,global.image.tag=$IMAGE_TAG"
if [ -n "$NAMESPACE" ]; then
  SET_VALUES="$SET_VALUES,global.namespace=$NAMESPACE"
fi

# Function to get service health metrics from Prometheus
get_service_health() {
  local service=$1
  local namespace=$(helm get values $RELEASE_NAME -o json | jq -r '.global.namespace // "kai-system"')
  
  # Get success rate from Prometheus
  # This uses the common success ratio metric for HTTP requests
  # Replace with actual metric appropriate for your monitoring system
  SUCCESS_RATE=$(kubectl exec -n monitoring deploy/prometheus-server -- \
    wget -qO- http://localhost:9090/api/v1/query \
    --post-data="query=sum(rate(http_requests_total{service=\"$service\",status_code=~\"2..\"}[5m])) / sum(rate(http_requests_total{service=\"$service\"}[5m])) * 100" | \
    jq -r '.data.result[0].value[1]' || echo "0")
  
  echo "$SUCCESS_RATE"
}

# Function to check health of critical services in canary
check_canary_health() {
  local canary_release=$1
  local namespace=$(helm get values $canary_release -o json | jq -r '.global.namespace // "kai-system"')
  local health_status=true
  
  # Print header for health check
  echo "==================== CANARY HEALTH CHECK ===================="
  echo "Canary Release: $canary_release"
  
  # Check each critical service
  IFS=',' read -ra SERVICES <<< "$CRITICAL_SERVICES"
  for service in "${SERVICES[@]}"; do
    echo "Checking health for service: $service"
    
    # Get health metrics
    success_rate=$(get_service_health "$service")
    
    echo "Success Rate: $success_rate% (Threshold: $HEALTH_THRESHOLD%)"
    
    # Check if success rate is below threshold
    if (( $(echo "$success_rate < $HEALTH_THRESHOLD" | bc -l) )); then
      echo "Health check FAILED for $service"
      health_status=false
    else
      echo "Health check PASSED for $service"
    fi
    echo "--------------------------------------------------------"
  done
  
  echo "==================== HEALTH CHECK SUMMARY ===================="
  if [ "$health_status" = true ]; then
    echo "All services are healthy"
  else
    echo "One or more services are unhealthy"
  fi
  echo "=============================================================="
  
  # Return health status
  if [ "$health_status" = true ]; then
    return 0
  else
    return 1
  fi
}

# Set up dry run flag for helm
HELM_DRY_RUN=""
if [ "$DRY_RUN" = true ]; then
  HELM_DRY_RUN="--dry-run"
  echo "Performing dry run (no changes will be applied)"
fi

# Handle canary deployment logic
deploy_canary() {
  local canary_release="${RELEASE_NAME}-canary"
  local namespace=$(helm get values $RELEASE_NAME -o json 2>/dev/null | jq -r '.global.namespace // "kai-system"' || echo "kai-system")
  
  echo "Starting canary deployment with ${CANARY_WEIGHT}% traffic weight..."
  
  # Install or upgrade the canary release
  echo "Deploying canary release..."
  helm upgrade --install $canary_release $CHART_PATH \
    --values $VALUES_FILE \
    --set $SET_VALUES \
    --set canary.enabled=true \
    --set canary.weight=$CANARY_WEIGHT \
    --kube-context $KUBE_CONTEXT \
    $HELM_DRY_RUN
  
  if [ "$DRY_RUN" = true ]; then
    echo "Dry run completed for canary deployment"
    return
  fi
  
  # Monitor canary for the specified analysis time
  echo "Monitoring canary deployment for $CANARY_ANALYSIS_TIME minutes..."
  
  # Convert minutes to seconds
  local analysis_seconds=$((CANARY_ANALYSIS_TIME * 60))
  local start_time=$(date +%s)
  local end_time=$((start_time + analysis_seconds))
  
  # Create a progress bar
  local bar_size=40
  
  while [ $(date +%s) -lt $end_time ]; do
    # Calculate progress percentage
    local current_time=$(date +%s)
    local elapsed=$((current_time - start_time))
    local percentage=$((elapsed * 100 / analysis_seconds))
    local bar_progress=$((elapsed * bar_size / analysis_seconds))
    
    # Draw progress bar
    printf "\rProgress: ["
    for ((i=0; i<bar_size; i++)); do
      if [ $i -lt $bar_progress ]; then
        printf "#"
      else
        printf " "
      fi
    done
    printf "] %d%%" $percentage
    
    # Check health every 30 seconds
    if [ $((elapsed % 30)) -eq 0 ]; then
      printf "\n"
      if ! check_canary_health $canary_release; then
        echo "Canary health check failed! Rolling back..."
        helm uninstall $canary_release --kube-context $KUBE_CONTEXT
        echo "Canary deployment rolled back due to health check failure"
        return 1
      fi
    fi
    
    sleep 5
  done
  
  # Final health check
  printf "\nFinal health check...\n"
  if check_canary_health $canary_release; then
    echo "Canary deployment successful! Promoting to production..."
    
    # Promote canary by upgrading the main release with the canary values
    local canary_tag=$(helm get values $canary_release -o json | jq -r '.global.image.tag')
    
    helm upgrade --install $RELEASE_NAME $CHART_PATH \
      --values $VALUES_FILE \
      --set $SET_VALUES \
      --set canary.enabled=false \
      --kube-context $KUBE_CONTEXT
    
    # Clean up canary release
    helm uninstall $canary_release --kube-context $KUBE_CONTEXT
    
    echo "Canary deployment successfully promoted to production"
    return 0
  else
    echo "Final canary health check failed! Rolling back..."
    helm uninstall $canary_release --kube-context $KUBE_CONTEXT
    echo "Canary deployment rolled back due to health check failure"
    return 1
  fi
}

# Install or upgrade the Helm release
if [ "$CANARY_DEPLOYMENT" = true ]; then
  echo "Deploying Kai Platform to $ENVIRONMENT environment using canary deployment..."
  deploy_canary
else
  echo "Deploying Kai Platform to $ENVIRONMENT environment using standard deployment..."
  helm upgrade --install $RELEASE_NAME $CHART_PATH \
    --values $VALUES_FILE \
    --set $SET_VALUES \
    --kube-context $KUBE_CONTEXT \
    $HELM_DRY_RUN
fi

if [ "$DRY_RUN" = false ]; then
  # Wait for deployment to be ready
  echo "Waiting for deployment to be ready..."
  helm status $RELEASE_NAME --kube-context $KUBE_CONTEXT

  # Verify deployment with kubectl
  echo "Verifying deployment..."
  kubectl get deployments -n $(helm get values $RELEASE_NAME -o json | jq -r '.global.namespace // "kai-system"') --kube-context $KUBE_CONTEXT
fi

# Print rollback instructions
echo ""
echo "==============================================================================="
echo "Deployment Information"
echo "==============================================================================="
echo "Environment: $ENVIRONMENT"
echo "Kubernetes Context: $KUBE_CONTEXT"
echo "Helm Release: $RELEASE_NAME"
echo "Deployment Timestamp: $DEPLOY_TIMESTAMP"
if [ "$CANARY_DEPLOYMENT" = true ]; then
  echo "Deployment Type: Canary (with automatic health checks)"
  echo "Canary Weight: $CANARY_WEIGHT%"
  echo "Analysis Time: $CANARY_ANALYSIS_TIME minutes"
  echo "Health Threshold: $HEALTH_THRESHOLD%"
  echo "Critical Services Monitored: $CRITICAL_SERVICES"
else
  echo "Deployment Type: Standard"
fi
echo ""
echo "To rollback this deployment if needed, run:"
echo "$0 --context=$KUBE_CONTEXT --env=$ENVIRONMENT --rollback=<version>"
echo "To list available versions for rollback, run:"
echo "$0 --context=$KUBE_CONTEXT --list-versions"
echo "==============================================================================="

# Print access information
echo ""
echo "==============================================================================="
echo "Access Information"
echo "==============================================================================="
if [ "$ENVIRONMENT" == "production" ]; then
  API_URL="https://api.kai.yourdomain.com"
  ADMIN_URL="https://admin.kai.yourdomain.com"
  CLIENT_URL="https://kai.yourdomain.com"
else
  API_URL="https://api-staging.kai.yourdomain.com"
  ADMIN_URL="https://staging-kai-admin.vercel.app"
  CLIENT_URL="https://staging-kai-client.vercel.app"
fi

echo "API Server: $API_URL"
echo "Admin Panel: $ADMIN_URL"
echo "Client Application: $CLIENT_URL"
echo ""
echo "Monitor the deployment: kubectl logs -n $(helm get values $RELEASE_NAME -o json | jq -r '.global.namespace // "kai-system"') -l app=coordinator-service -f --kube-context $KUBE_CONTEXT"
echo "==============================================================================="