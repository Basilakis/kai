# CrewAI Integration - Installation Guide

## Prerequisites
- Node.js 16+
- Yarn or npm
- OpenAI API key
- KAI platform services running

## Installation

1. **Install dependencies**

```bash
cd packages/agents
yarn install
```

2. **Create environment file**

Create a `.env` file in the `packages/agents` directory:

```
# Required
OPENAI_API_KEY=your_openai_api_key

# KAI Services (change URLs as needed for your environment)
KAI_API_URL=http://localhost:3000/api
KAI_VECTOR_DB_URL=http://localhost:5000/api/vector
KAI_ML_SERVICE_URL=http://localhost:7000/api/ml

# Optional
OPENAI_DEFAULT_MODEL=gpt-4
OPENAI_TEMPERATURE=0.7
ENABLE_MOCK_FALLBACK=true
LOG_LEVEL=info
```

3. **Initialize in your application**

```typescript
import { 
  initializeAgentSystem, 
  connectToServices, 
  createAgent 
} from '@kai/agents';
import { AgentType } from '@kai/agents/core/types';

// Initialize with environment variables
await initializeAgentSystem();

// Connect to KAI services
await connectToServices();

// Create and use agents
const agent = await createAgent({
  id: 'recognition-1',
  name: 'Recognition Assistant',
  type: AgentType.RECOGNITION
});
```

## Verification

To verify your installation is working:

1. Check that all dependencies are installed
2. Confirm environment variables are set correctly
3. Look for log messages in the console and in the logs directory

## Troubleshooting

- **Missing dependencies errors**: Make sure you've run `yarn install`
- **Authentication errors**: Verify your OPENAI_API_KEY is correct
- **Connection errors**: Ensure KAI services are running at the configured URLs
- **Type errors**: These will be resolved once dependencies are installed

## For More Information

See [Next Steps Documentation](./agents-crewai-next-steps.md) for complete details on implementation and further development steps.