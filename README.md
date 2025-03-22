# Kai - Material Recognition & Knowledge Base System

Kai is a comprehensive full-stack application for material recognition and catalog management, with particular focus on tile materials. The system provides advanced capabilities for managing material catalogs, extracting information from PDFs, building a searchable knowledge base, and identifying materials from images using machine learning.

![Kai System](https://via.placeholder.com/800x400?text=Kai+Material+Recognition+System)

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Development](#development)
- [Core Subsystems](#core-subsystems)
  - [Knowledge Base](#knowledge-base)
  - [Material Recognition](#material-recognition)
  - [PDF Processing](#pdf-processing)
  - [Queue System](#queue-system)
  - [Web Crawling](#web-crawling)
- [Advanced Features](#advanced-features)
  - [Vector Search](#vector-search)
  - [Confidence Fusion](#confidence-fusion)
  - [Entity Linking](#entity-linking)
  - [Version History](#version-history)
- [Implementation Roadmap](#implementation-roadmap)
- [API Reference](#api-reference)
- [Admin Panel](#admin-panel)
- [Client Applications](#client-applications)
- [License](#license)

## Overview

Kai enables businesses and individuals to identify, catalog, and search for materials (particularly tiles) using advanced computer vision and machine learning techniques. The system can extract detailed information from PDF catalogs, build a rich knowledge base of material specifications, and recognize materials from user-uploaded images.

## Key Features

### Material Recognition
- **Multi-Strategy Recognition**: Hybrid approach using feature-based detection and neural networks
- **Confidence Fusion**: Combine results from multiple recognition methods for improved accuracy
- **Vector Similarity Search**: Find visually similar materials using embedding vectors
- **Enhanced OCR**: Extract text from material images with specialized OCR optimizations

### Knowledge Base
- **Comprehensive Material Data**: Store detailed specifications, imagery, and metadata
- **Versioning System**: Track changes to material information over time
- **Relationship Management**: Define and manage relationships between materials
- **Advanced Search**: Full-text, vector, and metadata-based search capabilities
- **Tagging System**: Organize materials with hierarchical taxonomy

### PDF Processing
- **Automated Extraction**: Extract images, text, and structured data from PDF catalogs
- **Layout Analysis**: Understand the structure of catalog pages for better extraction
- **Text-Image Association**: Connect extracted text with corresponding images
- **Metadata Extraction**: Identify and extract key specification fields

### Data Collection & Management
- **Web Crawling**: Collect material data from manufacturer websites
- **Bulk Operations**: Import, update, export, and delete materials in bulk
- **Quality Assurance**: Automated checks for data consistency and correctness
- **Collection Management**: Organize materials into collections and series

### Client Features
- **Material Upload**: Allow users to upload images for material identification
- **Search Interface**: Search the knowledge base by text, image, or filters
- **Comparison Tools**: Compare specifications of different materials
- **User Collections**: Save favorites and create custom collections

### Admin Capabilities
- **System Dashboard**: Monitor system status and performance
- **Data Management**: Comprehensive CRUD interfaces for all entities
- **Queue Management**: Monitor and manage processing queues
- **Analytics**: Track system usage and performance metrics

## System Architecture

Kai is built as a microservices-based application with the following high-level architecture:

```
┌────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│                │     │                  │     │                  │
│  Client Apps   │────▶│  API Services    │────▶│  Knowledge Base  │
│  (Web/Mobile)  │     │  (Node.js)       │     │  (MongoDB)       │
│                │     │                  │     │                  │
└────────────────┘     └──────────────────┘     └──────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌───────────────────┐
                       │                  │    │                   │
                       │  Queue System    │───▶│  Search Indexes   │
                       │  (Supabase)      │    │  (Vector/Text)    │
                       │                  │    │                   │
                       └──────────────────┘    └───────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │                  │
                       │  ML Services     │
                       │  (Python)        │
                       │                  │
                       └──────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: Gatsby/React for client, Next.js for admin
- **UI**: Custom components with responsive design
- **State Management**: React Context for local state
- **Data Fetching**: Axios, SWR for API communication

### Backend
- **API**: Node.js with Express
- **Database**: MongoDB for primary data storage
- **Authentication**: OAuth 2.0 and JWT
- **Real-time**: Supabase Realtime for pub/sub

### Machine Learning
- **Computer Vision**: OpenCV for feature extraction
- **Neural Networks**: TensorFlow/PyTorch for deep learning models
- **OCR**: Enhanced Tesseract with custom post-processing
- **Vector DB**: FAISS for efficient similarity search

### Infrastructure
- **Deployment**: Vercel for frontend, cloud services for backend
- **Storage**: AWS S3 for file storage
- **Email**: AWS SES for transactional emails
- **Web Crawling**: FireCrawl.dev and Jina.ai for data collection

## Project Structure

Kai is organized as a monorepo with the following packages:

- **packages/client**: Frontend Gatsby/React application for end users
- **packages/admin**: Admin panel built with Next.js
- **packages/server**: Backend Node.js API and services
- **packages/ml**: Machine learning modules for image recognition and processing
- **packages/shared**: Shared utilities, types, and constants

## Installation

### Prerequisites

- **Node.js**: v16 or higher
- **Yarn**: v1.22 or higher
- **MongoDB**: For data storage
- **Python**: 3.8+ (for ML components)
- **Supabase Project**: For Realtime pub/sub
- **AWS Account**: For S3 and SES (optional for development)

### Initial Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/kai.git
   cd kai
   ```

2. **Install dependencies:**
   ```bash
   yarn install
   ```

3. **Set up environment variables:**
   Copy the example environment files in each package directory and fill in the required values:
   ```bash
   # For each package
   cp packages/[package-name]/.env.example packages/[package-name]/.env
   ```

4. **Set up Python environment for ML package:**
   ```bash
   cd packages/ml
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

5. **Initialize database:**
   ```bash
   yarn workspace @kai/server db:init
   ```

### Starting the Development Environment

To start all services for development:

```bash
yarn dev
```

To run specific packages:

```bash
yarn workspace @kai/client dev  # Run client app
yarn workspace @kai/admin dev   # Run admin app
yarn workspace @kai/server dev  # Run server
```

## Development

### Code Standards

- TypeScript for type safety
- ESLint for code linting
- Prettier for code formatting
- Jest for unit testing
- React Testing Library for component tests

### Useful Commands

```bash
# Build all packages
yarn build

# Run tests
yarn test

# Lint code
yarn lint

# Clean build artifacts
yarn clean
```

### Creating a New Feature

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Implement your changes, ensuring tests pass: `yarn test`
3. Submit a pull request for review

## Core Subsystems

### Knowledge Base

The Knowledge Base is the central repository of material information in Kai. It stores comprehensive data about materials, their properties, and relationships.

#### Features:
- **Material Storage**: Detailed specifications, images, and metadata
- **Collections**: Group materials by manufacturer, series, etc.
- **Versioning**: Track changes to material data over time
- **Relationships**: Define connections between related materials
- **Search**: Multiple search strategies (text, vector, metadata)

#### Implementation Status:
- Basic structure implemented
- Currently in Phase 1 of enhancement (see Implementation Roadmap)
- Planned integration with ML models, PDF processing, and crawled data

### Material Recognition

The Material Recognition system identifies materials from images using a hybrid approach that combines feature-based techniques and deep learning.

#### Recognition Strategies:
- **Feature-Based**: Uses computer vision algorithms to extract and match visual features
- **Neural Network**: Deep learning models trained on material image datasets
- **Hybrid Approach**: Combines results from both methods using confidence fusion
- **Vector Search**: Finds similar materials using embedding vectors

#### ML Models:
- MobileNetV2 for classification
- Custom feature extractors for visual similarity
- Specialized models for texture and pattern recognition

### PDF Processing

The PDF Processing system extracts images, text, and structured data from material catalogs.

#### Capabilities:
- **Image Extraction**: Identify and extract material images
- **Text Extraction**: OCR for text content
- **Layout Analysis**: Understand page structure
- **Metadata Mapping**: Convert extracted data to knowledge base schema

#### Processing Pipeline:
1. PDF parsing and page segmentation
2. Image extraction and enhancement
3. OCR with specialized post-processing
4. Text-image association
5. Structured data extraction
6. Knowledge base integration

### Queue System

The Queue System manages asynchronous processing tasks using Supabase Realtime for message brokering.

#### Queue Types:
- **PDF Processing Queue**: Handles PDF catalog processing
- **Web Crawler Queue**: Manages web crawling jobs
- **ML Training Queue**: Coordinates model training tasks

#### Architecture Components:
- **Supabase Client**: Manages connections and error handling
- **Message Broker**: Routes messages between queues
- **Queue Adapters**: Standardize interface for different queue types
- **Event Handlers**: Process events for coordinated workflows

### Web Crawling

The Web Crawling system collects material data from manufacturer websites.

#### Features:
- **Configurable Crawlers**: Support for multiple crawling strategies
- **Authentication Support**: Handle authenticated websites
- **Data Extraction**: Extract structured data from web pages
- **Scheduling**: Periodic crawling of configured sources

#### Supported Providers:
- FireCrawl.dev for JavaScript-heavy sites
- Jina.ai for advanced content extraction
- Custom crawler implementations

## Advanced Features

### Vector Search

Vector search enables finding visually similar materials using embedding vectors.

#### Implementation:
- Generate embeddings for all materials in the database
- Create efficient search indexes using FAISS
- Support for similarity thresholds and filtering

#### Usage Example:
```typescript
const similarMaterials = await searchSimilarMaterials('models/search_index.faiss', 'path/to/query.jpg', {
  numResults: 5,
  threshold: 0.7
});
```

### Confidence Fusion

Confidence fusion combines results from multiple recognition methods to improve accuracy.

#### Fusion Methods:
- **Weighted Average**: Combine scores with configurable weights
- **Adaptive Fusion**: Adjust weights based on confidence
- **Maximum Score**: Use the highest confidence score
- **Product Fusion**: Multiply confidence scores

#### Usage Example:
```typescript
const enhancedResults = await recognizeMaterialEnhanced('path/to/image.jpg', {
  useFusion: true,
  fusionMethod: 'adaptive',
  fusionAlpha: 0.5,
  confidenceThreshold: 0.6,
  maxResults: 5
});
```

### Entity Linking

Entity linking identifies references to other materials or collections in text descriptions.

#### Capabilities:
- Identify material and collection mentions
- Create relationships based on context
- Enhance search with entity connections

### Version History

The version history system tracks changes to material data over time.

#### Features:
- Record all changes with user attribution
- Revert to previous versions
- Compare different versions
- Audit trail for compliance

## Implementation Roadmap

### Phase 1: Knowledge Base Enhancement (Current)

1. **Data Structure & Schema Implementation** (Weeks 1-2)
   - Comprehensive schema for material specifications
   - Full-text search with relevance scoring
   - Relationship modeling between entities

2. **Tagging & Organization System** (Weeks 2-3)
   - Hierarchical taxonomy for categorization
   - Tag management with parent-child relationships
   - Bulk tagging capabilities

3. **ML Integration Layer** (Weeks 3-5)
   - Data pipeline between knowledge base and ML training
   - Feedback loop from recognition results
   - Feature vector storage for specifications

4. **PDF Processing Integration** (Weeks 5-7)
   - Extractors for structured material data
   - Mapping between PDF data and knowledge base schema
   - Validation workflows for extraction

5. **Web Crawling Integration** (Weeks 7-9)
   - Parsers for manufacturer websites
   - Normalization for web-extracted data
   - Deduplication with existing entries

6. **Versioning System** (Weeks 9-10)
   - Temporal data model for changes
   - Differential storage for history
   - Rollback capabilities

7. **Index Optimization** (Weeks 10-11)
   - Specialized indexes for common queries
   - Caching layer for frequent access
   - Performance monitoring

8. **Admin Interface** (Weeks 11-13)
   - CRUD interfaces for all entities
   - Dashboard for system health
   - User permission system

9. **Quality Assurance System** (Weeks 13-14)
   - Automated consistency checks
   - Anomaly detection for suspect values
   - Confidence scoring for entries

10. **Integration Testing & Deployment** (Weeks 14-16)
    - Comprehensive test suite
    - Performance testing
    - Production deployment

### Phase 2: Agent Framework Integration (Future)

1. **Agent Framework Foundation**
   - Core agent infrastructure setup
   - Conversation state management
   - Logging and monitoring infrastructure

2. **Knowledge Base Connector**
   - Vector representation of content
   - Semantic search capabilities
   - Context retrieval strategies

3. **ML Model Integration**
   - API wrappers for ML services
   - Multi-modal reasoning
   - Explanation generation for decisions

4. **Natural Language Understanding**
   - Domain-specific entity recognition
   - Specialized intent detection
   - Query reformulation for ambiguity

5. **Conversation Management**
   - Stateful conversation tracking
   - Clarification workflows
   - Response templating system

6. **UI Integration**
   - Conversational UI components
   - Multi-modal input support
   - Responsive and accessible design

7. **Testing & Optimization**
   - Comprehensive test suite
   - Performance optimization
   - Continuous improvement pipeline

8. **Deployment & Rollout**
   - Phased rollout strategy
   - User onboarding
   - Analytics dashboard

## API Reference

### Material Recognition

```typescript
// Recognize materials in an image
const result = await recognizeMaterial('path/to/image.jpg', {
  modelType: 'hybrid',
  confidenceThreshold: 0.6,
  maxResults: 5
});

// Enhanced recognition with confidence fusion
const enhancedResult = await recognizeMaterialEnhanced('path/to/image.jpg', {
  useFusion: true,
  fusionMethod: 'adaptive',
  fusionAlpha: 0.5,
  confidenceThreshold: 0.6,
  maxResults: 5
});
```

### Knowledge Base

```typescript
// Search for materials
const searchResults = await knowledgeBaseService.searchMaterials({
  query: 'ceramic tile',
  materialType: 'tile',
  tags: ['porcelain', 'outdoor'],
  limit: 10,
  skip: 0,
  useVectorSearch: false,
  searchStrategy: 'combined'
});

// Get collections with material counts
const collections = await knowledgeBaseService.getCollections({
  parentId: 'parent-collection-id',
  includeEmpty: false,
  limit: 20
});

// Create a material revision
const updatedMaterial = await knowledgeBaseService.createMaterialRevision(
  'material-id',
  { name: 'Updated Name', description: 'New description' },
  'user-id'
);
```

### PDF Processing

```typescript
// Extract from a PDF catalog
const result = await extractFromPDF('path/to/catalog.pdf', 'output/directory');
console.log(`Extracted ${result.images.length} images and ${result.text.length} text blocks`);
```

## Admin Panel

The Admin Panel provides a comprehensive interface for managing the Kai system:

- **Dashboard**: System status, queue monitoring, and key metrics
- **Materials Management**: CRUD operations for materials and collections
- **Knowledge Base Tools**: Search, versioning, and relationship management
- **Queue Management**: Monitor and control processing queues
- **User Management**: Manage user accounts and permissions
- **Settings**: Configure system parameters and integrations

## Client Applications

The client application provides end-user interfaces for:

- **Material Recognition**: Upload images to identify materials
- **Knowledge Base Search**: Search for materials by text, filters, or image
- **Material Details**: View comprehensive material specifications
- **User Collections**: Save favorites and create custom collections
- **Comparison Tools**: Compare specifications of different materials

## License

MIT