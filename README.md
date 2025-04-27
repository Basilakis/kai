# Kai - Material Recognition & Knowledge Base System

Kai is a comprehensive full-stack application for material recognition and catalog management, with particular focus on tile materials. The system enables identification, cataloging, and searching for materials using machine learning.

## Documentation

All detailed documentation is available in the `readme` folder:

- [Project Structure](./readme/folder-structure.md) - Organization and component interactions
- [Material Recognition](./readme/material-recognition.md) - ML-powered material identification
- [Knowledge Base](./readme/knowledge-base.md) - Material storage and retrieval system
- [Database & Vector DB](./readme/database-vector-db.md) - Supabase Vector integration for semantic search
- [Datasets and AI Models](./readme/datasets-and-models.md) - Integration of premade datasets with AI models
- [PDF Processing](./readme/pdf-processing.md) - Catalog extraction capabilities
- [Neural OCR Integration](./readme/neural-ocr-integration.md) - Advanced document understanding with AI models
- [Queue System](./readme/queue-system.md) - Message broker and async processing
- [API Reference](./readme/api-reference.md) - Comprehensive API endpoints
- [Deployment & Development](./readme/deployment-and-development.md) - Production deployment and development setup
- [CrewAI Integration](./readme/agents-crewai.md) - Intelligent agent capabilities powered by crewAI
- [CrewAI Implementation](./readme/agents-crewai-implementation.md) - Implementation details for crewAI agents
- [CrewAI Development Steps](./readme/agents-crewai-next-steps.md) - Next steps for enhancing crewAI integration
- [Material Metadata Enhancement](./readme/material-metadata-response-enhancement.md) - Comprehensive material metadata in responses
- [MoodBoard Feature](./readme/moodboard-feature.md) - Material collection and organization feature

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

## Platform Overview

Kai integrates cutting-edge technologies across machine learning, vector databases, 3D visualization, and agent-based intelligence to deliver a comprehensive solution for material identification, organization, and visualization. The platform architecture is modular and extensible, with multiple specialized systems working together to provide a seamless experience.

### Core Components

#### Material Recognition System
The Material Recognition System provides sophisticated identification and matching of materials from images using:

- **Multi-Strategy Recognition**: Combines feature-based recognition (SIFT/SURF), neural networks (MobileNetV2, ResNet, EfficientNet), and hybrid approaches
- **Confidence Fusion**: Implements weighted average, adaptive fusion, maximum score, and product fusion methods to merge results
- **Vector Similarity Search**: Uses FAISS library for efficient similarity computation
- **Specialized Tile Processing**: Includes custom processors optimized for tile pattern recognition from PDF catalogs and images
- **Geometric Transformation**: Corrects rotation, perspective, and scaling issues in material images

**Key Technologies**: TensorFlow/PyTorch, OpenCV, FAISS, NumPy/SciPy

#### Knowledge Base System
The Knowledge Base serves as the central repository for all material information:

- **Comprehensive Material Storage**: Maintains detailed physical properties, visual attributes, technical specifications, and rich media
- **Advanced Search Capabilities**: Implements text-based, vector-based, metadata, and hybrid search strategies
- **Collection Management**: Supports hierarchical collection structures with property inheritance
- **Relationship Management**: Tracks complex material relationships including complementary materials, alternatives, and visual similarities
- **Versioning & Real-Time Synchronization**: Provides version history and WebSocket-based real-time updates

**Key Technologies**: Supabase with pgvector, MongoDB, Redis, Socket.io

#### Retrieval-Augmented Generation (RAG) System
The RAG system enhances information retrieval by combining vector search with generative AI:

- **Enhanced Vector Storage**: Uses dense embeddings from transformer models and sparse embeddings (BM25/TF-IDF) with HNSW indexing
- **Hybrid Retrieval**: Combines multiple search approaches with ensemble methods and re-ranking
- **Context Assembly**: Organizes retrieved information into structured context with relationship mapping
- **Generative Enhancement**: Integrates LLMs to enhance content with explanations, comparisons, and recommendations
- **Continuous Learning**: Automatically fine-tunes models based on user feedback

**Key Technologies**: OpenAI GPT-4/3.5, HuggingFace Transformers, Supabase pgvector, FastAPI, LangChain

#### Agent System (CrewAI Integration)
The Agent System adds intelligent agent capabilities to the platform:

