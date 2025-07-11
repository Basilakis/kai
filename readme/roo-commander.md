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

## Session Management V7 & Project-Wide Memory System

### Overview

Roo Commander implements a comprehensive **Session Management V7** system with project-wide memory capabilities that provides persistent context, automatic memory consolidation, and intelligent context loading. This system ensures continuity, traceability, and informed decision-making across all interactions while maintaining a complete project memory that evolves over time.

### Core Architecture: Four-Layer Memory System

#### 1. **Session Management V7 (Active Memory)**
**Purpose**: Tracks real-time user interactions and maintains active context

**Components**:
- **Session Log** (`session_log.md`): TOML+Markdown format with timestamped events
- **Artifact Management**: Organized contextual notes in 12 standardized subdirectories
- **Session Directory Structure**: `.ruru/sessions/SESSION-[Goal]-[Timestamp]/`
- **Session State Management**: Persistent tracking of active sessions via `.ruru/state/`

**Memory Features**:
- **Automatic Session Detection**: Coordinator modes detect when complex work requires session tracking
- **Real-time Event Logging**: All significant events logged with timestamps and context
- **Artifact Organization**: Structured storage in subdirectories (notes/, learnings/, environment/, docs/, research/, blockers/, questions/, snippets/, feedback/, features/, context/, deferred/)
- **Cross-Session Linking**: Sessions can reference and build upon previous sessions
- **Session State Persistence**: Active session information maintained across interactions

#### 2. **Project Memory (Persistent Context)**
**Purpose**: Maintains long-term project knowledge and patterns across sessions

**Components**:
- **Project Memory Store** (`.ruru/context/project_memory/`): Cross-session insights and patterns
- **Memory Consolidation**: Automatic extraction of key insights from completed sessions
- **Pattern Recognition**: Identification and storage of successful approaches and solutions
- **Project Evolution Tracking**: Historical view of project development and decision evolution

**Memory Features**:
- **Session Consolidation**: Key insights from sessions automatically extracted to project memory
- **Pattern Storage**: Successful approaches and solutions stored for reuse
- **Context Inheritance**: New sessions automatically load relevant project memory
- **Decision Continuity**: Architectural and strategic decisions maintained across sessions
- **Learning Accumulation**: Project-wide learning from all interactions and outcomes

#### 3. **MDTM (Markdown-Driven Task Management)**
**Purpose**: Tracks specific work units and their detailed progress

**Components**:
- **Task Files**: TOML+Markdown format with structured metadata and progress tracking
- **Task Relationships**: Links between related tasks, coordinators, and sessions
- **Progress History**: Complete audit trail of task evolution and completion
- **Cross-Task Dependencies**: Management of complex multi-task workflows

**Memory Features**:
- **Detailed Progress Tracking**: Checklist items with completion status and notes
- **Task Context Preservation**: Full context maintained for task resumption
- **Cross-Task Learning**: Insights from completed tasks inform future similar work
- **Specialist Coordination**: Clear handoffs and context sharing between specialist modes

#### 4. **Knowledge Base & Rules System (Operational Memory)**
**Purpose**: Stores operational procedures, best practices, and domain knowledge

**Components**:
- **Global Rules** (`.roo/rules/`): Workspace-wide procedures and standards
- **Mode Knowledge Bases** (`.ruru/modes/[mode]/kb/`): Specialist domain expertise
- **Templates** (`.ruru/templates/`): Structured document templates for consistency
- **Mode-Specific Context** (`.ruru/modes/[mode]/context/`): Persistent mode memory

**Memory Features**:
- **Versioned Knowledge**: Rule sets and procedures with change tracking
- **Specialist Expertise**: Mode-specific knowledge bases for domain specialization
- **Template Standardization**: Consistent document structures across the project
- **Contextual Guidance**: Relevant knowledge automatically consulted based on task type

### Automatic Memory Operations

#### **Session Initiation & Management**
```
1. Intent Detection: Coordinator modes detect complex/multi-step work
2. User Prompting: Optional session creation with goal specification
3. Session Creation: Automatic directory structure and artifact organization
4. State Persistence: Active session tracking in .ruru/state/active_session.txt
5. Context Loading: Previous relevant sessions and project memory loaded
```

#### **Real-Time Memory Updates**
```
1. Event Logging: All significant events logged to session_log.md
2. Artifact Creation: Contextual notes organized in appropriate subdirectories
3. Progress Tracking: MDTM task updates with completion status
4. Cross-References: Automatic linking between related tasks and artifacts
5. Memory Consolidation: Key insights extracted for project memory
```

