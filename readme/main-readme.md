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
- [MoodBoard Feature](./moodboard-feature.md) - Material collection and organization feature

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

## Services, Modules, and Features of the Kai Platform

### Front-End Features

#### 1. User Management
- **Profile Management**: User profiles with customizable fields (username, email, name, avatar)
- **Preference System**: Theme settings (light/dark/system), notification preferences, email frequency settings, view preferences (grid/list)
- **Authentication UI**: Login, registration, password reset flows with social authentication options
- **Session Management**: Token handling, "Remember Me" functionality

#### 2. Material Recognition
- **Image Upload Interface**: Upload images to identify materials 
- **Results Display**: Confidence scores visualization, similarity metrics, recognized material details
- **Similar Materials Suggestions**: UI for browsing similar materials based on recognition
- **Feedback Mechanisms**: Users can provide feedback on recognition accuracy

#### 3. Knowledge Base UI
- **Material Browser**: Interface for exploring the material database
- **Search Interface**: Combined text and vector search UI with filters
- **Material Details View**: Comprehensive information display for materials
- **Material Relationships**: Visual representation of related materials

#### 4. MoodBoard Feature
- **Collection Management**: Create, edit, and delete material collections
- **Visibility Controls**: Public/private settings for boards
- **Organizational Tools**: Add, remove, arrange materials in collections
- **Annotation System**: Notes and labels for saved materials
- **Sharing Interface**: Controls for sharing collections with others

#### 5. Catalog Management
- **PDF Uploader**: Interface for uploading material catalogs
- **Processing Status**: Visual indicators of extraction progress
- **Results Review**: Interface for reviewing and correcting extracted content

#### 6. 3D Designer
- **Room Layout Controls**: Interface for specifying room measurements and features
- **Furniture Placement UI**: Tools for adding and arranging furniture
- **3D Visualization**: Interactive 3D view of designed spaces
- **Material Application**: UI for applying materials to surfaces
- **Physics Validation**: Feedback on realistic object placement

#### 7. WebXR Integration
- **VR/AR Mode Toggles**: Controls for switching between viewing modes
- **Interaction Controls**: UI elements for manipulating objects in VR/AR
- **Scene Manipulation**: Tools for navigating and adjusting the 3D environment

### Back-End Services

#### 1. Authentication System
- **Identity Management**: User creation, authentication, and authorization
- **Social Authentication**: Integration with Google, Facebook, Twitter providers
- **Token Management**: JWT handling, refresh tokens, session persistence
- **Password Security**: Secure storage, reset workflows, strength validation
- **Role-Based Access Control**: Permission management for different user types

#### 2. Recognition Pipeline
- **Vector-Based Recognition**: Uses feature vectors for material matching
- **Confidence Scoring**: Sophisticated scoring based on vector similarity
- **Feature Extraction**: Converts images to feature vectors for matching
- **Feedback Processing**: Collects and incorporates user feedback on results
- **Accuracy Analytics**: Tracks and reports on recognition performance

#### 3. Knowledge Base Backend
- **Material Database**: Comprehensive storage of material information
- **Vector Search Engine**: Semantic similarity search using feature vectors
- **Text Search System**: Traditional keyword-based search capabilities
- **Hybrid Search Algorithm**: Combines text and vector approaches
- **Relationship Management**: Maintains connections between related materials

#### 4. Catalog Processing
- **PDF Extraction Engine**: Parses catalog PDFs for content
- **OCR Processing**: Extracts text from catalog images
- **Batch Management**: Handles multiple catalogs simultaneously
- **Output Validation**: Ensures quality of extracted content

#### 5. 3D Processing
- **Layout Generation Engine**: Creates room layouts from specifications
- **Furniture Placement Algorithms**: Automated furniture arrangement
- **Physics Validation Engine**: Ensures realistic object placement
- **Material Mapping**: Applies materials to 3D surfaces

#### 6. Agent System
- **Recognition Assistant**: Helps with material identification
- **3D Designer Agent**: Assists with design tasks
- **Material Expert**: Provides detailed material knowledge
- **Session Management**: Maintains context across interactions
- **WebSocket Communication**: Real-time agent communication

#### 7. Queue System
- **Job Management**: Handles background processing tasks
- **Priority Handling**: Manages task priorities
- **Error Recovery**: Handles failed jobs with retry mechanisms
- **Status Reporting**: Provides job status updates

### Architectural Components

#### 1. Model Context Protocol (MCP)
- **Centralized Model Management**: Standardized interface for ML models
- **Inference Optimization**: Efficient model execution
- **Context Management**: Maintains state across operations
- **Agent Communication**: Facilitates agent interactions
- **Feature Extraction**: Standardized extraction of material features

#### 2. Database Architecture
- **Supabase Integration**: Primary database with vector capabilities
- **Connection Pooling**: Optimized database connections
- **Query Caching**: Performance improvements for repeated queries
- **Vector Storage**: Specialized storage for similarity searches

#### 3. API Layer
- **RESTful Endpoints**: Comprehensive API for all features
- **Rate Limiting**: Prevents API abuse with tiered limits
- **Authentication Middleware**: Secure API access
- **Error Handling**: Standardized error responses

#### 4. WebSocket System
- **Real-Time Updates**: Instant notifications of system events
- **Queue Monitoring**: Live updates on job progress
- **Training Progress**: Real-time training metrics
- **Agent Communication**: Interactive agent dialogues

#### 5. Storage Management
- **File Storage**: Handles uploads and storage
- **S3 Integration**: Scalable storage solution
- **Image Processing**: Optimizes and transforms images
- **Access Control**: Manages file permissions

#### 6. Monitoring & Analytics
- **Health Checks**: System health monitoring
- **Performance Metrics**: Tracks system performance
- **Error Logging**: Captures and analyzes errors
- **Resource Monitoring**: Tracks system resource usage

### Component Interconnections

1. **Front-End to Back-End**:
   - React/Gatsby front-end communicates with Express backend via REST API
   - Real-time updates flow through WebSocket connections
   - Authentication state managed through Supabase integration

2. **Recognition Flow**:
   - User uploads image → MCP extracts features → Vector search finds matches → Results displayed to user
   - Feedback flows back into system to improve recognition accuracy

3. **3D Visualization Chain**:
   - User selects materials → Applied to 3D models → Rendered through ThreeJS → Optionally viewed in WebXR

4. **Agent Communication Path**:
   - User queries → WebSocket to backend → MCP for model inference → Agent formulates response → WebSocket to front-end

5. **Knowledge Base Integration**:
   - Materials stored in Supabase → Vector embeddings enable similarity search → Connected to recognition system → Powers agent knowledge

6. **Queue System Flow**:
   - Intensive tasks sent to queue → Processed asynchronously → Status updates via WebSockets → Results stored in database

## System Health Monitoring

Kai includes comprehensive health monitoring capabilities:

- **Health Endpoints**: Basic `/health` and detailed `/health/detailed` endpoints for monitoring
- **Environment Validation**: Automatic validation of required environment variables
- **Rate Limiting**: Specialized rate limiting for different API endpoints
- **Monitoring Dashboard**: Admin panel for system monitoring with logs, errors, and metrics

See the [Monitoring System](./monitoring-system.md) documentation for details.

## License

MIT