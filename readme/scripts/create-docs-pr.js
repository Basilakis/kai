const { execSync } = require('child_process');
const fs = require('fs');

// Get environment variables
const token = process.env.DOCS_DEPLOY_TOKEN;
const deployMessage = process.env.DEPLOY_MESSAGE || 'Update documentation';

if (!token) {
  console.error('Error: DOCS_DEPLOY_TOKEN environment variable is required');
  process.exit(1);
}

try {
  // Read branch name from file
  const branchName = fs.readFileSync('branch-name.txt', 'utf8').trim();

  console.log('Creating pull request...');
  process.chdir('target-repo');

  // Login to GitHub CLI
  execSync(`echo "${token}" | gh auth login --with-token`, { stdio: 'inherit' });

  // Create PR
  const prBody = 'This PR was automatically created by the GitHub Actions workflow to update the documentation site.';

  const prCommand = `gh pr create \
    --title "Deploy Documentation: ${deployMessage}" \
    --body "${prBody}" \
    --repo Basilakis/basilakis.github.io \
    --head ${branchName} \
    --base gh-pages`;

  const prUrl = execSync(prCommand).toString().trim();

  console.log(`Pull request created successfully: ${prUrl}`);

  // Save PR URL for summary
  fs.writeFileSync('../pr-url.txt', prUrl);

  // Display summary
  console.log('');
  console.log('=== PULL REQUEST CREATED ===');
  console.log(`URL: ${prUrl}`);
  console.log('Please review and merge the PR to update the documentation site.');
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
