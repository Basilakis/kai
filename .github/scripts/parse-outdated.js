/**
 * Parse Outdated Packages Script
 * 
 * This script processes the output of 'yarn outdated --json' and 'pip list --outdated --format=json'
 * and combines them into a standardized format for further processing.
 */

const fs = require('fs');
const path = require('path');
const semver = require('semver');

// Configuration
const NODE_OUTDATED_FILE = path.resolve(process.cwd(), '.github/node-outdated.json');
const PYTHON_OUTDATED_FILE = path.resolve(process.cwd(), '.github/python-outdated.json');
const OUTPUT_FILE = path.resolve(process.cwd(), '.github/dependency-updates.json');

/**
 * Read the yarn outdated JSON output
 */
function readNodeOutdated() {
  try {
    if (!fs.existsSync(NODE_OUTDATED_FILE)) {
      console.log(`No Node.js outdated packages file found at ${NODE_OUTDATED_FILE}`);
      return [];
    }
    
    const data = fs.readFileSync(NODE_OUTDATED_FILE, 'utf8');
    const jsonData = JSON.parse(data);
    
    // Extract the relevant package data
    const packages = [];
    
    // Different versions of yarn output different formats
    if (jsonData.data && jsonData.data.body) {
      // Newer yarn versions
      jsonData.data.body.forEach(row => {
        packages.push({
          name: row[0],
          current: row[1],
          latest: row[3],
          packageType: 'node'
        });
      });
    } else if (Array.isArray(jsonData)) {
      // Alternative yarn formats
      jsonData.forEach(pkg => {
        packages.push({
          name: pkg.name,
          current: pkg.current,
          latest: pkg.latest,
          packageType: 'node'
        });
      });
    } else {
      console.log('Unrecognized yarn outdated format');
      return [];
    }
    
    console.log(`Found ${packages.length} outdated Node.js packages`);
    return packages;
  } catch (error) {
    console.error(`Error reading Node.js outdated packages: ${error.message}`);
    return [];
  }
}

/**
 * Read the pip list --outdated JSON output
 */
function readPythonOutdated() {
  try {
    if (!fs.existsSync(PYTHON_OUTDATED_FILE)) {
      console.log(`No Python outdated packages file found at ${PYTHON_OUTDATED_FILE}`);
      return [];
    }
    
    const data = fs.readFileSync(PYTHON_OUTDATED_FILE, 'utf8');
    const jsonData = JSON.parse(data);
    
    // Extract the relevant package data
    const packages = jsonData.map(pkg => ({
      name: pkg.name,
      current: pkg.version,
      latest: pkg.latest_version,
      packageType: 'python'
    }));
    
    console.log(`Found ${packages.length} outdated Python packages`);
    return packages;
  } catch (error) {
    console.error(`Error reading Python outdated packages: ${error.message}`);
    return [];
  }
}

/**
 * Determine the update type (major, minor, patch) based on semantic versioning
 */
function determineUpdateType(current, latest) {
  // Handle non-semver versions
  if (!semver.valid(current) || !semver.valid(latest)) {
    return 'unknown';
  }
  
  if (semver.major(latest) > semver.major(current)) {
    return 'major';
  } else if (semver.minor(latest) > semver.minor(current)) {
    return 'minor';
  } else if (semver.patch(latest) > semver.patch(current)) {
    return 'patch';
  } else {
    return 'unknown';
  }
}

/**
 * Process all outdated packages and categorize them
 */
function processPackages() {
  // Read outdated packages
  const nodePackages = readNodeOutdated();
  const pythonPackages = readPythonOutdated();
  
  // Combine packages
  const allPackages = [...nodePackages, ...pythonPackages];
  
  // Determine update type for each package
  const processedPackages = allPackages.map(pkg => {
    const updateType = determineUpdateType(pkg.current, pkg.latest);
    
    return {
      ...pkg,
      updateType
    };
  });
  
  // Generate summary statistics
  const summary = {
    total: processedPackages.length,
    major: processedPackages.filter(pkg => pkg.updateType === 'major').length,
    minor: processedPackages.filter(pkg => pkg.updateType === 'minor').length,
    patch: processedPackages.filter(pkg => pkg.updateType === 'patch').length,
    node: nodePackages.length,
    python: pythonPackages.length,
    unknown: processedPackages.filter(pkg => pkg.updateType === 'unknown').length,
    safe: 0,
    caution: 0,
    manualUpdate: 0
  };
  
  // Initial simple categorization (will be refined by the analyze-compatibility.js script)
  summary.safe = summary.patch;
  summary.caution = summary.minor;
  summary.manualUpdate = summary.major + summary.unknown;
  
  return {
    packages: processedPackages,
    summary
  };
}

// Process packages and write to output file
const result = processPackages();
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
console.log(`Processed ${result.packages.length} outdated packages and saved to ${OUTPUT_FILE}`);
console.log(`Summary: ${result.summary.major} major, ${result.summary.minor} minor, ${result.summary.patch} patch updates`);