import React from 'react';
import styled from '@emotion/styled';
import RecognitionPanel from './RecognitionPanel';
import MaterialExpertPanel from './MaterialExpertPanel';
import ProjectAssistantPanel from './ProjectAssistantPanel';
import AnalyticsPanel from './AnalyticsPanel';

type AgentType = 'recognition' | 'material' | 'project' | 'analytics';

/**
 * AgentDashboard Component
 * 
 * Unified dashboard for accessing different crewAI agent capabilities.
 * Provides a single interface for switching between specialized agents.
 */
const AgentDashboard: React.FC = () => {
  // State for the currently selected agent
  const [selectedAgent, setSelectedAgent] = React.useState<AgentType>('recognition');
  
  // Handle agent selection
  const handleAgentSelection = (agent: AgentType) => {
    setSelectedAgent(agent);
  };
  
  return (
    <DashboardContainer>
      <DashboardHeader>
        <HeaderTitle>KAI Intelligent Assistance</HeaderTitle>
        <HeaderSubtitle>
          Powered by crewAI agents specialized for material recognition, project management, and analytics
        </HeaderSubtitle>
      </DashboardHeader>
      
      <AgentNavigation>
        <AgentTab 
          active={selectedAgent === 'recognition'}
          onClick={() => handleAgentSelection('recognition')}
        >
          <TabIcon>🔍</TabIcon>
          <TabLabel>Recognition Assistant</TabLabel>
        </AgentTab>
        <AgentTab 
          active={selectedAgent === 'analytics'}
          onClick={() => handleAgentSelection('analytics')}
        >
          <TabIcon>📊</TabIcon>
          <TabLabel>Analytics Expert</TabLabel>
        </AgentTab>
        <AgentTab 
          active={selectedAgent === 'material'}
          onClick={() => handleAgentSelection('material')}
        >
          <TabIcon>📋</TabIcon>
          <TabLabel>Material Expert</TabLabel>
        </AgentTab>
        <AgentTab 
          active={selectedAgent === 'project'}
          onClick={() => handleAgentSelection('project')}
        >
          <TabIcon>📐</TabIcon>
          <TabLabel>Project Assistant</TabLabel>
        </AgentTab>
      </AgentNavigation>
      
      <AgentViewContainer>
        {selectedAgent === 'recognition' && <RecognitionPanel />}
        {selectedAgent === 'material' && <MaterialExpertPanel />}
        {selectedAgent === 'project' && <ProjectAssistantPanel />}
        {selectedAgent === 'analytics' && <AnalyticsPanel />}
      </AgentViewContainer>
    </DashboardContainer>
  );
};

// Styled Components
const DashboardContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
`;

const DashboardHeader = styled.header`
  text-align: center;
  margin-bottom: 2rem;
`;

const HeaderTitle = styled.h1`
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: #333;
`;

const HeaderSubtitle = styled.p`
  font-size: 1rem;
  color: #666;
`;

const AgentNavigation = styled.nav`
  display: flex;
  justify-content: center;
  margin-bottom: 2rem;
  border-bottom: 1px solid #eee;
`;

interface TabProps {
  active: boolean;
}

const AgentTab = styled.button<TabProps>`
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 1rem;
  color: ${(props: TabProps) => props.active ? '#4a90e2' : '#666'};
  font-weight: ${(props: TabProps) => props.active ? '600' : '400'};
  border-bottom: 3px solid ${(props: TabProps) => props.active ? '#4a90e2' : 'transparent'};
  transition: all 0.2s ease;
  
  &:hover {
    color: ${(props: TabProps) => props.active ? '#4a90e2' : '#333'};
  }
`;

const TabIcon = styled.span`
  font-size: 1.25rem;
  margin-right: 0.5rem;
`;

const TabLabel = styled.span`
  font-size: 1rem;
`;

const AgentViewContainer = styled.div`
  flex: 1;
`;

export default AgentDashboard;