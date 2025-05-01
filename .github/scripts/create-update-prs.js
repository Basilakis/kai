/**
 * Script to create Pull Requests for dependency updates based on compatibility analysis
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GITHUB_ACTOR = process.env.GITHUB_ACTOR || 'github-actions';

if (!GITHUB_TOKEN) {
  console.error('Error: GITHUB_TOKEN environment variable is required');
  process.exit(1);
}

// Helper function to run a command and get its output
function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error(`Error running command: ${command}`);
    console.error(error.message);
    return null;
  }
}

// Helper function to create a branch
function createBranch(branchName) {
  try {
    // Check if branch exists
    const branchExists = runCommand(`git ls-remote --heads origin ${branchName}`);
    
    if (branchExists) {
      console.log(`Branch ${branchName} already exists, fetching...`);
      runCommand(`git fetch origin ${branchName}`);
      runCommand(`git checkout ${branchName}`);
      runCommand(`git pull origin ${branchName}`);
    } else {
      console.log(`Creating new branch: ${branchName}`);
      runCommand(`git checkout -b ${branchName}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error creating branch ${branchName}:`, error);
    return false;
  }
}

// Helper function to update Node.js packages
function updateNodePackages(packages, updateType) {
  try {
    const packagesByWorkspace = {};
    
    // Group packages by workspace
    packages.forEach(pkg => {
      // Get workspace from package.type if available, otherwise use 'root'
      const workspace = pkg.workspace || 'root';
      
      if (!packagesByWorkspace[workspace]) {
        packagesByWorkspace[workspace] = [];
      }
      
      packagesByWorkspace[workspace].push(pkg);
    });
    
    // Update packages in each workspace
    for (const [workspace, pkgs] of Object.entries(packagesByWorkspace)) {
      const packageNames = pkgs.map(pkg => pkg.name).join(' ');
      const workspacePath = workspace === 'root' ? '.' : workspace;
      
      console.log(`Updating ${pkgs.length} packages in workspace ${workspace}...`);
      
      // Run yarn upgrade for the packages
      const upgradeCommand = `cd ${workspacePath} && yarn upgrade ${packageNames} --exact`;
      runCommand(upgradeCommand);
      
      // Create commit for this workspace
      const commitMsg = `chore(deps${workspace !== 'root' ? `-${workspace}` : ''}): update ${updateType} dependencies\n\n` +
                         pkgs.map(pkg => `- ${pkg.name} from ${pkg.current} to ${pkg.latest}`).join('\n');
                         
      // Add and commit changes
      runCommand(`git add ${workspacePath}/package.json ${workspacePath}/yarn.lock`);
      runCommand(`git commit -m "${commitMsg}"`);
    }
    
    return true;
  } catch (error) {
    console.error('Error updating Node.js packages:', error);
    return false;
  }
}

// Helper function to update Python packages
function updatePythonPackages(packages, updateType) {
  try {
    // Group packages by source file
    const packagesBySource = {};
    
    packages.forEach(pkg => {
      const source = pkg.source || 'requirements.txt';
      
      if (!packagesBySource[source]) {
        packagesBySource[source] = [];
      }
      
      packagesBySource[source].push(pkg);
    });
    
    // Update packages in each requirements file
    for (const [source, pkgs] of Object.entries(packagesBySource)) {
      console.log(`Updating ${pkgs.length} packages in ${source}...`);
      
      // Read the requirements file
      const requirementsPath = source.includes('/') ? source : `packages/ml/${source}`;
      const requirementsContent = fs.readFileSync(requirementsPath, 'utf8');
      
      // Update each package version
      let updatedContent = requirementsContent;
      
      pkgs.forEach(pkg => {
        // Handle different formats of version specification
        const patterns = [
          new RegExp(`${pkg.name}==[\\d\\.]+`, 'g'),
          new RegExp(`${pkg.name}>[\\d\\.]+`, 'g'),
          new RegExp(`${pkg.name}>=[\\d\\.]+`, 'g')
        ];
        
        for (const pattern of patterns) {
          updatedContent = updatedContent.replace(pattern, `${pkg.name}>=${pkg.latest}`);
        }
      });
      
      // Write updated content back to the file
      fs.writeFileSync(requirementsPath, updatedContent);
      
      // Create commit for this requirements file
      const commitMsg = `chore(deps-python): update ${updateType} Python dependencies in ${source}\n\n` +
                         pkgs.map(pkg => `- ${pkg.name} from ${pkg.current} to ${pkg.latest}`).join('\n');
                         
      // Add and commit changes
      runCommand(`git add ${requirementsPath}`);
      runCommand(`git commit -m "${commitMsg}"`);
    }
    
    return true;
  } catch (error) {
    console.error('Error updating Python packages:', error);
    return false;
  }
}

// Helper function to update configuration files
function updateConfigFiles(packages) {
  // This is a placeholder for actual config update logic
  // In a real implementation, this would examine each package's potentialConfigFiles
  // and make necessary updates
  
  console.log('No automatic config updates implemented yet. Add manual review note to PR.');
  return true;
}

// Helper function to create a pull request
function createPullRequest(branchName, title, body) {
  try {
    // Use GitHub CLI if available, otherwise use the API directly
    const command = `gh pr create --title "${title}" --body "${body}" --base main --head ${branchName}`;
    const result = runCommand(command);
    
    if (result) {
      console.log(`Successfully created PR: ${result}`);
      return true;
    }
    
    console.error('Failed to create PR');
    return false;
  } catch (error) {
    console.error('Error creating pull request:', error);
    return false;
  }
}

// Main function
async function main() {
  try {
    // Configure git
    runCommand('git config user.name "GitHub Actions"');
    runCommand('git config user.email "actions@github.com"');
    
    // Read the compatibility report
    const report = JSON.parse(fs.readFileSync('compatibility-report.json', 'utf8'));
    
    // Group packages by update type and recommendation
    const safePatches = report.packages.filter(p => 
      p.updateType === 'patch' && p.analysis.recommendation === 'safe');
      
    const safeMinor = report.packages.filter(p => 
      p.updateType === 'minor' && p.analysis.recommendation === 'safe');
      
    const cautionUpdates = report.packages.filter(p => 
      p.analysis.recommendation === 'caution');
      
    const manualUpdates = report.packages.filter(p => 
      p.analysis.recommendation === 'manual-update');
    
    // Process safe patch updates
    if (safePatches.length > 0) {
      const branchName = `deps/patch-updates-${new Date().toISOString().slice(0, 10)}`;
      
      if (createBranch(branchName)) {
        const nodePatches = safePatches.filter(p => p.packageType === 'node');
        const pythonPatches = safePatches.filter(p => p.packageType === 'python');
        
        // Update Node.js packages
        if (nodePatches.length > 0) {
          updateNodePackages(nodePatches, 'patch');
        }
        
        // Update Python packages
        if (pythonPatches.length > 0) {
          updatePythonPackages(pythonPatches, 'patch');
        }
        
        // Push the branch
        runCommand(`git push -u origin ${branchName}`);
        
        // Create PR
        const title = `chore(deps): update ${safePatches.length} patch dependencies`;
        const body = `
## Dependency Updates

This PR contains ${safePatches.length} safe patch updates identified by the automated dependency scanner.

### Node.js Packages (${nodePatches.length})
${nodePatches.map(p => `- \`${p.name}\`: \`${p.current}\` → \`${p.latest}\``).join('\n')}

### Python Packages (${pythonPatches.length})
${pythonPatches.map(p => `- \`${p.name}\`: \`${p.current}\` → \`${p.latest}\``).join('\n')}

### AI Analysis
These updates were analyzed and determined to be safe, with minimal risk of breaking changes.
        `;
        
        createPullRequest(branchName, title, body);
      }
    }
    
    // Process safe minor updates
    if (safeMinor.length > 0) {
      const branchName = `deps/minor-updates-${new Date().toISOString().slice(0, 10)}`;
      
      if (createBranch(branchName)) {
        const nodeMinor = safeMinor.filter(p => p.packageType === 'node');
        const pythonMinor = safeMinor.filter(p => p.packageType === 'python');
        
        // Update Node.js packages
        if (nodeMinor.length > 0) {
          updateNodePackages(nodeMinor, 'minor');
        }
        
        // Update Python packages
        if (pythonMinor.length > 0) {
          updatePythonPackages(pythonMinor, 'minor');
        }
        
        // Update config files if needed
        const packagesWithConfigChanges = safeMinor.filter(p => p.analysis.configChangesNeeded);
        if (packagesWithConfigChanges.length > 0) {
          updateConfigFiles(packagesWithConfigChanges);
        }
        
        // Push the branch
        runCommand(`git push -u origin ${branchName}`);
        
        // Create PR
        const title = `chore(deps): update ${safeMinor.length} minor dependencies`;
        const body = `
## Dependency Updates

This PR contains ${safeMinor.length} safe minor updates identified by the automated dependency scanner.

### Node.js Packages (${nodeMinor.length})
${nodeMinor.map(p => `- \`${p.name}\`: \`${p.current}\` → \`${p.latest}\``).join('\n')}

### Python Packages (${pythonMinor.length})
${pythonMinor.map(p => `- \`${p.name}\`: \`${p.current}\` → \`${p.latest}\``).join('\n')}

${packagesWithConfigChanges.length > 0 ? `
### Configuration Changes Required
These packages might require configuration updates:
${packagesWithConfigChanges.map(p => `- \`${p.name}\`: ${p.analysis.reasoning}`).join('\n')}
` : ''}

### AI Analysis
These updates were analyzed and determined to be safe, with minimal risk of breaking changes.
        `;
        
        createPullRequest(branchName, title, body);
      }
    }
    
    // Create a report PR for caution updates
    if (cautionUpdates.length > 0) {
      const branchName = `deps/caution-updates-${new Date().toISOString().slice(0, 10)}`;
      
      if (createBranch(branchName)) {
        // Create a report file
        const reportContent = {
          timestamp: new Date().toISOString(),
          updates: cautionUpdates.map(p => ({
            name: p.name,
            current: p.current,
            latest: p.latest,
            packageType: p.packageType,
            updateType: p.updateType,
            reasoning: p.analysis.reasoning,
            configChangesNeeded: p.analysis.configChangesNeeded,
            potentialConfigFiles: p.analysis.potentialConfigFiles
          }))
        };
        
        fs.writeFileSync('dependency-updates-report.json', JSON.stringify(reportContent, null, 2));
        
        // Commit the report
        runCommand('git add dependency-updates-report.json');
        runCommand('git commit -m "chore(deps): add dependency updates report"');
        
        // Push the branch
        runCommand(`git push -u origin ${branchName}`);
        
        // Create PR
        const title = `chore(deps): update proposal for ${cautionUpdates.length} dependencies (manual review)`;
        const body = `
## Dependency Update Proposal

This PR contains a proposal for updating ${cautionUpdates.length} dependencies that require manual review.

These updates were analyzed and determined to need additional review before updating.

### Node.js Packages (${cautionUpdates.filter(p => p.packageType === 'node').length})
${cautionUpdates.filter(p => p.packageType === 'node').map(p => 
  `- \`${p.name}\`: \`${p.current}\` → \`${p.latest}\` (${p.updateType})
   - ${p.analysis.reasoning}`
).join('\n\n')}

### Python Packages (${cautionUpdates.filter(p => p.packageType === 'python').length})
${cautionUpdates.filter(p => p.packageType === 'python').map(p => 
  `- \`${p.name}\`: \`${p.current}\` → \`${p.latest}\` (${p.updateType})
   - ${p.analysis.reasoning}`
).join('\n\n')}

Please review each update carefully. Use the admin panel's dependency management tool to apply these updates after review.
        `;
        
        createPullRequest(branchName, title, body);
      }
    }
    
    // Create a report issue for manual updates
    if (manualUpdates.length > 0) {
      // This would typically create a GitHub issue instead of a PR
      console.log(`${manualUpdates.length} packages need manual updates. These would be reported in a GitHub issue.`);
    }
    
    console.log('Pull request creation process completed successfully.');
    
  } catch (error) {
    console.error('Error creating update PRs:', error);
    process.exit(1);
  }
}

main();