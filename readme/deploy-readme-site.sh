#!/bin/bash

# Script to deploy readme files as a documentation site to GitHub Pages
# Target repository: https://github.com/Basilakis/kai-readme.github.io

set -e

echo "Starting deployment of KAI documentation site..."

# Check if required tools are installed
if ! command -v node &> /dev/null; then
    echo "Node.js is required but not installed. Please install Node.js 20 or later and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Node.js version 18 or higher is required. Current version: $(node -v)"
    echo "Please upgrade Node.js and try again."
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
TEMP_DIR="../kai-docs-temp"
DOCS_REPO="https://github.com/Basilakis/kai-readme.github.io.git"
README_DIR="."  # Current directory is now the readme folder

# Remove existing temporary directory if it exists
if [ -d "$TEMP_DIR" ]; then
    echo "Removing existing temporary directory..."
    rm -rf "$TEMP_DIR"
fi

# Create the temporary directory
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Create a Docusaurus site from scratch
echo "Creating Docusaurus site from scratch..."

# Initialize a new package.json
cat > package.json << 'EOL'
{
  "name": "kai-documentation",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "docusaurus": "docusaurus",
    "start": "docusaurus start",
    "build": "docusaurus build",
    "swizzle": "docusaurus swizzle",
    "deploy": "docusaurus deploy",
    "clear": "docusaurus clear",
    "serve": "docusaurus serve",
    "write-translations": "docusaurus write-translations",
    "write-heading-ids": "docusaurus write-heading-ids"
  },
  "dependencies": {
    "@docusaurus/core": "^3.7.0",
    "@docusaurus/preset-classic": "^3.7.0",
    "@mdx-js/react": "^3.0.0",
    "clsx": "^2.1.0",
    "prism-react-renderer": "^2.3.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@docusaurus/module-type-aliases": "^3.7.0",
    "@docusaurus/types": "^3.7.0"
  },
  "browserslist": {
    "production": [
      ">0.5%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  },
  "engines": {
    "node": ">=18.0"
  }
}
EOL

# Create basic Docusaurus config
cat > docusaurus.config.js << 'EOL'
// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'KAI Documentation',
  tagline: 'Comprehensive documentation for the KAI project',
  favicon: 'img/favicon.ico',
  url: 'https://basilakis.github.io',
  baseUrl: '/kai-readme.github.io/',
  organizationName: 'Basilakis',
  projectName: 'kai-readme.github.io',
  trailingSlash: false,
  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',
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
          sidebarPath: './sidebars.js',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],
  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'KAI Documentation',
        logo: {
          alt: 'KAI Logo',
          src: 'img/logo.svg',
        },
        items: [
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
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
EOL

# Create directories
mkdir -p docs src/css static/img

# Create custom CSS
cat > src/css/custom.css << 'EOL'
/**
 * Any CSS included here will be global. The classic template
 * bundles Infima by default. Infima is a CSS framework designed to
 * work well for content-centric websites.
 */

/* You can override the default Infima variables here. */
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

/* For readability concerns, you should choose a lighter palette in dark mode. */
[data-theme='dark'] {
  --ifm-color-primary: #25c2a0;
  --ifm-color-primary-dark: #21af90;
  --ifm-color-primary-darker: #1fa588;
  --ifm-color-primary-darkest: #1a8870;
  --ifm-color-primary-light: #29d5b0;
  --ifm-color-primary-lighter: #32d8b4;
  --ifm-color-primary-lightest: #4fddbf;
  --docusaurus-highlighted-code-line-bg: rgba(0, 0, 0, 0.3);
}

/* Sidebar styles */
.menu__link {
  font-size: 0.9rem;
}

.menu__list-item-collapsible {
  font-weight: bold;
}

/* Document styles */
article {
  max-width: 900px;
  margin: 0 auto;
}

/* Code block styles */
.prism-code {
  font-size: 0.9rem;
}
EOL

# Create placeholder logo
cat > static/img/logo.svg << 'EOL'
<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="#2e8555" />
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="72" fill="white">KAI</text>
</svg>
EOL

# Create empty sidebars.js
cat > sidebars.js << 'EOL'
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
export default {
  tutorialSidebar: []
};
EOL

# Use the existing process-readme-files.js script
echo "Using existing process-readme-files.js script..."
cd ..

# Execute the existing process-readme-files.js script
node readme/process-readme-files.js

# Note: GitHub Actions workflow file is already updated in the repository
echo "GitHub Actions workflow file is already updated in the repository."

# Script has already been executed above
echo "Script has already been executed above."

# Build the Docusaurus site
echo "Building Docusaurus site..."
cd kai-docs-temp

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
