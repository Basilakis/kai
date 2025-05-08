const fs = require('fs');
const path = require('path');

// Create directories
console.log('Creating directories...');
const dirs = [
  'kai-docs-temp',
  'kai-docs-temp/docs',
  'kai-docs-temp/src/css',
  'kai-docs-temp/src/pages',
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
          routeBasePath: "/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      },
    ],
  ],
  // This ensures index.html is generated at the root
  plugins: [
    [
      '@docusaurus/plugin-content-pages',
      {
        path: 'src/pages',
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
    name: 'installation.md',
    content: `---
id: installation
title: "Installation"
sidebar_label: "Installation"
---

# Installation

This page provides instructions for installing the KAI platform.`
  },
  {
    name: 'configuration.md',
    content: `---
id: configuration
title: "Configuration"
sidebar_label: "Configuration"
---

# Configuration

This page provides instructions for configuring the KAI platform.`
  },
  {
    name: 'features-overview.md',
    content: `---
id: features-overview
title: "Features Overview"
sidebar_label: "Features Overview"
---

# Features Overview

This page provides an overview of the features available in the KAI platform.`
  }
];

docs.forEach(doc => {
  fs.writeFileSync(
    path.join('kai-docs-temp', 'docs', doc.name),
    doc.content
  );
});

// Create index.js in src/pages to ensure index.html is generated
console.log('Creating index.js for the home page...');
const indexContent = `import React from 'react';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Link from '@docusaurus/Link';

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="Home"
      description="KAI Documentation">
      <div className="container" style={{padding: '4rem 0'}}>
        <div className="row">
          <div className="col col--8 col--offset-2">
            <h1>{siteConfig.title}</h1>
            <p>{siteConfig.tagline}</p>
            <div className="margin-top--lg">
              <Link
                className="button button--primary button--lg"
                to="/intro">
                View Documentation
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
`;

fs.writeFileSync(
  path.join('kai-docs-temp', 'src', 'pages', 'index.js'),
  indexContent
);

console.log('Docusaurus site created successfully!');
