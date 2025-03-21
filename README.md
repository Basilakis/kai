# Kai - Tile Recognition System

A full-stack application for tile recognition with comprehensive capabilities for managing tile catalogs, extracting information from PDFs, and identifying tiles from images.

## Features

- Upload and process PDF catalogs containing tile images and specifications
- Extract images and metadata from PDFs using OCR
- Build a searchable knowledge base of tile information
- Enable users to upload images to identify matching tiles
- Admin functionality for system management
- Web crawling for additional data collection

## Technical Stack

- **Frontend**: Gatsby/React
- **Backend**: Node.js
- **Database**: MongoDB
- **Deployment**: Vercel
- **Storage**: AWS S3
- **Email**: AWS SES
- **Authentication**: OAuth
- **Machine Learning**: Hybrid approach using OpenCV and TensorFlow/PyTorch
- **Web Crawling**: FireCrawl.dev and Jina.ai
- **Message Broker**: Supabase Realtime for pub/sub queue communication

## Project Structure

This project is organized as a monorepo with the following packages:

- `packages/client`: Frontend Gatsby/React application
- `packages/server`: Backend Node.js API
- `packages/ml`: Machine learning modules for image recognition
- `packages/shared`: Shared utilities and types
- `packages/admin`: Admin panel for system management

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- Yarn (v1.22 or higher)
- MongoDB
- Supabase Project (for Realtime pub/sub)
- AWS Account (for S3 and SES)
- Python 3.8+ (for ML components)

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   yarn install
   ```
3. Set up environment variables (see `.env.example` files in each package)
4. Start the development servers:
   ```
   yarn dev
   ```

## Development

Each package can be developed independently or as part of the entire system:

- To run a specific package:
  ```
  yarn workspace <package-name> dev
  ```

- To build all packages:
  ```
  yarn build
  ```

- To run tests:
  ```
  yarn test
  ```

## Architecture

### Knowledge Base

The Knowledge Base is a central repository of material specifications, imagery, and metadata that powers the search and recognition capabilities of the system.

#### Current Status:
- Basic structure implemented
- Needs enhancement for full searchable database capabilities
- Requires complete tagging system for organizing tiles by collections/series
- Planned integration with ML models, PDF processing, and web crawling data

#### Implementation Plan:
A detailed phased implementation plan is available in the project documentation at `packages/shared/src/docs/implementation-plans.md`. This plan outlines:
- Data structure and schema enhancements
- Tagging and organization system implementation
- ML integration layer development
- PDF processing and web crawling integration
- Versioning system and admin interfaces
- Optimization and quality assurance measures

Future plans also include an Agent Framework integration for conversational interaction with the Knowledge Base.

### Queue System

The system uses Supabase Realtime for message brokering between different queue systems:

#### PDF Processing Queue
Handles PDF catalog processing with automatic image and text extraction.

#### Web Crawler Queue
Manages web crawling jobs with configurable providers and data extraction.

#### Message Broker
The Supabase Realtime-based pub/sub system allows for:
- Real-time communication between queues
- Event-based job status updates
- Cross-queue coordination for complex workflows
- Improved scalability by decoupling queue systems
- Native integration with Supabase deployments

#### Queue Architecture Components:
- **Supabase Client** (`supabaseClient.ts`): Manages Supabase connections with support for error handling. Provides real-time subscription capabilities.
- **Message Broker** (`messageBroker.ts`): Core component that handles message routing between queues using Supabase channels. Supports multiple channels for different queue types and message types.
- **Queue Adapters** (`queueAdapter.ts`): Bridge between queue implementations and the message broker. Standardizes the interface for both PDF and Crawler queues.
- **Event Handlers**: Process events from other queues for coordinated workflows.

#### Integration with Queues:
The PDF and Web Crawler queues have been integrated with the message broker to:
- Publish events at key points in the job lifecycle (creation, progress updates, completion, errors)
- Subscribe to events from other queues to coordinate workflows
- Maintain their existing file-based persistence alongside the pub/sub capabilities

#### Real-time Admin Updates:
The admin panel connects directly to Supabase Realtime for real-time updates:
- **Client-side Supabase** (`supabaseClient.ts`): Handles Realtime subscriptions for job updates
- **Queue Events Service** (`queueEvents.service.ts`): Provides a standardized interface for subscribing to queue events
- **QueueDashboard**: Enhanced with live updates to display real-time status changes without manual refreshing

Each queue publishes events like job creation, status changes, and completion notifications. Other queues subscribe to these events to trigger dependent processes or update their own state, creating a fully integrated system while maintaining independence between queue implementations.

## License

MIT