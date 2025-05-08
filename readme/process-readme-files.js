const fs = require('fs');
const path = require('path');

// Source and destination directories
const sourceDir = '.';  // Since we're now running from within the readme folder
const destDir = '../kai-docs-temp/docs';
const categoriesFile = '../kai-docs-temp/categories.json';

// Create destination directory if it doesn't exist
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Function to check if a file exists
function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}

// Categories for organizing documentation
const categories = {
  'getting-started': ['README.md', 'main-readme.md', 'folder-structure.md'],
  'deployment': ['deployment-guide.md', 'cicd-pipeline.md', 'kubernetes-architecture.md', 'vercel-deployment-guide.md', 'digital-ocean-kubernetes-setup.md'],
  'architecture': ['implementation-architecture.md', 'implementation-summary.md', 'system-dependencies-and-integrations.md', 'unified-services.md'],
  'features': ['moodboard-feature.md', 'subscription-management-system.md', 'credit-system.md', 'material-promotion-system.md'],
  'ai-ml': ['AI-SYSTEM.md', 'ml-documentation.md', 'rag-system.md', 'agents-crewai.md', 'crewai-implementation.md'],
  'database': ['database-vector-db.md', 'supabase.md', 'supabase-setup-guide.md'],
  'api': ['api-endpoints-reference.md', 'api-reference.md', 'network-access-control.md'],
  'materials': [
    'material-expert.md', 'enhanced-material-expert.md', 'material-recognition.md',
    'material-comparison-engine.md', 'material-property-analytics.md', 'property-based-recommendation-engine.md',
    'property-inheritance-system.md', 'property-relationship-graph.md', 'dynamic-metadata-fields.md',
    'advanced-property-validation.md', 'enhanced-material-classification.md', 'shared-material-metadata-extraction.md',
    'shared-material-metadata-fields.md', 'multilingual-property-dictionaries.md'
  ],
  '3d': ['3d-reconstruction-pipeline.md', '3d-visualization.md', 'text-to-3d-generation.md', 'threeD-designer-agent.md'],
  'ocr': ['ocr.md', 'neural-ocr-integration.md', 'material-specific-ocr.md'],
  'analytics': ['analytics-system.md', 'analytics-agent.md'],
  'agents': [
    'knowledge-base-agent.md', 'operations-agent.md', 'project-assistant.md',
    'recognition-assistant.md'
  ],
  'monitoring': ['monitoring-system.md', 'training-monitoring-system.md', 'hpa-configuration-guide.md', 'advanced-scaling-features.md'],
  'security': ['security.md'],
  'testing': ['testing-approach.md'],
  'prompts': [
    'prompt-library.md', 'prompt-abtesting-segmentation.md', 'prompt-advanced-features.md',
    'prompt-management.md', 'prompt-success-tracking.md'
  ],
  'other': []
};

// Function to process a markdown file
function processMarkdownFile(filePath, destPath) {
  if (!fileExists(filePath)) {
    console.log(`Warning: File ${filePath} does not exist, skipping.`);
    return false;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Extract the title from the first heading or use the filename
    let title = path.basename(filePath, '.md').replace(/-/g, ' ');
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1];
    }

    // Escape special characters in YAML by adding quotes
    // If title contains any of these characters: : { } [ ] , & * # ? | - < > = ! % @ \ it needs quotes
    const needsQuotes = /[:{}[\],&*#?|<>=!%@\\]/.test(title);
    const safeTitle = needsQuotes ? `"${title.replace(/"/g, '\\"')}"` : title;

    // Add frontmatter
    const frontmatter = `---
id: ${path.basename(filePath, '.md')}
title: ${safeTitle}
sidebar_label: ${safeTitle}
---

`;

    // Create directory if it doesn't exist
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Write the processed content to the destination
    fs.writeFileSync(destPath, frontmatter + content);
    return true;
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return false;
  }
}

// Process all markdown files in the readme directory
function processReadmeFiles() {
  // Create a map to track which files have been categorized
  const processedFiles = new Set();

  // Process files by category
  for (const [category, files] of Object.entries(categories)) {
    // Create category directory
    const categoryDir = path.join(destDir, category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }

    // Process files in this category
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      if (fs.existsSync(sourcePath)) {
        const destPath = path.join(categoryDir, file);
        processMarkdownFile(sourcePath, destPath);
        processedFiles.add(file);
      }
    }
  }

  // Process any remaining files not explicitly categorized
  const files = fs.readdirSync(sourceDir);
  for (const file of files) {
    if (file.endsWith('.md') && !processedFiles.has(file)) {
      const sourcePath = path.join(sourceDir, file);
      const destPath = path.join(destDir, 'other', file);

      // Create 'other' directory if it doesn't exist
      if (!fs.existsSync(path.join(destDir, 'other'))) {
        fs.mkdirSync(path.join(destDir, 'other'), { recursive: true });
      }

      processMarkdownFile(sourcePath, destPath);
      categories.other.push(file);
    }
  }

  // Create an intro.md file
  const introContent = `---
id: intro
title: Introduction
sidebar_label: Introduction
slug: /
---

# KAI Documentation

Welcome to the KAI documentation site. This site contains comprehensive documentation for the KAI project.

## Documentation Sections

The documentation is organized into the following sections:

- **Getting Started**: Basic information to get started with the project
- **Deployment**: Guides for deploying the application
- **Architecture**: System architecture and implementation details
- **Features**: Documentation for specific features
- **AI/ML**: Artificial intelligence and machine learning components
- **Database**: Database setup and configuration
- **API**: API endpoints and reference
- **Materials**: Material-related features and functionality
- **3D**: 3D visualization and generation
- **OCR**: Optical Character Recognition functionality
- **Analytics**: Analytics systems and agents
- **Agents**: AI agents and assistants
- **Monitoring**: System monitoring and scaling
- **Security**: Security features and considerations
- **Testing**: Testing approach and methodologies
- **Prompts**: Prompt management, library, and advanced features

Use the sidebar to navigate through the documentation.
`;

  fs.writeFileSync(path.join(destDir, 'intro.md'), introContent);

  // Save the categories for sidebar generation
  fs.writeFileSync(categoriesFile, JSON.stringify(categories, null, 2));
}

