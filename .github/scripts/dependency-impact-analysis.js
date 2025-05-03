/**
 * Dependency Impact Analysis Script
 * 
 * This script analyzes which parts of the codebase are affected by specific
 * dependency updates by scanning import statements and building a dependency graph.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PACKAGES_DIR = path.resolve(process.cwd(), 'packages');
const OUTPUT_FILE = path.resolve(process.cwd(), '.github/dependency-impact.json');
const DEPENDENCY_UPDATES_FILE = path.resolve(process.cwd(), '.github/dependency-updates.json');

// Load dependency updates that need to be tested
let dependencyUpdates = [];
try {
  dependencyUpdates = JSON.parse(fs.readFileSync(DEPENDENCY_UPDATES_FILE, 'utf8'));
  console.log(`Loaded ${dependencyUpdates.length} dependency updates for analysis`);
} catch (error) {
  console.error(`Error loading dependency updates: ${error.message}`);
  process.exit(1);
}

/**
 * Find all JavaScript/TypeScript files in the project
 */
function findSourceFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    
    if (fs.statSync(filePath).isDirectory()) {
      // Skip node_modules and hidden directories
      if (file !== 'node_modules' && !file.startsWith('.')) {
        findSourceFiles(filePath, fileList);
      }
    } else if (/\.(js|jsx|ts|tsx)$/.test(file)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * Extract import statements from a file
 */
function extractImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = [];
    
    // Regular import statements
    const importRegex = /import\s+(?:.+\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    // require statements
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  } catch (error) {
    console.warn(`Could not parse file ${filePath}: ${error.message}`);
    return [];
  }
}

/**
 * Resolve the actual package name from an import path
 */
function resolvePackageName(importPath) {
  // Handle relative imports
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    return null;
  }
  
  // Handle scoped packages
  if (importPath.startsWith('@')) {
    const scopedMatch = importPath.match(/^(@[^/]+\/[^/]+)/);
    return scopedMatch ? scopedMatch[1] : null;
  }
  
  // Handle regular packages
  const packageMatch = importPath.match(/^([^/]+)/);
  return packageMatch ? packageMatch[1] : null;
}

/**
 * Build a dependency map for the project
 */
function buildDependencyMap() {
  console.log('Building dependency map...');
  
  // Find all source files
  const sourceFiles = findSourceFiles(PACKAGES_DIR);
  console.log(`Found ${sourceFiles.length} source files to analyze`);
  
  // Initialize dependency map
  const dependencyMap = {};
  
  // Process each file
  sourceFiles.forEach(filePath => {
    const imports = extractImports(filePath);
    
    imports.forEach(importPath => {
      const packageName = resolvePackageName(importPath);
      
      if (packageName) {
        if (!dependencyMap[packageName]) {
          dependencyMap[packageName] = { files: [] };
        }
        
        // Add this file to the package's usage list
        if (!dependencyMap[packageName].files.includes(filePath)) {
          dependencyMap[packageName].files.push(filePath);
        }
      }
    });
  });
  
  return dependencyMap;
}

/**
 * Map test files to source files based on naming conventions
 */
function mapTestsToSourceFiles(dependencyMap) {
  console.log('Mapping test files to source files...');
  
  Object.keys(dependencyMap).forEach(packageName => {
    const affectedFiles = dependencyMap[packageName].files;
    const testFiles = [];
    
    // Find test files that correspond to affected source files
    affectedFiles.forEach(filePath => {
      // Get file name without extension
      const { dir, name } = path.parse(filePath);
      
      // Common test file patterns
      const testPatterns = [
        path.join(dir, '__tests__', `${name}.test.js`),
        path.join(dir, '__tests__', `${name}.test.tsx`),
        path.join(dir, '__tests__', `${name}.test.ts`),
        path.join(dir, '__tests__', `${name}.spec.js`),
        path.join(dir, '__tests__', `${name}.spec.tsx`),
        path.join(dir, '__tests__', `${name}.spec.ts`),
        path.join(dir, '..', '__tests__', `${name}.test.js`),
        path.join(dir, '..', '__tests__', `${name}.test.tsx`),
        path.join(dir, '..', '__tests__', `${name}.test.ts`),
        path.join(dir, '..', '__tests__', `${name}.spec.js`),
        path.join(dir, '..', '__tests__', `${name}.spec.tsx`),
        path.join(dir, '..', '__tests__', `${name}.spec.ts`),
        // Add more test file patterns as needed
      ];
      
      testPatterns.forEach(testPath => {
        if (fs.existsSync(testPath) && !testFiles.includes(testPath)) {
          testFiles.push(testPath);
        }
      });
    });
    
    // Add test files to dependency map
    dependencyMap[packageName].testFiles = testFiles;
  });
  
  return dependencyMap;
}

