import React from 'react';
import { useDropzone } from 'react-dropzone';
import styled from '@emotion/styled';
import AgentChat from './AgentChat';
import agentService, { AgentType, AgentMessage } from '../../services/agentService';
import recognitionService, { RecognitionResult } from '../../services/recognitionService';

// Use RecognitionResult type from the service
type Material = RecognitionResult;

// Using AgentMessage from agentService instead of local interface

/**
 * RecognitionPanel component
 * 
 * Enhanced material recognition experience with integrated agent assistance.
 * Combines the functionality of RecognitionDemo with intelligent agent guidance.
 */
const RecognitionPanel: React.FC = () => {
  // Recognition state
  const [image, setImage] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [isRecognizing, setIsRecognizing] = React.useState(false);
  const [results, setResults] = React.useState<Material[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  
  // Agent communication state
  const [agentMessages, setAgentMessages] = React.useState<AgentMessage[]>([
    {
      id: 'welcome',
      content: "Hi there! I'm your Recognition Assistant. I can help you identify materials from images and provide guidance throughout the process. Upload an image to get started, or ask me any questions about material recognition.",
      sender: 'agent',
      timestamp: new Date()
    }
  ]);

  // Handle file drop
  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    setError(null);
    
    if (acceptedFiles.length === 0) {
      return;
    }
    
    const file = acceptedFiles[0];
    if (!file) return;
    
    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPEG, PNG, etc.)');
      
      // Agent response to error
      const agentResponse: AgentMessage = {
        id: `agent-${Date.now()}`,
        content: "I noticed the file you tried to upload isn't an image. For material recognition, we need image files like JPEG, PNG, or WebP. Could you try uploading an image file?",
        sender: 'agent',
        timestamp: new Date()
      };
      setAgentMessages(prev => [...prev, agentResponse]);
      
      return;
    }
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size should be less than 10MB');
      
      // Agent response to error
      const agentResponse: AgentMessage = {
        id: `agent-${Date.now()}`,
        content: "The image you uploaded is larger than our 10MB limit. Larger files may contain unnecessary detail that doesn't help with recognition. Could you try compressing the image or uploading a smaller one?",
        sender: 'agent',
        timestamp: new Date()
      };
      setAgentMessages(prev => [...prev, agentResponse]);
      
      return;
    }
    
    setImage(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      
      // Agent response to successful upload
      const agentResponse: AgentMessage = {
        id: `agent-${Date.now()}`,
        content: "Great! I can see your image now. When you're ready, click 'Recognize Material' and I'll analyze it for you. For best results, make sure the material is clearly visible and well-lit in the image.",
        sender: 'agent',
        timestamp: new Date()
      };
      setAgentMessages(prev => [...prev, agentResponse]);
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1
  });

  // This comment replaces the first handleRecognize implementation
  // The enhanced version below uses the agent service when available

  // Reset the demo
  const handleReset = () => {
    setImage(null);
    setPreview(null);
    setResults(null);
    setError(null);
    
    // Agent response to reset
    const agentResponse: AgentMessage = {
      id: `agent-${Date.now()}`,
      content: "I've reset the recognition process. You can upload a new image whenever you're ready.",
      sender: 'agent',
      timestamp: new Date()
    };
    setAgentMessages(prev => [...prev, agentResponse]);
  };
  
  // Handle user messages to agent - using real agent service
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [isLoadingAgent, setIsLoadingAgent] = React.useState(false);

  // Initialize agent session
  React.useEffect(() => {
    let mounted = true;
    let currentSessionId: string | null = null;
    
    const initAgentSession = async () => {
      try {
        // Using the imported agentService directly
        
        // Create a session with the Recognition Assistant
        const session = await agentService.createSession(AgentType.RECOGNITION);
        
        if (mounted) {
          setSessionId(session);
          currentSessionId = session;
          
          // Register for agent messages
          agentService.onAgentMessage(session, (message) => {
            if (mounted) {
              setAgentMessages(prev => [...prev, message]);
            }
          });
        }
        
        // No cleanup here - moved to useEffect return
      } catch (error) {
        console.error('Failed to initialize agent session:', error);
        setError('Could not connect to the Recognition Assistant. Using offline mode.');
      }
    };
    
    initAgentSession();
    
    // Cleanup function
    return () => {
      mounted = false;
      
      if (currentSessionId) {
        // Remove event listeners to prevent memory leaks
        agentService.offAgentMessage(currentSessionId);
        
        // Close the session
        agentService.closeSession(currentSessionId).catch(err => 
          console.error('Error closing session:', err)
        );
      }
    };
  }, []);

  // Handle user messages to agent
  const handleUserMessage = async (message: string) => {
    if (!sessionId) {
      // Fallback to mock mode if no session
      const mockResponse: AgentMessage = {
        id: `mock-${Date.now()}`,
        content: "I'm currently in offline mode. I can provide basic information, but my capabilities are limited.",
        sender: 'agent',
        timestamp: new Date()
      };
      
      // Add user message
      const userMessage: AgentMessage = {
        id: `user-${Date.now()}`,
        content: message,
        sender: 'user',
        timestamp: new Date()
      };
      
      setAgentMessages(prev => [...prev, userMessage, mockResponse]);
      return;
    }
    
    try {
      setIsLoadingAgent(true);
      
      // Add user message to UI immediately
      const userMessage: AgentMessage = {
        id: `user-${Date.now()}`,
        content: message,
        sender: 'user',
        timestamp: new Date()
      };
      setAgentMessages(prev => [...prev, userMessage]);
      
      // Using the imported agentService directly
      
      // Send message to agent
      await agentService.sendMessage(sessionId, message);
      
      // Agent responses will be handled by the onAgentMessage callback
    } catch (error) {
      console.error('Failed to send message to agent:', error);
      
      // Fallback response on error
      const errorResponse: AgentMessage = {
        id: `error-${Date.now()}`,
        content: "I'm sorry, I encountered an error processing your request. Please try again later.",
        sender: 'agent',
        timestamp: new Date()
      };
      
      setAgentMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoadingAgent(false);
    }
  };
  
  // Upload image to agent for processing
  const handleUploadImageToAgent = async () => {
    if (!sessionId || !image) return;
    
    try {
      setIsLoadingAgent(true);
      
      // Using the imported agentService directly
      
      // Process image with agent
      const recognitionResults = await agentService.processImage(sessionId, image);
      
      // Update results
      if (recognitionResults && recognitionResults.length > 0) {
        setResults(recognitionResults as unknown as Material[]);
      }
      
      // Agent will send its analysis through the onAgentMessage callback
    } catch (error) {
      console.error('Failed to process image with agent:', error);
      
      const errorResponse: AgentMessage = {
        id: `error-${Date.now()}`,
        content: "I'm sorry, I encountered an error processing your image. Please try uploading a different image or try again later.",
        sender: 'agent',
        timestamp: new Date()
      };
      
      setAgentMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoadingAgent(false);
    }
  };

  // Update handleRecognize with real-time feedback
  const handleRecognize = async () => {
    if (!image) {
      setError('Please upload an image first');
      return;
    }
    
    setIsRecognizing(true);
    setError(null);
    
    // Add user request message
    const userMessage: AgentMessage = {
      id: `user-${Date.now()}`,
      content: "Please analyze this image and identify the material.",
      sender: 'user',
      timestamp: new Date()
    };
    setAgentMessages(prev => [...prev, userMessage]);
    
    // Add initial agent response with typing indicator
    const typingMessageId = `typing-${Date.now()}`;
    setAgentMessages(prev => [
      ...prev, 
      {
        id: typingMessageId,
        content: "Looking at your image...",
        sender: 'agent',
        timestamp: new Date()
      }
    ]);
    
    // Analysis steps to show real-time progress
    const analysisSteps = [
      "Looking at your image...",
      "Analyzing the visual patterns and texture...",
      "Identifying material characteristics...",
      "Comparing with known materials in our database...",
      "Calculating confidence scores...",
      "Finding similar alternatives...",
      "Preparing detailed specifications..."
    ];
    
    let currentStep = 0;
    let stepInterval: number | null = null;
    
    // Function to update the typing message with current step
    const updateTypingMessage = () => {
      if (currentStep < analysisSteps.length) {
        setAgentMessages(prev => {
          const updatedMessages = [...prev];
          const typingIndex = updatedMessages.findIndex(msg => msg.id === typingMessageId);
          
          if (typingIndex !== -1) {
            // Create a safe reference and ensure all required properties are explicitly set
            const currentMsg = updatedMessages[typingIndex];
            updatedMessages[typingIndex] = {
              id: currentMsg?.id || `typing-${Date.now()}`, // Ensure id is always a string
              content: analysisSteps[currentStep] || "Analyzing...", // Update content with fallback
              sender: 'agent', // Explicitly set sender
              timestamp: currentMsg?.timestamp || new Date(), // Ensure timestamp exists
              // Only include metadata if it exists in the current message
              ...(currentMsg?.metadata ? { metadata: currentMsg.metadata } : {})
            };
          }
          
          return updatedMessages;
        });
        
        currentStep++;
      }
    };
    
    // Start the step interval - use standard setInterval (not window.setInterval)
    stepInterval = setInterval(updateTypingMessage, 1500);
    
    try {
      if (sessionId) {
        // Use agent service if we have a session
        await handleUploadImageToAgent();
        
        // Agent responses will be handled by the agent service callbacks
      } else {
        // Use the recognition service directly when no agent is available
        // Still keep the animation going for better UX
        // Let at least 3 steps display before showing results
        const minAnimationTime = Math.min(3, analysisSteps.length) * 1500;
        
        try {
          // Make API call in parallel with animation
          const recognitionPromise = recognitionService.identifyMaterial(image, {
            maxResults: 5,
            confidenceThreshold: 0.6,
            useFusion: true
          });
          
          // Ensure animation plays for a minimum time for better UX
          const timeoutPromise = new Promise<void>(resolve => 
            setTimeout(() => resolve(), minAnimationTime)
          );
          
          // Wait for both animation and API call to complete
          const [recognitionResults] = await Promise.all([
            recognitionPromise,
            timeoutPromise
          ]);
          
          // Set results in state
          setResults(recognitionResults);
          
          // Replace typing message with final analysis
          const topResult = recognitionResults && recognitionResults.length > 0 
            ? recognitionResults[0] 
            : null;
        
        setAgentMessages(prev => {
          const updatedMessages = [...prev];
          const typingIndex = updatedMessages.findIndex(msg => msg.id === typingMessageId);
          
          if (typingIndex !== -1) {
            updatedMessages[typingIndex] = {
              id: `agent-${Date.now()}`,
              content: topResult ? 
                `I've identified your material as ${topResult.name} with ${Math.round(topResult.confidence * 100)}% confidence. This is a ${topResult.specs.material.toLowerCase()} tile with a ${topResult.specs.finish.toLowerCase()} finish. The primary color is ${topResult.specs.color.toLowerCase()} and the size is ${topResult.specs.size}. Would you like to know more about this material or see alternative options?` :
                "I analyzed the image but couldn't identify the material with high confidence. Would you like to try again with a different image or angle?",
              sender: 'agent',
              timestamp: new Date()
            };
          }
          
          return updatedMessages;
        });
        } catch (error) {
          console.error('Error using recognition service:', error);
          throw error; // Re-throw to be caught by the outer catch block
        }
      }
    } catch (err) {
      // Clear the interval
      if (stepInterval) {
        clearInterval(stepInterval);
      }
      
      setError('An error occurred during recognition. Please try again.');
      
      // Replace typing message with error
      setAgentMessages(prev => {
        const updatedMessages = [...prev];
        const typingIndex = updatedMessages.findIndex(msg => msg.id === typingMessageId);
        
        if (typingIndex !== -1) {
          updatedMessages[typingIndex] = {
            id: `error-${Date.now()}`,
            content: "I'm sorry, but I encountered an error while trying to recognize the material. This could be due to image quality issues or a temporary system problem. Would you like to try again with a different image or angle?",
            sender: 'agent',
            timestamp: new Date()
          };
        }
        
        return updatedMessages;
      });
    } finally {
      // Clear the interval if it's still running
      if (stepInterval) {
        clearInterval(stepInterval);
      }
      
      setIsRecognizing(false);
    }
  };

  return (
    <RecognitionPanelContainer>
      <RecognitionSection>
        <SectionHeader>
          <SectionTitle>Material Recognition</SectionTitle>
          <SectionSubtitle>
            Upload an image of a material to identify it
          </SectionSubtitle>
        </SectionHeader>
        
        <UploadSection>
          {!preview ? (
            <Dropzone 
              {...getRootProps()} 
              active={isDragActive}
            >
              <input {...getInputProps()} />
              <DropzoneContent>
                <UploadIcon>📷</UploadIcon>
                <DropzoneText>
                  {isDragActive
                    ? 'Drop the image here'
                    : 'Drag & drop an image here, or click to select'}
                </DropzoneText>
                <DropzoneHint>
                  Supports JPEG, PNG, WebP (max 10MB)
                </DropzoneHint>
              </DropzoneContent>
            </Dropzone>
          ) : (
            <PreviewContainer>
              <ImagePreview 
                src={preview} 
                alt="Preview" 
              />
              <PreviewActions>
                <Button 
                  secondary={true}
                  onClick={handleReset}
                  disabled={isRecognizing}
                >
                  Reset
                </Button>
                <Button 
                  primary={true}
                  onClick={handleRecognize}
                  disabled={isRecognizing || isLoadingAgent}
                >
                  {isRecognizing || isLoadingAgent ? 'Processing...' : 'Recognize Material'}
                </Button>
              </PreviewActions>
            </PreviewContainer>
          )}
          
          {error && (
            <ErrorMessage>
              <ErrorIcon>⚠️</ErrorIcon>
              <span>{error}</span>
            </ErrorMessage>
          )}
        </UploadSection>
        
        {results && (
          <ResultsSection>
            <ResultsTitle>Recognition Results</ResultsTitle>
            <ResultsList>
              {results.map((result) => (
                <ResultCard key={result.id}>
                  <ResultImage>
                    <ResultImg src={result.image} alt={result.name} />
                    <ConfidenceBadge>
                      {Math.round(result.confidence * 100)}% Match
                    </ConfidenceBadge>
                  </ResultImage>
                  <ResultDetails>
                    <ResultName>{result.name}</ResultName>
                    <ResultManufacturer>{result.manufacturer}</ResultManufacturer>
                    <ResultSpecs>
                      <SpecItem>
                        <SpecLabel>Material:</SpecLabel>
                        <SpecValue>{result.specs.material}</SpecValue>
                      </SpecItem>
                      <SpecItem>
                        <SpecLabel>Size:</SpecLabel>
                        <SpecValue>{result.specs.size}</SpecValue>
                      </SpecItem>
                      <SpecItem>
                        <SpecLabel>Color:</SpecLabel>
                        <SpecValue>{result.specs.color}</SpecValue>
                      </SpecItem>
                      <SpecItem>
                        <SpecLabel>Finish:</SpecLabel>
                        <SpecValue>{result.specs.finish}</SpecValue>
                      </SpecItem>
                    </ResultSpecs>
                    <Button secondary={true} small={true}>View Details</Button>
                  </ResultDetails>
                </ResultCard>
              ))}
            </ResultsList>
          </ResultsSection>
        )}
      </RecognitionSection>
      
      <AgentSection>
        <AgentHeader>
          <AgentTitle>Recognition Assistant</AgentTitle>
          <AgentSubtitle>
            Ask questions about materials and recognition
          </AgentSubtitle>
        </AgentHeader>
        
        <AgentChatContainer>
          <AgentChat 
            agentId="recognition-assistant"
            agentName="Recognition Assistant"
            agentType={AgentType.RECOGNITION}
            initialMessages={agentMessages}
            onSend={handleUserMessage}
          />
        </AgentChatContainer>
      </AgentSection>
    </RecognitionPanelContainer>
  );
};