#### **Context-Aware Decision Making**
```
1. Memory Review: Active session, project memory, and relevant knowledge consulted
2. Pattern Recognition: Previous solutions and approaches identified
3. Consistency Checking: Decisions validated against historical context
4. Informed Planning: Approach planned based on accumulated knowledge
5. Continuous Learning: Outcomes fed back into memory systems
```

### Manual Memory Addition Capabilities

#### **1. Command-Based Memory Addition**
**Session Memory Commands**:
```bash
/memory add note "Key insight about authentication implementation"
/memory add learning "React hooks pattern works better than class components"
/memory add decision "Chose PostgreSQL over MongoDB for data consistency"
/memory add blocker "API rate limiting preventing bulk operations"
/memory add research "Found better approach using WebSockets for real-time updates"
```

**Project Memory Commands**:
```bash
/memory project add pattern "Authentication flow using JWT + refresh tokens"
/memory project add guideline "Always use TypeScript for new components"
/memory project add lesson "Database migrations require careful rollback planning"
/memory project add standard "Use Prettier + ESLint configuration from .eslintrc"
```

**Mode-Specific Memory Commands**:
```bash
/memory mode react add "Custom hooks should be prefixed with 'use'"
/memory mode security add "Always validate input at API boundaries"
/memory mode performance add "Use React.memo for expensive component renders"
```

#### **2. Interactive Memory Management**
**Memory Addition Prompts**:
- Coordinator modes can prompt users to add specific insights to memory
- Context-aware suggestions based on current work and previous patterns
- Guided memory creation with templates for different types of insights

**Memory Review Sessions**:
- Periodic prompts to review and consolidate session artifacts
- Guided extraction of key learnings and patterns
- User-directed memory organization and categorization

#### **3. Template-Based Memory Creation**
**Decision Templates**:
```markdown
# Decision: [Title]
**Context**: What situation led to this decision
**Options**: What alternatives were considered
**Decision**: What was chosen and why
**Rationale**: Detailed reasoning and trade-offs
**Impact**: Expected effects and monitoring plan
```

**Learning Templates**:
```markdown
# Learning: [Title]
**Situation**: What was being worked on
**Challenge**: What problem was encountered
**Solution**: How it was resolved
**Insight**: What was learned for future reference
**Applicability**: When this learning applies
```

**Pattern Templates**:
```markdown
# Pattern: [Title]
**Problem**: What recurring issue this pattern solves
**Solution**: The reusable approach or implementation
**Context**: When and where to apply this pattern
**Examples**: Specific instances where this was used
**Variations**: Different ways to implement this pattern
```

#### **4. File-Based Direct Memory Addition**
**Direct File Creation**:
- Users can create memory files directly in appropriate directories
- Automatic detection and integration of manually created memory files
- Support for both structured (TOML+Markdown) and unstructured memory files

**Memory File Locations**:
```
Session Memory:
- .ruru/sessions/SESSION-[ID]/artifacts/notes/NOTE-[topic]-[timestamp].md
- .ruru/sessions/SESSION-[ID]/artifacts/learnings/LEARNING-[topic]-[timestamp].md
- .ruru/sessions/SESSION-[ID]/artifacts/decisions/DECISION-[topic]-[timestamp].md

Project Memory:
- .ruru/context/project_memory/patterns/PATTERN-[name]-[version].md
- .ruru/context/project_memory/guidelines/GUIDELINE-[topic]-[version].md
- .ruru/context/project_memory/lessons/LESSON-[topic]-[timestamp].md

Mode Memory:
- .ruru/modes/[mode-slug]/context/[topic]-[version].md
```

#### **5. Memory Search and Retrieval**
**Search Commands**:
```bash
/memory search "authentication patterns"
/memory find session "user management implementation"
/memory lookup project "database migration strategies"
/memory query mode react "state management approaches"
```

**Memory Analytics**:
```bash
/memory stats                    # Overall memory usage statistics
/memory patterns                 # Most frequently used patterns
/memory recent                   # Recently added memory items
/memory gaps                     # Areas lacking documentation
```

### Project-Wide Memory Features

#### **Memory Consolidation Workflow**
1. **Session Completion**: When sessions end, key insights automatically extracted
2. **Pattern Recognition**: Successful approaches identified and stored as reusable patterns
3. **Knowledge Integration**: New insights integrated with existing project memory
4. **Cross-Session Learning**: Patterns and solutions made available to future sessions
5. **Memory Evolution**: Project memory continuously refined and improved

