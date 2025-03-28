# CrewAI Integration - Environment Setup

This guide provides detailed instructions for setting up the environment for the KAI platform's CrewAI integration. It covers all necessary configuration steps, API access requirements, and testing procedures.

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [API Keys and Service URLs](#api-keys-and-service-urls)
3. [Authentication Configuration](#authentication-configuration)
4. [Verification and Testing](#verification-and-testing)
5. [Troubleshooting](#troubleshooting)

## Environment Variables

All CrewAI integration environment variables should be added to the main application's `.env` file. Do not create a separate environment file for the agent system.

Here's a complete list of the required and optional environment variables:

```
# === CrewAI Agent System ===

# OpenAI API Configuration (required)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_DEFAULT_MODEL=gpt-4
OPENAI_TEMPERATURE=0.7

# Redis Configuration (for agent state persistence)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=logs/agent.log

# KAI Service URLs
KAI_API_URL=http://localhost:3000/api
KAI_VECTOR_DB_URL=http://localhost:5000/api/vector
KAI_ML_SERVICE_URL=http://localhost:7000/api/ml

# Authentication
KAI_API_KEY=your_kai_api_key_here
KAI_AUTH_TOKEN=your_auth_token_here

# Agent Behavior Settings
AGENT_VERBOSE_MODE=false
AGENT_MEMORY_ENABLED=true
AGENT_MAX_ITERATIONS=10
AGENT_DEFAULT_TIMEOUT=30000
```

## API Keys and Service URLs

### OpenAI API

The CrewAI integration requires an OpenAI API key for agent operations. To get an API key:

1. Create an account at [OpenAI's platform](https://platform.openai.com/)
2. Navigate to API Keys section
3. Generate a new key and add it to your `.env` file as `OPENAI_API_KEY`

### KAI Service URLs

The integration connects to several KAI services. The default URLs are configured for local development, but you should adjust them based on your deployment environment:

```
# Local Development
KAI_API_URL=http://localhost:3000/api
KAI_VECTOR_DB_URL=http://localhost:5000/api/vector
KAI_ML_SERVICE_URL=http://localhost:7000/api/ml

# Staging Environment Example
KAI_API_URL=https://staging-api.kai-platform.com/api
KAI_VECTOR_DB_URL=https://staging-vector.kai-platform.com/api/vector
KAI_ML_SERVICE_URL=https://staging-ml.kai-platform.com/api/ml

# Production Environment Example
KAI_API_URL=https://api.kai-platform.com/api
KAI_VECTOR_DB_URL=https://vector.kai-platform.com/api/vector
KAI_ML_SERVICE_URL=https://ml.kai-platform.com/api/ml
```

## Authentication Configuration

The integration uses the KAI authentication system for accessing various services. There are two ways to authenticate:

### 1. API Key Authentication (Recommended for server environments)

Set the `KAI_API_KEY` environment variable to authenticate using an API key:

```
KAI_API_KEY=your_kai_api_key_here
```

### 2. Token Authentication (Used in browser environments)

The system will automatically use token-based authentication in browser environments. If you've implemented a custom authentication flow, you can manually set:

```
KAI_AUTH_TOKEN=your_auth_token_here
```

## Verification and Testing

After setting up the environment variables, you can verify your configuration using the provided verification script:

```bash
# Navigate to the agents package
cd packages/agents

# Run the verification script
yarn verify
# or
npm run verify
```

This script will:
- Validate all required environment variables
- Check connections to OpenAI API and KAI services
- Report any issues or missing configurations

You can also test the integration with actual services using:

```bash
# Run integration tests
yarn test:integration
# or
npm run test:integration
```

## Troubleshooting

### Common Issues

#### OpenAI API Authentication Failures

If you see errors like "Authentication failed with OpenAI":

1. Verify your `OPENAI_API_KEY` is correctly set
2. Ensure your OpenAI account has billing information if required
3. Check that you're using a supported model name in `OPENAI_DEFAULT_MODEL`

#### Service Connection Issues

If you encounter errors connecting to KAI services:

1. Verify all service URLs are correctly set
2. Ensure the services are running (for local development)
3. Check network connectivity and firewall settings
4. Verify your authentication credentials are valid

#### Token Refresh Failures

If authentication tokens aren't refreshing properly:

1. Check that your authentication configuration is correct
2. Ensure the auth service is available
3. Verify user permissions for the required operations

### Fallback Mechanisms

The integration includes fallback mechanisms that use mock implementations when services are unavailable. This is useful during development or when certain services aren't yet deployed.

To control fallback behavior, you can use:

```
# Enable mock fallbacks (default: true in development, false in production)
ENABLE_MOCK_FALLBACK=true
```

## Further Resources

- [CrewAI Documentation](https://github.com/crewai/crewai)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [KAI Platform API Documentation](/readme/api-reference.md)