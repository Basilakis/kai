# Optimized Dockerfile for ML Services
# Uses multi-stage builds for efficient caching and smaller final image

# STAGE 1: Node.js builder - Build TypeScript components
FROM node:20-alpine AS node-builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/ml/package.json ./packages/ml/

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared/
COPY packages/ml/src ./packages/ml/src
COPY packages/ml/tsconfig.json ./packages/ml/
COPY tsconfig.json ./

# Build TypeScript packages
RUN yarn workspace @kai/shared build && \
    yarn workspace @kai/ml build

# STAGE 2: Python dependencies and runtime
FROM tensorflow/tensorflow:2.10.0-gpu

# Set working directory
WORKDIR /app

# Add non-root user
RUN groupadd -g 1001 mluser && \
    useradd -u 1001 -g mluser -s /bin/bash -m mluser

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    ca-certificates \
    dumb-init \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements
COPY packages/ml/requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy built Node.js packages
COPY --from=node-builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=node-builder /app/packages/ml/dist ./packages/ml/dist
COPY --from=node-builder /app/packages/shared/package.json ./packages/shared/
COPY --from=node-builder /app/packages/ml/package.json ./packages/ml/

# Copy Python code
COPY packages/ml/python ./packages/ml/python

# Create directory for models with proper permissions
RUN mkdir -p /app/models && \
    chown -R mluser:mluser /app/models /app/packages
VOLUME /app/models

# Expose port
EXPOSE 5000

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/home/mluser/.local/bin:$PATH" \
    TZ=UTC

# Create startup script to handle permissions and user switching
RUN echo '#!/bin/bash\n\
# Ensure correct ownership of volume mounts\n\
chown -R mluser:mluser /app/models\n\
# Run as mluser\n\
exec gosu mluser python3 packages/ml/python/server.py "$@"\n\
' > /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

# Use dumb-init as PID 1 to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["/app/entrypoint.sh"]