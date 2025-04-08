# Kai - Material Recognition & Knowledge Base System

Kai is a comprehensive full-stack application for material recognition and catalog management, with particular focus on tile materials. The system enables identification, cataloging, and searching for materials using machine learning.

## Documentation

All detailed documentation is available in the `readme` folder:

- [Project Structure](./folder-structure.md) - Organization and component interactions
- [Material Recognition](./material-recognition.md) - ML-powered material identification
- [Knowledge Base](./knowledge-base.md) - Material storage and retrieval system
- [Datasets and AI Models](./datasets-and-models.md) - Integration of premade datasets with AI models
- [PDF Processing](./pdf-processing.md) - Catalog extraction capabilities
- [Queue System](./queue-system.md) - Message broker and async processing
- [Monitoring System](./monitoring-system.md) - System health monitoring and operational visibility
- [API Reference](./api-reference.md) - Comprehensive API endpoints including health checks and rate limiting
- [Deployment & Development](./deployment-and-development.md) - Production deployment and development setup
- [CrewAI Integration](./agents-crewai.md) - Intelligent agent capabilities powered by crewAI
- [CrewAI Implementation](./agents-crewai-implementation.md) - Implementation details for crewAI agents

## Quick Start

```bash
# Clone repository
git clone https://github.com/your-org/kai.git
cd kai

# Install dependencies
yarn install

# Set up environment
cp .env.example .env

# Start development environment
yarn dev
```

For detailed setup instructions, deployment guides, and development workflows, see the [Deployment & Development](./deployment-and-development.md) documentation.

## System Health Monitoring

Kai includes comprehensive health monitoring capabilities:

- **Health Endpoints**: Basic `/health` and detailed `/health/detailed` endpoints for monitoring
- **Environment Validation**: Automatic validation of required environment variables
- **Rate Limiting**: Specialized rate limiting for different API endpoints
- **Monitoring Dashboard**: Admin panel for system monitoring with logs, errors, and metrics

See the [Monitoring System](./monitoring-system.md) documentation for details.

## License

MIT