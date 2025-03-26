FROM tensorflow/tensorflow:2.9.1-gpu

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-pip \
    python3-dev \
    nodejs \
    npm \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install yarn
RUN npm install -g yarn

# Copy package files
COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/ml/package.json ./packages/ml/

# Copy requirements.txt
COPY packages/ml/requirements.txt ./packages/ml/

# Install Python dependencies
RUN pip3 install --no-cache-dir -r packages/ml/requirements.txt

# Install Node.js dependencies
RUN yarn install --frozen-lockfile --production

# Copy source code
COPY packages/shared ./packages/shared/
COPY packages/ml ./packages/ml/

# Build TypeScript packages
RUN yarn workspace @kai/shared build
RUN yarn workspace @kai/ml build

# Create directory for models
RUN mkdir -p /app/models
VOLUME /app/models

# Expose port
EXPOSE 5000

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

# Start ML service
CMD ["python3", "packages/ml/python/server.py"]