/**
 * Generate impact analysis for updated dependencies
 */
function generateImpactAnalysis(dependencyMap) {
  console.log('Generating impact analysis for each dependency update...');
  
  const impact = {};
  
  dependencyUpdates.forEach(update => {
    const packageName = update.name;
    
    if (dependencyMap[packageName]) {
      const { files, testFiles } = dependencyMap[packageName];
      
      impact[packageName] = {
        updateType: update.updateType,
        packageType: update.packageType,
        affectedFiles: files,
        testFiles: testFiles || [],
        directlyAffectedModules: getAffectedModules(files),
      };
    } else {
      // Handle packages that aren't directly imported in the code
      // These might be build tools, dev dependencies, etc.
      impact[packageName] = {
        updateType: update.updateType,
        packageType: update.packageType,
        affectedFiles: [],
        testFiles: [],
        directlyAffectedModules: [],
      };
    }
  });
  
  return impact;
}

/**
 * Identify the modules affected by a set of files
 */
function getAffectedModules(files) {
  const modules = new Set();
  
  files.forEach(filePath => {
    // Extract the module name from the file path
    // Example: packages/admin/src/components/Sidebar.tsx -> admin
    const pathParts = filePath.split(path.sep);
    const packagesIndex = pathParts.indexOf('packages');
    
    if (packagesIndex >= 0 && packagesIndex + 1 < pathParts.length) {
      modules.add(pathParts[packagesIndex + 1]);
    }
  });
  
  return Array.from(modules);
}

/**
 * Generate test run configurations for each updated dependency
 */
function generateTestConfigurations(impactAnalysis) {
  console.log('Generating test configurations...');
  
  const testConfigs = {};
  
  Object.keys(impactAnalysis).forEach(packageName => {
    const { updateType, packageType, testFiles, directlyAffectedModules } = impactAnalysis[packageName];
    
    // Create a test configuration based on the update type and affected modules
    if (packageType === 'node') {
      // Configure Jest for Node.js packages
      testConfigs[packageName] = {
        runner: 'jest',
        testFiles: testFiles,
        testPatterns: directlyAffectedModules.map(module => `--testPathPattern=packages/${module}`),
        updateType,
        packageType,
      };
    } else if (packageType === 'python') {
      // Configure pytest for Python packages
      testConfigs[packageName] = {
        runner: 'pytest',
        testFiles: testFiles,
        testPatterns: directlyAffectedModules.map(module => `packages/${module}/tests/`),
        updateType,
        packageType,
      };
    }
  });
  
  return testConfigs;
}

// Main execution
try {
  // Build dependency map
  const dependencyMap = buildDependencyMap();
  
  // Map test files to source files
  const mappedDependencyMap = mapTestsToSourceFiles(dependencyMap);
  
  // Generate impact analysis
  const impactAnalysis = generateImpactAnalysis(mappedDependencyMap);
  
  // Generate test configurations
  const testConfigurations = generateTestConfigurations(impactAnalysis);
  
  // Save results
  const output = {
    impactAnalysis,
    testConfigurations,
    timestamp: new Date().toISOString(),
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`Impact analysis completed and saved to ${OUTPUT_FILE}`);
} catch (error) {
  console.error(`Error during impact analysis: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
}