// Styled Components
const RecognitionPanelContainer = styled.div`
  display: flex;
  width: 100%;
  gap: 2rem;
  
  @media (max-width: 992px) {
    flex-direction: column;
  }
`;

const RecognitionSection = styled.div`
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

const UploadSection = styled.div`
  margin-bottom: 2rem;
`;

interface DropzoneProps {
  active: boolean;
}

const Dropzone = styled.div<DropzoneProps>`
  border: 2px dashed ${(props: DropzoneProps) => props.active ? '#4a90e2' : '#ccc'};
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  background-color: ${(props: DropzoneProps) => props.active ? 'rgba(74, 144, 226, 0.1)' : '#f9f9f9'};
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #4a90e2;
    background-color: rgba(74, 144, 226, 0.05);
  }
`;

const DropzoneContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
`;

const DropzoneText = styled.p`
  margin: 0;
  padding: 0;
`;

const UploadIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
`;

const DropzoneHint = styled.span`
  font-size: 0.875rem;
  color: #777;
  margin-top: 0.5rem;
`;

const PreviewContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
`;

const ImagePreview = styled.img`
  max-width: 100%;
  max-height: 400px;
  border-radius: 8px;
  border: 1px solid #eee;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
`;

const PreviewActions = styled.div`
  display: flex;
  gap: 1rem;
`;

