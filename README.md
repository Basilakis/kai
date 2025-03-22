# Kai - Material Recognition & Knowledge Base System

Kai is a comprehensive full-stack application for material recognition and catalog management, with particular focus on tile materials. The system enables identification, cataloging, and searching for materials using machine learning.

## Documentation

All detailed documentation is available in the `readme` folder:

- [Project Structure](./readme/folder-structure.md) - Organization and component interactions
- [Material Recognition](./readme/material-recognition.md) - ML-powered material identification
- [Knowledge Base](./readme/knowledge-base.md) - Material storage and retrieval system
- [Datasets and AI Models](./readme/datasets-and-models.md) - Integration of premade datasets with AI models
- [PDF Processing](./readme/pdf-processing.md) - Catalog extraction capabilities
- [Queue System](./readme/queue-system.md) - Message broker and async processing
- [API Reference](./readme/api-reference.md) - Comprehensive API endpoints
- [Deployment & Development](./readme/deployment-and-development.md) - Production deployment and development setup

## Quick Start

```bash
# Clone repository
git clone https://github.com/your-org/kai.git
cd kai

# Install dependencies
yarn install

# Set up environment
cp packages/[package-name]/.env.example packages/[package-name]/.env

# Start development environment
yarn dev
```

For detailed setup instructions, deployment guides, and development workflows, see the [Deployment & Development](./readme/deployment-and-development.md) documentation.

## License

MIT