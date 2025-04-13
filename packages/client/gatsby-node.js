/**
 * Gatsby Node APIs
 * 
 * This file implements Gatsby Node APIs for creating pages and configuring
 * the development server.
 */

const path = require('path');

// Create pages dynamically
exports.createPages = async ({ actions }) => {
  const { createPage } = actions;
  
  // Create dynamic board page
  createPage({
    path: '/board/:boardId',
    matchPath: '/board/:boardId',
    component: path.resolve('./src/pages/board.tsx'),
    context: {},
  });
  
  // Create dynamic username/board page
  createPage({
    path: '/:username/board/:boardId',
    matchPath: '/:username/board/:boardId',
    component: path.resolve('./src/pages/board.tsx'),
    context: {},
  });
};

// Add support for TypeScript resolution
exports.onCreateWebpackConfig = ({ actions }) => {
  actions.setWebpackConfig({
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
  });
};
