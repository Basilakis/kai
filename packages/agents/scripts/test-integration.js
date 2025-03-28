/**
 * CrewAI Integration Test Script
 * 
 * This script demonstrates how to test the crewAI integration with actual KAI services.
 * Run it after setting up your environment and configuring your .env file.
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

// Mock the agent system (replace with actual imports in production)
const mockAgentSystem = {
  initializeAgentSystem: async () => {
    console.log(`${colors.blue}Initializing agent system...${colors.reset}`);
    return true;
  },
  
  connectToServices: async () => {
    console.log(`${colors.blue}Connecting to KAI services...${colors.reset}`);
    
    // Check for required environment variables
    const serviceUrls = [
      'KAI_API_URL',
      'KAI_VECTOR_DB_URL',
      'KAI_ML_SERVICE_URL'
    ];
    
    const missingUrls = serviceUrls.filter(url => !process.env[url]);
    
    if (missingUrls.length > 0) {
      console.log(`${colors.yellow}Warning: Missing service URLs:${colors.reset}`);
      missingUrls.forEach(url => console.log(`  - ${url}`));
      console.log('Using fallback mock services for missing URLs.');
    }
    
    // Simulate API checks
    const services = [
      { name: 'KAI API', url: process.env.KAI_API_URL || 'http://localhost:3000/api', status: 'available' },
      { name: 'Vector DB', url: process.env.KAI_VECTOR_DB_URL || 'http://localhost:5000/api/vector', status: 'available' },
      { name: 'ML Service', url: process.env.KAI_ML_SERVICE_URL || 'http://localhost:7000/api/ml', status: Math.random() > 0.7 ? 'unavailable' : 'available' }
    ];
    
    // Display service status
    console.log(`\n${colors.bold}Service Status:${colors.reset}`);
    services.forEach(service => {
      const statusColor = service.status === 'available' ? colors.green : colors.red;
      console.log(`  - ${service.name}: ${statusColor}${service.status}${colors.reset} (${service.url})`);
    });
    
    return services.every(s => s.status === 'available');
  },
  
  createAgent: async (config) => {
    console.log(`${colors.blue}Creating agent with ID: ${config.id}, Type: ${config.type}${colors.reset}`);
    
    // Simulate agent creation
    return {
      id: config.id,
      type: config.type,
      name: config.name || 'Agent',
      
      // Mock agent methods
      getMaterialDetails: async (materialId) => {
        console.log(`${colors.blue}Getting material details for: ${materialId}${colors.reset}`);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        return {
          status: 'success',
          materialId,
          details: {
            name: 'Sample Material',
            type: 'Ceramic',
            properties: [
              { name: 'Hardness', value: '7 Mohs' },
              { name: 'Density', value: '2.4 g/cm³' }
            ]
          }
        };
      },
      
      analyzeImage: async (imageUrl) => {
        console.log(`${colors.blue}Analyzing image: ${imageUrl}${colors.reset}`);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return {
          status: 'success',
          imageUrl,
          results: {
            detectedMaterials: ['Ceramic', 'Porcelain'],
            confidence: 0.89,
            properties: {
              color: 'Beige',
              pattern: 'Marbled'
            }
          }
        };
      }
    };
  }
};

// Main test function
async function testIntegration() {
  console.log(`\n${colors.bold}CrewAI Integration Test${colors.reset}\n`);
  
  try {
    // Step 1: Initialize the agent system
    console.log(`${colors.bold}Step 1: Initialize Agent System${colors.reset}`);
    const initialized = await mockAgentSystem.initializeAgentSystem();
    
    if (!initialized) {
      throw new Error('Failed to initialize agent system');
    }
    
    console.log(`${colors.green}✓ Agent system initialized successfully${colors.reset}\n`);
    
    // Step 2: Connect to KAI services
    console.log(`${colors.bold}Step 2: Connect to KAI Services${colors.reset}`);
    const connected = await mockAgentSystem.connectToServices();
    
    if (connected) {
      console.log(`${colors.green}✓ Successfully connected to all KAI services${colors.reset}\n`);
    } else {
      console.log(`${colors.yellow}⚠️ Connected with warnings or using fallbacks${colors.reset}\n`);
    }
    
    // Step 3: Create and test Material Expert agent
    console.log(`${colors.bold}Step 3: Test Material Expert Agent${colors.reset}`);
    const materialExpert = await mockAgentSystem.createAgent({
      id: 'test-material-expert',
      type: 'MATERIAL_EXPERT',
      name: 'Material Expert'
    });
    
    // Test material details
    console.log(`\nTesting getMaterialDetails...`);
    const materialResult = await materialExpert.getMaterialDetails('sample-material-123');
    
    console.log(`${colors.green}✓ Material details retrieved successfully${colors.reset}`);
    console.log(`Result: ${JSON.stringify(materialResult, null, 2)}\n`);
    
    // Step 4: Test image analysis
    console.log(`${colors.bold}Step 4: Test Image Analysis${colors.reset}`);
    const imageResult = await materialExpert.analyzeImage('https://example.com/sample-material.jpg');
    
    console.log(`${colors.green}✓ Image analysis completed successfully${colors.reset}`);
    console.log(`Result: ${JSON.stringify(imageResult, null, 2)}\n`);
    
    // Final results
    console.log(`${colors.bold}${colors.green}Integration Test Completed Successfully${colors.reset}`);
    console.log(`\nNext Steps:`);
    console.log(`1. Replace the mock agent system with the actual implementation`);
    console.log(`2. Implement proper error handling and retry logic`);
    console.log(`3. Add more comprehensive tests for all agent types`);
    
  } catch (error) {
    console.error(`\n${colors.red}${colors.bold}Integration Test Failed${colors.reset}`);
    console.error(`Error: ${error.message}`);
    
    // Provide troubleshooting guidance
    console.log(`\n${colors.bold}Troubleshooting:${colors.reset}`);
    console.log(`1. Check your .env file for correct service URLs`);
    console.log(`2. Ensure all KAI services are running`);
    console.log(`3. Verify your OpenAI API key is valid`);
    console.log(`4. Check network connectivity to all services`);
  }
}

// Run the test
testIntegration().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});