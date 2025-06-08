+++
# --- Basic Metadata ---
id = "ROO-COMMANDER-MIGRATION-GUIDE-V1"
title = "Roo Commander Project Migration Guide"
context_type = "documentation"
scope = "Complete guide for migrating Roo Commander to new projects"
target_audience = ["developers", "project-managers", "system-administrators"]
granularity = "detailed"
status = "active"
created_date = "2025-06-08"
updated_date = "2025-06-08"
version = "1.0"
tags = ["roo-commander", "migration", "setup", "installation", "configuration", "guide"]

# --- Ownership & Context ---
author = "util-writer"
related_docs = [
    ".ruru/templates/toml-md/README.md",
    ".roo/rules/01-standard-toml-md-format.md",
    ".roo/rules/11-session-management.md"
]

# --- Document Type Specific Fields ---
difficulty = "intermediate"
estimated_time = "~2-4 hours"
prerequisites = [
    "Basic understanding of file systems and directory structures",
    "Familiarity with Git version control",
    "Understanding of project configuration files"
]
learning_objectives = [
    "Understand the complete Roo Commander architecture",
    "Successfully migrate all essential components",
    "Configure Roo Commander for a new project",
    "Verify proper installation and functionality"
]

# --- AI Interaction Hints ---
template_schema_doc = ".ruru/templates/toml-md/09_documentation.README.md"
relevance = "High: Essential for Roo Commander adoption"
+++

# Roo Commander Project Migration Guide

## Overview 🎯

This comprehensive guide provides step-by-step instructions for migrating Roo Commander to a new project. Roo Commander is a sophisticated AI-powered project management and development coordination system that uses specialized modes, rules, templates, and workflows to enhance development productivity.

**What is Roo Commander?**
Roo Commander is an advanced AI assistant framework that provides:
- **Specialized AI Modes**: Over 100+ specialized modes for different development tasks
- **MDTM (Markdown-Driven Task Management)**: Structured task tracking using TOML+Markdown
- **Session Management**: Comprehensive logging and artifact management
- **Rule-Based Workflows**: Standardized procedures and best practices
- **Template System**: Consistent document and file structures

## Prerequisites ✅

Before starting the migration, ensure you have:

- [ ] Administrative access to the target project directory
- [ ] Git repository initialized in the target project
- [ ] Understanding of your project's existing structure
- [ ] Backup of your current project (recommended)

## Migration Checklist 📋

### Phase 1: Essential Core Components (Required)

#### 1.1 Core Rule System
**Source:** `.roo/` directory
**Destination:** `.roo/` (root of target project)

**Required Files:**
- [ ] `.roo/rules/` - Core system rules (ALL files)
- [ ] `.roo/rules-roo-commander/` - Roo Commander specific rules
- [ ] `.roo/rules-prime-coordinator/` - Prime Coordinator rules
- [ ] `.roo/rules-util-writer/` - Technical Writer rules (if using documentation features)

**Purpose:** These directories contain the fundamental rules that govern how Roo Commander operates, including workflow procedures, tool usage standards, and mode-specific behaviors.

#### 1.2 Core Infrastructure
**Source:** `.ruru/` directory
**Destination:** `.ruru/` (root of target project)

**Required Subdirectories:**
- [ ] `.ruru/templates/` - All template files and schemas
- [ ] `.ruru/modes/` - Mode definitions and knowledge bases
- [ ] `.ruru/docs/` - Core documentation and standards
- [ ] `.ruru/context/` - AI context sources and references

**Purpose:** The `.ruru` directory contains the operational infrastructure including templates for consistent document creation, mode-specific configurations, and contextual information for AI assistants.

### Phase 2: Operational Directories (Recommended)

#### 2.1 Task and Session Management
**Create these directories in target project:**
- [ ] `.ruru/tasks/` - MDTM task files
- [ ] `.ruru/sessions/` - Session logs and artifacts
- [ ] `.ruru/decisions/` - Architecture Decision Records (ADRs)
- [ ] `.ruru/planning/` - Project planning documents

