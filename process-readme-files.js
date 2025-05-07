const fs = require('fs');
const path = require('path');

// Source and destination directories
const sourceDir = './readme';
const destDir = './kai-docs-temp/docs';
const categoriesFile = './kai-docs-temp/categories.json';

// Create destination directory if it doesn't exist
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
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
  'other': []
};

// Function to process a markdown file
function processMarkdownFile(filePath, destPath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Extract the title from the first heading or use the filename
  let title = path.basename(filePath, '.md').replace(/-/g, ' ');
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1];
  }
  
  // Add frontmatter
  const frontmatter = `---
id: ${path.basename(filePath, '.md')}
title: ${title}
sidebar_label: ${title}
---

`;
  
  // Write the processed content to the destination
  fs.writeFileSync(destPath, frontmatter + content);
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

Use the sidebar to navigate through the documentation.
`;
  
  fs.writeFileSync(path.join(destDir, 'intro.md'), introContent);
  
  // Save the categories for sidebar generation
  fs.writeFileSync(categoriesFile, JSON.stringify(categories, null, 2));
}

// Generate the sidebar configuration
function generateSidebar() {
  const categories = JSON.parse(fs.readFileSync(categoriesFile, 'utf8'));
  
  const sidebar = {
    tutorialSidebar: [
      'intro',
    ]
  };
  
  for (const [category, files] of Object.entries(categories)) {
    if (files.length === 0) continue;
    
    const categoryItems = files.map(file => {
      const id = path.basename(file, '.md');
      return `${category}/${id}`;
    });
    
    sidebar.tutorialSidebar.push({
      type: 'category',
      label: category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      items: categoryItems,
    });
  }
  
  const sidebarContent = `
module.exports = ${JSON.stringify(sidebar, null, 2)};
`;
  
  fs.writeFileSync('./kai-docs-temp/sidebars.js', sidebarContent);
}

// Main execution
processReadmeFiles();
generateSidebar();

console.log('Readme files processed successfully!');
