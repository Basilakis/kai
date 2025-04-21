#!/bin/bash
# Monitor the enhanced RAG system API performance

# Set default values
API_URL=${API_URL:-"http://localhost:3000/api/rag"}
DURATION=${DURATION:-"5m"}
INTERVAL=${INTERVAL:-"10s"}
SAMPLE_QUERY="What are the best hardwood flooring options for high-traffic areas?"

# Function to test API
test_api() {
  echo "Testing API endpoint: $API_URL/query"
  
  # Measure response time
  START_TIME=$(date +%s.%N)
  RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"textQuery\": \"$SAMPLE_QUERY\", \"options\": {\"detail_level\": \"detailed\"}}" \
    $API_URL/query)
  END_TIME=$(date +%s.%N)
  
  # Calculate response time
  RESPONSE_TIME=$(echo "$END_TIME - $START_TIME" | bc)
  
  # Check if response contains materials
  MATERIALS_COUNT=$(echo $RESPONSE | grep -o "materials" | wc -l)
  
  if [ $MATERIALS_COUNT -gt 0 ]; then
    echo "✅ API response successful (response time: ${RESPONSE_TIME}s)"
  else
    echo "❌ API response failed (response time: ${RESPONSE_TIME}s)"
    echo "Response: $RESPONSE"
  fi
}

# Function to get system stats
get_stats() {
  echo "Getting system stats from: $API_URL/stats"
  
  # Get stats
  STATS=$(curl -s -X GET $API_URL/stats)
  
  # Check if stats contain components
  COMPONENTS=$(echo $STATS | grep -o "components" | wc -l)
  
  if [ $COMPONENTS -gt 0 ]; then
    echo "✅ Stats retrieved successfully"
    
    # Extract cache hit rate if available
    CACHE_HIT_RATE=$(echo $STATS | grep -o '"hit_rate":[0-9.]*' | cut -d: -f2)
    if [ ! -z "$CACHE_HIT_RATE" ]; then
      echo "Cache hit rate: $CACHE_HIT_RATE"
    fi
  else
    echo "❌ Stats retrieval failed"
    echo "Response: $STATS"
  fi
}

# Start monitoring
echo "Starting API monitoring for $DURATION (interval: $INTERVAL)..."
end=$((SECONDS+$(echo $DURATION | sed 's/m/*60/g' | bc)))

while [ $SECONDS -lt $end ]; do
  clear
  date
  echo "=== API Performance ==="
  test_api
  
  echo ""
  echo "=== System Stats ==="
  get_stats
  
  sleep $(echo $INTERVAL | sed 's/s//g')
done

echo "API monitoring completed!"