#### 2.2 Workflow and Process Management
**Create these directories in target project:**
- [ ] `.ruru/workflows/` - Complex workflow definitions
- [ ] `.ruru/processes/` - Standard Operating Procedures
- [ ] `.ruru/reports/` - Generated reports and summaries
- [ ] `.ruru/logs/` - System and operation logs

### Phase 3: Mode-Specific Components (Optional but Recommended)

#### 3.1 Development Modes
Copy mode-specific rule directories based on your project needs:

**Frontend Development:**
- [ ] `.roo/rules-dev-react/` - React development rules
- [ ] `.roo/rules-framework-nextjs/` - Next.js specific rules
- [ ] `.roo/rules-design-tailwind/` - Tailwind CSS rules
- [ ] `.roo/rules-util-typescript/` - TypeScript rules

**Backend Development:**
- [ ] `.roo/rules-dev-python/` - Python development rules
- [ ] `.roo/rules-framework-fastapi/` - FastAPI rules
- [ ] `.roo/rules-data-specialist/` - Database management rules

**DevOps and Infrastructure:**
- [ ] `.roo/rules-infra-compose/` - Docker Compose rules
- [ ] `.roo/rules-cloud-aws/` - AWS deployment rules
- [ ] `.roo/rules-lead-devops/` - DevOps coordination rules

#### 3.2 Specialized Modes
**Quality Assurance:**
- [ ] `.roo/rules-test-e2e/` - End-to-end testing rules
- [ ] `.roo/rules-util-reviewer/` - Code review rules
- [ ] `.roo/rules-lead-qa/` - QA coordination rules

**Documentation and Content:**
- [ ] `.roo/rules-util-writer/` - Technical writing rules
- [ ] `.roo/rules-design-ui/` - UI/UX design rules

## Step-by-Step Migration Process 🚀

### Step 1: Prepare Target Project

1. **Navigate to your target project directory:**
   ```bash
   cd /path/to/your/target/project
   ```

2. **Ensure Git is initialized:**
   ```bash
   git init  # if not already initialized
   ```

3. **Create a migration branch (recommended):**
   ```bash
   git checkout -b feature/roo-commander-migration
   ```

### Step 2: Copy Core Components

1. **Copy the entire `.roo` directory:**
   ```bash
   # From the source Roo Commander project
   cp -r /path/to/source/project/.roo /path/to/target/project/
   ```

2. **Copy the entire `.ruru` directory:**
   ```bash
   # From the source Roo Commander project
   cp -r /path/to/source/project/.ruru /path/to/target/project/
   ```

### Step 3: Configure for Your Project

#### 3.1 Update User Preferences
Edit `.roo/rules/00-user-preferences.md`:

```toml
# --- User Information ---
user_name = "YourName" # << Update with your name >>
skills = [
    "your-primary-skills",  # << Add your skills >>
    "relevant-technologies"
]

# --- Roo Usage Preferences ---
[roo_usage_preferences]
preferred_modes = [
    "mode-slugs-you-use-most"  # << Customize based on your workflow >>
]
preferred_language = "en"  # << Set your preferred language >>
```

#### 3.2 Customize Mode Selection
Review and remove unused mode rule directories from `.roo/rules-*` to keep only what's relevant to your project.

#### 3.3 Update Project-Specific Paths
Search for any hardcoded paths in configuration files and update them to match your project structure.

### Step 4: Initialize Directory Structure

Create the operational directories:

```bash
# Create task management directories
mkdir -p .ruru/tasks
mkdir -p .ruru/sessions
mkdir -p .ruru/decisions
mkdir -p .ruru/planning

# Create workflow directories
mkdir -p .ruru/workflows
mkdir -p .ruru/processes
mkdir -p .ruru/reports
mkdir -p .ruru/logs

# Create archive and snippet directories
mkdir -p .ruru/archive
mkdir -p .ruru/snippets
```

