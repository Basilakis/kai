import React, { useState, useCallback } from 'react';
import styled from '@emotion/styled';
import AgentChat from './AgentChat';
import { AgentType } from '../../services/agentService';

interface ThreeDDesignerPanelProps {
  className?: string;
}

/**
 * ThreeDDesignerPanel Component
 * 
 * Provides a specialized interface for the 3D Designer agent that can:
 * - Process room images for 3D reconstruction using HorizonNet + CubeMap
 * - Detect objects using YOLO v8
 * - Estimate depth using MiDaS
 * - Segment objects and walls using SAM
 * - Search knowledge base for materials
 */
export const ThreeDDesignerPanel: React.FC<ThreeDDesignerPanelProps> = ({ className }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [reconstructionData, setReconstructionData] = useState<any>(null);

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
      setReconstructionData(null);
    }
  }, []);

  // Handle file drop
  const handleDrop = useCallback((event: { preventDefault: () => void; dataTransfer: DataTransfer }) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
      setReconstructionData(null);
    }
  }, []);

  // Prevent default drag behavior
  const handleDragOver = useCallback((event: { preventDefault: () => void }) => {
    event.preventDefault();
  }, []);

  return (
    <Container className={className}>
      <Title>3D Environment Designer</Title>
      
      <ContentArea>
        <VisualizationArea>
          <UploadArea 
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {preview ? (
              <PreviewImage src={preview} alt="Room preview" />
            ) : (
              <UploadPrompt>
                <UploadIcon>📸</UploadIcon>
                <UploadText>
                  Drag and drop an image here or click to select
                  <FileInput 
                    type="file" 
                    onChange={handleFileSelect}
                    accept="image/*"
                  />
                </UploadText>
              </UploadPrompt>
            )}
          </UploadArea>

          {reconstructionData && (
            <ReconstructionView>
              {/* 3D reconstruction view will be implemented here */}
              <canvas />
            </ReconstructionView>
          )}
        </VisualizationArea>

        <AgentInteractionArea>
          <AgentChat 
            agentId="3d-designer"
            agentType={AgentType.THREE_D_DESIGNER}
            agentName="3D Designer"
            agentAvatar="/images/agents/3d-designer-agent.png"
            placeholder="Describe what you'd like to create or modify..."
          />
        </AgentInteractionArea>
      </ContentArea>

      <ControlPanel>
        <ControlButton 
          disabled={!selectedFile || processing}
          onClick={() => {/* Process room reconstruction */}}
        >
          Process Room
        </ControlButton>
        <ControlButton 
          disabled={!reconstructionData || processing}
          onClick={() => {/* Generate variations */}}
        >
          Generate Variations
        </ControlButton>
        <ControlButton 
          disabled={!reconstructionData || processing}
          onClick={() => {/* Export scene */}}
        >
          Export Scene
        </ControlButton>
      </ControlPanel>
    </Container>
  );
};

// Styled Components
const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  gap: 20px;
  background-color: #f5f5f5;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin: 0;
`;

const ContentArea = styled.div`
  display: flex;
  flex: 1;
  gap: 20px;
  min-height: 0;
  
  @media (max-width: 1024px) {
    flex-direction: column;
  }
`;

const VisualizationArea = styled.div`
  flex: 2;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const UploadArea = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  border: 2px dashed #ccc;
  border-radius: 8px;
  background-color: #fafafa;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    border-color: #666;
    background-color: #f0f0f0;
  }
`;

const UploadPrompt = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
`;

const UploadIcon = styled.div`
  font-size: 48px;
`;

const UploadText = styled.div`
  font-size: 16px;
  color: #666;
  position: relative;
`;

const FileInput = styled.input`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
`;

const PreviewImage = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
`;

const ReconstructionView = styled.div`
  flex: 1;
  background: #000;
  canvas {
    width: 100%;
    height: 100%;
  }
`;

const AgentInteractionArea = styled.div`
  flex: 1;
  min-width: 300px;
  display: flex;
  flex-direction: column;
`;

const ControlPanel = styled.div`
  display: flex;
  gap: 12px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const ControlButton = styled.button<{ disabled?: boolean }>`
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  background-color: ${(props: { disabled?: boolean }) => props.disabled ? '#ccc' : '#4a90e2'};
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: ${(props: { disabled?: boolean }) => props.disabled ? 'not-allowed' : 'pointer'};
  transition: background-color 0.2s;
  
  &:hover:not(:disabled) {
    background-color: #357abd;
  }
`;

export default ThreeDDesignerPanel;