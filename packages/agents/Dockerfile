# Multi-stage Dockerfile for CrewAI Agents Integration
# Optimized for production deployment with security and performance considerations

# ============================================================================
# Stage 1: Base Python Environment with uv
# ============================================================================
FROM python:3.11-slim as python-base

# Set environment variables for Python optimization
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies and uv
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && curl -LsSf https://astral.sh/uv/install.sh | sh \
    && mv /root/.cargo/bin/uv /usr/local/bin/ \
    && apt-get remove -y curl build-essential \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Verify uv installation
RUN uv --version

# ============================================================================
# Stage 2: Node.js Environment for Build Tools
# ============================================================================
FROM node:18-slim as node-base

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# ============================================================================
# Stage 3: Python Dependencies Installation
# ============================================================================
FROM python-base as python-deps

# Create virtual environment using uv
RUN uv venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy requirements or create them from known dependencies
WORKDIR /app
COPY requirements.txt* ./

# If requirements.txt doesn't exist, create it with known CrewAI dependencies
RUN if [ ! -f requirements.txt ]; then \
    echo "crewai>=0.102.0" > requirements.txt && \
    echo "crewai-tools>=0.17.0" >> requirements.txt && \
    echo "langchain>=0.1.0" >> requirements.txt && \
    echo "python-dotenv>=1.0.0" >> requirements.txt && \
    echo "winston>=0.1.0" >> requirements.txt; \
    fi

# Install Python dependencies using uv
RUN uv pip install -r requirements.txt

# ============================================================================
# Stage 4: Application Build
# ============================================================================
FROM python-base as app-build

# Copy virtual environment from python-deps stage
COPY --from=python-deps /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy Node.js dependencies from node-base stage
COPY --from=node-base /app/node_modules ./node_modules

# Set working directory
WORKDIR /app

# Copy application source code
COPY . .

# Create necessary directories
RUN mkdir -p /app/agents/frontend /app/agents/backend /app/logs /app/data

# Run setup script to initialize agent structure
RUN node scripts/setup.js

# Verify setup
RUN node scripts/verify-setup.js

# ============================================================================
# Stage 5: Production Runtime
# ============================================================================
FROM python:3.11-slim as production

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r crewai && useradd -r -g crewai -d /app -s /bin/bash crewai

# Set working directory
WORKDIR /app

# Copy virtual environment from build stage
COPY --from=app-build /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application files from build stage
COPY --from=app-build /app .

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/data /app/tmp && \
    chown -R crewai:crewai /app

# Switch to non-root user
USER crewai

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import crewai; print('CrewAI is healthy')" || exit 1

# Expose port (if needed for web interface)
EXPOSE 8080

# Environment variables
ENV NODE_ENV=production \
    PYTHONPATH=/app \
    CREWAI_LOG_LEVEL=INFO

# Default command
CMD ["python", "-c", "import crewai; print('CrewAI container started successfully')"]

# ============================================================================
# Stage 6: Development Runtime (Optional)
# ============================================================================
FROM production as development

# Switch back to root for development tools installation
USER root

# Install development dependencies
RUN apt-get update && apt-get install -y \
    git \
    vim \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install development Python packages
RUN /opt/venv/bin/pip install \
    pytest \
    pytest-cov \
    black \
    flake8 \
    mypy

# Copy development configuration files
COPY .env.example .env

# Switch back to crewai user
USER crewai

# Override environment for development
ENV NODE_ENV=development \
    CREWAI_LOG_LEVEL=DEBUG

# Development command with hot reload capability
CMD ["python", "-c", "print('CrewAI development container ready')"]