### Step 5: Verify Installation

#### 5.1 Check Directory Structure
Verify that your project now has the following structure:

```
your-project/
├── .roo/
│   ├── rules/
│   ├── rules-roo-commander/
│   ├── rules-prime-coordinator/
│   └── [other mode-specific rules]/
├── .ruru/
│   ├── templates/
│   ├── modes/
│   ├── docs/
│   ├── context/
│   ├── tasks/
│   ├── sessions/
│   ├── decisions/
│   └── [other operational directories]/
└── [your existing project files]
```

#### 5.2 Test Template System
Create a test document using a template:

```bash
# Copy a template to test
cp .ruru/templates/toml-md/09_documentation.md test-doc.md
```

Edit the TOML frontmatter and verify the format works correctly.

#### 5.3 Validate TOML Syntax
Ensure all TOML frontmatter in copied files uses proper syntax with `+++` delimiters.

## Configuration Files to Modify 🔧

### Essential Configuration Updates

#### 1. User Preferences (`.roo/rules/00-user-preferences.md`)
- Update `user_name` field
- Customize `preferred_modes` array
- Set language preferences
- Configure verbosity and execution preferences

#### 2. Mode-Specific Knowledge Bases
Review and update knowledge base files in `.ruru/modes/[mode-name]/kb/` directories:
- Update project-specific examples
- Modify file paths and references
- Customize guidelines for your project standards

#### 3. Template Customization
Modify templates in `.ruru/templates/toml-md/` to match your project:
- Update default values in TOML frontmatter
- Customize Markdown structure for your needs
- Add project-specific sections or requirements

## Dependencies and Prerequisites 📦

### System Requirements
- **Operating System**: Windows, macOS, or Linux
- **Git**: Version 2.0 or higher
- **Text Editor**: VS Code recommended (with TOML and Markdown extensions)
- **Shell Access**: PowerShell (Windows) or Bash/Zsh (macOS/Linux)

### Optional Dependencies
- **Node.js**: If using JavaScript/TypeScript development modes
- **Python**: If using Python development modes
- **Docker**: If using containerization workflows
- **Cloud CLI Tools**: If using cloud deployment modes (AWS CLI, Azure CLI, etc.)

### Recommended VS Code Extensions
- **TOML Language Support**: For editing configuration files
- **Markdown All in One**: For enhanced Markdown editing
- **GitLens**: For Git integration and history
- **File Tree Generator**: For documentation purposes

## Troubleshooting Common Issues 🔧

### Issue 1: TOML Parsing Errors
**Symptoms:** Error messages about invalid TOML syntax
**Solution:** 
- Ensure all TOML blocks use `+++` delimiters
- Check for unescaped quotes in string values
- Validate array syntax uses square brackets `[]`

### Issue 2: Missing Template Files
**Symptoms:** References to non-existent template files
**Solution:**
- Verify all files in `.ruru/templates/` were copied correctly
- Check file permissions and accessibility
- Update any custom references to template paths

### Issue 3: Mode-Specific Rules Not Working
**Symptoms:** AI modes not following expected behaviors
**Solution:**
- Ensure corresponding rule directories were copied
- Verify knowledge base files are present in `.ruru/modes/`
- Check for project-specific path references that need updating

### Issue 4: Session Management Issues
**Symptoms:** Session logging not working properly
**Solution:**
- Verify `.ruru/sessions/` directory exists and is writable
- Check session template files are present
- Ensure session artifact subdirectories are created

## Post-Migration Verification ✅

### Verification Checklist

#### Core System Verification
- [ ] All rule directories copied successfully
- [ ] Template system accessible and functional
- [ ] TOML+Markdown format working correctly
- [ ] Mode-specific configurations present

#### Operational Verification
- [ ] Can create new MDTM tasks using templates
- [ ] Session management directories created
- [ ] Documentation templates accessible
- [ ] ADR (Architecture Decision Record) system ready