// Generate the sidebar configuration
function generateSidebar() {
  try {
    if (!fs.existsSync(categoriesFile)) {
      console.error(`Categories file ${categoriesFile} does not exist.`);
      return false;
    }

    const categories = JSON.parse(fs.readFileSync(categoriesFile, 'utf8'));

    // Create a custom sidebar configuration
    const sidebar = {
      docs: [
        {
          type: "category",
          label: "Getting Started",
          items: ["getting-started/main-readme"]
        },
        {
          type: "category",
          label: "Features",
          items: ["features/moodboard-feature"]
        },
        {
          type: "category",
          label: "AI/ML",
          items: ["ai-ml/rag-system", "ai-ml/ml-documentation"]
        },
        {
          type: "category",
          label: "Materials",
          items: ["materials/enhanced-material-expert"]
        },
        {
          type: "category",
          label: "Agents",
          items: ["agents/recognition-assistant"]
        },
        {
          type: "category",
          label: "Prompts",
          items: ["prompt-library", "prompts/prompt-abtesting-segmentation", "prompts/prompt-advanced-features", "prompts/prompt-management", "prompts/prompt-success-tracking"]
        },
        {
          type: "category",
          label: "Other",
          items: ["other/system-updates-summary", "other/huggingface-integration", "other/mcp-integration", "changelog"]
        }
      ]
    };

    const sidebarContent = `/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
export default ${JSON.stringify(sidebar, null, 2)};
`;

    fs.writeFileSync('../kai-docs-temp/sidebars.js', sidebarContent);

    // Also create a copy in the root directory
    fs.writeFileSync('../kai-docs-temp/sidebars.js', sidebarContent);

    console.log('Sidebar configuration generated successfully.');
    return true;
  } catch (error) {
    console.error('Error generating sidebar:', error);
    return false;
  }
}

// Main execution
try {
  console.log('Starting to process readme files...');

  // Check if source directory exists
  if (!fs.existsSync(sourceDir)) {
    console.error(`Source directory ${sourceDir} does not exist.`);
    process.exit(1);
  }

  // Create prompt-library.md file if it doesn't exist
  const promptLibraryPath = path.join(destDir, 'prompt-library.md');
  if (!fs.existsSync(promptLibraryPath)) {
    console.log('Creating prompt-library.md file...');
    const promptLibraryContent = `---
id: prompt-library
title: "Prompt Library"
sidebar_label: "Prompt Library"
---

# Prompt Library

The Prompt Library is a centralized repository for managing, organizing, and sharing prompts across the KAI platform.

## Features

- **Public/Private Settings**: Control who can access your prompts
- **Categories**: Organize prompts by purpose, domain, or any other classification
- **Usage Types**: Define how prompts can be used (e.g., text generation, image generation)
- **Sharing Capabilities**: Share prompts with specific users or groups
- **Import Functionality**: Import prompts from external sources (for logged-in users)

## Implementation

The Prompt Library is implemented as a dedicated page at \`/prompt-library/id\` with comprehensive management features.

### Key Components

1. **Prompt Storage**: Secure storage of prompts with metadata
2. **Access Control**: Granular permissions based on user roles
3. **Version History**: Track changes to prompts over time
4. **Analytics**: Monitor prompt usage and performance
5. **Integration API**: Seamlessly integrate prompts into workflows

## Usage

Prompts can be accessed and used through:

- Web interface
- API endpoints
- Integration with other KAI features

## Related Documentation

For more information on specific prompt features, see:
- [Prompt A/B Testing and Segmentation](./prompts/prompt-abtesting-segmentation)
- [Advanced Prompt Features](./prompts/prompt-advanced-features)
- [Prompt Management](./prompts/prompt-management)
- [Prompt Success Tracking](./prompts/prompt-success-tracking)
`;
    fs.writeFileSync(promptLibraryPath, promptLibraryContent);
  }

  // Create prompts directory if it doesn't exist
  const promptsDir = path.join(destDir, 'prompts');
  if (!fs.existsSync(promptsDir)) {
    console.log('Creating prompts directory...');
    fs.mkdirSync(promptsDir, { recursive: true });
  }

  // Process prompt files
  const promptFiles = [
    'prompt-abtesting-segmentation.md',
    'prompt-advanced-features.md',
    'prompt-management.md',
    'prompt-success-tracking.md'
  ];

  for (const file of promptFiles) {
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(promptsDir, file);

    if (fs.existsSync(sourcePath)) {
      console.log(`Processing ${file}...`);
      processMarkdownFile(sourcePath, destPath);
    } else {
      console.log(`${file} not found in source directory, creating placeholder...`);
      // Create placeholder file with basic content
      const placeholderContent = `---
id: ${path.basename(file, '.md')}
title: "${path.basename(file, '.md').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}"
sidebar_label: "${path.basename(file, '.md').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}"
---

# ${path.basename(file, '.md').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}

This document describes ${path.basename(file, '.md').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} features for the KAI platform.

## Overview

Content coming soon.
`;
      fs.writeFileSync(destPath, placeholderContent);
    }
  }

  processReadmeFiles();

  if (generateSidebar()) {
    console.log('Readme files processed successfully!');
  } else {
    console.warn('Readme files processed with warnings.');
  }
} catch (error) {
  console.error('Error processing readme files:', error);
  process.exit(1);
}
