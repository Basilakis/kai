import React from 'react';
import styled from '@emotion/styled';
import { ThreeDDesignerPanel } from '../../components/agents/ThreeDDesignerPanel';

/**
 * 3D Designer Page
 * 
 * Provides a dedicated interface for the 3D Designer agent that can:
 * - Process room images for 3D reconstruction
 * - Detect objects using YOLO v8
 * - Estimate depth using MiDaS
 * - Segment objects and walls using SAM
 * - Search knowledge base for materials
 */
const ThreeDDesignerPage: React.FC = () => {
  return (
    <PageContainer>
      <Header>
        <Title>3D Environment Designer</Title>
        <Description>
          Create and visualize 3D environments from images or text descriptions.
          Our AI-powered system can reconstruct rooms, estimate depth, detect objects,
          and suggest materials from our knowledge base.
        </Description>
      </Header>

      <MainContent>
        <ThreeDDesignerPanel />
      </MainContent>
    </PageContainer>
  );
};

// Styled Components
const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 24px;
  background-color: #f5f5f5;
`;

const Header = styled.header`
  margin-bottom: 24px;
`;

const Title = styled.h1`
  font-size: 32px;
  font-weight: 600;
  color: #333;
  margin: 0 0 12px 0;
`;

const Description = styled.p`
  font-size: 16px;
  color: #666;
  max-width: 800px;
  line-height: 1.5;
  margin: 0;
`;

const MainContent = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

export default ThreeDDesignerPage;