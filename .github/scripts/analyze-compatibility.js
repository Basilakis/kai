/**
 * Script to analyze the compatibility of package updates
 * Uses OpenAI to evaluate potential breaking changes and config file impacts
 */

const fs = require('fs');
const path = require('path');
const { OpenAIClient, AzureKeyCredential } = require('@azure/openai');

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ENDPOINT = process.env.OPENAI_ENDPOINT || 'https://api.openai.com/v1';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4';

if (!OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

// Helper to identify config files that might need updates
const CONFIG_FILE_PATTERNS = {
  // Node.js related configs
  'react': ['next.config.js', 'packages/*/next.config.js'],
  'next': ['next.config.js', 'packages/*/next.config.js'],
  'webpack': ['webpack.config.js', 'packages/*/webpack.config.js'],
  'typescript': ['tsconfig.json', 'packages/*/tsconfig.json'],
  'jest': ['jest.config.js', 'packages/*/jest.config.js'],
  'eslint': ['.eslintrc.js', '.eslintrc.json', 'packages/*/.eslintrc.js'],
  'babel': ['.babelrc', 'babel.config.js', 'packages/*/.babelrc'],
  
  // Python related configs
  'tensorflow': ['requirements.txt', 'packages/ml/requirements.txt'],
  'torch': ['requirements.txt', 'packages/ml/requirements.txt'],
  'numpy': ['requirements.txt', 'packages/ml/requirements.txt'],
  'pandas': ['requirements.txt', 'packages/ml/requirements.txt'],
  'opencv': ['requirements.txt', 'packages/ml/requirements.txt'],
  'scikit-learn': ['requirements.txt', 'packages/ml/requirements.txt'],
  'pillow': ['requirements.txt', 'packages/ml/requirements.txt'],
};

// Helper function to identify potential config files that might need updates
function findPotentialConfigFiles(packageName) {
  // Look for exact matches
  if (CONFIG_FILE_PATTERNS[packageName]) {
    return CONFIG_FILE_PATTERNS[packageName];
  }
  
  // Look for partial matches
  for (const [pattern, files] of Object.entries(CONFIG_FILE_PATTERNS)) {
    if (packageName.includes(pattern) || pattern.includes(packageName)) {
      return files;
    }
  }
  
  return [];
}

// Initialize OpenAI client
const openai = new OpenAIClient(
  OPENAI_ENDPOINT,
  new AzureKeyCredential(OPENAI_API_KEY)
);

async function analyzePackageUpdate(pkg) {
  try {
    // Prepare prompt for OpenAI
    const prompt = `
You are an expert AI package compatibility analyzer. You need to evaluate if updating a package would cause compatibility issues.

Package: ${pkg.name}
Current Version: ${pkg.current}
Target Version: ${pkg.latest}
Package Type: ${pkg.packageType} (${pkg.packageType === 'node' ? 'JavaScript/TypeScript' : 'Python'})
Update Type: ${pkg.updateType}

Please analyze:
1. Is this likely to be a breaking change? Why or why not?
2. What specific areas of an application might be affected?
3. Are there any configuration files that might need updates?
4. Would you recommend this as a safe update, or does it require careful testing?

Provide your assessment in JSON format with the following structure:
{
  "breakingChange": true/false,
  "confidence": "high"/"medium"/"low",
  "reasoning": "brief explanation",
  "affectedAreas": ["list", "of", "affected", "areas"],
  "configChangesNeeded": true/false,
  "recommendation": "safe"/"caution"/"manual-update"
}
`;

    // Call OpenAI API for analysis
    const response = await openai.getCompletions(MODEL, [prompt], {
      temperature: 0.3,
      maxTokens: 1000
    });
    
    // Parse the response
    const responseText = response.choices[0].text.trim();
    let analysis;
    
    try {
      // Extract JSON from the response (it might be wrapped in markdown code blocks)
      const jsonMatch = responseText.match(/```json\n([\s\S]*)\n```/) || 
                         responseText.match(/```\n([\s\S]*)\n```/) || 
                         [null, responseText];
      
      const jsonStr = jsonMatch[1] || responseText;
      analysis = JSON.parse(jsonStr);
    } catch (error) {
      console.error(`Error parsing OpenAI response for ${pkg.name}:`, error);
      console.log('Raw response:', responseText);
      
      // Fallback to a conservative analysis
      analysis = {
        breakingChange: pkg.updateType === 'major',
        confidence: 'low',
        reasoning: 'Failed to parse AI response, defaulting to conservative estimate based on semver',
        affectedAreas: [],
        configChangesNeeded: pkg.updateType === 'major',
        recommendation: pkg.updateType === 'major' ? 'manual-update' : 'caution'
      };
    }
    
    // Add potential config files
    const potentialConfigFiles = findPotentialConfigFiles(pkg.name);
    
    return {
      ...pkg,
      analysis: {
        ...analysis,
        potentialConfigFiles
      }
    };
  } catch (error) {
    console.error(`Error analyzing package ${pkg.name}:`, error);
    
    // Return a fallback analysis
    return {
      ...pkg,
      analysis: {
        breakingChange: pkg.updateType === 'major',
        confidence: 'low',
        reasoning: `Failed to analyze: ${error.message}`,
        affectedAreas: [],
        configChangesNeeded: pkg.updateType === 'major',
        recommendation: 'manual-update',
        potentialConfigFiles: findPotentialConfigFiles(pkg.name)
      }
    };
  }
}

async function main() {
  try {
    // Read the outdated package reports
    const nodeReport = JSON.parse(fs.readFileSync('outdated-report.json', 'utf8'));
    const pythonReport = JSON.parse(fs.readFileSync('python-outdated-report.json', 'utf8'));
    
    // Combine packages
    const allPackages = [
      ...nodeReport.packages,
      ...pythonReport.packages
    ];
    
    console.log(`Analyzing compatibility for ${allPackages.length} packages...`);
    
    // Analyze each package (with rate limiting for API calls)
    const analyzedPackages = [];
    for (const pkg of allPackages) {
      console.log(`Analyzing ${pkg.name} (${pkg.current} -> ${pkg.latest})...`);
      const analyzed = await analyzePackageUpdate(pkg);
      analyzedPackages.push(analyzed);
      
      // Simple rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Generate the compatibility report
    const compatibilityReport = {
      timestamp: new Date().toISOString(),
      summary: {
        total: analyzedPackages.length,
        safe: analyzedPackages.filter(p => p.analysis.recommendation === 'safe').length,
        caution: analyzedPackages.filter(p => p.analysis.recommendation === 'caution').length,
        manualUpdate: analyzedPackages.filter(p => p.analysis.recommendation === 'manual-update').length
      },
      packages: analyzedPackages
    };
    
    // Write the report to file
    fs.writeFileSync('compatibility-report.json', JSON.stringify(compatibilityReport, null, 2));
    console.log(`Successfully analyzed ${analyzedPackages.length} packages`);
    
  } catch (error) {
    console.error('Error in compatibility analysis:', error);
    process.exit(1);
  }
}

main();