- **Frontend Agents**: Recognition Assistant, Material Expert, and Project Assistant for user-facing intelligence
- **Backend Agents**: Knowledge Base Agent, Analytics Agent, and Operations Agent for system optimization
- **MCP Integration**: Leverages Model Context Protocol server for optimized language model operations
- **Agent Tools**: Specialized capabilities like Material Search, Image Analysis, and Vector Search

**Key Technologies**: CrewAI, OpenAI API, Redis, Node.js/TypeScript, WebSockets

#### 3D Visualization System
The 3D Visualization System provides advanced visualization capabilities:

- **ThreeJsViewer**: Real-time 3D rendering with WebGL, WebXR support, and BVH optimization
- **EnhancedThreeJsViewer**: WebGPU support, Gaussian Splatting, adaptive LOD, and hierarchical occlusion culling
- **Image Processing Pipeline**: Room layout extraction, scene understanding with YOLO v8, MiDaS, and SAM
- **Text Processing Pipeline**: Base structure generation with Shap-E, GET3D, and alternative models
- **3D Designer Agent**: Specialized agent for processing images and text descriptions

**Key Technologies**: Three.js, WebGL/WebGPU, WebXR, TensorFlow.js, NeRF-based models

#### Machine Learning Infrastructure
The ML infrastructure provides a comprehensive framework for model management:

- **Model Context Protocol (MCP) Server**: Centralizes model management and optimizes inference performance
- **OCR Enhancements**: Provides specialized text extraction with multi-language support and layout analysis
- **Training API**: Supports transfer learning, hyperparameter optimization, and distributed training
- **Vector Database Integration**: Leverages Supabase Vector for embedding storage and similarity search

**Key Technologies**: FastAPI, TensorFlow/PyTorch, Tesseract OCR, Supabase pgvector, Redis

### Technical Architecture

#### Frontend Architecture
- **Core Technologies**: Gatsby, React, TypeScript, Material-UI, Three.js, Socket.io-client
- **Key Components**: Authentication UI, Material Browser, Recognition Demo, MoodBoard Feature, 3D Designer, WebXR Integration

#### Backend Architecture
- **Core Technologies**: Node.js/Express, TypeScript, MongoDB, Supabase, Redis, Python
- **Key Services**: API Server, Authentication System, Recognition Pipeline, Knowledge Base Backend, PDF Processing, Queue System, MCP Server

#### Database Architecture
- **Technologies**: Supabase PostgreSQL with pgvector, MongoDB, Redis
- **Key Components**: Material Collection, User Database, Vector Indices, Relationship Database, Version History

#### Infrastructure and Deployment
- **Technologies**: Kubernetes, Docker, Flux, Helm Charts, Terraform, Digital Ocean
- **Deployment Components**: API Server, Coordinator, ML Services, Infrastructure Components, Specialized Services

### Performance and Scalability

The platform implements numerous optimizations for performance:

- **Vector Search Optimization**: HNSW indices, efficient operations, and caching for fast similarity search
- **3D Rendering Efficiency**: BVH optimization, LOD management, occlusion culling, and WebGPU acceleration
- **ML Inference Optimization**: Model caching, batching, and the MCP server architecture
- **Distributed Processing**: Queue-based task distribution and asynchronous processing
- **Database Optimization**: Appropriate indexing, query optimization, and connection pooling
- **Caching Strategies**: Multi-level caching with Redis for frequent operations
- **Kubernetes Scaling**: Horizontal pod scaling, resource management, and load balancing

### System Workflows

#### Material Recognition Workflow
1. User uploads image → Recognition processing → ML feature extraction and classification → Confidence fusion → Results displayed
2. Results are integrated with knowledge base → Vector search finds similar materials → Relationships highlighted → Recommendations generated
3. User feedback loop improves model accuracy over time

#### 3D Visualization Process
1. User initiates 3D view → ThreeJs scene generation → Materials applied → Optimizations (BVH, LOD) applied
2. WebXR integration enables immersive viewing in VR/AR with device-specific optimizations
3. Vector search facilitates real-time material swapping with instant rendering updates

#### Agent Interaction Flow
1. User queries agent → CrewAI processes input → Relevant tools activated → MCP provides inference → Response generated
2. Agents access knowledge base through vector search and context assembly for comprehensive responses
3. Specialized agents collaborate to combine expertise into coherent solutions

## License

MIT