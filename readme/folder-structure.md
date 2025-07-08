# Kai Project Structure

This document provides a detailed overview of the Kai project structure and how the components work together.

## Directory Structure

```
kai/
├── packages/               # Monorepo packages
│   ├── admin/             # Admin panel (Next.js)
│   │   ├── src/           # Admin source code
│   │   │   ├── components/   # Reusable admin components
│   │   │   ├── pages/        # Admin app pages
│   │   │   └── types/        # TypeScript type definitions
│   │   ├── next.config.js    # Next.js configuration
│   │   ├── package.json      # Admin dependencies
│   │   └── tsconfig.json     # TypeScript configuration
│   │
│   ├── client/            # Client application (Gatsby)
│   │   ├── src/           # Client source code
│   │   │   ├── components/   # UI components
│   │   │   ├── pages/        # Client app pages
│   │   │   ├── providers/    # Context providers
│   │   │   ├── services/     # Client-side services
│   │   │   └── theme/        # Styling theme
│   │   ├── gatsby-config.js  # Gatsby configuration
│   │   ├── package.json      # Client dependencies
│   │   └── tsconfig.json     # TypeScript configuration
│   │
│   ├── ml/                # Machine learning package
│   │   ├── python/        # Python ML scripts
│   │   ├── src/           # TypeScript interfaces to ML
│   │   ├── docs/          # ML documentation
│   │   └── package.json   # ML package dependencies
│   │
│   ├── server/            # Backend server
│   │   ├── src/           # Server source code
│   │   │   ├── controllers/  # API controllers
│   │   │   ├── middleware/   # Express middleware
│   │   │   ├── models/       # Data models
│   │   │   ├── routes/       # API routes
│   │   │   ├── services/     # Business logic services
│   │   │   └── utils/        # Utilities
│   │   ├── scripts/          # Server scripts
│   │   └── package.json      # Server dependencies
│   │
│   └── shared/            # Shared code and types
│       ├── src/           # Shared source code
│       │   ├── types/        # Shared type definitions
│       │   └── utils/        # Shared utilities
│       └── package.json      # Shared dependencies
│
├── types/                # Global type definitions
├── package.json          # Root package.json
├── tsconfig.json         # Root TypeScript config
└── README.md             # Project overview
```

## How Components Work Together

The Kai system is designed as a microservices architecture where each package plays a specific role and communicates with others through well-defined interfaces.

### Component Interactions

1. **Client → Server**: The client application communicates with the server via RESTful API calls to:
   - Upload images for recognition
   - Search the knowledge base
   - View material details
   - Manage user collections

2. **Admin → Server**: The admin panel communicates with the server to:
   - Manage system settings
   - Monitor queues
   - View system analytics
   - Manage materials and collections

3. **Server → ML**: The server communicates with the ML package to:
   - Perform material recognition
   - Generate vector embeddings
   - Train models
   - Process PDFs

4. **Server → Database**: The server stores and retrieves data using Supabase PostgreSQL for:
   - Materials
   - Collections
   - Users
   - Search indexes
   - Processing jobs

5. **Queue System Coordination**: The various queues (PDF, Crawler, ML) coordinate through a message broker to:
   - Trigger dependent processes
   - Report status updates
   - Manage resource allocation

### Data Flow

1. **Material Recognition Flow**:
   ```
   User uploads image → Client → Server → ML System → 
   Recognition Results → Knowledge Base Lookup → 
   Enhanced Results → Server → Client → User Interface
   ```

2. **PDF Processing Flow**:
   ```
   Admin uploads PDF → Admin Panel → Server → PDF Queue → 
   PDF Processor → ML OCR → Text/Image Extraction → 
   Knowledge Base Import → Material Creation
   ```

3. **Search Flow**:
   ```
   User enters search → Client → Server → 
   Knowledge Base Search (Text/Vector/Hybrid) → 
   Results → Client → User Interface
   ```

4. **Web Crawling Flow**:
   ```
   Admin configures crawler → Admin Panel → Server → 
   Crawler Queue → Web Crawler → Data Extraction → 
   Knowledge Base Import → Material Creation
   ```

## Deployment Architecture

The Kai system is deployed as a set of services:

1. **Frontend Services**:
   - Client application deployed on Digital Ocean App Platform
   - Admin panel deployed on Digital Ocean App Platform

2. **Backend Services**:
   - API server deployed on cloud infrastructure
   - ML services deployed on specialized compute instances

3. **Databases**:
   - Supabase PostgreSQL for primary data storage
   - pgvector extension for similarity search

4. **Infrastructure Services**:
   - AWS S3 for file storage
   - Supabase for pub/sub messaging
   - Authentication provider for user management

## Communication Protocols

The system uses the following communication methods:

1. **HTTP/REST**: Primary API communication
2. **WebSockets**: Real-time updates and notifications
3. **Message Queue**: Asynchronous task processing
4. **Database Queries**: Direct data access