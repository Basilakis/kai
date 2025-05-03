/**
 * Create Pull Requests with Test Results
 * 
 * This script creates GitHub Pull Requests for dependency updates that have
 * passed their tests, including detailed test results and impact analysis.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const TEST_RESULTS_FILE = path.resolve(process.cwd(), '.github/dependency-test-results.json');
const IMPACT_ANALYSIS_FILE = path.resolve(process.cwd(), '.github/dependency-impact.json');
const TEST_SUMMARY_FILE = path.resolve(process.cwd(), '.github/test-results-summary.md');

// Load test results
let testResults = [];
try {
  testResults = JSON.parse(fs.readFileSync(TEST_RESULTS_FILE, 'utf8'));
  console.log(`Loaded test results for ${testResults.length} packages`);
} catch (error) {
  console.error(`Error loading test results: ${error.message}`);
  process.exit(1);
}

// Load impact analysis
let impactAnalysis = {};
try {
  const analysisData = JSON.parse(fs.readFileSync(IMPACT_ANALYSIS_FILE, 'utf8'));
  impactAnalysis = analysisData.impactAnalysis || {};
} catch (error) {
  console.error(`Error loading impact analysis: ${error.message}`);
  process.exit(1);
}

// Load test summary markdown
let testSummaryMarkdown = '';
try {
  testSummaryMarkdown = fs.readFileSync(TEST_SUMMARY_FILE, 'utf8');
} catch (error) {
  console.error(`Error loading test summary: ${error.message}`);
  // Continue without markdown summary
}

/**
 * Group dependency updates by risk level to create separate PRs
 */
function groupUpdatesByRiskLevel(testResults, impactAnalysis) {
  const groups = {
    safe: [],
    caution: [],
    major: []
  };
  
  // Only include updates that passed their tests
  const successfulUpdates = testResults.filter(result => result.success);
  
  successfulUpdates.forEach(result => {
    const packageName = result.packageName;
    const impact = impactAnalysis[packageName] || {};
    const updateType = impact.updateType || 'unknown';
    
    // Group by update type
    if (updateType === 'major') {
      groups.major.push(packageName);
    } else if (updateType === 'minor') {
      groups.caution.push(packageName);
    } else {
      groups.safe.push(packageName);
    }
  });
  
  return groups;
}

/**
 * Generate PR body with detailed information about updates
 */
