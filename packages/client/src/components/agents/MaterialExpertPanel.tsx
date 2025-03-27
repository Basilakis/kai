import React from 'react';
import styled from '@emotion/styled';
import AgentChat from './AgentChat';
import agentService, { AgentType, AgentMessage } from '../../services/agentService';

interface MaterialProperty {
  name: string;
  value: string;
  description?: string;
}

interface MaterialDetails {
  id: string;
  name: string;
  type: string;
  image: string;
  description: string;
  properties: MaterialProperty[];
  applications: string[];
  careInstructions: string[];
  alternativeMaterials: string[];
}

/**
 * MaterialExpertPanel component
 * 
 * Provides an interface for users to interact with the Material Expert agent,
 * getting detailed information about materials, their properties, applications,
 * and care instructions.
 */
const MaterialExpertPanel: React.FC = () => {
  // State for UI management
  const [selectedMaterial, setSelectedMaterial] = React.useState<MaterialDetails | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isMaterialLoading, setIsMaterialLoading] = React.useState(false);
  
  // Initial messages for the agent
  const initialMessages: AgentMessage[] = [
    {
      id: 'welcome',
      content: "Hello! I'm your Material Expert. I can provide detailed information about various building materials, their properties, applications, and maintenance requirements. What materials would you like to learn about today?",
      sender: 'agent' as const,
      timestamp: new Date()
    }
  ];
  
  // Sample material data for demonstration purposes
  const sampleMaterials: MaterialDetails[] = [
    {
      id: 'marble-1',
      name: 'Carrara Marble',
      type: 'Natural Stone',
      image: '/images/materials/carrara-marble.jpg',
      description: 'Carrara marble is a high-quality Italian marble with a white or blue-grey background and soft grey veining. It has been used for sculpture and building decoration for thousands of years.',
      properties: [
        { name: 'Hardness', value: '3-4 Mohs', description: 'Medium-soft stone that can scratch relatively easily' },
        { name: 'Porosity', value: 'Medium', description: 'Requires regular sealing to prevent staining' },
        { name: 'Heat Resistance', value: 'High', description: 'Can withstand high temperatures without damage' },
        { name: 'Chemical Sensitivity', value: 'High', description: 'Sensitive to acids and harsh chemicals' }
      ],
      applications: [
        'Countertops (with proper sealing)',
        'Floor tiles',
        'Wall cladding',
        'Bathroom vanities',
        'Fireplace surrounds',
        'Sculpture and decorative elements'
      ],
      careInstructions: [
        'Seal every 6-12 months',
        'Clean with pH-neutral, non-abrasive cleaners',
        'Wipe up spills immediately, especially acidic liquids',
        'Use cutting boards and trivets to protect the surface',
        'Avoid harsh cleaners containing lemon, vinegar, or other acids'
      ],
      alternativeMaterials: [
        'Quartz (more durable, less maintenance)',
        'Porcelain (stain-resistant alternative)',
        'Quartzite (harder natural stone)',
        'White granite (more durable natural stone)'
      ]
    },
    {
      id: 'porcelain-1',
      name: 'Large Format Porcelain',
      type: 'Ceramic Material',
      image: '/images/materials/porcelain-tile.jpg',
      description: 'Large format porcelain tiles are manufactured ceramic tiles that offer exceptional durability, water resistance, and design versatility. They are made from fine porcelain clays fired at high temperatures.',
      properties: [
        { name: 'Hardness', value: '7-8 Mohs', description: 'Very hard and resistant to scratching' },
        { name: 'Porosity', value: 'Very Low', description: 'Water absorption rate below 0.5%' },
        { name: 'Frost Resistance', value: 'Excellent', description: 'Can be used in freeze-thaw environments' },
        { name: 'Stain Resistance', value: 'High', description: 'Non-porous surface resists staining' }
      ],
      applications: [
        'Floor tiles for high-traffic areas',
        'Wall cladding',
        'Shower and bathroom surfaces',
        'Kitchen backsplashes',
        'Countertops (porcelain slabs)',
        'Outdoor paving'
      ],
      careInstructions: [
        'Clean with mild detergent and water',
        'No sealing required in most cases',
        'Use non-abrasive cleaners to avoid surface damage',
        'Clean grout lines regularly to prevent discoloration',
        'Spot-clean stains as soon as possible'
      ],
      alternativeMaterials: [
        'Ceramic tile (more affordable but less durable)',
        'Natural stone (more unique patterns but requires maintenance)',
        'Luxury vinyl tile (softer underfoot)',
        'Engineered quartz (for countertop applications)'
      ]
    }
  ];
  
  // Function to handle selecting a material example
  const handleSelectMaterial = (material: MaterialDetails) => {
    setSelectedMaterial(material);
    
    // In a real implementation, this would trigger an agent message about the selected material
    // For demo purposes, we'll simulate this behavior
  };
  
  // Track agent session and messages
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [agentMessages, setAgentMessages] = React.useState<AgentMessage[]>(initialMessages);
  const [connectionStatus, setConnectionStatus] = React.useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [isRetrying, setIsRetrying] = React.useState(false);

  // Initialize agent session
  React.useEffect(() => {
    let mounted = true;
    let currentSessionId: string | null = null;
    
    // Create agent session when component mounts
    const initSession = async () => {
      try {
        setConnectionStatus('connecting');
        setError(null);
        setIsLoading(true);
        
        const newSessionId = await agentService.createSession(AgentType.MATERIAL_EXPERT);
        
        // Only update state if component is still mounted
        if (mounted) {
          setSessionId(newSessionId);
          currentSessionId = newSessionId;
          setConnectionStatus('connected');
          
          // Get initial messages from the session if we don't have custom ones
          if (initialMessages.length === 0) {
            setAgentMessages(agentService.getMessages(newSessionId));
          }
          
          // Set up websocket listener for real-time updates
          agentService.onAgentMessage(newSessionId, (message) => {
            setAgentMessages(prev => [...prev, message]);
            setIsLoading(false);
          });
        }
      } catch (error) {
        console.error('Error creating agent session:', error);
        if (mounted) {
          setConnectionStatus('disconnected');
          setError('Failed to connect to the agent service. Please try again.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    initSession();
    
    // Cleanup session on unmount
    return () => {
      mounted = false;
      if (currentSessionId) {
        // Properly remove event listeners to prevent memory leaks
        agentService.offAgentMessage(currentSessionId);
        
        // Close the session
        agentService.closeSession(currentSessionId).catch(err => 
          console.error('Error closing session:', err)
        );
      }
    };
  }, [initialMessages.length]);

  // Retry connection to agent service
  const handleRetryConnection = async () => {
    setIsRetrying(true);
    try {
      // Close existing session if any
      if (sessionId) {
        await agentService.closeSession(sessionId);
      }
      
      // Clear messages and error
      setAgentMessages(initialMessages);
      setError(null);
      setConnectionStatus('connecting');
      
      // Create new session
      const newSessionId = await agentService.createSession(AgentType.MATERIAL_EXPERT);
      setSessionId(newSessionId);
      setConnectionStatus('connected');
      
      // Set up websocket listener
      agentService.onAgentMessage(newSessionId, (message) => {
        setAgentMessages(prev => [...prev, message]);
        setIsLoading(false);
      });
    } catch (error) {
      console.error('Error retrying connection:', error);
      setConnectionStatus('disconnected');
      setError('Failed to connect to the agent service. Please try again later.');
    } finally {
      setIsRetrying(false);
    }
  };

  // Handle user messages to the agent
  const handleUserMessage = async (message: string) => {
    if (connectionStatus !== 'connected') {
      setError('Cannot send message while disconnected. Please reconnect first.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    // Check material-specific keywords for UI interaction
    const lowercaseMessage = message.toLowerCase();
    
    if (lowercaseMessage.includes('marble') && sampleMaterials[0]) {
      setIsMaterialLoading(true);
      handleSelectMaterial(sampleMaterials[0]);
      setIsMaterialLoading(false);
    } else if (lowercaseMessage.includes('porcelain') && sampleMaterials[1]) {
      setIsMaterialLoading(true);
      handleSelectMaterial(sampleMaterials[1]);
      setIsMaterialLoading(false);
    }
    
    // Send message to agent service
    if (sessionId) {
      try {
        await agentService.sendMessage(sessionId, message);
        
        // No need to manually update messages here as the websocket listener will handle it
      } catch (error) {
        console.error('Error sending message to agent:', error);
        setError('Failed to send message. Please try again.');
        setIsLoading(false);
      }
    } else {
      setError('No active session. Please try reconnecting.');
      setIsLoading(false);
    }
  };

  return (
    <PanelContainer>
      <MaterialSection>
        {error && (
          <ErrorBanner>
            <ErrorIcon>⚠️</ErrorIcon>
            <ErrorMessage>{error}</ErrorMessage>
            {connectionStatus === 'disconnected' && (
              <RetryButton 
                onClick={handleRetryConnection} 
                disabled={isRetrying}
              >
                {isRetrying ? 'Reconnecting...' : 'Reconnect'}
              </RetryButton>
            )}
            <CloseButton onClick={() => setError(null)}>×</CloseButton>
          </ErrorBanner>
        )}
        
        <ConnectionStatusIndicator status={connectionStatus}>
          {connectionStatus === 'connected' ? '🟢 Connected' : 
           connectionStatus === 'connecting' ? '🟡 Connecting...' : '🔴 Disconnected'}
        </ConnectionStatusIndicator>
        <SectionHeader>
          <SectionTitle>Material Encyclopedia</SectionTitle>
          <SectionSubtitle>
            Explore materials or ask the expert about specific properties
          </SectionSubtitle>
        </SectionHeader>
        
        <MaterialExamples>
          <ExamplesTitle>Popular Materials</ExamplesTitle>
          <ExamplesList>
            {sampleMaterials.map(material => (
              <MaterialCard 
                key={material.id}
                onClick={() => handleSelectMaterial(material)}
                active={selectedMaterial?.id === material.id}
              >
                <MaterialImage>
                  <MaterialImagePlaceholder>{material.name.charAt(0)}</MaterialImagePlaceholder>
                </MaterialImage>
                <MaterialName>{material.name}</MaterialName>
                <MaterialType>{material.type}</MaterialType>
              </MaterialCard>
            ))}
          </ExamplesList>
        </MaterialExamples>
        
        {selectedMaterial && (
          <MaterialDetailSection>
            <DetailHeader>
              <DetailTitle>{selectedMaterial.name}</DetailTitle>
              <DetailType>{selectedMaterial.type}</DetailType>
            </DetailHeader>
            
            <DetailContent>
              <DetailDescription>{selectedMaterial.description}</DetailDescription>
              
              <DetailSubsection>
                <DetailSubtitle>Properties</DetailSubtitle>
                <PropertiesGrid>
                  {selectedMaterial.properties.map(prop => (
                    <PropertyItem key={prop.name}>
                      <PropertyName>{prop.name}</PropertyName>
                      <PropertyValue>{prop.value}</PropertyValue>
                      {prop.description && (
                        <PropertyDescription>{prop.description}</PropertyDescription>
                      )}
                    </PropertyItem>
                  ))}
                </PropertiesGrid>
              </DetailSubsection>
              
              <DetailSubsection>
                <DetailSubtitle>Applications</DetailSubtitle>
                <DetailList>
                  {selectedMaterial.applications.map((app, index) => (
                    <DetailListItem key={index}>{app}</DetailListItem>
                  ))}
                </DetailList>
              </DetailSubsection>
              
              <DetailSubsection>
                <DetailSubtitle>Care & Maintenance</DetailSubtitle>
                <DetailList>
                  {selectedMaterial.careInstructions.map((instruction, index) => (
                    <DetailListItem key={index}>{instruction}</DetailListItem>
                  ))}
                </DetailList>
              </DetailSubsection>
              
              <DetailSubsection>
                <DetailSubtitle>Alternative Materials</DetailSubtitle>
                <DetailList>
                  {selectedMaterial.alternativeMaterials.map((alt, index) => (
                    <DetailListItem key={index}>{alt}</DetailListItem>
                  ))}
                </DetailList>
              </DetailSubsection>
            </DetailContent>
          </MaterialDetailSection>
        )}
      </MaterialSection>
      
      {isMaterialLoading && (
        <LoadingOverlay>
          <Spinner />
          <LoadingText>Loading material details...</LoadingText>
        </LoadingOverlay>
      )}
      
      <AgentSection>
        <AgentHeader>
          <AgentTitle>Material Expert</AgentTitle>
          <AgentSubtitle>
            Ask questions about material properties, applications, and more
          </AgentSubtitle>
        </AgentHeader>
        
        <AgentChatContainer>
          <AgentChat 
            agentId="material-expert"
            agentName="Material Expert"
            agentType={AgentType.MATERIAL_EXPERT}
            initialMessages={initialMessages}
            onSend={handleUserMessage}
          />
        </AgentChatContainer>
      </AgentSection>
    </PanelContainer>
  );
};

// Styled Components
const PanelContainer = styled.div`
  display: flex;
  width: 100%;
  gap: 2rem;
  
  @media (max-width: 992px) {
    flex-direction: column;
  }
`;

const MaterialSection = styled.div`
  flex: 3;
  min-width: 0;
`;

const AgentSection = styled.div`
  flex: 2;
  min-width: 300px;
`;

const SectionHeader = styled.div`
  margin-bottom: 2rem;
  text-align: left;
`;

const SectionTitle = styled.h2`
  font-size: 1.75rem;
  margin-bottom: 0.5rem;
`;

const SectionSubtitle = styled.p`
  color: #666;
  font-size: 1rem;
`;

const AgentHeader = styled.div`
  margin-bottom: 1rem;
  text-align: left;
`;

const AgentTitle = styled.h2`
  font-size: 1.75rem;
  margin-bottom: 0.5rem;
`;

const AgentSubtitle = styled.p`
  color: #666;
  font-size: 1rem;
`;

const AgentChatContainer = styled.div`
  height: 100%;
  min-height: 500px;
`;

const MaterialExamples = styled.div`
  margin-bottom: 2rem;
`;

const ExamplesTitle = styled.h3`
  font-size: 1.25rem;
  margin-bottom: 1rem;
`;

const ExamplesList = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
`;

interface MaterialCardProps {
  active?: boolean;
}

const MaterialCard = styled.div<MaterialCardProps>`
  width: 180px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid ${(props: MaterialCardProps) => props.active ? '#4a90e2' : 'transparent'};
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

const MaterialImage = styled.div`
  height: 120px;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const MaterialImagePlaceholder = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
  color: #666;
`;

const MaterialName = styled.h4`
  font-size: 1rem;
  margin: 0.75rem 0.75rem 0.25rem;
`;

const MaterialType = styled.div`
  font-size: 0.875rem;
  color: #666;
  margin: 0 0.75rem 0.75rem;
`;

const MaterialDetailSection = styled.div`
  margin-top: 2rem;
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
`;

const DetailHeader = styled.div`
  padding: 1.25rem;
  background-color: #f9f9f9;
  border-bottom: 1px solid #eee;
`;

const DetailTitle = styled.h3`
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
`;

const DetailType = styled.div`
  font-size: 0.875rem;
  color: #666;
`;

const DetailContent = styled.div`
  padding: 1.25rem;
`;

const DetailDescription = styled.p`
  line-height: 1.5;
  margin-bottom: 1.5rem;
`;

const DetailSubsection = styled.div`
  margin-bottom: 1.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const DetailSubtitle = styled.h4`
  font-size: 1.125rem;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.5rem;
`;

const PropertiesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
`;

const PropertyItem = styled.div`
  background-color: #f9f9f9;
  border-radius: 4px;
  padding: 0.75rem;
`;

const PropertyName = styled.div`
  font-weight: 500;
  margin-bottom: 0.25rem;
`;

const PropertyValue = styled.div`
  font-size: 1.125rem;
  margin-bottom: 0.5rem;
`;

const PropertyDescription = styled.div`
  font-size: 0.875rem;
  color: #666;
  line-height: 1.4;
`;

const DetailList = styled.ul`
  list-style-type: disc;
  padding-left: 1.5rem;
  margin-top: 0.5rem;
`;

const DetailListItem = styled.li`
  margin-bottom: 0.5rem;
  line-height: 1.4;
`;

// Error handling components
const ErrorBanner = styled.div`
  display: flex;
  align-items: center;
  background-color: rgba(231, 76, 60, 0.1);
  color: #e74c3c;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  position: relative;
`;

const ErrorIcon = styled.span`
  margin-right: 0.5rem;
`;

const ErrorMessage = styled.div`
  flex: 1;
`;

const RetryButton = styled.button`
  background-color: rgba(231, 76, 60, 0.1);
  color: #e74c3c;
  border: 1px solid #e74c3c;
  border-radius: 4px;
  padding: 0.25rem 0.75rem;
  font-size: 0.8rem;
  cursor: pointer;
  margin-left: 1rem;
  transition: background-color 0.2s ease;
  
  &:hover:not(:disabled) {
    background-color: rgba(231, 76, 60, 0.2);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #e74c3c;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0 0.5rem;
  margin-left: 0.5rem;
`;

// Connection status indicator
interface ConnectionStatusProps {
  status: 'connected' | 'connecting' | 'disconnected';
}

const ConnectionStatusIndicator = styled.div<ConnectionStatusProps>`
  padding: 0.5rem;
  font-size: 0.75rem;
  text-align: center;
  margin-bottom: 1rem;
  border-radius: 4px;
  background-color: ${(props: ConnectionStatusProps) => 
    props.status === 'connected' ? 'rgba(46, 204, 113, 0.1)' : 
    props.status === 'connecting' ? 'rgba(241, 196, 15, 0.1)' : 
    'rgba(231, 76, 60, 0.1)'
  };
  color: ${(props: ConnectionStatusProps) => 
    props.status === 'connected' ? '#27ae60' : 
    props.status === 'connecting' ? '#f39c12' : 
    '#e74c3c'
  };
`;

// Loading components
const LoadingOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Spinner = styled.div`
  width: 50px;
  height: 50px;
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.div`
  font-size: 1rem;
  color: #333;
`;

export default MaterialExpertPanel;