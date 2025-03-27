import React from 'react';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import AgentDashboard from '../components/agents/AgentDashboard';

/**
 * Agents Page
 * 
 * Entry point for the AI agents features in the KAI platform.
 * Provides access to various agent capabilities for materials, 
 * recognition, and project management.
 */
const AgentsPage: React.FC = () => {
  const pageContent = (
    <>
      <SEO 
        title="AI Agents" 
        description="Intelligent AI assistants for material recognition, material expertise, and project management" 
      />
      <AgentDashboard />
    </>
  );
  
  return (
    <Layout children={pageContent} />
  );
};

export default AgentsPage;