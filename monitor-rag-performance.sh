#!/bin/bash
# Monitor the enhanced RAG system performance

# Set default values
DURATION=${DURATION:-"5m"}
INTERVAL=${INTERVAL:-"10s"}

# Get pod names
PODS=$(kubectl get pods -l app=continuous-learning -o jsonpath='{.items[*].metadata.name}')

if [ -z "$PODS" ]; then
  echo "Error: No continuous learning pods found"
  exit 1
fi

# Monitor CPU and memory usage
echo "Monitoring CPU and memory usage for $DURATION (interval: $INTERVAL)..."
for POD in $PODS; do
  kubectl top pod $POD --containers
done

# Start continuous monitoring
echo "Starting continuous monitoring (press Ctrl+C to stop)..."
end=$((SECONDS+$(echo $DURATION | sed 's/m/*60/g' | bc)))

while [ $SECONDS -lt $end ]; do
  clear
  date
  echo "=== CPU and Memory Usage ==="
  kubectl top pod -l app=continuous-learning
  
  echo ""
  echo "=== Pod Status ==="
  kubectl get pods -l app=continuous-learning
  
  echo ""
  echo "=== Recent Logs ==="
  for POD in $PODS; do
    echo "Pod: $POD"
    kubectl logs $POD --tail=5
    echo ""
  done
  
  sleep $(echo $INTERVAL | sed 's/s//g')
done

# Get final statistics
echo "Final statistics:"
kubectl describe pods -l app=continuous-learning | grep -E "CPU:|Memory:|Restart"
