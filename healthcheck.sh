#!/bin/bash

# Universal Health Check Script for Kai Services
# This script provides basic health checking for containerized services

set -e

# Default values
PORT=${HEALTH_CHECK_PORT:-3000}
ENDPOINT=${HEALTH_CHECK_ENDPOINT:-"/health"}
TIMEOUT=${HEALTH_CHECK_TIMEOUT:-10}
SERVICE_TYPE=${SERVICE_TYPE:-"web"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[HEALTH]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a port is listening
check_port() {
    local port=$1
    if command -v netstat >/dev/null 2>&1; then
        netstat -ln | grep ":${port} " >/dev/null 2>&1
    elif command -v ss >/dev/null 2>&1; then
        ss -ln | grep ":${port} " >/dev/null 2>&1
    else
        # Fallback: try to connect
        timeout 2 bash -c "</dev/tcp/localhost/${port}" >/dev/null 2>&1
    fi
}

# Function to check HTTP endpoint
check_http() {
    local url="http://localhost:${PORT}${ENDPOINT}"
    
    if command -v curl >/dev/null 2>&1; then
        curl -f -s --max-time "${TIMEOUT}" "${url}" >/dev/null 2>&1
    elif command -v wget >/dev/null 2>&1; then
        wget -q --timeout="${TIMEOUT}" --tries=1 -O /dev/null "${url}" >/dev/null 2>&1
    else
        error "Neither curl nor wget available for HTTP health check"
        return 1
    fi
}

# Function to check process by name
check_process() {
    local process_name=$1
    if [ -z "$process_name" ]; then
        return 0
    fi
    
    pgrep -f "$process_name" >/dev/null 2>&1
}

# Function to check disk space
check_disk_space() {
    local threshold=${DISK_THRESHOLD:-90}
    local usage
    
    if command -v df >/dev/null 2>&1; then
        usage=$(df /app 2>/dev/null | awk 'NR==2 {print $5}' | sed 's/%//')
        if [ -n "$usage" ] && [ "$usage" -gt "$threshold" ]; then
            warn "Disk usage is ${usage}% (threshold: ${threshold}%)"
            return 1
        fi
    fi
    return 0
}

# Function to check memory usage
check_memory() {
    local threshold=${MEMORY_THRESHOLD:-90}
    local usage
    
    if command -v free >/dev/null 2>&1; then
        usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
        if [ -n "$usage" ] && [ "$usage" -gt "$threshold" ]; then
            warn "Memory usage is ${usage}% (threshold: ${threshold}%)"
            return 1
        fi
    fi
    return 0
}

# Main health check logic
main() {
    log "Starting health check for service type: ${SERVICE_TYPE}"
    
    local checks_passed=0
    local total_checks=0
    
    # Check 1: Port availability
    if [ "$SERVICE_TYPE" = "web" ] || [ "$SERVICE_TYPE" = "api" ]; then
        total_checks=$((total_checks + 1))
        log "Checking if port ${PORT} is listening..."
        if check_port "$PORT"; then
            log "✓ Port ${PORT} is listening"
            checks_passed=$((checks_passed + 1))
        else
            error "✗ Port ${PORT} is not listening"
        fi
        
        # Check 2: HTTP endpoint
        total_checks=$((total_checks + 1))
        log "Checking HTTP endpoint ${ENDPOINT}..."
        if check_http; then
            log "✓ HTTP endpoint is responding"
            checks_passed=$((checks_passed + 1))
        else
            error "✗ HTTP endpoint is not responding"
        fi
    fi
    
    # Check 3: Process check (if specified)
    if [ -n "$PROCESS_NAME" ]; then
        total_checks=$((total_checks + 1))
        log "Checking process: ${PROCESS_NAME}..."
        if check_process "$PROCESS_NAME"; then
            log "✓ Process ${PROCESS_NAME} is running"
            checks_passed=$((checks_passed + 1))
        else
            error "✗ Process ${PROCESS_NAME} is not running"
        fi
    fi
    
    # Check 4: Disk space
    total_checks=$((total_checks + 1))
    log "Checking disk space..."
    if check_disk_space; then
        log "✓ Disk space is adequate"
        checks_passed=$((checks_passed + 1))
    else
        error "✗ Disk space is low"
    fi
    
    # Check 5: Memory usage
    total_checks=$((total_checks + 1))
    log "Checking memory usage..."
    if check_memory; then
        log "✓ Memory usage is acceptable"
        checks_passed=$((checks_passed + 1))
    else
        error "✗ Memory usage is high"
    fi
    
    # Custom health check script (if exists)
    if [ -f "/app/custom-health-check.sh" ]; then
        total_checks=$((total_checks + 1))
        log "Running custom health check..."
        if bash /app/custom-health-check.sh; then
            log "✓ Custom health check passed"
            checks_passed=$((checks_passed + 1))
        else
            error "✗ Custom health check failed"
        fi
    fi
    
    # Summary
    log "Health check summary: ${checks_passed}/${total_checks} checks passed"
    
    if [ "$checks_passed" -eq "$total_checks" ]; then
        log "🎉 All health checks passed!"
        exit 0
    else
        error "❌ Some health checks failed!"
        exit 1
    fi
}

# Handle different service types
case "$SERVICE_TYPE" in
    "web"|"api")
        # Default behavior for web services
        ;;
    "worker"|"job")
        # For background workers, only check process and resources
        PORT=""
        ENDPOINT=""
        ;;
    "ml")
        # For ML services, check GPU availability if needed
        if [ "$CHECK_GPU" = "true" ]; then
            if command -v nvidia-smi >/dev/null 2>&1; then
                log "Checking GPU availability..."
                if nvidia-smi >/dev/null 2>&1; then
                    log "✓ GPU is available"
                else
                    error "✗ GPU check failed"
                fi
            fi
        fi
        ;;
    *)
        warn "Unknown service type: ${SERVICE_TYPE}, using default checks"
        ;;
esac

# Run main health check
main "$@"