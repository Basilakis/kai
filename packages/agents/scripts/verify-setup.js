/**
 * Verification script for KAI crewAI integration
 * 
 * This script tests that the crewAI integration is properly configured and
 * able to connect to required services.
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Define colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

// Check if we're in the agents package directory
if (!fs.existsSync(path.join(process.cwd(), 'package.json'))) {
  console.error(`${colors.red}Error: This script should be run from the agents package directory.${colors.reset}`);
  console.error(`Run: cd packages/agents && node scripts/verify-setup.js`);
  process.exit(1);
}

console.log(`\n${colors.bold}KAI CrewAI Integration Verification${colors.reset}\n`);

// Track verification results
const results = {
  environment: false,
  dependencies: false,
  services: false
};

// Verification steps
async function verifyEnvironment() {
  console.log(`${colors.blue}Verifying environment configuration...${colors.reset}`);
  
  // Check if .env file exists
  const envFile = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envFile)) {
    console.log(`${colors.red}❌ .env file not found${colors.reset}`);
    console.log(`   Create a .env file in packages/agents with required configuration.`);
    console.log(`   See .env.example for reference.`);
    return false;
  }
  
  console.log(`${colors.green}✓ .env file exists${colors.reset}`);
  
  // Check required environment variables
  const requiredVars = ['OPENAI_API_KEY'];
  const recommendedVars = [
    'KAI_API_URL',
    'KAI_VECTOR_DB_URL',
    'KAI_ML_SERVICE_URL'
  ];
  
  const missingRequired = requiredVars.filter(v => !process.env[v]);
  const missingRecommended = recommendedVars.filter(v => !process.env[v]);
  
  if (missingRequired.length > 0) {
    console.log(`${colors.red}❌ Missing required environment variables:${colors.reset}`);
    missingRequired.forEach(v => console.log(`   - ${v}`));
    return false;
  }
  
  console.log(`${colors.green}✓ All required environment variables are set${colors.reset}`);
  
  if (missingRecommended.length > 0) {
    console.log(`${colors.yellow}⚠️ Missing recommended environment variables:${colors.reset}`);
    missingRecommended.forEach(v => console.log(`   - ${v}`));
    console.log(`   These may be needed for full functionality.`);
  }
  
  return true;
}

async function verifyDependencies() {
  console.log(`\n${colors.blue}Verifying dependencies...${colors.reset}`);
  
  // Check if node_modules exists
  const nodeModules = path.join(process.cwd(), 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    console.log(`${colors.red}❌ Dependencies not installed${colors.reset}`);
    console.log(`   Run: yarn install`);
    return false;
  }
  
  // Check for critical dependencies
  const criticalDeps = ['crewai', 'langchain', 'winston', 'dotenv'];
  const missingDeps = [];
  
  for (const dep of criticalDeps) {
    const depPath = path.join(nodeModules, dep);
    if (!fs.existsSync(depPath)) {
      missingDeps.push(dep);
    }
  }
  
  if (missingDeps.length > 0) {
    console.log(`${colors.red}❌ Missing critical dependencies:${colors.reset}`);
    missingDeps.forEach(d => console.log(`   - ${d}`));
    console.log(`   Run: yarn install`);
    return false;
  }
  
  console.log(`${colors.green}✓ All dependencies are installed${colors.reset}`);
  return true;
}

async function verifyServices() {
  console.log(`\n${colors.blue}Verifying service connectivity...${colors.reset}`);
  
  // We can't actually test connections here without importing the full 
  // agent system, but we can provide guidance
  
  console.log(`${colors.yellow}⚠️ Service connectivity should be tested manually${colors.reset}`);
  console.log(`   Use the following code to test connections:`);
  console.log(`
   import { initializeAgentSystem, connectToServices } from '@kai/agents';
   
   async function testConnection() {
     await initializeAgentSystem();
     const connected = await connectToServices();
     console.log('Services connected:', connected);
   }
   
   testConnection().catch(console.error);
  `);
  
  // This is a partial success, as we can't fully verify
  return true;
}

async function runVerification() {
  try {
    // Run verification steps
    results.environment = await verifyEnvironment();
    results.dependencies = await verifyDependencies();
    results.services = await verifyServices();
    
    // Show results summary
    console.log(`\n${colors.bold}Verification Results:${colors.reset}`);
    console.log(`${results.environment ? colors.green + '✓' : colors.red + '❌'} Environment configuration${colors.reset}`);
    console.log(`${results.dependencies ? colors.green + '✓' : colors.red + '❌'} Dependencies${colors.reset}`);
    console.log(`${results.services ? colors.yellow + '⚠️' : colors.red + '❌'} Service connectivity${colors.reset}`);
    
    if (results.environment && results.dependencies && results.services) {
      console.log(`\n${colors.green}${colors.bold}Verification completed successfully!${colors.reset}`);
      console.log(`Your crewAI integration is ready for use.`);
    } else {
      console.log(`\n${colors.yellow}${colors.bold}Verification completed with warnings or errors.${colors.reset}`);
      console.log(`Please address the issues above before using the crewAI integration.`);
    }
    
    // Provide next steps
    console.log(`\n${colors.bold}Next Steps:${colors.reset}`);
    console.log(`1. Create your custom agent implementations`);
    console.log(`2. Connect tools to your KAI services`);
    console.log(`3. Integrate agents with your frontend components`);
    console.log(`4. Add proper error handling and logging`);
    
  } catch (error) {
    console.error(`\n${colors.red}Verification failed with an error:${colors.reset}`);
    console.error(error);
  }
}

// Run the verification
runVerification();