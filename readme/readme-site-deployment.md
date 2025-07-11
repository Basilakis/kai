# KAI Documentation Site Deployment

This guide explains how to deploy the KAI documentation as a website with a sidebar navigation to https://github.com/Basilakis/kai-readme.github.io.

## Overview

The deployment process:

1. Converts all markdown files in the `/readme/` folder to Docusaurus-compatible format
2. Organizes them into categories for the sidebar
3. Builds a Docusaurus site
4. Deploys the site to GitHub Pages

## Setup Instructions

### Manual Deployment

To manually deploy the documentation site:

1. Make sure you have Node.js 20 or later installed
2. Run the deployment script:

```bash
# Make the script executable
chmod +x deploy-readme-site.sh

# Run the script
./deploy-readme-site.sh
```

3. The script will:
   - Create a temporary Docusaurus site
   - Process all markdown files from the `/readme/` folder
   - Build the site
   - Provide instructions for deployment

4. To test the site locally:

```bash
cd kai-docs-temp
npm run start
```

### Automated Deployment with GitHub Actions

The repository includes a GitHub Actions workflow that automatically deploys the documentation site whenever changes are made to the `/readme/` folder.

To set up automated deployment:

1. Push this repository to GitHub
2. The built-in GITHUB_TOKEN should have sufficient permissions for deployment
3. The workflow will automatically run when changes are pushed to the `/readme/` folder
4. You can also manually trigger the workflow from the Actions tab

## Customization

### Modifying Categories

The documentation is organized into categories in the `process-readme-files.js` script. To modify the categories:

1. Edit the `categories` object in `process-readme-files.js`
2. Add or remove files from each category
3. Run the deployment script again

### Customizing the Site

To customize the Docusaurus site:

1. Edit the `docusaurus.config.js` file in the `kai-docs-temp` directory
2. Modify the theme, navigation, or other settings
3. Run the deployment script again

## Technology Stack

The documentation site is built using:

1. **Docusaurus 3.7** - The latest version of Docusaurus, providing modern features and improved performance
2. **React 18** - For interactive UI components
3. **Node.js 20** - For optimal compatibility with modern JavaScript features
4. **Yarn** - For dependency management

## Troubleshooting

If you encounter issues with the deployment:

1. Check that all dependencies are installed
2. Verify that the GitHub token has the correct permissions
3. Check the GitHub Actions logs for any errors
4. Ensure the repository settings allow GitHub Pages deployment

### Common Issues

#### EUNSUPPORTEDPROTOCOL Error

If you see an error like `npm error code EUNSUPPORTEDPROTOCOL` or `Unsupported URL Type "workspace:"`, this is because some Docusaurus templates use workspace protocol references in the package.json file. Our solution avoids this issue by:

1. Creating a custom Docusaurus setup from scratch instead of using the default template
2. Using ES modules syntax instead of CommonJS
3. Using Yarn instead of npm for installation when available

This approach completely avoids the workspace protocol issue and provides a modern, stable deployment process.

## Requirements

- Node.js 20 or higher
- Git
- GitHub account with permissions to create repositories

## Additional Resources

- [Docusaurus Documentation](https://docusaurus.io/docs)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
