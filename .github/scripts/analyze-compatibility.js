/**
 * Dependency Compatibility Analyzer
 * 
 * Uses OpenAI to analyze dependency updates for potential breaking changes,
 * configuration impacts, and compatibility risks.
 */

const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const semver = require('semver');

// Configuration
const DEPENDENCY_UPDATES_FILE = path.resolve(process.cwd(), '.github/dependency-updates.json');
const CONFIG_FILES = [
  'tsconfig.json',
  'babel.config.js',
  '.babelrc',
  'webpack.config.js',
  '.eslintrc',
  'jest.config.js',
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'Dockerfile',
  'docker-compose.yml',
  'helm-charts/**/values.yaml',
  'kubernetes/**/*.yaml',
  '.env.example'
];

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Load dependency updates
 */
function loadDependencyUpdates() {
  try {
    const data = fs.readFileSync(DEPENDENCY_UPDATES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading dependency updates: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Find all configuration files in the project
 */
function findConfigFiles() {
  const foundConfigFiles = [];
  
  CONFIG_FILES.forEach(pattern => {
    try {
      // Handle glob patterns
      if (pattern.includes('*')) {
        const files = require('glob').sync(pattern);
        foundConfigFiles.push(...files);
      } else if (fs.existsSync(pattern)) {
        foundConfigFiles.push(pattern);
      }
    } catch (error) {
      console.warn(`Error checking config file ${pattern}: ${error.message}`);
    }
  });
  
  return foundConfigFiles;
}

/**
 * Analyze package for compatibility using OpenAI
 */
async function analyzePackageCompatibility(pkg, configFiles) {
  const { name, current, latest, updateType, packageType } = pkg;
  
  console.log(`Analyzing compatibility for ${name} (${current} → ${latest})`);
  
  try {
    // Create prompt for OpenAI
    const prompt = `Analyze the following dependency update for potential breaking changes and compatibility issues:

Package: ${name}
Current Version: ${current}
Latest Version: ${latest}
Update Type: ${updateType}
Package Type: ${packageType}

Based on the version change and known patterns for this package, please determine:

1. Is this update likely to contain breaking changes?
2. What specific areas of the codebase might be affected?
3. Are any configuration files likely to need updates?
4. How confident are you in this analysis (high/medium/low)?
5. Would you recommend this as a safe automatic update, a cautious update, or a manual update requiring code changes?

Please provide a detailed, specific analysis for this particular package and version change.`;

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1500
    });

    const content = response.choices[0].message.content;
    
    // Parse the response
    let breakingChange = false;
    let confidence = 'medium';
    let recommendation = 'caution';
    let reasoning = content;
    let affectedAreas = [];
    let configChangesNeeded = false;
    let potentialConfigFiles = [];
    
    // Extract breaking change assessment
    if (content.includes('breaking changes') || content.includes('Breaking changes')) {
      if (
        content.includes('no breaking changes') || 
        content.includes('unlikely to contain breaking changes') ||
        content.includes('should not contain breaking changes')
      ) {
        breakingChange = false;
      } else if (
        content.includes('likely to contain breaking changes') ||
        content.includes('contains breaking changes') ||
        content.includes('major breaking changes')
      ) {
        breakingChange = true;
      } else if (updateType === 'major') {
        // Default to true for major updates unless explicitly stated otherwise
        breakingChange = true;
      }
    } else if (updateType === 'major') {
      // Default to true for major updates
      breakingChange = true;
    }
    
    // Extract confidence level
    if (content.includes('high confidence') || content.includes('High confidence')) {
      confidence = 'high';
    } else if (content.includes('low confidence') || content.includes('Low confidence')) {
      confidence = 'low';
    }
    
    // Extract recommendation
    if (
      content.includes('safe automatic update') || 
      content.includes('safe update') ||
      content.includes('recommend this as a safe')
    ) {
      recommendation = 'safe';
    } else if (
      content.includes('manual update') || 
      content.includes('requires manual') ||
      content.includes('manual review')
    ) {
      recommendation = 'manual-update';
    }
    
    // Default recommendation based on update type if not clearly stated
    if (!content.includes('recommend')) {
      if (updateType === 'patch') {
        recommendation = 'safe';
      } else if (updateType === 'major') {
        recommendation = 'manual-update';
      }
    }
    
    // Extract affected areas
    const areasMatch = content.match(/affected areas?[:\s]+([\s\S]+?)(?=\n\n|\n[A-Z]|$)/i);
    if (areasMatch) {
      const areasText = areasMatch[1];
      affectedAreas = areasText
        .split(/[,\n]/)
        .map(area => area.trim())
        .filter(area => area && !area.includes(':') && area.length > 2);
    }
    
    // Check for configuration changes
    if (
      content.includes('configuration files') || 
      content.includes('config files') ||
      content.includes('configuration changes')
    ) {
      if (
        !content.includes('no configuration changes') && 
        !content.includes('configuration files are not likely')
      ) {
        configChangesNeeded = true;
        
        // Extract potential config files
        configFiles.forEach(file => {
          if (content.includes(path.basename(file))) {
            potentialConfigFiles.push(file);
          }
        });
      }
    }
    
    // Create analysis object
    const analysis = {
      breakingChange,
      confidence,
      reasoning: content.slice(0, 500), // Limit reasoning to 500 chars
      affectedAreas: affectedAreas.slice(0, 5), // Limit to 5 areas
      configChangesNeeded,
      recommendation,
      potentialConfigFiles
    };
    
    return analysis;
  } catch (error) {
    console.error(`Error analyzing ${name}: ${error.message}`);
    
    // Provide a conservative default analysis
    return {
      breakingChange: updateType === 'major',
      confidence: 'low',
      reasoning: `Failed to analyze due to API error: ${error.message}`,
      affectedAreas: [],
      configChangesNeeded: updateType === 'major',
      recommendation: updateType === 'patch' ? 'safe' : 'manual-update',
      potentialConfigFiles: []
    };
  }
}

/**
 * Main function to analyze all packages
 */
async function analyzeAllPackages() {
  // Load dependency updates
  const updates = loadDependencyUpdates();
  
  // Find configuration files
  const configFiles = findConfigFiles();
  console.log(`Found ${configFiles.length} configuration files`);
  
  // Analyze each package
  for (let i = 0; i < updates.packages.length; i++) {
    const pkg = updates.packages[i];
    
    // Skip analysis for packages with low importance
    if (
      pkg.updateType === 'patch' && 
      !pkg.name.includes('react') && 
      !pkg.name.includes('webpack') && 
      !pkg.name.includes('babel') && 
      !pkg.name.includes('eslint') && 
      !pkg.name.includes('typescript')
    ) {
      // For most patch updates, don't use API call - just mark as safe
      updates.packages[i].analysis = {
        breakingChange: false,
        confidence: 'high',
        reasoning: 'Patch update, unlikely to contain breaking changes.',
        affectedAreas: [],
        configChangesNeeded: false,
        recommendation: 'safe',
        potentialConfigFiles: []
      };
      console.log(`Skipping detailed analysis for patch update: ${pkg.name}`);
      continue;
    }
    
    // Analyze package compatibility
    const analysis = await analyzePackageCompatibility(pkg, configFiles);
    updates.packages[i].analysis = analysis;
    
    // Add small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Update summary based on analysis
  updates.summary.safe = updates.packages.filter(pkg => pkg.analysis?.recommendation === 'safe').length;
  updates.summary.caution = updates.packages.filter(pkg => pkg.analysis?.recommendation === 'caution').length;
  updates.summary.manualUpdate = updates.packages.filter(pkg => pkg.analysis?.recommendation === 'manual-update').length;
  
  // Save updated data
  fs.writeFileSync(DEPENDENCY_UPDATES_FILE, JSON.stringify(updates, null, 2));
  
  console.log(`Analyzed ${updates.packages.length} packages:`);
  console.log(`- Safe: ${updates.summary.safe}`);
  console.log(`- Caution: ${updates.summary.caution}`);
  console.log(`- Manual Review: ${updates.summary.manualUpdate}`);
}

// Run analysis
analyzeAllPackages().catch(error => {
  console.error(`Error analyzing packages: ${error.message}`);
  process.exit(1);
});