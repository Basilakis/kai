const fs = require('fs');
const path = require('path');

// Create directories
console.log('Creating directories...');
const dirs = [
  'kai-docs-temp',
  'kai-docs-temp/docs',
  'kai-docs-temp/src/css',
  'kai-docs-temp/static/img'
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Create package.json
console.log('Creating package.json...');
const packageJson = {
  name: "kai-documentation",
  version: "1.0.0",
  private: true,
  scripts: {
    docusaurus: "docusaurus",
    start: "docusaurus start",
    build: "docusaurus build",
    swizzle: "docusaurus swizzle",
    deploy: "docusaurus deploy",
    clear: "docusaurus clear",
    serve: "docusaurus serve",
    "write-translations": "docusaurus write-translations",
    "write-heading-ids": "docusaurus write-heading-ids"
  },
  dependencies: {
    "@docusaurus/core": "3.7.0",
    "@docusaurus/preset-classic": "3.7.0",
    "@mdx-js/react": "3.0.0",
    "clsx": "2.1.0",
    "prism-react-renderer": "2.3.1",
    "react": "18.2.0",
    "react-dom": "18.2.0"
  },
  devDependencies: {
    "@docusaurus/module-type-aliases": "3.7.0",
    "@docusaurus/types": "3.7.0",
    "typescript": "5.3.3"
  }
};

fs.writeFileSync(
  path.join('kai-docs-temp', 'package.json'),
  JSON.stringify(packageJson, null, 2)
);

// Create sidebars.js
console.log('Creating sidebars.js...');
const sidebarsContent = `
const sidebars = {
  docs: [
    {
      type: "category",
      label: "Introduction",
      items: ["introduction"],
    },
    {
      type: "category",
      label: "Getting Started",
      items: ["installation", "configuration"],
    },
    {
      type: "category",
      label: "Features",
      items: ["features-overview"],
    },
    {
      type: "category",
      label: "Prompts",
      items: [
        "prompt-library",
        "prompt-abtesting-segmentation",
        "prompt-advanced-features",
        "prompt-management",
        "prompt-success-tracking",
      ],
    },
    {
      type: "category",
      label: "GitHub Actions",
      items: [
        "github-actions-overview",
        "docs-pr-creator-workflow",
      ],
    },
    {
      type: "category",
      label: "RooCommander",
      items: [
        "roocommander-overview",
        "roocommander-integration",
        "roocommander-workflows",
      ],
    },
  ],
};

module.exports = sidebars;
`;

fs.writeFileSync(
  path.join('kai-docs-temp', 'sidebars.js'),
  sidebarsContent
);

// Create docusaurus.config.js
console.log('Creating docusaurus.config.js...');
const configContent = `
const config = {
  title: "KAI Documentation",
  tagline: "Documentation for the KAI project",
  favicon: "img/favicon.ico",
  url: "https://basilakis.github.io",
  baseUrl: "/",
  organizationName: "Basilakis",
  projectName: "basilakis.github.io",
  trailingSlash: false,
  onBrokenLinks: "ignore",
  onBrokenMarkdownLinks: "ignore",
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.js",
          routeBasePath: "readme",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      },
    ],
  ],
  themeConfig: {
    navbar: {
      title: "KAI Documentation",
      logo: {
        alt: "KAI Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docs",
          position: "left",
          label: "Documentation",
        },
        {
          href: "https://github.com/Basilakis/kai",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      copyright: \`Copyright © \${new Date().getFullYear()} KAI Project.\`,
    },
  },
};

module.exports = config;
`;

fs.writeFileSync(
  path.join('kai-docs-temp', 'docusaurus.config.js'),
  configContent
);

// Create CSS
console.log('Creating CSS...');
const cssContent = `
:root {
  --ifm-color-primary: #2e8555;
  --ifm-color-primary-dark: #29784c;
  --ifm-color-primary-darker: #277148;
  --ifm-color-primary-darkest: #205d3b;
  --ifm-color-primary-light: #33925d;
  --ifm-color-primary-lighter: #359962;
  --ifm-color-primary-lightest: #3cad6e;
  --ifm-code-font-size: 95%;
  --docusaurus-highlighted-code-line-bg: rgba(0, 0, 0, 0.1);
}
`;

fs.writeFileSync(
  path.join('kai-docs-temp', 'src', 'css', 'custom.css'),
  cssContent
);

// Create logo
console.log('Creating logo...');
const logoContent = `<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="#2e8555" />
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="72" fill="white">KAI</text>
</svg>`;

fs.writeFileSync(
  path.join('kai-docs-temp', 'static', 'img', 'logo.svg'),
  logoContent
);

// Create basic docs
console.log('Creating basic docs...');
const docs = [
  {
    name: 'index.md',
    content: `---
id: introduction
title: "Welcome to KAI Documentation"
sidebar_label: "Introduction"
---

# Welcome to KAI Documentation

KAI is an advanced AI-powered platform that provides comprehensive material recognition, analysis, and management capabilities.

## Quick Start

Get started with KAI by following our [Installation Guide](installation).

## Key Features

- **Material Recognition**: Advanced AI-powered material identification and classification
- **3D Visualization**: Interactive 3D models and reconstruction capabilities
- **Analytics System**: Comprehensive analytics and reporting
- **Prompt Management**: Advanced prompt library and A/B testing
- **Multi-modal Processing**: Support for images, documents, and 3D data

## Architecture

KAI is built with a modern, scalable architecture including:

- **Frontend**: React-based user interface
- **Backend**: Node.js/Python microservices
- **Database**: PostgreSQL with vector extensions
- **AI/ML**: Integrated machine learning pipelines
- **Infrastructure**: Kubernetes-ready containerized deployment

## Getting Help

- Browse the documentation using the sidebar navigation
- Check out our [GitHub repository](https://github.com/Basilakis/kai)
- Review the [API Reference](api-reference) for technical details

Let's get started building with KAI!`
  },
  {
    name: 'installation.md',
    content: `---
id: installation
title: "Installation"
sidebar_label: "Installation"
---

# Installation

This page provides instructions for installing the KAI platform.

## Prerequisites

- Node.js 18+
- Python 3.9+
- Docker and Docker Compose
- PostgreSQL 14+

## Quick Start

\`\`\`bash
# Clone the repository
git clone https://github.com/Basilakis/kai.git
cd kai

# Install dependencies
npm install

# Start with Docker Compose
docker-compose up -d
\`\`\`

## Manual Installation

For detailed manual installation instructions, see the [Configuration Guide](configuration).`
  },
  {
    name: 'configuration.md',
    content: `---
id: configuration
title: "Configuration"
sidebar_label: "Configuration"
---

# Configuration

This page provides instructions for configuring the KAI platform.

## Environment Variables

Configure the following environment variables:

\`\`\`bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/kai

# API Keys
OPENAI_API_KEY=your_openai_key
HUGGINGFACE_API_KEY=your_hf_key

# Services
REDIS_URL=redis://localhost:6379
\`\`\`

## Service Configuration

See the individual service documentation for detailed configuration options.`
  },
  {
    name: 'features-overview.md',
    content: `---
id: features-overview
title: "Features Overview"
sidebar_label: "Features Overview"
---

# Features Overview

This page provides an overview of the features available in the KAI platform.

## Core Features

### Material Recognition
Advanced AI-powered material identification and classification system.

### 3D Visualization
Interactive 3D models and reconstruction capabilities.

### Analytics System
Comprehensive analytics and reporting dashboard.

### Prompt Management
Advanced prompt library with A/B testing capabilities.

## Advanced Features

- Multi-modal data processing
- Real-time collaboration
- API integrations
- Custom model training
- Automated workflows`
  },
  {
    name: 'github-actions-overview.md',
    content: `---
id: github-actions-overview
title: "GitHub Actions Overview"
sidebar_label: "Overview"
---

# GitHub Actions Overview

This section covers the GitHub Actions workflows and reusable actions available in the KAI project.

## Available Actions

### Docusaurus PR Action
Automated documentation generation and pull request creation for Docusaurus sites.

## Workflows

### Documentation Deployment
Automated deployment of documentation updates using GitHub Actions.

## Getting Started

To use the GitHub Actions in your project:

1. Copy the action files to your \`.github/actions/\` directory
2. Configure the workflow files in \`.github/workflows/\`
3. Set up the required secrets and environment variables
4. Trigger the workflows manually or via automation

## Best Practices

- Use reusable actions for common tasks
- Implement proper error handling
- Use secrets for sensitive information
- Test workflows in development branches first`
  },
  {
    name: 'docs-pr-creator-workflow.md',
    content: `---
id: docs-pr-creator-workflow
title: "Documentation PR Creator Workflow"
sidebar_label: "PR Creator Workflow"
---

# Documentation PR Creator Workflow

An automated GitHub workflow that processes readme files and creates pull requests for documentation deployment to GitHub Pages.

## Overview

The \`docs-pr-creator.yml\` workflow provides:
- Automatic detection of changes in the \`readme/\` directory
- Processing of markdown files into documentation format
- Creation of pull requests for documentation deployment
- Integration with external documentation repositories

## Workflow Configuration

### Triggers

\`\`\`yaml
on:
  push:
    branches: [main]
    paths:
      - 'readme/**'
      - 'readme/**/*'
      - '.github/workflows/docs-pr-creator.yml'
  workflow_dispatch:
\`\`\`

### Key Features

- **Change Detection**: Only runs when readme files are modified
- **First-Run Detection**: Handles initial setup when target repository doesn't exist
- **Automated Processing**: Converts readme files to documentation format
- **PR Creation**: Automatically creates pull requests for review

## Jobs

### 1. Check Changes

Determines whether the workflow should run based on:
- Changes in the \`readme/\` directory
- Existence of target repository and branch
- First-run detection logic

### 2. Create PR

Processes documentation and creates pull requests:

\`\`\`yaml
steps:
  - name: Checkout repository
  - name: Setup Node.js
  - name: Install dependencies
  - name: Process readme files
  - name: Prepare files for PR
  - name: Checkout target repository
  - name: Create Pull Request
\`\`\`

## Configuration

### Required Secrets

| Secret | Description |
|--------|-------------|
| \`DOCS_DEPLOY_TOKEN\` | GitHub token with access to target repository |

### Target Repository

The workflow deploys to: \`Basilakis/basilakis.github.io\`
- **Target Branch**: \`gh-pages\`
- **PR Base**: \`gh-pages\`

## File Processing

### Input Structure

\`\`\`
readme/
├── *.md files
├── scripts/
│   └── process-readme-files.js
└── subdirectories/
\`\`\`

### Output Structure

\`\`\`
kai-docs-temp/
├── docs/
│   └── processed markdown files
└── build/
    └── final documentation files
\`\`\`

## Integration with RooCommander

### MDTM Task Integration

The workflow can be triggered as part of MDTM tasks:

\`\`\`yaml
# In your MDTM task workflow
- name: Trigger Documentation Update
  run: |
    # Make changes to readme files
    git add readme/
    git commit -m "MDTM Task: \${{ env.TASK_ID }} - Update documentation"
    git push origin main
\`\`\`

### Session-Aware Processing

\`\`\`yaml
# Custom deployment message with session context
git commit -m "Session: \${{ env.ROO_SESSION_ID }} - Documentation update"
\`\`\`

## Usage Examples

### Manual Trigger

\`\`\`bash
# Trigger workflow manually via GitHub CLI
gh workflow run docs-pr-creator.yml
\`\`\`

### Automated via Push

\`\`\`bash
# Any push to main with readme changes will trigger
git add readme/new-feature.md
git commit -m "Add new feature documentation"
git push origin main
\`\`\`

## Workflow Outputs

### Successful Run

1. **Change Detection**: Identifies modified readme files
2. **Processing**: Converts files using \`process-readme-files.js\`
3. **PR Creation**: Creates timestamped branch and pull request
4. **Deployment**: Ready for review and merge to GitHub Pages

### PR Details

- **Title**: "Deploy Documentation: [commit message]"
- **Body**: Includes commit SHA and change details
- **Branch**: \`docs-update-[timestamp]\`

## Monitoring and Debugging

### Workflow Logs

Check the Actions tab for detailed logs:
- Change detection results
- File processing output
- PR creation status

### Common Issues

1. **No Changes Detected**: Verify files are in \`readme/\` directory
2. **Permission Errors**: Check \`DOCS_DEPLOY_TOKEN\` permissions
3. **Processing Failures**: Review \`process-readme-files.js\` output

## Advanced Configuration

### Custom Processing Script

The workflow uses \`readme/process-readme-files.js\` for file processing. Customize this script to:
- Add custom frontmatter
- Modify file structure
- Include additional metadata

### Environment Variables

\`\`\`yaml
env:
  TASK_ID: \${{ github.event.inputs.task_id }}
  ROO_SESSION_ID: \${{ github.event.inputs.session_id }}
\`\`\`

## Best Practices

1. **Commit Messages**: Use descriptive messages for better PR titles
2. **File Organization**: Keep readme files well-organized
3. **Testing**: Test changes locally before pushing
4. **Review**: Always review generated PRs before merging

## Troubleshooting

### Debug Mode

Enable debug output by adding to workflow:

\`\`\`yaml
env:
  ACTIONS_STEP_DEBUG: true
\`\`\`

### Manual Verification

\`\`\`bash
# Test processing script locally
cd readme
node process-readme-files.js
\`\`\`

## Contributing

This workflow is part of the KAI project ecosystem. For modifications:

1. Test changes in a fork first
2. Update documentation accordingly
3. Ensure backward compatibility
4. Follow existing patterns and conventions

\`\`\`yaml
- name: Generate Docusaurus Documentation PR
  uses: ./.github/actions/docusaurus-pr
  with:
    deploy_message: "Update documentation"
    github_token: \${{ secrets.GITHUB_TOKEN }}
    base_branch: "main"
    docs_branch: "docs/update"
\`\`\`

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| \`deploy_message\` | Message for the deployment PR | Yes | - |
| \`github_token\` | GitHub token for authentication | Yes | - |
| \`base_branch\` | Base branch for the PR | No | \`main\` |
| \`docs_branch\` | Branch name for documentation updates | No | \`docs/update\` |

## Features

- **Automated Setup**: Installs Node.js and dependencies
- **Documentation Processing**: Converts and processes markdown files
- **Site Building**: Builds the Docusaurus site
- **PR Creation**: Creates pull requests with generated content
- **Error Handling**: Comprehensive error reporting

## Integration with RooCommander

This action is designed to work seamlessly with RooCommander workflows for automated documentation generation and deployment.`
  },
  {
    name: 'roocommander-overview.md',
    content: `---
id: roocommander-overview
title: "RooCommander Overview"
sidebar_label: "Overview"
---

# RooCommander Overview

RooCommander is an advanced AI-powered project coordination and task management system that integrates with the KAI platform.

## What is RooCommander?

RooCommander is a sophisticated workflow orchestration system that:
- Coordinates complex development tasks
- Manages AI-powered automation workflows
- Integrates with GitHub Actions and CI/CD pipelines
- Provides intelligent task delegation and tracking

## Key Features

### Task Management
- **MDTM (Markdown-Driven Task Management)**: Structured task tracking using TOML frontmatter
- **Automated Delegation**: Intelligent task assignment to specialist modes
- **Progress Tracking**: Real-time monitoring of task completion

### Workflow Orchestration
- **Multi-Mode Coordination**: Seamless integration between different AI specialist modes
- **Session Management**: Persistent context and state management across interactions
- **Artifact Management**: Organized storage and retrieval of generated content

### Integration Capabilities
- **GitHub Actions**: Native integration with CI/CD workflows
- **Documentation Generation**: Automated creation and deployment of documentation
- **Code Generation**: AI-powered code creation and modification

## Architecture

RooCommander follows a modular architecture with:
- **Coordinator Modes**: High-level task orchestration
- **Specialist Modes**: Domain-specific task execution
- **Session Management**: Context preservation and continuity
- **Artifact Storage**: Organized file and content management

## Getting Started

To start using RooCommander:
1. Review the [Integration Guide](roocommander-integration)
2. Explore the [Workflow Examples](roocommander-workflows)
3. Set up your first automated workflow`
  },
  {
    name: 'roocommander-integration.md',
    content: `---
id: roocommander-integration
title: "RooCommander Integration"
sidebar_label: "Integration"
---

# RooCommander Integration

This guide covers how to integrate RooCommander with your development workflows and the KAI platform.

## Prerequisites

- GitHub repository with Actions enabled
- Node.js 18+ environment
- Access to RooCommander system

## Setup Process

### 1. Repository Configuration

Configure your repository with the necessary directory structure:

\`\`\`
.ruru/
├── modes/           # Mode definitions
├── tasks/           # MDTM task files
├── sessions/        # Session logs and artifacts
└── templates/       # Template files
\`\`\`

### 2. GitHub Actions Integration

Add the RooCommander-compatible workflows to your repository:

\`\`\`yaml
# .github/workflows/roocommander-docs.yml
name: RooCommander Documentation
on:
  workflow_dispatch:
    inputs:
      deploy_message:
        description: 'Deployment message'
        required: true

jobs:
  generate_docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/docusaurus-pr
        with:
          deploy_message: \${{ github.event.inputs.deploy_message }}
          github_token: \${{ secrets.GITHUB_TOKEN }}
\`\`\`

### 3. Mode Configuration

Configure specialist modes for your project needs:
- **Documentation Modes**: For automated documentation generation
- **Development Modes**: For code generation and modification
- **Testing Modes**: For automated testing and validation

## Integration Points

### Documentation Workflow
RooCommander integrates with the Docusaurus PR Action to:
- Generate documentation from project files
- Create structured documentation sites
- Automate PR creation and deployment

### Task Management
- **MDTM Tasks**: Structured task definitions with TOML metadata
- **Session Tracking**: Persistent context across multiple interactions
- **Artifact Management**: Organized storage of generated content

### CI/CD Integration
- **Automated Triggers**: Workflow activation based on project events
- **Status Reporting**: Real-time updates on task progress
- **Error Handling**: Comprehensive error reporting and recovery

## Best Practices

1. **Use MDTM for Complex Tasks**: Structure multi-step tasks using MDTM format
2. **Maintain Session Context**: Use session management for related tasks
3. **Organize Artifacts**: Store generated content in appropriate artifact directories
4. **Monitor Progress**: Use logging and tracking features for visibility`
  },
  {
    name: 'roocommander-workflows.md',
    content: `---
id: roocommander-workflows
title: "RooCommander Workflows"
sidebar_label: "Workflows"
---

# RooCommander Workflows

This page provides examples and patterns for common RooCommander workflows.

## Documentation Generation Workflow

### Automated Documentation Updates

\`\`\`yaml
# Workflow: Generate and deploy documentation
name: Documentation Update
on:
  push:
    paths: ['readme/**', 'docs/**']

jobs:
  update_docs:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Generate Documentation PR
        uses: ./.github/actions/docusaurus-pr
        with:
          deploy_message: "Automated documentation update"
          github_token: \${{ secrets.GITHUB_TOKEN }}
          base_branch: "main"
          docs_branch: "docs/auto-update"
\`\`\`

## Task Management Workflow

### MDTM Task Creation

Example MDTM task structure:

\`\`\`markdown
+++
id = "TASK-DOC-20250607-233000"
title = "Update API Documentation"
status = "🟡 To Do"
type = "📝 Documentation"
assigned_to = "util-writer"
coordinator = "roo-commander"
created_date = "2025-06-07T23:30:00Z"
tags = ["documentation", "api", "update"]
+++

# Update API Documentation

## Description
Update the API documentation to reflect recent changes in the endpoint structure.

## Acceptance Criteria
- [ ] Review current API endpoints
- [ ] Update documentation files
- [ ] Generate new examples
- [ ] Create pull request

## Checklist
- [ ] Analyze existing documentation
- [ ] Identify outdated sections
- [ ] Update endpoint descriptions
- [ ] Add new examples
- [ ] Review and test documentation
\`\`\`

## Session Management Workflow

### Session Lifecycle

1. **Session Initiation**
   - Create session directory structure
   - Initialize session log
   - Set up artifact directories

2. **Task Execution**
   - Log significant events
   - Store artifacts in organized structure
   - Update task progress

3. **Session Completion**
   - Finalize session log
   - Archive artifacts
   - Generate summary report

## Integration Patterns

### Multi-Mode Coordination

\`\`\`
Coordinator Mode (roo-commander)
├── Delegates to Documentation Mode
├── Delegates to Development Mode
└── Coordinates with Testing Mode
\`\`\`

### Artifact Flow

\`\`\`
Source Files → Processing → Generated Content → PR Creation → Deployment
\`\`\`

## Common Use Cases

### 1. Automated Code Documentation
- Scan code changes
- Generate documentation updates
- Create structured documentation site
- Deploy via GitHub Pages

### 2. Project Setup Automation
- Initialize project structure
- Configure development environment
- Set up CI/CD pipelines
- Generate initial documentation

### 3. Content Migration
- Process existing documentation
- Convert to structured format
- Organize in new system
- Maintain version history

## Monitoring and Debugging

### Session Logs
Monitor workflow progress through session logs:
- Task delegation events
- Completion status
- Error reporting
- Performance metrics

### Artifact Inspection
Review generated artifacts:
- Documentation files
- Configuration updates
- Generated code
- Test results`
  }
];

docs.forEach(doc => {
  fs.writeFileSync(
    path.join('kai-docs-temp', 'docs', doc.name),
    doc.content
  );
});



// Create homepage
console.log('Creating homepage...');
const homepageContent = `import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/introduction">
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={\`Hello from \${siteConfig.title}\`}
      description="Documentation for the KAI project">
      <HomepageHeader />
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              <div className="col col--4">
                <div className="text--center">
                  <h3>🤖 AI-Powered</h3>
                  <p>
                    Advanced material recognition and classification using cutting-edge AI models.
                  </p>
                </div>
              </div>
              <div className="col col--4">
                <div className="text--center">
                  <h3>🔧 Automated Workflows</h3>
                  <p>
                    Streamlined processes with RooCommander integration and GitHub Actions automation.
                  </p>
                </div>
              </div>
              <div className="col col--4">
                <div className="text--center">
                  <h3>📊 Analytics & Insights</h3>
                  <p>
                    Comprehensive analytics system with real-time monitoring and reporting.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}`;

fs.writeFileSync(
  path.join('kai-docs-temp', 'src', 'pages', 'index.js'),
  homepageContent
);

// Create homepage CSS
const homepageCssContent = `.heroBanner {
  padding: 4rem 0;
  text-align: center;
  position: relative;
  overflow: hidden;
}

@media screen and (max-width: 996px) {
  .heroBanner {
    padding: 2rem;
  }
}

.buttons {
  display: flex;
  align-items: center;
  justify-content: center;
}

.features {
  display: flex;
  align-items: center;
  padding: 2rem 0;
  width: 100%;
}`;

// Create pages directory and CSS file
if (!fs.existsSync(path.join('kai-docs-temp', 'src', 'pages'))) {
  fs.mkdirSync(path.join('kai-docs-temp', 'src', 'pages'), { recursive: true });
}

fs.writeFileSync(
  path.join('kai-docs-temp', 'src', 'pages', 'index.module.css'),
  homepageCssContent
);

console.log('Docusaurus site created successfully!');
