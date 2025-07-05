# Roo Commander: Advanced Multi-Agent Framework

## Overview

Roo Commander is an advanced multi-agent framework that orchestrates specialized AI agents within VS Code using a governance-first approach. This comprehensive guide covers everything from the embedded governance framework to complete usage workflows, along with the underlying Kai system architecture.

## Table of Contents

1. [Governance Framework](#governance-framework)
2. [Usage Guide](#usage-guide)
3. [System Architecture](#system-architecture)
4. [Available Specialist Modes](#available-specialist-modes)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Governance Framework

### How Governance Works

Governance in enhanced roo-commander is embedded directly in each mode's `customInstructions` within the `roleDefinition` field. This ensures that every mode automatically follows governance principles without requiring external files or configurations.

### Governance Principles

Each mode includes these governance instructions:

- **TASK-DRIVEN**: Only work on explicitly authorized tasks with clear scope
- **USER-CONTROLLED**: User maintains final decision-making authority  
- **QUALITY-FOCUSED**: Validate all work against defined success criteria
- **DOCUMENTATION**: Maintain clear documentation of all changes and decisions
- **SCOPE-LIMITED**: Stay within defined task boundaries, no scope creep
- **COLLABORATIVE**: Coordinate with other modes when tasks require multiple specialties

### Using Governance-Enhanced Modes

1. Select appropriate mode for your task
2. Clearly define task scope and success criteria
3. The mode will automatically follow governance principles
4. Review results against your defined criteria
5. Approve or request modifications as needed

### Validation Checklist

- [ ] Task clearly defined and authorized
- [ ] Appropriate mode selected
- [ ] Success criteria established
- [ ] Results meet quality standards
- [ ] Documentation maintained

### Implementation Details

#### Governance Text Format

The governance framework is embedded in each mode's `roleDefinition` using this standardized format:

```
GOVERNANCE: TASK-DRIVEN - Only work on explicitly authorized tasks. USER-CONTROLLED - User maintains decision authority. QUALITY-FOCUSED - Validate all work against success criteria. DOCUMENTATION - Maintain clear documentation. SCOPE-LIMITED - Stay within task boundaries. COLLABORATIVE - Coordinate with other modes when needed.
```

#### Benefits of Embedded Governance

1. **No External Dependencies**: Governance rules are built into each mode
2. **Consistent Application**: Every mode follows the same governance principles
3. **Simple Configuration**: No additional setup or configuration files needed
4. **Automatic Compliance**: Modes inherently follow governance without external enforcement
5. **Maintainable**: Easy to update governance across all modes

#### Troubleshooting

**Issue**: Mode not following governance principles
**Solution**: Verify the governance text is properly embedded in the mode's `roleDefinition`

**Issue**: Inconsistent governance behavior
**Solution**: Check that all modes have the same governance text format

**Issue**: Mode exceeding scope boundaries
**Solution**: Clearly define task scope and remind the mode of SCOPE-LIMITED principle

### Best Practices

1. **Clear Task Definition**: Always provide explicit task boundaries and success criteria
2. **Regular Review**: Periodically review mode outputs against governance principles
3. **Documentation**: Maintain clear records of all decisions and changes
4. **Collaboration**: Encourage modes to coordinate when tasks span multiple specialties
5. **User Control**: Always maintain final decision-making authority

### Examples

#### Good Task Definition
```
Task: Update the user authentication system to support OAuth2
Scope: Modify login/logout functionality only
Success Criteria: OAuth2 integration working, existing users unaffected
Documentation: Update API docs and user guide
```

#### Poor Task Definition
```
Task: Fix the website
```

The governance framework ensures that modes will request clarification for poorly defined tasks and stay within appropriate boundaries.

---

## Memory System Architecture

### Overview

Roo Commander implements a sophisticated four-layer memory system that provides persistent context and gets reviewed before taking any actions. This memory system ensures continuity, traceability, and informed decision-making across all interactions.

### Four-Layer Memory Architecture

#### 1. **Session Management V7**
- **Purpose**: Tracks overall user interaction narratives and goals
- **Components**:
  - **Session Log** (`session_log.md`): TOML+Markdown format with timestamped events
  - **Artifact Management**: Organized contextual notes in standardized subdirectories
  - **Session Directory Structure**: `.ruru/sessions/SESSION-[Goal]-[Timestamp]/`
- **Memory Persistence**:
  - Chronological event logging with timestamps
  - Links to related tasks and artifacts
  - Structured metadata for easy retrieval
- **Review Process**: Active session context is automatically loaded and referenced before actions

#### 2. **MDTM (Markdown-Driven Task Management)**
- **Purpose**: Tracks specific work units and their progress
- **Components**:
  - **Task Files**: TOML+Markdown format with structured metadata
  - **Progress Tracking**: Checklist items with completion status
  - **Task Relationships**: Links between related tasks and coordinators
- **Memory Persistence**:
  - Task status and progress history
  - Decision records and implementation notes
  - Cross-references to related documentation
- **Review Process**: Task context and history reviewed before continuing work

#### 3. **Knowledge Base & Rules System**
- **Purpose**: Stores operational procedures, best practices, and domain knowledge
- **Components**:
  - **Rules** (`.roo/rules/`): Standardized procedures and workflows
  - **Mode Knowledge Bases** (`.ruru/modes/[mode]/kb/`): Specialist domain knowledge
  - **Templates** (`.ruru/templates/`): Structured document templates
- **Memory Persistence**:
  - Versioned rule sets with change tracking
  - Mode-specific expertise and procedures
  - Reusable templates for consistent documentation
- **Review Process**: Relevant rules and KB articles consulted before task execution

#### 4. **Documentation & Decisions**
- **Purpose**: Maintains architectural decisions and project documentation
- **Components**:
  - **ADRs** (Architecture Decision Records): Formal decision documentation
  - **Project Documentation**: Technical specifications and guides
  - **Context Sources**: External references and research
- **Memory Persistence**:
  - Immutable decision records with rationale
  - Versioned documentation with change history
  - Searchable knowledge repository
- **Review Process**: Historical decisions and documentation reviewed for consistency

### Memory Review Process

Before taking any action, Roo Commander modes follow this memory review workflow:

#### 1. **Context Loading**
- Load active session information if available
- Retrieve relevant MDTM task context
- Identify applicable rules and procedures
- Gather related documentation and decisions

#### 2. **Relevance Assessment**
- Analyze current request against historical context
- Identify potential conflicts or dependencies
- Determine if previous decisions impact current work
- Assess if existing patterns or solutions apply

#### 3. **Informed Decision Making**
- Synthesize current request with historical context
- Apply relevant rules and best practices
- Consider architectural decisions and constraints
- Plan approach based on accumulated knowledge

#### 4. **Action Execution**
- Execute planned actions with full context awareness
- Update relevant memory systems with new information
- Log decisions and outcomes for future reference
- Maintain consistency with established patterns

### Memory System Benefits

#### **Continuity**
- Seamless handoffs between sessions and modes
- Preserved context across interruptions
- Consistent approach to similar problems

#### **Traceability**
- Complete audit trail of decisions and actions
- Clear relationships between tasks and outcomes
- Searchable history for debugging and analysis

#### **Learning**
- Accumulated expertise from previous interactions
- Pattern recognition for improved efficiency
- Continuous improvement of procedures and approaches

#### **Quality Assurance**
- Consistency with established standards
- Validation against previous decisions
- Prevention of contradictory implementations

### Activating Memory Features

#### **Session Management**
```bash
# Sessions are automatically initiated by coordinator modes
# when complex, multi-step work is detected
```

#### **MDTM Task Tracking**
```bash
# Tasks are created automatically for:
# - Complex implementations
# - Multi-specialist coordination
# - High-risk changes
# - Auditable work
```

#### **Knowledge Base Access**
```bash
# Rules and KB articles are automatically consulted
# based on task type and mode specialization
```

### Memory System Files and Locations

#### **Session Files**
- **Session Logs**: `.ruru/sessions/SESSION-[ID]/session_log.md`
- **Artifacts**: `.ruru/sessions/SESSION-[ID]/artifacts/[type]/`
- **Templates**: `.ruru/templates/toml-md/19_mdtm_session.md`

#### **Task Management**
- **Task Files**: `.ruru/tasks/[CATEGORY]/TASK-[ID].md`
- **Templates**: `.ruru/templates/toml-md/01_mdtm_feature.md`

#### **Knowledge Base**
- **Global Rules**: `.roo/rules/`
- **Mode Knowledge**: `.ruru/modes/[mode-slug]/kb/`
- **Templates**: `.ruru/templates/toml-md/`

#### **Documentation**
- **ADRs**: `.ruru/docs/decisions/`
- **Project Docs**: `.ruru/docs/`
- **Context Sources**: `.ruru/docs/context/`

### Best Practices for Memory Usage

#### **For Users**
1. **Provide Clear Goals**: Help the system understand your objectives for better context building
2. **Reference Previous Work**: Mention related previous sessions or tasks when relevant
3. **Review Session Summaries**: Check session artifacts to understand what was accomplished
4. **Maintain Consistency**: Use established patterns and decisions when possible

#### **For Coordinators**
1. **Session Initiation**: Start sessions for complex or long-running work
2. **Context Linking**: Connect related tasks and decisions explicitly
3. **Progress Logging**: Maintain detailed logs of significant events and decisions
4. **Knowledge Updates**: Update rules and KB articles based on learnings

#### **For Specialists**
1. **Context Review**: Always review relevant memory before starting work
2. **Progress Updates**: Keep MDTM tasks and session logs current
3. **Decision Documentation**: Record significant decisions and rationale
4. **Pattern Recognition**: Leverage previous solutions for similar problems

---

## Usage Guide

### Core Concepts

#### 1. **Governance-First Approach**
- All modes operate under embedded governance principles
- Tasks are user-controlled and scope-limited
- Quality-focused with comprehensive documentation
- Collaborative coordination between specialized modes

#### 2. **MDTM (Markdown-Driven Task Management)**
- Structured task files using TOML+Markdown format
- Clear tracking of progress, status, and ownership
- Persistent documentation of decisions and outcomes

#### 3. **Session Management**
- Optional structured logging for complex interactions
- Artifact management for contextual information
- Traceability across related tasks and decisions

### Step-by-Step Usage Workflow

#### Phase 1: Initial Setup and Planning

##### 1.1 Start Roo Commander
```bash
# In VS Code terminal, navigate to your project directory
cd your-project-directory

# Launch Roo Commander (assuming it's installed)
roo-commander
```

##### 1.2 Define Your Goal
- Clearly articulate what you want to accomplish
- Consider scope, complexity, and governance requirements
- Identify if this requires session management for tracking

##### 1.3 Choose Entry Point
- **Simple tasks**: Direct mode interaction
- **Complex projects**: Use `roo-commander` mode for coordination
- **Specialized domains**: Start with appropriate specialist mode

#### Phase 2: Task Creation and Delegation

##### 2.1 Access Roo Commander Mode
```
# Switch to roo-commander mode in VS Code
# This mode handles high-level coordination and delegation
```

##### 2.2 Describe Your Requirements
Provide clear, specific requirements:
```
"I need to implement a user authentication system with the following requirements:
- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Security audit compliance
- Performance optimization for 10k+ concurrent users"
```

##### 2.3 Roo Commander Creates MDTM Task
The system will:
1. **Generate unique Task ID**: `TASK-AUTH-20250605-203000`
2. **Select appropriate template**: Feature implementation template
3. **Create task file**: `.ruru/tasks/FEATURE_Authentication/TASK-AUTH-20250605-203000.md`
4. **Populate metadata**:
   ```toml
   +++
   id = "TASK-AUTH-20250605-203000"
   title = "Implement User Authentication System"
   status = "🟡 To Do"
   type = "🌟 Feature"
   assigned_to = "security-specialist"
   coordinator = "TASK-CMD-20250605-202900"
   priority = "high"
   tags = ["authentication", "security", "jwt", "performance"]
   +++
   ```

##### 2.4 Task Delegation
Roo Commander delegates to appropriate specialist:
- **Security Specialist**: For authentication and security aspects
- **Performance Specialist**: For optimization requirements
- **SRE Veteran**: For scalability and monitoring
- **Policy Enforcer**: For compliance validation

#### Phase 3: Specialist Mode Execution

##### 3.1 Specialist Receives Task
The assigned specialist mode:
1. **Reads the MDTM task file**
2. **Analyzes requirements and checklist items**
3. **Plans implementation approach**
4. **Begins execution following governance principles**

##### 3.2 Implementation Process
```markdown
# Example checklist progression in MDTM task:
- [✅] Analyze security requirements
- [✅] Design JWT token structure
- [🔄] Implement password hashing
- [ ] Create role-based middleware
- [ ] Add security audit logging
- [ ] Performance testing and optimization
```

##### 3.3 Progress Updates
Specialist modes update:
- **Checklist items**: Mark completed items with ✅
- **Status field**: Update from "🟡 To Do" to "🔄 In Progress"
- **Session logs**: Add detailed progress notes if session is active
- **Artifacts**: Create contextual documentation

#### Phase 4: Coordination and Review

##### 4.1 Checkpoint Reporting
Specialists report back to coordinator:
```
"✅ Completed JWT implementation and password hashing (MDTM items #1-3). 
Next step is to implement role-based middleware. 
Modified: src/auth/jwt.js, src/auth/password.js"
```

##### 4.2 Cross-Specialist Coordination
For complex tasks requiring multiple specialists:
1. **Security Specialist** → Implements core authentication
2. **Performance Specialist** → Optimizes for scale
3. **SRE Veteran** → Adds monitoring and reliability
4. **Policy Enforcer** → Validates compliance

##### 4.3 Quality Gates
Each specialist ensures:
- **Code quality**: Follows best practices and standards
- **Documentation**: Comprehensive inline and external docs
- **Testing**: Appropriate test coverage
- **Security**: Vulnerability assessment and mitigation
- **Performance**: Meets scalability requirements

#### Phase 5: Integration and Completion

##### 5.1 Final Integration
Coordinator oversees:
- **Component integration**: Ensuring all parts work together
- **End-to-end testing**: Comprehensive system validation
- **Documentation compilation**: Aggregating all documentation
- **Deployment preparation**: Ready for production deployment

##### 5.2 Task Completion
Final steps:
1. **Update MDTM status**: Change to "🟢 Done"
2. **Complete session log**: If session was active
3. **Archive artifacts**: Organize contextual materials
4. **Generate summary**: Comprehensive completion report

---

## System Architecture

### Kai - Material Recognition & Knowledge Base System

Kai is a comprehensive full-stack application for material recognition and catalog management, with particular focus on tile materials. The system enables identification, cataloging, and searching for materials using machine learning.

### Services, Modules, and Features of the Kai Platform

#### Front-End Features

##### 1. User Management
- **Profile Management**: User profiles with customizable fields (username, email, name, avatar)
- **Preference System**: Theme settings (light/dark/system), notification preferences, email frequency settings, view preferences (grid/list)
- **Authentication UI**: Login, registration, password reset flows with social authentication options
- **Session Management**: Token handling, "Remember Me" functionality

##### 2. Material Recognition
- **Image Upload Interface**: Upload images to identify materials 
- **Results Display**: Confidence scores visualization, similarity metrics, recognized material details
- **Similar Materials Suggestions**: UI for browsing similar materials based on recognition
- **Feedback Mechanisms**: Users can provide feedback on recognition accuracy

##### 3. Knowledge Base UI
- **Material Browser**: Interface for exploring the material database
- **Search Interface**: Combined text and vector search UI with filters
- **Material Details View**: Comprehensive information display for materials
- **Material Relationships**: Visual representation of related materials

##### 4. MoodBoard Feature
- **Collection Management**: Create, edit, and delete material collections
- **Visibility Controls**: Public/private settings for boards
- **Organizational Tools**: Add, remove, arrange materials in collections
- **Annotation System**: Notes and labels for saved materials
- **Sharing Interface**: Controls for sharing collections with others

##### 5. Catalog Management
- **PDF Uploader**: Interface for uploading material catalogs
- **Processing Status**: Visual indicators of extraction progress
- **Results Review**: Interface for reviewing and correcting extracted content

##### 6. 3D Designer
- **Room Layout Controls**: Interface for specifying room measurements and features
- **Furniture Placement UI**: Tools for adding and arranging furniture
- **3D Visualization**: Interactive 3D view of designed spaces
- **Material Application**: UI for applying materials to surfaces
- **Physics Validation**: Feedback on realistic object placement

##### 7. WebXR Integration
- **VR/AR Mode Toggles**: Controls for switching between viewing modes
- **Interaction Controls**: UI elements for manipulating objects in VR/AR
- **Scene Manipulation**: Tools for navigating and adjusting the 3D environment

#### Back-End Services

##### 1. Authentication System
- **Identity Management**: User creation, authentication, and authorization
- **Social Authentication**: Integration with Google, Facebook, Twitter providers
- **Token Management**: JWT handling, refresh tokens, session persistence
- **Password Security**: Secure storage, reset workflows, strength validation
- **Role-Based Access Control**: Permission management for different user types

##### 2. Recognition Pipeline
- **Vector-Based Recognition**: Uses feature vectors for material matching
- **Confidence Scoring**: Sophisticated scoring based on vector similarity
- **Feature Extraction**: Converts images to feature vectors for matching
- **Feedback Processing**: Collects and incorporates user feedback on results
- **Accuracy Analytics**: Tracks and reports on recognition performance

##### 3. Knowledge Base Backend
- **Material Database**: Comprehensive storage of material information
- **Vector Search Engine**: Semantic similarity search using feature vectors
- **Text Search System**: Traditional keyword-based search capabilities
- **Hybrid Search Algorithm**: Combines text and vector approaches
- **Relationship Management**: Maintains connections between related materials

##### 4. Catalog Processing
- **PDF Extraction Engine**: Parses catalog PDFs for content
- **OCR Processing**: Extracts text from catalog images
- **Batch Management**: Handles multiple catalogs simultaneously
- **Output Validation**: Ensures quality of extracted content

##### 5. 3D Processing
- **Layout Generation Engine**: Creates room layouts from specifications
- **Furniture Placement Algorithms**: Automated furniture arrangement
- **Physics Validation Engine**: Ensures realistic object placement
- **Material Mapping**: Applies materials to 3D surfaces

##### 6. Agent System
- **Recognition Assistant**: Helps with material identification
- **3D Designer Agent**: Assists with design tasks
- **Material Expert**: Provides detailed material knowledge
- **Session Management**: Maintains context across interactions
- **WebSocket Communication**: Real-time agent communication

##### 7. Queue System
- **Job Management**: Handles background processing tasks
- **Priority Handling**: Manages task priorities
- **Error Recovery**: Handles failed jobs with retry mechanisms
- **Status Reporting**: Provides job status updates

#### Architectural Components

##### 1. Model Context Protocol (MCP)
- **Centralized Model Management**: Standardized interface for ML models
- **Inference Optimization**: Efficient model execution
- **Context Management**: Maintains state across operations
- **Agent Communication**: Facilitates agent interactions
- **Feature Extraction**: Standardized extraction of material features

##### 2. Database Architecture
- **Supabase Integration**: Primary database with vector capabilities
- **Connection Pooling**: Optimized database connections
- **Query Caching**: Performance improvements for repeated queries
- **Vector Storage**: Specialized storage for similarity searches

##### 3. API Layer
- **RESTful Endpoints**: Comprehensive API for all features
- **Rate Limiting**: Prevents API abuse with tiered limits
- **Authentication Middleware**: Secure API access
- **Error Handling**: Standardized error responses

##### 4. WebSocket System
- **Real-Time Updates**: Instant notifications of system events
- **Queue Monitoring**: Live updates on job progress
- **Training Progress**: Real-time training metrics
- **Agent Communication**: Interactive agent dialogues

##### 5. Storage Management
- **File Storage**: Handles uploads and storage
- **S3 Integration**: Scalable storage solution
- **Image Processing**: Optimizes and transforms images
- **Access Control**: Manages file permissions

##### 6. Monitoring & Analytics
- **Health Checks**: System health monitoring
- **Performance Metrics**: Tracks system performance
- **Error Logging**: Captures and analyzes errors
- **Resource Monitoring**: Tracks system resource usage

#### Component Interconnections

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

### System Health Monitoring

Kai includes comprehensive health monitoring capabilities:

- **Health Endpoints**: Basic `/health` and detailed `/health/detailed` endpoints for monitoring
- **Environment Validation**: Automatic validation of required environment variables
- **Rate Limiting**: Specialized rate limiting for different API endpoints
- **Monitoring Dashboard**: Admin panel for system monitoring with logs, errors, and metrics

---

## Available Specialist Modes

### Core Development Modes
- **dev-react**: React/frontend development
- **dev-python**: Python backend development
- **dev-node**: Node.js development
- **dev-typescript**: TypeScript development

### Specialized Domain Modes (New)
- **🔧 SRE Veteran**: Site reliability, infrastructure, monitoring
- **🔒 Security Specialist**: Security auditing, vulnerability assessment
- **⚡ Performance Specialist**: Performance optimization, profiling
- **⚖️ Policy Enforcer**: Governance validation, compliance

### Coordination Modes
- **roo-commander**: High-level project coordination
- **prime-coordinator**: Advanced coordination and planning
- **manager-project**: Project management and oversight

---

## Best Practices

### 1. **Clear Requirements**
- Provide specific, measurable requirements
- Include acceptance criteria
- Specify governance and compliance needs
- Define performance and scalability targets

### 2. **Appropriate Mode Selection**
- Use **roo-commander** for complex, multi-faceted projects
- Choose **specialist modes** for domain-specific tasks
- Leverage **coordination modes** for project management

### 3. **Governance Compliance**
- All tasks follow governance-first principles
- Regular compliance validation through Policy Enforcer
- Comprehensive documentation and audit trails
- Quality gates at each phase

### 4. **Session Management**
- Use sessions for complex, long-running projects
- Maintain artifact organization
- Ensure traceability across related tasks
- Regular checkpoint reporting

### 5. **Iterative Execution**
- Break complex tasks into manageable chunks
- Regular progress reporting and validation
- Continuous integration and testing
- Adaptive planning based on outcomes

## Example Workflows

### Simple Feature Implementation
```
User Request → roo-commander → dev-react → Implementation → Completion
```

### Complex System Implementation
```
User Request → roo-commander → Session Creation → 
Multiple MDTM Tasks → Specialist Coordination → 
Integration → Validation → Completion
```

### Security-Critical Feature
```
User Request → roo-commander → security-specialist → 
policy-enforcer (validation) → performance-specialist → 
sre-veteran (monitoring) → Integration → Completion
```

---

## Troubleshooting

### Common Issues
1. **Task not progressing**: Check MDTM task file for blockers
2. **Mode conflicts**: Use roo-commander for coordination
3. **Governance violations**: Consult Policy Enforcer mode
4. **Performance issues**: Engage Performance Specialist

### Getting Help
- Consult mode-specific knowledge bases in `.ruru/modes/[mode-slug]/kb/`
- Review governance guide at `docs/governance-guide.md`
- Check session logs for detailed interaction history
- Use `ask_followup_question` tool for clarification

---

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

For detailed setup instructions, deployment guides, and development workflows, see the deployment documentation.

---

## Conclusion

Roo Commander provides a powerful, governance-first approach to software development through specialized AI agents. By following this workflow, you ensure high-quality, compliant, and well-documented implementations that meet both functional and non-functional requirements.

The key to success is clear communication of requirements, appropriate mode selection, and leveraging the governance framework to maintain quality and compliance throughout the development process.

## License

MIT