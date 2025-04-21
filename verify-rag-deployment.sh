#!/bin/bash
# Verify the enhanced RAG system deployment

# Check if pods are running
echo "Checking if pods are running..."
PODS=$(kubectl get pods -l app=continuous-learning -o jsonpath='{.items[*].metadata.name}')

if [ -z "$PODS" ]; then
  echo "Error: No continuous learning pods found"
  exit 1
fi

for POD in $PODS; do
  STATUS=$(kubectl get pod $POD -o jsonpath='{.status.phase}')
  if [ "$STATUS" != "Running" ]; then
    echo "Error: Pod $POD is not running (status: $STATUS)"
    kubectl describe pod $POD
    exit 1
  fi
  
  # Check readiness
  READY=$(kubectl get pod $POD -o jsonpath='{.status.containerStatuses[0].ready}')
  if [ "$READY" != "true" ]; then
    echo "Error: Pod $POD is not ready"
    kubectl describe pod $POD
    exit 1
  fi
  
  echo "Pod $POD is running and ready"
done

# Check persistent volumes
echo "Checking persistent volumes..."
for PVC in model-registry-pvc models-pvc state-pvc; do
  STATUS=$(kubectl get pvc $PVC -o jsonpath='{.status.phase}')
  if [ "$STATUS" != "Bound" ]; then
    echo "Error: PVC $PVC is not bound (status: $STATUS)"
    kubectl describe pvc $PVC
    exit 1
  fi
  
  echo "PVC $PVC is bound"
done

# Check logs for errors
echo "Checking logs for errors..."
for POD in $PODS; do
  ERRORS=$(kubectl logs $POD | grep -i error | wc -l)
  if [ $ERRORS -gt 0 ]; then
    echo "Warning: Found $ERRORS error messages in pod $POD logs"
    echo "Recent errors:"
    kubectl logs $POD | grep -i error | tail -5
  else
    echo "No errors found in pod $POD logs"
  fi
done

echo "Deployment verification completed successfully!"