#### Integration Verification
- [ ] Git integration working (files tracked properly)
- [ ] No conflicts with existing project structure
- [ ] File permissions set correctly
- [ ] All paths and references updated for new project

### Test Workflow
1. **Create a test MDTM task:**
   ```bash
   cp .ruru/templates/toml-md/01_mdtm_feature.md .ruru/tasks/TEST-MIGRATION-001.md
   ```

2. **Edit the task file** with project-specific information

3. **Verify TOML parsing** by checking syntax highlighting and validation

4. **Test session creation** by creating a session directory structure

## Maintenance and Updates 🔄

### Regular Maintenance Tasks

#### Weekly
- [ ] Review and clean up completed tasks in `.ruru/tasks/`
- [ ] Archive old session logs to `.ruru/archive/`
- [ ] Update user preferences if workflow changes

#### Monthly
- [ ] Review and update mode-specific knowledge bases
- [ ] Clean up unused template files
- [ ] Update documentation for project-specific customizations

#### Quarterly
- [ ] Review and update rule configurations
- [ ] Evaluate new modes that might benefit the project
- [ ] Update dependencies and system requirements

### Keeping Up with Updates
- Monitor the source Roo Commander project for updates
- Selectively merge relevant improvements
- Maintain project-specific customizations separately
- Document any custom modifications for future reference

## Advanced Configuration Options ⚙️

### Custom Mode Development
If you need project-specific modes:

1. **Create mode directory structure:**
   ```bash
   mkdir -p .ruru/modes/your-custom-mode/kb
   mkdir -p .roo/rules-your-custom-mode
   ```

2. **Define mode rules** following existing patterns

3. **Create knowledge base files** for mode-specific guidance

### Workflow Customization
Customize workflows in `.ruru/workflows/` for your specific processes:

- Development workflows
- Deployment procedures
- Code review processes
- Documentation standards

### Integration with External Tools
Configure integrations with:
- **CI/CD Systems**: GitHub Actions, Jenkins, etc.
- **Project Management**: Jira, Linear, etc.
- **Communication**: Slack, Discord, etc.
- **Monitoring**: Datadog, New Relic, etc.

## Security Considerations 🔒

### File Permissions
- Ensure `.roo/` and `.ruru/` directories have appropriate read/write permissions
- Restrict access to sensitive configuration files
- Use `.gitignore` to exclude sensitive data if needed

### Sensitive Information
- Avoid storing API keys or secrets in configuration files
- Use environment variables for sensitive configuration
- Consider encrypting sensitive knowledge base content

### Access Control
- Implement proper Git branch protection
- Control who can modify core rule files
- Establish approval processes for configuration changes

## Support and Resources 📚

### Documentation References
- **TOML Specification**: For understanding configuration syntax
- **Markdown Guide**: For content formatting standards
- **Git Documentation**: For version control best practices

### Community and Support
- Review existing issues and solutions in the source project
- Document your customizations for team knowledge sharing
- Contribute improvements back to the community when possible

### Training and Onboarding
- Create project-specific onboarding documentation
- Train team members on Roo Commander workflows
- Establish best practices for your organization

---

## Summary 💡

Successfully migrating Roo Commander to your project involves:

1. **Copying core components** (`.roo/` and `.ruru/` directories)
2. **Configuring user preferences** and project-specific settings
3. **Selecting relevant modes** for your development stack
4. **Creating operational directories** for tasks and sessions
5. **Verifying installation** through testing and validation
6. **Maintaining the system** with regular updates and cleanup

The migration provides your project with a powerful AI-assisted development framework that enhances productivity through structured workflows, consistent documentation, and intelligent task management.

**Next Steps:**
- Begin using MDTM for task tracking
- Implement session management for complex work
- Customize templates for your project needs
- Train your team on Roo Commander workflows

For additional support or questions about specific configurations, refer to the detailed documentation in `.ruru/docs/` or consult the mode-specific knowledge bases in `.ruru/modes/`.