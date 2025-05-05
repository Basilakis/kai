/**
 * Run Post-Deployment Tasks
 * 
 * This script is executed after the database migrations during the CI/CD deployment process.
 * It runs all necessary post-deployment tasks such as registering modules and API endpoints.
 */

// Import the post-deployment script
const postDeployment = require('../dist/scripts/post-deployment').default;

// Run the post-deployment tasks
console.log('Starting post-deployment tasks...');

postDeployment()
  .then(success => {
    if (success) {
      console.log('Post-deployment tasks completed successfully');
      process.exit(0);
    } else {
      console.warn('Post-deployment tasks completed with warnings');
      // Exit with success code to prevent deployment failure
      process.exit(0);
    }
  })
  .catch(error => {
    console.error('Post-deployment tasks failed:', error);
    // Exit with success code to prevent deployment failure
    // We don't want to fail the deployment if post-deployment tasks fail
    process.exit(0);
  });