interface ButtonProps {
  primary?: boolean;
  secondary?: boolean;
  small?: boolean;
}

const Button = styled.button<ButtonProps>`
  padding: ${(props: ButtonProps) => props.small ? '0.5rem 1rem' : '0.75rem 1.5rem'};
  font-size: ${(props: ButtonProps) => props.small ? '0.875rem' : '1rem'};
  border-radius: 4px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  
  ${(props: ButtonProps) => props.primary && `
    background-color: #4a90e2;
    color: white;
    
    &:hover:not(:disabled) {
      background-color: #3a80d2;
    }
  `}
  
  ${(props: ButtonProps) => props.secondary && `
    background-color: #f1f1f1;
    color: #333;
    
    &:hover:not(:disabled) {
      background-color: #e1e1e1;
    }
  `}
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  display: flex;
  align-items: center;
  color: #d93025;
  background-color: rgba(217, 48, 37, 0.05);
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 1rem;
  gap: 0.5rem;
`;

const ErrorIcon = styled.span`
  font-size: 1.25rem;
`;

const ResultsSection = styled.div`
  margin-top: 2rem;
`;

const ResultsTitle = styled.h3`
  font-size: 1.25rem;
  margin-bottom: 1rem;
`;

const ResultsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const ResultCard = styled.div`
  display: flex;
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const ResultImage = styled.div`
  position: relative;
  width: 180px;
  height: 180px;
  
  @media (max-width: 768px) {
    width: 100%;
    height: 200px;
  }
`;

const ResultImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ConfidenceBadge = styled.span`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
`;

const ResultDetails = styled.div`
  flex: 1;
  padding: 1rem;
  display: flex;
  flex-direction: column;
`;

const ResultName = styled.h4`
  font-size: 1.125rem;
  margin-bottom: 0.25rem;
`;

const ResultManufacturer = styled.p`
  color: #666;
  font-size: 0.875rem;
  margin-bottom: 1rem;
`;

const ResultSpecs = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const SpecItem = styled.div`
  display: flex;
  align-items: baseline;
  font-size: 0.875rem;
`;

const SpecLabel = styled.span`
  font-weight: 500;
  margin-right: 0.25rem;
`;

const SpecValue = styled.span`
  color: #555;
`;

export default RecognitionPanel;