#### **Context-Aware Session Initiation**
1. **Historical Analysis**: Previous sessions and project memory analyzed for relevance
2. **Pattern Matching**: Similar previous work identified and loaded as context
3. **Continuity Planning**: Approach planned based on accumulated project knowledge
4. **Intelligent Defaults**: Session configuration based on project patterns and preferences
5. **Proactive Guidance**: Suggestions based on previous successful approaches

#### **Multi-Layer Memory Integration**
1. **Session ↔ Project**: Session insights feed into project memory; project memory informs sessions
2. **Task ↔ Knowledge**: MDTM tasks reference and update knowledge base articles
3. **Mode ↔ Global**: Mode-specific memory integrates with global project patterns
4. **Decision ↔ Implementation**: Architectural decisions linked to implementation artifacts
5. **Learning ↔ Practice**: Accumulated learnings automatically applied to new work

### Memory System Benefits

#### **Continuity & Context**
- **Seamless Handoffs**: Complete context preservation between sessions and modes
- **Interrupted Work Recovery**: Ability to resume complex work exactly where left off
- **Cross-Session Learning**: Insights from previous work automatically available
- **Pattern Reuse**: Successful approaches automatically suggested for similar work

#### **Traceability & Audit**
- **Complete History**: Full audit trail of all decisions, actions, and outcomes
- **Decision Rationale**: Clear reasoning preserved for all significant choices
- **Change Tracking**: Evolution of project decisions and approaches over time
- **Impact Analysis**: Understanding of how decisions affected project outcomes

#### **Learning & Improvement**
- **Accumulated Expertise**: Project knowledge grows with each interaction
- **Pattern Recognition**: Automatic identification of successful approaches
- **Continuous Improvement**: Procedures and approaches refined based on outcomes
- **Knowledge Sharing**: Insights available across all modes and specialists

#### **Quality & Consistency**
- **Standard Adherence**: Automatic validation against established patterns
- **Decision Consistency**: New decisions validated against historical context
- **Best Practice Application**: Proven approaches automatically suggested
- **Error Prevention**: Previous mistakes and solutions inform current work

### Memory System Implementation

#### **Session State Management**
```
Files:
- .ruru/state/active_session.txt          # Current active session ID
- .ruru/state/session_registry.json       # All sessions metadata
- .ruru/state/memory_index.json           # Cross-references and search index

Session Lifecycle:
1. Detection → User Prompt → Creation → State Persistence → Context Loading
2. Active Logging → Artifact Management → Progress Tracking → Cross-Linking
3. Completion → Consolidation → Project Memory Update → State Cleanup
```

#### **Project Memory Organization**
```
Structure:
.ruru/context/project_memory/
├── patterns/           # Reusable solution patterns
├── guidelines/         # Project-specific guidelines
├── lessons/           # Accumulated learnings
├── decisions/         # Cross-session decision continuity
├── standards/         # Established project standards
├── workflows/         # Proven process workflows
├── integrations/      # External system integration knowledge
└── evolution/         # Project development history

Consolidation Process:
1. Session Analysis → Key Insight Extraction → Pattern Recognition
2. Memory Integration → Conflict Resolution → Knowledge Refinement
3. Index Updates → Cross-Reference Maintenance → Search Optimization
```

#### **Memory Access Patterns**
```
Automatic Loading:
- Session initiation loads relevant project memory and previous session context
- Task delegation includes applicable patterns and previous similar work
- Decision points reference historical decisions and established patterns
- Error handling consults previous solutions and troubleshooting approaches

Manual Access:
- Command-based memory search and retrieval
- Interactive memory browsing and exploration
- Template-guided memory creation and organization
- Direct file-based memory management and editing
```

### Getting Started with Memory Features

#### **For New Projects**
1. **Initial Session**: Start with session creation to establish project memory foundation
2. **Pattern Establishment**: Document initial patterns and approaches as they're developed
3. **Decision Recording**: Capture architectural and strategic decisions with full context
4. **Learning Documentation**: Record insights and lessons as the project evolves

#### **For Existing Projects**
1. **Memory Bootstrap**: Create initial project memory from existing documentation
2. **Pattern Extraction**: Identify and document existing successful patterns
3. **Decision Archaeology**: Capture historical decisions and their rationale
4. **Knowledge Migration**: Move existing knowledge into structured memory format

#### **For Daily Usage**
1. **Session Awareness**: Let coordinator modes manage session creation automatically
2. **Memory Contribution**: Add insights and learnings as they occur during work
3. **Pattern Recognition**: Notice when previous solutions apply to current work
4. **Memory Review**: Periodically review and organize accumulated memory

The Session Management V7 system with project-wide memory creates a comprehensive, intelligent memory system that learns and evolves with your project, providing unprecedented continuity, context awareness, and accumulated expertise for all development work.

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