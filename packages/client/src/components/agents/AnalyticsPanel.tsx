import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import AgentChat from './AgentChat';
import agentService, { AgentType, AgentMessage } from '../../services/agentService';

/**
 * AnalyticsPanel Component
 * 
 * Provides an interface for users to interact with the Analytics Agent,
 * getting data-driven insights, market research, and decision-making assistance.
 */
const AnalyticsPanel: React.FC = () => {
  // State for UI management
  const [activeTab, setActiveTab] = useState<'trends' | 'market' | 'decisions' | 'query'>('query');
  const [_isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_dateRange, setDateRange] = useState<{ startDate: Date | null; endDate: Date | null }>({
    startDate: null,
    endDate: null
  });
  
  // Initial messages for the agent
  const initialMessages: AgentMessage[] = [
    {
      id: 'welcome',
      content: "Hello! I'm your Analytics Agent. I can provide data-driven insights about platform usage, market trends, user behaviors, and assist with decision-making. What kind of analytics would you like to explore today?",
      sender: 'agent' as const,
      timestamp: new Date()
    }
  ];
  
  // Track agent session and messages
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [_agentMessages, setAgentMessages] = useState<AgentMessage[]>(initialMessages);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [isRetrying, setIsRetrying] = useState(false);

  // Initialize agent session
  useEffect(() => {
    let mounted = true;
    let currentSessionId: string | null = null;
    
    // Create agent session when component mounts
    const initSession = async () => {
      try {
        setConnectionStatus('connecting');
        setError(null);
        setIsLoading(true);
        
        const newSessionId = await agentService.createSession(AgentType.ANALYTICS);
        
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
      const newSessionId = await agentService.createSession(AgentType.ANALYTICS);
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
    
    // Check for analytics-specific keywords for UI interaction
    const lowercaseMessage = message.toLowerCase();
    
    if (lowercaseMessage.includes('trend') || lowercaseMessage.includes('usage')) {
      setActiveTab('trends');
    } else if (lowercaseMessage.includes('market') || lowercaseMessage.includes('competitive')) {
      setActiveTab('market');
    } else if (lowercaseMessage.includes('decision') || lowercaseMessage.includes('recommend')) {
      setActiveTab('decisions');
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
      <AnalyticsSection>
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
          <SectionTitle>Analytics Dashboard</SectionTitle>
          <SectionSubtitle>
            Explore data insights, market trends, and decision support
          </SectionSubtitle>
        </SectionHeader>
        
        <AnalyticsTabs>
          <AnalyticsTab 
            active={activeTab === 'query'} 
            onClick={() => setActiveTab('query')}
          >
            <TabIcon>🔎</TabIcon>
            <TabLabel>Query Analytics</TabLabel>
          </AnalyticsTab>
          <AnalyticsTab 
            active={activeTab === 'trends'} 
            onClick={() => setActiveTab('trends')}
          >
            <TabIcon>📈</TabIcon>
            <TabLabel>Usage Trends</TabLabel>
          </AnalyticsTab>
          <AnalyticsTab 
            active={activeTab === 'market'} 
            onClick={() => setActiveTab('market')}
          >
            <TabIcon>🌎</TabIcon>
            <TabLabel>Market Research</TabLabel>
          </AnalyticsTab>
          <AnalyticsTab 
            active={activeTab === 'decisions'} 
            onClick={() => setActiveTab('decisions')}
          >
            <TabIcon>🧠</TabIcon>
            <TabLabel>Decision Support</TabLabel>
          </AnalyticsTab>
        </AnalyticsTabs>
        
        <AnalyticsContent>
          {activeTab === 'query' && (
            <QuerySection>
              <SectionSubheader>Natural Language Analytics Queries</SectionSubheader>
              <QueryDescription>
                Ask questions about your data in plain English. Our AI will interpret your question and provide insights.
              </QueryDescription>
              <QueryExamples>
                <QueryExampleTitle>Example Questions:</QueryExampleTitle>
                <QueryExampleList>
                  <QueryExampleItem onClick={() => sessionId && handleUserMessage("What were the top 5 searched materials last month?")}>
                    What were the top 5 searched materials last month?
                  </QueryExampleItem>
                  <QueryExampleItem onClick={() => sessionId && handleUserMessage("Show me the user engagement trend over the past quarter")}>
                    Show me the user engagement trend over the past quarter
                  </QueryExampleItem>
                  <QueryExampleItem onClick={() => sessionId && handleUserMessage("Which product categories are showing the most growth?")}>
                    Which product categories are showing the most growth?
                  </QueryExampleItem>
                  <QueryExampleItem onClick={() => sessionId && handleUserMessage("Compare performance between residential and commercial projects")}>
                    Compare performance between residential and commercial projects
                  </QueryExampleItem>
                </QueryExampleList>
              </QueryExamples>
            </QuerySection>
          )}
          
          {activeTab === 'trends' && (
            <TrendsSection>
              <SectionSubheader>Usage Trends & Patterns</SectionSubheader>
              <TrendsDescription>
                View and analyze platform usage patterns, user behavior insights, and performance metrics over time.
              </TrendsDescription>
              
              <DateRangeSelector>
                <DateLabel>Date Range:</DateLabel>
                <DateButton 
                  active={true}
                  onClick={() => {
                    const endDate = new Date();
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - 30);
                    setDateRange({ startDate, endDate });
                  }}
                >
                  Last 30 Days
                </DateButton>
                <DateButton 
                  active={false}
                  onClick={() => {
                    const endDate = new Date();
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - 90);
                    setDateRange({ startDate, endDate });
                  }}
                >
                  Last Quarter
                </DateButton>
                <DateButton 
                  active={false}
                  onClick={() => {
                    const endDate = new Date();
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - 365);
                    setDateRange({ startDate, endDate });
                  }}
                >
                  Last Year
                </DateButton>
              </DateRangeSelector>
              
              <VisualizationPlaceholder>
                <PlaceholderIcon>📈</PlaceholderIcon>
                <PlaceholderText>
                  Usage trend visualizations will appear here when you ask the Analytics Agent about usage patterns, trends, or metrics.
                </PlaceholderText>
              </VisualizationPlaceholder>
              
              <MetricsGrid>
                <MetricCard>
                  <MetricTitle>Total Users</MetricTitle>
                  <MetricValue>-</MetricValue>
                  <MetricChange positive>-</MetricChange>
                </MetricCard>
                <MetricCard>
                  <MetricTitle>Active Sessions</MetricTitle>
                  <MetricValue>-</MetricValue>
                  <MetricChange positive>-</MetricChange>
                </MetricCard>
                <MetricCard>
                  <MetricTitle>Search Volume</MetricTitle>
                  <MetricValue>-</MetricValue>
                  <MetricChange negative>-</MetricChange>
                </MetricCard>
                <MetricCard>
                  <MetricTitle>Agent Interactions</MetricTitle>
                  <MetricValue>-</MetricValue>
                  <MetricChange positive>-</MetricChange>
                </MetricCard>
              </MetricsGrid>
            </TrendsSection>
          )}
          
          {activeTab === 'market' && (
            <MarketSection>
              <SectionSubheader>Market Research & Competitive Analysis</SectionSubheader>
              <MarketDescription>
                Gain insights into market trends, competitor analysis, and strategic opportunities.
              </MarketDescription>
              
              <MarketAnalysisPlaceholder>
                <PlaceholderIcon>🌎</PlaceholderIcon>
                <PlaceholderText>
                  Market analysis and competitive insights will appear here when you ask the Analytics Agent about market trends or competitive positioning.
                </PlaceholderText>
              </MarketAnalysisPlaceholder>
              
              <MarketQueries>
                <MarketQueryTitle>Ask about:</MarketQueryTitle>
                <MarketQueryList>
                  <MarketQueryItem onClick={() => sessionId && handleUserMessage("What are the emerging trends in sustainable materials?")}>
                    Emerging trends in sustainable materials
                  </MarketQueryItem>
                  <MarketQueryItem onClick={() => sessionId && handleUserMessage("How do our offerings compare to key competitors?")}>
                    Competitive positioning analysis
                  </MarketQueryItem>
                  <MarketQueryItem onClick={() => sessionId && handleUserMessage("Which market segments show the highest growth potential?")}>
                    High-growth market segments
                  </MarketQueryItem>
                  <MarketQueryItem onClick={() => sessionId && handleUserMessage("What are the key factors influencing customer material choices?")}>
                    Customer decision factors
                  </MarketQueryItem>
                </MarketQueryList>
              </MarketQueries>
            </MarketSection>
          )}
          
          {activeTab === 'decisions' && (
            <DecisionSection>
              <SectionSubheader>Decision Support & Recommendations</SectionSubheader>
              <DecisionDescription>
                Get data-driven recommendations to support strategic and operational decisions.
              </DecisionDescription>
              
              <DecisionSupportPlaceholder>
                <PlaceholderIcon>🧠</PlaceholderIcon>
                <PlaceholderText>
                  Decision support analysis and recommendations will appear here when you ask the Analytics Agent for assistance with strategic decisions.
                </PlaceholderText>
              </DecisionSupportPlaceholder>
              
              <DecisionQueries>
                <DecisionQueryTitle>Ask for decision support on:</DecisionQueryTitle>
                <DecisionQueryList>
                  <DecisionQueryItem onClick={() => sessionId && handleUserMessage("Should we focus on expanding our ceramic or natural stone inventory?")}>
                    Product inventory expansion
                  </DecisionQueryItem>
                  <DecisionQueryItem onClick={() => sessionId && handleUserMessage("Which user segments should we prioritize for marketing?")}>
                    Marketing target prioritization
                  </DecisionQueryItem>
                  <DecisionQueryItem onClick={() => sessionId && handleUserMessage("What price point would optimize our conversion rate?")}>
                    Pricing strategy optimization
                  </DecisionQueryItem>
                  <DecisionQueryItem onClick={() => sessionId && handleUserMessage("Which features should we prioritize in our next development cycle?")}>
                    Feature development roadmap
                  </DecisionQueryItem>
                </DecisionQueryList>
              </DecisionQueries>
            </DecisionSection>
          )}
        </AnalyticsContent>
      </AnalyticsSection>
      
      <AgentSection>
        <AgentHeader>
          <AgentTitle>Analytics Expert</AgentTitle>
          <AgentSubtitle>
            Ask questions about usage data, market trends, and get decision support
          </AgentSubtitle>
        </AgentHeader>
        
        <AgentChatContainer>
          <AgentChat 
            agentId="analytics-expert"
            agentName="Analytics Expert"
            agentType={AgentType.ANALYTICS}
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

const AnalyticsSection = styled.div`
  flex: 3;
  min-width: 0;
`;

const AgentSection = styled.div`
  flex: 2;
  min-width: 300px;
`;

const SectionHeader = styled.div`
  margin-bottom: 1.5rem;
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

const AnalyticsTabs = styled.div`
  display: flex;
  border-bottom: 1px solid #eee;
  margin-bottom: 2rem;
  overflow-x: auto;
  
  @media (max-width: 768px) {
    flex-wrap: nowrap;
    padding-bottom: 0.5rem;
  }
`;

interface ActiveTabProps {
  active: boolean;
}

const AnalyticsTab = styled.button<ActiveTabProps>`
  display: flex;
  align-items: center;
  padding: 0.8rem 1.25rem;
  border: none;
  background: none;
  cursor: pointer;
  white-space: nowrap;
  color: ${(props: ActiveTabProps) => props.active ? '#4a90e2' : '#666'};
  font-weight: ${(props: ActiveTabProps) => props.active ? '600' : '400'};
  border-bottom: 3px solid ${(props: ActiveTabProps) => props.active ? '#4a90e2' : 'transparent'};
  transition: all 0.2s ease;
  
  &:hover {
    color: ${(props: ActiveTabProps) => props.active ? '#4a90e2' : '#333'};
  }
`;

const TabIcon = styled.span`
  font-size: 1.1rem;
  margin-right: 0.5rem;
`;

const TabLabel = styled.span`
  font-size: 0.9rem;
`;

const AnalyticsContent = styled.div`
  padding: 1rem 0;
`;

const SectionSubheader = styled.h3`
  font-size: 1.25rem;
  margin-bottom: 0.75rem;
  color: #333;
`;

const QuerySection = styled.div``;

const QueryDescription = styled.p`
  margin-bottom: 1.5rem;
  color: #555;
  line-height: 1.5;
`;

const QueryExamples = styled.div`
  margin-top: 1.5rem;
  background: #f9f9f9;
  border-radius: 8px;
  padding: 1.25rem;
`;

const QueryExampleTitle = styled.h4`
  font-size: 1rem;
  margin-bottom: 1rem;
  color: #444;
`;

const QueryExampleList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const QueryExampleItem = styled.div`
  padding: 0.75rem;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #f0f7ff;
    border-color: #c0d9ff;
  }
`;

const TrendsSection = styled.div``;

const TrendsDescription = styled.p`
  margin-bottom: 1.5rem;
  color: #555;
  line-height: 1.5;
`;

const DateRangeSelector = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const DateLabel = styled.span`
  font-weight: 500;
  margin-right: 0.5rem;
`;

interface DateButtonProps {
  active: boolean;
}

const DateButton = styled.button<DateButtonProps>`
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: 1px solid ${(props: DateButtonProps) => props.active ? '#4a90e2' : '#ddd'};
  background: ${(props: DateButtonProps) => props.active ? '#f0f7ff' : '#fff'};
  color: ${(props: DateButtonProps) => props.active ? '#4a90e2' : '#666'};
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: ${(props: DateButtonProps) => props.active ? '500' : '400'};
  transition: all 0.2s ease;
  
  &:hover {
    background: ${(props: DateButtonProps) => props.active ? '#f0f7ff' : '#f9f9f9'};
    border-color: ${(props: DateButtonProps) => props.active ? '#4a90e2' : '#ccc'};
  }
`;

const VisualizationPlaceholder = styled.div`
  height: 250px;
  background: #f9f9f9;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  text-align: center;
  border: 1px dashed #ddd;
`;

const PlaceholderIcon = styled.div`
  font-size: 2.5rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`;

const PlaceholderText = styled.p`
  color: #777;
  font-size: 0.9rem;
  max-width: 400px;
  line-height: 1.5;
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
`;

const MetricCard = styled.div`
  background: #fff;
  border-radius: 8px;
  padding: 1.25rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  text-align: center;
`;

const MetricTitle = styled.div`
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 0.5rem;
`;

const MetricValue = styled.div`
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
`;

interface MetricChangeProps {
  positive?: boolean;
  negative?: boolean;
}

const MetricChange = styled.div<MetricChangeProps>`
  font-size: 0.85rem;
  color: ${(props: MetricChangeProps) => 
    props.positive ? '#38b86a' : 
    props.negative ? '#e74c3c' : 
    '#666'
  };
`;

const MarketSection = styled.div``;

const MarketDescription = styled.p`
  margin-bottom: 1.5rem;
  color: #555;
  line-height: 1.5;
`;

const MarketAnalysisPlaceholder = styled.div`
  height: 250px;
  background: #f9f9f9;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  text-align: center;
  border: 1px dashed #ddd;
`;

const MarketQueries = styled.div`
  margin-top: 1.5rem;
`;

const MarketQueryTitle = styled.h4`
  font-size: 1rem;
  margin-bottom: 1rem;
  color: #444;
`;

const MarketQueryList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
`;

const MarketQueryItem = styled.div`
  padding: 1rem;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #f0f7ff;
    border-color: #c0d9ff;
  }
`;

const DecisionSection = styled.div``;

const DecisionDescription = styled.p`
  margin-bottom: 1.5rem;
  color: #555;
  line-height: 1.5;
`;

const DecisionSupportPlaceholder = styled.div`
  height: 250px;
  background: #f9f9f9;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  text-align: center;
  border: 1px dashed #ddd;
`;

const DecisionQueries = styled.div`
  margin-top: 1.5rem;
`;

const DecisionQueryTitle = styled.h4`
  font-size: 1rem;
  margin-bottom: 1rem;
  color: #444;
`;

const DecisionQueryList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
`;

const DecisionQueryItem = styled.div`
  padding: 1rem;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #f0f7ff;
    border-color: #c0d9ff;
  }
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

export default AnalyticsPanel;