function generatePRBody(groupType, packageNames, testResults, impactAnalysis) {
  let body = `# Dependency Updates (${groupType})\n\n`;
  
  // Group description
  const descriptions = {
    safe: 'These dependency updates have been analyzed as safe (patch updates) and have passed all tests.',
    caution: 'These dependency updates are minor version changes and have passed tests, but should be reviewed before merging.',
    major: 'These are major version updates that passed tests but require careful review as they may include breaking changes.'
  };
  
  body += `${descriptions[groupType]}\n\n`;
  
  // Package details
  body += `## Packages Updated\n\n`;
  body += `| Package | Current Version | New Version | Update Type | Tests |\n`;
  body += `|---------|-----------------|-------------|-------------|-------|\n`;
  
  packageNames.forEach(packageName => {
    const impact = impactAnalysis[packageName] || {};
    const result = testResults.find(r => r.packageName === packageName);
    
    if (result) {
      body += `| ${packageName} | ${impact.currentVersion || 'N/A'} | ${impact.latestVersion || 'latest'} | ${impact.updateType || 'unknown'} | ${result.testsPassed}/${result.testsTotal} passing |\n`;
    }
  });
  
  // Include affected files/modules
  body += `\n## Impact Analysis\n\n`;
  
  packageNames.forEach(packageName => {
    const impact = impactAnalysis[packageName] || {};
    const affectedModules = impact.directlyAffectedModules || [];
    
    body += `### ${packageName}\n\n`;
    
    if (affectedModules.length > 0) {
      body += `**Affected Modules:** ${affectedModules.join(', ')}\n\n`;
    } else {
      body += `**Affected Modules:** None directly affected (likely a dev dependency or build tool)\n\n`;
    }
    
    // List affected files (limit to 10 with "more..." if exceeding)
    const affectedFiles = impact.affectedFiles || [];
    if (affectedFiles.length > 0) {
      body += `**Affected Files:** `;
      if (affectedFiles.length <= 10) {
        body += `\n${affectedFiles.map(file => `- \`${file}\``).join('\n')}\n\n`;
      } else {
        body += `\n${affectedFiles.slice(0, 10).map(file => `- \`${file}\``).join('\n')}\n- ... and ${affectedFiles.length - 10} more\n\n`;
      }
    }
  });
  
  // Include test results summary
  if (testSummaryMarkdown) {
    body += `\n## Test Results\n\n`;
    body += testSummaryMarkdown;
  }
  
  // Include instructions for review
  body += `\n## Review Instructions\n\n`;
  
  if (groupType === 'safe') {
    body += `These are safe updates that passed all tests. You can merge this PR with minimal review.\n`;
  } else if (groupType === 'caution') {
    body += `Please review the changes carefully, particularly for any configuration files that might need updating.\n`;
  } else {
    body += `⚠️ **CAUTION**: These are major version updates that might include breaking changes.\n\n`;
    body += `Please review the following carefully:\n`;
    body += `1. Check the affected modules and files\n`;
    body += `2. Review the package's release notes for breaking changes\n`;
    body += `3. Consider additional manual testing beyond the automated tests\n`;
  }
  
  return body;
}

/**
 * Create a branch for dependency updates
 */
function createBranch(branchName) {
  // Check if the branch already exists
  try {
    const branches = execSync('git branch --list', { encoding: 'utf8' });
    if (branches.includes(branchName)) {
      console.log(`Branch ${branchName} already exists, will be reused`);
      execSync(`git checkout ${branchName}`);
      return false;
    }
  } catch (error) {
    console.warn(`Error checking branches: ${error.message}`);
  }
  
  // Create a new branch
  try {
    execSync(`git checkout -b ${branchName}`);
    console.log(`Created new branch: ${branchName}`);
    return true;
  } catch (error) {
    console.error(`Error creating branch: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Update package files with new dependency versions
 */
function updatePackageFiles(packageNames, impactAnalysis) {
  console.log(`Updating package files for ${packageNames.length} packages`);
  
  // Track which files we modified
  const modifiedFiles = [];
  
  // Update Node.js packages in package.json
  const nodePackages = packageNames.filter(name => {
    const impact = impactAnalysis[name] || {};
    return impact.packageType === 'node';
  });
  
  if (nodePackages.length > 0) {
    try {
      // Find all package.json files
      const packageJsonFiles = execSync('find . -name "package.json" -not -path "*/node_modules/*" -not -path "*/.git/*"', { encoding: 'utf8' })
        .trim()
        .split('\n');
      
      packageJsonFiles.forEach(filePath => {
        try {
          const packageJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          let modified = false;
          
          // Update dependencies
          if (packageJson.dependencies) {
            nodePackages.forEach(packageName => {
              if (packageJson.dependencies[packageName]) {
                const impact = impactAnalysis[packageName] || {};
                packageJson.dependencies[packageName] = impact.latestVersion || 'latest';
                modified = true;
              }
            });
          }
          
          // Update devDependencies
          if (packageJson.devDependencies) {
            nodePackages.forEach(packageName => {
              if (packageJson.devDependencies[packageName]) {
                const impact = impactAnalysis[packageName] || {};
                packageJson.devDependencies[packageName] = impact.latestVersion || 'latest';
                modified = true;
              }
            });
          }
          
          // Write changes back to file
          if (modified) {
            fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2) + '\n');
            modifiedFiles.push(filePath);
            console.log(`Updated ${filePath}`);
          }
        } catch (error) {
          console.warn(`Error processing ${filePath}: ${error.message}`);
        }
      });
    } catch (error) {
      console.error(`Error finding package.json files: ${error.message}`);
    }
  }
  
  // Update Python packages in requirements.txt files
  const pythonPackages = packageNames.filter(name => {
    const impact = impactAnalysis[name] || {};
    return impact.packageType === 'python';
  });
  
  if (pythonPackages.length > 0) {
    try {
      // Find all requirements.txt files
      const requirementsFiles = execSync('find . -name "requirements*.txt" -not -path "*/node_modules/*" -not -path "*/.git/*"', { encoding: 'utf8' })
        .trim()
        .split('\n');
      
      requirementsFiles.forEach(filePath => {
        try {
          let requirements = fs.readFileSync(filePath, 'utf8');
          let modified = false;
          
          pythonPackages.forEach(packageName => {
            const impact = impactAnalysis[packageName] || {};
            const latestVersion = impact.latestVersion || 'latest';
            
            // Update the package version in requirements.txt
            const packageRegex = new RegExp(`^${packageName}[=~<>]+.*$`, 'm');
            if (packageRegex.test(requirements)) {
              requirements = requirements.replace(
                packageRegex,
                `${packageName}==${latestVersion}`
              );
              modified = true;
            }
          });
          
          // Write changes back to file
          if (modified) {
            fs.writeFileSync(filePath, requirements);
            modifiedFiles.push(filePath);
            console.log(`Updated ${filePath}`);
          }
        } catch (error) {
          console.warn(`Error processing ${filePath}: ${error.message}`);
        }
      });
    } catch (error) {
      console.error(`Error finding requirements.txt files: ${error.message}`);
    }
  }
  
  return modifiedFiles;
}

/**
 * Create a pull request for a group of dependency updates
 */
async function createPullRequest(groupType, packageNames, modifiedFiles) {
  if (packageNames.length === 0) {
    console.log(`No packages to update for group: ${groupType}`);
    return;
  }
  
  console.log(`Creating PR for ${packageNames.length} ${groupType} updates`);
  
  // Create branch
  const today = new Date().toISOString().split('T')[0];
  const branchName = `dependency-updates/${groupType}-${today}`;
  
  const isNewBranch = createBranch(branchName);
  
  // Update packages
  const updatedFiles = updatePackageFiles(packageNames, impactAnalysis);
  
  if (updatedFiles.length === 0) {
    console.log(`No files were updated for ${groupType} dependencies, skipping PR`);
    return;
  }
  
  // Commit changes
  try {
    execSync('git add ' + updatedFiles.join(' '));
    execSync(`git commit -m "chore(deps): update ${groupType} dependencies"`);
    
    // Push branch
    execSync(`git push -u origin ${branchName}`);
    
    // Create PR using GitHub CLI if available
    try {
      const prTitle = `Dependency Updates: ${groupType} (${today})`;
      const prBody = generatePRBody(groupType, packageNames, testResults, impactAnalysis);
      
      // Create temporary file with PR body (GitHub CLI has limits on string length)
      const prBodyFile = path.resolve(process.cwd(), '.github/pr-body.md');
      fs.writeFileSync(prBodyFile, prBody);
      
      // Create PR
      const labels = ['dependencies', `update-type:${groupType}`];
      
      // Check if GitHub CLI is available
      const hasGhCli = execSync('command -v gh || echo "false"', { encoding: 'utf8' }).trim() !== 'false';
      
      if (hasGhCli) {
        execSync(`gh pr create --title "${prTitle}" --body-file "${prBodyFile}" --label "${labels.join(',')}" --base main`);
        console.log(`Created PR for ${groupType} dependency updates`);
      } else {
        console.log(`GitHub CLI not available. To create PR manually:
- PR Title: ${prTitle}
- Branch: ${branchName}
- Labels: ${labels.join(', ')}
- PR description saved to: ${prBodyFile}`);
      }
      
      // Clean up body file
      fs.unlinkSync(prBodyFile);
    } catch (error) {
      console.error(`Error creating PR: ${error.message}`);
      console.log(`Changes have been pushed to branch: ${branchName}`);
    }
  } catch (error) {
    console.error(`Error committing changes: ${error.message}`);
  }
}

/**
 * Main function
 */
async function main() {
  // Group packages by risk level
  const groups = groupUpdatesByRiskLevel(testResults, impactAnalysis);
  
  console.log(`Grouped updates: ${groups.safe.length} safe, ${groups.caution.length} caution, ${groups.major.length} major`);
  
  // Create separate PRs for each group
  await createPullRequest('safe', groups.safe, impactAnalysis);
  await createPullRequest('caution', groups.caution, impactAnalysis);
  await createPullRequest('major', groups.major, impactAnalysis);
}

// Run the main function
main().catch(error => {
  console.error(`Error creating PRs: ${error.message}`);
  process.exit(1);
});