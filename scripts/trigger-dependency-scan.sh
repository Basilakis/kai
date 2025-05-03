#!/bin/bash
# =============================================================================
# Trigger Dependency Scan Script
#
# This script creates a Kubernetes job to scan and update dependencies.
# It uses the job template defined in kubernetes/jobs/dependency-management-job.yaml
# =============================================================================

set -e

NAMESPACE=${NAMESPACE:-"default"}
JOB_NAME="dependency-update-job-$(date +%Y%m%d%H%M%S)"
JOB_TEMPLATE="kubernetes/jobs/dependency-management-job.yaml"

echo "Triggering dependency scan job..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "Error: kubectl is not installed or not in PATH"
    exit 1
fi

# Check if the job template exists
if [ ! -f "$JOB_TEMPLATE" ]; then
    echo "Error: Job template $JOB_TEMPLATE not found"
    exit 1
fi

# Create a temporary file with the job definition
TMP_JOB_FILE=$(mktemp)
cat "$JOB_TEMPLATE" | sed "s/dependency-update-job/$JOB_NAME/g" > "$TMP_JOB_FILE"

# Apply the job
kubectl apply -f "$TMP_JOB_FILE" -n "$NAMESPACE"

echo "Job $JOB_NAME created in namespace $NAMESPACE"
echo "To check job status:"
echo "  kubectl get job $JOB_NAME -n $NAMESPACE"
echo "To view job logs:"
echo "  kubectl logs -f job/$JOB_NAME -n $NAMESPACE"

# Clean up the temporary file
rm "$TMP_JOB_FILE"

# Wait for job completion if requested
if [ "$1" == "--wait" ]; then
    echo "Waiting for job to complete..."
    kubectl wait --for=condition=complete "job/$JOB_NAME" -n "$NAMESPACE" --timeout=1800s
    if [ $? -eq 0 ]; then
        echo "Job completed successfully!"
        # Get the job's pod name
        POD_NAME=$(kubectl get pods -n "$NAMESPACE" -l "job-name=$JOB_NAME" -o jsonpath='{.items[0].metadata.name}')
        echo "Showing job logs:"
        kubectl logs -n "$NAMESPACE" "$POD_NAME"
    else
        echo "Job failed or timed out"
        kubectl get job "$JOB_NAME" -n "$NAMESPACE" -o yaml
    fi
fi