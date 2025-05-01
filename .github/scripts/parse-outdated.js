/**
 * Script to parse the output of "yarn outdated --json" and create a structured report
 * This will be used by the GitHub Actions workflow for dependency scanning
 */

const fs = require('fs');
const path = require('path');

// Read the outdated packages JSON file
try {
  const outdatedRaw = fs.readFileSync('outdated.json', 'utf8');
  const outdatedData = JSON.parse(outdatedRaw);
  
  // Initialize the report object
  const report = {
    timestamp: new Date().toISOString(),
    packages: [],
    summary: {
      total: 0,
      major: 0,
      minor: 0,
      patch: 0
    }
  };
  
  // Process each workspace package
  if (outdatedData.data && outdatedData.data.body) {
    for (const pkgData of outdatedData.data.body) {
      // Skip header row if present
      if (pkgData[0] === 'Package' || typeof pkgData[0] !== 'string') continue;
      
      const [name, current, wanted, latest, type, url] = pkgData;
      
      // Skip if not outdated
      if (current === latest) continue;
      
      // Determine update type (major, minor, patch)
      let updateType = 'unknown';
      
      if (current && latest) {
        const currentVersion = current.split('.').map(Number);
        const latestVersion = latest.split('.').map(Number);
        
        if (latestVersion[0] > currentVersion[0]) {
          updateType = 'major';
          report.summary.major++;
        } else if (latestVersion[1] > currentVersion[1]) {
          updateType = 'minor';
          report.summary.minor++;
        } else if (latestVersion[2] > currentVersion[2]) {
          updateType = 'patch';
          report.summary.patch++;
        }
      }
      
      // Add to packages list
      report.packages.push({
        name,
        current,
        wanted,
        latest,
        type: type || 'dependencies',
        updateType,
        packageType: 'node'
      });
      
      report.summary.total++;
    }
  }
  
  // Write report to file
  fs.writeFileSync('outdated-report.json', JSON.stringify(report, null, 2));
  console.log(`Successfully wrote outdated packages report with ${report.summary.total} packages`);
  
} catch (error) {
  console.error('Error processing outdated packages:', error);
  process.exit(1);
}