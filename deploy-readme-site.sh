#!/bin/bash

# Script to deploy readme files as a documentation site to GitHub Pages
# Target repository: https://github.com/Basilakis/kai-readme.github.io

set -e

echo "Starting deployment of KAI documentation site..."

# Check if required tools are installed
if ! command -v node &> /dev/null; then
    echo "Node.js is required but not installed. Please install Node.js and try again."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "npm is required but not installed. Please install npm and try again."
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "git is required but not installed. Please install git and try again."
    exit 1
fi

# Create a temporary directory for the documentation site
TEMP_DIR="./kai-docs-temp"
DOCS_REPO="https://github.com/Basilakis/kai-readme.github.io.git"
README_DIR="./readme"

# Remove existing temporary directory if it exists
if [ -d "$TEMP_DIR" ]; then
    echo "Removing existing temporary directory..."
    rm -rf "$TEMP_DIR"
fi

# Create the temporary directory
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Initialize a new Docusaurus site
echo "Initializing Docusaurus site..."
npx create-docusaurus@latest . classic --typescript

# Clean up default content
echo "Cleaning up default content..."
rm -rf ./docs/*
rm -rf ./blog/*
rm -rf ./src/pages/*

# Create a custom index page
cat > ./src/pages/index.js << 'EOL'
import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

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
            to="/docs/intro">
            Documentation
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
      title={`${siteConfig.title}`}
      description="KAI Documentation">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
EOL

# Create a custom homepage features component
mkdir -p ./src/components
cat > ./src/components/HomepageFeatures/index.js << 'EOL'
import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Comprehensive Documentation',
    description: (
      <>
        Access all KAI documentation in one place with easy navigation.
      </>
    ),
  },
  {
    title: 'Searchable Content',
    description: (
      <>
        Find what you need quickly with our powerful search functionality.
      </>
    ),
  },
  {
    title: 'Always Up-to-Date',
    description: (
      <>
        Documentation is automatically updated from the main repository.
      </>
    ),
  },
];

function Feature({title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
EOL

# Create styles for the homepage features
mkdir -p ./src/components/HomepageFeatures
mv ./src/components/HomepageFeatures/index.js ./src/components/HomepageFeatures/
cat > ./src/components/HomepageFeatures/styles.module.css << 'EOL'
.features {
  display: flex;
  align-items: center;
  padding: 2rem 0;
  width: 100%;
}
EOL

# Update docusaurus.config.js
cat > ./docusaurus.config.js << 'EOL'
// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'KAI Documentation',
  tagline: 'Comprehensive documentation for the KAI project',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://basilakis.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/kai-readme.github.io/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'Basilakis', // Usually your GitHub org/user name.
  projectName: 'kai-readme.github.io', // Usually your repo name.
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/Basilakis/kai-readme.github.io/tree/main/',
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/docusaurus-social-card.jpg',
      navbar: {
        title: 'KAI Documentation',
        logo: {
          alt: 'KAI Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Documentation',
          },
          {
            href: 'https://github.com/Basilakis/kai',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Documentation',
                to: '/docs/intro',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/Basilakis/kai',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} KAI Project. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
EOL

# Create a script to copy and process readme files
echo "Creating script to process readme files..."
cd ..
cat > process-readme-files.js << 'EOL'
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
EOL

# Make the script executable
chmod +x process-readme-files.js

# Create GitHub Actions workflow file
mkdir -p .github/workflows
cat > .github/workflows/deploy-docs.yml << 'EOL'
name: Deploy Documentation

on:
  push:
    branches:
      - main
    paths:
      - 'readme/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm install -g fs-extra
          npm install -g docusaurus

      - name: Process readme files
        run: node process-readme-files.js

      - name: Build documentation site
        run: |
          cd kai-docs-temp
          npm install
          npm run build

      - name: Deploy to GitHub Pages
        uses: JamesIves/github-pages-deploy-action@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          branch: gh-pages
          folder: kai-docs-temp/build
          repository-name: Basilakis/kai-readme.github.io
          clean: true
EOL

# Execute the script to process readme files
echo "Processing readme files..."
node process-readme-files.js

# Fix workspace protocol in package.json
echo "Fixing workspace protocol in package.json..."
cd kai-docs-temp
# Replace workspace:* with * in package.json to avoid EUNSUPPORTEDPROTOCOL error
sed -i 's/"workspace:\*"/"*"/g' package.json

# Build the Docusaurus site
echo "Building Docusaurus site..."
# Check if yarn is installed, use it if available
if command -v yarn &> /dev/null; then
    yarn install
    yarn build
else
    npm install
    npm run build
fi

echo "Documentation site built successfully!"
echo ""
echo "To deploy the site to GitHub Pages:"
echo "1. Push this repository to GitHub"
echo "2. Make sure GitHub Actions is enabled for your repository"
echo "3. The built-in GITHUB_TOKEN should have sufficient permissions for deployment"
echo "4. Run the GitHub Actions workflow manually from the Actions tab or push changes to the readme folder"
echo ""
echo "You can also test the site locally by running:"
echo "cd kai-docs-temp && npm run start"
echo ""
echo "Note: If you're deploying to a different repository, you'll need to create a personal access token"
echo "with repo permissions and add it as a secret named GITHUB_TOKEN in your repository settings."
