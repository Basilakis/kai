const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get environment variables
const token = process.env.DOCS_DEPLOY_TOKEN;
const deployMessage = process.env.DEPLOY_MESSAGE || 'Update documentation';

if (!token) {
  console.error('Error: DOCS_DEPLOY_TOKEN environment variable is required');
  process.exit(1);
}

try {
  console.log('Cloning target repository...');
  execSync(
    `git clone https://x-access-token:${token}@github.com/Basilakis/basilakis.github.io.git target-repo`,
    { stdio: 'inherit' }
  );

  console.log('Checking for gh-pages branch...');
  process.chdir('target-repo');

  // Check if gh-pages branch exists
  const branches = execSync('git ls-remote --heads origin gh-pages').toString();

  if (!branches.includes('gh-pages')) {
    console.log('Creating gh-pages branch as it doesn\'t exist');
    execSync('git checkout --orphan gh-pages', { stdio: 'inherit' });
    execSync('git rm -rf .', { stdio: 'inherit' });
    fs.writeFileSync('README.md', '# KAI Documentation');
    execSync('git add README.md', { stdio: 'inherit' });
    execSync('git config user.name "GitHub Actions"', { stdio: 'inherit' });
    execSync('git config user.email "actions@github.com"', { stdio: 'inherit' });
    execSync('git commit -m "Initial gh-pages branch"', { stdio: 'inherit' });
    execSync('git push origin gh-pages', { stdio: 'inherit' });
  } else {
    console.log('Checking out gh-pages branch...');
    try {
      execSync('git checkout gh-pages', { stdio: 'inherit' });
    } catch (error) {
      execSync('git checkout -b gh-pages origin/gh-pages', { stdio: 'inherit' });
    }
  }

  // Create new branch
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const branchName = `docs-update-${timestamp}`;
  console.log(`Creating new branch: ${branchName}`);
  execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });

  // Copy files
  console.log('Copying documentation files...');
  execSync('rm -rf *', { stdio: 'inherit' });
  execSync('cp -r ../kai-docs-temp/build/* .', { stdio: 'inherit' });
  execSync('touch .nojekyll', { stdio: 'inherit' });

  // Commit and push
  console.log('Committing and pushing changes...');
  execSync('git config user.name "GitHub Actions"', { stdio: 'inherit' });
  execSync('git config user.email "actions@github.com"', { stdio: 'inherit' });
  execSync('git add .', { stdio: 'inherit' });
  execSync(`git commit -m "Deploy Documentation: ${deployMessage}"`, { stdio: 'inherit' });
  execSync(`git push origin ${branchName}`, { stdio: 'inherit' });

  // Save branch name for next step
  fs.writeFileSync('../branch-name.txt', branchName);
  console.log('Branch prepared successfully!');
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
